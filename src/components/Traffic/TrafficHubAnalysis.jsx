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
  const [trafficToolsData, setTrafficToolsData] = useState([]);
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
          },
          error: (error) => {
            console.error('Parse error:', error);
            setError('数据解析失败');
          }
        });

        // 加载交通工具汇总数据
        const trafficToolsResponse = await fetch('/data/problem3/交通工具汇总.csv');
        if (!trafficToolsResponse.ok) {
          throw new Error(`Failed to load traffic tools data: ${trafficToolsResponse.status}`);
        }
        const trafficToolsText = await trafficToolsResponse.text();
        
        Papa.parse(trafficToolsText, {
          header: true,
          complete: (results) => {
            console.log('Traffic tools data parsed:', results.data);
            const processedTrafficToolsData = results.data
              .filter(row => row.朝代 && row.主要工具)
              .map(row => ({
                dynasty: row.朝代,
                landTools: row.陆路交通工具 || '',
                waterTools: row.水路交通工具 || '',
                otherTools: row.其他交通工具 || '',
                totalTypes: parseInt(row.工具种类总数) || 0,
                totalRecords: parseInt(row.使用记录总数) || 0,
                mainTools: row.主要工具 || ''
              }));
            setTrafficToolsData(processedTrafficToolsData);
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
    if ((!dynastyData.length || !hubData.length || !trafficToolsData.length || !chartContainerRef.current || loading || selectedDynasty !== null)) return;
  
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
  
    // 添加Y轴（朝代轴）- 美化样式
    const yAxis = barChartGroup.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale));
    
    // 美化坐标轴线条
    yAxis.select('.domain')
      .style('stroke', colorScheme.secondary)
      .style('stroke-width', '2px')
      .style('opacity', 0.8);
    
    // 美化刻度线
    yAxis.selectAll('.tick line')
      .style('stroke', colorScheme.grid)
      .style('stroke-width', '1px')
      .style('opacity', 0.6);
    
    // 美化文字标签
    yAxis.selectAll('text')
      .style('font-size', '10px')
      .style('font-family', "'Noto Serif SC', sans-serif")
      .style('fill', colorScheme.text)
      .style('font-weight', '500');
    
    // 添加水平网格线（可选，增强可读性）
    const gridLines = barChartGroup.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(dynastyChartData)
      .enter().append('line')
      .attr('x1', 0)
      .attr('x2', maxBarWidth)
      .attr('y1', d => yScale(d.dynasty) + yScale.bandwidth() / 2)
      .attr('y2', d => yScale(d.dynasty) + yScale.bandwidth() / 2)
      .style('stroke', colorScheme.grid)
      .style('stroke-width', '0.5px')
      .style('stroke-dasharray', '2,2')
      .style('opacity', 0.3);
    
    // 添加右侧边框线以增强视觉效果
    barChartGroup.append('line')
      .attr('x1', maxBarWidth)
      .attr('y1', 0)
      .attr('x2', maxBarWidth)
      .attr('y2', barChartInnerHeight)
      .style('stroke', colorScheme.grid)
      .style('stroke-width', '1px')
      .style('opacity', 0.4);
  
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

    // 添加纵向分隔线 - 向左偏移，美化样式
    svg.append('line')
      .attr('x1', barChartWidth - 10) // 向左偏移10px
      .attr('y1', 0)
      .attr('x2', barChartWidth - 10) // 向左偏移10px
      .attr('y2', containerHeight)
      .attr('stroke', colorScheme.secondary)
      .attr('stroke-width', 0.8)
      .attr('opacity', 0.6);
      // .attr('stroke-dasharray', '5,3'); // 添加虚线效果

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

    // 添加横向分隔线 - 缩短并右移，美化样式
    legendContainer.append('line')
      .attr('x1', 30) // 右移30px作为起点
      .attr('y1', 0)
      .attr('x2', networkWidth - 50) // 缩短50px作为终点
      .attr('y2', 0)
      .attr('stroke', colorScheme.secondary)
      .attr('stroke-width', 0.6)
      .attr('opacity', 0.5)
      // .attr('stroke-dasharray', '3,2'); // 添加细虚线效果

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



  }, [hubData.length, dynastyData.length, trafficToolsData.length, loading, selectedDynasty]);



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

  // 获取交通工具图片路径
  const getToolImagePath = (toolName) => {
    // 根据实际图片文件和交通工具数据建立映射关系
    const imageMap = {
      // 基础交通方式
      '行走': 'images/行走.png',
      
      // 马类交通工具
      '马': 'images/马.png',
      '马车': 'images/马车.png',
      '西洋马车': 'images/西洋马车.png',
      '骑': 'images/马.png',
      '骑兵': 'images/马.png',
      '车马': 'images/马车.png',
      '驿马': 'images/马.png',
      
      // 牛类交通工具
      '牛': 'images/牛.png',
      '牛车': 'images/牛车.png',
      
      // 驴类交通工具
      '驴': 'images/驴.png',
      '驴车': 'images/驴车.png',
      '毛驴': 'images/驴.png',
      
      // 骆驼
      '骆驼': 'images/骆驼.png',
      
      // 步兵类
      '步骑': 'images/步骑.png',
      '步军': 'images/步骑.png',
      
      // 船类交通工具
      '船': 'images/船.png',
      '舟': 'images/舟.png',
      '漕船': 'images/漕船.png',
      '龙舟': 'images/龙舟.png',
      '战船': 'images/船.png',
      '行舟': 'images/船.png',
      '驳船': 'images/船.png',
      '剥船': 'images/船.png',
      '舟师': 'images/舟.png',
      
      // 古代车辆
      '五辂': 'images/五辂.png',
      '车': 'images/车.png',
      '副车': 'images/车.png',
      '戎车': 'images/车.png',
      '安车': 'images/车.png',
      '轺车': 'images/车.png',
      '辎车': 'images/车.png',
      '犊车': 'images/车.png',
      '奚车': 'images/车.png',
      '猎车': 'images/车.png',
      '指南车': 'images/车.png',
      '记里鼓车': 'images/车.png',
      '白鹭车': 'images/车.png',
      '鸾旗车': 'images/车.png',
      '辟恶车': 'images/车.png',
      '皮轩车': 'images/车.png',
      '耕根车': 'images/车.png',
      '四望车': 'images/车.png',
      '游车': 'images/车.png',
      '羊车': 'images/车.png',
      '画轮车': 'images/车.png',
      '鼓吹车': 'images/车.png',
      '象车': 'images/车.png',
      '黄钺车': 'images/车.png',
      '豹尾车': 'images/车.png',
      '建华车': 'images/车.png',
      '辒辕车': 'images/车.png',
      '軿车': 'images/车.png',
      '追锋车': 'images/车.png',
      '云母车': 'images/车.png',
      '骡车': 'images/车.png',
      '铁皮车': 'images/车.png',
      
      // 轿子类
      '轿': 'images/轿子.png',
      '轿子': 'images/轿子.png',
      '銮辇': 'images/轿子.png',
      '骡驮轿': 'images/轿子.png',
      '红色喜轿': 'images/轿子.png',
      
      // 人力车类
      '人力车': 'images/人力车.png',
      '胶皮车': 'images/人力车.png',
      
      // 火车类（按朝代区分）
      '火车': 'images/近代-火车.png',
      '清-火车': 'images/近代-火车.png',
      '近代-火车': 'images/近代-火车.png',
      '蒸汽机车': 'images/近代-火车.png',
      '内燃机车': 'images/近代-火车.png',
      '电力机车': 'images/近代-火车.png',
      '动车组高速列车': 'images/近代-火车.png',
      '高铁的客运专线': 'images/近代-火车.png',
      '高速铁路': 'images/近代-火车.png',
      '铁路客运': 'images/近代-火车.png',
      
      // 汽车类（按朝代区分）
      '汽车': 'images/现代-汽车.png',
      '民国-汽车': 'images/民国-汽车.png',
      '现代-汽车': 'images/现代-汽车.png',
      '出租汽车': 'images/现代-汽车.png',
      
      // 公共汽车类
      '公交车': 'images/现代-公共汽车.png',
      '公共汽车': 'images/现代-公共汽车.png',
      '现代-公共汽车': 'images/现代-公共汽车.png',
      '小公共汽车': 'images/现代-公共汽车.png',
      '公共电汽车': 'images/现代-公共汽车.png',
      '机场大巴': 'images/现代-公共汽车.png',
      '快速公交': 'images/现代-公共汽车.png',
      
      // 电车类
      '电车': 'images/电动车.png',
      '电动车': 'images/电动车.png',
      '有轨电车': 'images/电动车.png',
      '无轨电车': 'images/电动车.png',
      
      // 飞机类（按朝代区分）
      '飞机': 'images/现代-飞机.png',
      '清-飞机': 'images/清-飞机.png',
      '民国-飞机': 'images/民国-飞机.png',
      '现代-飞机': 'images/现代-飞机.png',
      
      // 地铁轨道交通
      '地铁': 'images/地铁.png',
      '现代-地铁': 'images/地铁.png',
      '轨道交通车辆': 'images/地铁.png',
      '机场快轨': 'images/地铁.png',
      
      // 自行车
      '自行车': 'images/自行车.png', // 使用电动车图片代替
      
      // 驿站系统
      '驿站': 'images/驿站.png',
      '急递铺': 'images/驿站.png',
      
      // 其他特殊交通方式
      '路侧摆渡车': 'images/现代-公共汽车.png'
    };
    
    // 精确匹配优先
    if (imageMap[toolName]) {
      return `/data/problem3/${imageMap[toolName]}`;
    }
    
    // 包含匹配 - 优先匹配更具体的词汇
    const keys = Object.keys(imageMap).sort((a, b) => b.length - a.length); // 按长度降序排列，优先匹配长词
    for (const key of keys) {
      if (toolName.includes(key)) {
        return `/data/problem3/${imageMap[key]}`;
      }
    }
    
    // 如果没有找到对应图片，返回null
    return null;
  };

  // 获取交通工具的速度数据（km/h）
  const getToolSpeed = (toolName) => {
    const speedMap = {
      // 步行/徒步
      '行走': 5,
      '步骑': 8,
      '步军': 6,
      
      // 动物类
      '马': 50,
      '骑': 50,
      '骑兵': 45,
      '驿马': 60,
      '牛': 8,
      '驴': 15,
      '毛驴': 15,
      '骆驼': 25,
      
      // 古代车辆
      '马车': 25,
      '车马': 25,
      '西洋马车': 30,
      '牛车': 8,
      '驴车': 15,
      '车': 20,
      '五辂': 15,
      '副车': 20,
      '戎车': 25,
      '人力车': 12,
      '胶皮车': 12,
      '轿子': 10,
      '銮辇': 8,
      
      // 船类
      '船': 15,
      '舟': 12,
      '漕船': 18,
      '龙舟': 20,
      '战船': 20,
      
      // 近现代交通工具
      '火车': 80,
      '清-火车': 40,
      '近代-火车': 60,
      '蒸汽机车': 60,
      '内燃机车': 120,
      '电力机车': 160,
      '动车组高速列车': 300,
      '高铁的客运专线': 350,
      '高速铁路': 350,
      
      '汽车': 60,
      '民国-汽车': 40,
      '现代-汽车': 100,
      '出租汽车': 80,
      '公交车': 50,
      '公共汽车': 50,
      '现代-公共汽车': 60,
      '小公共汽车': 50,
      
      '电车': 40,
      '电动车': 25,
      '有轨电车': 45,
      '无轨电车': 50,
      '自行车': 20,
      
      '地铁': 80,
      '现代-地铁': 80,
      '轨道交通车辆': 80,
      
      '飞机': 800,
      '清-飞机': 200,
      '民国-飞机': 300,
      '现代-飞机': 900,
      
      // 特殊系统
      '驿站': 50, // 驿站系统的平均速度
      '急递铺': 40
    };
    
    // 精确匹配
    if (speedMap[toolName]) {
      return speedMap[toolName];
    }
    
    // 包含匹配
    for (const [key, speed] of Object.entries(speedMap)) {
      if (toolName.includes(key)) {
        return speed;
      }
    }
    
    return 20; // 默认速度
  };

  // 获取朝代的交通工具数据
  const getDynastyTrafficTools = (dynasty) => {
    if (!dynasty || trafficToolsData.length === 0) return null;
    
    // 直接匹配朝代名称
    let toolData = trafficToolsData.find(d => d.dynasty === dynasty);
    
    // 如果没有找到，尝试匹配朝代的前缀
    if (!toolData) {
      toolData = trafficToolsData.find(d => 
        dynasty.startsWith(d.dynasty) || d.dynasty.startsWith(dynasty)
      );
    }
    
    if (!toolData) return null;
    
    // 解析主要工具
    const mainTools = toolData.mainTools.split(',').map(tool => tool.trim()).filter(tool => tool);
    
    // 为主要工具添加速度信息
    const mainToolsWithSpeed = mainTools.map(tool => ({
      name: tool,
      speed: getToolSpeed(tool),
      imagePath: getToolImagePath(tool)
    })).sort((a, b) => a.speed - b.speed); // 按速度排序
    
    // 获取所有工具
    const allTools = [];
    
    // 解析陆路交通工具
    if (toolData.landTools) {
      const landTools = toolData.landTools.split(';').map(tool => {
        const match = tool.match(/^([^(]+)/);
        return match ? match[1].trim() : tool.trim();
      }).filter(tool => tool);
      allTools.push(...landTools.map(tool => ({ name: tool, type: '陆路' })));
    }
    
    // 解析水路交通工具
    if (toolData.waterTools) {
      const waterTools = toolData.waterTools.split(';').map(tool => {
        const match = tool.match(/^([^(]+)/);
        return match ? match[1].trim() : tool.trim();
      }).filter(tool => tool);
      allTools.push(...waterTools.map(tool => ({ name: tool, type: '水路' })));
    }
    
    // 解析其他交通工具
    if (toolData.otherTools) {
      const otherTools = toolData.otherTools.split(';').map(tool => {
        const match = tool.match(/^([^(]+)/);
        return match ? match[1].trim() : tool.trim();
      }).filter(tool => tool);
      allTools.push(...otherTools.map(tool => ({ name: tool, type: '其他' })));
    }
    
    return {
      dynasty: toolData.dynasty,
      mainTools,
      mainToolsWithSpeed,
      allTools,
      totalTypes: toolData.totalTypes,
      totalRecords: toolData.totalRecords
    };
  };

  // 朝代详情视图组件
  const DynastyDetail = () => {
    const [showMainTools, setShowMainTools] = useState(true); // 控制显示主要工具还是所有工具
    
    if (!selectedDynasty) return null;
    
    const routes = getDynastyRoutes(selectedDynasty);
    const trafficTools = getDynastyTrafficTools(selectedDynasty);
    
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
                    <span>所有路线</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="displayMode"
                      checked={!showAllRoutes}
                      onChange={() => setShowAllRoutes(false)}
                    />
                    <span>选中路线 ({selectedRoutes.length})</span>
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
                {routes.map((route, index) => {
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
                    {/* 多选复选框和排名 */}
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
                      <div className="route-rank">#{index + 1}</div>
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
                      <div className="route-info">
                        <div className="route-name">
                          {isSingleSelected && <span className="selected-indicator">(选中) </span>}
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
                <span className="stat-label">重要性:</span>
                <span className="stat-value">
                  {routes.length > 0 ? (routes.reduce((sum, r) => sum + parseFloat(r.importance), 0) / routes.length).toFixed(1) : '0'} 
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">重要要道:</span>
                <span className="stat-value">{routes.filter(r => parseFloat(r.importance) >= 70).length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">总地点数:</span>
                <span className="stat-value">{routes.reduce((sum, r) => sum + r.routeCount, 0)}</span>
              </div>
            </div>

            {/* 交通工具展示区域 */}
            {trafficTools && (
              <div className="traffic-tools-section">
                <div className="traffic-tools-header">
                  <h4>交通工具</h4>
                  
                  {/* 切换按钮 */}
                  <div className="traffic-tools-toggle">
                    <button
                      className={`toggle-btn ${showMainTools ? 'active' : ''}`}
                      onClick={() => setShowMainTools(true)}
                    >
                      主要工具
                    </button>
                    <button
                      className={`toggle-btn ${!showMainTools ? 'active' : ''}`}
                      onClick={() => setShowMainTools(false)}
                    >
                      所有工具
                    </button>
                  </div>
                </div>

                {/* 根据切换状态显示不同内容 */}
                {showMainTools ? (
                  <div className="main-tools-display">
                    {/* 交通工具图片行 */}
                    <div className="tools-speed-container">
                      <div className="main-tools-row">
                        {trafficTools.mainToolsWithSpeed.map((tool, index) => (
                          <div key={index} className="main-tool-item" data-speed={tool.speed}>
                            {tool.imagePath && (
                              <div className="tool-image">
                                <img 
                                  src={tool.imagePath} 
                                  alt={tool.name}
                                  title={`${tool.name} - ${tool.speed}km/h`}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="tool-name">{tool.name}</div>
                            <div className="tool-speed">{tool.speed}km/h</div>
                          </div>
                        ))}
                      </div>


                    </div>
                  </div>
                ) : (
                  <div className="all-tools-display">
                    <div className="tools-categories">
                      {['陆路', '水路', '其他'].map(category => {
                        const categoryTools = trafficTools.allTools.filter(tool => tool.type === category);
                        if (categoryTools.length === 0) return null;
                        
                        return (
                          <div key={category} className="tool-category">
                            <h6>{category}交通工具</h6>
                            <div className="tool-list">
                              {categoryTools.map((tool, index) => (
                                <span key={index} className="tool-tag">
                                  {tool.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 交通工具统计 */}
                <div className="traffic-tools-stats">
                  <div className="tool-stat">
                    <span className="stat-label">工具种类总数:</span>
                    <span className="stat-value">{trafficTools.totalTypes}</span>
                  </div>
                  <div className="tool-stat">
                    <span className="stat-label">使用记录总数:</span>
                    <span className="stat-value">{trafficTools.totalRecords}</span>
                  </div>
                </div>
              </div>
            )}
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