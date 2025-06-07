// src/App.js
import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import './App.css';
import EChartsChart from './components/EChartsChart.jsx';
import GridLayout from './components/GridLayout';
import HistoricalTimeline from './components/HistoricalTimeline';
import BeijingEcology from "./components/WaterClimateVegeChartTestEnhanced";
import HistoricalDataClusterAnalysis from './components/HistoricalDataClusterAnalysis';
import useDynastyStore from './store/dynastyStore';

import ProductVis from "./components/ProductAndPopulation/ProductVis.jsx";
import TransportationNetwork from "./components/Traffic/TransportationNetwork.jsx";
// 在 App.js 或主组件顶部添加
import 'bootstrap/dist/css/bootstrap.min.css';
import AdministrativeTree from './components/AdministrativeTree/AdministrativeTree';
import Event from './components/ReformTimeline/Event';
import Merce from './components/Merce/Merce';
import BeijingHistoryGraph from './components/BejingHistoryGraph/BeijingHistoryGraph';
import DynastyVisualization from './components/DynastyVisualization/DynastyVisualization';
import TimeControl from './components/TimeControl/TimeControl';
import DynastyInfo from './components/DynastyInfo/DynastyInfo';
import MerceArea from './components/MerceArea/MerceArea';

import TrafficHubAnalysis from './components/Traffic/TrafficHubAnalysis';
import CityDataCharts from './components/Traffic/CityDataCharts';

// 物产可视化控制组件
const ProductVisControls = ({ showDataPoints, setShowDataPoints, showDetailView, showWordCloud, onCloseDetailView, onCloseWordCloud }) => {
  console.log('ProductVisControls 渲染 - showDetailView:', showDetailView, 'showWordCloud:', showWordCloud);
  
  if (showDetailView || showWordCloud) {
    // 显示详情视图或词云视图时，显示返回按钮
    return (
      <button
        onClick={() => {
          console.log('返回按钮被点击');
          if (showDetailView) {
            onCloseDetailView();
          } else if (showWordCloud) {
            onCloseWordCloud();
          }
        }}
        style={{
          padding: '4px 8px',
          border: '1px solid #8C6D46',
          borderRadius: '4px',
          background: '#8C6D46',
          color: 'white',
          fontSize: '11px',
          cursor: 'pointer',
          fontFamily: "'Noto Serif SC', serif",
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#6B5B47';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = '#8C6D46';
        }}
      >
        ← 返回
      </button>
    );
  }

  // 正常情况下显示数据点控制按钮
  return (
    <button
      onClick={() => setShowDataPoints(!showDataPoints)}
      style={{
        padding: '4px 8px',
        border: '1px solid #8C6D46',
        borderRadius: '4px',
        background: showDataPoints ? '#8C6D46' : 'white',
        color: showDataPoints ? 'white' : '#8C6D46',
        fontSize: '11px',
        cursor: 'pointer',
        fontFamily: "'Noto Serif SC', serif",
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap'
      }}
      onMouseEnter={(e) => {
        if (showDataPoints) {
          e.target.style.background = '#6B5B47';
        } else {
          e.target.style.background = 'rgba(140, 109, 70, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (showDataPoints) {
          e.target.style.background = '#8C6D46';
        } else {
          e.target.style.background = 'white';
        }
      }}
    >
      {showDataPoints ? '隐藏数据点' : '显示数据点'}
    </button>
  );
};

