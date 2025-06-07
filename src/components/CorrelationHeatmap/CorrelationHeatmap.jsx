import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import styles from './CorrelationHeatmap.css'; // Import CSS Module

const CorrelationHeatmap = () => {
    const svgRef = useRef();
     // Move these variables outside useEffect
     const width = 230;
     const height = 230;
     const margin = { top: 10, right: 20, bottom: 50, left: 10 };

    useEffect(() => {
        const data = [
            { type: '事件发生次数', correlations: [1.0, 0.4, 1.0, 0.6, 0.9, 0.6, -1.0, -0.9] },
            { type: '战争发生次数', correlations: [0.4, 1.0, 0.3, 0.6, 0.3, 0.3, -0.4, -0.4] },
            { type: '灾害发生次数', correlations: [1.0, 0.3, 1.0, 0.6, 1.0, 0.8, -0.9, -0.8] },
            { type: '政权更替', correlations: [0.6, 0.6, 0.6, 1.0, 0.8, 0.8, -0.7, -0.6] },
            { type: '城市重建', correlations: [0.9, 0.3, 1.0, 0.8, 1.0, 0.9, -0.9, -0.8] },
            { type: '城区扩展', correlations: [0.6, 0.3, 0.8, 0.8, 0.9, 1.0, -0.6, -0.5] },
            { type: '人口变化', correlations: [-1.0, -0.4, -0.9, -0.7, -0.9, -0.6, 1.0, 1.0] },
            { type: '经济文化影响', correlations: [-0.9, -0.4, -0.8, -0.6, -0.8, -0.5, 1.0, 1.0] }
        ];

        const columnNames = [
            '事件发生次数', '战争发生次数', '灾害发生次数', '政权更替', '城市重建', '城区扩展', '人口变化', '经济文化影响'
        ];
        const rowNames = columnNames; // They are the same for a correlation matrix

        const width = 350; // Adjusted for 8x8 matrix
        const height = 350; // Adjusted for 8x8 matrix
        const margin = { top: 20, right: 20, bottom: 50, left: 100 };

        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const cellSize = Math.min(innerWidth / columnNames.length, innerHeight / rowNames.length);

        // Clear previous SVG content
        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3.select(svgRef.current)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const colorScale = d3.scaleSequential(d3.interpolateBrBG)
            .domain([-1, 1]);

        const allCorrelations = [];
        data.forEach((row, rowIndex) => {
            row.correlations.forEach((corr, colIndex) => {
                allCorrelations.push({
                    rowIndex: rowIndex,
                    colIndex: colIndex,
                    value: corr,
                    type: row.type,
                    column: columnNames[colIndex]
                });
            });
        });

        const cells = svg.selectAll(".cell-group")
            .data(allCorrelations)
            .enter()
            .append("g")
            .attr("class", "cell-group")
            .attr("transform", d => `translate(${d.colIndex * cellSize},${d.rowIndex * cellSize})`);

        cells.append("rect")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("fill", "rgba(251, 248, 240, 0.85)")
            .attr("stroke", "#8c7655")
            .attr("stroke-width", 0.5);

        cells.filter(d => d.colIndex < d.rowIndex)
            .append("text")
            .attr("x", cellSize / 2 - 9)
            .attr("y", cellSize / 2 + 5)
            .attr("class", styles.valueText)
            .attr("font-size", "9px")
            .attr("fill", d => colorScale(d.value))
            .text(d => d.value.toFixed(2));

        cells.filter(d => d.colIndex > d.rowIndex)
            .each(function(d) {
                const g = d3.select(this);
                const value = d.value;
                const absValue = Math.abs(value);

                const pie = d3.pie()
                    .sort(null)
                    .value(p => p.value);

                const arc = d3.arc()
                    .innerRadius(0)
                    .outerRadius(cellSize / 2 - 2);

                const pieData = [{ value: absValue, type: 'correlation' }, { value: 1 - absValue, type: 'remainder' }];

                g.selectAll(".arc")
                    .data(pie(pieData))
                    .enter().append("g")
                    .attr("class", "arc")
                    .attr("transform", `translate(${cellSize / 2},${cellSize / 2})`)
                    .append("path")
                    .attr("d", arc)
                    .attr("fill", p => p.data.type === 'correlation' ? colorScale(value) : "white")
                    .attr("stroke", "#666")
                    .attr("stroke-width", 0.5);
            });
        
        cells.filter(d => d.colIndex === d.rowIndex)
            .each(function(d) {
                const g = d3.select(this);
                g.append("circle")
                    .attr("cx", cellSize / 2)
                    .attr("cy", cellSize / 2)
                    .attr("r", cellSize / 2 - 2)
                    .attr("fill", "white")
                    .attr("stroke", colorScale(1.00))
                    .attr("stroke-width", 1);
                g.append("text")
                    .attr("x", cellSize / 2 - 8)
                    .attr("y", cellSize / 2 + 3)
                    .attr("class", styles.valueText)
                    .attr("font-size", "9px")
                    .attr("fill", colorScale(1.00))
                    .text("1.00");
            });

        svg.selectAll(".row-label")
            .data(rowNames)
            .enter().append("text")
            .attr("class", styles.label)
            .attr("x", -12)
            .attr("y", (d, i) => i * cellSize + cellSize / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "9px")
            .attr("fill", "#333")
            .text(d => d);

        // Cleanup function for useEffect
        return () => {
            d3.select(svgRef.current).selectAll("*").remove();
        };

    }, []); // Empty dependency array means this effect runs once on mount

    return (
        <div className={styles.chartContainer} style={{ width: `${width + margin.left + margin.right}px`, height: `${height + margin.top + margin.bottom}px`, fontFamily: 'KaiTi, STKaiti, serif', padding: '0' }}>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default CorrelationHeatmap; 