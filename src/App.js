// src/App.js
import React from 'react';
import './App.css';
import EChartsChart from './components/EChartsChart.jsx';
import GridLayout from './components/GridLayout';
import HistoricalTimeline from './components/HistoricalTimeline';
import BeijingEcology from "./components/WaterClimateVegeChartTest";
import useDynastyStore from './store/dynastyStore';
import GeoChart from "./components/GeoChart";
import ProductVis from "./components/ProductVis";


function App() {
  // 从Zustand store获取选中的朝代
  const { selectedDynasties, getSelectedDisplayNames, getPrimaryDynasty } = useDynastyStore();

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

  const leftBottom = (
      <div className="chart-container">
        <h3>水利工程与城市发展</h3>
        <EChartsChart option={barChartOption}/>
      </div>
  );

  const centerTop = (
      <div className="chart-container">
        <h3>古城地图与空间变迁</h3>
        <p style={{textAlign: 'center', paddingTop: '20px'}}>(地图展示区域)</p>
        <EChartsChart option={barChartOption}/>
      </div>
  );

  const centerBottom = (
      <div className="chart-container map-container">
          <h3>古城地图</h3>
          {/* 地图组件 - 确保有足够的高度显示 */}
          <div style={{height: 'calc(100% - 40px)', width: '100%'}}>
              <GeoChart/>
          </div>
      </div>
  );

const rightTop = (
  <div className="chart-container">
      <h3>物产分布与演变</h3>
      <div style={{height: 'calc(100% - 40px)', width: '100%'}}>
          <ProductVis />
      </div>
  </div>
);

    const rightBottom = (
        <div className="chart-container">
      <h3>建筑文化遗产</h3>
      <EChartsChart option={barChartOption} />
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

export default App;