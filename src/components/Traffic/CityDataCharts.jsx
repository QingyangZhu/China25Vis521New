import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { TooltipComponent, TitleComponent, LegendComponent, PolarComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import useDynastyStore from '../../store/dynastyStore';

// 注册ECharts组件
echarts.use([BarChart, TooltipComponent, TitleComponent, LegendComponent, PolarComponent, CanvasRenderer]);

// (颜色和属性配置保持不变)
const ATTRIBUTE_COLORS = {
    'regime_change': '#E8C4A0',
    'urban_reconstruction': '#D4C2A0',
    'urban_expansion': '#F0E4B8',
    'population_change_positive': '#B8C8D4',
    'population_change_negative': '#A8B4C0',
    'population_change_neutral': '#B0C0CC',
    'economic_cultural_impact_positive': '#C0D4C0',
    'economic_cultural_impact_negative': '#B0C4B0',
    'economic_cultural_impact_neutral': '#B8CCC8'
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
    const [forceUpdateKey, setForceUpdateKey] = useState(0);

    // 根据朝代过滤数据 (保持不变)
    const filterByDynasty = (data) => {
        if (selectedDynasty === '全部') return data;
        return data.filter(row => {
            const rowDynasties = String(row.dynasty || '').split('、').map(d => d.trim());
            return rowDynasties.includes(selectedDynasty);
        });
    };
    
    // 处理数据并进行归一化（比例编码） (保持不变)
    const processAndScaleData = (data) => {
        const rawValues = COMMON_ATTRIBUTE_CONFIG.map(attr => {
            const sum = (field) => data.reduce((acc, r) => acc + Number(r[field] || 0), 0);
            const value = (attr.positiveLabel || attr.isMagnitude) ? Math.abs(sum(attr.key)) : sum(attr.key);
            return { originalValue: value };
        });

        const maxValue = Math.max(...rawValues.map(d => d.originalValue));

        if (maxValue === 0) {
            return rawValues.map(d => ({ ...d, value: 0 }));
        }

        return rawValues.map(d => ({
            originalValue: d.originalValue,
            value: d.originalValue / maxValue
        }));
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

        const dataSources = [
            { name: '战争', data: filteredWarData, color: '#D49C6A' },
            { name: '灾害', data: filteredDisasterData, color: '#A0C1B8' },
            { name: '事件', data: filteredEventData, color: '#B8A48E' }
        ];

        const availableDataSources = dataSources.filter(ds => ds.data && ds.data.length > 0);

        if (availableDataSources.length === 0) {
            chartRef.current.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-family: '楷体', serif;">请选择古城数据项查看属性分析</div>`;
            return;
        }
        
        const chart = echarts.init(chartRef.current);
        const angleAxisData = COMMON_ATTRIBUTE_CONFIG.map(attr => attr.label);
        
        const series = [];
        const legendData = [];

        availableDataSources.forEach(source => {
            series.push({
                name: source.name,
                type: 'bar',
                coordinateSystem: 'polar',
                barWidth: '60%',
                data: processAndScaleData(source.data).map(item => ({
                    ...item,
                    itemStyle: { color: source.color }
                })),
            });

            // [核心修改] 为图例数据同时提供名称和颜色
            // 这样可以确保图例标记的颜色与系列颜色一致
            legendData.push({
                name: source.name,
                itemStyle: {
                    color: source.color
                }
            });
        });
        
        const legendConfig = {
            show: true,
            data: legendData, // 现在 data 是一个对象数组，ECharts会用其中的 itemStyle
            selectedMode: 'single',
            orient: 'horizontal',
            top: 5,
            left: 'center',
            itemWidth: 12,
            itemHeight: 8,
            itemGap: 15,
            textStyle: {
                fontSize: 10,
                fontFamily: "'楷体', 'KaiTi', serif"
            },
            // [核心修改] 默认选中项的 key 需要是图例的 name 字符串
            selected: {
                // legendData[0] 是一个对象, 我们需要它的 name 属性作为 key
                [legendData[0].name]: true
            }
        };

        const option = {
            tooltip: {
                trigger: 'item',
                formatter: function (params) {
                    return `${params.seriesName}<br/>${angleAxisData[params.dataIndex]}: ${params.data.originalValue}`;
                }
            },
            legend: legendConfig,
            polar: {
                radius: [0, '62%'],
                center: ['50%', '38%']
            },
            angleAxis: {
                type: 'category',
                data: angleAxisData,
                axisLabel: {
                    fontSize: 9,
                    fontFamily: "'楷体', 'KaiTi', serif",
                    color: '#8C6D46',
                    distance: 15,
                    margin: 5,
                },
                axisLine: { show: false },
                splitLine: {
                    show: true,
                    lineStyle: { color: '#DCD1BB', width: 1, type: 'dashed', opacity: 0.6 }
                },
                axisTick: { show: false }
            },
            radiusAxis: {
                type: 'value',
                max: 1,
                axisLabel: { show: false },
                axisLine: { show: false },
                splitLine: { show: false },
                axisTick: { show: false }
            },
            series: series
        };

        chart.setOption(option, { notMerge: true });
        chartInstanceRef.current = chart;
    };

    // 以下的 Hooks (useEffect) 保持不变
    const dataKey = `${warData.length}-${disasterData.length}-${eventData.length}-${selectedDynasty}-${showCityData.war}-${showCityData.disaster}-${showCityData.event}-${forceUpdateKey}`;
    
    useEffect(() => {
        renderCombinedPolarChart();
    }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const timer = setTimeout(() => {
            setForceUpdateKey(prev => prev + 1);
        }, 100);
        return () => clearTimeout(timer);
    }, [warData, disasterData, eventData]);

    useEffect(() => {
        let resizeTimer = null;
        const handleWindowResize = () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
                    try {
                        chartInstanceRef.current.resize();
                    } catch (error) {
                        console.warn('Chart resize warning:', error);
                    }
                }
            }, 300);
        };
        window.addEventListener('resize', handleWindowResize);
        return () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            window.removeEventListener('resize', handleWindowResize);
        };
    }, []);

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
                fontFamily: "'楷体', 'KaiTi', 'STKaiti', '华文楷体', 'AR PL UKai CN', 'Kaiti SC', 'Noto Serif SC', serif"
            }}
        />
    );
};

export default CityDataCharts;