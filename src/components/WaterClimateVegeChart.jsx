// src/components/WaterClimateVegeChart.jsx
import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import useDynastyStore from '../store/dynastyStore';

// Default图例 (can remain as is, or be made dynamic if needed)
const defaultLegend = [
  { color: '#B7C8BD', label: '水系数据源' },
  { color: '#E5B8A2', label: '气候数据源' },
  { color: '#B8C49E', label: '植被数据源' },
  { color: '#F5D9A4', label: '交通运输' }, // Example of a common 'impact' node
  { color: '#F2CDA0', label: '防洪排水' },
  { color: '#EBB78C', label: '生活用水' },
  { color: '#F7E4B6', label: '城市景观' },
  { color: '#FAEEC5', label: '农业灌溉' },
  { color: '#F6C9BE', label: '城市防御' },
  { color: '#F1C3D5', label: '政治象征' },
  { color: '#E0E0E0', label: '未知功能'}, // For '未知功能'
];

const initialDataSourceText = '数据加载中...';

const SankeyChart = ({ nodes = [], links = [] }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    let chart = echarts.getInstanceByDom(chartRef.current);
    if (!chart) {
        chart = echarts.init(chartRef.current);
    }

    const option = {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params) => {
          if (params.dataType === 'edge') {
            return `${params.data.source} → ${params.data.target}<br/>流量: ${params.data.value}`;
          } else {
            // Determine node type based on depth or a predefined category list if available
            let nodeType = '节点';
            if (params.data.depth === 0) nodeType = '数据源';
            else if (params.data.depth === 1) nodeType = '特征';
            else if (params.data.depth === 2) nodeType = '影响';
            return `${params.data.name}<br/>类别: ${nodeType}`;
          }
        },
        backgroundColor: 'rgba(50, 50, 50, 0.9)',
        borderColor: '#ccc',
        borderWidth: 1,
        textStyle: {
          color: '#fff',
          fontSize: 12
        }
      },
      series: [
        {
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
            show: true, // Ensure labels are shown
            fontSize: 11,
            fontWeight: 'bold',
            color: '#2c3e50',
            position: 'right', // Default position
            formatter: function (params) {
                // Custom label formatter if needed, e.g., to avoid overlap or show values
                return params.name;
            }
          },
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
            opacity: 0.7
          },
          levels: [
            { depth: 0, itemStyle: { borderWidth: 2, borderColor: '#34495e' }, lineStyle: { opacity: 0.8 } },
            { depth: 1, itemStyle: { borderWidth: 1, borderColor: '#95a5a6' }, lineStyle: { opacity: 0.7 } },
            { depth: 2, itemStyle: { borderWidth: 1, borderColor: '#bdc3c7' }, lineStyle: { opacity: 0.6 } }
          ]
        }
      ]
    };

    chart.setOption(option, true);
    const resizeHandler = () => chart.resize();
    window.addEventListener('resize', resizeHandler);
    return () => {
      chart.dispose();
      window.removeEventListener('resize', resizeHandler);
    };
  }, [nodes, links]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    fontFamily: 'Arial, sans-serif',
  },
  header: { // Retained for potential future use, not directly used by title/subtitle now
    paddingBottom: '6px',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: '13px',
    color: '#7f8c8d',
    marginBottom: '10px',
    textAlign: 'center',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '15px',
    marginBottom: '2px',
    padding: '2px',
    borderRadius: '6px',
    border: '1px solid #e9ecef',
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  controlLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#2c3e50'
  },
  controlSelect: {
    padding: '6px 10px',
    border: '1px solid #bdc3c7',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: 'white',
    color: '#2c3e50',
    cursor: 'pointer',
    minWidth: '150px',
  },
  chartWrapper: {
    flexGrow: 1,
    height: '100%',
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '10px 15px',
    padding: '8px',
    fontSize: '11px',
    borderRadius: '4px',
    border: '1px solid #e9ecef',
    marginTop: '10px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  legendColor: {
    width: '14px',
    height: '14px',
    borderRadius: '2px',
    border: '1px solid #ccc',
  },
  dataSource: {
    fontSize: '10px',
    color: '#868e96',
    textAlign: 'center',
    padding: '8px 0 5px 0',
  },
  noDataMessage: {
    textAlign: 'center',
    padding: '20px',
    color: '#777',
    fontSize: '14px',
    height: '100%', // To center vertically in chartWrapper
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
};

const Legend = ({ items }) => (
  <div style={styles.legend}>
    {items.map((item, index) => (
      <div style={styles.legendItem} key={index}>
        <div style={{ ...styles.legendColor, backgroundColor: item.color }}></div>
        <span>{item.label}</span>
      </div>
    ))}
  </div>
);

