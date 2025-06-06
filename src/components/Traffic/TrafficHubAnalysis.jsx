import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';
import useDynastyStore from '../../store/dynastyStore';
import './TrafficHubAnalysis.css';

// 美观的配色方案 - 更淡雅的古朴中国风
const colorScheme = {
  primary: '#9B8A70', // 更淡雅的棕色
  secondary: '#B5A68C', // 更柔和的赭石色
  accent: '#C4B79C', // 更淡的秘鲁棕
  background: '#FDFCF9', // 极淡的古旧纸张色
  grid: '#F0EDE6', // 非常淡的褐色网格
  text: '#6B7669', // 更淡的深灰绿色文字
  // 朝代数量颜色渐变 - 极其柔和的渐变
  dynastyColorScale: [
    '#FCFBF9', // 极淡的米色 - 1-5个朝代
    '#F4F0E7', // 非常淡的浅卡其色 - 6-10个朝代
    '#EDEAD2', // 淡雅的棕褐色 - 11-15个朝代
    '#E3D8C8', // 淡雅的玫瑰褐色 - 16-20个朝代
    '#D4C5B0', // 淡雅的赭石色 - 21-25个朝代
    '#C4B098'  // 淡雅的深棕色 - 26+个朝代
  ],
  // 枢纽等级颜色 - 极其柔和的传统色彩
  hubLevelColors: {
    '核心枢纽': '#B08A8A', // 淡雅的深红色
    '地区枢纽': '#B39B88', // 淡雅的耐火砖红
    '重要枢纽': '#C4B79C', // 淡雅的秘鲁棕
    '普通枢纽': '#D5CAB5'  // 极淡的棕褐色
  }
};

const TrafficHubAnalysis = () => {
  const [hubData, setHubData] = useState([]);
  const [dynastyData, setDynastyData] = useState([]);
  const [routeData, setRouteData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDynasty, setSelectedDynasty] = useState(null); // 选中的朝代
  const chartContainerRef = useRef(null);
  const { 
    setSelectedRoute, 
    clearSelectedRoute, 
    selectedRoute,
    selectedRoutes,
    showAllRoutes,
    toggleRouteSelection,
    setShowAllRoutes,
    clearAllSelectedRoutes
  } = useDynastyStore();

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 加载交通枢纽数据
        const hubResponse = await fetch('/data/problem3/交通数据综合分析/analysis_csv_outputs/交通枢纽分析_20250604_213238.csv');
        if (!hubResponse.ok) {
          throw new Error(`Failed to load hub data: ${hubResponse.status}`);
        }
        const hubText = await hubResponse.text();
        
        Papa.parse(hubText, {
          header: true,
          complete: (results) => {
            console.log('Hub data parsed:', results.data);
            const processedData = results.data
              .filter(row => row.枢纽地名 && row.综合得分)
              .map(row => ({
                name: row.枢纽地名,
                score: parseFloat(row.综合得分),
                dynastyCount: parseInt(row.涉及朝代数) || 0,
                dynasties: row.涉及朝代,
                level: row.枢纽等级,
                rank: parseInt(row.排名),
                networkScore: parseFloat(row.网络中心性得分),
                localScore: parseFloat(row.局部连通性得分),
                historicalScore: parseFloat(row.历史持续性得分),
                functionalScore: parseFloat(row.功能多样性得分)
              }));
            setHubData(processedData);
          },
          error: (error) => {
            console.error('Parse error:', error);
            setError('数据解析失败');
          }
        });

        // 加载朝代发展水平数据
        const dynastyResponse = await fetch('/data/problem3/交通数据综合分析/analysis_csv_outputs/朝代发展水平等级分布_20250604_213238.csv');
        if (!dynastyResponse.ok) {
          throw new Error(`Failed to load dynasty data: ${dynastyResponse.status}`);
        }
        const dynastyText = await dynastyResponse.text();
        
        Papa.parse(dynastyText, {
          header: true,
          complete: (results) => {
            console.log('Dynasty data parsed:', results.data);
            const processedData = results.data
              .filter(row => row.朝代 && row.综合得分)
              .map(row => ({
                dynasty: row.朝代,
                level: row.发展水平等级,
                score: parseFloat(row.综合得分),
                count: parseInt(row.记录数量)
              }));
            setDynastyData(processedData);
          },
          error: (error) => {
            console.error('Parse error:', error);
            setError('数据解析失败');
          }
        });

        // 加载交通路线详细数据
        const routeResponse = await fetch('/data/problem3/交通路线地点详细.csv');
        if (!routeResponse.ok) {
          throw new Error(`Failed to load route data: ${routeResponse.status}`);
        }
        const routeText = await routeResponse.text();
        
        Papa.parse(routeText, {
          header: true,
          complete: (results) => {
            console.log('Route data parsed:', results.data);
            const processedRouteData = results.data
              .filter(row => row.dynasty && row.route_name && row.latitude && row.longitude)
              .map(row => ({
                routeId: row.route_id,
                dynasty: row.dynasty,
                routeName: row.route_name,
                placeName: row.place_name,
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude),
                placeType: row.place_type,
                orderInRoute: parseInt(row.order_in_route),
                status: row.status
              }));
            setRouteData(processedRouteData);
            setLoading(false);
          },
          error: (error) => {
            console.error('Parse error:', error);
            setError('数据解析失败');
            setLoading(false);
          }
        });
      } catch (error) {
        console.error('数据加载失败:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    loadData();
  }, []);

