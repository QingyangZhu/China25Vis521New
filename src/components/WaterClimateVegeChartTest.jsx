import React, { useEffect, useState, useRef } from 'react';
import * as echarts from 'echarts';
import ReactDOM from 'react-dom';
import useDynastyStore from '../store/dynastyStore';
import RiverDetailSankey from './ShowAllWaterChart';

const defaultLegend = [
  { color: '#3498db', label: '水系数据源' },
  { color: '#e74c3c', label: '气候数据源' },
  { color: '#27ae60', label: '植被数据源' },
  { color: '#f39c12', label: '交通运输' },
  { color: '#e67e22', label: '防洪排水' },
  { color: '#d35400', label: '生活用水' },
  { color: '#ff9f43', label: '城市景观' },
  { color: '#feca57', label: '农业灌溉' },
  { color: '#ff6b6b', label: '城市防御' },
  { color: '#fd79a8', label: '政治象征' },
  { color: '#B0BEC5', label: '未知功能' },
];

const initialDataSourceText = '数据加载中...';

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

const RiverDetailPopup = ({ children, position, onClose }) => {
  const maxWidth = window.innerWidth * 0.7;
  const maxHeight = window.innerHeight * 0.6;

  const width = Math.max(400, Math.min(maxWidth, 600));
  const height = Math.max(300, Math.min(maxHeight, 450));

  const maxX = window.innerWidth - width - 10;
  const maxY = window.innerHeight - height - 10;
  const finalLeft = Math.min(position.x, maxX);
  const finalTop = Math.min(position.y, maxY);

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
    <div style={style}>
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
  const { selectedDynasties } = useDynastyStore();
  const [chartData, setChartData] = useState({ nodes: [], links: [] });
  const [dataSourceText, setDataSourceText] = useState(initialDataSourceText);

  const [showHoverChart, setShowHoverChart] = useState(false);
  const [hoverPos, setHoverPos] = useState({ x: 100, y: 100 });
  const lastHoverPos = useRef({ x: 0, y: 0 });
  const hideTimeoutRef = useRef(null);

  const [viewMode, setViewMode] = useState('overview');
  const [selectedWaterSystem, setSelectedWaterSystem] = useState('');
  const [availableWaterSystems, setAvailableWaterSystems] = useState([]);
  const [riverInfo, setRiverInfo] = useState({});

  // 加载 overview 和 ecology 数据
  useEffect(() => {
    const fetchOverview = async () => {
      const dyn = selectedDynasties.length > 0 ? selectedDynasties[0] : 'overview';
      try {
        const res = await fetch('/data/river_climate_vege_data.json');
        const json = await res.json();
        const data = json[dyn] || {};
        setChartData({ nodes: data.nodes || [], links: data.links || [] });
        setDataSourceText(`数据来源：北京历史时空数据 (${dyn})`);
      } catch (e) {
        setDataSourceText('数据加载失败');
        console.error(e);
      }
    };
    if (viewMode === 'overview') fetchOverview();
  }, [selectedDynasties, viewMode]);

  // 加载 water system 信息
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch('/data/river_info_data.json');
        const json = await res.json();
        setRiverInfo(json);
      } catch (e) {
        console.error('加载 water system 信息失败:', e);
      }
    };
    fetchInfo();
  }, []);

  // 更新 waterSystem 下拉选项
  useEffect(() => {
    if (viewMode === 'waterSystem') {
      const dynasty = selectedDynasties[0] || 'overview';
      const systems = Object.keys(riverInfo[dynasty] || {});
      setAvailableWaterSystems(systems);
      if (!systems.includes(selectedWaterSystem)) {
        setSelectedWaterSystem(systems[0] || '');
      }
    }
  }, [viewMode, riverInfo, selectedDynasties, selectedWaterSystem]);

  // 加载具体水系数据
  useEffect(() => {
    if (viewMode === 'waterSystem' && selectedWaterSystem && selectedDynasties.length > 0) {
      const dynastyKey = selectedDynasties[0];
      const systemData = riverInfo[dynastyKey]?.[selectedWaterSystem];
      if (systemData) {
        setChartData({ nodes: systemData.nodes || [], links: systemData.links || [] });
        setDataSourceText(`数据来源：北京历史时空数据 (${dynastyKey}) - 水系: ${selectedWaterSystem}`);
      }
    }
  }, [viewMode, selectedWaterSystem, selectedDynasties, riverInfo]);

  const hasData = chartData.nodes.length > 0 && chartData.links.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '10px', textAlign: 'center' }}>
        生态环境演化分析
      </div>

      <div>
        <label>视图模式：</label>
        <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
          <option value="overview">生态环境总览</option>
          <option value="waterSystem">主要水系分析</option>
        </select>

        {viewMode === 'waterSystem' && (
          <>
            <label style={{ marginLeft: '20px' }}>选择水系：</label>
            <select value={selectedWaterSystem} onChange={(e) => setSelectedWaterSystem(e.target.value)}>
              {availableWaterSystems.map((ws) => (
                <option key={ws} value={ws}>{ws}</option>
              ))}
            </select>
          </>
        )}
      </div>

      <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        {hasData ? (
          <>
            <SankeyChart
              nodes={chartData.nodes}
              links={chartData.links}
              onHoverWaterNode={viewMode === 'overview' ? (pos) => {
                clearTimeout(hideTimeoutRef.current);
                const dx = Math.abs(pos.x - lastHoverPos.current.x);
                const dy = Math.abs(pos.y - lastHoverPos.current.y);
                if (dx > 5 || dy > 5) {
                  setHoverPos(pos);
                  setShowHoverChart(true);
                  lastHoverPos.current = pos;
                }
              } : null}
              onLeaveChart={viewMode === 'overview' ? () => {
                hideTimeoutRef.current = setTimeout(() => {
                  setShowHoverChart(false);
                  lastHoverPos.current = { x: 0, y: 0 };
                }, 150);
              } : null}
            />
            {showHoverChart && viewMode === 'overview' && (
                <RiverDetailPopup
                  position={{ x: hoverPos.x + 10, y: hoverPos.y + 10 }}
                  onClose={() => setShowHoverChart(false)}
                >
                <RiverDetailSankey selectedDynasties={selectedDynasties} />
                </RiverDetailPopup>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#777' }}>无可显示数据</div>
        )}
      </div>

      {hasData && <Legend items={defaultLegend} />}
      <div style={{ fontSize: '10px', color: '#868e96', textAlign: 'center', padding: '8px 0 5px 0' }}>
        {dataSourceText}
      </div>
    </div>
  );
};

export default BeijingEcology;
