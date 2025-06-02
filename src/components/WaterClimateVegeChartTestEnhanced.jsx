// src/components/WaterClimateVegeChartTestEnhanced.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import ReactDOM from 'react-dom';
import useDynastyStore from '../store/dynastyStore';
import RiverDetailSankey from './ShowAllWaterChart';

const defaultLegend = [
  { color: '#B7C8BD', label: '水系数据源' },
  { color: '#E5B8A2', label: '气候数据源' },
  { color: '#B8C49E', label: '植被数据源' },
  { color: '#F5D9A4', label: '交通运输' },
  { color: '#F2CDA0', label: '防洪排水' },
  { color: '#EBB78C', label: '生活用水' },
  { color: '#F7E4B6', label: '城市景观' },
  { color: '#FAEEC5', label: '农业灌溉' },
  { color: '#F6C9BE', label: '城市防御' },
  { color: '#F1C3D5', label: '政治象征' },
  { color: '#E0E0E0', label: '未知功能' },
];

const SankeyChart = ({ nodes = [], links = [], onHoverWaterNode, onLeaveChart }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    let chart = echarts.getInstanceByDom(chartRef.current);
    if (!chart) chart = echarts.init(chartRef.current);

    const option = {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params) => {
          if (params.dataType === 'edge') {
            return `${params.data.source} → ${params.data.target}<br/>流量: ${params.data.value}`;
          } else {
            let nodeType = '节点';
            if (params.data.depth === 0) nodeType = '数据源';
            else if (params.data.depth === 1) nodeType = '特征';
            else if (params.data.depth === 2) nodeType = '影响';
            return `${params.data.name}<br/>类别: ${nodeType}`;
          }
        },
      },
      series: [{
        type: 'sankey',
        data: nodes,
        links: links,
        emphasis: { focus: 'adjacency' },
        nodeWidth: 20,
        nodeGap: 8,
        layoutIterations: 32,
        orient: 'horizontal',
        draggable: false,
        label: {
          show: true,
          fontSize: 11,
          fontWeight: 'bold',
          color: '#2c3e50',
          position: 'right',
          formatter: p => p.name
        },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.7 },
        levels: [
          { depth: 0, itemStyle: { borderWidth: 2, borderColor: '#34495e' }, lineStyle: { opacity: 0.8 } },
          { depth: 1, itemStyle: { borderWidth: 1, borderColor: '#95a5a6' }, lineStyle: { opacity: 0.7 } },
          { depth: 2, itemStyle: { borderWidth: 1, borderColor: '#bdc3c7' }, lineStyle: { opacity: 0.6 } }
        ]
      }]
    };

    chart.setOption(option, true);

    if (onHoverWaterNode) {
      chart.on('mouseover', (params) => {
        if (params?.dataType === 'node' && params?.data?.depth === 0 && params?.data?.name === '水系') {
          const { offsetX, offsetY } = params.event;
          onHoverWaterNode({ x: offsetX, y: offsetY });
        }
      });

      chart.on('globalout', () => {
        if (onLeaveChart) onLeaveChart();
      });
    }

    const resizeHandler = () => chart.resize();
    window.addEventListener('resize', resizeHandler);
    return () => {
      chart.dispose();
      window.removeEventListener('resize', resizeHandler);
    };
  }, [nodes, links, onHoverWaterNode, onLeaveChart]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
};

