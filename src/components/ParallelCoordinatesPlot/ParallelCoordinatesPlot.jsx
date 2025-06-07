import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import './ParallelCoordinatesPlot.css';

const ParallelCoordinatesPlot = ({ dynasty }) => {
    const svgRef = useRef();

    useEffect(() => {
        const width = 960;
        const height = 100;
        const margin = { top: 30, right: 10, bottom: 10, left: 10 };

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
                if (dimensions.every(dim => lineObj[dim] !== null)) {
                    plotData.push(lineObj);
                }
            });

            if (plotData.length === 0) {
                console.warn("No complete line data could be generated from the filtered data.");
                return;
            }

            dimensions.forEach(function(d) {
                const valuesForDim = plotData.map(p => p[d]);
                y[d] = d3.scaleLinear()
                    .domain(d3.extent(valuesForDim))
                    .range([height, 0]);
            });

            const allValues = plotData.flatMap(d => dimensions.map(dim => d[dim]));
            const globalValueExtent = d3.extent(allValues);

            const valueColorScale = d3.scaleSequential(d3.interpolateBrBG)
                .domain(globalValueExtent);

            const categoricalLineColor = d3.scaleOrdinal()
                .domain(lineCategories)
                .range(["#c69c9c", "#507987", "#5d835d"]);

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
                return d3.line()(dimensions.map(function(p) {
                    return [x(p), y[p](d[p])];
                }));
            };

            svg.selectAll(".line")
                .data(plotData)
                .enter().append("path")
                .attr("class", "line")
                .attr("d", path)
                .attr("stroke", d => `url(#gradient-${d.category})`);

            const g = svg.selectAll(".dimension")
                .data(dimensions)
                .enter().append("g")
                .attr("class", "dimension")
                .attr("transform", function(d) { return `translate(${x(d)})`; });

            g.append("g")
                .attr("class", "axis")
                .each(function(d) { d3.select(this).call(d3.axisLeft(y[d]).ticks(5)); })
                .append("text")
                .style("text-anchor", "middle")
                .attr("y", -9)
                .text(function(d) { return d; })
                .style("fill", "#333");

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
                    d3.select(this).style("stroke-width", "3px").style("opacity", 1);

                    let tooltipContent = `<b>${d.category}</b><br/>`;
                    dimensions.forEach(dim => {
                        tooltipContent += `${dim}: ${d[dim].toFixed(2)}<br/>`;
                    });

                    tooltip.html(tooltipContent)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px")
                        .transition()
                        .duration(200)
                        .style("opacity", .9);
                })
                .on("mouseout", function(event, d) {
                    d3.select(this).style("stroke-width", "1.5px").style("opacity", 0.7);
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
            fontFamily: 'KaiTi, STKaiti, serif',
            display: 'block',
            margin: '20px'
        }}></svg>
    );
};

export default ParallelCoordinatesPlot; 