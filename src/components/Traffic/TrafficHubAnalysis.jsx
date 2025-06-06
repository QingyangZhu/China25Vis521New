import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';
import './TrafficHubAnalysis.css';

const TrafficHubAnalysis = () => {
  const [hubData, setHubData] = useState([]);
  const [dynastyData, setDynastyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lineChartRef = useRef(null);
  const networkChartRef = useRef(null);

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

// 绘制柱状图（Y轴为朝代，X轴为得分）
useEffect(() => {
    if (!dynastyData.length || !lineChartRef.current || loading) return;
  
    console.log('Drawing dynasty score chart with data:', dynastyData);
  
    // 清空之前的图表
    d3.select(lineChartRef.current).selectAll('*').remove();
  
    const margin = { top: 20, right: 10, bottom: 20, left: 20 };
    const width = lineChartRef.current.clientWidth - margin.left - margin.right;
    const height = lineChartRef.current.clientHeight - margin.top - margin.bottom;
  
    const svg = d3.select(lineChartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);
  
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
  
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
    const data = dynastyOrder
      .filter(dynasty => dynastyScores.has(dynasty))
      .map(dynasty => ({
        dynasty,
        score: dynastyScores.get(dynasty)
      }));
  
    // 设置比例尺 - Y轴为朝代，X轴为得分
    const y = d3.scaleBand()
      .domain(data.map(d => d.dynasty))
      .range([0, height])
      .padding(0.1);
  
    // X轴比例尺，最大值固定为100，但实际绘制宽度只占容器的80%
    const maxBarWidth = width * 0.8; // 柱状图最大宽度只占容器的80%
    const x = d3.scaleLinear()
      .domain([0, 100]) // 固定最大值为100
      .range([0, maxBarWidth]);
  
    // 绘制柱状图
    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', d => y(d.dynasty))
      .attr('width', d => x(d.score))
      .attr('height', y.bandwidth())
      .attr('fill', colorScheme.primary)
      .attr('opacity', 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 1);
        
        // 显示提示
        const tooltip = d3.select('body').append('div')
          .attr('class', 'traffic-hub-tooltip')
          .style('opacity', 0);
  
        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        
        tooltip.html(`${d.dynasty}<br/>综合得分: ${d.score.toFixed(2)}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.8);
        d3.selectAll('.traffic-hub-tooltip').remove();
      });
  
    // 只添加Y轴（朝代轴）
    g.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('font-size', '10px')
      .style('font-family', "'Noto Serif SC', sans-serif")
      .style('fill', colorScheme.text);
  
    // 添加标题
    g.append('text')
      .attr('x', width / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('font-family', "'Noto Serif SC', sans-serif")
      .style('fill', colorScheme.text)
      .text('朝代发展水平综合得分');
  
  }, [dynastyData, colorScheme, loading]);

// 绘制网络图
useEffect(() => {
    if (!hubData.length || !networkChartRef.current || loading) return;
  
    console.log('Drawing network chart with data:', hubData);
  
    // 清空之前的图表
    d3.select(networkChartRef.current).selectAll('*').remove();
  
    const containerWidth = networkChartRef.current.clientWidth;
    const containerHeight = networkChartRef.current.clientHeight;
    
    // 网络图区域高度为90%，底部10%留给图例
    const networkHeight = containerHeight * 0.85;
    const legendHeight = containerHeight * 0.15;
  
    const svg = d3.select(networkChartRef.current)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight);
  
    // 创建缩放行为
    const zoom = d3.zoom()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
  
    svg.call(zoom);
  
    const g = svg.append('g');
  
    // 准备节点数据 - 只显示前50个节点
    const nodes = hubData.slice(0, 50).map(d => ({
      id: d.name,
      ...d,
      radius: Math.sqrt(d.score) * 3
    }));
  
    // 创建模拟连接（基于网络中心性得分）
    const links = [];
    nodes.forEach((source, i) => {
      nodes.forEach((target, j) => {
        if (i < j && source.networkScore > 0.1 && target.networkScore > 0.1) {
          const strength = (source.networkScore + target.networkScore) / 2;
          if (strength > 0.2) {
            links.push({
              source: source.id,
              target: target.id,
              strength: strength
            });
          }
        }
      });
    });
  
    // 创建力导向图 - 使用调整后的网络区域高度
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id(d => d.id)
        .distance(d => 50 / d.strength))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(containerWidth / 2, networkHeight / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + 2))
      .force('x', d3.forceX(containerWidth / 2).strength(0.1))
      .force('y', d3.forceY(networkHeight / 2).strength(0.1));
  
    // 绘制连接线
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', d => d.strength * 0.6)
      .attr('stroke-width', d => d.strength * 3);
  
    // 颜色比例尺（基于朝代数量）
    const colorScale = d3.scaleQuantize()
      .domain([0, d3.max(nodes, d => d.dynastyCount)])
      .range(colorScheme.dynastyColorScale);
  
    // 绘制节点
const node = g.append('g')
.selectAll('circle')
.data(nodes)
.enter().append('circle')
.attr('r', d => d.radius)
.attr('fill', d => colorScale(d.dynastyCount))
.attr('stroke', d => colorScheme.hubLevelColors[d.level] || '#D5CAB5')
.attr('stroke-width', 1) // 从2改为1，边框更细
.attr('stroke-opacity', 0.8); // 添加边框透明度，更加淡雅
  
// 添加节点标签 - 只显示综合得分≥40的节点名称
const label = g.append('g')
  .selectAll('text')
  .data(nodes.filter(d => d.score >= 40)) // 只为得分≥40的节点创建标签
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
      d.fx = Math.max(d.radius, Math.min(containerWidth - d.radius, event.x));
      d.fy = Math.max(d.radius, Math.min(networkHeight - d.radius, event.y));
      
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
      nodes.forEach(d => {
        d.x = Math.max(d.radius, Math.min(containerWidth - d.radius, d.x));
        d.y = Math.max(d.radius, Math.min(networkHeight - d.radius, d.y));
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
      .attr('transform', `translate(0, ${networkHeight})`);
  
    // 添加底部分隔线
    legendContainer.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', containerWidth)
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
  
  }, [hubData, colorScheme, loading]);
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

  return (
    <div className="traffic-hub-analysis">
      <div className="analysis-container">
        <div className="line-chart-container" ref={lineChartRef}>
          {/* 朝代发展水平条形图 */}
        </div>
        <div className="network-chart-container" ref={networkChartRef}>
          {/* 网络图 */}
        </div>
      </div>
    </div>
  );
};

export default TrafficHubAnalysis;