const BeijingEcology = ({
  dynastyToDisplay = 'overview', // 保持向后兼容
  legendItems = defaultLegend,
}) => {
  // 使用Zustand store获取选中的朝代
  const { selectedDynasties, getSelectedDisplayNames } = useDynastyStore();
  
  const [viewMode, setViewMode] = useState('overview'); // overview or waterSystem
  const [selectedWaterSystem, setSelectedWaterSystem] = useState('');
  const [chartData, setChartData] = useState({ nodes: [], links: [] });
  const [availableWaterSystems, setAvailableWaterSystems] = useState([]);
  const [dataSourceText, setDataSourceText] = useState(initialDataSourceText);
  
  // 数据加载状态
  const [riverDataByDynasty, setRiverDataByDynasty] = useState({});
  const [climateVegeDataByDynasty, setClimateVegeDataByDynasty] = useState({});
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataLoadError, setDataLoadError] = useState(null);

  // 获取当前要显示的朝代（取第一个选中的朝代或使用传入的prop）
  const currentDynasty = selectedDynasties.includes('overview') 
    ? 'overview' 
    : selectedDynasties[0] || dynastyToDisplay;

  // 异步加载JSON数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsDataLoading(true);
        setDataLoadError(null);
        
        // 并行加载两个JSON文件
        const [riverResponse, climateResponse] = await Promise.all([
          fetch('/data/river_info_data.json'),
          fetch('/data/river_climate_vege_data.json')
        ]);

        if (!riverResponse.ok) {
          throw new Error(`Failed to load river data: ${riverResponse.status}`);
        }
        if (!climateResponse.ok) {
          throw new Error(`Failed to load climate data: ${climateResponse.status}`);
        }

        const riverData = await riverResponse.json();
        const climateData = await climateResponse.json();

        setRiverDataByDynasty(riverData);
        setClimateVegeDataByDynasty(climateData);
        setIsDataLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setDataLoadError(error.message);
        setIsDataLoading(false);
      }
    };

    loadData();
  }, []);

  // Effect to update available water systems and selectedWaterSystem when currentDynasty or viewMode changes
  useEffect(() => {
    if (isDataLoading || Object.keys(riverDataByDynasty).length === 0) return;
    
    // Use the 'overview' data from riverDataByDynasty as a fallback if specific dynasty data is missing
    const currentDynastyRiverInfo = riverDataByDynasty[currentDynasty] || riverDataByDynasty.overview || {};

    if (viewMode === 'waterSystem') {
      const systems = Object.keys(currentDynastyRiverInfo);
      setAvailableWaterSystems(systems);

      if (systems.length > 0) {
        if (!selectedWaterSystem || !systems.includes(selectedWaterSystem)) {
          setSelectedWaterSystem(systems[0]); // Default to the first available system
        }
      } else {
        setSelectedWaterSystem(''); // No systems available for this dynasty/view
      }
    } else {
      setAvailableWaterSystems([]); // Clear if not in waterSystem view
    }
  }, [currentDynasty, viewMode, selectedWaterSystem, riverDataByDynasty, isDataLoading]);

  // Effect to load chart data based on selections
  useEffect(() => {
    if (isDataLoading || Object.keys(climateVegeDataByDynasty).length === 0) return;
    
    let newNodes = [];
    let newLinks = [];
    let newDataSourceText = '';
    const dynastyLabel = currentDynasty === 'overview' ? '全局总览' : currentDynasty;

    if (viewMode === 'overview') {
      // Handle multiple dynasties selection for overview mode
      if (selectedDynasties.includes('overview')) {
        // Show overview data
        const dataSet = climateVegeDataByDynasty.overview || {};
        newNodes = dataSet.nodes || [];
        newLinks = dataSet.links || [];
        newDataSourceText = `数据来源：北京历史时空数据 (全局总览) - 生态环境总览`;
      } else if (selectedDynasties.length === 1) {
        // Show single dynasty data
        const dataSet = climateVegeDataByDynasty[currentDynasty] || climateVegeDataByDynasty.overview || {};
        newNodes = dataSet.nodes || [];
        newLinks = dataSet.links || [];
        newDataSourceText = `数据来源：北京历史时空数据 (${dynastyLabel}) - 生态环境总览`;
      } else {
        // Handle multiple dynasties - combine data
        const combinedNodes = new Map();
        const combinedLinks = [];
        
        selectedDynasties.forEach(dynasty => {
          const dataSet = climateVegeDataByDynasty[dynasty] || {};
          const nodes = dataSet.nodes || [];
          const links = dataSet.links || [];
          
          // Combine nodes (avoiding duplicates)
          nodes.forEach(node => {
            const key = `${node.name}_${node.depth}`;
            if (!combinedNodes.has(key)) {
              combinedNodes.set(key, { ...node });
            }
          });
          
          // Combine links (sum values for same source-target pairs)
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
        newDataSourceText = `数据来源：北京历史时空数据 (${selectedDynasties.length}个时期合并) - 生态环境总览`;
      }

      let climateCount = 0;
      let vegeCount = 0;
      let waterCount = 0;

      if (newLinks.length > 0) {
        climateCount = newLinks.filter(l => newNodes.find(n => n.name === l.source && n.itemStyle?.color === '#E5B8A2'))
                                .reduce((sum, l) => sum + (l.value || 0), 0);
        vegeCount = newLinks.filter(l => newNodes.find(n => n.name === l.source && n.itemStyle?.color === '#B8C49E'))
                             .reduce((sum, l) => sum + (l.value || 0), 0);
        waterCount = newLinks.filter(l => newNodes.find(n => n.name === l.source && n.itemStyle?.color === '#B7C8BD'))
                              .reduce((sum, l) => sum + (l.value || 0), 0);
      }

      newDataSourceText += ` | 水系样本: ${waterCount} | 气候样本: ${climateCount} | 植被样本: ${vegeCount}`;

    } else if (viewMode === 'waterSystem' && selectedWaterSystem) {
      const dynastyRiverRoot = riverDataByDynasty[currentDynasty] || riverDataByDynasty.overview || {};
      const waterSystemData = dynastyRiverRoot[selectedWaterSystem] || {};
      newNodes = waterSystemData.nodes || [];
      newLinks = waterSystemData.links || [];

      let totalFlow = 0;
      if (newLinks.length > 0 && newNodes.length > 0) {
        const sourceNodeName = newNodes.find(n => n.depth === 0)?.name || selectedWaterSystem;
        totalFlow = newLinks.filter(l => l.source === sourceNodeName)
                             .reduce((sum, l) => sum + (l.value || 0), 0);
      }
      newDataSourceText = `数据来源：北京历史时空数据 (${dynastyLabel}) - 水系: ${selectedWaterSystem}`;
      newDataSourceText += ` | 总流量: ${totalFlow}`;

    } else if (viewMode === 'waterSystem' && !selectedWaterSystem) {
        newDataSourceText = `数据来源：北京历史时空数据 (${dynastyLabel}) - 请选择一个水系。`;
    }

    setChartData({ nodes: newNodes, links: newLinks });
    setDataSourceText(newDataSourceText);

  }, [currentDynasty, selectedDynasties, viewMode, selectedWaterSystem, climateVegeDataByDynasty, riverDataByDynasty, isDataLoading]);

  const handleViewModeChange = (e) => {
    setViewMode(e.target.value);
  };

  const handleWaterSystemChange = (e) => {
    setSelectedWaterSystem(e.target.value);
  };

  // 如果数据正在加载
  if (isDataLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.noDataMessage}>
          正在加载数据，请稍候...
        </div>
      </div>
    );
  }

  // 如果数据加载失败
  if (dataLoadError) {
    return (
      <div style={styles.container}>
        <div style={styles.noDataMessage}>
          数据加载失败: {dataLoadError}
        </div>
      </div>
    );
  }

  const hasData = chartData.nodes.length > 0 && chartData.links.length > 0;
  const showChart = hasData && !(viewMode === 'waterSystem' && !selectedWaterSystem);

  // 获取显示标题
  const getDisplayTitle = () => {
    if (selectedDynasties.includes('overview')) {
      return '（全局总览）';
    } else if (selectedDynasties.length === 1) {
      return `（${selectedDynasties[0]}）`;
    } else {
      return `（${selectedDynasties.length}个时期合并）`;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.subtitle}>{getDisplayTitle()}基于水系、气候、植被数据的多维时空分析</div>

      <div style={styles.controls}>
        <div style={styles.controlGroup}>
          <label style={styles.controlLabel}>视图模式：</label>
          <select
            style={styles.controlSelect}
            value={viewMode}
            onChange={handleViewModeChange}
          >
            <option value="overview">生态环境总览</option>
            <option value="waterSystem">主要水系分析</option>
          </select>
        </div>

        {viewMode === 'waterSystem' && (
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>选择水系：</label>
            {availableWaterSystems.length > 0 ? (
              <select
                style={styles.controlSelect}
                value={selectedWaterSystem}
                onChange={handleWaterSystemChange}
              >
                {availableWaterSystems.map((ws) => (
                  <option key={ws} value={ws}>
                    {ws}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{fontSize: '13px', color: '#777', marginLeft: '5px'}}> (当前朝代无可选水系)</span>
            )}
          </div>
        )}
      </div>

      <div style={styles.chartWrapper}>
        {showChart ? (
          <SankeyChart nodes={chartData.nodes} links={chartData.links} />
        ) : (
          <div style={styles.noDataMessage}>
            当前选择没有可显示的数据。
            {viewMode === 'waterSystem' && availableWaterSystems.length === 0 && " (该朝代下无水系数据)"}
          </div>
        )}
      </div>

      {showChart && <Legend items={legendItems} />}
      <div style={styles.dataSource}>{dataSourceText}</div>
    </div>
  );
};

export default BeijingEcology;