// 🔧 修复弹窗交互问题：添加鼠标进入/离开事件处理
const RiverDetailPopup = ({ children, position, onClose, onMouseEnter, onMouseLeave }) => {
  const maxWidth = window.innerWidth * 0.7;
  const maxHeight = window.innerHeight * 0.6;

  const width = Math.max(400, Math.min(maxWidth, 600));
  const height = Math.max(300, Math.min(maxHeight, 450));

  // 增加弹窗偏移距离到50px，避免遮挡触发区域
  const minOffset = 50;
  let finalLeft = position.x + minOffset;
  let finalTop = position.y + minOffset;

  // 智能定位：如果右下方没有足够空间，尝试其他位置
  const maxX = window.innerWidth - width - 10;
  const maxY = window.innerHeight - height - 10;
  
  // 如果右下方超出边界，尝试左上方
  if (finalLeft > maxX || finalTop > maxY) {
    // 尝试左上方
    const leftX = position.x - width - minOffset;
    const topY = position.y - height - minOffset;
    
    if (leftX >= 10 && topY >= 10) {
      finalLeft = leftX;
      finalTop = topY;
    } else {
      // 最后兜底：确保在屏幕范围内
      finalLeft = Math.max(10, Math.min(position.x + minOffset, maxX));
      finalTop = Math.max(10, Math.min(position.y + minOffset, maxY));
    }
  }

  const style = {
    position: 'fixed',
    top: finalTop,
    left: finalLeft,
    width,
    height,
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    zIndex: 9999,
    borderRadius: '4px',
    overflow: 'hidden',
  };

  const innerStyle = {
    width: '100%',
    height: '100%',
    position: 'relative',
  };

  const closeButtonStyle = {
    position: 'absolute',
    top: 8,
    right: 12,
    cursor: 'pointer',
    fontSize: 14,
    color: '#888',
    zIndex: 10000,
    background: '#fff',
    border: 'none',
  };

  return ReactDOM.createPortal(
    <div 
      style={style}
      // 🔧 关键修复：添加鼠标事件监听
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={innerStyle}>
        <button style={closeButtonStyle} onClick={onClose}>✖</button>
        {React.cloneElement(children, { chartWidth: width, chartHeight: height })}
      </div>
    </div>,
    document.body
  );
};

const Legend = ({ items }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '10px 15px',
    padding: '8px',
    fontSize: '11px',
    borderRadius: '4px',
    border: '1px solid #e9ecef',
    marginTop: '10px',
  }}>
    {items.map((item, index) => (
      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{
          width: '14px',
          height: '14px',
          borderRadius: '2px',
          border: '1px solid #ccc',
          backgroundColor: item.color,
        }}></div>
        <span>{item.label}</span>
      </div>
    ))}
  </div>
);

