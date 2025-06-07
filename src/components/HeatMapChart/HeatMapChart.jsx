import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import * as d3 from 'd3'; // Assuming d3 is still used for CSV loading

const HeatmapChart = ({ dynasty, startYear, endYear, width = '1100px', height = '260px' }) => {
    const chartRef = useRef(null);
    const myChart = useRef(null); // Use a ref to store the ECharts instance

    useEffect(() => {
        // Initialize ECharts instance if it doesn't exist
        if (!myChart.current) {
            myChart.current = echarts.init(chartRef.current);
        }

        // Define event types
        const eventTypes = ['灾害', '战争', '事件'];

        // Generate years array
        const years = [];
        for (let i = startYear; i <= endYear; i++) {
            years.push(i.toString());
        }

        // Initialize chart option structure
        const option = {
            tooltip: {
                position: 'top',
                formatter: function(params) {
                    const data = params.data;
                    let html = '<div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">' +
                        (parseInt(data.value[0]) + startYear) + '年</div>';

                    if (data.data[2] === '战争') {
                        html += '<div>战争名称: ' + data.data[3] + '</div>';
                        html += '<div>交战双方: ' + data.data[4] + '</div>';
                        html += '<div>战争影响: ' + data.data[5] + '</div>';
                        html += '<div>战争激烈程度: ' + data.data[6] + '</div>';
                    } else if (data.data[2] === '灾害') {
                        html += '<div>灾害类型: ' + data.data[3] + '</div>';
                        html += '<div>灾害影响: ' + data.data[4] + '</div>';
                        html += '<div>灾害发生次数: ' + data.data[5] + '</div>';
                    } else {
                        html += '<div>事件类型: ' + data.data[2] + '</div>';
                        html += '<div>事件描述: ' + data.data[3] + '</div>';
                        if (data.data[4]) html += '<div>影响: ' + data.data[4] + '</div>';
                        if (data.data[5]) html += '<div>备注: ' + data.data[5] + '</div>';
                    }
                    return html;
                }
            },
            grid: {
                left: '3%',
                right: '2%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                show: false,
                type: 'category',
                data: years,
                splitArea: {
                    show: true
                },
                axisLabel: {
                    interval: 50,
                    rotate: 45
                }
            },
            yAxis: {
                type: 'category',
                data: eventTypes,
                splitArea: {
                    show: true
                }
            },
            visualMap: {
                show: false,
                min: 1,
                max: 5,
                calculable: true,
                orient: 'vertical',
                itemHeight: '80px',
                right: '5%',
                top: '30%',
                height: '150px',
                inRange: {
                    color: ['#f7e8d0', '#e6c9a8', '#d4a373', '#bc6c25', '#a47148']
                }
            },
            series: []
        };

        // Load data
        Promise.all([
            d3.csv('/data/灾害1.csv'),
            d3.csv('/data/战争1.csv'),
            d3.csv('/data/事件1.csv')
        ]).then(function([disasters, wars, events]) {
            const disasterCounts = {};
            disasters.filter(d => d['历史时期'] === dynasty).forEach(d => {
                const year = parseInt(d['具体时间']);
                disasterCounts[year] = (disasterCounts[year] || 0) + 1;
            });

            const warCounts = {};
            wars.filter(d => d['历史时期'] === dynasty).forEach(d => {
                const year = parseInt(d['战争时间']);
                warCounts[year] = (warCounts[year] || 0) + 1;
            });

            const eventCounts = {};
            events.filter(d => d['历史时期'] === dynasty).forEach(d => {
                const year = parseInt(d['事件发生时间']);
                eventCounts[year] = (eventCounts[year] || 0) + 1;
            });

            const maxDisasterCount = Math.max(...Object.values(disasterCounts));
            const maxWarCount = Math.max(...Object.values(warCounts));
            const maxEventCount = Math.max(...Object.values(eventCounts));

            const tangDisasters = disasters.filter(d => d['历史时期'] === dynasty)
                .map(d => ({
                    value: [
                        parseInt(d['具体时间']) - startYear,
                        0,
                        parseInt(d['灾害影响'])
                    ],
                    data: [
                        parseInt(d['具体时间']) - startYear,
                        0,
                        '灾害',
                        d['灾害类型'],
                        d['灾害影响'],
                        d['灾害发生次数']
                    ]
                }));

            const tangWars = wars.filter(d => d['历史时期'] === dynasty)
                .map(d => ({
                    value: [
                        parseInt(d['战争时间']) - startYear,
                        1,
                        parseInt(d['战争激烈程度'])
                    ],
                    data: [
                        parseInt(d['战争时间']) - startYear,
                        1,
                        '战争',
                        d['战争名称'],
                        d['交战双方'],
                        d['战争影响'],
                        d['战争激烈程度']
                    ]
                }));

            const tangEvents = events.filter(d => d['历史时期'] === dynasty)
                .map(d => ({
                    value: [
                        parseInt(d['事件发生时间']) - startYear,
                        2,
                        parseInt(d['事件重要程度'])
                    ],
                    data: [
                        parseInt(d['事件发生时间']) - startYear,
                        2,
                        '事件',
                        d['事件概括'],
                        d['事件重要程度'],
                        d['备注']
                    ]
                }));

            const disasterLineData = years.map(yearStr => {
                const year = parseInt(yearStr);
                const count = disasterCounts[year] || 0;
                return [
                    year - startYear,
                    0 + (maxDisasterCount > 0 ? (count / maxDisasterCount) : 0),
                    count
                ];
            });

            const warLineData = years.map(yearStr => {
                const year = parseInt(yearStr);
                const count = warCounts[year] || 0;
                return [
                    year - startYear,
                    1 + (maxWarCount > 0 ? (count / maxWarCount) : 0),
                    count
                ];
            });

            const eventLineData = years.map(yearStr => {
                const year = parseInt(yearStr);
                const count = eventCounts[year] || 0;
                return [
                    year - startYear,
                    2 + (maxEventCount > 0 ? (count / maxEventCount) : 0),
                    count
                ];
            });

            // Update chart data
            option.series = [
                {
                    name: '灾害',
                    type: 'heatmap',
                    data: tangDisasters,
                    label: {
                        show: false
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                },
                {
                    name: '战争',
                    type: 'heatmap',
                    data: tangWars,
                    label: {
                        show: false
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                },
                {
                    name: '事件',
                    type: 'heatmap',
                    data: tangEvents,
                    label: {
                        show: false
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                },
                {
                    name: '灾害次数',
                    type: 'line',
                    data: disasterLineData,
                    symbol: 'none',
                    lineStyle: {
                        width: 2,
                        color: '#c69c9c'
                    },
                    z: 3,
                    yAxisIndex: 1,
                    smooth: false
                },
                {
                    name: '战争次数',
                    type: 'line',
                    data: warLineData,
                    symbol: 'none',
                    lineStyle: {
                        width: 2,
                        color: '#507987'
                    },
                    z: 3,
                    yAxisIndex: 1,
                    smooth: false
                },
                {
                    name: '事件次数',
                    type: 'line',
                    data: eventLineData,
                    symbol: 'none',
                    lineStyle: {
                        width: 2,
                        color: '#5d835d'
                    },
                    z: 3,
                    yAxisIndex: 1,
                    smooth: false
                }
            ];

            option.yAxis = [
                {
                    type: 'category',
                    data: eventTypes,
                    splitArea: {
                        show: true
                    }
                },
                {
                    type: 'value',
                    name: '次数',
                    min: 0,
                    max: 3,
                    show: false
                }
            ];

            myChart.current.setOption(option, true);
        }).catch(function(error) {
            console.error('数据加载错误:', error);
        });

        // Cleanup function
        return () => {
            if (myChart.current) {
                myChart.current.dispose();
                myChart.current = null; // Clear the ref
            }
        };

    }, [dynasty, startYear, endYear]); // Redraw chart if these props change

    return <div ref={chartRef} style={{ width, height,padding: '0px' }}></div>;
};

export default HeatmapChart; 