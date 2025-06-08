import React, { useEffect } from 'react';
import * as d3 from 'd3';
import './MerceArea.css';

const MerceArea = ({ dynastyName = '元' }) => {
  useEffect(() => {
    // 设置图表尺寸和边距
    const margin = { top: 20, right: 50, bottom: 50, left: 10 };
    const width = 550 - margin.left - margin.right;
    const height = 150 - margin.top - margin.bottom;

    // 清除旧的 SVG
    d3.select("#chart1").select("svg").remove();

    // 创建SVG容器
    const svg = d3.select("#chart1")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // 创建比例尺
    const xScale = d3.scaleLinear()
      .domain([-12, 12])
      .range([0, width + 100]);

    const yScale = d3.scaleLinear()
      .domain([-12, 12])
      .range([height, 0]);

    // 创建聚类类别的颜色比例尺
    const clusterColors = {
      "核心商业区": "#BE8686",
      "城门商贸带": "#cb9461",
      "近郊工业与能源区": "#deb9a9",
      "文化及专业市场": "#bea079",
      "手工业聚集区": "#9a5c47"
    };

    // 创建提示框
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

    // 读取CSV数据
    d3.csv(`${process.env.PUBLIC_URL}/data/merce_area.csv`).then(data => {
      // 筛选指定朝代数据
      const dynastyData = data.filter(d => d.历史时期 === dynastyName);
      console.log(data)

      // 按聚类类别分组数据
      const groupedData = d3.group(dynastyData, d => d.聚类类别);

      // 为每个类别创建平滑曲线连接
      groupedData.forEach((points, category) => {
        // 计算凸包
        const hull = d3.polygonHull(points.map(d => [xScale(+d.X), yScale(+d.Y)]));

        if (hull) {
          // 创建平滑曲线
          const lineGenerator = d3.line()
            .curve(d3.curveCatmullRomClosed)
            .x(d => d[0])
            .y(d => d[1]);

          // 添加填充区域
          svg.append("path")
            .datum(hull)
            .attr("class", "hull")
            .attr("d", lineGenerator(hull))
            .attr("fill", d3.color(clusterColors[category]).copy({ opacity: 0.1 }))
            .attr("stroke", clusterColors[category])
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.8);
        }
      });

      // 计算每个坐标点的出现次数
      const coordCount = {};
      dynastyData.forEach(d => {
        const key = `${d.X},${d.Y}`;
        coordCount[key] = (coordCount[key] || 0) + 1;
      });

      // 添加散点
      svg.selectAll("circle")
        .data(dynastyData)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(+d.X))
        .attr("cy", d => yScale(+d.Y))
        .attr("r", d => Math.sqrt(+d.重要性评分) * 3)
        .attr("fill", d => clusterColors[d.聚类类别])
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .on("mouseover", function (event, d) {
          tooltip.transition()
            .duration(200)
            .style("opacity", .9);
          tooltip.html(`地区：${d.地区名称}<br/>聚类类别：${d.聚类类别}<br/>重要性评分：${d.重要性评分}<br/>介绍：${d.介绍}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function (d) {
          tooltip.transition()
            .duration(500)
            .style("opacity", 0);
        });

      // 为重复坐标的点添加外环
      svg.selectAll("circle.outer")
        .data(dynastyData.filter(d => coordCount[`${d.X},${d.Y}`] > 1))
        .enter()
        .append("circle")
        .attr("class", "outer")
        .attr("cx", d => xScale(+d.X))
        .attr("cy", d => yScale(+d.Y))
        .attr("r", d => Math.sqrt(+d.重要性评分) * 3 + 3)
        .attr("fill", "none")
        .attr("stroke", d => clusterColors[d.聚类类别])
        .attr("stroke-width", 1);

      // 创建力导向布局来放置标签
      const labelData = dynastyData.map(d => ({
        ...d,
        x: xScale(+d.X),
        y: yScale(+d.Y),
        radius: Math.sqrt(+d.重要性评分) * 2 + 10
      }));

      // 创建力导向布局
      const simulation = d3.forceSimulation(labelData)
        .force("charge", d3.forceManyBody().strength(-50))
        .force("collide", d3.forceCollide().radius(d => d.radius * 2))
        .force("x", d3.forceX(d => d.x).strength(0.1))
        .force("y", d3.forceY(d => d.y).strength(0.1))
        .on("tick", () => {
          labels
            .attr("x", d => d.x)
            .attr("y", d => d.y);
        });

      // 添加标签
      const labels = svg.selectAll("text.label")
        .data(labelData)
        .enter()
        .append("text")
        .attr("class", "label")
        .text(d => d.地区名称)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#333");

      // 添加图例
      const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${10}, -10)`);

      Object.entries(clusterColors).forEach(([category, color], i) => {
        const legendRow = legend.append("g")
          .attr("transform", `translate(${i * 115}, 0)`);

        legendRow.append("rect")
          .attr("width", 15)
          .attr("height", 5)
          .attr("fill", color);

        legendRow.append("text")
          .attr("x", 20)
          .attr("y", 5)
          .text(category);
      });
    });

    return () => {
      d3.select("#chart1").select("svg").remove();
      d3.select(".tooltip").remove();
    };
  }, [dynastyName]);

  return (
    <div >
      <div id="chart1"></div>
    </div>
  );
};

export default MerceArea; 