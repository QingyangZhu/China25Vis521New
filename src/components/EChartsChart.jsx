import React from 'react';
import ReactECharts from 'echarts-for-react';

const EChartsChart = ({ option, style, className }) => {
  return (
    <ReactECharts
      option={option}
      style={style || { height: '400px', width: '100%' }}
      className={className}
    />
  );
};

export default EChartsChart;