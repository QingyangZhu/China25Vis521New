import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './ProductDetailView.css';

const ProductDetailView = ({ dynasty, category, onClose, isEmbedded = false }) => {
  const svgRef = useRef(null);
  const [data, setData] = useState(null);
  const [locationStats, setLocationStats] = useState(null); // 全局地名统计
  const [loading, setLoading] = useState(true);

  // 统计所有朝代的地名频率
  const calculateGlobalLocationStats = (rawData) => {
    const globalLocationFreq = new Map();
    
    rawData.forEach(item => {
      if (item.location) {
        const cleanLocation = item.location.trim();
        const currentCount = globalLocationFreq.get(cleanLocation) || 0;
        globalLocationFreq.set(cleanLocation, currentCount + 1);
      }
    });
    
    // 转换为数组并排序，取前30个
    const sortedLocations = Array.from(globalLocationFreq.entries())
      .map(([name, frequency]) => ({ name, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);
    
    return sortedLocations;
  };

  // 处理数据，构建力导向图的节点和连接
  const processData = (rawData, selectedDynasty, selectedCategory) => {
    let filteredData = rawData.filter(item => item.dynasty === selectedDynasty);
    
    // 如果指定了物产大类，进一步过滤
    if (selectedCategory) {
      filteredData = filteredData.filter(item => 
        item.product_category && item.product_category.includes(selectedCategory)
      );
    }
    
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    
    // 统计数据结构
    const categorySet = new Set(); // 存储所有物产大类
    const locationStats = new Map(); // 存储产地的统计信息：包含哪些物产小类
    const subcategoryStats = new Map(); // 存储物产小类的统计信息
    
    // 第一遍遍历：收集统计信息
    filteredData.forEach(item => {
      if (item.product_category && item.product_subcategory && item.location) {
        const categories = item.product_category.replace(/[（）]/g, '').split('、');
        const subcategories = item.product_subcategory.replace(/[（）]/g, '').split('、').filter(sub => sub.trim());
        const cleanLocation = item.location.trim();
        
        // 收集物产大类
        categories.forEach(category => categorySet.add(category.trim()));
        
        // 统计产地信息
        if (!locationStats.has(cleanLocation)) {
          locationStats.set(cleanLocation, {
            subcategories: new Map(), // 物产小类 -> 频率
            categories: new Set()
          });
        }
        
        const locationInfo = locationStats.get(cleanLocation);

        subcategories.forEach(subcategory => {
          const cleanSubcategory = subcategory.trim();
          
          // 统计该产地的物产小类频率
          const currentCount = locationInfo.subcategories.get(cleanSubcategory) || 0;
          locationInfo.subcategories.set(cleanSubcategory, currentCount + 1);
          
          // 记录该产地关联的物产大类
          categories.forEach(category => locationInfo.categories.add(category.trim()));
          
          // 统计物产小类的全局信息
          if (!subcategoryStats.has(cleanSubcategory)) {
            subcategoryStats.set(cleanSubcategory, {
              frequency: 0,
              locations: new Set(),
              categories: new Set()
            });
          }
          
          const subcategoryInfo = subcategoryStats.get(cleanSubcategory);
          subcategoryInfo.frequency += 1;
          subcategoryInfo.locations.add(cleanLocation);
          categories.forEach(category => subcategoryInfo.categories.add(category.trim()));
        });
      }
    });

    // 创建物产大类节点
    if (selectedCategory) {
      const categoryNode = {
        id: selectedCategory,
        type: 'category',
        name: selectedCategory,
        group: 0,
        frequency: 1,
        visible: true
      };
      nodes.push(categoryNode);
      nodeMap.set(selectedCategory, categoryNode);
    } else {
      categorySet.forEach(category => {
        const categoryNode = {
          id: category,
          type: 'category',
          name: category,
          group: 0,
          frequency: 1,
          visible: true
        };
        nodes.push(categoryNode);
        nodeMap.set(category, categoryNode);
      });
    }

    // 创建产地节点
    locationStats.forEach((locationInfo, location) => {
      const subcategoryCount = locationInfo.subcategories.size;
      const locationNode = {
        id: location,
        type: 'location',
        name: location,
        group: 1,
        frequency: subcategoryCount,
        subcategories: locationInfo.subcategories,
        categories: Array.from(locationInfo.categories),
        visible: true,
        expanded: false // 是否已展开物产小类
      };
      nodes.push(locationNode);
      nodeMap.set(location, locationNode);
      
      // 连接物产大类到产地
      locationInfo.categories.forEach(category => {
        if (nodeMap.has(category) && (!selectedCategory || category === selectedCategory)) {
          links.push({
            source: category,
            target: location,
            type: 'category-location'
          });
        }
      });
    });

    // 创建物产小类节点（初始隐藏）
    subcategoryStats.forEach((stats, subcategory) => {
      const subcategoryNode = {
        id: subcategory,
        type: 'subcategory',
        name: subcategory,
        group: 2,
        frequency: stats.frequency,
        locations: Array.from(stats.locations),
        categories: Array.from(stats.categories),
        visible: false, // 初始隐藏
        activatedBy: new Set() // 记录哪些产地激活了这个物产小类
      };
      nodes.push(subcategoryNode);
      nodeMap.set(subcategory, subcategoryNode);
    });

    return { 
      nodes, 
      links, 
      locationStats, 
      subcategoryStats 
    };
  };

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/problem3/物产数据_按朝代排序.csv');
        const csvText = await response.text();
        const rawData = d3.csvParse(csvText);
        
        // 计算全局地名统计
        const globalStats = calculateGlobalLocationStats(rawData);
        setLocationStats(globalStats);
        
        // 处理当前朝代的数据
        const processedData = processData(rawData, dynasty, category);
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
  }, [dynasty, category]);

  // 绘制力导向图和柱状图
  useEffect(() => {
    if (!data || !locationStats || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 根据是否内嵌调整尺寸，为柱状图预留空间
    const width = isEmbedded ? 600 : 800;
    const networkHeight = isEmbedded ? 400 : 500; // 力导向图高度，增加100px
    const chartHeight = isEmbedded ? 150 : 250; // 柱状图高度
    const totalHeight = networkHeight + chartHeight + 60; // 总高度，减少预留间距从100到60
    const margin = { top: isEmbedded ? 20 : 30, right: 10, bottom: 40, left: 10 }; // 进一步减小所有边距

    svg.attr('width', '100%').attr('height', '100%')
       .attr('viewBox', `0 0 ${width} ${totalHeight}`)
       .attr('preserveAspectRatio', 'xMidYMid meet');

    // 创建渐变定义
    const defs = svg.append('defs');
    
    // 创建物产大类连接的渐变
    const gradient = defs.append('linearGradient')
      .attr('id', 'category-location-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#a0947b') // 柔和的灰褐色
      .attr('stop-opacity', 0.8);
      
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#b8ab94') // 更浅的米灰色
      .attr('stop-opacity', 0.6);

    // 创建阴影滤镜
    const filter = defs.append('filter')
      .attr('id', 'connection-shadow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    filter.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', 1);

    filter.append('feOffset')
      .attr('dx', 1)
      .attr('dy', 1)
      .attr('result', 'offset');

    // 创建力导向图容器
    const networkContainer = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerNetworkHeight = networkHeight - margin.top - margin.bottom;

    // 维护当前可见的节点和连接
    let currentNodes = data.nodes.filter(d => d.visible);
    let currentLinks = data.links.filter(d => {
      // 处理 D3 可能将 source/target 转换为对象引用的情况
      const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
      const targetId = typeof d.target === 'object' ? d.target.id : d.target;
      
      const sourceNode = data.nodes.find(n => n.id === sourceId);
      const targetNode = data.nodes.find(n => n.id === targetId);
      return sourceNode?.visible && targetNode?.visible;
    });

    // 颜色比例尺
    const colorScale = d3.scaleOrdinal()
      .domain(['category', 'location', 'subcategory'])
      .range(['#8b4513', '#c5aeb7', '#beb6a9']); // 物产大类-深棕色，产地-暖粉灰，物产小类-暖米灰

    // 计算节点半径的比例尺
    const maxFrequency = d3.max(data.nodes, d => d.frequency || 1);
    const radiusScale = d3.scaleSqrt()
      .domain([1, maxFrequency])
      .range([8, 20]); // 最小8px，最大20px

    // 节点半径计算函数
    const getNodeRadius = (d) => {
      if (d.type === 'category') return 35; // 物产大类固定为最大
      if (d.type === 'location') return radiusScale(d.frequency); // 产地按包含的物产小类数量
      return 10; // 物产小类固定为较小
    };

    // 创建力模拟
    const simulation = d3.forceSimulation(currentNodes)
      .force('link', d3.forceLink(currentLinks).id(d => d.id)
        .distance(d => {
          if (d.type === 'category-location') return 100; // 物产大类到产地的距离，缩短至100
          if (d.type === 'location-subcategory') return 80; // 产地到物产小类的距离
          return 60;
        })
        .strength(0.3) // 减小连接弹力强度，默认为1
      )
      .force('charge', d3.forceManyBody().strength(d => {
        if (d.type === 'category') return -80; // 物产大类排斥力，从-200减小到-80
        if (d.type === 'location') return -40; // 产地排斥力，从-100减小到-40
        return -20; // 物产小类排斥力，从-50减小到-20
      }))
      .force('center', d3.forceCenter(innerWidth / 2, innerNetworkHeight / 2))
      .force('collision', d3.forceCollide().radius(d => getNodeRadius(d) + 3)) // 减小碰撞检测距离
      .alpha(0.5) // 减小初始能量，默认为1
      .alphaDecay(0.02); // 减慢能量衰减，默认为0.0228

    // 创建连接线和节点的容器组
    const linksGroup = networkContainer.append('g').attr('class', 'links');
    const nodesGroup = networkContainer.append('g').attr('class', 'nodes');
    const labelsGroup = networkContainer.append('g').attr('class', 'labels');

    // 更新函数：重新绘制节点和连接
    const updateGraph = () => {
      // 更新当前可见的节点和连接
      currentNodes = data.nodes.filter(d => d.visible);
      currentLinks = data.links.filter(d => {
        // 处理 D3 可能将 source/target 转换为对象引用的情况
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        
        const sourceNode = data.nodes.find(n => n.id === sourceId);
        const targetNode = data.nodes.find(n => n.id === targetId);
        return sourceNode?.visible && targetNode?.visible;
      });

      // 更新连接线
      const links = linksGroup.selectAll('line')
        .data(currentLinks, d => `${d.source.id || d.source}-${d.target.id || d.target}`);
      
      links.exit().remove();
      
      links.enter()
        .append('line')
        .merge(links)
        .attr('stroke', d => {
          if (d.type === 'category-location') return 'url(#category-location-gradient)'; // 使用渐变
          if (d.type === 'location-subcategory') return '#999'; // 产地到物产小类用灰色
          return '#999';
        })
        .attr('stroke-opacity', d => {
          if (d.type === 'category-location') return 0.6; // 更柔和的透明度
          return 0.5;
        })
        .attr('stroke-width', d => {
          if (d.type === 'category-location') return 3; // 适中的粗细
          if (d.type === 'location-subcategory') return 1.5;
          return 1;
        })
        .attr('stroke-linecap', 'round') // 圆角线帽
        .attr('stroke-dasharray', d => {
          if (d.type === 'category-location') return 'none'; // 实线
          return 'none';
        })
        .attr('filter', d => {
          if (d.type === 'category-location') return 'url(#connection-shadow)'; // 添加阴影
          return 'none';
        });

      // 更新节点
      const nodes = nodesGroup.selectAll('circle')
        .data(currentNodes, d => d.id);
      
      nodes.exit().remove();
      
      const newNodes = nodes.enter()
        .append('circle')
        .attr('r', d => getNodeRadius(d))
      .attr('fill', d => colorScale(d.type))
      .attr('stroke', '#fff')
        .attr('stroke-width', d => d.type === 'category' ? 3 : 2)
      .style('cursor', 'pointer');

      const allNodes = newNodes.merge(nodes);

      // 更新标签
      const labels = labelsGroup.selectAll('text')
        .data(currentNodes, d => d.id);
      
      labels.exit().remove();
      
      const newLabels = labels.enter()
        .append('text')
      .attr('font-family', "'Noto Serif SC', serif")
        .attr('text-anchor', 'middle')
        .attr('fill', '#2d2520')
        .style('pointer-events', 'none');

      const allLabels = newLabels.merge(labels)
        .text(d => {
          if (d.type === 'location') {
            const expandedIndicator = d.expanded ? '▼' : '▶';
            if (d.frequency > 1) {
              return `${expandedIndicator}${d.name}(${d.frequency})`;
            }
            return `${expandedIndicator}${d.name}`;
          }
          return d.name;
        })
      .attr('font-size', d => {
          if (d.type === 'category') return '18px';
        if (d.type === 'location') return '14px';
        return '12px';
      })
        .attr('font-weight', d => d.type === 'category' ? 'bold' : 'normal')
      .attr('dy', d => {
          if (d.type === 'category') return 5;
        if (d.type === 'location') return 4;
        return 3;
        });

      // 更新力模拟
      simulation.nodes(currentNodes);
      simulation.force('link').links(currentLinks);
      simulation.alpha(0.2).restart(); // 减小重启时的能量

      return { links: linksGroup.selectAll('line'), nodes: allNodes, labels: allLabels };
    };

    // 初始绘制
    let { links, nodes, labels } = updateGraph();

    // 点击产地节点展开/折叠物产小类
    const toggleLocationSubcategories = (locationNode) => {
      if (locationNode.type !== 'location') return;
      
      if (locationNode.expanded) {
        // 折叠：从物产小类节点的activatedBy中移除该产地
        locationNode.subcategories.forEach((frequency, subcategoryName) => {
          const subcategoryNode = data.nodes.find(n => n.id === subcategoryName);
          if (subcategoryNode) {
            subcategoryNode.activatedBy.delete(locationNode.id);
            // 如果没有产地激活该物产小类，则隐藏它
            if (subcategoryNode.activatedBy.size === 0) {
              subcategoryNode.visible = false;
            }
          }
        });
        
        // 移除该产地到物产小类的连接
        data.links = data.links.filter(link => {
          if (link.type === 'location-subcategory' && link.source === locationNode.id) {
            return false;
          }
          return true;
        });
        
        locationNode.expanded = false;
      } else {
        // 展开：将该产地添加到物产小类节点的activatedBy中
        locationNode.subcategories.forEach((frequency, subcategoryName) => {
          const subcategoryNode = data.nodes.find(n => n.id === subcategoryName);
          if (subcategoryNode) {
            subcategoryNode.activatedBy.add(locationNode.id);
            // 显示物产小类节点
            subcategoryNode.visible = true;
          }
        });
        
        // 添加产地到物产小类的连接
        locationNode.subcategories.forEach((frequency, subcategoryName) => {
          const subcategoryNode = data.nodes.find(n => n.id === subcategoryName);
          if (subcategoryNode && subcategoryNode.visible) {
            // 检查是否已存在连接，避免重复
            const existingLink = data.links.find(link => 
              link.type === 'location-subcategory' && 
              link.source === locationNode.id && 
              link.target === subcategoryName
            );
            if (!existingLink) {
              data.links.push({
                source: locationNode.id,
                target: subcategoryName,
                type: 'location-subcategory'
              });
            }
          }
        });
        
        locationNode.expanded = true;
      }
      
      // 重新绘制图形
      const updated = updateGraph();
      links = updated.links;
      nodes = updated.nodes;
      labels = updated.labels;
      
      // 重新绑定事件
      bindNodeEvents();
    };

    // 绑定节点事件
    const bindNodeEvents = () => {
      // 点击事件
      nodes.on('click', function(event, d) {
        if (d.type === 'location') {
          event.stopPropagation();
          toggleLocationSubcategories(d);
        }
      });

      // 悬浮事件
      nodes
        .on('mouseover', function(event, d) {
          d3.select(this)
            .attr('stroke', '#333')
            .attr('stroke-width', 3);
          
          // 高亮相关连接
          links
            .attr('stroke', link => {
              if (link.source.id === d.id || link.target.id === d.id) {
                if (link.type === 'category-location') return '#8b7d6b'; // 高亮时用更深的灰褐色
                return '#666'; // 其他连接高亮时用深灰
              }
              if (link.type === 'category-location') return 'url(#category-location-gradient)';
              return '#999';
            })
                         .attr('stroke-opacity', link => {
               if (link.source.id === d.id || link.target.id === d.id) {
                 return 0.8; // 高亮时适度不透明
               }
               if (link.type === 'category-location') return 0.6;
               return 0.5;
             })
            .attr('stroke-width', link => 
              link.source.id === d.id || link.target.id === d.id ? 
                (link.type === 'category-location' ? 4 : 3) : 
                (link.type === 'category-location' ? 3 : 
                 link.type === 'location-subcategory' ? 1.5 : 1)
            );
        })
        .on('mouseout', function(event, d) {
          d3.select(this)
            .attr('stroke', '#fff')
            .attr('stroke-width', d => d.type === 'category' ? 3 : 2);
          
          // 恢复连接样式
          links
            .attr('stroke', d => {
              if (d.type === 'category-location') return 'url(#category-location-gradient)';
              return '#999';
            })
            .attr('stroke-opacity', d => {
              if (d.type === 'category-location') return 0.6;
              return 0.5;
            })
            .attr('stroke-width', d => {
              if (d.type === 'category-location') return 3;
              if (d.type === 'location-subcategory') return 1.5;
              return 1;
            });
        });

      // 拖拽功能
      nodes.call(drag);
    };

    // 拖拽功能定义
    const drag = d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.1).restart(); // 减小拖拽时的目标能量
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

    // 初始绑定事件
    bindNodeEvents();

    // 更新位置
    simulation.on('tick', () => {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodes
        .attr('cx', d => Math.max(15, Math.min(innerWidth - 15, d.x)))
        .attr('cy', d => Math.max(15, Math.min(innerNetworkHeight - 15, d.y)));

      labels
        .attr('x', d => Math.max(15, Math.min(innerWidth - 15, d.x)))
        .attr('y', d => Math.max(15, Math.min(innerNetworkHeight - 15, d.y)));
    });

    // 添加力导向图标题
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', isEmbedded ? 15 : 20)
      .attr('text-anchor', 'middle')
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', isEmbedded ? '18px' : '20px')
      .attr('font-weight', 'bold')
      .attr('fill', '#2d2520')
      .text(`${dynasty}${category ? ` - ${category}` : ''} - 物产分布网络图`);

    // ========== 绘制柱状图 ==========
    
    // 柱状图容器
    const chartContainer = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${networkHeight + 20})`);

    // 柱状图尺寸
    const chartInnerHeight = chartHeight - 60; // 减少预留轴标签空间从80到60
    
    // 创建比例尺
    const xScale = d3.scaleBand()
      .domain(locationStats.map(d => d.name))
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(locationStats, d => d.frequency)])
      .range([chartInnerHeight, 0]);

    // 绘制柱子
    chartContainer.selectAll('.bar')
      .data(locationStats)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.name))
      .attr('y', d => yScale(d.frequency))
      .attr('width', xScale.bandwidth())
      .attr('height', d => Math.max(0, chartInnerHeight - yScale(d.frequency)))
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', '#a0947b')
      .attr('fill-opacity', 0.7)
      .attr('stroke', '#8b7d6b')
      .attr('stroke-width', 1);

    // 添加数值标签
    chartContainer.selectAll('.bar-label')
      .data(locationStats)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', d => xScale(d.name) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.frequency) - 5)
      .attr('text-anchor', 'middle')
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', '12px')
      .attr('fill', '#2d2520')
      .text(d => d.frequency);

    // 添加X轴
    const xAxis = d3.axisBottom(xScale);
    const xAxisGroup = chartContainer.append('g')
      .attr('transform', `translate(0, ${chartInnerHeight})`)
      .call(xAxis);
    
    // 设置X轴样式
    xAxisGroup.select('.domain')
      .attr('stroke', '#8b7d6b')
      .attr('stroke-width', 2);
    
    xAxisGroup.selectAll('.tick line')
      .attr('stroke', '#a0947b')
      .attr('stroke-width', 1);
    
    xAxisGroup.selectAll('text')
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', '12px')
      .attr('fill', '#6b5d4f')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    // 添加柱状图标题
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', networkHeight + 15)
      .attr('text-anchor', 'middle')
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', isEmbedded ? '16px' : '18px')
      .attr('font-weight', 'bold')
      .attr('fill', '#2d2520')
      .text('历代地名出现频率统计（前30位）');

    // 添加图例
    const legend = svg.append('g')
      .attr('transform', `translate(${width - (isEmbedded ? 120 : 150)}, ${isEmbedded ? 30 : 40})`);

    const legendData = [
      { type: 'category', label: '物产大类', color: colorScale('category') },
      { type: 'location', label: '产地（▶点击展开/▼折叠）', color: colorScale('location') },
      { type: 'subcategory', label: '物产小类（可多连接）', color: colorScale('subcategory') }
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
      .attr('font-size', isEmbedded ? '13px' : '14px')
      .attr('fill', '#2d2520')
      .text(d => d.label);

  }, [data, locationStats, isEmbedded]);

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

export default ProductDetailView; 