const BeijingEcology = ({ legendItems = defaultLegend }) => {
  const { selectedDynasties, getSelectedDisplayNames } = useDynastyStore();
  
  // 状态管理
  const [chartData, setChartData] = useState({ nodes: [], links: [] });
  const [dataSourceText, setDataSourceText] = useState('数据加载中...');
  const [showHoverChart, setShowHoverChart] = useState(false);
  const [hoverPos, setHoverPos] = useState({ x: 100, y: 100 });
  const lastHoverPos = useRef({ x: 0, y: 0 });
  const hideTimeoutRef = useRef(null);
  const showTimeoutRef = useRef(null);

  // 🔧 新增状态：跟踪鼠标是否在弹窗内
  const [isMouseInPopup, setIsMouseInPopup] = useState(false);

  // 视图模式控制
  const [viewMode, setViewMode] = useState('overview');
  const [selectedWaterSystem, setSelectedWaterSystem] = useState('');
  const [availableWaterSystems, setAvailableWaterSystems] = useState([]);
  
  // 数据存储
  const [climateVegeDataByDynasty, setClimateVegeDataByDynasty] = useState({});
  const [riverInfo, setRiverInfo] = useState({});
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataLoadError, setDataLoadError] = useState(null);

  // 🔧 新增：弹窗鼠标进入处理函数
  const handlePopupMouseEnter = useCallback(() => {
    setIsMouseInPopup(true);
    // 清除隐藏定时器，因为鼠标进入了弹窗
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // 🔧 新增：弹窗鼠标离开处理函数
  const handlePopupMouseLeave = useCallback(() => {
    setIsMouseInPopup(false);
    // 当鼠标离开弹窗时，启动隐藏倒计时
    hideTimeoutRef.current = setTimeout(() => {
      setShowHoverChart(false);
      lastHoverPos.current = { x: 0, y: 0 };
    }, 300); // 给用户一些时间重新回到弹窗或图表
  }, []);

  // 🔧 改进的图表离开处理函数
  const handleChartLeave = useCallback(() => {
    // 清除显示定时器
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    
    // 只有当鼠标不在弹窗内时才启动隐藏倒计时
    if (!isMouseInPopup) {
      hideTimeoutRef.current = setTimeout(() => {
        // 双重检查：确保鼠标仍然不在弹窗内
        if (!isMouseInPopup) {
          setShowHoverChart(false);
          lastHoverPos.current = { x: 0, y: 0 };
        }
      }, 800);
    }
  }, [isMouseInPopup]);

  // 🔧 改进的水系节点悬停处理函数
  const handleWaterNodeHover = useCallback((pos) => {
    // 清除之前的隐藏定时器
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    // 清除之前的显示定时器
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }

    // 添加300ms稳定期，确认用户真的想查看详情
    showTimeoutRef.current = setTimeout(() => {
      // 提高移动阈值从5px到15px，减少敏感性
      const dx = Math.abs(pos.x - lastHoverPos.current.x);
      const dy = Math.abs(pos.y - lastHoverPos.current.y);
      if (dx > 15 || dy > 15 || !showHoverChart) {
        setHoverPos(pos);
        setShowHoverChart(true);
        lastHoverPos.current = pos;
      }
    }, 300);
  }, [showHoverChart]);

  // 🔧 改进的弹窗关闭处理函数
  const handleClosePopup = useCallback(() => {
    // 清除所有定时器
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    setShowHoverChart(false);
    setIsMouseInPopup(false);
    lastHoverPos.current = { x: 0, y: 0 };
  }, []);

  // 异步加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsDataLoading(true);
        setDataLoadError(null);
        
        const [climateResponse, riverResponse] = await Promise.all([
          fetch('/data/river_climate_vege_data.json'),
          fetch('/data/river_info_data.json')
        ]);

        if (!climateResponse.ok || !riverResponse.ok) {
          throw new Error('数据加载失败');
        }

        const climateData = await climateResponse.json();
        const riverData = await riverResponse.json();

        setClimateVegeDataByDynasty(climateData);
        setRiverInfo(riverData);
        setIsDataLoading(false);
      } catch (error) {
        console.error('数据加载失败:', error);
        setDataLoadError(error.message);
        setIsDataLoading(false);
      }
    };

    loadData();
  }, []);

  // 更新可选水系列表 - 支持多朝代合并
  useEffect(() => {
    if (viewMode === 'waterSystem' && !isDataLoading) {
      const dynastiesToCheck = selectedDynasties.includes('overview') 
        ? Object.keys(riverInfo) 
        : selectedDynasties.filter(d => d !== 'overview');

      // 合并所有选中朝代的水系列表
      const allSystems = new Set();
      dynastiesToCheck.forEach(dynasty => {
        const systems = Object.keys(riverInfo[dynasty] || {});
        systems.forEach(system => allSystems.add(system));
      });

      const systemsArray = Array.from(allSystems);
      setAvailableWaterSystems(systemsArray);
      
      if (!systemsArray.includes(selectedWaterSystem)) {
        setSelectedWaterSystem(systemsArray[0] || '');
      }
    }
  }, [viewMode, riverInfo, selectedDynasties, selectedWaterSystem, isDataLoading]);

  // 主要数据加载和合并逻辑 - 支持水系分析的多朝代合并
  useEffect(() => {
    if (isDataLoading) return;

    let newNodes = [];
    let newLinks = [];
    let newDataSourceText = '';

    if (viewMode === 'overview') {
      // 概览模式：实现多朝代数据合并
      if (selectedDynasties.includes('overview')) {
        // 显示全局概览
        const dataSet = climateVegeDataByDynasty.overview || {};
        newNodes = dataSet.nodes || [];
        newLinks = dataSet.links || [];
        newDataSourceText = '数据来源：北京历史时空数据 (全局总览) - 生态环境总览';
      } else if (selectedDynasties.length === 1) {
        // 单个朝代
        const dynasty = selectedDynasties[0];
        const dataSet = climateVegeDataByDynasty[dynasty] || climateVegeDataByDynasty.overview || {};
        newNodes = dataSet.nodes || [];
        newLinks = dataSet.links || [];
        newDataSourceText = `数据来源：北京历史时空数据 (${dynasty}) - 生态环境总览`;
      } else {
        // 多朝代数据合并
        const combinedNodes = new Map();
        const combinedLinks = [];
        
        selectedDynasties.forEach(dynasty => {
          const dataSet = climateVegeDataByDynasty[dynasty] || {};
          const nodes = dataSet.nodes || [];
          const links = dataSet.links || [];
          
          // 合并节点（避免重复）
          nodes.forEach(node => {
            const key = `${node.name}_${node.depth}`;
            if (!combinedNodes.has(key)) {
              combinedNodes.set(key, { ...node });
            }
          });
          
          // 合并连接（相同source-target的值求和）
          links.forEach(link => {
            const existingLink = combinedLinks.find(l => 
              l.source === link.source && l.target === link.target
            );
            if (existingLink) {
              existingLink.value += link.value;
            } else {
              combinedLinks.push({ ...link });
            }
          });
        });
        
        newNodes = Array.from(combinedNodes.values());
        newLinks = combinedLinks;
        
        const displayNames = getSelectedDisplayNames();
        newDataSourceText = `数据来源：北京历史时空数据 (${displayNames.join('、')}合并) - 生态环境总览`;
      }

      // 计算统计数据
      if (newLinks.length > 0) {
        const climateCount = newLinks.filter(l => 
          newNodes.find(n => n.name === l.source && n.itemStyle?.color === '#E5B8A2')
        ).reduce((sum, l) => sum + (l.value || 0), 0);
        
        const vegeCount = newLinks.filter(l => 
          newNodes.find(n => n.name === l.source && n.itemStyle?.color === '#B8C49E')
        ).reduce((sum, l) => sum + (l.value || 0), 0);
        
        const waterCount = newLinks.filter(l => 
          newNodes.find(n => n.name === l.source && n.itemStyle?.color === '#B7C8BD')
        ).reduce((sum, l) => sum + (l.value || 0), 0);

        newDataSourceText += ` | 水系样本: ${waterCount} | 气候样本: ${climateCount} | 植被样本: ${vegeCount}`;
      }

    } else if (viewMode === 'waterSystem' && selectedWaterSystem) {
      // 水系模式：实现多朝代数据合并
      const dynastiesToUse = selectedDynasties.includes('overview') 
        ? Object.keys(riverInfo).filter(d => d !== 'overview')
        : selectedDynasties.filter(d => d !== 'overview');

      if (dynastiesToUse.length === 1) {
        // 单个朝代
        const dynasty = dynastiesToUse[0];
        const systemData = riverInfo[dynasty]?.[selectedWaterSystem] || {};
        newNodes = systemData.nodes || [];
        newLinks = systemData.links || [];

        const totalFlow = newLinks.reduce((sum, l) => sum + (l.value || 0), 0);
        newDataSourceText = `数据来源：北京历史时空数据 (${dynasty}) - 水系: ${selectedWaterSystem} | 总流量: ${totalFlow}`;
      } else if (dynastiesToUse.length > 1) {
        // 多朝代水系数据合并
        const combinedNodes = new Map();
        const combinedLinks = [];
        
        dynastiesToUse.forEach(dynasty => {
          const systemData = riverInfo[dynasty]?.[selectedWaterSystem] || {};
          const nodes = systemData.nodes || [];
          const links = systemData.links || [];
          
          // 合并节点（避免重复）
          nodes.forEach(node => {
            const key = `${node.name}_${node.depth || 0}`;
            if (!combinedNodes.has(key)) {
              combinedNodes.set(key, { ...node });
            } else {
              // 如果节点已存在，可以考虑合并某些属性
              const existing = combinedNodes.get(key);
              if (node.value && existing.value) {
                existing.value += node.value; // 累加节点值
              }
            }
          });
          
          // 合并连接（相同source-target的值求和）
          links.forEach(link => {
            const existingLink = combinedLinks.find(l => 
              l.source === link.source && l.target === link.target
            );
            if (existingLink) {
              existingLink.value += link.value || 0;
            } else {
              combinedLinks.push({ ...link });
            }
          });
        });
        
        newNodes = Array.from(combinedNodes.values());
        newLinks = combinedLinks;
        
        const totalFlow = newLinks.reduce((sum, l) => sum + (l.value || 0), 0);
        const displayNames = dynastiesToUse.join('、');
        newDataSourceText = `数据来源：北京历史时空数据 (${displayNames}合并) - 水系: ${selectedWaterSystem} | 总流量: ${totalFlow}`;
      } else {
        // 无有效朝代
        newDataSourceText = `数据来源：北京历史时空数据 - 水系: ${selectedWaterSystem} (当前选择无有效数据)`;
      }
    } else if (viewMode === 'waterSystem' && !selectedWaterSystem) {
      const displayNames = selectedDynasties.includes('overview') 
        ? '全局总览' 
        : getSelectedDisplayNames().join('、');
      newDataSourceText = `数据来源：北京历史时空数据 (${displayNames}) - 请选择一个水系`;
    }

    setChartData({ nodes: newNodes, links: newLinks });
    setDataSourceText(newDataSourceText);

  }, [selectedDynasties, viewMode, selectedWaterSystem, climateVegeDataByDynasty, riverInfo, isDataLoading, getSelectedDisplayNames]);

  // 错误和加载状态处理
  if (isDataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        正在加载数据，请稍候...
      </div>
    );
  }

  if (dataLoadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'red' }}>
        数据加载失败: {dataLoadError}
      </div>
    );
  }

  const hasData = chartData.nodes.length > 0 && chartData.links.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* 控制面板 */}
      <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div>
          <label style={{ marginRight: '8px' }}>视图模式：</label>
          <select 
            value={viewMode} 
            onChange={(e) => setViewMode(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="overview">生态环境总览</option>
            <option value="waterSystem">主要水系分析</option>
          </select>
        </div>

        {viewMode === 'waterSystem' && (
          <div>
            <label style={{ marginRight: '8px' }}>选择水系：</label>
            <select 
              value={selectedWaterSystem} 
              onChange={(e) => setSelectedWaterSystem(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {availableWaterSystems.length > 0 ? (
                availableWaterSystems.map((ws) => (
                  <option key={ws} value={ws}>{ws}</option>
                ))
              ) : (
                <option value="">无可用水系</option>
              )}
            </select>
            {availableWaterSystems.length === 0 && (
              <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                (当前朝代组合无可选水系)
              </span>
            )}
          </div>
        )}
      </div>

      {/* 图表区域 */}
      <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        {hasData ? (
          <>
            <SankeyChart
              nodes={chartData.nodes}
              links={chartData.links}
              onHoverWaterNode={viewMode === 'overview' ? handleWaterNodeHover : null}
              onLeaveChart={viewMode === 'overview' ? handleChartLeave : null}
            />
            
            {/* 🔧 修复：传递弹窗鼠标事件处理函数 */}
            {showHoverChart && viewMode === 'overview' && (
              <RiverDetailPopup
                position={hoverPos}
                onClose={handleClosePopup}
                onMouseEnter={handlePopupMouseEnter}
                onMouseLeave={handlePopupMouseLeave}
              >
                <RiverDetailSankey selectedDynasties={selectedDynasties} />
              </RiverDetailPopup>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#777' }}>
            当前选择没有可显示的数据
          </div>
        )}
      </div>

      {/* 图例和数据源信息 */}
      {hasData && <Legend items={defaultLegend} />}
      <div style={{ 
        fontSize: '10px', 
        color: '#868e96', 
        textAlign: 'center', 
        padding: '8px 0 5px 0' 
      }}>
        {dataSourceText}
      </div>
    </div>
  );
};

export default BeijingEcology;