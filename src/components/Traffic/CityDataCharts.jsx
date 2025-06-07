import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { TooltipComponent, TitleComponent, LegendComponent, PolarComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import useDynastyStore from '../../store/dynastyStore';

echarts.use([BarChart, TooltipComponent, TitleComponent, LegendComponent, PolarComponent, CanvasRenderer]);

// 古典风格配色方案 - 基于中国传统色彩的浅色调
const ATTRIBUTE_COLORS = {
  'regime_change': '#E8C4A0',        // 浅朱砂色 - 政权更替
  'urban_reconstruction': '#D4C2A0', // 浅赭石色 - 城市重建
  'urban_expansion': '#F0E4B8',      // 浅藤黄色 - 城市扩建
  'population_change_positive': '#B8C8D4',  // 浅花青色 - 人口流入
  'population_change_negative': '#A8B4C0',  // 降低饱和度的花青色 - 人口流出
  'population_change_neutral': '#B0C0CC',   // 中性花青色 - 人口稳定
  'economic_cultural_impact_positive': '#C0D4C0',  // 浅石绿色 - 文化兴盛
  'economic_cultural_impact_negative': '#B0C4B0',  // 降低饱和度的石绿色 - 文化衰退
  'economic_cultural_impact_neutral': '#B8CCC8'    // 中性石绿色 - 文化稳定
};

const COMMON_ATTRIBUTE_CONFIG = [
  { key: 'regime_change', label: '政权更替', isMagnitude: true }, 
  { key: 'urban_reconstruction', label: '城市重建', isMagnitude: true },
  { key: 'urban_expansion', label: '城市扩建', isMagnitude: true }, 
  { key: 'population_change', label: '人口变化', positiveLabel: '人口流入', negativeLabel: '人口流出', neutralLabel: '人口稳定' },
  { key: 'economic_cultural_impact', label: '文经影响', positiveLabel: '文化兴盛', negativeLabel: '文化衰退', neutralLabel: '文化稳定' }
];

const CityDataCharts = ({ warData, disasterData, eventData, selectedDynasty, showCityData }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // 获取属性对应的颜色
  const getAttributeColor = (attributeConfig, value) => {
    const { key, positiveLabel, negativeLabel } = attributeConfig;
    
    if (positiveLabel && negativeLabel) {
      if (value > 0) {
        return ATTRIBUTE_COLORS[`${key}_positive`];
      } else if (value < 0) {
        return ATTRIBUTE_COLORS[`${key}_negative`];
      } else {
        return ATTRIBUTE_COLORS[`${key}_neutral`];
      }
    } else {
      return ATTRIBUTE_COLORS[key] || '#E0E0E0';
    }
  };

  // 根据朝代过滤数据
  const filterByDynasty = (data) => {
    if (selectedDynasty === '全部') return data;
    return data.filter(row => {
      const rowDynasties = String(row.dynasty || '').split('、').map(d => d.trim());
      return rowDynasties.includes(selectedDynasty);
    });
  };

  // 处理单个数据类型并生成系列数据
  const processDataForSeries = (data, dataType, seriesColor) => {
    if (!data || data.length === 0) return [];
    
    const sum = (field) => data.reduce((acc, r) => acc + Number(r[field] || 0), 0);
    const absSum = (field) => Math.abs(sum(field));
    
    return COMMON_ATTRIBUTE_CONFIG.map(attr => {
      const total = sum(attr.key);
      const value = (attr.positiveLabel || attr.isMagnitude) ? absSum(attr.key) : sum(attr.key);
      
      return {
        value,
        itemStyle: { color: seriesColor }
      };
    });
  };

  const renderCombinedPolarChart = () => {
    if (!chartRef.current) return;
    
    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose();
      chartInstanceRef.current = null;
    }

    const filteredWarData = showCityData.war ? filterByDynasty(warData) : [];
    const filteredDisasterData = showCityData.disaster ? filterByDynasty(disasterData) : [];
    const filteredEventData = showCityData.event ? filterByDynasty(eventData) : [];

    // 检查是否有任何数据
    const hasData = filteredWarData.length > 0 || filteredDisasterData.length > 0 || filteredEventData.length > 0;
    
    if (!hasData) {
      chartRef.current.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #666;
          font-family: 'Noto Serif SC', serif;
        ">
          请选择古城数据项查看属性分析
        </div>
      `;
      return;
    }

    const chart = echarts.init(chartRef.current);
    
    // 属性标签
    const angleAxisData = COMMON_ATTRIBUTE_CONFIG.map(attr => attr.label);
    
    // 生成系列数据
    const series = [];
    const legendData = [];
    
    // 系列颜色配置
    const seriesColors = {
      '战争': '#D49C6A',
      '灾害': '#A0C1B8', 
      '事件': '#B8A48E'
    };

    if (showCityData.war && filteredWarData.length > 0) {
      series.push({
        name: '战争',
        type: 'bar',
        data: processDataForSeries(filteredWarData, 'war', seriesColors['战争']),
        coordinateSystem: 'polar',
        barWidth: '35%',
        barGap: '5%',
        itemStyle: {
          color: seriesColors['战争']
        }
      });
      legendData.push({
        name: '战争',
        itemStyle: { color: seriesColors['战争'] }
      });
    }
    
    if (showCityData.disaster && filteredDisasterData.length > 0) {
      series.push({
        name: '灾害',
        type: 'bar',
        data: processDataForSeries(filteredDisasterData, 'disaster', seriesColors['灾害']),
        coordinateSystem: 'polar',
        barWidth: '35%',
        barGap: '5%',
        itemStyle: {
          color: seriesColors['灾害']
        }
      });
      legendData.push({
        name: '灾害',
        itemStyle: { color: seriesColors['灾害'] }
      });
    }
    
    if (showCityData.event && filteredEventData.length > 0) {
      series.push({
        name: '事件',
        type: 'bar',
        data: processDataForSeries(filteredEventData, 'event', seriesColors['事件']),
        coordinateSystem: 'polar',
        barWidth: '35%',
        barGap: '5%',
        itemStyle: {
          color: seriesColors['事件']
        }
      });
      legendData.push({
        name: '事件',
        itemStyle: { color: seriesColors['事件'] }
      });
    }

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: function(params) {
          return `${params.seriesName}<br/>${angleAxisData[params.dataIndex]}: ${params.value}`;
        }
      },
      legend: {
        show: legendData.length > 1,
        data: legendData,
        orient: 'horizontal',
        top: 10,
        left: 'center',
        itemWidth: 12,
        itemHeight: 8,
        itemGap: 15,
        textStyle: { 
          fontSize: 8,
          fontFamily: "'Noto Serif SC', serif"
        }
      },
      polar: {
        radius: [0, '75%'],
        center: ['50%', '50%']
      },
      angleAxis: {
        type: 'category',
        data: angleAxisData,
        axisLabel: {
          fontSize: 9,
          fontFamily: "'Noto Serif SC', serif",
          color: '#8C6D46',
          distance: -80,
          margin: 0
        },
        axisLine: {
          show: false
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#DCD1BB',
            width: 1,
            type: 'dashed',
            opacity: 0.6
          }
        },
        axisTick: {
          show: false
        }
      },
      radiusAxis: {
        type: 'value',
        axisLabel: {
          show: false
        },
        axisLine: {
          show: false
        },
        splitLine: {
          show: false
        },
        axisTick: {
          show: false
        }
      },
      series: series
    };
    
    chart.setOption(option);
    chartInstanceRef.current = chart;
  };

  // 更新图表
  useEffect(() => {
    renderCombinedPolarChart();
  }, [warData, disasterData, eventData, selectedDynasty, showCityData]);

  // 监听窗口尺寸变化 - 使用window resize事件
  useEffect(() => {
    let resizeTimer = null;
    
    const handleWindowResize = () => {
      // 清除之前的定时器
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      
      // 添加防抖延迟
      resizeTimer = setTimeout(() => {
        if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
          try {
            chartInstanceRef.current.resize();
          } catch (error) {
            // 忽略resize过程中的错误
            console.warn('Chart resize warning:', error);
          }
        }
      }, 300); // 增加延迟时间
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  // 清理函数
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.dispose();
    };
  }, []);

  return (
    <div 
      ref={chartRef} 
      style={{ 
        width: '100%',
        height: '100%', 
        minHeight: '200px',
        fontFamily: "'Noto Serif SC', serif"
      }}
    />
  );
};

export default CityDataCharts; 