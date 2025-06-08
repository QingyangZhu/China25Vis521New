import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import './ParallelCoordinatesPlot.css';

const ParallelCoordinatesPlot = ({ dynasty }) => {
    const svgRef = useRef();

    useEffect(() => {
        const width = 975;
        const height = 55;
        const margin = { top: 30, right: 20, bottom: 10, left: 10 };

        // Clear previous SVG content
        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3.select(svgRef.current)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        let dimensions; // To store the names of the axes
        const y = {}; // To store y-scales for each dimension

        d3.csv("/data/processed_历史时期影响分析.csv").then(function(data) {
            const tangDataRow = data.find(d => d['历史时期'] === dynasty);
        

            if (!tangDataRow) {
                console.warn(`No data found for '${dynasty}' dynasty in the CSV.`);
                return;
            }

            const dimensions = ['政权更替', '城市重建', '城区扩展', '人口变化', '经济文化影响'];
            const dimensionLabels = ['政权更替', '城市重建', '城区扩展', '人口变化', '文经影响'];
            const lineCategories = ['灾害', '战争', '事件'];

            const plotData = [];

            lineCategories.forEach(lineCat => {
                const lineObj = { category: lineCat };
                dimensions.forEach(dim => {
                    const fullColumnName = `${lineCat}-${dim}`;
                    if (tangDataRow[fullColumnName] !== undefined) {
                        lineObj[dim] = +tangDataRow[fullColumnName];
                    } else {
                        console.warn(`Missing data for column: ${fullColumnName}`);
                        lineObj[dim] = null;
                    }
                });
                console.log(`Data for ${lineCat}:`, lineObj);
                if (dimensions.every(dim => lineObj[dim] !== null)) {
                    plotData.push(lineObj);
                }
            });

            if (plotData.length === 0) {
                console.warn("No complete line data could be generated from the filtered data.");
                return;
            }

            // 确保y轴比例尺的范围足够大，以显示负值
            dimensions.forEach(function(d) {
                const valuesForDim = plotData.map(p => p[d]);
                const extent = d3.extent(valuesForDim);
                // 确保比例尺能显示所有值，包括负值
                y[d] = d3.scaleLinear()
                    .domain([extent[0], extent[1]])
                    .range([height, 0])
                    .nice(); // 使用nice()来优化刻度范围
            });

            console.log("Y scales:", dimensions.map(d => ({
                dimension: d,
                domain: y[d].domain(),
                range: y[d].range()
            })));

            const allValues = plotData.flatMap(d => dimensions.map(dim => d[dim]));
            const globalValueExtent = d3.extent(allValues);

            // 使用与CityDataCharts一致的色彩方案，从棕色系到暖色系
            const valueColorScale = d3.scaleLinear()
                .domain(globalValueExtent)
                .range(['#A0C1B8', '#D49C6A']);

            const categoricalLineColor = d3.scaleOrdinal()
                .domain(lineCategories)
                .range(["#A0C1B8", "#D49C6A", "#B8A48E"]);  // 使用CityDataCharts的三种主色彩：灾害、战争、事件

            const defs = svg.append("defs");

            plotData.forEach(d => {
                const gradient = defs.append("linearGradient")
                    .attr("id", `gradient-${d.category}`)
                    .attr("x1", "0%")
                    .attr("y1", "0%")
                    .attr("x2", "100%")
                    .attr("y2", "0%");

                dimensions.forEach((dim, i) => {
                    const offset = (i / (dimensions.length - 1)) * 100;
                    gradient.append("stop")
                        .attr("offset", `${offset}%`)
                        .attr("stop-color", valueColorScale(d[dim]));
                });
            });

            const x = d3.scalePoint()
                .range([0, width])
                .padding(1)
                .domain(dimensions);

            const path = function(d) {
                return d3.line()
                    .x(p => x(p))
                    .y(p => y[p](d[p]))
                    .curve(d3.curveMonotoneX)(dimensions);
            };

            // 添加调试日志
            console.log("Drawing lines with data:", plotData);
            plotData.forEach(d => {
                console.log(`Drawing line for ${d.category}:`, dimensions.map(p => [p, d[p], y[p](d[p])]));
            });

            svg.selectAll(".line")
                .data(plotData)
                .enter().append("path")
                .attr("class", "line")
                .attr("d", path)
                .attr("stroke", d => `url(#gradient-${d.category})`)
                .style("stroke-width", 2)
                .style("opacity", 0.7);

            // 添加调试用的点
            plotData.forEach(d => {
                dimensions.forEach(p => {
                    svg.append("circle")
                        .attr("cx", x(p))
                        .attr("cy", y[p](d[p]))
                        .attr("r", 3)
                        .attr("fill", "#b4a293")  // 使用系统主色调
                        .attr("opacity", 0.6);
                });
            });

            const g = svg.selectAll(".dimension")
                .data(dimensions)
                .enter().append("g")
                .attr("class", "dimension")
                .attr("transform", function(d) { return `translate(${x(d)})`; });

            g.append("g")
                .attr("class", "axis")
                .each(function(d) { 
                    d3.select(this)
                        .call(d3.axisLeft(y[d]).ticks(3))
                        .selectAll("line")
                        .style("stroke", "#8C6D46")
                        .style("stroke-width", "1px");
                    
                    d3.select(this)
                        .selectAll("path")
                        .style("stroke", "#8C6D46")
                        .style("stroke-width", "1x");
                    
                    d3.select(this)
                        .selectAll("text")
                        .style("fill", "#8C6D46")
                        .style("font-size", "10px");
                });

            // 添加维度标签
            g.append("text")
                .style("text-anchor", "middle")
                .style("font-size", "10px")
                .style("font-family", "'楷体', 'KaiTi', 'STKaiti', '华文楷体', 'AR PL UKai CN', 'Kaiti SC', 'Noto Serif SC', serif")
                .style("fill", "#8C6D46")
                .attr("y", -12)
                .text(function(d, i) { return dimensionLabels[i]; });
                
            const tooltip = d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0)
                .style("position", "absolute")
                .style("background-color", "white")
                .style("border", "1px solid #ccc")
                .style("padding", "5px")
                .style("font-size", "12px")
                .style("pointer-events", "none");

            svg.selectAll(".line")
                .on("mouseover", function(event, d) {
                    d3.select(this).style("stroke-width", "4px").style("opacity", 1);

                    let tooltipContent = `<b>${d.category}</b><br/>`;
                    dimensions.forEach((dim, i) => {
                        tooltipContent += `${dimensionLabels[i]}: ${d[dim].toFixed(2)}<br/>`;
                    });

                    tooltip.html(tooltipContent)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px")
                        .transition()
                        .duration(200)
                        .style("opacity", .9);
                })
                .on("mouseout", function(event, d) {
                    d3.select(this).style("stroke-width", "2px").style("opacity", 0.7);
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });
        }).catch(function(error) {
            console.error("Error loading or processing data:", error);
        });

        // Cleanup function for useEffect
        return () => {
            d3.select(svgRef.current).selectAll("*").remove();
            d3.select(".tooltip").remove();
        };

    }, [dynasty]); // Redraw chart if dynasty prop changes

    return (
        <svg ref={svgRef} style={{
            fontFamily: "'楷体', 'KaiTi', 'STKaiti', '华文楷体', 'AR PL UKai CN', 'Kaiti SC', 'Noto Serif SC', serif",
            display: 'block',
            margin: '20px'
        }}></svg>
    );
};

export default ParallelCoordinatesPlot; 