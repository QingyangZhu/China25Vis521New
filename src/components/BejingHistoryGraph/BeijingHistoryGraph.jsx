import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './BeijingHistoryGraph.css';
import HistoricalDataClusterAnalysis from '../HistoricalDataClusterAnalysis';

const BeijingHistoryGraph = () => {
  const svgRef = useRef(null);
  const detailsPanelRef = useRef(null);
  const legendPanelRef = useRef(null);
  const timeSliderRef = useRef(null);
  const gRef = useRef(null);
  const [showClusterAnalysis, setShowClusterAnalysis] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  // 全局变量
  let validNodes = [];
  let validLinks = [];
  let linksWithNodes = [];
  let nodeElements;
  let linkElements;
  let labelElements;
  let simulation;

  // 节点类型可见性状态
  const nodeTypeVisibility = {
    groups: {},
    eventTypes: {}
  };

  // 预定义的节点类型
  const predefinedNodeTypes = {
    groups: ['period', 'person'],
    eventTypes: ['灾害', '经济', '文化', '军事', '人物', '社会', '政治']
  };

  // 预定义的边标签
  const predefinedEdgeLabels = [
    '事件归属', '人物参与', '影响关系', '时空关系',
    '时间演进', '时期关联', '因果关系', '人物关系',
    '政权更替'
  ];

  // 颜色映射
  const typeColorMap = {
    '灾害': '#D49C6A',
    '经济': '#A0C1B8',
    '文化': '#B8A48E',
    '军事': '#C6A37C',
    '人物': '#BD9D75',
    '社会': '#B09F8B',
    '政治': '#C8B8A8',
    '政权更替': '#B5653A',
    '时间演进': '#8A9B76',
    '时期关联': '#7D9182',
    '事件归属': '#8D7866',
    '因果关系': '#9D8D75',
    '治理': '#8E988C',
    '时间相近': '#98A088',
    '继承': '#A77E58',
    '联合': '#A88F7A',
    '对抗': '#AD6C54'
  };

  const groupColorMap = {
    'period': '#D2B48C',
    'person': '#D6C8A4',
    'event': '#B8A48E'
  };

  // 创建图形元素
  const createGraphElements = (g) => {
    // 创建边元素
    linkElements = g.append("g").attr("class", "links")
      .selectAll("line")
      .data(linksWithNodes)
      .join("line")
      .attr("stroke", d => typeColorMap[d.label] || '#999')
      .attr("stroke-width", d => d.label === '政权更替' ? 2.5 : 1.5)
      .attr("stroke-dasharray", d => d.dashes ? "5,5" : "0,0");

    // 创建节点元素
    nodeElements = g.append("g").attr("class", "nodes")
      .selectAll("circle")
      .data(validNodes)
      .join("circle")
      .attr("r", d => {
        if (d.group === 'period') return 30;
        if (d.group === 'event') return 15;
        if (d.group === 'person') return 10;
        return 5;
      })
      .attr("fill", d => {
        if (d.group === 'period') return groupColorMap['period'];
        if (d.group === 'person') return groupColorMap['person'];
        if (d.group === 'event') return typeColorMap[d.type] || groupColorMap['event'];
        return '#cccccc';
      })
      .attr("stroke", '#c0b2a1')
      .attr("opacity", 1.0);

    // 创建标签元素
    labelElements = g.append("g").attr("class", "labels")
      .selectAll("text")
      .data(validNodes)
      .join("text")
      .attr("dy", 3)
      .text(d => d.label)
      .attr('class', d => (d.group === 'event' || d.group === 'person') ? 'event-label' : null);

    // 绑定节点和标签事件
    updateNodeEvents();

    // 更新力导向模拟
    simulation
      .nodes(validNodes)
      .force("link").links(linksWithNodes);

    simulation.on("tick", () => {
      linkElements
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      nodeElements
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      labelElements
        .attr("x", d => d.x)
        .attr("y", d => d.y + (d.group === 'period' ? 25 : 15));
    });
  };

  // 显示节点详情
  const displayNodeDetails = (nodeData) => {
    if (!nodeData || !detailsPanelRef.current) return;
    
    // 创建详细信息面板内容
    let content = '';
    
    // 添加标题
    content += `<div class="node-details-header">
      <h3>${nodeData.label}</h3>
      ${nodeData.year ? `<span class="year-tag">${nodeData.year}年</span>` : ''}
    </div>`;

    // 添加节点类型信息
    content += `<div class="node-type-info">
      <span class="type-tag">${nodeData.group === 'period' ? '历史时期' : 
        nodeData.group === 'person' ? '人物' : '事件'}</span>
      ${nodeData.type ? `<span class="subtype-tag">${nodeData.type}</span>` : ''}
    </div>`;

    // 添加描述信息
    if (nodeData.description) {
      content += `<div class="node-description">
        <p>${nodeData.description}</p>
      </div>`;
    }

    // 添加关联关系
    content += '<div class="node-relations">';
    const relatedEdges = validLinks.filter(edge =>
      edge.from === nodeData.id || edge.to === nodeData.id);
    
    if (relatedEdges.length > 0) {
      content += '<h4>关联关系</h4><ul>';
      relatedEdges.forEach(edge => {
        const otherNodeId = edge.from === nodeData.id ? edge.to : edge.from;
        const otherNodeData = validNodes.find(n => n.id === otherNodeId);
        if (otherNodeData) {
          content += `
            <li>
              <span class="relation-type">${edge.label}</span>
              <span class="related-node">${otherNodeData.label}</span>
              ${otherNodeData.year ? `<span class="year-tag">${otherNodeData.year}年</span>` : ''}
            </li>`;
        }
      });
      content += '</ul>';
    } else {
      content += '<p class="no-relations">暂无关联关系</p>';
    }
    content += '</div>';

    // 更新面板内容
    detailsPanelRef.current.innerHTML = content;
    detailsPanelRef.current.classList.add('visible');

    // 高亮相关节点和边
    highlightRelatedNodes(nodeData);
  };

  // 高亮相关节点和边
  const highlightRelatedNodes = (nodeData) => {
    // 重置所有节点和边的样式
    nodeElements
      .style("opacity", 0.3)
      .style("stroke-width", 1);
    
    linkElements
      .style("opacity", 0.1)
      .style("stroke-width", 1);

    // 高亮当前节点
    nodeElements.filter(d => d.id === nodeData.id)
      .style("opacity", 1)
      .style("stroke-width", 2);

    // 高亮相关节点和边
    const relatedEdges = validLinks.filter(edge =>
      edge.from === nodeData.id || edge.to === nodeData.id);
    
    relatedEdges.forEach(edge => {
      const otherNodeId = edge.from === nodeData.id ? edge.to : edge.from;
      
      // 高亮相关节点
      nodeElements.filter(d => d.id === otherNodeId)
        .style("opacity", 1)
        .style("stroke-width", 2);
      
      // 高亮相关边
      linkElements.filter(d => 
        (d.source.id === nodeData.id && d.target.id === otherNodeId) ||
        (d.source.id === otherNodeId && d.target.id === nodeData.id)
      )
        .style("opacity", 1)
        .style("stroke-width", 2);
    });
  };

  // 封装节点和标签事件绑定
  function updateNodeEvents() {
    let dragMoved = false;
    if (nodeElements) {
      nodeElements
        .on("mouseover", function(event, d) {
          // 显示事件标签
          gRef.current.append("text")
            .attr("class", "event-label")
            .attr("x", d.x)
            .attr("y", d.y - 20)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("fill", "#666")
            .text(d.label);

          // 如果是事件节点，显示时期标签
          if (d.group === 'event') {
            gRef.current.append("text")
              .attr("class", "period-label")
              .attr("x", d.x)
              .attr("y", d.y - 35)
              .attr("text-anchor", "middle")
              .style("font-size", "12px")
              .style("fill", "#666")
              .text(d.period || '');
          }

          // 高亮当前节点
          d3.select(this)
            .transition()
            .duration(200)
            .attr("r", d => {
              if (d.group === 'period') return 35;
              if (d.group === 'event') return 20;
              if (d.group === 'person') return 15;
              return 8;
            })
            .style("fill", d => {
              if (d.group === 'period') return groupColorMap['period'];
              if (d.group === 'person') return groupColorMap['person'];
              if (d.group === 'event') return typeColorMap[d.type] || groupColorMap['event'];
              return '#cccccc';
            });
        })
        .on("mouseout", function(event, d) {
          // 移除所有标签
          gRef.current.selectAll(".event-label, .period-label").remove();
          
          // 恢复节点大小（如果不是选中的节点）
          if (selectedNode !== d) {
            d3.select(this)
              .transition()
              .duration(200)
              .attr("r", d => {
                if (d.group === 'period') return 30;
                if (d.group === 'event') return 15;
                if (d.group === 'person') return 10;
                return 5;
              })
              .style("fill", d => {
                if (d.group === 'period') return groupColorMap['period'];
                if (d.group === 'person') return groupColorMap['person'];
                if (d.group === 'event') return typeColorMap[d.type] || groupColorMap['event'];
                return '#cccccc';
              });
          }
        })
        .on("click", function(event, d) {
          if (dragMoved) return;
          event.stopPropagation();
          setSelectedNode(d);
          displayNodeDetails(d);
        })
        .call(
          d3.drag()
            .on("start", (event, d) => {
              dragMoved = false;
              dragstarted(event, d);
            })
            .on("drag", (event, d) => {
              dragMoved = true;
              dragged(event, d);
            })
            .on("end", (event, d) => {
              dragended(event, d);
            })
        );
    }
    if (labelElements) {
      labelElements
        .on("mouseover", function(event, d) {
          // 显示事件标签
          gRef.current.append("text")
            .attr("class", "event-label")
            .attr("x", d.x)
            .attr("y", d.y - 20)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("fill", "#666")
            .text(d.label);

          // 如果是事件节点，显示时期标签
          if (d.group === 'event') {
            gRef.current.append("text")
              .attr("class", "period-label")
              .attr("x", d.x)
              .attr("y", d.y - 35)
              .attr("text-anchor", "middle")
              .style("font-size", "12px")
              .style("fill", "#666")
              .text(d.period || '');
          }
        })
        .on("mouseout", function() {
          // 移除所有标签
          gRef.current.selectAll(".event-label, .period-label").remove();
        })
        .on("click", function(event, d) {
          event.stopPropagation();
          setSelectedNode(d);
          displayNodeDetails(d);
        });
    }
  }

  // 拖拽函数
  const dragstarted = (event, d) => {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    const transform = d3.zoomTransform(svgRef.current);
    d.fx = transform.invertX(event.x);
    d.fy = transform.invertY(event.y);
  };

  const dragged = (event, d) => {
    const transform = d3.zoomTransform(svgRef.current);
    d.fx = transform.invertX(event.x);
    d.fy = transform.invertY(event.y);
  };

  const dragended = (event, d) => {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  };

  // 设置时间轴
  const setupTimeSlider = () => {
    const timeSlider = d3.select(timeSliderRef.current);
    const currentYearDisplay = d3.select("#currentYearDisplay");
    const years = validNodes
      .map(n => n.year)
      .filter(year => year != null && !isNaN(year));
    let minYear = Infinity;
    let maxYear = -Infinity;
    if (years.length > 0) {
      minYear = d3.min(years);
      maxYear = d3.max(years);
    } else {
      timeSlider.attr("disabled", true);
      currentYearDisplay.text("无时间数据");
      return;
    }
    timeSlider
      .attr("min", minYear)
      .attr("max", maxYear)
      .property("value", minYear);
    currentYearDisplay.text(minYear + "年");
    timeSlider.on("input", function() {
      const currentYear = parseInt(this.value);
      currentYearDisplay.text(currentYear + "年");
      d3.selectAll(".nodes circle, .links line, .labels text")
        .transition()
        .duration(200)
        .style("opacity", function(d) {
          if (d.group === 'event' || d.group === 'period') {
            return d.year <= currentYear ? 1 : 0;
          }
          return 1;
        });
      updateGraphVisibility(currentYear);
    });
  };

  // 设置缩放和平移
  const setupZoomAndPan = (g) => {
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    d3.select(svgRef.current).call(zoom);
    d3.select(svgRef.current).on("click", function(event) {
      if (event.target === svgRef.current) {
        if (detailsPanelRef.current) {
          detailsPanelRef.current.classList.remove('visible');
        }
      }
    });
    if (detailsPanelRef.current) {
      detailsPanelRef.current.addEventListener('click', function(event) {
        event.stopPropagation();
      });
    }
  };

  // 生成图例
  const generateLegend = () => {
    if (!legendPanelRef.current) return;
    legendPanelRef.current.innerHTML = '';
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = `
      <h4>图例</h4>
      <p><strong>节点类型:</strong></p>
    `;
    const nodeLegend = document.createElement('div');
    nodeLegend.className = 'legend-group';
    predefinedNodeTypes.groups.forEach(type => {
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      const colorBox = document.createElement('span');
      colorBox.className = 'legend-color';
      const color = groupColorMap[type] || '#999';
      colorBox.style.backgroundColor = color;
      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = type === 'period' ? '历史时期' : '人物';
      legendItem.appendChild(colorBox);
      legendItem.appendChild(label);
      nodeLegend.appendChild(legendItem);
    });
    legendDiv.appendChild(nodeLegend);
    const separator = document.createElement('p');
    separator.innerHTML = '<strong>关系类型:</strong>';
    separator.style.marginTop = '15px';
    legendDiv.appendChild(separator);
    const linkLegend = document.createElement('div');
    linkLegend.className = 'legend-group';
    predefinedEdgeLabels.forEach(label => {
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      let lineSpan;
      const color = typeColorMap[label] || '#999';
      if (label === '时间演进' || label === '时期关联') {
        lineSpan = document.createElement('span');
        lineSpan.className = 'legend-line dashed';
        lineSpan.style.background = `repeating-linear-gradient(to right, ${color} 0px, ${color} 4px, transparent 4px, transparent 8px)`;
        lineSpan.style.height = '2px';
      } else if (label === '政权更替') {
        lineSpan = document.createElement('span');
        lineSpan.className = 'legend-line 政权更替';
        lineSpan.style.backgroundColor = color;
        lineSpan.style.height = '3px';
      } else {
        lineSpan = document.createElement('span');
        lineSpan.className = 'legend-line';
        lineSpan.style.backgroundColor = color;
        lineSpan.style.height = '2px';
      }
      lineSpan.style.width = '20px';
      lineSpan.style.marginRight = '8px';
      lineSpan.style.display = 'inline-block';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'legend-label';
      labelSpan.textContent = label;
      legendItem.appendChild(lineSpan);
      legendItem.appendChild(labelSpan);
      linkLegend.appendChild(legendItem);
    });
    legendDiv.appendChild(linkLegend);
    legendPanelRef.current.appendChild(legendDiv);
    legendPanelRef.current.style.padding = '12px';
    legendPanelRef.current.style.display = 'block';
    legendPanelRef.current.style.visibility = 'visible';
    legendPanelRef.current.style.opacity = '1';
  };

  // 创建过滤按钮
  const createFilterButtons = () => {
    const buttonContainer = d3.select("#node-filter-buttons");
    buttonContainer.html('');
    const allButton = buttonContainer.append('button')
      .attr('class', 'filter-button')
      .attr('data-type', '全部')
      .attr('title', '显示全部')
      .on('click', () => toggleAllNodeTypes(true));
    allButton.append('i')
      .attr('class', 'fas fa-globe');
    allButton.append('text')
      .text('全部');
    const groupContainer = buttonContainer.append('div')
      .attr('class', 'filter-group');
    groupContainer.append('span')
      .attr('class', 'controls-title')
      .text('分组：');
    predefinedNodeTypes.groups.forEach(type => {
      const buttonText = type === 'period' ? '历史时期' : type === 'person' ? '人物' : type;
      const button = groupContainer.append('button')
        .attr('class', 'filter-button')
        .attr('data-type', type)
        .attr('title', buttonText)
        .on('click', function() {
          toggleGroupType(type, d3.select(this));
        });
      button.append('i')
        .attr('class', type === 'period' ? 'fas fa-clock' : 'fas fa-user');
      button.classed('active', nodeTypeVisibility.groups[type]);
    });
    const eventContainer = buttonContainer.append('div')
      .attr('class', 'filter-group');
    eventContainer.append('span')
      .attr('class', 'controls-title')
      .text('事件：');
    const eventIcons = {
      '灾害': 'fa-house-crack',
      '经济': 'fa-coins',
      '文化': 'fa-book',
      '军事': 'fa-shield',
      '人物': 'fa-users',
      '社会': 'fa-city',
      '政治': 'fa-landmark'
    };
    predefinedNodeTypes.eventTypes.forEach(type => {
      const button = eventContainer.append('button')
        .attr('class', 'filter-button')
        .attr('data-type', type)
        .attr('title', type)
        .on('click', function() {
          toggleEventType(type, d3.select(this));
        });
      button.append('i')
        .attr('class', `fas ${eventIcons[type]}`);
      button.classed('active', nodeTypeVisibility.eventTypes[type]);
    });
  };

  // 切换分组类型
  const toggleGroupType = (type, buttonElement) => {
    nodeTypeVisibility.groups[type] = !nodeTypeVisibility.groups[type];
    buttonElement.classed('active', nodeTypeVisibility.groups[type]);
    updateGraphVisibility();
  };

  // 切换事件类型
  const toggleEventType = (type, buttonElement) => {
    nodeTypeVisibility.eventTypes[type] = !nodeTypeVisibility.eventTypes[type];
    buttonElement.classed('active', nodeTypeVisibility.eventTypes[type]);
    updateGraphVisibility();
  };

  // 切换所有节点类型
  const toggleAllNodeTypes = (show) => {
    predefinedNodeTypes.groups.forEach(type => {
      nodeTypeVisibility.groups[type] = show;
      const button = d3.select(`button[data-type="${type}"]`);
      button.classed('active', show);
    });
    predefinedNodeTypes.eventTypes.forEach(type => {
      nodeTypeVisibility.eventTypes[type] = show;
      const button = d3.select(`button[data-type="${type}"]`);
      button.classed('active', show);
    });
    updateGraphVisibility();
  };

  // 更新图谱可见性
  const updateGraphVisibility = (currentYear) => {
    currentYear = currentYear || parseInt(d3.select(timeSliderRef.current).property("value"));
    const visibleNodeIds = new Set();
    const visibleEventIds = new Set();
    const visiblePeriodIds = new Set();
    validNodes.forEach(node => {
      if (node.group === 'period') {
        if (node.year !== undefined && node.year !== null &&
            node.year <= currentYear &&
            nodeTypeVisibility.groups['period']) {
          visibleNodeIds.add(node.id);
          visiblePeriodIds.add(node.id);
        }
      } else if (node.group === 'event') {
        if (node.year !== undefined && node.year !== null &&
            node.year <= currentYear &&
            nodeTypeVisibility.eventTypes[node.type]) {
          visibleNodeIds.add(node.id);
          visibleEventIds.add(node.id);
        }
      }
    });
    validNodes.forEach(node => {
      if (node.group === 'person') {
        if (nodeTypeVisibility.groups['person']) {
          const connectedEdges = validLinks.filter(edge =>
            edge.from === node.id || edge.to === node.id);
          let isConnectedToVisibleEvent = false;
          for (const edge of connectedEdges) {
            const otherNodeId = edge.from === node.id ? edge.to : edge.from;
            if (visibleEventIds.has(otherNodeId)) {
              isConnectedToVisibleEvent = true;
              break;
            }
          }
          if (isConnectedToVisibleEvent) {
            visibleNodeIds.add(node.id);
          }
        }
      }
    });
    if (nodeElements) {
      nodeElements.style("display", d => visibleNodeIds.has(d.id) ? "block" : "none");
    }
    if (labelElements) {
      labelElements.style("display", d => {
        if (!visibleNodeIds.has(d.id)) {
          return "none";
        }
        if (d.group === 'period') {
          return "block";
        }
        return "none";
      });
    }
    if (linkElements) {
      linkElements.style("display", d =>
        visibleNodeIds.has(d.source.id) && visibleNodeIds.has(d.target.id) ? "block" : "none"
      );
    }
    if (simulation) {
      const visibleNodesData = validNodes.filter(d => visibleNodeIds.has(d.id));
      const visibleLinksData = linksWithNodes.filter(d =>
        visibleNodeIds.has(d.source.id) && visibleNodeIds.has(d.target.id)
      );
      simulation.nodes(visibleNodesData);
      simulation.force("link").links(visibleLinksData);
      simulation.alpha(0.3).restart();
    }
    // 关键：每次可见性更新后都重新绑定事件
    updateNodeEvents();
  };

  // 加载数据并初始化图形
  useEffect(() => {
    const width = 1000;
    const height = 430;
    const g = d3.select(svgRef.current).append("g");
    gRef.current = g;
    simulation = d3.forceSimulation()
      .force("link", d3.forceLink().id(d => d.id).strength(0.7))
      .force("charge", d3.forceManyBody().strength(-200).distanceMin(40).distanceMax(400))
      .force("center", d3.forceCenter(width / 2, height / 2));
    fetch("data/graph_data1.json")
      .then(response => response.json())
      .then(graph => {
        validNodes = (graph.nodes || []).filter(node => node && node.id);
        const validNodeIds = new Set(validNodes.map(node => node.id));
        validLinks = (graph.edges || []).filter(edge =>
          edge && edge.from && edge.to &&
          validNodeIds.has(edge.from) &&
          validNodeIds.has(edge.to)
        );
        linksWithNodes = validLinks.map(d => ({
          ...d,
          source: validNodes.find(n => n.id === d.from),
          target: validNodes.find(n => n.id === d.to)
        })).filter(link => link && link.source && link.target);
        predefinedNodeTypes.groups.forEach(type => {
          nodeTypeVisibility.groups[type] = true;
        });
        predefinedNodeTypes.eventTypes.forEach(type => {
          nodeTypeVisibility.eventTypes[type] = true;
        });
        createFilterButtons();
        createGraphElements(g);
        setupTimeSlider();
        setupZoomAndPan(g);
        setTimeout(() => {
          generateLegend();
        }, 100);
        updateGraphVisibility();
      })
      .catch(error => {
        g.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .style("fill", "#666")
          .text("数据加载出现错误，但将继续显示可用数据");
      });
    return () => {
      if (simulation) {
        simulation.stop();
      }
      if (gRef.current) {
        gRef.current.remove();
      }
    };
  }, []);

  return (
    <div className="beijing-history-graph">
      <div className="beiheader">
        <h1>北京历史知识图谱</h1>
        <p className="subtitle">探索北京历史事件与人物关系</p>
      </div>
      <div id="top-controls-container">
        <div id="timeline-controls">
          <label htmlFor="timeSlider">时间轴:</label>
          <input
            type="range"
            id="timeSlider"
            ref={timeSliderRef}
          />
          <span id="currentYearDisplay"></span>
        </div>
        <div id="node-filter-buttons"></div>
        <button
          onClick={() => setShowClusterAnalysis(!showClusterAnalysis)}
          style={{
            padding: '6px 12px',
            backgroundColor: showClusterAnalysis ? '#8C6D46' : '#F5F1E4',
            color: showClusterAnalysis ? 'white' : '#8C6D46',
            border: '1px solid #8C6D46',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: "'Noto Serif SC', serif",
            fontSize: '13px',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = showClusterAnalysis ? '#6B5B47' : '#E8E0D0';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = showClusterAnalysis ? '#8C6D46' : '#F5F1E4';
          }}
        >
          <i className={`fas ${showClusterAnalysis ? 'fa-chart-pie' : 'fa-chart-bar'}`}></i>
          {showClusterAnalysis ? '关闭聚类分析' : '聚类分析'}
        </button>
      </div>
      <div id="bottom-content-container" style={{ position: 'relative' }}>
        <div id="graph-container" style={{ 
          width: showClusterAnalysis ? 'calc(100% - 400px)' : '100%',
          transition: 'width 0.3s ease'
        }}>
          <svg
            id="knowledgeGraph"
            ref={svgRef}
            width="1000"
            height="430"
          ></svg>
          <div id="legend-overlay" ref={legendPanelRef}></div>
        </div>
        <div id="detailsPanel" ref={detailsPanelRef}></div>
        {showClusterAnalysis && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '380px',
            height: '100%',
            backgroundColor: 'white',
            borderLeft: '1px solid #DCD1BB',
            boxShadow: '-2px 0 10px rgba(0, 0, 0, 0.1)',
            overflow: 'auto',
            transition: 'all 0.3s ease',
            zIndex: 100
          }}>
            <div style={{
              position: 'relative',
              height: '100%',
              padding: '15px'
            }}>
              <button
                onClick={() => setShowClusterAnalysis(false)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '10px',
                  padding: '4px 8px',
                  backgroundColor: '#F5F1E4',
                  color: '#8C6D46',
                  border: '1px solid #8C6D46',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: "'Noto Serif SC', serif",
                  fontSize: '12px',
                  zIndex: 101,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#E8E0D0';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#F5F1E4';
                }}
              >
                <i className="fas fa-times"></i>
                关闭
              </button>
              <div style={{ marginTop: '30px' }}>
                <HistoricalDataClusterAnalysis />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BeijingHistoryGraph; 