import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './DynastyDetailView.css';

const DynastyDetailView = ({ dynasty, onClose, isEmbedded = false }) => {
  const svgRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 处理数据，构建力导向图的节点和连接
  const processData = (rawData, selectedDynasty) => {
    const filteredData = rawData.filter(item => item.dynasty === selectedDynasty);
    
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    
    // 创建朝代中心节点
    const dynastyNode = {
      id: selectedDynasty,
      type: 'dynasty',
      name: selectedDynasty,
      group: 0
    };
    nodes.push(dynastyNode);
    nodeMap.set(selectedDynasty, dynastyNode);

    // 处理每条记录
    filteredData.forEach((item, index) => {
      // 创建地点节点
      if (item.location && !nodeMap.has(item.location)) {
        const locationNode = {
          id: item.location,
          type: 'location',
          name: item.location,
          group: 1
        };
        nodes.push(locationNode);
        nodeMap.set(item.location, locationNode);
        
        // 连接朝代和地点
        links.push({
          source: selectedDynasty,
          target: item.location,
          type: 'dynasty-location'
        });
      }

      // 处理物产小类
      if (item.product_subcategory && item.location) {
        const subcategories = item.product_subcategory
          .replace(/[（）]/g, '')
          .split('、')
          .filter(sub => sub.trim());

        subcategories.forEach(subcategory => {
          const subId = `${subcategory}_${index}`;
          
          if (!nodeMap.has(subId)) {
            const subcategoryNode = {
              id: subId,
              type: 'subcategory',
              name: subcategory,
              group: 2,
              category: item.product_category
            };
            nodes.push(subcategoryNode);
            nodeMap.set(subId, subcategoryNode);
          }

          // 连接地点和物产小类
          if (nodeMap.has(item.location)) {
            links.push({
              source: item.location,
              target: subId,
              type: 'location-subcategory'
            });
          }
        });
      }
    });

    return { nodes, links };
  };

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/problem3/物产数据_按朝代排序.csv');
        const csvText = await response.text();
        const rawData = d3.csvParse(csvText);
        
        const processedData = processData(rawData, dynasty);
        setData(processedData);
      } catch (error) {
        console.error('数据加载错误：', error);
      } finally {
        setLoading(false);
      }
    };

    if (dynasty) {
      loadData();
    }
  }, [dynasty]);

  // 绘制力导向图
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 根据是否内嵌调整尺寸
    const width = isEmbedded ? 600 : 800;
    const height = isEmbedded ? 400 : 600;
    const margin = { top: isEmbedded ? 40 : 60, right: 40, bottom: 40, left: 40 };

    svg.attr('width', '100%').attr('height', '100%')
       .attr('viewBox', `0 0 ${width} ${height}`)
       .attr('preserveAspectRatio', 'xMidYMid meet');

    // 创建主容器
    const container = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 颜色比例尺
    const colorScale = d3.scaleOrdinal()
      .domain(['dynasty', 'location', 'subcategory'])
      .range(['#8b4513', '#c5aeb7', '#beb6a9']); // 朝代-深棕色，地点-暖粉灰，物产-暖米灰

    // 创建力模拟
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide().radius(d => {
        if (d.type === 'dynasty') return 40;
        if (d.type === 'location') return 25;
        return 15;
      }));

    // 绘制连接线
    const links = container.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => d.type === 'dynasty-location' ? 3 : 1);

    // 绘制节点
    const nodes = container.append('g')
      .selectAll('circle')
      .data(data.nodes)
      .join('circle')
      .attr('r', d => {
        if (d.type === 'dynasty') return 30;
        if (d.type === 'location') return 20;
        return 12;
      })
      .attr('fill', d => colorScale(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer');

    // 添加节点标签
    const labels = container.append('g')
      .selectAll('text')
      .data(data.nodes)
      .join('text')
      .text(d => d.name)
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', d => {
        if (d.type === 'dynasty') return '14px';
        if (d.type === 'location') return '12px';
        return '10px';
      })
      .attr('font-weight', d => d.type === 'dynasty' ? 'bold' : 'normal')
      .attr('text-anchor', 'middle')
      .attr('dy', d => {
        if (d.type === 'dynasty') return 5;
        if (d.type === 'location') return 4;
        return 3;
      })
      .attr('fill', '#2d2520')
      .style('pointer-events', 'none');

    // 添加拖拽功能
    const drag = d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodes.call(drag);

    // 添加悬浮效果
    nodes
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#333')
          .attr('stroke-width', 3);
        
        // 高亮相关连接
        links
          .attr('stroke', link => 
            link.source.id === d.id || link.target.id === d.id ? '#333' : '#999'
          )
          .attr('stroke-width', link => 
            link.source.id === d.id || link.target.id === d.id ? 3 : 1
          );
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2);
        
        // 恢复连接样式
        links
          .attr('stroke', '#999')
          .attr('stroke-width', link => link.type === 'dynasty-location' ? 3 : 1);
      });

    // 更新位置
    simulation.on('tick', () => {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodes
        .attr('cx', d => Math.max(15, Math.min(innerWidth - 15, d.x)))
        .attr('cy', d => Math.max(15, Math.min(innerHeight - 15, d.y)));

      labels
        .attr('x', d => Math.max(15, Math.min(innerWidth - 15, d.x)))
        .attr('y', d => Math.max(15, Math.min(innerHeight - 15, d.y)));
    });

    // 添加标题
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', isEmbedded ? 25 : 30)
      .attr('text-anchor', 'middle')
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', isEmbedded ? '16px' : '18px')
      .attr('font-weight', 'bold')
      .attr('fill', '#2d2520')
      .text(`${dynasty} - 物产地名关系图`);

    // 添加图例
    const legend = svg.append('g')
      .attr('transform', `translate(${width - (isEmbedded ? 120 : 150)}, ${isEmbedded ? 50 : 60})`);

    const legendData = [
      { type: 'dynasty', label: '朝代', color: colorScale('dynasty') },
      { type: 'location', label: '地名', color: colorScale('location') },
      { type: 'subcategory', label: '物产小类', color: colorScale('subcategory') }
    ];

    const legendItems = legend.selectAll('.legend-item')
      .data(legendData)
      .join('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * (isEmbedded ? 20 : 25)})`);

    legendItems.append('circle')
      .attr('r', isEmbedded ? 6 : 8)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    legendItems.append('text')
      .attr('x', isEmbedded ? 12 : 15)
      .attr('y', 0)
      .attr('dy', '0.35em')
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', isEmbedded ? '11px' : '12px')
      .attr('fill', '#2d2520')
      .text(d => d.label);

  }, [data, isEmbedded]);

  if (loading) {
    if (isEmbedded) {
      return (
        <div className="dynasty-detail-embedded">
          <div className="loading">加载中...</div>
        </div>
      );
    }
    return (
      <div className="dynasty-detail-overlay">
        <div className="dynasty-detail-container">
          <div className="loading">加载中...</div>
        </div>
      </div>
    );
  }

  if (isEmbedded) {
    return (
      <div className="dynasty-detail-embedded">
        <svg ref={svgRef}></svg>
      </div>
    );
  }

  return (
    <div className="dynasty-detail-overlay">
      <div className="dynasty-detail-container">
        <button className="close-button" onClick={onClose}>
          ×
        </button>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default DynastyDetailView; 