// 中心顶部区域切换组件（包含两个视图：历史知识图谱、交通路网）
const CenterTopViewToggle = () => {
  const [currentView, setCurrentView] = React.useState('historyGraph'); // 'historyGraph', 'transportation'
  const { selectedRoute } = useDynastyStore();

  // 监听选中路线变化，自动切换到交通路网视图
  React.useEffect(() => {
    if (selectedRoute) {
      console.log('🎯 App: 检测到选中路线，自动切换到交通路网视图', selectedRoute);
      setCurrentView('transportation');
    }
  }, [selectedRoute]);

  const getViewTitle = () => {
    switch (currentView) {
      case 'historyGraph': return '北京历史知识图谱';
      case 'transportation': return '历朝历代交通路网';
      default: return '北京历史知识图谱';
    }
  };

  const getButtonLabel = (view) => {
    switch (view) {
      case 'historyGraph': return '知识图谱';
      case 'transportation': return '交通路网';
      default: return '知识图谱';
    }
  };

  const views = ['historyGraph', 'transportation'];

  return (
    <>
      {/* 标题和切换按钮 - 同一行，标题居中 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '16px',
        position: 'relative'
      }}>
        {/* 左侧占位 */}
        <div style={{ flex: 1 }}></div>
        
        {/* 中间标题 */}
        <h3 style={{ 
          margin: 0,
          flex: 1,
          textAlign: 'center',
          fontFamily: "'Noto Serif SC', serif",
          color: '#8C6D46'
        }}>
          {getViewTitle()}
        </h3>
        
        {/* 右侧按钮组 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
          {views.map((view) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              style={{
                padding: '4px 8px',
                border: '1px solid #8C6D46',
                borderRadius: '4px',
                background: currentView === view ? '#8C6D46' : 'white',
                color: currentView === view ? 'white' : '#8C6D46',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: "'Noto Serif SC', serif",
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (currentView === view) {
                  e.target.style.background = '#6B5B47';
                } else {
                  e.target.style.background = 'rgba(140, 109, 70, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentView === view) {
                  e.target.style.background = '#8C6D46';
                } else {
                  e.target.style.background = 'white';
                }
              }}
            >
              {getButtonLabel(view)}
            </button>
          ))}
        </div>
      </div>
      
      {/* 内容区域 */}
      <div style={{height: 'calc(100% - 40px)', width: '100%'}}>
        {currentView === 'historyGraph' && <BeijingHistoryGraph />}
        {currentView === 'transportation' && <TransportationNetwork />}
      </div>
    </>
  );
};

