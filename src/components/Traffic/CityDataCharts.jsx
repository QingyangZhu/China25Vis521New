import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent, TitleComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import useDynastyStore from '../../store/dynastyStore';

echarts.use([PieChart, TooltipComponent, TitleComponent, LegendComponent, CanvasRenderer]);

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
  const warChartRef = useRef(null);
  const disasterChartRef = useRef(null);
  const eventChartRef = useRef(null);
  
  const warChartInstanceRef = useRef(null);
  const disasterChartInstanceRef = useRef(null);
  const eventChartInstanceRef = useRef(null);

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

  const renderNightingaleChart = (chartInstanceRef, containerElement, data, title, showLegend = false) => {
    if (!containerElement) return;
    
    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose();
      chartInstanceRef.current = null;
    }

    if (!data || data.length === 0) {
      containerElement.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #666;
          font-family: 'Noto Serif SC', serif;
        ">
          ${title}: 无相关数据
        </div>
      `;
      return;
    }

    const sum = (field) => data.reduce((acc, r) => acc + Number(r[field] || 0), 0);
    const absSum = (field) => Math.abs(sum(field));
    
    const chartValues = COMMON_ATTRIBUTE_CONFIG.map(attr => {
      const total = sum(attr.key);
      let name = attr.label;
      
      if (attr.positiveLabel && attr.negativeLabel) {
        if (total > 0) name = attr.positiveLabel;
        else if (total < 0) name = attr.negativeLabel;
        else name = attr.neutralLabel || attr.label;
      }
      
      const value = (attr.positiveLabel || attr.isMagnitude) ? absSum(attr.key) : sum(attr.key);
      const showLabelForThisSector = (name === '人口流入' || name === '文化兴盛') && value > 0;
      const color = getAttributeColor(attr, total);

      return {
        name,
        value,
        itemStyle: { color: color },
        label: { 
          show: showLabelForThisSector, 
          position: 'outside', 
          formatter: '{b}', 
          fontSize: 9 
        },
        labelLine: { show: showLabelForThisSector }
      };
    });

    const chart = echarts.init(containerElement);
    const option = {
      title: {
        text: title,
        left: 'center',
        top: 8,
        textStyle: { 
          fontSize: 13, 
          fontWeight: '600',
          fontFamily: "'Noto Serif SC', serif"
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)',
        position: function (point, params, dom, rect, size) {
          const chartContainerWidth = size.viewSize[0];
          const chartContainerHeight = size.viewSize[1];
          const tooltipWidth = size.contentSize[0];
          const tooltipHeight = size.contentSize[1];

          let x = point[0] + 20;
          let y = point[1] - tooltipHeight / 2;

          if (x + tooltipWidth > chartContainerWidth) {
            x = point[0] - tooltipWidth - 20;
          }

          if (x < 0) {
            x = 5;
          }

          if (y < 0) {
            y = 5;
          } else if (y + tooltipHeight > chartContainerHeight) {
            y = chartContainerHeight - tooltipHeight - 5;
          }

          return [x, y];
        }
      },
      legend: {
        show: showLegend,
        top: showLegend ? 30 : 'auto',
        left: 'center',
        textStyle: { 
          fontSize: 10,
          fontFamily: "'Noto Serif SC', serif"
        }
      },
      series: [{
        name: '属性值',
        type: 'pie',
        radius: [15, 45],
        center: ['50%', showLegend ? '65%' : '55%'],
        roseType: 'area',
        itemStyle: { 
          borderRadius: 4, 
          emphasis: { 
            shadowBlur: 8, 
            shadowOffsetX: 0, 
            shadowColor: 'rgba(0,0,0,0.4)' 
          }
        },
        label: { show: false },
        labelLine: { show: false },
        data: chartValues,
      }]
    };
    
    chart.setOption(option);
    chartInstanceRef.current = chart;
  };

  // 更新图表
  useEffect(() => {
    if (!warChartRef.current || !disasterChartRef.current || !eventChartRef.current) return;

    const filteredWarData = showCityData.war ? filterByDynasty(warData) : [];
    const filteredDisasterData = showCityData.disaster ? filterByDynasty(disasterData) : [];
    const filteredEventData = showCityData.event ? filterByDynasty(eventData) : [];

    renderNightingaleChart(
      warChartInstanceRef, 
      warChartRef.current, 
      filteredWarData, 
      '战争属性', 
      true
    );
    
    renderNightingaleChart(
      disasterChartInstanceRef, 
      disasterChartRef.current, 
      filteredDisasterData, 
      '灾害属性'
    );
    
    renderNightingaleChart(
      eventChartInstanceRef, 
      eventChartRef.current, 
      filteredEventData, 
      '事件属性'
    );
  }, [warData, disasterData, eventData, selectedDynasty, showCityData]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (warChartInstanceRef.current) warChartInstanceRef.current.dispose();
      if (disasterChartInstanceRef.current) disasterChartInstanceRef.current.dispose();
      if (eventChartInstanceRef.current) eventChartInstanceRef.current.dispose();
    };
  }, []);

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex',
      gap: '16px',
      padding: '16px',
      fontFamily: "'Noto Serif SC', serif"
    }}>
      <div 
        ref={warChartRef} 
        style={{ 
          flex: 1, 
          height: '100%', 
          minHeight: '180px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: 'rgba(251, 248, 240, 0.8)'
        }}
      />
      <div 
        ref={disasterChartRef} 
        style={{ 
          flex: 1, 
          height: '100%', 
          minHeight: '180px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: 'rgba(251, 248, 240, 0.8)'
        }}
      />
      <div 
        ref={eventChartRef} 
        style={{ 
          flex: 1, 
          height: '100%', 
          minHeight: '180px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: 'rgba(251, 248, 240, 0.8)'
        }}
      />
    </div>
  );
};

export default CityDataCharts; 