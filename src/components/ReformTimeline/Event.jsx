import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';
import './Event.css';

const Event = ({ dynastyName = '秦', startYear = -221, endYear = -207 }) => {
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // 设置图表尺寸
    const width = 610;
    const height = 200;
    const margin = { top: 30, right: 35, bottom: 20, left: 20 };
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
      // 过滤指定朝代时期
      const filterData = countData.filter(d => {
        const year = +d['年份'];
        const era = d['历史时期'];
        return era === dynastyName && year >= startYear && year <= endYear;
      });

      // 过滤事件数据
      const filterEventData = eventData.filter(d => {
        const era = d['历史时期'];
        return era === dynastyName;
      });

      // 创建年份数据映射：没有的年份记为0
      const yearMap = new Map();
      // 初始化所有年份为0
      for (let y = startYear; y <= endYear; y++) {
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
            // 只处理指定时期的事件
            if (year >= startYear && year <= endYear) {
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
        totalImportance: filterData.find(d => +d['年份'] === year)?.['总变化重要性'] || 0
      })).sort((a, b) => a.year - b.year);

      // 定义比例尺
      const xScale = d3.scaleLinear()
        .domain([startYear, endYear])
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
        .ticks(6);
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
        .curve(d3.curveStepAfter);

      svg.append("path")
        .datum(dataPoints)
        .attr("fill", "none")
        .attr("stroke", "#a5a8ad")
        .attr("stroke-width", 2)
        .attr("d", line);

      // 创建颜色比例尺
      const colorScale = d3.scaleSequential()
        .domain([-2, 5])
        .interpolator(d3.interpolateRgbBasis([
          "#f3fcf6",
          "#f3fdf7",
          "#E8F5ED",
          "#D1EBDC",
          "#BAE1CB",
          "#afd7bf",
          "#9ad5b2",
          "#86dca9"
        ]));

      // 在非零点绘制堆叠矩形
      dataPoints.forEach(d => {
        if (d.count > 0) {
          const centerX = xScale(d.year);
          const yearDistance = xScale(startYear + 1) - xScale(startYear);
          const rectWidth = yearDistance * 0.8;
          const rectHeight = 6;
          const centerY = yScale(d.count);
          const outerRadius = 12;
          const innerRadius = 6;

          const totalScore = Object.entries(d.scores).reduce((sum, [key, value]) => {
            if (key.includes('评分')) {
              return sum + +value;
            }
            return sum;
          }, 0);

          if (totalScore === 0) return;

          const arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);

          const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

          const pieData = Object.entries(d.scores)
            .filter(([key]) => key.includes('评分'))
            .map(([key, value]) => ({
              key,
              value: +value
            }));

          const g = svg.append("g")
            .attr("transform", `translate(${centerX + yearDistance / 2}, ${centerY - 20})`);

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
              const tooltip = d3.select("body")
                .append("div")
                .attr("class", "tooltip2");

              tooltip.html(`
                <h4>${d.data.key}</h4>
                <p><strong>评分：</strong>${d.data.value}</p>
              `);

              const [x, y] = d3.pointer(event);
              tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
              d3.selectAll(".tooltip2").remove();
            });

          g.append("circle")
            .attr("r", innerRadius)
            .attr("fill", "#fff")
            .attr("stroke", d3.scaleSequential()
              .domain([0, 5])
              .interpolator(d3.interpolateRgbBasis([
                "#f5f0e6",
                "#f0e8d8",
                "#e6dcc9",
                "#dcc9b0",
                "#c9b088",
                "#b88c2c"
              ]))(d.totalImportance))
            .attr("stroke-width", 1);

          for (let i = 0; i < d.count; i++) {
            const rectY = yScale(i);
            const event = d.events[i] || { importance: 0 };

            svg.append("rect")
              .attr("x", centerX + (yearDistance - rectWidth) / 2)
              .attr("y", rectY - rectHeight)
              .attr("width", rectWidth)
              .attr("height", rectHeight)
              .attr("fill", colorScale(event.importance))
              .attr("stroke", colorScale(event.importance))
              .attr("stroke-width", 0.5)
              .style("cursor", "pointer")
              .on("click", function() {
                const existingTooltip = d3.select(".tooltip1");

                if (existingTooltip.empty()) {
                  const tooltip = d3.select("body")
                    .append("div")
                    .attr("class", "tooltip1");

                  tooltip.html(`
                    <h4>${event.name || '未命名事件'}</h4>
                    <p><strong>政治影响：</strong>${event.political || '无'}</p>
                    <p><strong>经济影响：</strong>${event.ecommerce || '无'}</p>
                    <p><strong>社会影响：</strong>${event.society || '无'}</p>
                    <p><strong>军事影响：</strong>${event.military || '无'}</p>
                    <p><strong>民生影响：</strong>${event.livelihood || '无'}</p>
                    <p><strong>变迁结果：</strong>${event.result || '无'}</p>
                  `);

                  const rect = this.getBoundingClientRect();
                  tooltip
                    .style("left", (rect.left + window.scrollX + 10) + "px")
                    .style("top", (rect.top + window.scrollY - 10) + "px");
                } else {
                  existingTooltip.remove();
                }
              });
          }
        }
      });

      const legend = svg.append("g")
        .attr("transform", `translate(${margin.left+100}, ${margin.top - 10})`);

      const legendItems = Object.entries(scoreColors);
      const legendItemWidth = 20;
      const legendItemHeight = 5;
      const legendSpacing = 65;

      legendItems.forEach(([key, color], index) => {
        const legendRow = legend.append("g")
          .attr("transform", `translate(${index * (legendItemWidth + legendSpacing)}, 0)`);

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

    return () => {
      d3.select("#chart").select("svg").remove();
    };
  }, [dynastyName, startYear, endYear]); // 添加依赖项

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