// 合并绘制柱状图和网络图
useEffect(() => {
    if ((!dynastyData.length || !hubData.length || !chartContainerRef.current || loading || selectedDynasty !== null)) return;
  
    console.log('Drawing combined charts with data:', { dynastyData, hubData });
  
    // 清空之前的图表
    d3.select(chartContainerRef.current).selectAll('*').remove();
  
    const containerWidth = chartContainerRef.current.clientWidth;
    const containerHeight = chartContainerRef.current.clientHeight;
    
    // 布局配置：左侧25%为柱状图，右侧75%为网络图
    const barChartWidth = containerWidth * 0.25;
    const networkWidth = containerWidth * 0.75;
    const networkHeight = containerHeight * 0.85; // 网络图区域高度为85%，底部15%留给图例
    
    const svg = d3.select(chartContainerRef.current)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    // ==================== 绘制柱状图部分 ====================
    const barChartMargin = { top: 20, right: 10, bottom: 20, left: 30 }; // 增加左边距从20到40
    const barChartInnerWidth = barChartWidth - barChartMargin.left - barChartMargin.right;
    const barChartInnerHeight = containerHeight - barChartMargin.top - barChartMargin.bottom;
  
    const barChartGroup = svg.append('g')
      .attr('transform', `translate(${barChartMargin.left},${barChartMargin.top})`);
  
    // 定义朝代顺序
    const dynastyOrder = [
      '上古', '远古', '夏', '商', '先秦', '先秦-西周', '先秦-东周', '先秦-春秋', '先秦-战国',
      '秦', '汉', '汉-西汉', '汉-东汉', '三国', '西晋', '十六国', '南朝', '北朝', '北朝-北魏',
      '北朝-东魏', '北朝-西魏', '北朝-北齐', '北朝-北周', '隋', '唐', '五代十国', '宋',
      '宋-北宋', '宋-南宋', '辽', '金', '元', '明', '清', '近代', '近代-民国', '现代'
    ];
  
    // 按朝代聚合数据
    const dynastyScores = d3.rollup(
      dynastyData,
      v => d3.mean(v, d => d.score),
      d => d.dynasty
    );
  
    // 按照指定顺序排列数据，只保留有数据的朝代
    const dynastyChartData = dynastyOrder
      .filter(dynasty => dynastyScores.has(dynasty))
      .map(dynasty => ({
        dynasty,
        score: dynastyScores.get(dynasty)
      }));
  
    // 设置比例尺 - Y轴为朝代，X轴为得分
    const yScale = d3.scaleBand()
      .domain(dynastyChartData.map(d => d.dynasty))
      .range([0, barChartInnerHeight])
      .padding(0.1);
  
    // X轴比例尺，最大值固定为100，但实际绘制宽度只占容器的80%
    const maxBarWidth = barChartInnerWidth * 0.8; // 柱状图最大宽度只占容器的80%
    const xScale = d3.scaleLinear()
      .domain([0, 100]) // 固定最大值为100
      .range([0, maxBarWidth]);
  
        // 绘制柱状图
    barChartGroup.selectAll('.bar')
      .data(dynastyChartData)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', d => yScale(d.dynasty))
      .attr('width', d => xScale(d.score))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => selectedDynasty === d.dynasty ? colorScheme.accent : colorScheme.primary)
      .attr('opacity', 0.8)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 1);
        
        // 显示提示
        const tooltip = d3.select('body').append('div')
          .attr('class', 'traffic-hub-tooltip')
          .style('opacity', 0);

        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        
        tooltip.html(`${d.dynasty}<br/>综合得分: ${d.score.toFixed(2)}<br/>点击查看详情`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.8);
        d3.selectAll('.traffic-hub-tooltip').remove();
      })
      .on('click', function(event, d) {
        // 清除所有悬浮框
        d3.selectAll('.traffic-hub-tooltip').remove();
        
        // 点击切换选中的朝代
        if (selectedDynasty === d.dynasty) {
          setSelectedDynasty(null); // 如果已选中，则取消选择
        } else {
          setSelectedDynasty(d.dynasty); // 选择新的朝代
        }
      });
  
    // 只添加Y轴（朝代轴）
    barChartGroup.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '10px')
      .style('font-family', "'Noto Serif SC', sans-serif")
      .style('fill', colorScheme.text);
  
    // 添加柱状图标题
    barChartGroup.append('text')
      .attr('x', barChartInnerWidth / 2 - 20) // 向左偏移15px
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('font-family', "'Noto Serif SC', sans-serif")
      .style('fill', colorScheme.text)
      .text('朝代发展水平综合得分');

    // 添加纵向分隔线 - 向左偏移
    svg.append('line')
      .attr('x1', barChartWidth - 10) // 向左偏移10px
      .attr('y1', 0)
      .attr('x2', barChartWidth - 10) // 向左偏移10px
      .attr('y2', containerHeight)
      .attr('stroke', colorScheme.grid)
      .attr('stroke-width', 1);

        // 创建网络图区域的组 - 稍微向左偏移
    const networkOffsetX = barChartWidth - 20; // 向左偏移20px
    const networkGroup = svg.append('g')
      .attr('transform', `translate(${networkOffsetX}, 0)`);
    
    // 添加网络图标题 - 固定在网络图区域上方中间
    svg.append('text')
      .attr('x', networkOffsetX + networkWidth / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('font-family', "'Noto Serif SC', sans-serif")
      .style('fill', colorScheme.text)
      .text('交通枢纽网络分析图');
  
        // 准备节点数据 - 只显示前50个节点
    const networkNodes = hubData.slice(0, 50).map(d => ({
      id: d.name,
      ...d,
      radius: Math.sqrt(d.score) * 3
    }));

    // 创建模拟连接（基于网络中心性得分）
    const networkLinks = [];
    networkNodes.forEach((source, i) => {
      networkNodes.forEach((target, j) => {
        if (i < j && source.networkScore > 0.1 && target.networkScore > 0.1) {
          const strength = (source.networkScore + target.networkScore) / 2;
          if (strength > 0.2) {
            networkLinks.push({
              source: source.id,
              target: target.id,
              strength: strength
            });
          }
        }
      });
    });

    // 创建力导向图 - 使用调整后的网络区域，标题下方留出空间
    const networkCenterX = networkWidth / 2;
    const networkCenterY = (networkHeight - 40) / 2 + 40; // 标题下方留出40px空间
    const simulation = d3.forceSimulation(networkNodes)
      .force('link', d3.forceLink(networkLinks)
        .id(d => d.id)
        .distance(d => 50 / d.strength))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(networkCenterX, networkCenterY))
      .force('collision', d3.forceCollide().radius(d => d.radius + 2))
      .force('x', d3.forceX(networkCenterX).strength(0.1))
      .force('y', d3.forceY(networkCenterY).strength(0.1));

    // 绘制连接线
    const link = networkGroup.append('g')
      .selectAll('line')
      .data(networkLinks)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', d => d.strength * 0.6)
      .attr('stroke-width', d => d.strength * 3);

    // 颜色比例尺（基于朝代数量）
    const colorScale = d3.scaleQuantize()
      .domain([0, d3.max(networkNodes, d => d.dynastyCount)])
      .range(colorScheme.dynastyColorScale);
  
        // 绘制节点
    const node = networkGroup.append('g')
      .selectAll('circle')
      .data(networkNodes)
      .enter().append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => colorScale(d.dynastyCount))
      .attr('stroke', d => colorScheme.hubLevelColors[d.level] || '#D5CAB5')
      .attr('stroke-width', 1) // 从2改为1，边框更细
      .attr('stroke-opacity', 0.8); // 添加边框透明度，更加淡雅
    
    // 添加节点标签 - 只显示综合得分≥40的节点名称
    const label = networkGroup.append('g')
      .selectAll('text')
      .data(networkNodes.filter(d => d.score >= 40)) // 只为得分≥40的节点创建标签
      .enter().append('text')
      .text(d => d.name)
      .attr('font-size', '10px')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('pointer-events', 'none')
      .style('font-weight', 'bold')
      .style('fill', colorScheme.text)
      .style('text-shadow', '1px 1px 2px rgba(255,255,255,0.8)');
    
    // 拖拽功能
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = Math.max(d.radius, Math.min(networkWidth - d.radius, event.x));
      d.fy = Math.max(d.radius + 40, Math.min(networkHeight - d.radius, event.y)); // 标题下方留出40px空间
      
      label.filter(labelData => labelData.id === d.id)
        .attr('x', d.fx)
        .attr('y', d.fy);
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // 添加拖拽到节点
    node.call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

    // 添加悬停提示
    node.on('mouseover', function(event, d) {
      const tooltip = d3.select('body').append('div')
        .attr('class', 'traffic-hub-tooltip')
        .style('opacity', 0);

      tooltip.transition()
        .duration(200)
        .style('opacity', .9);
      
      tooltip.html(`
        <strong>${d.name}</strong><br/>
        综合得分: ${d.score.toFixed(2)}<br/>
        涉及朝代: ${d.dynastyCount}个<br/>
        枢纽等级: ${d.level}<br/>
        排名: ${d.rank}
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
      d3.selectAll('.traffic-hub-tooltip').remove();
    });

    // 更新节点和连接位置
    simulation.on('tick', () => {
      networkNodes.forEach(d => {
        d.x = Math.max(d.radius, Math.min(networkWidth - d.radius, d.x));
        d.y = Math.max(d.radius + 40, Math.min(networkHeight - d.radius, d.y)); // 标题下方留出40px空间
      });

      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });
  
        // 底部图例区域
    const legendContainer = svg.append('g')
      .attr('transform', `translate(${networkOffsetX}, ${networkHeight})`);

    // 添加横向分隔线 - 缩短并右移
    legendContainer.append('line')
      .attr('x1', 30) // 右移30px作为起点
      .attr('y1', 0)
      .attr('x2', networkWidth - 50) // 缩短50px作为终点
      .attr('y2', 0)
      .attr('stroke', colorScheme.grid)
      .attr('stroke-width', 1);

    // 朝代数量图例 - 水平布局在左侧
    const dynastyLegend = legendContainer.append('g')
      .attr('transform', `translate(20, 20)`);

    dynastyLegend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('font-weight', 'bold')
      .attr('font-size', '11px')
      .style('fill', colorScheme.text)
      .text('朝代数量:');

    const ranges = ['1-5', '6-10', '11-15', '16-20', '21-25', '26+'];
    colorScheme.dynastyColorScale.forEach((color, i) => {
      const legendItem = dynastyLegend.append('g')
        .attr('transform', `translate(${65 + i * 50}, -8)`);

      legendItem.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', color);

      legendItem.append('text')
        .attr('x', 15)
        .attr('y', 8)
        .attr('font-size', '9px')
        .style('fill', colorScheme.text)
        .text(ranges[i]);
    });

    // 枢纽等级图例 - 水平布局在右侧
    const levelLegend = legendContainer.append('g')
      .attr('transform', `translate(20, 45)`);

    levelLegend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('font-weight', 'bold')
      .attr('font-size', '11px')
      .style('fill', colorScheme.text)
      .text('枢纽等级:');

    Object.entries(colorScheme.hubLevelColors).forEach(([level, color], i) => {
      const legendItem = levelLegend.append('g')
        .attr('transform', `translate(${65 + i * 70}, -8)`);

      legendItem.append('circle')
        .attr('cx', 5)
        .attr('cy', 5)
        .attr('r', 4)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2);

      legendItem.append('text')
        .attr('x', 15)
        .attr('y', 8)
        .attr('font-size', '9px')
        .style('fill', colorScheme.text)
        .text(level);
    });



  }, [hubData.length, dynastyData.length, loading, selectedDynasty]);



  // 当选中朝代改变时，更新柱状图颜色
  useEffect(() => {
    if (!chartContainerRef.current || loading || !dynastyData.length) return;
    
    const svg = d3.select(chartContainerRef.current).select('svg');
    if (svg.empty()) return;
    
    // 更新柱状图颜色
    svg.selectAll('.bar')
      .attr('fill', d => selectedDynasty === d.dynasty ? colorScheme.accent : colorScheme.primary);
      
    console.log('柱状图颜色已更新，selectedDynasty:', selectedDynasty);
      
  }, [selectedDynasty]);

  // 交通要道重要性评价算法
  const calculateRouteImportance = (routeName, dynastyRoutes) => {
    // 获取该路线的所有数据
    const routeData = dynastyRoutes.filter(r => r.routeName === routeName);
    if (routeData.length === 0) return 0;

    // 1. 连通性得分 - 基于连接的地点数量
    const connectivityScore = Math.min(routeData.length / 10, 1) * 30; // 最高30分

    // 2. 地理跨度得分 - 基于经纬度跨度
    const latitudes = routeData.map(r => r.latitude);
    const longitudes = routeData.map(r => r.longitude);
    const latRange = Math.max(...latitudes) - Math.min(...latitudes);
    const lonRange = Math.max(...longitudes) - Math.min(...longitudes);
    const geoSpanScore = Math.min((latRange + lonRange) / 20, 1) * 25; // 最高25分

    // 3. 战略重要性得分 - 基于关键地点类型
    const strategicPlaces = routeData.filter(r => 
      r.placeName.includes('关') || 
      r.placeName.includes('口') || 
      r.placeName.includes('陉') ||
      r.placeName.includes('京') ||
      r.placeName.includes('都') ||
      r.placeName.includes('省') ||
      r.placeName.includes('市')
    );
    const strategicScore = Math.min(strategicPlaces.length / 3, 1) * 20; // 最高20分

    // 4. 历史持续性得分 - 基于路线名称的历史重要性关键词
    const historicalKeywords = ['大道', '古道', '丝路', '驿道', '官道', '商道', '孔道'];
    const hasHistoricalKeyword = historicalKeywords.some(keyword => 
      routeName.includes(keyword)
    );
    const historicalScore = hasHistoricalKeyword ? 15 : 5; // 最高15分

    // 5. 完整性得分 - 基于数据状态
    const successfulRecords = routeData.filter(r => r.status === '成功');
    const completenessScore = Math.min(successfulRecords.length / routeData.length, 1) * 10; // 最高10分

    return connectivityScore + geoSpanScore + strategicScore + historicalScore + completenessScore;
  };

  // 获取选中朝代的交通要道数据
  const getDynastyRoutes = (dynasty) => {
    if (!dynasty || routeData.length === 0) return [];
    
    const dynastyRoutes = routeData.filter(r => r.dynasty === dynasty);
    
    // 按路线分组并计算重要性
    const routeGroups = d3.group(dynastyRoutes, d => d.routeName);
    const routeImportance = [];
    
    routeGroups.forEach((routes, routeName) => {
      const importance = calculateRouteImportance(routeName, routes);
      const startPlace = routes.find(r => r.orderInRoute === 1)?.placeName || '未知';
      const endPlace = routes.reduce((prev, current) => 
        prev.orderInRoute > current.orderInRoute ? prev : current
      )?.placeName || '未知';
      
      routeImportance.push({
        routeName,
        importance: importance.toFixed(1),
        routeCount: routes.length,
        startPlace,
        endPlace,
        routes
      });
    });
    
    // 按重要性排序
    return routeImportance.sort((a, b) => parseFloat(b.importance) - parseFloat(a.importance));
  };

  // 朝代详情视图组件
  const DynastyDetail = () => {
    if (!selectedDynasty) return null;
    
    const routes = getDynastyRoutes(selectedDynasty);
    
    return (
      <div className="dynasty-detail">
        <div className="dynasty-header">
          <h3>{selectedDynasty} 朝代交通要道详情</h3>
          <button 
            onClick={() => {
              console.log('返回按钮被点击，当前选中朝代:', selectedDynasty);
              // 清除所有悬浮框
              d3.selectAll('.traffic-hub-tooltip').remove();
              // 清除选中的路线
              clearSelectedRoute();
              clearAllSelectedRoutes();
              setShowAllRoutes(true);
              setSelectedDynasty(null);
            }} 
            className="back-button"
          >
            返回总览
          </button>
        </div>
        
        <div className="dynasty-content">
          <div className="route-list">
            <div className="route-list-header">
              <h4>交通要道列表 (按重要性排序)</h4>
              
              {/* 路线显示控制区域 */}
              <div className="route-display-controls">
                <div className="display-mode-toggle">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="displayMode"
                      checked={showAllRoutes}
                      onChange={() => setShowAllRoutes(true)}
                    />
                    <span>显示所有路线</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="displayMode"
                      checked={!showAllRoutes}
                      onChange={() => setShowAllRoutes(false)}
                    />
                    <span>仅显示选中路线 ({selectedRoutes.length})</span>
                  </label>
                </div>
                
                {!showAllRoutes && (
                  <div className="selection-actions">
                    <button
                      className="clear-selection-btn"
                      onClick={() => clearAllSelectedRoutes()}
                      disabled={selectedRoutes.length === 0}
                    >
                      清空选择
                    </button>
                  </div>
                )}
              </div>
            </div>
                          <div className="route-items">
                {routes.slice(0, 15).map((route, index) => {
                  // 检查是否是当前单选的路线
                  const isSingleSelected = selectedRoute && 
                    selectedRoute.routeName === route.routeName && 
                    selectedRoute.dynasty === selectedDynasty;
                    
                  // 检查是否在多选列表中
                  const isMultiSelected = selectedRoutes.some(r =>
                    r.routeName === route.routeName && r.dynasty === selectedDynasty
                  );
                  
                  return (
                  <div 
                    key={route.routeName} 
                    className={`route-item ${isSingleSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''}`}
                  >
                    {/* 多选复选框 */}
                    <div className="route-checkbox">
                      <input
                        type="checkbox"
                        checked={isMultiSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleRouteSelection({
                            routeName: route.routeName,
                            dynasty: selectedDynasty,
                            startPlace: route.startPlace,
                            endPlace: route.endPlace,
                            importance: route.importance,
                            routeCount: route.routeCount
                          });
                        }}
                      />
                    </div>
                    
                    <div 
                      className="route-content"
                      onClick={() => {
                        // 设置单选路线信息（向后兼容）
                        setSelectedRoute({
                          routeName: route.routeName,
                          dynasty: selectedDynasty,
                          startPlace: route.startPlace,
                          endPlace: route.endPlace,
                          importance: route.importance,
                          routeCount: route.routeCount
                        });
                        console.log('选中交通要道:', route.routeName, '朝代:', selectedDynasty);
                      }}
                      style={{ cursor: 'pointer' }}
                                            title="点击在地图上显示此路线"
                    >
                      <div className="route-rank">#{index + 1}</div>
                      <div className="route-info">
                        <div className="route-name">
                          {isSingleSelected && <span className="selected-indicator">🎯 </span>}
                          {route.routeName}
                        </div>
                        <div className="route-details">
                          <span className="route-path">{route.startPlace} → {route.endPlace}</span>
                          <span className="route-score">重要性: {route.importance}分</span>
                          <span className="route-count">地点数: {route.routeCount}个</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="dynasty-stats">
            <h4>统计信息</h4>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">交通要道总数:</span>
                <span className="stat-value">{routes.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">平均重要性:</span>
                <span className="stat-value">
                  {routes.length > 0 ? (routes.reduce((sum, r) => sum + parseFloat(r.importance), 0) / routes.length).toFixed(1) : '0'} 分
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">重要要道 (≥70分):</span>
                <span className="stat-value">{routes.filter(r => parseFloat(r.importance) >= 70).length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">总地点数:</span>
                <span className="stat-value">{routes.reduce((sum, r) => sum + r.routeCount, 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  // 渲染加载状态或错误
  if (loading) {
    return (
      <div className="traffic-hub-analysis loading">
        <div>数据加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="traffic-hub-analysis error">
        <div>数据加载失败: {error}</div>
      </div>
    );
  }

  console.log('TrafficHubAnalysis 渲染，selectedDynasty:', selectedDynasty);

  return (
    <div className="traffic-hub-analysis">
      {selectedDynasty ? (
        <DynastyDetail />
      ) : (
        <div className="combined-chart-container" ref={chartContainerRef}>
          {/* 合并的柱状图和网络图 */}
          {console.log('图表容器渲染，container ref:', chartContainerRef.current)}
        </div>
      )}
    </div>
  );
};

export default TrafficHubAnalysis;