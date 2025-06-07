// src/components/ShowAllWaterChart.jsx
import React, { useState, useMemo, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

const width = 1200;
const height = 700;
const DEFAULT_SCALE_VALUE = 0.5;
const MIN_LINK_VALUE_THRESHOLD = 0.1;
const MAX_LINKS_PER_NODE = 10;

const functions = [
  '交通运输',
  '防洪排水',
  '农业灌溉',
  '生活用水',
  '城市防御',
  '城市景观',
  '政治象征',
];

function getRiverTypeString(type) {
  return type === 2 || type === 2.0 ? '人工河流' : '自然河流';
}

function hasFunction(river, func) {
  if (!river.relation_to_city || river.relation_to_city === '无') return false;
  if (typeof river.relation_to_city === 'string') {
    return river.relation_to_city.split(/[、,]/).map(f => f.trim()).includes(func);
  }
  return false;
}

function getSiltationColor(siltation) {
  if (!siltation || siltation === '无' || siltation === 0 || siltation === '0') return '#B8C49E';
  return '#E5B8A2';
}

export default function RiverSankeyMerged({
  selectedDynasties = [],
  chartHeight = height,
  chartWidth = width,
}) {
  const [allRiverData, setAllRiverData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/river_split_structured.json')
      .then(res => {
        if (!res.ok) throw new Error('加载数据失败');
        return res.json();
      })
      .then(data => {
        setAllRiverData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('加载 river_split_structured.json 出错:', err);
        setLoading(false);
      });
  }, []);

  const dynastiesToUse = (selectedDynasties && selectedDynasties.length > 0)
    ? selectedDynasties
    : allRiverData ? Object.keys(allRiverData) : [];

  const combinedRivers = useMemo(() => {
    if (!allRiverData || dynastiesToUse.length === 0) return [];
    if (dynastiesToUse.length === 1) {
      return allRiverData[dynastiesToUse[0]] || [];
    } else {
      let combined = [];
      dynastiesToUse.forEach(dyn => {
        combined = combined.concat(
          (allRiverData[dyn] || []).map(r => ({ ...r, originalDynasty: dyn }))
        );
      });
      return combined;
    }
  }, [allRiverData, dynastiesToUse]);

  const option = useMemo(() => {
    if (loading) {
      return {
        title: { text: '数据加载中...', left: 'center', top: 'middle' },
        series: []
      };
    }
    if (!allRiverData) {
      return {
        title: { text: '数据加载失败', left: 'center', top: 'middle' },
        series: []
      };
    }
    if (combinedRivers.length === 0) {
      return {
        title: { text: `无有效河流数据`, left: 'center', top: 'middle' },
        series: []
      };
    }

    const filteredRivers = combinedRivers.filter(r => r.name && r.name.trim() !== '无' && r.name.trim() !== '');

    const uniqueNodes = new Map();

    ['自然河流', '人工河流'].forEach(name => {
      if (!uniqueNodes.has(name)) {
        uniqueNodes.set(name, {
          name,
          itemStyle: {
            color: name === '人工河流' ? '#CBD8D0' : '#B7C8BD',
            borderColor: 'transparent'
          },
          depth: 0, // 指定深度，保证左侧一列
        });
      }
    });

    functions.forEach(name => {
      if (!uniqueNodes.has(name)) {
        uniqueNodes.set(name, {
          name,
          itemStyle: { color: '#F5D9A4', borderColor: 'transparent' },
          depth: 1, // 中间一列
        });
      }
    });

    filteredRivers.forEach(river => {
      if (!uniqueNodes.has(river.name)) {
        uniqueNodes.set(river.name, {
          name: river.name,
          itemStyle: { color: '#DFE7D9', borderColor: 'transparent' },
          depth: 2, // 右侧一列
        });
      }
    });

    const calculatedLinks = [];
    functions.forEach(func => {
      const naturalRiversForFunc = filteredRivers.filter(r => getRiverTypeString(r.type) === '自然河流' && hasFunction(r, func));
      const naturalSum = naturalRiversForFunc.reduce((sum, r) => {
        const scaleVal = parseFloat(r.scale);
        return sum + (r.scale === '无' || isNaN(scaleVal) || scaleVal <= 0 ? DEFAULT_SCALE_VALUE : scaleVal);
      }, 0);
      if (naturalSum > 0) {
        calculatedLinks.push({ source: '自然河流', target: func, value: naturalSum });
      }
      const artificialRiversForFunc = filteredRivers.filter(r => getRiverTypeString(r.type) === '人工河流' && hasFunction(r, func));
      const artificialSum = artificialRiversForFunc.reduce((sum, r) => {
        const scaleVal = parseFloat(r.scale);
        return sum + (r.scale === '无' || isNaN(scaleVal) || scaleVal <= 0 ? DEFAULT_SCALE_VALUE : scaleVal);
      }, 0);
      if (artificialSum > 0) {
        calculatedLinks.push({ source: '人工河流', target: func, value: artificialSum });
      }
    });

    filteredRivers.forEach(river => {
      functions.forEach(func => {
        if (hasFunction(river, func)) {
          const scaleVal = parseFloat(river.scale);
          const value = river.scale === '无' || isNaN(scaleVal) || scaleVal <= 0 ? DEFAULT_SCALE_VALUE : scaleVal;
          if (value > 0) {
            calculatedLinks.push({
              source: func,
              target: river.name,
              value,
              lineStyle: { color: getSiltationColor(river.siltation) }
            });
          }
        }
      });
    });

    const activeNodeNames = new Set();
    const valueFilteredLinks = calculatedLinks
      .filter(link => link.value >= MIN_LINK_VALUE_THRESHOLD)
      .sort((a, b) => b.value - a.value);

    const limitedLinks = [];
    const nodeLinkCount = {};
    valueFilteredLinks.forEach(link => {
      const { source, target } = link;
      nodeLinkCount[source] = (nodeLinkCount[source] || 0) + 1;
      nodeLinkCount[target] = (nodeLinkCount[target] || 0) + 1;
      if (nodeLinkCount[source] <= MAX_LINKS_PER_NODE && nodeLinkCount[target] <= MAX_LINKS_PER_NODE) {
        limitedLinks.push(link);
        activeNodeNames.add(source);
        activeNodeNames.add(target);
      }
    });

    const echartsNodesData = Array.from(activeNodeNames).map(name => {
      const node = uniqueNodes.get(name);
      if (!node) return { name };
      // 固定x坐标实现三列布局，x是百分比字符串，y自动布局
      let x = 0;
      if (node.depth === 0) x = 0.05;    // 左5%
      else if (node.depth === 1) x = 0.5; // 中50%
      else if (node.depth === 2) x = 0.95; // 右95%
      return {
        ...node,
        x: `${x * 100}%`,
        // 不设置y，让echarts自动计算竖向位置
      };
    });

    if (echartsNodesData.length === 0 || limitedLinks.length === 0) {
      return {
        title: { text: `无可展示的河流连接数据`, left: 'center', top: 'middle' },
        series: []
      };
    }

    return {
      backgroundColor: '#fff',
      title: {
        text: dynastiesToUse.length > 1
          ? `${dynastiesToUse.join('、')} 水系功能分类详情图 (合并)`
          : `${dynastiesToUse[0]} 水系功能分类详情图`,
        left: 'center'
      },
      tooltip: { trigger: 'item', triggerOn: 'mousemove' },
      graphic: [
        {
          type: 'group',
          left: 'center',
          bottom: 15,
          children: [
            // 第一个图例项 - 河流状况良好
            {
              type: 'rect',
              left: -80,
              top: 0,
              shape: {
                x: 0,
                y: 0,
                width: 20,
                height: 12
              },
              style: {
                fill: '#B8C49E'
              }
            },
            {
              type: 'text',
              left: -55,
              top: 6,
              style: {
                text: '河流状况良好',
                fontSize: 12,
                fill: '#333'
              }
            },
            // 第二个图例项 - 河流存在淤积
            {
              type: 'rect',
              left: 30,
              top: 0,
              shape: {
                x: 0,
                y: 0,
                width: 20,
                height: 12
              },
              style: {
                fill: '#E5B8A2'
              }
            },
            {
              type: 'text',
              left: 55,
              top: 6,
              style: {
                text: '河流存在淤积',
                fontSize: 12,
                fill: '#333'
              }
            }
          ]
        }
      ],
      series: [
        {
          type: 'sankey',
          layout: 'none', // 手动布局
          emphasis: { focus: 'adjacency' },
          data: echartsNodesData,
          links: limitedLinks,
          top: '8%',
          right: '12%',
          left: '5%',
          bottom: '15%', // 增加底部空间给图例
          nodeWidth: 12,  // 节点宽度减小
          nodeGap: 10,    // 节点间距减小
          layoutIterations: 32,
          draggable: false,  // 关闭拖拽避免破坏布局
          label: {
            show: true,
            color: '#333',
            fontSize: 7,
            formatter: params => (params.name.length > 12 ? `${params.name.slice(0, 12)}...` : params.name),
          },
          lineStyle: {
            color: 'source',
            curveness: 0.4,
            opacity: 0.6,
          },
          levels: [
            { depth: 0, lineStyle: { opacity: 0.5 } },
            { depth: 1, lineStyle: { opacity: 0.5 } },
            { depth: 2, label: { fontSize: 6 } }
          ],
        }
      ],
    };
  }, [combinedRivers, dynastiesToUse, allRiverData, loading]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 20 }}>数据加载中...</div>;
  }
  if (!allRiverData) {
    return <div style={{ textAlign: 'center', padding: 20, color: 'red' }}>数据加载失败</div>;
  }

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ height: chartHeight, width: chartWidth }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}