// src/components/HistoricalTimeline.jsx
import React, { useState, useEffect, useRef } from 'react';
import './HistoricalTimeline.css';
import useDynastyStore, { dynastyData } from '../store/dynastyStore';

const HistoricalTimeline = () => {
  // 使用Zustand store
  const { selectedDynasties, toggleDynasty } = useDynastyStore();

  // 历史数据状态
  const [historicalData, setHistoricalData] = useState({
    disasters: [],
    reforms: []
  });
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataLoadError, setDataLoadError] = useState(null);

  // 时间轴滚动相关状态
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const timelineRef = useRef(null);
  
  // 悬停状态
  const [hoveredYear, setHoveredYear] = useState(null);
  const [hoveredDataType, setHoveredDataType] = useState(null);
  const [hoveredEventInfo, setHoveredEventInfo] = useState(null);

  // 定义一些常量用于绘制时间轴
  const MIN_YEAR = -3000; // 展示范围的最小年份
  const MAX_YEAR = 2025; // 展示范围的最大年份
  const YEAR_RANGE = MAX_YEAR - MIN_YEAR;
  const PIXEL_PER_YEAR = 0.8; // 调整每年占用的像素宽度
  const TIMELINE_WIDTH = YEAR_RANGE * PIXEL_PER_YEAR; // 总宽度
  const MAX_BAR_HEIGHT = 35; // 柱状图最大高度
  const LEFT_PADDING = 40; // 左侧填充

  // 加载CSV数据
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        setIsDataLoading(true);
        setDataLoadError(null);

        // 加载两个CSV文件
        const [disasterResponse, reformResponse] = await Promise.all([
          fetch('/data/坐标轴_灾变.csv'),
          fetch('/data/坐标轴_制度改革.csv')
        ]);

        if (!disasterResponse.ok) {
          throw new Error(`Failed to load disaster data: ${disasterResponse.status}`);
        }
        if (!reformResponse.ok) {
          throw new Error(`Failed to load reform data: ${reformResponse.status}`);
        }

        const disasterText = await disasterResponse.text();
        const reformText = await reformResponse.text();

        // 简单的CSV解析（不使用PapaParse避免依赖问题）
        const parseCSV = (text) => {
          const lines = text.trim().split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          const data = [];
          
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length >= 2) {
              const year = parseInt(values[0]);
              const scale = parseInt(values[1]);
              if (!isNaN(year) && !isNaN(scale)) {
                data.push({ exact_year: year, scale: scale });
              }
            }
          }
          return data;
        };

        const disasters = parseCSV(disasterText);
        const reforms = parseCSV(reformText);

        console.log('加载的数据:', { disasters: disasters.length, reforms: reforms.length });

        setHistoricalData({
          disasters,
          reforms
        });
        setIsDataLoading(false);
      } catch (error) {
        console.error('Error loading historical data:', error);
        setDataLoadError(error.message);
        setIsDataLoading(false);
      }
    };

    loadHistoricalData();
  }, []);

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
      
      // 查找当前年份的事件
      const yearDisasters = historicalData.disasters.filter(d => d.exact_year === year);
      const yearReforms = historicalData.reforms.filter(r => r.exact_year === year);
      
      if (yearDisasters.length > 0 || yearReforms.length > 0) {
        setHoveredEventInfo({
          year,
          disasters: yearDisasters,
          reforms: yearReforms
        });
      } else {
        setHoveredEventInfo(null);
      }
    }
  };

  const handleTimelineLeave = () => {
    setHoveredYear(null);
    setHoveredDataType(null);
    setHoveredEventInfo(null);
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

  // 生成密集柱状图
  const renderDenseBarChart = () => {
    if (isDataLoading || historicalData.disasters.length === 0) {
      return null;
    }

    // 分别计算两个数据集的scale范围进行标准化
    const disasterScales = historicalData.disasters.map(d => d.scale);
    const reformScales = historicalData.reforms.map(r => r.scale);
    
    const disasterMin = Math.min(...disasterScales); // -3
    const disasterMax = Math.max(...disasterScales); // 5
    const disasterRange = disasterMax - disasterMin; // 8
    
    const reformMin = Math.min(...reformScales); // 0
    const reformMax = Math.max(...reformScales); // 5  
    const reformRange = reformMax - reformMin; // 5

    // 按年份分组数据
    const dataByYear = {};
    
    // 处理灾变数据
    historicalData.disasters.forEach(item => {
      const year = item.exact_year;
      if (!dataByYear[year]) dataByYear[year] = { disasters: [], reforms: [] };
      dataByYear[year].disasters.push(item.scale);
    });

    // 处理制度改革数据
    historicalData.reforms.forEach(item => {
      const year = item.exact_year;
      if (!dataByYear[year]) dataByYear[year] = { disasters: [], reforms: [] };
      dataByYear[year].reforms.push(item.scale);
    });

    // 生成柱状图
    const bars = [];
    
    Object.keys(dataByYear).forEach(year => {
      const yearNum = parseInt(year);
      const x = yearToPosition(yearNum);
      const yearData = dataByYear[year];
      
      let disasterCurrentHeight = 0;
      let reformCurrentHeight = 0;
      
      // 渲染灾变事件（红色系）- 分别标准化
      yearData.disasters.forEach((scale, index) => {
        // 灾变数据标准化：将[-3,5]映射到[0,1]
        let normalizedScale;
        if (disasterRange > 0) {
          normalizedScale = (scale - disasterMin) / disasterRange;
        } else {
          normalizedScale = 0.5; // 如果范围为0，使用中等高度
        }
        
        // 最小高度为2px，确保scale=0的事件也能看见
        const minBarHeight = 2;
        const barHeight = Math.max(minBarHeight, normalizedScale * (MAX_BAR_HEIGHT * 0.8)) + 
                         (scale < 0 ? 1 : 0); // 负scale值稍微降低显示高度
        
        const isHighlighted = hoveredYear && Math.abs(hoveredYear - yearNum) < 2;
        
        bars.push(
          <rect
            key={`disaster-${year}-${index}`}
            x={x - 1.5}
            y={MAX_BAR_HEIGHT - disasterCurrentHeight - barHeight}
            width={1.5}
            height={barHeight}
            fill={isHighlighted ? '#ff4757' : '#ff6b7a'}
            stroke={isHighlighted ? '#ff3838' : 'none'}
            strokeWidth={isHighlighted ? 0.5 : 0}
            opacity={hoveredDataType && hoveredDataType !== 'disasters' ? 0.3 : 0.8}
            onMouseOver={() => setHoveredDataType('disasters')}
            onMouseOut={() => setHoveredDataType(null)}
            title={`${year}年 灾变 (scale: ${scale}, 标准化: ${normalizedScale.toFixed(2)})`}
          />
        );
        disasterCurrentHeight += barHeight;
      });

      // 渲染制度改革事件（蓝色系）- 分别标准化
      yearData.reforms.forEach((scale, index) => {
        // 制度改革数据标准化：将[0,5]映射到[0,1]
        let normalizedScale;
        if (reformRange > 0) {
          normalizedScale = (scale - reformMin) / reformRange;
        } else {
          normalizedScale = 0.5;
        }
        
        // scale=0的制度改革事件显示很小的高度（表示存在但影响很小）
        const minBarHeight = scale === 0 ? 1 : 2;
        const barHeight = Math.max(minBarHeight, normalizedScale * (MAX_BAR_HEIGHT * 0.8));
        
        const isHighlighted = hoveredYear && Math.abs(hoveredYear - yearNum) < 2;
        
        bars.push(
          <rect
            key={`reform-${year}-${index}`}
            x={x + 0.5}
            y={MAX_BAR_HEIGHT - reformCurrentHeight - barHeight}
            width={1.5}
            height={barHeight}
            fill={isHighlighted ? '#3742fa' : '#5352ed'}
            stroke={isHighlighted ? '#2f3542' : 'none'}
            strokeWidth={isHighlighted ? 0.5 : 0}
            opacity={hoveredDataType && hoveredDataType !== 'reforms' ? 0.3 : 0.8}
            onMouseOver={() => setHoveredDataType('reforms')}
            onMouseOut={() => setHoveredDataType(null)}
            title={`${year}年 制度改革 (scale: ${scale}, 标准化: ${normalizedScale.toFixed(2)})`}
          />
        );
        reformCurrentHeight += barHeight;
      });
    });

    // 图例
    const legend = (
      <g className="chart-legend" transform="translate(10, 5)">
        <g className="legend-item">
          <rect x="0" y="0" width="15" height="3" fill="#ff6b7a" />
          <text x="20" y="4" fontSize="7" fill="#333">
            灾变事件 (scale: {disasterMin}~{disasterMax})
          </text>
        </g>
        <g className="legend-item" transform="translate(120, 0)">
          <rect x="0" y="0" width="15" height="3" fill="#5352ed" />
          <text x="20" y="4" fontSize="7" fill="#333">
            制度改革 (scale: {reformMin}~{reformMax})
          </text>
        </g>
        <text x="0" y="15" fontSize="6" fill="#666">
          * 各数据集独立标准化显示
        </text>
      </g>
    );

    return (
      <svg className="bar-chart" width="100%" height={MAX_BAR_HEIGHT}>
        {bars}
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

  // 如果数据正在加载
  if (isDataLoading) {
    return (
      <div className="historical-timeline">
        <div className="timeline-info-bar">
          <div style={{ textAlign: 'center', width: '100%' }}>正在加载历史数据...</div>
        </div>
      </div>
    );
  }

  // 如果数据加载失败
  if (dataLoadError) {
    return (
      <div className="historical-timeline">
        <div className="timeline-info-bar">
          <div style={{ textAlign: 'center', width: '100%', color: 'red' }}>
            数据加载失败: {dataLoadError}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="historical-timeline">
      {/* 显示当前选中的朝代信息和悬停事件信息 */}
      <div className="timeline-info-bar">
        <div className="selected-dynasty-info">
          {selectedDynasties.includes('overview') 
            ? '全局总览' 
            : `已选择 ${selectedDynasties.length} 个时期: ${selectedDynasties.join(', ')}`
          }
          {!isDataLoading && (
            <span style={{ marginLeft: '10px', fontSize: '8px', opacity: 0.8 }}>
              [灾变:{historicalData.disasters.length}条 | 制度改革:{historicalData.reforms.length}条]
            </span>
          )}
        </div>
        {hoveredEventInfo && (
          <div className="hovered-year-info">
            {hoveredEventInfo.year < 0 ? hoveredEventInfo.year + "BCE" : hoveredEventInfo.year + "CE"}: 
            {hoveredEventInfo.disasters.length > 0 && ` 灾变${hoveredEventInfo.disasters.length}次(${hoveredEventInfo.disasters.map(d => d.scale).join(',')})`}
            {hoveredEventInfo.reforms.length > 0 && ` 制度改革${hoveredEventInfo.reforms.length}次(${hoveredEventInfo.reforms.map(r => r.scale).join(',')})`}
          </div>
        )}
        {hoveredYear && !hoveredEventInfo && (
          <div className="hovered-year-info">
            {hoveredYear < 0 ? hoveredYear + "BCE" : hoveredYear + "CE"}
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
          {/* 历史数据柱状图 */}
          <div className="history-chart-container">
            {renderDenseBarChart()}
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