function App() {
  const [dynasty, setDynasty] = useState("隋");
  const [startYear, setStartYear] = useState(581);
  const [endYear, setEndYear] = useState(608);
  const [selectedDynasties, setSelectedDynasties] = useState(new Set(["隋"]));
  const [viewMode, setViewMode] = useState('comprehensive');

  // 添加全局错误处理器来抑制ResizeObserver错误
  useEffect(() => {
    const handleError = (event) => {
      if (event.message && event.message.includes('ResizeObserver loop completed with undelivered notifications')) {
        // 抑制ResizeObserver循环错误，这是一个已知的浏览器问题
        console.warn('ResizeObserver错误已被抑制:', event.message);
        event.preventDefault();
        return false;
      }
    };

    // 监听全局错误
    window.addEventListener('error', handleError);
    
    // 清理函数
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  // 添加缺失的状态变量
  const [selectedView, setSelectedView] = useState('overview');
  const [showDataPoints, setShowDataPoints] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [showWordCloud, setShowWordCloud] = useState(false);
  const [selectedDynastyForDetail, setSelectedDynastyForDetail] = useState(null);
  const [selectedCategoryForDetail, setSelectedCategoryForDetail] = useState(null);
  const [selectedDynastyForWordCloud, setSelectedDynastyForWordCloud] = useState(null);

  // 数据状态
  const [riverData, setRiverData] = useState([]);
  const [vegetationData, setVegetationData] = useState([]);
  const [climateData, setClimateData] = useState([]);
  const [populationData, setPopulationData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 地图数据
  const [beijingEcologyData, setBeijingEcologyData] = useState([]);
  const beijingEcologyRef = useRef(null);

  // 读取数据
  useEffect(() => {
    d3.csv('/data/1/river_sort.csv').then(setRiverData);
    d3.csv('/data/1/植被_2.csv').then(setVegetationData);
    d3.csv('/data/1/气候.csv').then(setClimateData);
    d3.csv('/data/人口/人口_change.csv').then(setPopulationData);
  }, []);



  // 加载 BeijingEcology 数据
  useEffect(() => {
    d3.csv('/data/beijing_ecology_data.csv').then(data => {
      setBeijingEcologyData(data);
    }).catch(error => {
      console.error('Error loading BeijingEcology data:', error);
    });
  }, []);

  const handleViewChange = (mode) => {
    setViewMode(mode);
  };

  // 处理打开详情视图
  const handleOpenDetailView = (dynasty, category) => {
    setSelectedDynastyForDetail(dynasty);
    setSelectedCategoryForDetail(category);
    setShowDetailView(true);
  };

  // 处理关闭详情视图
  const handleCloseDetailView = () => {
    console.log('handleCloseDetailView 被调用');
    console.log('当前状态 - showDetailView:', showDetailView);
    console.log('当前状态 - selectedDynastyForDetail:', selectedDynastyForDetail);
    console.log('当前状态 - selectedCategoryForDetail:', selectedCategoryForDetail);
    
    setShowDetailView(false);
    setSelectedDynastyForDetail(null);
    setSelectedCategoryForDetail(null);
    
    console.log('状态重置完成');
  };

  // 处理打开词云视图
  const handleOpenWordCloud = (dynasty) => {
    setSelectedDynastyForWordCloud(dynasty);
    setShowWordCloud(true);
  };

  // 处理关闭词云视图
  const handleCloseWordCloud = () => {
    setShowWordCloud(false);
    setSelectedDynastyForWordCloud(null);
  };

  // 从Zustand store获取选中的朝代
  const { 
    getSelectedDisplayNames, 
    getPrimaryDynasty, 
    cityData, 
    showCityDataInCharts, 
    selectedDynasties: storeDynasties 
  } = useDynastyStore();

  // 这barChartOption和legendData保持不变，用于其他图表
  const barChartOption = {
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: "'Noto Serif SC', serif",
      color: '#4A4A4A'
    },
    title: {
      textStyle: {
        fontFamily: "'Noto Serif SC', serif",
        fontWeight: 600,
        color: '#8C6D46'
      }
    },
    xAxis: {
      type: 'category',
      data: ['一月', '二月', '三月', '四月', '五月', '六月', '七月'],
      axisLine: {
        lineStyle: {
          color: '#DCD1BB'
        }
      },
      axisLabel: {
        fontFamily: "'Noto Serif SC', serif",
        color: '#4A4A4A'
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: '#DCD1BB'
        }
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(220, 209, 187, 0.3)'
        }
      },
      axisLabel: {
        fontFamily: "'Noto Serif SC', serif",
        color: '#4A4A4A'
      }
    },
    series: [
      {
        data: [120, 200, 150, 80, 70, 110, 130],
        type: 'bar',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              {offset: 0, color: '#8C6D46'},
              {offset: 1, color: '#BF9D7E'}
            ]
          }
        }
      }
    ]
  };

  // 自定义标题组件，移除了朝代选择器
  const CustomHeader = () => {
    const displayNames = getSelectedDisplayNames();
    const displayText = displayNames.length > 1 
      ? `${displayNames.length}个时期` 
      : displayNames[0];
      
    return (
      <div className="custom-header">
        <div className="header-decoration left"></div>
        <h1>京华时空 - 北京三千年城市演化可视分析平台</h1>
        <div className="header-dynasty-info">
          <span>当前选择: {displayText}</span>
        </div>
        <div className="header-decoration right"></div>
      </div>
    );
  };

  // 模拟各个区域的内容
  const header = <CustomHeader />;

  const leftTop = (
      <div className="chart-container">
        <h3 style={{ color: '#8C6D46' }}>北京生态环境长期演化轨迹</h3>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center', 
          marginBottom: '10px',
          paddingRight: '20px'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            alignItems: 'center'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="viewType"
                value="overview"
                checked={selectedView === 'overview'}
                onChange={(e) => setSelectedView(e.target.value)}
              />
              <span style={{ fontSize: '14px', color: '#8C6D46' }}>概况</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="viewType"
                value="detail"
                checked={selectedView === 'detail'}
                onChange={(e) => setSelectedView(e.target.value)}
              />
              <span style={{ fontSize: '14px', color: '#8C6D46' }}>具体</span>
            </label>
          </div>
        </div>
        {selectedView === 'overview' ? (
          <DynastyVisualization
            dynasty={dynasty}
            startYear={startYear}
            endYear={endYear}
            riverData={riverData}
            vegetationData={vegetationData}
            climateData={climateData}
            populationData={populationData}
          />
        ) : (
          <BeijingEcology ref={beijingEcologyRef} />
        )}
      </div>
  );

  const rightBottom = (
    <div className="chart-container">
      <h3 style={{ color: '#8C6D46' }}>交通枢纽分析</h3>
      <div style={{height: '100%', width: '100%'}}>
        <TrafficHubAnalysis />
      </div>
    </div>
  );

  const centerTop = (
      <div className="chart-container">
        <CenterTopViewToggle />
      </div>
  );



  // 使用从顶层获取的古城数据
  const { warData, disasterData, eventData } = cityData;
  const currentDynasty = storeDynasties.includes('overview') ? '全部' : storeDynasties[0];
  
  // 检查是否有数据需要显示
  const hasDataToShow = (showCityDataInCharts.war && warData.length > 0) ||
                       (showCityDataInCharts.disaster && disasterData.length > 0) ||
                       (showCityDataInCharts.event && eventData.length > 0);

  const centerBottom = (
    <div className="chart-container">
      <h3 style={{ 
        textAlign: 'center',
        fontFamily: "'Noto Serif SC', serif",
        color: '#8C6D46',
        margin: '8px 0'
      }}>
        古城数据属性分析
      </h3>
      
      <div style={{ height: 'calc(100% - 48px)', width: '100%' }}>
        {hasDataToShow ? (
          <CityDataCharts 
            warData={warData}
            disasterData={disasterData}
            eventData={eventData}
            selectedDynasty={currentDynasty}
            showCityData={showCityDataInCharts}
          />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#8C6D46',
            fontSize: '16px',
            fontFamily: "'Noto Serif SC', serif"
          }}>
            <div style={{ textAlign: 'center' }}>
              <p>请在交通路网地图中勾选古城数据项：</p>
              <ul style={{ listStyle: 'none', padding: 0, lineHeight: '2' }}>
                <li>⚔️ 战争数据</li>
                <li>🌪️ 灾害数据</li>
                <li>📜 事件数据</li>
              </ul>
              <p style={{ fontSize: '14px', color: '#999', marginTop: '16px' }}>
                选择后将在此处显示对应的属性分析图表
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

const rightTop = (
  <div className="chart-container">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '16px',
        position: 'relative'
      }}>
        {/* 左侧占位 */}
        <div style={{ flex: 1 }}></div>
        
        {/* 中间标题 */}
        <h3 style={{ 
          margin: 0, 
          flex: 1, 
          textAlign: 'center',
          fontFamily: "'Noto Serif SC', serif",
          color: '#8C6D46',
          whiteSpace: 'nowrap'
        }}>
          物产分布与演变
        </h3>
        
        {/* 右侧按钮 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <ProductVisControls 
            showDataPoints={showDataPoints} 
            setShowDataPoints={setShowDataPoints}
            showDetailView={showDetailView}
            showWordCloud={showWordCloud}
            onCloseDetailView={handleCloseDetailView}
            onCloseWordCloud={handleCloseWordCloud}
          />
        </div>
      </div>
      <div style={{height: 'calc(100% - 56px)', width: '100%'}}>
          <ProductVis 
            showDataPoints={showDataPoints}
            onOpenDetailView={handleOpenDetailView}
            showDetailView={showDetailView}
            selectedDynastyForDetail={selectedDynastyForDetail}
            selectedCategoryForDetail={selectedCategoryForDetail}
            onCloseDetailView={handleCloseDetailView}
            showWordCloud={showWordCloud}
            selectedDynastyForWordCloud={selectedDynastyForWordCloud}
            onOpenWordCloud={handleOpenWordCloud}
            onCloseWordCloud={handleCloseWordCloud}
          />
      </div>
  </div>
);

    const leftBottom = (
          <div className="chart-container">
      <h3 style={{ color: '#8C6D46' }}>建筑文化遗产</h3>
      <div className="container" style={{padding: '2px'}}>
      <div className="row" style={{ width: 590, marginTop: 2 }}>
        {/* 左侧信息面板 */}
        <div className="col-md-3" style={{ border: '1px solid #b4a293', padding: 0 }}>
          <div className="row" style={{ padding: 0, height: 5, backgroundColor: '#ad8d66', margin: 0 }} />
           <DynastyInfo dynastyName={dynasty} />
        </div>

        {/* 主图表区域 */}
        <div className="col-md-9" id="main" style={{ padding: 0,width:440 }}>
           <AdministrativeTree dynastyName={dynasty}
          startYear={startYear}
          endYear={endYear}/>
        </div>
      </div>

      {/* 下方图表区域 */}
      <div className="row" style={{ width: 650, marginTop: 2, padding: 0 }} id="chart" />
      <Event dynastyName={dynasty}
            startYear={startYear}
            endYear={endYear}/>
            <div className='row' style={{ 
                width: 580, 
                marginTop: 5, 
                padding: 0, 
                borderTop: '1px solid transparent',
                borderImage: 'linear-gradient(90deg, rgba(202,169,132,0.1), #c7a580, rgba(202,169,132,0.1)) 1'
            }}>
      <div id="chart1-controls" style={{ 
          display: 'flex', 
          marginBottom: '2px',
          marginTop: '5px',
          width: '650px'
      }}>
          <button 
              id="btn-view-3" 
              className={`view-btn ${viewMode === 'comprehensive' ? 'active' : ''}`}
              onClick={() => handleViewChange('comprehensive')}
              style={{
                  padding: '5px 5px',
                  border: '1px solid #8C6D46',
                  background: viewMode === 'comprehensive' ? '#8C6D46' : 'white',
                  color: viewMode === 'comprehensive' ? 'white' : '#8C6D46',
                  cursor: 'pointer',
                  fontSize: '12px',
                  margin: '0 5px',
                  transition: 'background-color 0.3s, color 0.3s',
                  outline: 'none'
              }}
          >
              <span>综合商业视图</span>
          </button>
          <button 
              id="btn-view-5" 
              className={`view-btn ${viewMode === 'regional' ? 'active' : ''}`}
              onClick={() => handleViewChange('regional')}
              style={{
                  padding: '5px 5px',
                  border: '1px solid #8C6D46',
                  background: viewMode === 'regional' ? '#8C6D46' : 'white',
                  color: viewMode === 'regional' ? 'white' : '#8C6D46',
                  cursor: 'pointer',
                  fontSize: '12px',
                  margin: '0 5px',
                  transition: 'background-color 0.3s, color 0.3s',
                  outline: 'none'
              }}
          >
              <span>分区商业视图</span>
          </button>
      </div>
      </div>
      <div className="row" style={{ width: 610, marginTop: 2, padding: 0, fontFamily: '楷体' }} id="chart1" />
          
          {viewMode === 'comprehensive' ? (
            <Merce 
              dynastyName={dynasty}
              startYear={startYear}
              endYear={endYear}
            />
          ) : (
            <MerceArea 
              dynastyName={dynasty}
            />
          )}
      </div>
    </div>
  );

  const handleDynastyClick = (selectedDynasties, startYear, endYear) => {
    // 更新选中的朝代
    setSelectedDynasties(new Set(selectedDynasties));
    
    // 更新当前显示的朝代
    setDynasty(selectedDynasties[0]);
    
    // 更新时间范围
    setStartYear(startYear);
    setEndYear(endYear);

    // 更新 BeijingEcology 数据
    if (beijingEcologyRef.current) {
        const filteredData = beijingEcologyData.filter(item => {
            const year = parseInt(item.year);
            return year >= startYear && year <= endYear;
        });
        beijingEcologyRef.current.updateData(filteredData);
    }
  };

  const handleTimeRangeChange = (startYear, endYear) => {
    setStartYear(startYear);
    setEndYear(endYear);

    // 更新 BeijingEcology 数据
    if (beijingEcologyRef.current) {
        const filteredData = beijingEcologyData.filter(item => {
            const year = parseInt(item.year);
            return year >= startYear && year <= endYear;
        });
        beijingEcologyRef.current.updateData(filteredData);
    }
  };

  // 使用新的时间轴组件
  const timeline = (
        <TimeControl
            onDynastyClick={handleDynastyClick}
            onTimeRangeChange={handleTimeRangeChange}
        />
  );

  return (
    <div className="App">
      <GridLayout
        header={header}
        leftTop={leftTop}
        leftBottom={leftBottom}
        centerTop={centerTop}
        centerBottom={centerBottom}
        rightTop={rightTop}
        rightBottom={rightBottom}
        timeline={timeline}
      />
    </div>
  );
}
// 子组件 - 信息行
const InfoRow = ({ label, value, bold = false }) => (
  <div className="row" style={{ fontFamily: '楷体', fontSize: bold ? 'inherit' : 12, fontWeight: bold ? 'bold' : 'normal' }}>
    <label>{label}<span>{value}</span></label>
  </div>
);

export default App;