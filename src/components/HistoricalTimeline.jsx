// src/components/HistoricalTimeline.jsx
import React, { useState, useEffect, useRef } from 'react';
import './HistoricalTimeline.css';
import useDynastyStore, { dynastyData } from '../store/dynastyStore';

const HistoricalTimeline = () => {
  // 使用Zustand store
  const { selectedDynasties, toggleDynasty } = useDynastyStore();

  // 多组历史数据 - 代表不同维度的历史信息
  const multipleHistoricalData = [
    // 历史事件记载密度
    {
      id: 'events',
      name: '历史事件',
      color: '#8596b0', // 青灰色
      data: [
        { year: -2000, value: 10 },
        { year: -1500, value: 15 },
        { year: -1000, value: 25 },
        { year: -500, value: 40 },
        { year: -221, value: 70 }, // 秦朝
        { year: -100, value: 60 },
        { year: 0, value: 65 },
        { year: 100, value: 55 },
        { year: 200, value: 45 },
        { year: 300, value: 35 },
        { year: 400, value: 40 },
        { year: 500, value: 50 },
        { year: 600, value: 60 },
        { year: 700, value: 80 }, // 唐朝盛世
        { year: 800, value: 70 },
        { year: 900, value: 50 },
        { year: 1000, value: 65 },
        { year: 1100, value: 55 },
        { year: 1200, value: 60 },
        { year: 1300, value: 65 },
        { year: 1400, value: 70 },
        { year: 1500, value: 80 },
        { year: 1600, value: 85 },
        { year: 1700, value: 75 },
        { year: 1800, value: 90 },
        { year: 1900, value: 100 },
        { year: 1950, value: 110 },
        { year: 2000, value: 120 }
      ]
    },
    // 人口增长趋势
    {
      id: 'population',
      name: '人口趋势',
      color: '#a06e58', // 赭石色
      data: [
        { year: -2000, value: 5 },
        { year: -1000, value: 10 },
        { year: -500, value: 15 },
        { year: 0, value: 25 },
        { year: 200, value: 20 },
        { year: 400, value: 15 },
        { year: 600, value: 20 },
        { year: 800, value: 30 },
        { year: 1000, value: 40 },
        { year: 1200, value: 50 },
        { year: 1400, value: 60 },
        { year: 1600, value: 70 },
        { year: 1700, value: 80 },
        { year: 1800, value: 90 },
        { year: 1900, value: 110 },
        { year: 1950, value: 120 },
        { year: 2000, value: 140 }
      ]
    },
    // 自然灾害频率
    {
      id: 'disasters',
      name: '自然灾害',
      color: '#7d9b8e', // 青瓷色
      data: [
        { year: -1800, value: 15 },
        { year: -1500, value: 20 },
        { year: -1000, value: 25 },
        { year: -500, value: 15 },
        { year: 0, value: 30 },
        { year: 200, value: 40 },
        { year: 400, value: 25 },
        { year: 600, value: 35 },
        { year: 800, value: 45 },
        { year: 1000, value: 30 },
        { year: 1200, value: 40 },
        { year: 1400, value: 55 },
        { year: 1600, value: 40 },
        { year: 1800, value: 50 },
        { year: 1900, value: 35 },
        { year: 2000, value: 40 }
      ]
    }
  ];

  // 计算插值的历史数据点，以获得更平滑的折线图
  const getInterpolatedData = (sourceData) => {
    const result = [];
    const step = 20; // 每20年一个数据点
    
    for (let year = -3000; year <= 2025; year += step) {
      // 找到最近的两个点进行线性插值
      let value = 0;
      const before = sourceData.filter(d => d.year <= year).pop();
      const after = sourceData.find(d => d.year > year);
      
      if (before && after) {
        // 线性插值
        const ratio = (year - before.year) / (after.year - before.year);
        value = before.value + ratio * (after.value - before.value);
      } else if (before) {
        value = before.value;
      } else if (after) {
        value = after.value;
      }
      
      result.push({ year, value });
    }
    
    return result;
  };

  // 时间轴滚动相关状态
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const timelineRef = useRef(null);
  
  // 悬停状态
  const [hoveredYear, setHoveredYear] = useState(null);
  const [hoveredDataset, setHoveredDataset] = useState(null);

  // 定义一些常量用于绘制时间轴
  const MIN_YEAR = -3000; // 展示范围的最小年份
  const MAX_YEAR = 2025; // 展示范围的最大年份
  const YEAR_RANGE = MAX_YEAR - MIN_YEAR;
  const PIXEL_PER_YEAR = 0.8; // 调整每年占用的像素宽度
  const TIMELINE_WIDTH = YEAR_RANGE * PIXEL_PER_YEAR; // 总宽度
  const MAX_BAR_HEIGHT = 40; // 折线图最大高度
  const LEFT_PADDING = 40; // 左侧填充

  // 处理朝代点击事件
  const handleDynastyClick = (dynasty) => {
    toggleDynasty(dynasty.name);
  };

  // 时间轴拖拽处理函数
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - timelineRef.current.offsetLeft);
    setScrollLeft(timelineRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - timelineRef.current.offsetLeft;
    const walk = (x - startX) * 2; // 滚动速度调整
    timelineRef.current.scrollLeft = scrollLeft - walk;
  };

  // 时间轴hover处理
  const handleTimelineHover = (e) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const year = Math.floor((x - LEFT_PADDING) / PIXEL_PER_YEAR) + MIN_YEAR;
      setHoveredYear(year);
    }
  };

  const handleTimelineLeave = () => {
    setHoveredYear(null);
    setHoveredDataset(null);
  };

  // 将年份转换为相对位置（像素）
  const yearToPosition = (year) => {
    return (year - MIN_YEAR) * PIXEL_PER_YEAR + LEFT_PADDING;
  };

  // 计算朝代的宽度（像素）
  const getDynastyWidth = (start, end) => {
    return (end - start) * PIXEL_PER_YEAR;
  };

  // 计算朝代的位置（像素）
  const getDynastyPosition = (start) => {
    return yearToPosition(start);
  };

  // 生成年份刻度
  const renderYearMarkers = () => {
    const markers = [];
    // 每100年一个主刻度
    for (let year = MIN_YEAR; year <= MAX_YEAR; year += 100) {
      // 重要历史年份，显示不同颜色和样式
      const isImportantYear = [-2070, -1600, -1046, -221, 0, 618, 960, 1368, 1644, 1912, 1949].includes(year);
      
      markers.push(
        <div 
          key={`marker-${year}`}
          className={`year-marker ${isImportantYear ? 'important-year' : ''}`}
          style={{ left: yearToPosition(year) }}
        >
          <div className="marker-line"></div>
          <div className="marker-label">{year < 0 ? year : year}</div>
        </div>
      );
    }
    return markers;
  };

  // 生成历史数据折线图（多条）
  const renderMultipleHistoricalLineCharts = () => {
    const maxValue = 140; // 所有数据集中的最大值
    
    // 为每个数据集创建折线图
    const linesAndPoints = multipleHistoricalData.map((dataset, datasetIndex) => {
      const interpolatedData = getInterpolatedData(dataset.data);
      
      // 创建SVG路径数据
      let pathData = '';
      
      // 生成折线路径
      interpolatedData.forEach((item, index) => {
        const x = yearToPosition(item.year);
        const y = MAX_BAR_HEIGHT - (item.value / maxValue) * MAX_BAR_HEIGHT;
        
        if (index === 0) {
          pathData += `M ${x} ${y}`;
        } else {
          pathData += ` L ${x} ${y}`;
        }
      });
      
      // 生成数据点
      const dataPoints = interpolatedData.map((item, index) => {
        // 只显示部分数据点，避免过于密集
        if (index % 8 !== 0 && !dataset.data.some(d => d.year === item.year)) {
          return null;
        }
        
        const x = yearToPosition(item.year);
        const y = MAX_BAR_HEIGHT - (item.value / maxValue) * MAX_BAR_HEIGHT;
        const isHighlighted = hoveredYear && 
          Math.abs(hoveredYear - item.year) < 10 && 
          (hoveredDataset === dataset.id || !hoveredDataset);
        
        // 只有在悬停时或每5个点显示一个点
        if (!isHighlighted && index % 5 !== 0) return null;
        
        return (
          <circle
            key={`point-${dataset.id}-${item.year}`}
            className={`data-point ${isHighlighted ? 'highlighted' : ''}`}
            cx={x}
            cy={y}
            r={isHighlighted ? 3 : 1.5}
            fill={dataset.color}
            stroke="white"
            strokeWidth={isHighlighted ? 1 : 0.5}
            title={`${dataset.name} ${item.year}年: ${Math.round(item.value)}`}
            onMouseOver={() => setHoveredDataset(dataset.id)}
            onMouseOut={() => setHoveredDataset(null)}
          />
        );
      }).filter(Boolean);
      
      // 悬浮点
      const hoverPoint = hoveredYear && hoveredDataset === dataset.id && interpolatedData.some(d => Math.abs(d.year - hoveredYear) < 20) && (
        (() => {
          const nearestPoint = interpolatedData.reduce((prev, curr) => 
            Math.abs(curr.year - hoveredYear) < Math.abs(prev.year - hoveredYear) ? curr : prev
          );
          const x = yearToPosition(nearestPoint.year);
          const y = MAX_BAR_HEIGHT - (nearestPoint.value / maxValue) * MAX_BAR_HEIGHT;
          
          return (
            <g className="hover-point" key={`hover-${dataset.id}`}>
              <circle
                cx={x}
                cy={y}
                r={4}
                fill={dataset.color}
                stroke="white"
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={y - 7}
                textAnchor="middle"
                fontSize="7"
                fill="#333"
                fontWeight="bold"
              >
                {Math.round(nearestPoint.value)}
              </text>
            </g>
          );
        })()
      );
      
      return (
        <g key={`line-${dataset.id}`} className="line-group">
          <path
            className="line-path"
            d={pathData}
            stroke={dataset.color}
            strokeWidth={1.5}
            fill="none"
            opacity={hoveredDataset && hoveredDataset !== dataset.id ? 0.3 : 0.8}
          />
          {dataPoints}
          {hoverPoint}
        </g>
      );
    });
    
    // 图例
    const legend = (
      <g className="chart-legend" transform="translate(10, 5)">
        {multipleHistoricalData.map((dataset, index) => (
          <g 
            key={`legend-${dataset.id}`} 
            transform={`translate(${index * 70}, 0)`}
            className="legend-item"
            onMouseOver={() => setHoveredDataset(dataset.id)}
            onMouseOut={() => setHoveredDataset(null)}
          >
            <line 
              x1="0" y1="3" 
              x2="15" y2="3" 
              stroke={dataset.color} 
              strokeWidth="1.5" 
            />
            <text x="20" y="5" fontSize="6" fill="#333">{dataset.name}</text>
          </g>
        ))}
      </g>
    );
    
    return (
      <svg className="line-chart" width="100%" height={MAX_BAR_HEIGHT}>
        {linesAndPoints}
        {legend}
      </svg>
    );
  };

  // 生成朝代元素
  const renderDynasties = () => {
    const mainDynasties = dynastyData.filter(d => !d.subOf);
    
    return mainDynasties.map((dynasty) => {
      // 计算宽度和位置
      const width = getDynastyWidth(dynasty.start, dynasty.end);
      const left = getDynastyPosition(dynasty.start);
      
      // 查找子朝代
      const subDynasties = dynastyData.filter(d => d.subOf === dynasty.id);
      
      // 检查是否被选中
      const isSelected = selectedDynasties.includes(dynasty.name);
      
      return (
        <div
          key={dynasty.id}
          className={`dynasty-item ${isSelected ? 'selected' : ''}`}
          style={{
            width: `${width}px`,
            left: `${left}px`,
            borderLeftColor: dynasty.color,
            borderRightColor: dynasty.color,
            backgroundColor: isSelected ? `${dynasty.color}20` : 'transparent'
          }}
          onClick={() => handleDynastyClick(dynasty)}
          title={`${dynasty.name} (${dynasty.start} ~ ${dynasty.end})`}
        >
          <div className="dynasty-name">{dynasty.name}</div>
          
          {/* 子朝代 */}
          {subDynasties.length > 0 && (
            <div className="sub-dynasties">
              {subDynasties.map(sub => {
                const subWidth = getDynastyWidth(sub.start, sub.end);
                const subLeft = getDynastyPosition(sub.start) - left;
                const isSubSelected = selectedDynasties.includes(sub.name);
                
                return (
                  <div
                    key={sub.id}
                    className={`sub-dynasty-item ${isSubSelected ? 'selected' : ''}`}
                    style={{
                      width: `${subWidth}px`,
                      left: `${subLeft}px`,
                      borderLeftColor: sub.color,
                      borderRightColor: sub.color,
                      backgroundColor: isSubSelected ? `${sub.color}20` : 'transparent'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDynastyClick(sub);
                    }}
                    title={`${sub.name} (${sub.start} ~ ${sub.end})`}
                  >
                    <div className="sub-dynasty-name">{sub.name}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  // 使用useEffect监听全局鼠标事件
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // 初始滚动到合适的位置（秦汉时期）
  useEffect(() => {
    if (timelineRef.current) {
      // 初始滚动位置，确保合理展示重要历史区域
      const initialScrollPosition = yearToPosition(0) - timelineRef.current.clientWidth / 2;
      timelineRef.current.scrollLeft = initialScrollPosition;
    }
  }, []);

  return (
    <div className="historical-timeline">
      {/* 显示当前选中的朝代信息 */}
      <div className="timeline-info-bar">
        <div className="selected-dynasty-info">
          {selectedDynasties.includes('overview') 
            ? '全局总览' 
            : `已选择 ${selectedDynasties.length} 个时期: ${selectedDynasties.join(', ')}`
          }
        </div>
        {hoveredYear && (
          <div className="hovered-year-info">
            当前年份: {hoveredYear < 0 ? hoveredYear + "BCE" : hoveredYear + "CE"}
            {hoveredDataset && ` | ${multipleHistoricalData.find(d => d.id === hoveredDataset)?.name || ''}`}
          </div>
        )}
      </div>
      <div 
        className="timeline-scroll-container"
        ref={timelineRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleTimelineHover}
        onMouseLeave={handleTimelineLeave}
      >
        <div 
          className="timeline-content"
          style={{ width: `${TIMELINE_WIDTH + LEFT_PADDING * 2}px` }}
        >
          {/* 历史数据折线图（多条） */}
          <div className="history-chart-container">
            {renderMultipleHistoricalLineCharts()}
          </div>
          
          {/* 年份标记 */}
          <div className="year-markers">
            {renderYearMarkers()}
          </div>
          
          {/* 朝代区块 */}
          <div className="dynasty-container">
            {renderDynasties()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoricalTimeline; 