import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './ProductVis.css';

const ProductVis = () => {
  const circleRef = useRef(null);
  const bubbleRef = useRef(null);
  const forceRef = useRef(null);
  const tooltipRef = useRef(null);
  const [selectedDynasty, setSelectedDynasty] = useState(null);
  const [timelineData, setTimelineData] = useState(null);

  // 处理时间序列数据
  const processTimelineData = (rawData) => {
    const timelineMap = new Map();
    
    rawData.forEach(item => {
      if (item.exact_year && item.exact_year !== '无') {
        const year = parseInt(item.exact_year);
        if (!isNaN(year)) {
          if (!timelineMap.has(year)) {
            timelineMap.set(year, new Map());
          }
          
          // 处理物产小类
          if (item.product_subcategory) {
            const subcategories = item.product_subcategory.replace(/[（）]/g, '').split('、');
            subcategories.forEach(subcat => {
              const count = timelineMap.get(year).get(subcat) || 0;
              timelineMap.get(year).set(subcat, count + 1);
            });
          }
        }
      }
    });

    // 转换为数组格式
    return Array.from(timelineMap).map(([year, subcats]) => ({
      year,
      subcategories: Array.from(subcats).map(([name, count]) => ({
        name,
        count
      })).sort((a, b) => b.count - a.count)
    })).sort((a, b) => a.year - b.year);
  };

  // 绘制时间序列气泡图
  const drawBubbleTimeline = (data) => {
    if (!data) return;

    const width = bubbleRef.current.clientWidth;
    const height = bubbleRef.current.clientHeight;
    
    // 清除之前的图形
    d3.select(bubbleRef.current).selectAll('*').remove();

    const svg = d3.select(bubbleRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 创建比例尺
    const xScale = d3.scaleLinear()
      .domain([d3.min(data, d => d.year), d3.max(data, d => d.year)])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d3.max(d.subcategories, s => s.count))])
      .range([innerHeight, 0]);

    const rScale = d3.scaleSqrt()
      .domain([0, d3.max(data, d => d3.max(d.subcategories, s => s.count))])
      .range([3, 20]);

    const colorScale = d3.scaleOrdinal()
      .domain(data.flatMap(d => d.subcategories.map(s => s.name)))
      .range(d3.schemeCategory10);

    // 创建坐标轴
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d => d.toString())
      .ticks(10);

    const yAxis = d3.axisLeft(yScale);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // 绘制坐标轴
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('color', '#4A4A4A');

    g.append('g')
      .call(yAxis)
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('color', '#4A4A4A');

    // 绘制气泡
    data.forEach(yearData => {
      const yearGroup = g.append('g')
        .attr('transform', `translate(${xScale(yearData.year)},0)`);

      yearData.subcategories.forEach((subcat, i) => {
        yearGroup.append('circle')
          .attr('cy', yScale(subcat.count))
          .attr('r', rScale(subcat.count))
          .attr('fill', colorScale(subcat.name))
          .attr('opacity', 0.7)
          .attr('cursor', 'pointer')
          .on('mouseover', function(event) {
            d3.select(this).attr('opacity', 1);
            const tooltip = d3.select(tooltipRef.current);
            tooltip
              .style('opacity', 1)
              .html(`
                <div>年份：${yearData.year}</div>
                <div>物产：${subcat.name}</div>
                <div>记载次数：${subcat.count}</div>
              `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          })
          .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.7);
            d3.select(tooltipRef.current).style('opacity', 0);
          });
      });
    });
  };

  // 绘制力导向图
  const drawForceGraph = (dynasty) => {
    if (!dynasty || !dynasty.selectedCategory) return;

    const width = forceRef.current.clientWidth;
    const height = forceRef.current.clientHeight;

    // 清除之前的图形
    d3.select(forceRef.current).selectAll('*').remove();

    const svg = d3.select(forceRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // 创建节点数据
    const nodes = [];
    const links = [];
    
    // 添加中心的物产大类节点
    nodes.push({
      id: dynasty.selectedCategory,
      type: 'category',
      name: dynasty.selectedCategory
    });

    // 添加物产小类节点
    dynasty.subcategories.forEach(subcategory => {
      nodes.push({
        id: subcategory,
        type: 'subcategory',
        name: subcategory
      });
      // 连接到物产大类
      links.push({
        source: dynasty.selectedCategory,
        target: subcategory
      });
    });

    // 添加产地节点和连接
    dynasty.products.forEach(product => {
      const subcategories = product.subcategory.replace(/[（）]/g, '').split('、');
      subcategories.forEach(subcategory => {
        if (dynasty.subcategories.includes(subcategory)) {
          if (!nodes.find(n => n.id === product.location)) {
            nodes.push({
              id: product.location,
              type: 'location',
              name: product.location
            });
          }
          links.push({
            source: subcategory,
            target: product.location
          });
        }
      });
    });

    // 创建力导向图
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force('y', d3.forceY(height / 2).strength(0.1))
      .force('collision', d3.forceCollide().radius(30));

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#DCD1BB')
      .attr('stroke-opacity', 0.6);

    const nodeGroups = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // 添加节点圆形
    nodeGroups.append('circle')
      .attr('r', d => d.type === 'category' ? 15 : d.type === 'subcategory' ? 10 : 8)
      .attr('fill', d => {
        switch (d.type) {
          case 'category': return '#8C6D46';
          case 'subcategory': return '#BF9D7E';
          default: return '#DCD1BB';
        }
      });

    // 添加节点文字
    nodeGroups.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.type === 'category' ? -20 : d.type === 'subcategory' ? -15 : 15)
      .attr('fill', '#4A4A4A')
      .attr('font-size', d => d.type === 'category' ? '14px' : '12px');

    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  };

  // 数据处理函数
  const processData = (rawData) => {
    const dynastyGroups = {};
    
    rawData.forEach(item => {
      if (!dynastyGroups[item.dynasty]) {
        dynastyGroups[item.dynasty] = {
          dynasty: item.dynasty,
          categories: new Map(), // 使用Map存储每个大类及其小类
          products: []
        };
      }
      
      if (item.product_category) {
        // 处理物产大类和小类
        const categories = item.product_category.replace(/[（）]/g, '').split('、');
        const subcategories = item.product_subcategory ? 
          item.product_subcategory.replace(/[（）]/g, '').split('、') : [];
        
        categories.forEach((category, index) => {
          if (!dynastyGroups[item.dynasty].categories.has(category)) {
            dynastyGroups[item.dynasty].categories.set(category, new Set());
          }
          
          // 将对应的小类添加到相应的大类中
          if (subcategories[index]) {
            subcategories[index].split('、').forEach(subcat => {
              dynastyGroups[item.dynasty].categories.get(category).add(subcat);
            });
          }
        });
      }

      if (item.product_subcategory && item.location) {
        dynastyGroups[item.dynasty].products.push({
          subcategory: item.product_subcategory,
          location: item.location
        });
      }
    });

    // 转换数据结构
    return Object.values(dynastyGroups).map(group => ({
      ...group,
      categoryData: Array.from(group.categories.entries()).map(([category, subcats]) => ({
        category,
        subcategoryCount: subcats.size,
        subcategories: Array.from(subcats)
      })),
      categories: Array.from(group.categories.keys()),
      totalSubcategories: Array.from(group.categories.values())
        .reduce((total, subcats) => total + subcats.size, 0)
    }));
  };

  // 绘制圆形和弧线图
  const drawCircleView = (data) => {
    const width = circleRef.current.clientWidth;
    const height = circleRef.current.clientHeight;
    
    // 清除之前的图形
    d3.select(circleRef.current).selectAll('*').remove();

    const svg = d3.select(circleRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // 添加tooltip
    const tooltip = d3.select(tooltipRef.current);

    // 计算布局参数
    const margin = { top: 20, right: 30, bottom: 20, left: 30 }; // 减小边距
    const viewWidth = width - margin.left - margin.right;
    const viewHeight = height - margin.top - margin.bottom;
    
    // 计算每个朝代的位置
    const dynastySpacing = viewWidth / (data.length - 0.5);
    const dynastyRadius = Math.min(dynastySpacing / 2, viewHeight / 2.2); // 增大基础半径

    // 创建容器组
    const container = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // 为每个朝代创建一个组
    const dynastyGroups = container.selectAll('.dynasty-group')
      .data(data)
      .join('g')
      .attr('class', 'dynasty-group')
      .attr('transform', (d, i) => `translate(${i * dynastySpacing + dynastySpacing/2}, ${viewHeight/2})`);

    // 为每个朝代绘制花瓣
    dynastyGroups.each(function(dynastyData) {
      const group = d3.select(this);
      
      // 准备花瓣数据
      const petalData = dynastyData.categoryData.map(category => ({
        subcategoryCount: category.subcategoryCount,
        category: category.category,
        subcategories: category.subcategories,
        dynasty: dynastyData.dynasty,
        startAngle: 0,
        endAngle: Math.PI / 6
      }));

      // 计算总角度和起始偏移
      const totalAngle = petalData.length * (Math.PI / 6);
      const startOffset = -totalAngle / 2;

      // 设置每个花瓣的角度
      petalData.forEach((d, i) => {
        d.startAngle = startOffset + i * (Math.PI / 4);
        d.endAngle = d.startAngle + Math.PI / 4;
      });

      // 创建弧形生成器
      const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(d => {
          const scale = d3.scaleLinear()
            .domain([1, d3.max(petalData, d => d.subcategoryCount)])
            .range([dynastyRadius * 0.6, dynastyRadius * 1.2]); // 增大花瓣长度范围
          return scale(d.subcategoryCount);
        })
        .cornerRadius(15);

      // 绘制花瓣
      const petals = group.selectAll('.petal')
        .data(petalData)
        .join('path')
        .attr('class', 'petal')
        .attr('d', arc)
        .attr('fill', '#BF9D7E')
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.8)
        .attr('cursor', 'pointer');

      // 添加交互效果
      petals
        .on('mouseover', function(event, d) {
          d3.select(this)
            .attr('opacity', 1);
          
          tooltip
            .style('opacity', 1)
            .html(`
              <div>朝代：${d.dynasty}</div>
              <div>物产大类：${d.category}</div>
              <div>包含小类：${d.subcategoryCount}种</div>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this)
            .attr('opacity', 0.8);
          tooltip.style('opacity', 0);
        })
        .on('click', function(event, d) {
          // 清除之前的选中状态
          container.selectAll('.petal').attr('opacity', 0.8);
          // 设置当前选中状态
          d3.select(this).attr('opacity', 1);
          
          setSelectedDynasty({
            ...dynastyData,
            selectedCategory: d.category,
            subcategories: d.subcategories
          });
        });
    });
  };

  useEffect(() => {
    // 获取数据并初始化可视化
    fetch('/data/物产数据_按朝代排序.csv')
      .then(response => response.text())
      .then(text => {
        const data = d3.csvParse(text);
        const processedData = processData(data);
        const timelineData = processTimelineData(data);
        setTimelineData(timelineData);
        drawCircleView(processedData);
        drawBubbleTimeline(timelineData);
      })
      .catch(error => {
        console.error('数据加载错误：', error);
      });
  }, []);

  useEffect(() => {
    if (selectedDynasty) {
      drawForceGraph(selectedDynasty);
    }
  }, [selectedDynasty]);

  return (
    <div className="product-vis-container">
      <div className="circle-view" ref={circleRef} />
      <div className="bubble-timeline" ref={bubbleRef} />
      <div className="force-view" ref={forceRef} />
      <div className="tooltip" ref={tooltipRef} />
    </div>
  );
};

export default ProductVis; 