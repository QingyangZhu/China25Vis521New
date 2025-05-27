import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';
import './Event.css'; // 确保引入样式文件

const Event = () => {
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // 设置图表尺寸
    const width = 610;
    const height = 200;
    const margin = { top: 30, right: 45, bottom: 20, left: 20 };
    // 清除旧的 SVG
    d3.select("#chart").select("svg").remove();

    // 创建SVG容器
    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("padding", "0")
      .attr("height", height);

    // 定义评分颜色
    const scoreColors = {
      '政治评分': '#F4A261',
      '经济评分': '#FAE3D9',
      '社会评分': '#A8D5BA',
      '军事评分': '#D2691E',
      '民生评分': '#C68642'
    };

    // 读取CSV文件
    Promise.all([
        d3.csv(`${process.env.PUBLIC_URL}/data/建制沿革/jianzhi_count.csv`),
        d3.csv(`${process.env.PUBLIC_URL}/data/建制沿革/jianzhi.csv`)
    ]).then(function ([countData, eventData]) {
      // 过滤"秦代"时期（-221到-207）
      const filterData = countData.filter(d => {
        const year = +d['年份'];
        const era = d['历史时期'];
        return era === '西汉' && year >= -206 && year <= 8;
      });

      // 过滤事件数据
      const filterEventData = eventData.filter(d => {
        const era = d['历史时期'];
        return era === '西汉';
      });

      // 创建年份数据映射：没有的年份记为0
      const yearMap = new Map();
      // 初始化所有年份为0
      for (let y = -206; y <= 8; y++) {
        yearMap.set(y, {
          count: 0,
          events: []  // 存储每年的所有事件
        });
      }

      // 填充有数据的年份
      filterData.forEach(d => {
        const year = +d['年份'];
        const currentData = yearMap.get(year);
        currentData.count = +d['总改革次数'] || 0;
      });

      // 添加事件数据
      filterEventData.forEach(d => {
        // 从变革时间中提取年份
        const reformTime = d['具体变革时间'];
        if (reformTime) {
          // 尝试从变革时间中提取年份
          const yearMatch = reformTime.match(/-?\d+/);
          if (yearMatch) {
            const year = +yearMatch[0];
            // 只处理秦代时期的事件
            if (year >= -206 && year <= 8) {
              const currentData = yearMap.get(year);
              // 只有当该年有变革次数时才添加事件
              if (currentData.count > 0) {
                currentData.events.push({
                  name: d['制度改革名称'],
                  importance: +d['变化重要性'] || 0,
                  political: d['政治原因'],
                  ecommerce: d['经济原因'],
                  society: d['社会原因'],
                  military: d['军事原因'],
                  livelihood: d['民生原因'],
                  result: d['变迁结果']
                });
              }
            }
          }
        }
      });

      // 转换为数组（排序）
      const dataPoints = Array.from(yearMap, ([year, data]) => ({
        year,
        count: data.count,
        events: data.events,
        scores: filterData.find(d => +d['年份'] === year) || {
          '政治评分': 0,
          '经济评分': 0,
          '社会评分': 0,
          '军事评分': 0,
          '民生评分': 0
        },
        totalImportance: filterData.find(d => +d['年份'] === year)?.['总变化重要性'] || 0  // 添加总变化重要性
      })).sort((a, b) => a.year - b.year);

      // 定义比例尺
      const xScale = d3.scaleLinear()
        .domain([-206, 8])
        .range([margin.left, width - margin.right]);

      const yMax = d3.max(dataPoints, d => d.count);
      const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .nice()
        .range([height - margin.bottom, margin.top + 30]);

      // 绘制X轴
      const xAxis = d3.axisBottom(xScale)
        .tickFormat(d => d);
      svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(xAxis);

      svg.append("text")
        .attr("x", width - margin.right + 5)
        .attr("y", height - 1)
        .attr("fill", "black")
        .attr("text-anchor", "end")
        .attr("font-size", "11px")
        .attr("font-family", "楷体")
        .text("年份");

      // 绘制Y轴
      const yAxis = d3.axisLeft(yScale)
        .ticks(6);  // 设置Y轴刻度数量为6
      svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(yAxis)
        .append("text")
        .attr("x", -margin.left)
        .attr("y", margin.top + 20)
        .attr("fill", "black")
        .attr("text-anchor", "start")
        .attr("font-family", "楷体")
        .text("变革次数");

      // 绘制线
      const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.count))
        .curve(d3.curveStepAfter); // 使用curveStepAfter，让阶梯覆盖到下一个点

      svg.append("path")
        .datum(dataPoints)
        .attr("fill", "none")
        .attr("stroke", "#a5a8ad")
        .attr("stroke-width", 2)
        .attr("d", line);

      // 创建颜色比例尺
      const colorScale = d3.scaleSequential()
        .domain([-2, 5])  // 变化重要性范围0-5
        .interpolator(d3.interpolateRgbBasis([
          "#f3fcf6",
          "#f3fdf7",
          "#E8F5ED",  // 0 - 最浅的绿色
          "#D1EBDC",  // 1
          "#BAE1CB",  // 2
          "#afd7bf",  // 3
          "#9ad5b2",  // 4
          "#86dca9"   // 5 - 目标绿色
        ]));

// 在非零点绘制堆叠矩形
dataPoints.forEach(d => {
    if (d.count > 0) {
      const centerX = xScale(d.year);
      // 计算相邻两个年份之间的像素距离
      const yearDistance = xScale(-205) - xScale(-206); // 取相邻年份的距离作为参考
      const rectWidth = yearDistance * 0.8; // 矩形宽度为年份间距的80%
      const rectHeight = 6; // 矩形高度
      const centerY = yScale(d.count);
      const outerRadius = 12; // 外圆半径
      const innerRadius = 6;  // 内圆半径

      // 计算所有评分类型的总和作为满分
      const totalScore = Object.entries(d.scores).reduce((sum, [key, value]) => {
        if (key.includes('评分')) {
          return sum + +value;
        }
        return sum;
      }, 0);

      if (totalScore === 0) return;

      // 创建圆环图的弧生成器
      const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);

      // 创建饼图布局
      const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

      // 准备数据
      const pieData = Object.entries(d.scores)
        .filter(([key]) => key.includes('评分'))
        .map(([key, value]) => ({
          key,
          value: +value
        }));

      // 创建圆环图组
      const g = svg.append("g")
        .attr("transform", `translate(${centerX + yearDistance / 2}, ${centerY - 20})`);

      // 绘制圆环
      g.selectAll("path")
        .data(pie(pieData))
        .enter()
        .append("path")
        .attr("d", arc)
        .attr("fill", (d, i) => Object.values(scoreColors)[i])
        .style("opacity", 0.8)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
          // 创建tooltip2
          const tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip2");

          // 更新提示框内容
          tooltip.html(`
            <h4>${d.data.key}</h4>
            <p><strong>评分：</strong>${d.data.value}</p>
          `);

          // 定位提示框
          const [x, y] = d3.pointer(event);
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
          // 移除tooltip2
          d3.selectAll(".tooltip2").remove();
        });

      // 绘制中心圆
      g.append("circle")
        .attr("r", innerRadius)
        .attr("fill", "#fff")
        .attr("stroke", d3.scaleSequential()
          .domain([0, 5])
          .interpolator(d3.interpolateRgbBasis([
            "#f5f0e6",  // 最浅的金色
            "#f0e8d8",  // 浅金色
            "#e6dcc9",  // 淡金色
            "#dcc9b0",  // 中金色
            "#c9b088",  // 深金色
            "#b88c2c"   // 目标金色
          ]))(d.totalImportance)) // 使用新的颜色比例尺
        .attr("stroke-width", 1);

      // 绘制矩形
      for (let i = 0; i < d.count; i++) {
        const rectY = yScale(i); // 从0开始向上堆叠
        const event = d.events[i] || { importance: 0 };  // 获取对应的事件数据

        svg.append("rect")
          .attr("x", centerX + (yearDistance - rectWidth) / 2) // 矩形水平居中
          .attr("y", rectY - rectHeight)
          .attr("width", rectWidth)
          .attr("height", rectHeight)
          .attr("fill", colorScale(event.importance)) // 根据事件的变化重要性设置颜色
          .attr("stroke", colorScale(event.importance))
          .attr("stroke-width", 0.5)
          .style("cursor", "pointer")  // 添加鼠标指针样式
          .on("click", function() {
            // 检查是否已经存在tooltip
            const existingTooltip = d3.select(".tooltip1");

            if (existingTooltip.empty()) {
              // 如果不存在tooltip，创建新的
              const tooltip = d3.select("body")
                .append("div")
                .attr("class", "tooltip1");

              // 更新提示框内容
              tooltip.html(`
                <h4>${event.name || '未命名事件'}</h4>
                <p><strong>政治影响：</strong>${event.political || '无'}</p>
                <p><strong>经济影响：</strong>${event.ecommerce || '无'}</p>
                <p><strong>社会影响：</strong>${event.society || '无'}</p>
                <p><strong>军事影响：</strong>${event.military || '无'}</p>
                <p><strong>民生影响：</strong>${event.livelihood || '无'}</p>
                <p><strong>变迁结果：</strong>${event.result || '无'}</p>
              `);

              // 定位提示框
              const rect = this.getBoundingClientRect();
              tooltip
                .style("left", (rect.left + window.scrollX + 10) + "px")
                .style("top", (rect.top + window.scrollY - 10) + "px");
            } else {
              // 如果已存在tooltip，移除它
              existingTooltip.remove();
            }
          });
      }
    }
  });
  const legend = svg.append("g")
  .attr("transform", `translate(${margin.left+100}, ${margin.top - 10})`); // 调整图例位置

