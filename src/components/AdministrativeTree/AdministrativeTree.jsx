import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import * as d3 from 'd3';

const AdministrativeTree = ({ 
  dynastyName = '秦', 
  startYear = -221, 
  endYear = -207 
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    // 初始化图表
    const initChart = async () => {
      try {
        // 1. 获取数据
        const data = await d3.csv(`${process.env.PUBLIC_URL}/data/建制沿革/jianzhi_split_tree.csv`);
        
        // 2. 构建树数据
        const root = { name: dynastyName, children: [] };
        data.forEach(row => {
          if (row['历史'] !== dynastyName) return;

          const level1 = row['一级行政划分'];
          const level2 = row['二级行政划分'];
          const level3 = row['划分下属'];

          // 一级节点处理
          let level1Node = root.children.find(c => c.name === level1);
          if (!level1Node) {
            level1Node = { name: level1, children: [] };
            root.children.push(level1Node);
          }

          // 二级节点处理
          let level2Node = level1Node.children.find(c => c.name === level2);
          if (!level2Node) {
            level2Node = { name: level2, children: [] };
            level1Node.children.push(level2Node);
          }

          // 三级节点处理
          if (level3?.trim()) {
            level3.split('、').forEach(subItem => {
              level2Node.children.push({ name: subItem.trim() });
            });
          }
        });

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
              return `${params.name}<br/>${startYear}-${endYear}`;
            }
          },
          series: [{
            type: 'tree',
            data: [root],
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
  }, [dynastyName, startYear, endYear]);

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