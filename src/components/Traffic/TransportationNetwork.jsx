import React, { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import Papa from 'papaparse';
import * as d3 from 'd3';
import 'leaflet/dist/leaflet.css';
import useDynastyStore from '../../store/dynastyStore';
import './TransportationNetwork.css';

// 修复leaflet默认图标问题
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const TransportationNetwork = () => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const layersRef = useRef({});
  const markersRef = useRef([]);
  const linesRef = useRef([]);
  const routeLinesMapRef = useRef(new Map()); // 存储路线ID到polyline的映射
  
  const [routeData, setRouteData] = useState([]);
  const [detailData, setDetailData] = useState([]);
  const [selectedDynasty, setSelectedDynasty] = useState('元');
  const [loading, setLoading] = useState(true);
  
  // 聚类分析相关状态
  const [clusterData, setClusterData] = useState([]);
  const [clusterResults, setClusterResults] = useState(null);
  const [radarDataSources, setRadarDataSources] = useState({
    merceData: [],
    populationData: [],
    productData: [],
    trafficData: []
  });
  const clusterSvgRef = useRef(null);
  
  // 古城地图数据状态
  const [warData, setWarData] = useState([]);
  const [disasterData, setDisasterData] = useState([]);
  const [eventData, setEventData] = useState([]);
  const [cityDataLoading, setCityDataLoading] = useState(true);
  const [mapLayers, setMapLayers] = useState({
    modern: true,
    historical: true,
    satellite: false
  });
  const [historicalOpacity, setHistoricalOpacity] = useState(0.5);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mapMode, setMapMode] = useState('none'); // 'routes'、'heatmap'、'both' 或 'none'
  const [heatmapLoaded, setHeatmapLoaded] = useState(false);
  const heatmapLayerRef = useRef(null);
  
  // 古城数据显示控制（仅控制交通路网地图显示）
  const [showCityData, setShowCityData] = useState({
    war: false,  // 交通路网地图默认不显示任何古城数据
    disaster: false,
    event: false
  });
  
  // 古城数据标记引用
  const warMarkersRef = useRef([]);
  const disasterMarkersRef = useRef([]);
  const eventMarkersRef = useRef([]);
  
  const { 
    selectedDynasties, 
    getSelectedDisplayNames, 
    selectedRoute, 
    selectedRoutes, 
    showAllRoutes,
    setCityData,
    setShowCityDataInCharts
  } = useDynastyStore();

  // 动态加载热力图插件
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.L?.heatLayer) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js';
      script.onload = () => {
        // console.log('✅ Leaflet.heat插件加载完成');
        setHeatmapLoaded(true);
      };
      script.onerror = () => {
        // console.error('❌ Leaflet.heat插件加载失败');
      };
      document.head.appendChild(script);
    } else if (window.L?.heatLayer) {
      setHeatmapLoaded(true);
    }
  }, []);

  // 加载聚类分析所需的数据源
  useEffect(() => {
    const loadClusterDataSources = async () => {
      try {
        const [merceData, populationData, productData, trafficData] = await Promise.all([
          d3.csv('/data/merce-pj.csv'),
          d3.csv('/data/problem3/人口数量统计.csv'),
          d3.csv('/data/problem3/物产数据_按朝代排序.csv'),
          d3.csv('/data/problem3/交通数据综合分析/analysis_csv_outputs/朝代发展水平等级分布_20250604_213238.csv')
        ]);
        
        setRadarDataSources({
          merceData,
          populationData,
          productData,
          trafficData
        });
      } catch (error) {
        console.error('加载聚类分析数据源失败:', error);
      }
    };
    
    loadClusterDataSources();
  }, []);

    // 自定义聚类分配函数
  const getCustomCluster = (dynastyName) => {
    const clusterMapping = {
      // 聚类0：上古、远古、五胡十六国、宋、西楚
      '上古时代': 0,
      '远古时代': 0,
      '五胡十六国': 0,
      '宋': 0,
      '西楚': 0,
      
      // 聚类1：商、南北朝、三国、周、五代十国、晋、夏
      '商': 1,
      '南北朝': 1,
      '三国': 1,
      '周': 1,
      '五代十国': 1,
      '晋': 1,
      '夏': 1,
      
      // 聚类2：秦、汉、隋、金
      '秦': 2,
      '汉': 2,
      '隋': 2,
      '金': 2,
      
      // 聚类3：唐、辽、元、明、清、民国
      '唐': 3,
      '辽': 3,
      '元': 3,
      '明': 3,
      '清': 3,
      '民国': 3,
      
      // 聚类4：中国（现代）
      '中国': 4
    };
    
    return clusterMapping[dynastyName] !== undefined ? clusterMapping[dynastyName] : 0;
  };

  // 执行聚类分析 - 使用自定义聚类替代K-means
  useEffect(() => {
    console.log('🔍 开始执行自定义聚类分析...');
    
    // 准备所有朝代的六维数据
    const dynasties = [
      '上古时代', '远古时代', '夏', '商', '周', '秦', '西楚', '汉', '三国', '晋',
      '五胡十六国', '南北朝', '隋', '唐', '五代十国', '宋', '辽', '金', '元', '明', '清', '民国', '中国'
    ];
    
    const sixDimensionData = dynasties.map(dynasty => calculateSixDimensionData(dynasty));
    console.log('📊 六维数据准备完成:', sixDimensionData.slice(0, 3)); // 只打印前3个作为示例
    setClusterData(sixDimensionData);
    
    // 检查数据有效性
    const validData = sixDimensionData.filter(d => 
      d.political > 0 || d.military > 0 || d.economy > 0 || 
      d.population > 0 || d.resource > 0 || d.traffic > 0
    );
    
    if (validData.length < 3) {
      console.log('❌ 有效数据不足，无法执行聚类分析');
      return;
    }
    
    // 执行PCA降维
    const pcaResults = performPCA(sixDimensionData, 2);
    console.log('🔄 PCA降维完成:', {
      dataCount: pcaResults.transformedData.length,
      explainedVariance: pcaResults.explainedVariance
    });
    
    // 使用自定义聚类分配替代K-means
    const customClusters = pcaResults.transformedData.map(data => ({
      ...data,
      cluster: getCustomCluster(data.dynasty)
    }));
    
    // 计算每个聚类的中心点（用于绘制椭圆）
    const centroids = [];
    for (let i = 0; i < 5; i++) {
      const clusterPoints = customClusters.filter(d => d.cluster === i);
      if (clusterPoints.length > 0) {
        const avgPc1 = clusterPoints.reduce((sum, p) => sum + p.pc1, 0) / clusterPoints.length;
        const avgPc2 = clusterPoints.reduce((sum, p) => sum + p.pc2, 0) / clusterPoints.length;
        centroids.push({ pc1: avgPc1, pc2: avgPc2 });
      } else {
        centroids.push({ pc1: 0, pc2: 0 });
      }
    }
    
    const customResults = {
      clusters: customClusters,
      centroids: centroids
    };
    
    console.log('🎯 自定义聚类完成:', {
      clusterCount: customClusters.length,
      centroidsCount: centroids.length
    });
    
    const results = {
      pca: pcaResults,
      kmeans: customResults
    };
    
    setClusterResults(results);
    console.log('✅ 自定义聚类结果已设置:', results);
  }, []); // 移除依赖，让它在组件挂载时立即执行

    // 当外部数据源加载完成时，重新执行聚类分析以获得更准确的结果
  useEffect(() => {
    if (radarDataSources.merceData.length > 0 && 
        radarDataSources.productData.length > 0 && 
        radarDataSources.trafficData.length > 0) {
      console.log('🔄 外部数据源加载完成，重新执行自定义聚类分析...');
      
      const dynasties = [
        '上古时代', '远古时代', '夏', '商', '周', '秦', '西楚', '汉', '三国', '晋',
        '五胡十六国', '南北朝', '隋', '唐', '五代十国', '宋', '辽', '金', '元', '明', '清', '民国', '中国'
      ];
      
      const sixDimensionData = dynasties.map(dynasty => calculateSixDimensionData(dynasty));
      setClusterData(sixDimensionData);
      
      const pcaResults = performPCA(sixDimensionData, 2);
      
      // 使用自定义聚类分配
      const customClusters = pcaResults.transformedData.map(data => ({
        ...data,
        cluster: getCustomCluster(data.dynasty)
      }));
      
      // 重新计算聚类中心点
      const centroids = [];
      for (let i = 0; i < 5; i++) {
        const clusterPoints = customClusters.filter(d => d.cluster === i);
        if (clusterPoints.length > 0) {
          const avgPc1 = clusterPoints.reduce((sum, p) => sum + p.pc1, 0) / clusterPoints.length;
          const avgPc2 = clusterPoints.reduce((sum, p) => sum + p.pc2, 0) / clusterPoints.length;
          centroids.push({ pc1: avgPc1, pc2: avgPc2 });
        } else {
          centroids.push({ pc1: 0, pc2: 0 });
        }
      }
      
      const customResults = {
        clusters: customClusters,
        centroids: centroids
      };
      
      setClusterResults({
        pca: pcaResults,
        kmeans: customResults
      });
      
      console.log('✅ 使用完整数据重新计算的自定义聚类结果已更新');
    }
  }, [radarDataSources]);

  // 绘制聚类图
  const drawClusterChart = () => {
    console.log('🖼️ drawClusterChart 被调用');
    console.log('📊 clusterResults 状态:', !!clusterResults);
    console.log('🎯 SVG ref 状态:', !!clusterSvgRef.current);
    
    // 清理可能残留的悬浮框
    d3.selectAll('.cluster-info-tooltip').remove();
    
    if (!clusterResults) {
      console.log('❌ 绘制聚类图失败：缺少聚类结果数据');
      return;
    }

    if (!clusterSvgRef.current) {
      console.log('❌ 绘制聚类图失败：SVG引用不存在');
      return;
    }

    // 验证SVG元素是否真的在DOM中
    const svgElement = clusterSvgRef.current;
    if (!svgElement.parentNode) {
      console.log('❌ 绘制聚类图失败：SVG元素未挂载到DOM');
      return;
    }

    console.log('🎨 开始绘制聚类图');
    console.log('📊 聚类数据详情:', {
      pcaData: clusterResults.pca?.transformedData?.length || 0,
      kmeansData: clusterResults.kmeans?.clusters?.length || 0,
      centroids: clusterResults.kmeans?.centroids?.length || 0
    });

    try {
      const svg = d3.select(svgElement);
      svg.selectAll("*").remove();
      console.log('🧹 清除了旧的SVG内容');

          const width = 360; // 增大宽度
    const height = 300; // 增大高度以容纳下方图例
    const margin = { top: 20, right: 20, bottom: 70, left: 35 }; // 适当调整边距
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 设置比例尺
    const pc1Extent = d3.extent(clusterResults.kmeans.clusters, d => d.pc1);
    const pc2Extent = d3.extent(clusterResults.kmeans.clusters, d => d.pc2);
    
    const xScale = d3.scaleLinear()
      .domain(pc1Extent)
      .range([0, innerWidth])
      .nice();

    const yScale = d3.scaleLinear()
      .domain(pc2Extent)
      .range([innerHeight, 0])
      .nice();

    // 聚类颜色 - 低饱和度但有区分度的5种颜色，符合系统风格
    const clusterColors = ['#A68B7A', '#B8A48E', '#8FA68A', '#7A9BC4', '#A68BA6']; // 淡棕、沙褐、橄榄绿、淡蓝、淡紫
    
    // 聚类名称 - 根据北京历史发展时期命名
    const clusterNames = [
      '古代起源期', // 上古时代、远古时代、五胡十六国、宋、西楚
      '早期王朝期', // 商、南北朝、三国、周、五代十国、晋、夏
      '统一奠基期', // 秦、汉、隋、金
      '帝国鼎盛期', // 唐、辽、元、明、清、民国
      '现代共和期'  // 中国
    ];

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // 为每个聚类绘制椭圆边界
    for (let i = 0; i < clusterColors.length; i++) {
      const clusterPoints = clusterResults.kmeans.clusters.filter(d => d.cluster === i);
      
      if (clusterPoints.length > 0) {
        // 计算该聚类的边界椭圆
        const clusterPC1 = clusterPoints.map(d => d.pc1);
        const clusterPC2 = clusterPoints.map(d => d.pc2);
        
        const meanPC1 = clusterPC1.reduce((sum, val) => sum + val, 0) / clusterPC1.length;
        const meanPC2 = clusterPC2.reduce((sum, val) => sum + val, 0) / clusterPC2.length;
        
        let ellipseRx, ellipseRy;
        
        if (clusterPoints.length === 1) {
          // 单个点的聚类使用固定的椭圆大小
          ellipseRx = 25;
          ellipseRy = 20;
        } else {
          // 多个点的聚类计算标准差，用作椭圆半径
          const stdPC1 = Math.sqrt(clusterPC1.reduce((sum, val) => sum + Math.pow(val - meanPC1, 2), 0) / clusterPC1.length);
          const stdPC2 = Math.sqrt(clusterPC2.reduce((sum, val) => sum + Math.pow(val - meanPC2, 2), 0) / clusterPC2.length);
          
          // 椭圆半径乘以系数来包含大部分点（约95%的数据在2个标准差内）
          ellipseRx = Math.max(xScale(stdPC1 * 2.5) - xScale(0), 20);
          ellipseRy = Math.max(yScale(0) - yScale(stdPC2 * 2.5), 15);
        }
        
        // 绘制椭圆边界
        g.append('ellipse')
          .attr('cx', xScale(meanPC1))
          .attr('cy', yScale(meanPC2))
          .attr('rx', ellipseRx)
          .attr('ry', ellipseRy)
          .attr('fill', clusterColors[i])
          .attr('fill-opacity', 0.1)
          .attr('stroke', clusterColors[i])
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.6)
          .attr('stroke-dasharray', '5,5')
          .style('cursor', 'pointer')
          .on('mouseover', function(event) {
            // 高亮显示椭圆
            d3.select(this)
              .attr('fill-opacity', 0.25)
              .attr('stroke-width', 3)
              .attr('stroke-opacity', 0.8);

            // 创建聚类信息悬浮框
            const clusterDynasties = clusterPoints.map(d => d.dynasty);
            const tooltip = d3.select('body').append('div')
              .attr('class', 'cluster-info-tooltip')
              .style('position', 'absolute')
              .style('background', 'rgba(255, 255, 255, 0.98)')
              .style('border', `2px solid ${clusterColors[i]}`)
              .style('border-radius', '8px')
              .style('padding', '12px')
              .style('box-shadow', '0 4px 12px rgba(0,0,0,0.2)')
              .style('pointer-events', 'none')
              .style('z-index', '10001')
              .style('max-width', '280px')
              .style('font-size', '12px')
              .html(`
                <div style="
                  font-weight: bold; 
                  color: ${clusterColors[i]};
                  font-size: 13px;
                  margin-bottom: 8px;
                  border-bottom: 1px solid ${clusterColors[i]};
                  padding-bottom: 5px;
                ">
                  ${clusterNames[i]}
                </div>
                <div style="margin-bottom: 8px; color: #666;">
                  共包含 ${clusterDynasties.length} 个朝代：
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                  ${clusterDynasties.map(dynasty => `
                    <span style="
                      background-color: ${clusterColors[i]};
                      color: white;
                      padding: 2px 6px;
                      border-radius: 12px;
                      font-size: 10px;
                      font-weight: bold;
                    ">${dynasty}</span>
                  `).join('')}
                </div>
              `);

            // 计算悬浮框位置，避免超出屏幕边界
            const mouseX = event.pageX;
            const mouseY = event.pageY;
            const tooltipWidth = 280;
            const tooltipHeight = 120;
            
            let left = mouseX + 10;
            let top = mouseY - 10;
            
            // 防止右侧超出屏幕
            if (left + tooltipWidth > window.innerWidth) {
              left = mouseX - tooltipWidth - 10;
            }
            
            // 防止底部超出屏幕
            if (top + tooltipHeight > window.innerHeight) {
              top = mouseY - tooltipHeight - 10;
            }
            
            // 防止顶部超出屏幕
            if (top < 0) {
              top = mouseY + 10;
            }
            
            tooltip
              .style('left', left + 'px')
              .style('top', top + 'px');
          })
          .on('mouseout', function() {
            // 恢复椭圆样式
            d3.select(this)
              .attr('fill-opacity', 0.1)
              .attr('stroke-width', 2)
              .attr('stroke-opacity', 0.6);
            
            // 移除悬浮框
            d3.selectAll('.cluster-info-tooltip').remove();
          });
      }
    }

    // 聚类中心圆点已移除（根据用户要求）

    // 绘制数据点
    g.selectAll('.data-point')
      .data(clusterResults.kmeans.clusters)
      .enter()
      .append('circle')
      .attr('class', 'data-point')
      .attr('cx', d => xScale(d.pc1))
      .attr('cy', d => yScale(d.pc2))
      .attr('r', 4)
      .attr('fill', d => clusterColors[d.cluster])
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('opacity', 0.9)
      .on('mouseover', function(event, d) {
        // 高亮显示
        d3.select(this)
          .attr('r', 6)
          .attr('stroke-width', 2);

        // 创建工具提示
        const tooltip = d3.select('body').append('div')
          .attr('class', 'cluster-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '10000')
          .html(`
            <div><strong>${d.dynasty}</strong></div>
            <div>历史时期: ${clusterNames[d.cluster]}</div>
            <div>PC1: ${d.pc1.toFixed(2)}</div>
            <div>PC2: ${d.pc2.toFixed(2)}</div>
            <div>政治: ${d.original.political.toFixed(1)}</div>
            <div>军事: ${d.original.military.toFixed(1)}</div>
            <div>经济: ${d.original.economy.toFixed(1)}</div>
            <div>人口: ${d.original.population.toFixed(1)}</div>
            <div>物产: ${d.original.resource.toFixed(1)}</div>
            <div>交通: ${d.original.traffic.toFixed(1)}</div>
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');

        // 自动移除工具提示
        setTimeout(() => {
          tooltip.remove();
        }, 3000);
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('r', 4)
          .attr('stroke-width', 1);
        
        d3.selectAll('.cluster-tooltip').remove();
      });

    // 添加坐标轴
    const xAxis = d3.axisBottom(xScale).ticks(5);
    const yAxis = d3.axisLeft(yScale).ticks(5);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', 30)
      .attr('fill', '#666')
      .style('font-size', '10px')
      .style('text-anchor', 'middle')
      .text(`PC1 (${clusterResults.pca.explainedVariance[0]?.toFixed(1) || 0}%)`);

    g.append('g')
      .call(yAxis)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -25)
      .attr('fill', '#666')
      .style('font-size', '10px')
      .style('text-anchor', 'middle')
      .text(`PC2 (${clusterResults.pca.explainedVariance[1]?.toFixed(1) || 0}%)`);

    // 添加标题
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text('朝代六维发展聚类分析');

        // 添加图例 - 放在底部，水平排列
    const legend = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${height - 45})`);

    // 计算每个图例项的宽度，以便居中排列
    const legendItemWidth = innerWidth / clusterColors.length;

    clusterColors.forEach((color, i) => {
      const clusterSize = clusterResults.kmeans.clusters.filter(d => d.cluster === i).length;
      const x = i * legendItemWidth + legendItemWidth / 2;
      
      // 图例圆点
      legend.append('circle')
        .attr('cx', x)
        .attr('cy', 0)
        .attr('r', 4)
        .attr('fill', color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

      // 图例文字 - 分两行显示
      legend.append('text')
        .attr('x', x)
        .attr('y', 15)
        .style('font-size', '8px')
        .style('fill', '#333')
        .style('font-weight', 'bold')
        .style('text-anchor', 'middle')
        .text(clusterNames[i]);
        
      legend.append('text')
        .attr('x', x)
        .attr('y', 25)
        .style('font-size', '7px')
        .style('fill', '#666')
        .style('text-anchor', 'middle')
        .text(`(${clusterSize})`);
    });

      console.log('✅ 聚类图绘制完成');

    } catch (error) {
      console.error('❌ 绘制聚类图时发生错误:', error);
      console.error('错误堆栈:', error.stack);
    }
  };

  // 绘制聚类图当数据就绪时 - 使用useLayoutEffect确保DOM更新后执行
  React.useLayoutEffect(() => {
    if (clusterResults) {
      console.log('🎨 开始绘制聚类图，数据:', clusterResults);
      console.log('📍 SVG引用状态:', !!clusterSvgRef.current);
      
      // 如果SVG引用不存在，延迟重试
      if (!clusterSvgRef.current) {
        console.log('⏳ SVG引用不存在，延迟重试...');
        const timer = setTimeout(() => {
          console.log('🔄 延迟重试绘制聚类图');
          console.log('📍 重试时SVG引用状态:', !!clusterSvgRef.current);
          if (clusterSvgRef.current) {
            drawClusterChart();
          } else {
            console.log('❌ 延迟重试仍然失败，SVG引用不存在');
            // 最后一次重试，使用更长延迟
            const secondTimer = setTimeout(() => {
              console.log('🔄 最后一次重试绘制聚类图');
              console.log('📍 最后重试时SVG引用状态:', !!clusterSvgRef.current);
              if (clusterSvgRef.current) {
                drawClusterChart();
              }
            }, 500);
            return () => clearTimeout(secondTimer);
          }
        }, 100);
        return () => clearTimeout(timer);
      } else {
        drawClusterChart();
      }
    } else {
      console.log('❌ clusterResults 为空，无法绘制聚类图');
    }
  }, [clusterResults]);

  // 组件卸载时清理悬浮框
  useEffect(() => {
    return () => {
      d3.selectAll('.cluster-info-tooltip').remove();
    };
  }, []);



  // PCA降维算法
  const performPCA = (data, dimensions = 2) => {
    if (data.length === 0) return { transformedData: [], explainedVariance: [] };
    
    // 数据标准化
    const features = ['political', 'military', 'economy', 'population', 'resource', 'traffic'];
    const matrix = data.map(d => features.map(f => +d[f] || 0));
    
    // 计算均值
    const means = features.map((_, i) => {
      const sum = matrix.reduce((acc, row) => acc + row[i], 0);
      return sum / matrix.length;
    });
    
    // 中心化数据
    const centeredMatrix = matrix.map(row => 
      row.map((val, i) => val - means[i])
    );
    
    // 计算协方差矩阵
    const n = centeredMatrix.length;
    const covMatrix = Array(features.length).fill(0).map(() => Array(features.length).fill(0));
    
    for (let i = 0; i < features.length; i++) {
      for (let j = 0; j < features.length; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += centeredMatrix[k][i] * centeredMatrix[k][j];
        }
        covMatrix[i][j] = sum / (n - 1);
      }
    }
    
    // 简化的特征值分解（使用数值方法）
    const eigenVectors = [];
    const eigenValues = [];
    
    // 使用幂迭代法计算主要特征向量
    for (let dim = 0; dim < dimensions; dim++) {
      let vector = Array(features.length).fill(0).map(() => Math.random() - 0.5);
      
      // 幂迭代
      for (let iter = 0; iter < 100; iter++) {
        // 矩阵向量乘法
        const newVector = Array(features.length).fill(0);
        for (let i = 0; i < features.length; i++) {
          for (let j = 0; j < features.length; j++) {
            newVector[i] += covMatrix[i][j] * vector[j];
          }
        }
        
        // 归一化
        const norm = Math.sqrt(newVector.reduce((sum, val) => sum + val * val, 0));
        if (norm > 0) {
          vector = newVector.map(val => val / norm);
        }
      }
      
      eigenVectors.push(vector);
      
      // 计算特征值
      let eigenValue = 0;
      for (let i = 0; i < features.length; i++) {
        for (let j = 0; j < features.length; j++) {
          eigenValue += vector[i] * covMatrix[i][j] * vector[j];
        }
      }
      eigenValues.push(Math.abs(eigenValue));
      
      // 从协方差矩阵中移除当前主成分的贡献
      for (let i = 0; i < features.length; i++) {
        for (let j = 0; j < features.length; j++) {
          covMatrix[i][j] -= eigenValue * vector[i] * vector[j];
        }
      }
    }
    
    // 投影数据到新空间
    const transformedData = centeredMatrix.map((row, idx) => {
      const projected = eigenVectors.map(vector => 
        row.reduce((sum, val, i) => sum + val * vector[i], 0)
      );
      return {
        dynasty: data[idx].dynasty,
        pc1: projected[0] || 0,
        pc2: projected[1] || 0,
        original: data[idx]
      };
    });
    
    // 计算解释方差比
    const totalVariance = eigenValues.reduce((sum, val) => sum + val, 0);
    const explainedVariance = eigenValues.map(val => (val / totalVariance) * 100);
    
    return { transformedData, explainedVariance };
  };

  // K-means聚类算法
  const performKMeans = (data, k = 4, maxIterations = 100) => {
    if (data.length === 0) return { clusters: [], centroids: [] };
    
    // 初始化聚类中心
    let centroids = [];
    for (let i = 0; i < k; i++) {
      const randomPoint = data[Math.floor(Math.random() * data.length)];
      centroids.push({
        pc1: randomPoint.pc1 + (Math.random() - 0.5) * 0.1,
        pc2: randomPoint.pc2 + (Math.random() - 0.5) * 0.1
      });
    }
    
    let clusters = [];
    let converged = false;
    let iteration = 0;
    
    while (!converged && iteration < maxIterations) {
      // 分配点到最近的聚类中心
      clusters = data.map(point => {
        let minDistance = Infinity;
        let clusterIndex = 0;
        
        centroids.forEach((centroid, i) => {
          const distance = Math.sqrt(
            Math.pow(point.pc1 - centroid.pc1, 2) + 
            Math.pow(point.pc2 - centroid.pc2, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            clusterIndex = i;
          }
        });
        
        return {
          ...point,
          cluster: clusterIndex,
          distance: minDistance
        };
      });
      
      // 更新聚类中心
      const newCentroids = [];
      for (let i = 0; i < k; i++) {
        const clusterPoints = clusters.filter(point => point.cluster === i);
        if (clusterPoints.length > 0) {
          const avgPc1 = clusterPoints.reduce((sum, p) => sum + p.pc1, 0) / clusterPoints.length;
          const avgPc2 = clusterPoints.reduce((sum, p) => sum + p.pc2, 0) / clusterPoints.length;
          newCentroids.push({ pc1: avgPc1, pc2: avgPc2 });
        } else {
          newCentroids.push(centroids[i]);
        }
      }
      
      // 检查收敛
      converged = centroids.every((centroid, i) => {
        const newCentroid = newCentroids[i];
        return Math.abs(centroid.pc1 - newCentroid.pc1) < 0.001 && 
               Math.abs(centroid.pc2 - newCentroid.pc2) < 0.001;
      });
      
      centroids = newCentroids;
      iteration++;
    }
    
    return { clusters, centroids };
  };

  // 朝代名称映射和数据处理
  const mapDynastyName = (dynastyName) => {
    const mapping = {
      '上古时代': '上古',
      '远古时代': '远古',
      '西楚': '楚',
      '三国': '魏晋',
      '五胡十六国': '十六国',
      '南北朝': '北朝',
      '五代十国': '五代',
      '民国': '近代-民国',
      '中国': '现代'
    };
    return mapping[dynastyName] || dynastyName;
  };

  const findMatchingDynasty = (targetDynasty, dataSourceDynasties) => {
    const mapped = mapDynastyName(targetDynasty);
    
    let match = dataSourceDynasties.find(d => d === mapped);
    if (match) return match;
    
    match = dataSourceDynasties.find(d => d.includes(mapped) || mapped.includes(d));
    if (match) return match;
    
    const specialMappings = {
      '夏': ['夏商', '夏商时期'],
      '商': ['夏商', '夏商时期', '商'],
      '周': ['西周', '东周', '先秦-西周'],
      '秦': ['先秦-战国', '秦'],
      '汉': ['汉-西汉', '汉-东汉'],
      '晋': ['西晋', '魏晋'],
      '唐': ['唐'],
      '宋': ['宋-北宋', '宋-南宋'],
      '元': ['元'],
      '明': ['明'],
      '清': ['清'],
    };
    
    const alternatives = specialMappings[mapped];
    if (alternatives) {
      match = dataSourceDynasties.find(d => alternatives.some(alt => d.includes(alt) || alt.includes(d)));
      if (match) return match;
    }
    
    return null;
  };

  // 计算六维雷达图数据
  const calculateSixDimensionData = (dynastyName) => {
    console.log('📊 计算六维数据 for:', dynastyName);
    
    const mappedName = mapDynastyName(dynastyName);
    
    // 硬编码的政治、军事和人口数据（来自TimeControl的csvData）
    const dynastyStaticData = {
      '上古时代': { political: 21, military: 1.3, population: 2 },
      '远古时代': { political: 31, military: 1.5, population: 3 },
      '夏': { political: 41, military: 1.8, population: 2 },
      '商': { political: 53, military: 4.0, population: 3 },
      '周': { political: 56, military: 6.5, population: 3 },
      '秦': { political: 70, military: 8.5, population: 3 },
      '西楚': { political: 38, military: 7.0, population: 2 },
      '汉': { political: 78, military: 8.0, population: 4 },
      '三国': { political: 32, military: 7.5, population: 2 },
      '晋': { political: 47, military: 4.0, population: 2 },
      '五胡十六国': { political: 18, military: 3.5, population: 2 },
      '南北朝': { political: 46, military: 5.0, population: 3 },
      '隋': { political: 63, military: 6.5, population: 4 },
      '唐': { political: 84, military: 9.0, population: 4 },
      '五代十国': { political: 28, military: 3.0, population: 2 },
      '宋': { political: 63, military: 5.5, population: 3 },
      '辽': { political: 61, military: 7.0, population: 4 },
      '金': { political: 61, military: 7.5, population: 4 },
      '元': { political: 63, military: 9.5, population: 5 },
      '明': { political: 70, military: 6.0, population: 4 },
      '清': { political: 73, military: 7, population: 4 },
      '民国': { political: 48, military: 4.5, population: 5 },
      '中国': { political: 81, military: 10.0, population: 5 }
    };
    
    const dynastyData = dynastyStaticData[dynastyName] || { political: 0, military: 0, population: 0 };
    const political = dynastyData.political;
    const military = dynastyData.military * 10;
    
    // 经济数据（从merce-pj.csv获取）
    let economy = 0;
    if (radarDataSources.merceData.length > 0) {
      const merceItemDynasties = radarDataSources.merceData.map(item => item['朝代']);
      const matchedMerceDynasty = findMatchingDynasty(dynastyName, merceItemDynasties);
      const merceItem = matchedMerceDynasty ? 
        radarDataSources.merceData.find(item => item['朝代'] === matchedMerceDynasty) : null;
      economy = merceItem ? +merceItem['综合评分'] * 20 : 0;
    }
    
    // 人口数据（使用硬编码数据，范围2-5，缩放到40-100）
    const population = dynastyData.population * 20;
    
    // 物产资源数据
    let resource = 0;
    if (radarDataSources.productData.length > 0) {
      const productDynasties = [...new Set(radarDataSources.productData.map(item => item.dynasty))];
      const matchedProductDynasty = findMatchingDynasty(dynastyName, productDynasties);
      const productItems = matchedProductDynasty ? 
        radarDataSources.productData.filter(item => item.dynasty === matchedProductDynasty) :
        radarDataSources.productData.filter(item => {
          return item.dynasty.includes(mappedName) || mappedName.includes(item.dynasty);
        });
          
      const uniqueCategories = new Set();
      productItems.forEach(item => {
        if (item.product_category) {
          const categories = item.product_category.match(/（([^）]+)）/g);
          if (categories) {
            categories.forEach(cat => {
              const cleanCat = cat.replace(/[（）]/g, '');
              uniqueCategories.add(cleanCat);
            });
          }
        }
      });
      resource = Math.min(uniqueCategories.size * 8, 100);
    }
    
    // 交通发展数据
    let traffic = 0;
    if (radarDataSources.trafficData.length > 0) {
      const trafficDynasties = radarDataSources.trafficData.map(item => item['朝代']);
      const matchedTrafficDynasty = findMatchingDynasty(dynastyName, trafficDynasties);
      const trafficItem = matchedTrafficDynasty ? 
        radarDataSources.trafficData.find(item => item['朝代'] === matchedTrafficDynasty) : null;
      traffic = trafficItem ? +trafficItem['综合得分'] : 0;
    }
    
    console.log(`📊 ${dynastyName} 六维数据:`, { political, military, economy, population, resource, traffic });
    
    return {
      dynasty: dynastyName,
      political,
      military,
      economy,
      population,
      resource,
      traffic
    };
  };

  // 系统主题颜色调色板 - 低饱和度版本
  const systemColorPalette = useMemo(() => [
    '#9B8A70', // 淡雅棕色（降低饱和度）
    '#A68B7A', // 柔和深棕色
    '#C4B49B', // 柔和秘鲁色
    '#D9CDBA', // 柔和浅棕色
    '#E0CBA8', // 淡雅沙棕色
    '#C4A584', // 柔和巧克力色
    '#B39D85', // 淡雅金褐色
    '#C4B087', // 柔和金色
    '#C4A8A8', // 淡雅玫瑰棕
    '#A3B8A3', // 柔和海绿色
    '#8A9AA3', // 柔和石板色
    '#8A8A8A', // 淡雅灰色
    '#8F9DAD', // 柔和浅石板色
    '#5F6F6F', // 淡雅暗石板色
    '#7A8C5F', // 柔和橄榄绿
    '#A68B7A', // 柔和马鞍棕
    '#9B7858', // 淡雅马鞍棕
    '#85936B', // 柔和橄榄色
    '#B3C49E', // 淡雅黄绿色
    '#7AB37A'  // 柔和酸橙绿
  ], []);

  // 历史地图图层配置 - 基于实际KML文件
  const historicalMaps = useMemo(() => {
    // 朝代名称到KML文件映射
    const dynastyToKmlMapping = {
      // 有KML文件的朝代
      '商': '商時期地圖',
      '先秦-春秋': '春秋時期地圖', 
      '先秦-战国': '戰國時期地圖',
      '秦': '秦代歷史地圖(Qin)',
      '汉-西汉': '西漢歷史地圖(W. Han)',
      '汉-东汉': '東漢歷史地圖(E. Han)',
      '三国': '三國歷史地圖(Sanguo)',
      '西晋': '西晉歷史地圖(W. Jing)',
      '东晋': '東晉歷史地圖(E. Jing)',
      '南朝': '南北朝歷史地圖(South and North)',
      '北朝': '南北朝歷史地圖(South and North)',
      '隋': '隋代歷史地圖(Sui)',
      '唐': '唐代歷史地圖(Tang)',
      '宋-北宋': '北宋歷史地圖(N. Song)',
      '宋-南宋': '南宋歷史地圖(S. Song)',
      '元': '元代歷史地圖(Yuan)',
      '明': '明代歷史地圖(Ming)',
      '清': '清代歷史地圖(Qing)'
    };

    // 从KML文件获取的实际URL映射
    const kmlUrlMapping = {
      '商時期地圖': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=shang-png-{z}-{x}-{y}',
      '春秋時期地圖': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=spring_autumn-png-{z}-{x}-{y}',
      '戰國時期地圖': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=warring_states-png-{z}-{x}-{y}',
      '秦代歷史地圖(Qin)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=bc0210-png-{z}-{x}-{y}',
      '西漢歷史地圖(W. Han)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=bc0007-png-{z}-{x}-{y}',
      '東漢歷史地圖(E. Han)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0140-png-{z}-{x}-{y}',
      '三國歷史地圖(Sanguo)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0262-png-{z}-{x}-{y}',
      '西晉歷史地圖(W. Jing)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0281-png-{z}-{x}-{y}',
      '東晉歷史地圖(E. Jing)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0382-png-{z}-{x}-{y}',
      '南北朝歷史地圖(South and North)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0497-png-{z}-{x}-{y}',
      '隋代歷史地圖(Sui)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0612-png-{z}-{x}-{y}',
      '唐代歷史地圖(Tang)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0741-png-{z}-{x}-{y}',
      '北宋歷史地圖(N. Song)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad1111-png-{z}-{x}-{y}',
      '南宋歷史地圖(S. Song)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad1208-png-{z}-{x}-{y}',
      '元代歷史地圖(Yuan)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad1330-png-{z}-{x}-{y}',
      '明代歷史地圖(Ming)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad1582-png-{z}-{x}-{y}',
      '清代歷史地圖(Qing)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad1820-png-{z}-{x}-{y}'
    };

    // 构建最终的历史地图配置
    const maps = {};
    
    // 为有KML文件的朝代配置真实URL
    Object.entries(dynastyToKmlMapping).forEach(([dynasty, kmlName]) => {
      if (kmlUrlMapping[kmlName]) {
        maps[dynasty] = {
          url: kmlUrlMapping[kmlName],
          name: kmlName,
          attribution: `${kmlName} | 中研院`
        };
      }
    });

    // 为其他朝代配置备用URL（使用相近时期的地图）
    const fallbackMaps = {
      '上古': maps['商'] || null,
      '远古': maps['商'] || null,
      '夏': maps['商'] || null,
      '先秦': maps['先秦-春秋'] || null,
      '先秦-西周': maps['先秦-春秋'] || null,
      '先秦-东周': maps['先秦-春秋'] || null,
      '汉': maps['汉-西汉'] || null,
      '十六国': maps['东晋'] || null,
      '北朝-北魏': maps['北朝'] || null,
      '北朝-东魏': maps['北朝'] || null,
      '北朝-西魏': maps['北朝'] || null,
      '北朝-北齐': maps['北朝'] || null,
      '北朝-北周': maps['北朝'] || null,
      '五代十国': maps['唐'] || null,
      '宋': maps['宋-北宋'] || null,
      '辽': maps['宋-北宋'] || null,
      '金': maps['宋-南宋'] || null,
      '近代': maps['清'] || null,
      '近代-民国': maps['清'] || null,
      '现代': maps['清'] || null
    };

    // 合并所有配置
    return { ...maps, ...fallbackMaps };
  }, []);

  // 判断经纬度是否在中国境内
  const isInChina = (longitude, latitude) => {
    return longitude >= 73 && longitude <= 135 && latitude >= 18 && latitude <= 54;
  };

  // 创建古城数据图标
  const createCityDataIcon = (type, size = 'medium') => {
    const iconConfig = {
      war: { color: '#D49C6A', symbol: '⚔️' },
      disaster: { color: '#A0C1B8', symbol: '🌪️' },
      event: { color: '#B8A48E', symbol: '📜' }
    };
    
    const sizeConfig = {
      small: { width: 20, height: 20, fontSize: '12px' },
      medium: { width: 24, height: 24, fontSize: '14px' },
      large: { width: 28, height: 28, fontSize: '16px' }
    };
    
    const config = iconConfig[type];
    const sizeProps = sizeConfig[size];
    
    return L.divIcon({
      html: `
        <div style="
          width: ${sizeProps.width}px;
          height: ${sizeProps.height}px;
          background-color: ${config.color};
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${sizeProps.fontSize};
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        ">${config.symbol}</div>
      `,
      className: `city-data-marker city-data-${type}`,
      iconSize: [sizeProps.width, sizeProps.height],
      iconAnchor: [sizeProps.width / 2, sizeProps.height / 2]
    });
  };

  // 创建平滑曲线的函数
  const createSmoothCurve = (coordinates) => {
    // 首先验证输入坐标的有效性
    const validCoordinates = coordinates.filter(coord => {
      return Array.isArray(coord) && 
            coord.length >= 2 && 
            !isNaN(coord[0]) && !isNaN(coord[1]) && 
            isFinite(coord[0]) && isFinite(coord[1]);
    });
    
    if (validCoordinates.length < 2) return [];
    
    if (validCoordinates.length === 2) {
      // 对于只有两个点的情况，添加一个中间点来创建轻微的弧形
      const start = validCoordinates[0];
      const end = validCoordinates[1];
      
      // 验证起点和终点
      if (start[0] === end[0] && start[1] === end[1]) {
        return [start]; // 如果是同一个点，只返回一个点
      }
      
      const midLat = (start[0] + end[0]) / 2;
      const midLng = (start[1] + end[1]) / 2;
      
      // 计算距离，避免除零错误
      const distance = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
      
      if (distance === 0 || !isFinite(distance)) {
        return [start]; // 如果距离为0或无效，只返回起点
      }
      
      // 添加轻微的偏移来创建弧形效果
      const offset = distance * 0.1; // 偏移量为距离的10%
      
      // 计算垂直方向的偏移，确保不会产生NaN
      const perpLat = -(end[1] - start[1]) / distance * offset;
      const perpLng = (end[0] - start[0]) / distance * offset;
      
      // 验证计算结果
      const midPoint = [midLat + perpLat, midLng + perpLng];
      if (isNaN(midPoint[0]) || isNaN(midPoint[1]) || !isFinite(midPoint[0]) || !isFinite(midPoint[1])) {
        return [start, end]; // 如果中点计算失败，返回原始两点
      }
      
      return [start, midPoint, end];
    }

    const smoothCoordinates = [];
    
    for (let i = 0; i < validCoordinates.length - 1; i++) {
      const current = validCoordinates[i];
      const next = validCoordinates[i + 1];
      
      smoothCoordinates.push(current);
      
      // 在每两个点之间添加插值点来创建平滑效果
      const segments = 3; // 每段分成3个子段
      for (let j = 1; j < segments; j++) {
        const t = j / segments;
        
        // 使用贝塞尔曲线插值
        let controlLat = current[0];
        let controlLng = current[1];
        
        // 如果有前一个点，使用它来计算控制点
        if (i > 0) {
          const prev = validCoordinates[i - 1];
          controlLat += (current[0] - prev[0]) * 0.2;
          controlLng += (current[1] - prev[1]) * 0.2;
        }
        
        // 如果有后续点，也考虑它
        if (i < validCoordinates.length - 2) {
          const afterNext = validCoordinates[i + 2];
          controlLat += (afterNext[0] - next[0]) * 0.1;
          controlLng += (afterNext[1] - next[1]) * 0.1;
        }
        
        // 计算插值点
        const lat = current[0] * (1 - t) * (1 - t) + 2 * controlLat * (1 - t) * t + next[0] * t * t;
        const lng = current[1] * (1 - t) * (1 - t) + 2 * controlLng * (1 - t) * t + next[1] * t * t;
        
        // 验证插值结果
        if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
          smoothCoordinates.push([lat, lng]);
        }
      }
    }
    
    // 添加最后一个点
    if (validCoordinates.length > 0) {
      smoothCoordinates.push(validCoordinates[validCoordinates.length - 1]);
    }
    
    // 最终验证所有坐标
    return smoothCoordinates.filter(coord => 
      !isNaN(coord[0]) && !isNaN(coord[1]) && 
      isFinite(coord[0]) && isFinite(coord[1])
    );
  };

  // 地图初始化函数
  const initMap = () => {
    console.log('🗺️ initMap 函数被调用');
    console.log('🗺️ 地图容器状态:', !!mapContainerRef.current);
    console.log('🗺️ 当前地图实例状态:', !!mapRef.current);
    
    if (!mapContainerRef.current) {
      console.error('❌ 地图容器未找到，取消初始化');
      return;
    }
    
    if (mapRef.current) {
      console.log('⚠️ 地图已存在，跳过初始化');
      return;
    }

    try {
      const container = mapContainerRef.current;
      
      // 检查容器是否有有效尺寸
      if (!container?.offsetWidth || !container?.offsetHeight) {
        container.style.width = '100%';
        container.style.height = '500px';
        container.style.minHeight = '500px';
      }
      
      // 检查Leaflet是否可用
      if (!L || !L.map) {
        console.error('Leaflet库未正确加载');
        return;
      }
      
      // 创建地图实例
      const map = L.map(container, {
        center: [39.9042, 116.4074],
        zoom: 5,
        maxBounds: [
          [16.957, 65.266],  // 南西
          [59.376, 145.437]  // 北东
        ],
        maxBoundsViscosity: 1.0,
        // 禁用attribution控件
        attributionControl: false,
        // 防止地图事件干扰UI
        keyboard: false,
        doubleClickZoom: true,
        boxZoom: true,
        tap: false,
        touchZoom: true,
        scrollWheelZoom: true,
        dragging: true
      });

      // 立即更新引用和状态
      mapRef.current = map;
      setMapInitialized(true);
      console.log('✅ 地图实例创建成功并保存到 mapRef.current');

      // 添加现代地图图层（高德地图）
      const modernLayer = L.tileLayer('https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        maxZoom: 18
      });
      
      // 添加卫星图层
      const satelliteLayer = L.tileLayer('https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', {
        maxZoom: 18
      });

      layersRef.current = {
        modern: modernLayer,
        satellite: satelliteLayer,
        historical: null
      };

      // 默认添加现代地图
      modernLayer.addTo(map);

      // 监听图层加载错误
      modernLayer.on('tileerror', (e) => {
        console.error('图层加载错误:', e);
      });

      // 添加地图事件监听 - 确保不干扰UI
      map.on('click', (e) => {
        // 阻止事件冒泡到document
        e.originalEvent.stopPropagation();
      });
      
      map.on('mousedown', (e) => {
        // 阻止地图拖拽时干扰UI
        e.originalEvent.stopPropagation();
      });

      // 强制地图重新计算尺寸
      setTimeout(() => {
        if (map && mapRef.current) {
          map.invalidateSize();
        }
      }, 100);

    } catch (error) {
      console.error('❌ 地图初始化失败:', error);
      console.error('错误堆栈:', error.stack);
      setMapInitialized(false);
    }
  };

  // 初始化地图 - 监听容器变化
  useEffect(() => {
    // 只有在地图未初始化且容器存在时才初始化
    if (!mapRef.current && mapContainerRef.current) {
      console.log('开始初始化地图...');
      const timer = setTimeout(() => {
        initMap();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // 组件卸载时清理地图
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapInitialized(false);
      }
    };
  }, []);

  // 额外的地图初始化检查 - 确保地图被正确创建
  useEffect(() => {
    if (!mapRef.current && !loading) {
      console.log('🔄 地图实例缺失，尝试重新初始化...');
      const timer = setTimeout(() => {
        if (!mapRef.current && mapContainerRef.current) {
          console.log('🔄 执行延迟初始化...');
          initMap();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // 加载交通数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // console.log('开始加载交通数据...');
        
        // 加载路线汇总数据
        const routeResponse = await fetch('/data/problem3/交通路线汇总.csv');
        const routeText = await routeResponse.text();
        const routeLines = routeText.split('\n').slice(1);
        
        const routeData = routeLines
          .filter(line => line.trim())
          .map(line => {
            const columns = line.split(',');
            return {
              route_id: columns[0],
              dynasty: columns[1],
              exact_year: columns[2],
              route_name: columns[3],
              transport_tool: columns[4],
              transport_route: columns[5],
              total_places: parseInt(columns[6]) || 0,
              found_places: parseInt(columns[7]) || 0,
              completion_rate: columns[8],
              all_places_found: columns[9] === 'True',
              original_text: columns[10]
            };
          });

        // 加载详细地点数据
        const detailResponse = await fetch('/data/problem3/交通路线地点详细.csv');
        const detailText = await detailResponse.text();
        const detailLines = detailText.split('\n').slice(1);
        
        const detailData = detailLines
          .filter(line => line.trim())
          .map(line => {
            const columns = line.split(',');
            return {
              route_id: columns[0],
              dynasty: columns[1],
              exact_year: columns[2],
              route_name: columns[3],
              place_name: columns[4],
              latitude: isNaN(parseFloat(columns[5])) ? 0 : parseFloat(columns[5]),
              longitude: isNaN(parseFloat(columns[6])) ? 0 : parseFloat(columns[6]),
              place_type: columns[7],
              place_years: columns[8],
              place_parent: columns[9],
              data_source: columns[10],
              order_in_route: parseInt(columns[11]) || 0,
              status: columns[12],
              search_strategy: columns[13]
            };
          });

        setRouteData(routeData);
        setDetailData(detailData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading transportation data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 加载古城地图数据
  useEffect(() => {
    const loadCityData = async () => {
      try {
        setCityDataLoading(true);
        
        const parseOptions = { header: true, skipEmptyLines: true };
        const processRowAttributes = (r) => ({
          regime_change: Number(r.regime_change || 0),
          urban_reconstruction: Number(r.urban_reconstruction || 0),
          urban_expansion: Number(r.urban_expansion || 0),
          population_change: Number(r.population_change || 0),
          economic_cultural_impact: Number(r.economic_cultural_impact || 0),
        });

        const [warRes, disasterRes, eventRes] = await Promise.all([
          fetch('/data/战争定位.csv').then(res => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status} for 战争定位.csv`))).then(txt => Papa.parse(txt, parseOptions).data),
          fetch('/data/灾害定位.csv').then(res => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status} for 灾害定位.csv`))).then(txt => Papa.parse(txt, parseOptions).data),
          fetch('/data/事件定位.csv').then(res => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status} for 事件定位.csv`))).then(txt => Papa.parse(txt, parseOptions).data)
        ]);

        // 将数据保存到store
        const loadedWarData = warRes.filter(r => r.latitude && r.longitude).map(r => ({ 
          ...r, 
          latitude: parseFloat(r.latitude), 
          longitude: parseFloat(r.longitude), 
          ...processRowAttributes(r) 
        }));
        
        const loadedDisasterData = disasterRes.filter(r => r.latitude && r.longitude && r.disaster_type).map(r => ({ 
          ...r, 
          latitude: parseFloat(r.latitude), 
          longitude: parseFloat(r.longitude), 
          ...processRowAttributes(r) 
        }));
        
        const loadedEventData = eventRes.filter(r => r.latitude && r.longitude && r.event_name).map(r => ({ 
          ...r, 
          latitude: parseFloat(r.latitude), 
          longitude: parseFloat(r.longitude), 
          ...processRowAttributes(r) 
        }));

        setWarData(loadedWarData);
        setDisasterData(loadedDisasterData);
        setEventData(loadedEventData);

        // 更新store中的古城数据
        setCityData({
          warData: loadedWarData,
          disasterData: loadedDisasterData,
          eventData: loadedEventData,
          loading: false
        });

        setCityDataLoading(false);
      } catch (error) {
        console.error('古城地图数据加载失败:', error);
        setCityDataLoading(false);
        setCityData({ loading: false });
      }
    };

    loadCityData();
  }, []); // 移除setCityData依赖，避免无限渲染

  // 获取可用的朝代列表
  const availableDynasties = useMemo(() => {
    const dynasties = [...new Set(routeData.map(route => route.dynasty))];
    return ['全部', ...dynasties.sort()];
  }, [routeData]);

  // 过滤数据基于选中的朝代和显示模式
  const filteredData = useMemo(() => {
    let filteredRoutes, filteredDetails;
    
    // 首先按朝代过滤
    if (selectedDynasty === '全部') {
      filteredRoutes = routeData;
      filteredDetails = detailData;
    } else {
      filteredRoutes = routeData.filter(route => route.dynasty === selectedDynasty);
      const routeIds = new Set(filteredRoutes.map(route => route.route_id));
      filteredDetails = detailData.filter(detail => routeIds.has(detail.route_id));
    }
    
    // 然后根据显示模式进一步过滤
    if (!showAllRoutes && selectedRoutes.length > 0) {
      // 仅显示选中的路线
      const selectedRouteNames = selectedRoutes
        .filter(r => r.dynasty === selectedDynasty)
        .map(r => r.routeName);
      
      if (selectedRouteNames.length > 0) {
        filteredRoutes = filteredRoutes.filter(route => 
          selectedRouteNames.includes(route.route_name)
        );
        const selectedRouteIds = new Set(filteredRoutes.map(route => route.route_id));
        filteredDetails = filteredDetails.filter(detail => 
          selectedRouteIds.has(detail.route_id)
        );
        

      }
    }
    
    return { routes: filteredRoutes, details: filteredDetails };
  }, [routeData, detailData, selectedDynasty, showAllRoutes, selectedRoutes]);

  // 路线颜色映射
  const routeColorMapping = useMemo(() => {
    const mapping = new Map();
    let colorIndex = 0;
    
    // 按朝代分组路线
    const dynastyRoutes = {};
    filteredData.routes.forEach(route => {
      if (!dynastyRoutes[route.dynasty]) {
        dynastyRoutes[route.dynasty] = [];
      }
      dynastyRoutes[route.dynasty].push(route.route_id);
    });
    
    // 为每个朝代的路线分配不同颜色
    Object.entries(dynastyRoutes).forEach(([dynasty, routes]) => {
      routes.forEach((routeId, index) => {
        // 确保同一朝代内的路线使用不同颜色
        const color = systemColorPalette[(colorIndex + index) % systemColorPalette.length];
        mapping.set(routeId, color);
      });
      // 每个朝代结束后，调整颜色索引以避免相邻朝代颜色太相似
      colorIndex += routes.length + 1;
    });
    
    return mapping;
  }, [filteredData.routes, systemColorPalette]);

  // 获取当前朝代的历史地图配置
  const currentHistoricalMap = useMemo(() => {
    if (selectedDynasty === '全部') return null;
    
    // 直接匹配朝代名称
    if (historicalMaps[selectedDynasty]) {
      return historicalMaps[selectedDynasty];
    }
    
    return null;
  }, [selectedDynasty, historicalMaps]);

  // 更新历史地图图层
  useEffect(() => {
    if (!mapRef.current) {
      console.log('❌ 地图实例不存在，跳过历史地图更新');
      return;
    }

    console.log(`🔄 更新历史地图图层，当前朝代: "${selectedDynasty}"`);
    console.log('当前历史地图配置:', currentHistoricalMap);
    console.log('地图图层状态:', mapLayers);

    // 移除旧的历史地图图层
    if (layersRef.current.historical) {
      console.log('🗑️ 移除旧的历史地图图层');
      mapRef.current.removeLayer(layersRef.current.historical);
      layersRef.current.historical = null;
    }

    // 添加新的历史地图图层
    if (currentHistoricalMap && mapLayers.historical) {
      console.log('✅ 开始添加历史地图图层:', currentHistoricalMap.name);
      console.log('图层URL:', currentHistoricalMap.url);
      
      const historicalLayer = L.tileLayer(currentHistoricalMap.url, {
        minZoom: 0,
        maxZoom: 19,
        opacity: historicalOpacity,
        bounds: [
          [16.957, 65.266],
          [59.376, 145.437]
        ]
      });
      
      // 监听图层加载成功
      historicalLayer.on('load', () => {
        console.log('✅ 历史地图图层加载成功:', currentHistoricalMap.name);
      });
      
      // 监听图层加载错误
      historicalLayer.on('tileerror', (e) => {
        console.error(`❌ 历史地图图层加载错误: ${currentHistoricalMap.name}`, e);
      });
      
      historicalLayer.addTo(mapRef.current);
      layersRef.current.historical = historicalLayer;
      console.log('✅ 历史地图图层已添加到地图');
    } else {
      if (!currentHistoricalMap) {
        console.log('⚠️ 当前朝代没有历史地图配置');
      }
      if (!mapLayers.historical) {
        console.log('⚠️ 历史地图图层被禁用');
      }
    }
  }, [currentHistoricalMap, mapLayers.historical, historicalOpacity, selectedDynasty, mapInitialized]);

  // 控制图层显示/隐藏
  useEffect(() => {
    if (!mapRef.current) return;

    // 控制现代地图
    if (mapLayers.modern && layersRef.current.modern && !mapRef.current.hasLayer(layersRef.current.modern)) {
      layersRef.current.modern.addTo(mapRef.current);
    } else if (!mapLayers.modern && layersRef.current.modern && mapRef.current.hasLayer(layersRef.current.modern)) {
      mapRef.current.removeLayer(layersRef.current.modern);
    }

    // 控制卫星图
    if (mapLayers.satellite && layersRef.current.satellite && !mapRef.current.hasLayer(layersRef.current.satellite)) {
      layersRef.current.satellite.addTo(mapRef.current);
    } else if (!mapLayers.satellite && layersRef.current.satellite && mapRef.current.hasLayer(layersRef.current.satellite)) {
      mapRef.current.removeLayer(layersRef.current.satellite);
    }
  }, [mapLayers]);

  // 清除地图上的标记和线条
  const clearMapElements = () => {
    if (!mapRef.current) return;

    // 清除交通路网标记
    markersRef.current.forEach(marker => {
      mapRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    // 清除交通路网线条
    linesRef.current.forEach(line => {
      mapRef.current.removeLayer(line);
    });
    linesRef.current = [];
    
    // 清除路线映射
    routeLinesMapRef.current.clear();

    // 清除热力图
    if (heatmapLayerRef.current) {
      mapRef.current.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }
  };

  // 清除古城数据标记
  const clearCityDataMarkers = () => {
    if (!mapRef.current) return;

    // 清除战争标记
    warMarkersRef.current.forEach(marker => {
      mapRef.current.removeLayer(marker);
    });
    warMarkersRef.current = [];

    // 清除灾害标记
    disasterMarkersRef.current.forEach(marker => {
      mapRef.current.removeLayer(marker);
    });
    disasterMarkersRef.current = [];

    // 清除事件标记
    eventMarkersRef.current.forEach(marker => {
      mapRef.current.removeLayer(marker);
    });
    eventMarkersRef.current = [];
  };

  // 生成热力图数据
  const generateHeatmapData = () => {
    if (!filteredData.details.length) return [];

    // 按地点坐标分组，计算每个地点的重要性
    const locationHeatMap = new Map();

    filteredData.details.forEach(detail => {
      const lat = detail.latitude;
      const lng = detail.longitude;
      
      // 过滤无效坐标
      if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng) ||
          (lat === 0 && lng === 0) ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return;
      }

      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`; // 使用固定精度避免重复
      
      if (!locationHeatMap.has(key)) {
        locationHeatMap.set(key, {
          lat,
          lng,
          intensity: 0,
          routeCount: 0,
          routes: new Set(),
          isOverseas: !isInChina(lng, lat)
        });
      }

      const location = locationHeatMap.get(key);
      location.routes.add(detail.route_id);
      location.routeCount = location.routes.size;
      
      // 计算热力强度：路线数量的平方根 + 海外地点加权 + 基础强度
      const baseIntensity = 1; // 基础强度
      const routeBonus = Math.sqrt(location.routeCount) * 2; // 路线数量加权
      const overseasBonus = location.isOverseas ? 3 : 0; // 海外地点更显眼
      location.intensity = baseIntensity + routeBonus + overseasBonus;
    });

    // 转换为热力图数据格式 [lat, lng, intensity]
    const heatmapData = Array.from(locationHeatMap.values()).map(location => [
      location.lat,
      location.lng,
      location.intensity // 不限制最大强度，让数据自然分布
    ]);



    return heatmapData;
  };

  // 绘制热力图
  const drawHeatmap = () => {
    if (!mapRef.current) return;

    // 检查热力图插件是否已加载
    if (!heatmapLoaded || !L.heatLayer) {
      return;
    }

    // 清除现有热力图
    if (heatmapLayerRef.current) {
      mapRef.current.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    const heatmapData = generateHeatmapData();
    
    if (heatmapData.length === 0) {
      return;
    }

    // 计算强度范围用于调整热力图显示
    const maxIntensity = Math.max(...heatmapData.map(point => point[2]));
    const effectiveMax = Math.max(2, maxIntensity * 0.8); // 使用80%作为最大值，增强对比度

    // 根据是否与路线混合显示来调整透明度
    const isOverlayMode = mapMode === 'both';
    const baseOpacity = isOverlayMode ? 0.15 : 0.2; // 混合模式下降低透明度
    
    // 创建热力图图层
    const heatmapLayer = L.heatLayer(heatmapData, {
      radius: 20,
      blur: 12,
      maxZoom: 18,
      max: effectiveMax,
      minOpacity: baseOpacity,
      gradient: {
        0.0: 'rgba(155, 138, 112, 0)',     // 完全透明
        0.05: `rgba(196, 165, 132, ${baseOpacity * 0.5})`,  // 极淡开始
        0.15: `rgba(210, 180, 140, ${baseOpacity * 1.25})`, // 淡棕色
        0.3: `rgba(205, 133, 63, ${baseOpacity * 2.25})`,   // 秘鲁色
        0.5: `rgba(160, 82, 45, ${baseOpacity * 3.25})`,    // 马鞍棕
        0.7: `rgba(139, 69, 19, ${baseOpacity * 4})`,       // 深马鞍棕
        0.85: `rgba(128, 0, 0, ${baseOpacity * 4.5})`,      // 深红色
        0.95: `rgba(80, 0, 0, ${baseOpacity * 5})`,         // 极深红色
        1.0: `rgba(50, 0, 0, ${baseOpacity * 5})`           // 最深红色（接近黑红）
      }
    });

    heatmapLayer.addTo(mapRef.current);
    heatmapLayerRef.current = heatmapLayer;
  };

  // 更新选中路线样式（不重新绘制整个地图）
  const updateSelectedRouteStyle = () => {
    if (!mapRef.current || !selectedRoute) return;

    // 重置所有路线样式
    routeLinesMapRef.current.forEach((polylineInfo, routeKey) => {
      const { polyline, originalStyle } = polylineInfo;
      polyline.setStyle({
        color: originalStyle.color,
        weight: originalStyle.weight,
        opacity: originalStyle.opacity,
        dashArray: ''
      });
    });

    // 尝试多种匹配方式
    const selectedKey = `${selectedRoute.dynasty}_${selectedRoute.routeName}`;
    let selectedPolylineInfo = routeLinesMapRef.current.get(selectedKey);
    
    // 如果直接匹配失败，尝试模糊匹配
    if (!selectedPolylineInfo) {
      for (const [routeKey, polylineInfo] of routeLinesMapRef.current.entries()) {
        if (polylineInfo.routeName === selectedRoute.routeName && 
            polylineInfo.dynasty === selectedRoute.dynasty) {
          selectedPolylineInfo = polylineInfo;
          break;
        }
        // 尝试路线名称的部分匹配
        if (polylineInfo.routeName.includes(selectedRoute.routeName) || 
            selectedRoute.routeName.includes(polylineInfo.routeName)) {
          selectedPolylineInfo = polylineInfo;
          break;
        }
      }
    }
    
    if (selectedPolylineInfo) {
      const { polyline, originalStyle } = selectedPolylineInfo;
      polyline.setStyle({
        color: '#A52A2A', // 选中路线使用深褐红色高亮，与UI界面保持一致
        weight: originalStyle.weight + 2,
        opacity: 1,
        dashArray: '5, 5' // 选中路线使用虚线样式
      });
    }
  };

  // 更新古城数据显示
  const updateCityDataDisplay = () => {
    if (!mapRef.current || cityDataLoading) return;

    // 先清除现有古城数据标记
    clearCityDataMarkers();

    // 根据朝代过滤数据
    const filterByDynasty = (data) => {
      if (selectedDynasty === '全部') return data;
      return data.filter(row => {
        const rowDynasties = String(row.dynasty || '').split('、').map(d => d.trim());
        return rowDynasties.includes(selectedDynasty);
      });
    };

    // 显示战争数据
    if (showCityData.war) {
      const filteredWarData = filterByDynasty(warData);
      filteredWarData.forEach(warItem => {
        const marker = L.marker([warItem.latitude, warItem.longitude], {
          icon: createCityDataIcon('war')
        });
        
        marker.bindPopup(`
          <div style="font-family: 'Noto Serif SC', serif;">
            <strong>战争：${warItem.war_name || '未知'}</strong><br/>
            地点：${warItem.position || '未知地点'}<br/>
            朝代：${warItem.dynasty || '未知'}
          </div>
        `);
        
        marker.addTo(mapRef.current);
        warMarkersRef.current.push(marker);
      });
    }

    // 显示灾害数据
    if (showCityData.disaster) {
      const filteredDisasterData = filterByDynasty(disasterData);
      filteredDisasterData.forEach(disasterItem => {
        const marker = L.marker([disasterItem.latitude, disasterItem.longitude], {
          icon: createCityDataIcon('disaster')
        });
        
        marker.bindPopup(`
          <div style="font-family: 'Noto Serif SC', serif;">
            <strong>灾害：${disasterItem.disaster_type || '未知'}</strong><br/>
            地点：${disasterItem.position || '未知地点'}<br/>
            朝代：${disasterItem.dynasty || '未知'}
          </div>
        `);
        
        marker.addTo(mapRef.current);
        disasterMarkersRef.current.push(marker);
      });
    }

    // 显示事件数据
    if (showCityData.event) {
      const filteredEventData = filterByDynasty(eventData);
      filteredEventData.forEach(eventItem => {
        const marker = L.marker([eventItem.latitude, eventItem.longitude], {
          icon: createCityDataIcon('event')
        });
        
        marker.bindPopup(`
          <div style="font-family: 'Noto Serif SC', serif;">
            <strong>事件：${eventItem.event_name || '未知'}</strong><br/>
            地点：${eventItem.position || '未知地点'}<br/>
            朝代：${eventItem.dynasty || '未知'}
          </div>
        `);
        
        marker.addTo(mapRef.current);
        eventMarkersRef.current.push(marker);
      });
    }
  };

  // 监听古城数据显示状态变化  
  useEffect(() => {
    if (!cityDataLoading) {
      updateCityDataDisplay();
      // 注意：不再同步更新全局store中的显示状态，交通路网地图的复选框只控制地图显示
    }
  }, [showCityData, selectedDynasty, warData, disasterData, eventData, cityDataLoading]);

  // 更新地图上的交通路网
  useEffect(() => {
    if (!mapRef.current || loading) {
      return;
    }

    if (filteredData.details.length === 0) {
      clearMapElements();
      return;
    }

    clearMapElements();

    // 根据模式决定绘制内容
    const shouldShowHeatmap = mapMode === 'heatmap' || mapMode === 'both';
    const shouldShowRoutes = mapMode === 'routes' || mapMode === 'both';
    
    // 如果两者都不显示，直接返回
    if (mapMode === 'none') {
      return;
    }
    
    // 如果需要显示热力图，先绘制热力图（作为底层）
    if (shouldShowHeatmap) {
      drawHeatmap();
    }
    
    // 如果只显示热力图，不显示路线，则直接返回
    if (mapMode === 'heatmap') {
      return;
    }

    // 创建节点标记（地点），分为起终点和途径点
    const nodeMap = new Map();
    const routeEndpoints = new Map(); // 存储每条路线的起点和终点
    
    // 首先确定每条路线的起点和终点
    const routeGroupsForEndpoints = {};
    filteredData.details.forEach(detail => {
      if (!routeGroupsForEndpoints[detail.route_id]) {
        routeGroupsForEndpoints[detail.route_id] = [];
      }
      routeGroupsForEndpoints[detail.route_id].push(detail);
    });
    
    // 为每条路线确定起点和终点
    Object.entries(routeGroupsForEndpoints).forEach(([routeId, routePoints]) => {
      // 过滤有效坐标
      const validPoints = routePoints.filter(point => {
        const lat = point.latitude;
        const lng = point.longitude;
        return !isNaN(lat) && !isNaN(lng) && 
               isFinite(lat) && isFinite(lng) &&
               !(lat === 0 && lng === 0) &&
               lat >= -90 && lat <= 90 &&
               lng >= -180 && lng <= 180;
      });
      
      if (validPoints.length >= 2) {
        // 按顺序排序
        validPoints.sort((a, b) => a.order_in_route - b.order_in_route);
        const startPoint = validPoints[0];
        const endPoint = validPoints[validPoints.length - 1];
        
        routeEndpoints.set(routeId, {
          start: `${startPoint.latitude},${startPoint.longitude}`,
          end: `${endPoint.latitude},${endPoint.longitude}`
        });
      }
    });
    
    filteredData.details.forEach(detail => {
      // 过滤掉无效的经纬度
      const lat = detail.latitude;
      const lng = detail.longitude;
      if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng) ||
          (lat === 0 && lng === 0) ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return;
      }
      
      const key = `${detail.latitude},${detail.longitude}`;
      const endpoints = routeEndpoints.get(detail.route_id);
      const isStartOrEnd = endpoints && (key === endpoints.start || key === endpoints.end);
      
      if (!nodeMap.has(key)) {
        const isOverseas = !isInChina(detail.longitude, detail.latitude);
        
        nodeMap.set(key, {
          name: detail.place_name,
          dynasty: detail.dynasty,
          isOverseas,
          routes: [detail.route_id],
          routeNames: [detail.route_name],
          isStartOrEnd: isStartOrEnd,
          allRouteEndpoints: [isStartOrEnd] // 记录该点在哪些路线中是起终点
        });
      } else {
        // 如果节点已存在，添加路线信息
        const node = nodeMap.get(key);
        if (!node.routes.includes(detail.route_id)) {
          node.routes.push(detail.route_id);
          node.routeNames.push(detail.route_name);
          node.allRouteEndpoints.push(isStartOrEnd);
          // 如果在任一路线中是起终点，则标记为起终点
          if (isStartOrEnd) {
            node.isStartOrEnd = true;
          }
        }
      }
    });

    // 为每个节点创建标记
    nodeMap.forEach((nodeInfo, key) => {
      const [lat, lng] = key.split(',').map(parseFloat);
      
      // 使用节点的第一条路线的颜色作为节点颜色
      const primaryRouteId = nodeInfo.routes[0];
      const color = routeColorMapping.get(primaryRouteId) || '#8C6D46';
      
      // 判断是否是重要节点（多条路线交汇）
      const isImportantNode = nodeInfo.routes.length > 1;
      
      // 判断是否应该默认显示（起终点或重要交通枢纽）
      const shouldShowByDefault = nodeInfo.isStartOrEnd || isImportantNode;
      
      // 创建自定义图标
      const iconHtml = `
        <div class="${isImportantNode ? 'node-pulse' : ''}" style="
          width: ${nodeInfo.isOverseas ? 10 : 8}px;
          height: ${nodeInfo.isOverseas ? 10 : 8}px;
          background-color: ${color};
          border: ${nodeInfo.isOverseas ? '1px solid #FF4444' : '1px solid white'};
          border-radius: 50%;
          box-shadow: 0 1px 2px rgba(0,0,0,0.3);
          transition: all 0.3s ease;
          cursor: pointer;
          opacity: ${shouldShowByDefault ? '1' : '0'};
          transform: scale(${shouldShowByDefault ? '1' : '0.5'});
        "></div>
      `;
      
      const customIcon = L.divIcon({
        html: iconHtml,
        className: shouldShowByDefault ? 'custom-marker' : 'custom-marker hidden-waypoint',
        iconSize: [nodeInfo.isOverseas ? 10 : 8, nodeInfo.isOverseas ? 10 : 8],
        iconAnchor: [nodeInfo.isOverseas ? 5 : 4, nodeInfo.isOverseas ? 5 : 4]
      });

      const marker = L.marker([lat, lng], {
        icon: customIcon
      });

      // 添加节点悬停效果
      marker.on('mouseover', function() {
        const iconElement = this.getElement().querySelector('div');
        if (iconElement) {
          // 显示隐藏的途径点
          iconElement.style.opacity = '1';
          iconElement.style.transform = 'scale(1.3)';
          iconElement.style.zIndex = '1000';
        }
      });
      
      marker.on('mouseout', function() {
        const iconElement = this.getElement().querySelector('div');
        if (iconElement) {
          // 如果不是起终点或重要节点，鼠标离开时重新隐藏
          if (!shouldShowByDefault) {
            iconElement.style.opacity = '0';
            iconElement.style.transform = 'scale(0.5)';
          } else {
            iconElement.style.transform = 'scale(1)';
          }
          iconElement.style.zIndex = '';
        }
      });

      const locationInfo = nodeInfo.isOverseas ? '（海外地点）' : '（中国境内）';
      const routesList = [...new Set(nodeInfo.routeNames)].join(', ');
      const routeCount = nodeInfo.routes.length;
      const importanceInfo = routeCount > 1 ? `<br/><strong>重要交通枢纽（${routeCount}条路线交汇）</strong>` : '';
      const pointTypeInfo = nodeInfo.isStartOrEnd ? '<br/><span style="color: #8C6D46;">起点/终点</span>' : '<br/><span style="color: #999;">途径点</span>';
      
      marker.bindPopup(`
        <div style="font-family: 'Noto Serif SC', serif;">
          <strong>${nodeInfo.name}</strong>${locationInfo}${pointTypeInfo}${importanceInfo}<br/>
          朝代: ${nodeInfo.dynasty}<br/>
          相关路线: ${routesList}
        </div>
      `);
      
      marker.addTo(mapRef.current);
      markersRef.current.push(marker);
    });

    // 处理地点数据，按路线分组
    const routeGroups = {};
    filteredData.details.forEach(detail => {
      if (!routeGroups[detail.route_id]) {
        routeGroups[detail.route_id] = [];
      }
      routeGroups[detail.route_id].push(detail);
    });

    // 创建线条（路线）
    Object.entries(routeGroups).forEach(([routeId, routePoints]) => {
      if (routePoints.length < 2) return;
      
    // 过滤掉无效的经纬度 - 更严格的检查
    routePoints = routePoints.filter(point => {
      const lat = point.latitude;
      const lng = point.longitude;
      // 检查是否为有效数字且不为0且在合理范围内
      return !isNaN(lat) && !isNaN(lng) && 
            isFinite(lat) && isFinite(lng) &&
            !(lat === 0 && lng === 0) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180;
    });

    if (routePoints.length < 2) return;

    // 按顺序排序
    routePoints.sort((a, b) => a.order_in_route - b.order_in_route);

    const dynasty = routePoints[0].dynasty;
    const routeName = routePoints[0].route_name;
    const color = routeColorMapping.get(routeId) || '#8C6D46';

    // 创建路线坐标数组 - 添加额外验证
    const coordinates = routePoints.map(point => [point.latitude, point.longitude])
      .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]) && isFinite(coord[0]) && isFinite(coord[1]));

    // 再次检查过滤后的坐标数组
    if (coordinates.length < 2) return;
      
      // 检查是否是国际路线
      const isInternational = routePoints.some(point => !isInChina(point.longitude, point.latitude));
      
      // // 创建平滑曲线
      // const smoothCoordinates = createSmoothCurve(coordinates);

      // // 最终验证平滑坐标
      // if (smoothCoordinates.length < 2) {
      //   console.warn(`路线 ${routeId} 的平滑坐标少于2个点，跳过创建`);
      //   return;
      // }

      // // 再次验证所有坐标都是有效的
      // const finalCoordinates = smoothCoordinates.filter(coord => 
      //   Array.isArray(coord) && coord.length >= 2 &&
      //   !isNaN(coord[0]) && !isNaN(coord[1]) && 
      //   isFinite(coord[0]) && isFinite(coord[1])
      // );

      // if (finalCoordinates.length < 2) {
      //   console.warn(`路线 ${routeId} 经过最终验证后坐标少于2个点，跳过创建`);
      //   return;
      // }

      // console.log(`创建路线 ${routeId}，坐标数量: ${finalCoordinates.length}`);

      // // 创建路线
      // const polyline = L.polyline(finalCoordinates, {
      // 直接使用直线连接，不需要平滑曲线
        // console.log(`创建路线 ${routeId}，坐标数量: ${coordinates.length}`);

        // 创建路线（使用原始样式）
      const originalStyle = {
        color: color,
        weight: isInternational ? 2 : 1.5,
        opacity: isInternational ? 0.7 : 0.5
      };

      const polyline = L.polyline(coordinates, {
        ...originalStyle,
        dashArray: '',
        lineJoin: 'round',
        lineCap: 'round',
        smoothFactor: 1.0
      });

      // 保存路线引用供后续样式更新使用
      const routeKey = `${dynasty}_${routeName}`;
      routeLinesMapRef.current.set(routeKey, {
        polyline,
        originalStyle,
        routeName,
        dynasty,
        isInternational
      });
      
      // 添加路线悬停效果
      polyline.on('mouseover', function() {
        this.setStyle({
          weight: originalStyle.weight + 2,
          opacity: 1
        });
      });
      
      polyline.on('mouseout', function() {
        // 检查当前路线是否被选中
        const isSelected = selectedRoute && 
          selectedRoute.routeName === routeName && 
          selectedRoute.dynasty === dynasty;
        
        if (isSelected) {
          // 如果是选中路线，恢复到选中样式
          this.setStyle({
            color: '#A52A2A',
            weight: originalStyle.weight + 2,
            opacity: 1,
            dashArray: '5, 5'
          });
        } else {
          // 如果不是选中路线，恢复到原始样式
          this.setStyle({
            weight: originalStyle.weight,
            opacity: originalStyle.opacity,
            color: originalStyle.color,
            dashArray: ''
          });
        }
      });
      
      const routeInfo = isInternational ? '（国际路线）' : '（境内路线）';
      polyline.bindPopup(`
        <div style="font-family: 'Noto Serif SC', serif;">
          <strong>${routeName}</strong>${routeInfo}<br/>
          朝代: ${dynasty}<br/>
          <small>点击路线查看详细信息</small>
        </div>
      `);
      
      polyline.addTo(mapRef.current);
      linesRef.current.push(polyline);
      
      // 创建沿路径移动的动画点（已禁用）
      // createMovingMarker(coordinates, color, isInternational);
    });



    // 路网绘制完成后，应用选中路线样式
    if (selectedRoute) {
      setTimeout(() => updateSelectedRouteStyle(), 100);
    }
  }, [filteredData, loading, routeColorMapping, mapMode]);

  // 监听选中路线变化，只更新样式，不重新绘制地图
  useEffect(() => {
    // console.log('🎯 selectedRoute 发生变化:', selectedRoute);
    // console.log('🗺️ 地图状态:', {
    //   mapExists: !!mapRef.current,
    //   routeCount: routeLinesMapRef.current.size,
    //   currentDynasty: selectedDynasty
    // });
    
    if (mapRef.current && routeLinesMapRef.current.size > 0) {
      // console.log('🎨 selectedRoute 变化，更新路线样式');
      updateSelectedRouteStyle();
    } else {
      // console.log('⏳ 等待地图或路线数据准备完成...');
      // 延时重试
      const timer = setTimeout(() => {
        if (mapRef.current && routeLinesMapRef.current.size > 0 && selectedRoute) {
          // console.log('🔄 延时重试更新选中路线样式');
          updateSelectedRouteStyle();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedRoute]);

  // 监听选中路线变化，自动切换到对应朝代
  useEffect(() => {
    if (selectedRoute && selectedRoute.dynasty && selectedRoute.dynasty !== selectedDynasty) {
      // console.log('🎯 自动切换到选中路线的朝代:', selectedRoute.dynasty);
      setSelectedDynasty(selectedRoute.dynasty);
    }
  }, [selectedRoute, selectedDynasty]); // 添加selectedDynasty依赖

  // 朝代切换处理
  const handleDynastyChange = (dynasty) => {
    // console.log('🔄 朝代切换:', dynasty);
    setSelectedDynasty(dynasty);
    
    // 调试：显示切换后的路线数据
    setTimeout(() => {
      // console.log('🔍 朝代切换后的路线数据:');
      const dynastyRoutes = routeData.filter(route => route.dynasty === dynasty);
      console.log(`  - ${dynasty} 朝代共有 ${dynastyRoutes.length} 条路线`);
      dynastyRoutes.forEach(route => {
        console.log(`    * ${route.route_name} (ID: ${route.route_id})`);
      });
    }, 100);
  };

  // 图层控制处理
  const handleLayerToggle = (layerType) => {
    // console.log('🔄 图层切换:', layerType);
    setMapLayers(prev => ({
      ...prev,
      [layerType]: !prev[layerType]
    }));
  };

  // 透明度控制处理
  const handleOpacityChange = (opacity) => {
    // console.log('🔄 透明度调整:', opacity);
    setHistoricalOpacity(opacity);
    if (layersRef.current.historical) {
      layersRef.current.historical.setOpacity(opacity);
    }
  };

  // 防止地图事件干扰控制面板
  const handleControlClick = (e) => {
    e.stopPropagation();
  };

  // 降低颜色饱和度的函数
  const desaturateColor = (color, amount = 0.5) => {
    // 如果是hex颜色格式
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // 计算灰度值
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      
      // 混合原色和灰度
      const newR = Math.round(r + (gray - r) * amount);
      const newG = Math.round(g + (gray - g) * amount);
      const newB = Math.round(b + (gray - b) * amount);
      
      return `rgb(${newR}, ${newG}, ${newB})`;
    }
    
    // 如果已经是rgb格式，直接返回更淡的版本
    return color.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, (match, r, g, b) => {
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const newR = Math.round(r + (gray - r) * amount);
      const newG = Math.round(g + (gray - g) * amount);
      const newB = Math.round(b + (gray - b) * amount);
      return `rgb(${newR}, ${newG}, ${newB})`;
    });
  };

  // 创建沿路径移动的动画点
  const createMovingMarker = (path, color, isInternational) => {
    if (path.length < 2) return;
    
    // 为光晕创建低饱和度的颜色
    const glowColor = desaturateColor(color, 0.6);
    
    // 创建移动点的图标
    const movingIcon = L.divIcon({
      html: `
        <div style="
          width: 8px;
          height: 8px;
          background-color: ${color};
          border: 1px solid white;
          border-radius: 50%;
          box-shadow: 0 0 5px ${glowColor}, 0 0 10px ${glowColor};
          animation: softGlow 1.5s ease-in-out infinite alternate;
        "></div>
        <style>
          @keyframes softGlow {
            0% {
              box-shadow: 0 0 5px ${glowColor}, 0 0 10px ${glowColor};
              opacity: 0.8;
            }
            100% {
              box-shadow: 0 0 8px ${glowColor}, 0 0 15px ${glowColor}, 0 0 20px ${glowColor.replace('rgb(', 'rgba(').replace(')', ', 0.3)')};
              opacity: 1;
            }
          }
        </style>
      `,
      className: 'moving-marker',
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
    
    // 创建移动标记
    const movingMarker = L.marker(path[0], { icon: movingIcon });
    movingMarker.addTo(mapRef.current);
    
    // 动画参数
    const duration = isInternational ? 8000 : 6000; // 国际路线动画时间更长
    const startTime = Date.now();
    
    // 动画函数
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % duration) / duration;
      
      if (progress >= 1) {
        // 动画完成，重新开始
        setTimeout(() => animate(), 1000); // 1秒延迟后重新开始
        return;
      }
      
      // 计算当前位置
      const pathIndex = progress * (path.length - 1);
      const currentIndex = Math.floor(pathIndex);
      const nextIndex = Math.min(currentIndex + 1, path.length - 1);
      const segmentProgress = pathIndex - currentIndex;
      
      if (currentIndex < path.length - 1) {
        const currentPos = path[currentIndex];
        const nextPos = path[nextIndex];
        
        // 插值计算当前位置
        const lat = currentPos[0] + (nextPos[0] - currentPos[0]) * segmentProgress;
        const lng = currentPos[1] + (nextPos[1] - currentPos[1]) * segmentProgress;
        
        movingMarker.setLatLng([lat, lng]);
      }
      
      requestAnimationFrame(animate);
    };
    
    // 延迟启动动画，错开不同路线的动画时间
    const delay = Math.random() * 2000;
    setTimeout(() => animate(), delay);
    
    // 将移动标记添加到清理列表
    markersRef.current.push(movingMarker);
  };

  if (loading) {
    return (
      <div className="transportation-loading">
        <div className="loading-spinner"></div>
        <p>加载交通路网数据中...</p>
      </div>
    );
  }

  return (
    <div className="transportation-network">
      {/* 顶部控制区域：朝代选择 + 地图类型 */}
      <div 
        className="transportation-top-controls"
        onClick={handleControlClick}
        onMouseDown={handleControlClick}
        onMouseUp={handleControlClick}
      >
        <div className="dynasty-selector">
          <label>选择朝代:</label>
          <select 
            value={selectedDynasty} 
            onChange={(e) => {
              e.stopPropagation();
              handleDynastyChange(e.target.value);
            }}
            onFocus={(e) => e.stopPropagation()}
            onBlur={(e) => e.stopPropagation()}
            className="dynasty-select"
          >
            {availableDynasties.map(dynasty => (
              <option key={dynasty} value={dynasty}>{dynasty}</option>
            ))}
          </select>
        </div>
        
        {/* 图层显示控制 */}
        <div 
          className="map-mode-controls"
          onClick={handleControlClick}
        >
          <label className="layer-toggle">
            <input 
              type="checkbox" 
              checked={mapMode === 'routes' || mapMode === 'both'}
              onChange={(e) => {
                e.stopPropagation();
                const isRouteChecked = e.target.checked;
                const isHeatmapChecked = mapMode === 'heatmap' || mapMode === 'both';
                
                if (isRouteChecked && isHeatmapChecked) {
                  setMapMode('both');
                } else if (isRouteChecked && !isHeatmapChecked) {
                  setMapMode('routes');
                } else if (!isRouteChecked && isHeatmapChecked) {
                  setMapMode('heatmap');
                } else {
                  setMapMode('none');
                }
              }}
              onClick={handleControlClick}
            />
            路线图
          </label>
          <label className="layer-toggle">
            <input 
              type="checkbox" 
              checked={mapMode === 'heatmap' || mapMode === 'both'}
              onChange={(e) => {
                e.stopPropagation();
                if (heatmapLoaded) {
                  const isHeatmapChecked = e.target.checked;
                  const isRouteChecked = mapMode === 'routes' || mapMode === 'both';
                  
                  if (isRouteChecked && isHeatmapChecked) {
                    setMapMode('both');
                  } else if (isRouteChecked && !isHeatmapChecked) {
                    setMapMode('routes');
                  } else if (!isRouteChecked && isHeatmapChecked) {
                    setMapMode('heatmap');
                  } else {
                    setMapMode('none');
                  }
                }
              }}
              onClick={handleControlClick}
              disabled={!heatmapLoaded}
            />
            {heatmapLoaded ? '热力图' : '热力图 ⏳'}
          </label>
        </div>

        {/* 古城数据显示控制 */}
        <div 
          className="city-data-controls"
          onClick={handleControlClick}
        >
          <span style={{ fontSize: '12px', color: '#666', marginRight: '8px' }}>古城数据:</span>
          <label className="layer-toggle">
            <input 
              type="checkbox" 
              checked={showCityData.war}
              onChange={(e) => {
                e.stopPropagation();
                const newState = !showCityData.war;
                setShowCityData(prev => ({ ...prev, war: newState }));
              }}
              onClick={handleControlClick}
              disabled={cityDataLoading}
            />
            ⚔️战争
          </label>
          <label className="layer-toggle">
            <input 
              type="checkbox" 
              checked={showCityData.disaster}
              onChange={(e) => {
                e.stopPropagation();
                const newState = !showCityData.disaster;
                setShowCityData(prev => ({ ...prev, disaster: newState }));
              }}
              onClick={handleControlClick}
              disabled={cityDataLoading}
            />
            🌪️灾害
          </label>
          <label className="layer-toggle">
            <input 
              type="checkbox" 
              checked={showCityData.event}
              onChange={(e) => {
                e.stopPropagation();
                const newState = !showCityData.event;
                setShowCityData(prev => ({ ...prev, event: newState }));
              }}
              onClick={handleControlClick}
              disabled={cityDataLoading}
            />
            📜事件
          </label>
        </div>

        <div 
          className="layer-controls"
          onClick={handleControlClick}
        >
          <label>
            <input 
              type="checkbox" 
              checked={mapLayers.modern}
              onChange={(e) => {
                e.stopPropagation();
                handleLayerToggle('modern');
              }}
              onClick={handleControlClick}
            />
            现代地图
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={mapLayers.historical}
              onChange={(e) => {
                e.stopPropagation();
                handleLayerToggle('historical');
              }}
              onClick={handleControlClick}
            />
            历史地图
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={mapLayers.satellite}
              onChange={(e) => {
                e.stopPropagation();
                handleLayerToggle('satellite');
              }}
              onClick={handleControlClick}
            />
            卫星图
          </label>
        </div>
        </div>
        
      {/* 中间地图区域 */}
      <div 
        ref={mapContainerRef}
        className="transportation-map"
        style={{ 
          width: '100%', 
          minHeight: '400px',
          backgroundColor: '#F5F2EC',
          position: 'relative'
        }}
      >
        {/* 地图容器状态指示 */}
        {!mapRef.current && !loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#666',
            fontSize: '16px',
            pointerEvents: 'none'
          }}>
            <div>正在初始化地图...</div>
          </div>
        )}

        {/* 聚类分析图表 - 覆盖在地图右下角 */}
        <div 
          className="cluster-chart-overlay"
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '8px',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
            maxWidth: '380px'
          }}
        >
          {clusterResults ? (
            <svg
              ref={clusterSvgRef}
              width="360"
              height="300"
              style={{ display: 'block' }}
            />
          ) : (
            <div style={{
              width: '360px',
              height: '300px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #ddd',
                borderTop: '2px solid #8C6D46',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '10px'
              }}></div>
              <div style={{ fontSize: '12px', textAlign: 'center' }}>
                正在加载聚类分析数据...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部控制区域：透明度 + 统计信息 */}
      <div 
        className="transportation-bottom-controls"
        onClick={handleControlClick}
        onMouseDown={handleControlClick}
        onMouseUp={handleControlClick}
      >
        <div 
          className="opacity-control"
          onClick={handleControlClick}
        >
          <label>历史地图透明度:</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.1"
            value={historicalOpacity}
            onChange={(e) => {
              e.stopPropagation();
              handleOpacityChange(parseFloat(e.target.value));
            }}
            onMouseDown={handleControlClick}
            onMouseUp={handleControlClick}
          />
        </div>
        
        <div className="route-stats">
          <span>显示模式: {
            mapMode === 'routes' ? '路线图' : 
            mapMode === 'heatmap' ? '热力图' : 
            mapMode === 'both' ? '路线+热力图' :
            '无显示'
          }</span>
          <span>路线数量: {filteredData.routes.length}</span>
          <span>节点数量: {filteredData.details.length}</span>
        </div>
      </div>
    </div>
  );
};

export default TransportationNetwork; 