// 图例项
const legendItems = Object.entries(scoreColors);
const legendItemWidth = 20;
  const legendItemHeight = 5;
  const legendSpacing = 65;

// 添加图例项
legendItems.forEach(([key, color], index) => {
  const legendRow = legend.append("g")
    .attr("transform", `translate(${index * (legendItemWidth + legendSpacing)}, 0)`); // 每个图例项的水平间距

  legendRow.append("rect")
    .attr("width", 15)
    .attr("height", 5)
    .attr("fill", color);

  legendRow.append("text")
    .attr("x", 20)
    .attr("y", 7)
    .text(key)
    .attr("font-size", "12px")
    .attr("fill", "#666")
    .attr("font-family", "楷体");
});

    }).catch(function (error) {
      console.error("读取或处理文件出错：", error);
    });

    // 清理SVG容器
    return () => {
      d3.select("#chart").select("svg").remove();
    };
  }, []);

  return (
    <div>
      <div id="chart"></div>
      {tooltipData && (
        <div
          className="tooltip1"
          style={{
            position: 'fixed',
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            pointerEvents: 'none',
          }}
        >
          <h4>{tooltipData.key}</h4>
          <p><strong>评分：</strong>{tooltipData.value}</p>
        </div>
      )}
    </div>
  );
};

export default Event;