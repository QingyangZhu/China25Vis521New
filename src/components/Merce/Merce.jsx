import React, { useEffect } from 'react';
import * as d3 from 'd3';
import './Merce.css'; // 确保引入样式文件

const Merce = () => {
  useEffect(() => {
    const margin = { top: 5, right: 40, bottom: 10, left: 20 };
    const width = 610;
    const height = 70;
    // 清除旧的 SVG
    d3.select("#chart1").select("svg").remove();

    // 创建第二个图表
    const svg2 = d3.select("#chart1")
      .append("svg")
      .attr("width", width)
      .attr("padding", "0")
      .attr("height", height);

    // 读取CSV文件
    Promise.all([
      d3.csv(`${process.env.PUBLIC_URL}/data/merce.csv`),
      d3.csv(`${process.env.PUBLIC_URL}/data/merce_event.csv`)
    ]).then(function ([merceData, eventData]) {
      // 只保留历史时期为"金"的数据
      const qinData = merceData.filter(d => d['历史时期'] === '金');
      const qinEvents = eventData.filter(d => d['历史时期'] === '金');

      // 计算最大数量
      const maxCount = d3.max(qinData, d =>
        Math.max(
          +d['传统商业数量'] || 0, +d['先进商业数量'] || 0,
          +d['传统手工业数量'] || 0, +d['先进手工业数量'] || 0,
          +d['传统技术数量'] || 0, +d['先进技术数量'] || 0
        )
      );

      // x轴为0~1，分三等分
      const xScale2 = d3.scaleLinear()
        .domain([0, 1])
        .range([margin.left, width - margin.right]);
      const yScale2 = d3.scaleLinear()
        .domain([0, maxCount])
        .range([margin.top, height - 20 - margin.bottom]);

      // 创建水平比例尺
      const levelScale = d3.scaleLinear()
        .domain([0, 5])  // 假设水平值范围是0-5
        .range([margin.top, height - 20 - margin.bottom]);

      // 绘制X轴
      const xAxis = svg2.append("g")
        .attr("transform", `translate(0, ${margin.top})`);

      // 添加x轴实线
      xAxis.append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("stroke", "#6e6c6c")
        .attr("stroke-width", 0.8);

      // 绘制Y轴
      const yAxis = svg2.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .attr("stroke-width", 0.8)
        .call(d3.axisLeft(yScale2).ticks(2));  // 控制刻度数量

      // 区域宽度
      const regionWidth = (width - margin.left - margin.right) / 3;

      // 区域分隔线
      svg2.append("line")
        .attr("x1", margin.left + regionWidth)
        .attr("y1", margin.top)
        .attr("x2", margin.left + regionWidth)
        .attr("y2", height - margin.bottom - 20)
        .attr("stroke", "#ccc")
        .attr("stroke-dasharray", "4,4");
      svg2.append("line")
        .attr("x1", margin.left + regionWidth * 2)
        .attr("y1", margin.top)
        .attr("x2", margin.left + regionWidth * 2)
        .attr("y2", height - margin.bottom - 20)
        .attr("stroke", "#ccc")
        .attr("stroke-dasharray", "4,4");

      // 数据准备
      const businessData = qinData.map(d => ({
        traditional: +d['传统商业数量'] || 0,
        advanced: +d['先进商业数量'] || 0
      }));

      const craftData = qinData.map(d => ({
        traditional: +d['传统手工业数量'] || 0,
        advanced: +d['先进手工业数量'] || 0
      }));

      const techData = qinData.map(d => ({
        traditional: +d['传统技术数量'] || 0,
        advanced: +d['先进技术数量'] || 0
      }));

      // 颜色设置
      const colors = {
        business: {
          traditional: "rgba(190,134,134,0.67)",  // 传统商业，透明度0.67
          advanced: "#BE8686"        // 先进商业，不透明
        },
        craft: {
          traditional: "rgba(203,148,97,0.67)",  // 传统手工业，透明度0.67
          advanced: "#cb9461"       // 先进手工业，不透明
        },
        tech: {
          traditional: "rgba(250,227,217,0.67)",  // 传统技术，透明度0.67
          advanced: "#FAE3D9"      // 先进技术，不透明
        }
      };

      // 定义不同类型对应的颜色
      const typeColors = {
        '商业': '#BE8686',  // 淡红色
        '手工业': '#cb9461',  // 淡橙色
        '技术': '#FAE3D9',  // 淡粉色
        '外贸': '#bea079'   // 淡棕色
      };

      // 商业区域绘制
      businessData.forEach((d, i) => {
        const total = d.traditional + d.advanced;
        if (total > 0) {
          const baseX = margin.left + i * regionWidth;
          const traditionalWidth = (d.traditional / total) * regionWidth;
          const advancedWidth = (d.advanced / total) * regionWidth;

          // 传统商业
          if (d.traditional > 0) {
            svg2.append("rect")
              .attr("x", baseX)
              .attr("y", margin.top)
              .attr("width", traditionalWidth)
              .attr("height", yScale2(d.traditional) - margin.top)
              .attr("fill", colors.business.traditional)
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                const tooltip = d3.select("body")
                  .append("div")
                  .attr("class", "tooltip2");
                tooltip.html(`
                  <h4>传统商业</h4>
                  <p><strong>数量：</strong>${d.traditional}</p>
                  <p><strong>代表类型：</strong>${qinData[i]['传统商业类型'] || '无'}</p>
                `)
                  .style("left", (event.pageX + 10) + "px")
                  .style("top", (event.pageY - 10) + "px");
              })
              .on("mouseout", function () {
                d3.selectAll(".tooltip2").remove();
              });
          }

          // 先进商业
          if (d.advanced > 0) {
            svg2.append("rect")
              .attr("x", baseX + traditionalWidth)
              .attr("y", margin.top)
              .attr("width", advancedWidth)
              .attr("height", yScale2(d.advanced) - margin.top)
              .attr("fill", colors.business.advanced)
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                const tooltip = d3.select("body")
                  .append("div")
                  .attr("class", "tooltip2");
                tooltip.html(`
                  <h4>先进商业</h4>
                  <p><strong>数量：</strong>${d.advanced}</p>
                  <p><strong>代表类型：</strong>${qinData[i]['先进商业类型'] || '无'}</p>
                `)
                  .style("left", (event.pageX + 10) + "px")
                  .style("top", (event.pageY - 10) + "px");
              })
              .on("mouseout", function () {
                d3.selectAll(".tooltip2").remove();
              });
          }
        }
      });

      // 手工业区域绘制
      craftData.forEach((d, i) => {
        const total = d.traditional + d.advanced;
        if (total > 0) {
          const baseX = margin.left + regionWidth + i * regionWidth;
          const traditionalWidth = (d.traditional / total) * regionWidth;
          const advancedWidth = (d.advanced / total) * regionWidth;

          // 传统手工业
          if (d.traditional > 0) {
            svg2.append("rect")
              .attr("x", baseX)
              .attr("y", margin.top)
              .attr("width", traditionalWidth)
              .attr("height", yScale2(d.traditional) - margin.top)
              .attr("fill", colors.craft.traditional)
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                const tooltip = d3.select("body")
                  .append("div")
                  .attr("class", "tooltip2");
                tooltip.html(`
                  <h4>传统手工业</h4>
                  <p><strong>数量：</strong>${d.traditional}</p>
                  <p><strong>代表类型：</strong>${qinData[i]['传统手工业类型'] || '无'}</p>
                `)
                  .style("left", (event.pageX + 10) + "px")
                  .style("top", (event.pageY - 10) + "px");
              })
              .on("mouseout", function () {
                d3.selectAll(".tooltip2").remove();
              });
          }

          // 先进手工业
          if (d.advanced > 0) {
            svg2.append("rect")
              .attr("x", baseX + traditionalWidth)
              .attr("y", margin.top)
              .attr("width", advancedWidth)
              .attr("height", yScale2(d.advanced) - margin.top)
              .attr("fill", colors.craft.advanced)
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                const tooltip = d3.select("body")
                  .append("div")
                  .attr("class", "tooltip2");
                tooltip.html(`
                  <h4>先进手工业</h4>
                  <p><strong>数量：</strong>${d.advanced}</p>
                  <p><strong>代表类型：</strong>${qinData[i]['先进手工业类型'] || '无'}</p>
                `)
                  .style("left", (event.pageX + 10) + "px")
                  .style("top", (event.pageY - 10) + "px");
              })
              .on("mouseout", function () {
                d3.selectAll(".tooltip2").remove();
              });
          }
        }
      });

      // 技术区域绘制
      techData.forEach((d, i) => {
        const total = d.traditional + d.advanced;
        if (total > 0) {
          const baseX = margin.left + regionWidth * 2 + i * regionWidth;
          const traditionalWidth = (d.traditional / total) * regionWidth;
          const advancedWidth = (d.advanced / total) * regionWidth;

          // 传统技术
          if (d.traditional > 0) {
            svg2.append("rect")
              .attr("x", baseX)
              .attr("y", margin.top)
              .attr("width", traditionalWidth)
              .attr("height", yScale2(d.traditional) - margin.top)
              .attr("fill", colors.tech.traditional)
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                const tooltip = d3.select("body")
                  .append("div")
                  .attr("class", "tooltip2");
                tooltip.html(`
                  <h4>传统技术</h4>
                  <p><strong>数量：</strong>${d.traditional}</p>
                  <p><strong>代表类型：</strong>${qinData[i]['传统技术类型'] || '无'}</p>
                `)
                  .style("left", (event.pageX + 10) + "px")
                  .style("top", (event.pageY - 10) + "px");
              })
              .on("mouseout", function () {
                d3.selectAll(".tooltip2").remove();
              });
          }

          // 先进技术
          if (d.advanced > 0) {
            svg2.append("rect")
              .attr("x", baseX + traditionalWidth)
              .attr("y", margin.top)
              .attr("width", advancedWidth)
              .attr("height", yScale2(d.advanced) - margin.top)
              .attr("fill", colors.tech.advanced)
              .style("cursor", "pointer")
              .on("mouseover", function (event) {
                const tooltip = d3.select("body")
                  .append("div")
                  .attr("class", "tooltip2");
                tooltip.html(`
                  <h4>先进技术</h4>
                  <p><strong>数量：</strong>${d.advanced}</p>
                  <p><strong>代表类型：</strong>${qinData[i]['先进技术类型'] || '无'}</p>
                `)
                  .style("left", (event.pageX + 10) + "px")
                  .style("top", (event.pageY - 10) + "px");
              })
              .on("mouseout", function () {
                d3.selectAll(".tooltip2").remove();
              });
          }
        }
      });

      // 获取水平数据
      const levelData = qinData.map(d => ({
        business: +d['商业水平'] || 0,
        craft: +d['手工业水平'] || 0,
        tech: +d['技术水平'] || 0,
        trade: +d['外贸水平'] || 0
      }))[0];

      // 创建水平曲线生成器
      const line = d3.line()
        .x((d, i) => {
          const sectionWidth = (width - margin.left - margin.right) / 4;
          return margin.left + sectionWidth * (i + 0.5);
        })
        .y(d => levelScale(d))
        .curve(d3.curveMonotoneX);

      // 准备水平数据点
      const values = [
        levelData.business,
        levelData.craft,
        levelData.tech,
        levelData.trade
      ];

      // 绘制水平曲线
      const path = svg2.append("path")
        .datum(values)
        .attr("fill", "none")
        .attr("stroke", "#be9c79")
        .attr("stroke-width", 1)
        .attr("d", line)
        .style("cursor", "pointer")
        .on("mouseover", function (event) {
          const tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip2");
          tooltip.html(`
            <h4>发展水平曲线</h4>
            <p><strong>商业水平：</strong>${levelData.business}</p>
            <p><strong>手工业水平：</strong>${levelData.craft}</p>
            <p><strong>技术水平：</strong>${levelData.tech}</p>
            <p><strong>外贸水平：</strong>${levelData.trade}</p>
          `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function () {
          d3.selectAll(".tooltip2").remove();
        });

      // 添加水平数据点
      const types = ['商业', '手工业', '技术', '外贸'];
      values.forEach((value, i) => {
        const sectionWidth = (width - margin.left - margin.right) / 4;
        const x = margin.left + sectionWidth * (i + 0.5);

        svg2.append("circle")
          .attr("cx", x)
          .attr("cy", levelScale(value))
          .attr("r", 2)
          .attr("fill", "white")
          .attr("stroke", typeColors[types[i]])
          .attr("stroke-width", 1)
          .style("cursor", "pointer")
          .on("mouseover", function (event) {
            const tooltip = d3.select("body")
              .append("div")
              .attr("class", "tooltip2");
            tooltip.html(`
              <h4>${types[i]}水平</h4>
              <p><strong>数值：</strong>${value}</p>
            `)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function () {
            d3.selectAll(".tooltip2").remove();
          });
      });

      // 添加事件点
      if (qinEvents.length > 0) {
        const pathLength = path.node().getTotalLength();
        const eventSpacing = pathLength / (qinEvents.length + 1);

        qinEvents.forEach((event, i) => {
          const point = path.node().getPointAtLength(eventSpacing * (i + 1));
          const eventType = event['事件类型'];
          const impact = event['事件影响'];

          // 根据影响确定颜色深浅
          const baseColor = typeColors[eventType] || '#be9c79';
          const color = impact === '正' ? d3.color(baseColor).darker(0.5) : d3.color(baseColor).brighter(0.5);

          const eventPoint = svg2.append("circle")
            .attr("cx", point.x)
            .attr("cy", point.y)
            .attr("r", 3)
            .attr("fill", color)
            .style("cursor", "pointer");

          // 添加事件提示框
          eventPoint.append("title")
            .text(`${event['重点事件']}\n类型: ${eventType}\n影响: ${impact}`);
        });
      }

      // 添加图例
      const legendData = [
        { label: '传统商业', color: colors.business.traditional },
        { label: '先进商业', color: colors.business.advanced },
        { label: '传统手工业', color: colors.craft.traditional },
        { label: '先进手工业', color: colors.craft.advanced },
        { label: '传统技术', color: colors.tech.traditional },
        { label: '先进技术', color: colors.tech.advanced }
      ];

      const legend = svg2.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${margin.left + 10}, ${height - margin.bottom - 5})`);

      const legendItemWidth = 20;
      const legendItemHeight = 5;
      const legendSpacing = 65;

      legendData.forEach((item, i) => {
        const g = legend.append("g")
          .attr("transform", `translate(${i * (legendItemWidth + legendSpacing)}, 0)`);

        g.append("rect")
          .attr("width", 15)
          .attr("height", 5)
          .attr("fill", item.color);

        g.append("text")
          .attr("x", 20)
          .attr("y", 7)
          .attr("font-size", "12px")
          .attr("fill", "#666")
          .text(item.label);
      });

    }).catch(function (error) {
      console.error("读取或处理文件出错：", error);
    });
  }, []);

  return (
    <div>
    <div id="chart1"></div>
    </div>
  );
};

export default  Merce;