import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import * as d3 from 'd3';

const AdministrativeTree = ({ 
  dynastyName = '唐', 
  startYear = 624, 
  endYear = 627,
  currentTime = null // 从BeijingHistoryGraph传入的当前时间
}) => {
  console.log(currentTime);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [treeData, setTreeData] = useState(null);

  // 构建树数据
  const buildTreeData = (data) => {
    const root = { name: dynastyName, children: [] };
    
    data.forEach(row => {
      if (row['历史'] !== dynastyName) return;
      const rowStartYear = parseInt(row['开始时间']);
      const rowEndYear = parseInt(row['结束时间']);

      const level1 = row['一级行政划分'];
      const level2 = row['二级行政划分'];
      const level3 = row['划分下属'];

      // 一级节点处理
      let level1Node = root.children.find(c => c.name === level1);
      if (!level1Node) {
        level1Node = { 
          name: level1, 
          children: [],
          timeRange: `${rowStartYear}-${rowEndYear}`
        };
        root.children.push(level1Node);
      }

      // 二级节点处理
      let level2Node = level1Node.children.find(c => c.name === level2);
      if (!level2Node) {
        level2Node = { 
          name: level2, 
          children: [],
          timeRange: `${rowStartYear}-${rowEndYear}`
        };
        level1Node.children.push(level2Node);
      }

      // 三级节点处理
      if (level3?.trim()) {
        level3.split('、').forEach(subItem => {
          level2Node.children.push({ 
            name: subItem.trim(),
            timeRange: `${rowStartYear}-${rowEndYear}`
          });
        });
      }
    });

    return root;
  };

  // 根据当前时间过滤树数据
  const filterTreeByTime = (node, year) => {
    if (!node) return null;

    const [nodeStartYear, nodeEndYear] = node.timeRange.split('-').map(Number);
    const isInRange = year >= nodeStartYear && year <= nodeEndYear;

    if (!isInRange) return null;

    const filteredNode = {
      ...node,
      children: node.children ? node.children
        .map(child => filterTreeByTime(child, year))
        .filter(child => child !== null) : []
    };

    return filteredNode;
  };

  useEffect(() => {
    // 初始化图表
    const initChart = async () => {
      try {
        // 1. 获取数据
        const data = await d3.csv(`${process.env.PUBLIC_URL}/data/建制沿革/jianzhi_split_tree.csv`);
        
        // 2. 构建树数据
        const initialTreeData = buildTreeData(data);
        setTreeData(initialTreeData);

        // 3. 初始化ECharts实例
        if (!chartInstance.current) {
          chartInstance.current = echarts.init(chartRef.current);
        }
        
        // 4. 显示加载动画
        chartInstance.current.showLoading();

        // 5. 设置图表配置
        const option = {
          tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            formatter: function(params) {
              return `${params.name}<br/>${params.data.timeRange || ''}`;
            }
          },
          series: [{
            type: 'tree',
            data: [initialTreeData],
            top: '1%',
            left: '5%',
            bottom: '0',
            right: '12%',
            symbolSize: 4,
            nodePadding: 100,
            nodeGap: 200,
            label: {
              position: 'left',
              verticalAlign: 'middle',
              align: 'right',
              fontSize: 12,
              fontFamily: '楷体',
              formatter: function(params) {
                return `${params.name}\n${params.data.timeRange || ''}`;
              }
            },
            itemStyle: {
              color: '#b4a293',
              borderWidth: 1
            },
            lineStyle: {
              width: 1
            },
            leaves: {
              label: {
                position: 'right',
                verticalAlign: 'middle',
                align: 'left',
                fontFamily: '楷体',
                fontSize: 10,
                symbolSize: 3,
              }
            },
            emphasis: {
              focus: 'descendant'
            },
            expandAndCollapse: true,
            animationDuration: 550,
            animationDurationUpdate: 750
          }]
        };

        // 6. 应用配置并隐藏加载
        chartInstance.current.setOption(option);
        chartInstance.current.hideLoading();

        // 7. 响应式处理
        const handleResize = () => chartInstance.current?.resize();
        window.addEventListener('resize', handleResize);

        // 清理函数
        return () => {
          window.removeEventListener('resize', handleResize);
          chartInstance.current?.dispose();
        };

      } catch (error) {
        console.error("数据加载失败:", error);
      }
    };

    initChart();
  }, [dynastyName]);

  // 监听currentTime变化
  useEffect(() => {
    if (currentTime !== null && chartInstance.current && treeData) {
      // 根据当前时间过滤树数据
      const filteredTreeData = filterTreeByTime(treeData, currentTime);
      
      // 更新图表数据
      chartInstance.current.setOption({
        series: [{
          data: [filteredTreeData]
        }]
      });
    }
  }, [currentTime, treeData]);

  return (
    <div 
      ref={chartRef}
      style={{
        width: '100%',
        height: '170px',
        border: '1px solid #b4a293',
        marginTop: '2px'
      }}
    />
  );
};

export default AdministrativeTree;