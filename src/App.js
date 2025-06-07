// src/App.js
import React from 'react';
import './App.css';
import EChartsChart from './components/EChartsChart.jsx';
import GridLayout from './components/GridLayout';
import HistoricalTimeline from './components/HistoricalTimeline';
import BeijingEcology from "./components/WaterClimateVegeChartTestEnhanced";
import HistoricalDataClusterAnalysis from './components/HistoricalDataClusterAnalysis';
import useDynastyStore from './store/dynastyStore';
import GeoChart from "./components/GeoChart";
import ProductVis from "./components/ProductVis";
import TransportationNetwork from "./components/Traffic/TransportationNetwork.jsx";
// 在 App.js 或主组件顶部添加
import 'bootstrap/dist/css/bootstrap.min.css';
import AdministrativeTree from './components/AdministrativeTree/AdministrativeTree';
import Event from './components/ReformTimeline/Event';
import Merce from './components/Merce/Merce';
// 图片需要放到项目public目录或使用import
import qinImage from './images/秦.png';
import TrafficHubAnalysis from './components/Traffic/TrafficHubAnalysis';

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

// 地图视图切换组件（移到App外部避免重新创建）
const MapViewToggle = () => {
  const [currentView, setCurrentView] = React.useState('geoChart'); // 'geoChart' 或 'transportation'
  const { selectedRoute } = useDynastyStore();

  // 监听选中路线变化，自动切换到交通路网视图
  React.useEffect(() => {
    if (selectedRoute) {
      console.log('🎯 App: 检测到选中路线，自动切换到交通路网视图', selectedRoute);
      setCurrentView('transportation');
    }
  }, [selectedRoute]);

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
          {currentView === 'geoChart' ? '古城地图' : '历朝历代交通路网'}
        </h3>
        
        {/* 右侧按钮 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setCurrentView(currentView === 'geoChart' ? 'transportation' : 'geoChart')}
            style={{
              padding: '4px 8px',
              border: '1px solid #8C6D46',
              borderRadius: '4px',
              background: currentView === 'geoChart' ? '#8C6D46' : 'white',
              color: currentView === 'geoChart' ? 'white' : '#8C6D46',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: "'Noto Serif SC', serif",
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (currentView === 'geoChart') {
                e.target.style.background = '#6B5B47';
              } else {
                e.target.style.background = 'rgba(140, 109, 70, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentView === 'geoChart') {
                e.target.style.background = '#8C6D46';
              } else {
                e.target.style.background = 'white';
              }
            }}
          >
            {currentView === 'geoChart' ? '切换到交通路网' : '切换到古城地图'}
          </button>
        </div>
      </div>
      
      {/* 内容区域 */}
      <div style={{height: 'calc(100% - 40px)', width: '100%'}}>
        {currentView === 'geoChart' ? (
          <GeoChart />
        ) : (
          <TransportationNetwork />
        )}
      </div>
    </>
  );
};

function App() {
  // 从Zustand store获取选中的朝代
  const { selectedDynasties, getSelectedDisplayNames, getPrimaryDynasty } = useDynastyStore();
  
  // 物产可视化数据点显示控制状态
  const [showDataPoints, setShowDataPoints] = React.useState(true);
  
  // 物产详情视图状态管理
  const [showDetailView, setShowDetailView] = React.useState(false);
  const [selectedDynastyForDetail, setSelectedDynastyForDetail] = React.useState(null);
  const [selectedCategoryForDetail, setSelectedCategoryForDetail] = React.useState(null);
  
  // 词云视图状态管理
  const [showWordCloud, setShowWordCloud] = React.useState(false);
  const [selectedDynastyForWordCloud, setSelectedDynastyForWordCloud] = React.useState(null);

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
        <h3>北京生态环境长期演化轨迹</h3>
        {/* 传递主要朝代给BeijingEcology组件 */}
        <BeijingEcology dynastyToDisplay={getPrimaryDynasty()} />
      </div>
  );

  const rightBottom = (
    <div className="chart-container">
      <h3>交通枢纽分析</h3>
      <div style={{height: '100%', width: '100%'}}>
        <TrafficHubAnalysis />
      </div>
    </div>
  );

  const centerTop = (
      <div className="chart-container">
        {/* 替换为历史数据聚类与相关性分析组件 */}
        <HistoricalDataClusterAnalysis />
      </div>
  );

  // const centerBottom = (
  //     <div className="chart-container map-container">
  //         <h3>古城地图</h3>
  //         {/* 地图组件 - 确保有足够的高度显示 */}
  //         <div style={{height: 'calc(100% - 40px)', width: '100%'}}>
  //             <GeoChart/>
  //         </div>
  //     </div>
  // );

  const centerBottom = (
    <div className="chart-container">
        <MapViewToggle />
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
      <h3>建筑文化遗产</h3>
      <div className="container">
      <div className="row" style={{ width: 590, marginTop: 2 }}>
        {/* 左侧信息面板 */}
        <div className="col-md-3" style={{ border: '1px solid #b4a293', padding: 0 }}>
          <div className="row" style={{ padding: 0, height: 5, backgroundColor: '#ad8d66', margin: 0 }} />
          
          <div className="row" style={{ margin: 2 }}>
            <img src={qinImage} alt="秦朝" style={{ height: 80, padding: 0 }} />
          </div>
          
          <InfoRow label="建制制度：" value="郡县制" bold />
          <InfoRow label="行政机构：" value="郡守" />
          <InfoRow label="军事机构：" value="郡尉" />
          <InfoRow label="是否为都城：" value="否" />
        </div>

        {/* 主图表区域 */}
        <div className="col-md-9" id="main" style={{ padding: 0 }}>
           <AdministrativeTree />
        </div>
      </div>

      {/* 下方图表区域 */}
      <div className="row" style={{ width: 650, marginTop: 2, padding: 0 }} id="chart" />
      <Event />
      <div className="row" style={{ width: 650, marginTop: 2, padding: 0, fontFamily: '楷体' }} id="chart1" />
      <Merce />
    </div>
    </div>
  );

  // 使用新的历史时间轴组件，支持多选
  const timeline = <HistoricalTimeline />;

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