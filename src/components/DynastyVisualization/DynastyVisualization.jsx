import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import './PolarChart.css'

function DynastyVisualization({
    dynasty = "隋",
    startYear = 581,
    endYear = 608,
    riverData, vegetationData, climateData, populationData
}) {
    const d3Container = useRef(null);

    useEffect(() => {
        if (d3Container.current) {
            // Clear existing visualization
            d3.select(d3Container.current).selectAll("*").remove();

            // Set canvas size and margins
            const margin = {top: 10, right: 20, bottom: 20, left: 10};
            const width = 600 - margin.left - margin.right;
            const height = 600 - margin.top - margin.bottom;
            const radius = Math.min(width, height) / 3 + 10;

            // Define radius ranges for each section
            const radiusRanges = {
                river: {
                    inner: radius * 0.5,
                    middle: radius * 0.7,
                    outer: radius * 0.9,
                    stat: radius * 1.05
                },
                vegetation: {
                    inner: radius * 0.5,
                    middle: radius * 0.7,
                    outer: radius * 0.9
                },
                climate: {
                    inner: radius * 0.65,
                    middle: radius * 0.7,
                    outer: radius * 0.9,
                    image: radius * 1.2
                },
                population: {
                    inner: radius * 0.4,
                    outer: radius * 0.45,
                    map: radius * 0.35
                }
            };

            // Define colors for each section
            const colorSchemes = {
                river: {
                    type: {
                        "1": "#f0e6d2", // 柔和的米色
                        "2": "#a08060"  // 灰棕色
                    },
                    usage: {
                       "农业灌溉": "#d4a26a", // 土黄
                        "交通运输": "#e7d1c9", // 淡灰粉
                        "防洪排水": "#a8c0a8", // 灰绿
                        "生活用水": "#e0d7b7", // 米黄
                        "政治象征": "#b86f3c", // 棕橙
                        "城市防御": "#b57c3c", // 土金
                        "城市景观": "#e6da89"  // 暗黄
                    }
                },
                vegetation: {
                    forest: "#6b846b",  // 深绿色（含"林"字）
                    other: "#889c88",   // 淡绿色（其他）
                    curve: "#7f8f7f",   // 曲线颜色
                    divider: "#b4a293"  // 分隔线颜色
                },
                climate: {
                    score: d3.scaleLinear()
                        .domain([0, 5])
                        .range(["#f9d5cc", "#c85250"]), // 从淡红色到深红色
                    metric: {
                        background: "#f5f5f5",
                        border: "#b4a293",
                        text: "#333333"
                    }
                },
                population: {
                    segment: "#f0e6d2",  // 米黄色
                    map: {
                        background: "#f0e6d2",
                        border: "#b4a293",
                        density: "rgba(228, 90, 90, 0.31)",
                        densityBorder: "rgba(222, 104, 104, 0.89)",
                        river: "#6c8b9f",
                        city: "rgba(236, 111, 111, 0.89)"
                    }
                }
            };

            // Create SVG element
            const svg = d3.select(d3Container.current)
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${width/2 + margin.left},${height/2 + margin.top - 35})`);

            // Create polar coordinate system
            const angleScale = d3.scaleLinear()
                .domain([startYear, endYear])
                .range([0, 2 * Math.PI - 0.1]);

            // Create radial scale
            const radiusScale = d3.scaleLinear()
                .domain([0, 1])
                .range([0, radius]);

            // Draw circle
            svg.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", radius)
                .style("fill", "none")
                .style("stroke", "#ab7a4f")
                .style("stroke-width", 2);

            // Create year ticks
            const years = d3.range(startYear, endYear + 1);
            // Calculate the number of ticks to display, at most 20
            const tickCount = Math.min(20, years.length);
            // Calculate the interval
            const tickStep = Math.ceil(years.length / tickCount);
            // Select the years to display
            const selectedYears = years.filter((_, i) => i % tickStep === 0);
            const ticks = svg.selectAll(".tick")
                .data(selectedYears)
                .enter()
                .append("g")
                .attr("class", "tick");

            // Add tick lines
            ticks.append("line")
                .attr("x1", d => {
                    const angle = angleScale(d);
                    return (radius - 5) * Math.sin(angle);
                })
                .attr("y1", d => {
                    const angle = angleScale(d);
                    return -(radius - 5) * Math.cos(angle);
                })
                .attr("x2", d => {
                    const angle = angleScale(d);
                    return radius * Math.sin(angle);
                })
                .attr("y2", d => {
                    const angle = angleScale(d);
                    return -radius * Math.cos(angle);
                })
                .style("stroke", "#ab7a4f");

            // Add year labels
            ticks.append("text")
                .attr("x", d => {
                    const angle = angleScale(d);
                    return (radius + 20) * Math.sin(angle);
                })
                .attr("y", d => {
                    const angle = angleScale(d);
                    return -(radius + 20) * Math.cos(angle);
                })
                .attr("dy", "0.35em")
                .style("text-anchor", d => {
                    const angle = angleScale(d);
                    return Math.abs(Math.sin(angle)) < 0.5 ? "middle" :
                           Math.sin(angle) > 0 ? "start" : "end";
                })
                .style("font-size", "12px")
                .text(d => d);

            // Add three dividing lines
            const dividerAngles = [0, 2 * Math.PI / 3, 4 * Math.PI / 3];
            dividerAngles.forEach(angle => {
                svg.append("line")
                    .attr("x1", radius * 0.5 * Math.sin(angle))
                    .attr("y1", -radius * 0.5 * Math.cos(angle))
                    .attr("x2", radius * Math.sin(angle))
                    .attr("y2", -radius * Math.cos(angle))
                    .attr("class", "divider");
            });

            // Store current display state
            let currentState = {
                isShowingTributaries: false,
                selectedRiver: null,
                originalRivers: null,
                riverAngles: new Map()
            };

            // Function to create river segments
            function createRiverSegments(rivers, isTributaries = false, startAngle = 0, endAngle = 2 * Math.PI / 3) {
                const { inner, middle, outer, stat } = radiusRanges.river;
                const { type, usage } = colorSchemes.river;

                // Clear existing rivers and tributaries
                if (isTributaries) {
                    svg.selectAll(".river-segment[data-river='" + currentState.selectedRiver.河流名称 + "']").remove();
                    svg.selectAll(".river-label[data-river='" + currentState.selectedRiver.河流名称 + "']").remove();
                } else {
                    svg.selectAll(".river-segment, .river-label").remove();
                    svg.selectAll(".usage-stat-ring").remove();
                }

                // Sort by importance
                rivers.sort((a, b) => b.重要性 - a.重要性);

                // Calculate the angle for each river
                const totalImportance = d3.sum(rivers, d => +d.重要性);
                const sectionAngle = endAngle - startAngle;
                const anglePerImportance = sectionAngle / totalImportance;

                // Calculate total proportion for each usage
                const usageStats = {};
                rivers.forEach(river => {
                    if (river.河流使用) {
                        const usages = river.河流使用.split("、");
                        usages.forEach(usage => {
                            usage = usage.trim();
                            if (!usageStats[usage]) {
                                usageStats[usage] = 0;
                            }
                            usageStats[usage] += +river.重要性;
                        });
                    }
                });

                // Draw statistical rings
                const totalUsage = Object.values(usageStats).reduce((a, b) => a + b, 0);
                let currentStatAngle = startAngle;
                Object.entries(usageStats).forEach(([usage, count]) => {
                    const usageAngle = (count / totalUsage) * sectionAngle;
                    const arc = d3.arc()
                        .innerRadius(stat)
                        .outerRadius(stat + 5)
                        .startAngle(currentStatAngle)
                        .endAngle(currentStatAngle + usageAngle);

                    svg.append("path")
                        .attr("d", arc)
                        .attr("class", "usage-stat-ring")
                        .style("fill", colorSchemes.river.usage[usage] || "#ccc");

                    currentStatAngle += usageAngle;
                });

                // Create river segments
                let currentAngle = startAngle;
                rivers.forEach((river, i) => {
                    const riverAngle = +river.重要性 * anglePerImportance;
                    const riverStartAngle = currentAngle;
                    const riverEndAngle = Math.min(currentAngle + riverAngle, endAngle);

                    // Store river angle range
                    if (!isTributaries) {
                        currentState.riverAngles.set(river.河流名称, {
                            start: riverStartAngle,
                            end: riverEndAngle
                        });
                    }

                    // Create inner segment
                    const arc = d3.arc()
                        .innerRadius(inner)
                        .outerRadius(middle)
                        .startAngle(riverStartAngle)
                        .endAngle(riverEndAngle);

                    svg.append("path")
                        .attr("d", arc)
                        .attr("class", "river-segment")
                        .attr("data-river", river.河流名称)
                        .style("fill", type[river.类型] || "#d7cec2")
                        .style("stroke", "#a09080") // 柔和的沙灰色描边
                        .style("stroke-width", 0.5) // 细描边
                        .datum(river)
                        .on("click", function(event, d) {
                            if (!isTributaries && d.水系支流) {
                                const tributaries = d.水系支流.split("、").map(name => ({
                                    河流名称: name,
                                    重要性: 1,
                                    类型: d.类型,
                                    河流使用: d.河流使用
                                }));
                                currentState.isShowingTributaries = true;
                                currentState.selectedRiver = d;
                                currentState.originalRivers = rivers;
                                const riverAngle = currentState.riverAngles.get(d.河流名称);
                                createRiverSegments(tributaries, true, riverAngle.start, riverAngle.end);
                            } else if (isTributaries) {
                                currentState.isShowingTributaries = false;
                                currentState.selectedRiver = null;
                                createRiverSegments(currentState.originalRivers, false, 0, 2 * Math.PI / 3);
                            }
                        });

                    // Handle river usage
                    if (river.河流使用) {
                        const usages = river.河流使用.split("、");
                        const usageAngle = riverAngle / usages.length;

                        usages.forEach((usage, j) => {
                            const usageStartAngle = riverStartAngle + j * usageAngle;
                            const usageEndAngle = Math.min(riverStartAngle + (j + 1) * usageAngle, endAngle);

                            const usageArc = d3.arc()
                                .innerRadius(middle)
                                .outerRadius(outer)
                                .startAngle(usageStartAngle)
                                .endAngle(usageEndAngle);

                            svg.append("path")
                                .attr("d", usageArc)
                                .attr("class", "river-segment")
                                .attr("data-river", river.河流名称)
                                .style("fill", colorSchemes.river.usage[usage.trim()] || "#d7cec2")
                                .style("stroke", "#a09080") // 柔和的沙灰色描边
                                .style("stroke-width", 0.5) // 细描边
                                .datum(river)
                                .on("click", function(event, d) {
                                    if (d.水系支流) {
                                        const tributaries = d.水系支流.split("、").map(name => ({
                                            河流名称: name,
                                            重要性: 1,
                                            类型: d.类型,
                                            河流使用: d.河流使用
                                        }));
                                        currentState.isShowingTributaries = true;
                                        currentState.selectedRiver = d;
                                        currentState.originalRivers = rivers;
                                        const riverAngle = currentState.riverAngles.get(d.河流名称);
                                        createRiverSegments(tributaries, true, riverAngle.start, riverAngle.end);
                                    }
                                });
                        });
                    } else {
                        const arc2 = d3.arc()
                            .innerRadius(middle)
                            .outerRadius(outer)
                            .startAngle(riverStartAngle)
                            .endAngle(riverEndAngle);

                        svg.append("path")
                            .attr("d", arc2)
                            .attr("class", "river-segment")
                            .style("fill", "#ccc")
                            .datum(river)
                            .on("click", function(event, d) {
                                if (d.水系支流) {
                                    const tributaries = d.水系支流.split("、").map(name => ({
                                        河流名称: name,
                                        重要性: 1,
                                        类型: d.类型,
                                        河流使用: d.河流使用
                                    }));
                                    currentState.isShowingTributaries = true;
                                    currentState.selectedRiver = d;
                                    currentState.originalRivers = rivers;
                                    const riverAngle = currentState.riverAngles.get(d.河流名称);
                                    createRiverSegments(tributaries, true, riverAngle.start, riverAngle.end);
                                }
                            });
                    }

                    // Add river label
                    if (isTributaries) {
                        const tributaryAngle = (riverEndAngle - riverStartAngle) / rivers.length;
                        const tributaryStartAngle = riverStartAngle + i * tributaryAngle;
                        const tributaryEndAngle = tributaryStartAngle + tributaryAngle;
                        const labelAngle = tributaryStartAngle + tributaryAngle / 2;
                        const labelRadius = (inner + middle) / 2;

                        svg.append("text")
                            .attr("x", labelRadius * Math.sin(labelAngle))
                            .attr("y", -labelRadius * Math.cos(labelAngle))
                            .attr("data-river", river.河流名称)
                            .attr("class", "river-label")
                            .attr("font-size", '10')
                            .attr("transform", `rotate(${labelAngle * 180 / Math.PI - 90}, ${labelRadius * Math.sin(labelAngle)}, ${-labelRadius * Math.cos(labelAngle)})`)
                            .text(river.河流名称);
                    } else {
                        const labelAngle = riverStartAngle + (riverEndAngle - riverStartAngle) / 2;
                        const labelRadius = (inner + middle) / 2;

                        svg.append("text")
                            .attr("x", labelRadius * Math.sin(labelAngle))
                            .attr("y", -labelRadius * Math.cos(labelAngle))
                            .attr("class", "river-label")
                            .attr("data-river", river.河流名称)
                            .attr("transform", `rotate(${labelAngle * 180 / Math.PI - 90}, ${labelRadius * Math.sin(labelAngle)}, ${-labelRadius * Math.cos(labelAngle)})`)
                            .text(river.河流名称);
                    }

                    currentAngle = riverEndAngle;
                });

                // Add legend
                const legend = svg.append("g")
                    .attr("class", "legend")
                    .attr("transform", `translate(${-radius * 1.5 + 20}, ${-radius * 1.3 + 10})`);

                // Add type legend
                Object.entries(colorSchemes.river.type).forEach(([type, color], i) => {
                    legend.append("rect")
                        .attr("x", i * 60)
                        .attr("y", 0)
                        .attr("width", 15)
                        .attr("height", 5)
                        .style("fill", color);

                    legend.append("text")
                        .attr("x", i * 60 + 20)
                        .attr("y", 7)
                        .text(type === "1" ? "自然" : "人工");
                });

                // Add usage legend
                Object.entries(colorSchemes.river.usage).forEach(([usage, color], i) => {
                    legend.append("rect")
                        .attr("x", (i + 2) * 64)
                        .attr("y", 0)
                        .attr("width", 15)
                        .attr("height", 5)
                        .style("fill", color);

                    legend.append("text")
                        .attr("x", (i + 2) * 64 + 20)
                        .attr("y", 6)
                        .attr("font-size", 10)
                        .text(usage);
                });
            }

            // Function to create vegetation segments
            function createVegetationSegments(vegetationData, startAngle, endAngle) {
                const { inner, middle, outer } = radiusRanges.vegetation;
                const { forest, other, curve, divider } = colorSchemes.vegetation;

                // Clear existing vegetation segments
                svg.selectAll(".vegetation-segment, .vegetation-label, .vegetation-curve, .vegetation-divider").remove();

                // Sort by abundance
                vegetationData.sort((a, b) => b.茂盛度 - a.茂盛度);

                // Calculate the angle for each vegetation
                const totalAbundance = d3.sum(vegetationData, d => +d.茂盛度);
                const sectionAngle = endAngle - startAngle;
                const anglePerAbundance = sectionAngle / totalAbundance;

                // Create vegetation segments
                let currentAngle = startAngle;
                const curvePoints = [];

                // First create the second layer dividing lines
                vegetationData.forEach((vegetation, i) => {
                    const vegetationAngle = +vegetation.茂盛度 * anglePerAbundance;
                    const vegetationStartAngle = currentAngle;
                    const vegetationEndAngle = Math.min(currentAngle + vegetationAngle, endAngle);

                    // Create dividing line
                    const dividerArc = d3.arc()
                        .innerRadius(middle)
                        .outerRadius(outer)
                        .startAngle(vegetationStartAngle)
                        .endAngle(vegetationEndAngle);

                    svg.append("path")
                        .attr("d", dividerArc)
                        .attr("class", "vegetation-divider")
                        .style("fill", "none")
                        .style("stroke","#a09080")
                        .style("stroke-width", 1);

                    currentAngle = vegetationEndAngle;
                });

                // Reset angle
                currentAngle = startAngle;

                // Add starting point
                curvePoints.push({
                    x: middle * Math.sin(startAngle),
                    y: -middle * Math.cos(startAngle)
                });

                // Create first layer segments and calculate curve points
                vegetationData.forEach((vegetation, i) => {
                    const vegetationAngle = +vegetation.茂盛度 * anglePerAbundance;
                    const vegetationStartAngle = currentAngle;
                    const vegetationEndAngle = Math.min(currentAngle + vegetationAngle, endAngle);

                    // Create inner segment
                    const arc = d3.arc()
                        .innerRadius(inner)
                        .outerRadius(middle)
                        .startAngle(vegetationStartAngle)
                        .endAngle(vegetationEndAngle);

                    svg.append("path")
                        .attr("d", arc)
                        .attr("class", "vegetation-segment")
                        .style("stroke", "#a09080") // 柔和的沙灰色描边
                        .style("stroke-width", 0.5) // 细描边
                        .style("fill", vegetation.具体种类.includes("林") ? forest : other);

                    // Calculate curve points
                    const midAngle = (vegetationStartAngle + vegetationEndAngle) / 2;
                    const normalizedAbundance = +vegetation.茂盛度 / 5;
                    const curveRadius = middle + (outer - middle) * normalizedAbundance;

                    curvePoints.push({
                        x: curveRadius * Math.sin(midAngle),
                        y: -curveRadius * Math.cos(midAngle)
                    });

                    // Add vegetation label
                    const labelAngle = vegetationStartAngle + (vegetationEndAngle - vegetationStartAngle) / 2;
                    const labelRadius = (inner + middle) / 2;

                    svg.append("text")
                        .attr("x", labelRadius * Math.sin(labelAngle))
                        .attr("y", -labelRadius * Math.cos(labelAngle))
                        .attr("class", "vegetation-label")
                        .attr("transform", `rotate(${labelAngle * 180 / Math.PI}, ${labelRadius * Math.sin(labelAngle)}, ${-labelRadius * Math.cos(labelAngle)})`)
                        .text(vegetation.具体种类);

                    // Add abundance label
                    const abundanceLabelRadius = curveRadius;
                    svg.append("text")
                        .attr("x", abundanceLabelRadius * Math.sin(labelAngle))
                        .attr("y", -abundanceLabelRadius * Math.cos(labelAngle))
                        .attr("class", "vegetation-label")
                        .attr("transform", `rotate(${labelAngle * 180 / Math.PI - 90}, ${abundanceLabelRadius * Math.sin(labelAngle)}, ${-abundanceLabelRadius * Math.cos(labelAngle)})`)
                        .text(vegetation.茂盛度);

                    currentAngle = vegetationEndAngle;
                });

                // Add ending point
                curvePoints.push({
                    x: middle * Math.sin(endAngle),
                    y: -middle * Math.cos(endAngle)
                });

                // Create abundance curve
                const line = d3.line()
                    .x(d => d.x)
                    .y(d => d.y)
                    .curve(d3.curveBasis);

                svg.append("path")
                    .datum(curvePoints)
                    .attr("class", "vegetation-curve")
                    .attr("d", line)
                    .style("stroke", curve)
                    .style("stroke-width", 2);
            }

            // Function to create climate segments
            function createClimateSegments(climateData, startAngle, endAngle) {
                const { inner, middle, outer, image } = radiusRanges.climate;
                const { score, metric } = colorSchemes.climate;

                // Clear existing climate segments
                svg.selectAll(".climate-segment, .climate-label, .climate-image").remove();

                // Check if we have climate data
                if (!climateData || climateData.length === 0) {
                    console.warn('No climate data available');
                    return;
                }

                const climateInfo = climateData[0];

                // Create first layer (meteorological score)
                const scoreArc = d3.arc()
                    .innerRadius(inner)
                    .outerRadius(middle)
                    .startAngle(startAngle)
                    .endAngle(endAngle);

                svg.append("path")
                    .attr("d", scoreArc)
                    .attr("class", "climate-segment")
                    .style("stroke", "#a09080") // 柔和的沙灰色描边
                    .style("stroke-width", 0.5) // 细描边
                    .style("fill", score(climateInfo.气象评分 || 0));

                // Add meteorological score label
                const scoreLabelAngle = (startAngle + endAngle) / 2;
                const scoreLabelRadius = (inner + middle) / 2;

                // Create second layer (meteorological indicators)
                const metrics = [
                    { name: "平均气温", value: climateInfo.平均气温 || 0, unit: "°C" },
                    { name: "平均降水", value: climateInfo.平均降水 || 0, unit: "mm" },
                    { name: "平均日照", value: climateInfo.平均日照 || 0, unit: "h" },
                    { name: "平均风速", value: climateInfo.平均风速 || 0, unit: "m/s" },
                    { name: "相对湿度", value: climateInfo.相对湿度 || 0, unit: "%" }
                ];

                const metricAngle = (endAngle - startAngle) / metrics.length;
                let currentAngle = startAngle;

                metrics.forEach((metric, i) => {
                    const metricStartAngle = currentAngle;
                    const metricEndAngle = currentAngle + metricAngle;

                    // Create indicator segment
                    const metricArc = d3.arc()
                        .innerRadius(middle)
                        .outerRadius(outer)
                        .startAngle(metricStartAngle)
                        .endAngle(metricEndAngle);

                    svg.append("path")
                        .attr("d", metricArc)
                        .attr("class", "climate-segment")
                        .style("fill", colorSchemes.climate.metric.background)
                        .style("stroke", colorSchemes.climate.metric.border)
                        .style("stroke-width", 1);

                    // Add indicator label
                    const labelAngle = (metricStartAngle + metricEndAngle) / 2;
                    const labelRadius = (middle + outer) / 2;

                    svg.append("text")
                        .attr("x", labelRadius * Math.sin(labelAngle))
                        .attr("y", -labelRadius * Math.cos(labelAngle))
                        .attr("class", "climate-label")
                        .attr("transform", `rotate(${labelAngle * 180 / Math.PI}, ${labelRadius * Math.sin(labelAngle)}, ${-labelRadius * Math.cos(labelAngle)})`)
                        .style("fill", colorSchemes.climate.metric.text)
                        .style("font-size", "8px")
                        .text(`${metric.value}${metric.unit}`);

                    // Add corresponding image
                    const imageSize = 30;
                    const imageRadius = image;

                    svg.append("image")
                        .attr("x", imageRadius * Math.sin(labelAngle) - imageSize/2)
                        .attr("y", -imageRadius * Math.cos(labelAngle) - imageSize/2)
                        .attr("width", imageSize)
                        .attr("height", imageSize)
                        .style("opacity", 0.8)// 稍微降低图像不透明度
                        .attr("xlink:href", `./image/${metric.name}.png`)
                        .attr("class", "climate-image");

                    currentAngle = metricEndAngle;
                });

                // Add legend
                const legend = svg.append("g")
                    .attr("class", "climate-legend")
                    .attr("transform", `translate(${-radius * 1.6 + 40}, ${-radius * 1.2 + 10})`);  // Move to legend area

                // Add meteorological score legend
                const gradient = legend.append("defs")
                    .append("linearGradient")
                    .attr("id", "score-gradient")
                    .attr("x1", "0%")
                    .attr("y1", "0%")
                    .attr("x2", "100%")
                    .attr("y2", "0%");

                gradient.append("stop")
                    .attr("offset", "0%")
                    .attr("stop-color", "#ffebee");

                gradient.append("stop")
                    .attr("offset", "100%")
                    .attr("stop-color", "#ef5350");

                legend.append("rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", 100)
                    .attr("height", 10)
                    .style("fill", "url(#score-gradient)");

                legend.append("text")
                    .attr("x", 0)
                    .attr("y", 25)
                    .style("font-size", "10px")
                    .style("fill", colorSchemes.climate.metric.text)
                    .text("气象评分 (0-5)");
            }

            // Function to create population and occupation distribution segments
            function createPopulationSegments(populationData) {
                const { inner, outer, map } = radiusRanges.population;
                const { segment, map: mapColors } = colorSchemes.population;

                // Clear existing population segments
                svg.selectAll(".population-segment, .population-label, .population-divider").remove();

                // Filter population data for the specified dynasty
                const currentDynastyData = populationData.find(d => d.历史时期 === dynasty);

                if (!currentDynastyData) {
                    console.warn(`No population data found for dynasty: ${dynasty}`);
                    return; // Exit if no data for the dynasty
                }

                // Parse occupation distribution data
                const occupations = currentDynastyData.人口职业分布.split("、");
                const occupationCounts = occupations.map(occ => {
                    const [name, count] = occ.split("：");
                    return { name, count: parseInt(count) };
                });

                // Calculate total number of occupations
                const totalOccupations = occupationCounts.length;

                // Angle for each occupation
                const anglePerOccupation = (2 * Math.PI) / totalOccupations;

                // First create the dividing lines
                occupationCounts.forEach((_, index) => {
                    const angle = index * anglePerOccupation;
                    svg.append("line")
                        .attr("x1", inner * Math.sin(angle))
                        .attr("y1", -inner * Math.cos(angle))
                        .attr("x2", outer * Math.sin(angle))
                        .attr("y2", -outer * Math.cos(angle))
                        .attr("class", "population-divider")
                        .style("stroke", mapColors.border)
                        .style("stroke-width", 1);
                });


                // Create segments and labels
                occupationCounts.forEach((occupation, index) => {
                    const startAngle = index * anglePerOccupation;
                    const endAngle = (index + 1) * anglePerOccupation;

                    // Create segment
                    const arc = d3.arc()
                        .innerRadius(inner)
                        .outerRadius(outer)
                        .startAngle(startAngle)
                        .endAngle(endAngle);

                    svg.append("path")
                        .attr("d", arc)
                        .attr("class", "population-segment")
                        .style("fill", segment);

                    // Add label
                    const labelAngle = startAngle + anglePerOccupation / 2;
                    const labelRadius = (inner + outer) / 2;
                    const rotationAngle = labelAngle * 180 / Math.PI - 90;

                    svg.append("text")
                        .attr("x", labelRadius * Math.sin(labelAngle))
                        .attr("y", -labelRadius * Math.cos(labelAngle))
                        .attr("class", "population-label")
                        .attr("transform", `rotate(${rotationAngle-90}, ${labelRadius * Math.sin(labelAngle)}, ${-labelRadius * Math.cos(labelAngle)})`)
                        .style("font-size", "8px")
                        .style("text-anchor", "middle")
                        .text(occupation.name);
                });

                // Define data for different dynasties (simplified for example)
                const dynastyMapData = {
                    "周": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "蓟", isMajor: true },
                            { x: 0.1, y: -0.1, name: "燕", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.2 },
                            { x: 0.15, y: -0.15, r: map * 0.15 }
                        ]
                    },
                    "春秋": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "蓟", isMajor: true },
                            { x: 0.1, y: -0.1, name: "燕", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿", isMajor: false },
                            { x: 0.2, y: 0.2, name: "易", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "易水", labelX: 0.25, labelY: 0.1 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.25 },
                            { x: 0.15, y: -0.15, r: map * 0.2 },
                            { x: 0.1, y: 0.2, r: map * 0.15 }
                        ]
                    },
                    "战国": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "蓟", isMajor: true },
                            { x: 0.1, y: -0.1, name: "燕", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿", isMajor: true },
                            { x: 0.2, y: 0.2, name: "易", isMajor: false },
                            { x: -0.2, y: -0.1, name: "良乡", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "易水", labelX: 0.25, labelY: 0.1 },
                            { x1: -0.25, y1: 0.3, x2: -0.1, y2: 0.1, name: "桑乾河", labelX: -0.15, labelY: 0.2 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.3 },
                            { x: 0.15, y: -0.15, r: map * 0.25 },
                            { x: 0.1, y: 0.2, r: map * 0.2 },
                            { x: -0.1, y: 0.1, r: map * 0.15 }
                        ]
                    },
                    "秦": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "蓟城", isMajor: true },
                            { x: 0.1, y: -0.1, name: "广阳", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿县", isMajor: false },
                            { x: 0.2, y: 0.2, name: "易县", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "易水", labelX: 0.25, labelY: 0.1 },
                            { x1: -0.25, y1: 0.3, x2: -0.1, y2: 0.1, name: "桑乾河", labelX: -0.15, labelY: 0.2 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.35 },
                            { x: 0.15, y: -0.15, r: map * 0.3 },
                            { x: 0.1, y: 0.2, r: map * 0.25 },
                            { x: -0.1, y: 0.1, r: map * 0.2 }
                        ]
                    },
                    "金": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "中都", isMajor: true },
                            { x: 0.1, y: -0.1, name: "大兴府", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿州", isMajor: true },
                            { x: 0.2, y: 0.2, name: "通州", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "潮白河", labelX: 0.25, labelY: 0.1 },
                            { x1: -0.25, y1: 0.3, x2: -0.1, y2: 0.1, name: "桑乾河", labelX: -0.15, labelY: 0.2 },
                            { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.3, name: "通惠河", labelX: 0.2, labelY: 0.25 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.5 },
                            { x: 0.15, y: -0.15, r: map * 0.4 },
                            { x: 0.1, y: 0.2, r: map * 0.3 },
                            { x: -0.1, y: 0.1, r: map * 0.35 }
                        ]
                    },
                    "元": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "大都", isMajor: true },
                            { x: 0.1, y: -0.1, name: "大兴府", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿州", isMajor: true },
                            { x: 0.2, y: 0.2, name: "通州", isMajor: true },
                            { x: -0.2, y: -0.1, name: "良乡", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "潮白河", labelX: 0.25, labelY: 0.1 },
                            { x1: -0.25, y1: 0.3, x2: -0.1, y2: 0.1, name: "桑乾河", labelX: -0.15, labelY: 0.2 },
                            { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.3, name: "通惠河", labelX: 0.2, labelY: 0.25 },
                            { x1: -0.2, y1: -0.2, x2: 0.1, y2: -0.1, name: "金水河", labelX: -0.05, labelY: -0.15 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.55 },
                            { x: 0.15, y: -0.15, r: map * 0.45 },
                            { x: 0.1, y: 0.2, r: map * 0.35 },
                            { x: -0.1, y: 0.1, r: map * 0.4 },
                            { x: 0.2, y: 0.2, r: map * 0.3 }
                        ]
                    },
                    "明": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "北京", isMajor: true },
                            { x: 0.1, y: -0.1, name: "大兴", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿州", isMajor: true },
                            { x: 0.2, y: 0.2, name: "通州", isMajor: true },
                            { x: -0.2, y: -0.1, name: "良乡", isMajor: false },
                            { x: 0.15, y: 0.1, name: "顺义", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "潮白河", labelX: 0.25, labelY: 0.1 },
                            { x1: -0.25, y1: 0.3, x2: -0.1, y2: 0.1, name: "桑乾河", labelX: -0.15, labelY: 0.2 },
                            { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.3, name: "通惠河", labelX: 0.2, labelY: 0.25 },
                            { x1: -0.2, y1: -0.2, x2: 0.1, y2: -0.1, name: "金水河", labelX: -0.05, labelY: -0.15 },
                            { x1: 0.15, y1: 0.1, x2: 0.25, y2: 0.2, name: "温榆河", labelX: 0.2, labelY: 0.15 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.6 },
                            { x: 0.15, y: -0.15, r: map * 0.5 },
                            { x: 0.1, y: 0.2, r: map * 0.4 },
                            { x: -0.1, y: 0.1, r: map * 0.45 },
                            { x: 0.2, y: 0.2, r: map * 0.35 },
                            { x: 0.15, y: 0.1, r: map * 0.3 }
                        ]
                    },
                    "汉": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "蓟城", isMajor: true },
                            { x: 0.1, y: -0.1, name: "广阳", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿县", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.3 },
                            { x: 0.15, y: -0.15, r: map * 0.25 }
                        ]
                    },
                    "三国": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "蓟城", isMajor: true },
                            { x: 0.1, y: -0.1, name: "广阳", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿县", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.25 },
                            { x: 0.15, y: -0.15, r: map * 0.2 }
                        ]
                    },
                    "晋": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "蓟城", isMajor: true },
                            { x: 0.1, y: -0.1, name: "广阳", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿县", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.25 },
                            { x: 0.15, y: -0.15, r: map * 0.2 }
                        ]
                    },
                    "南北朝": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "蓟城", isMajor: true },
                            { x: 0.1, y: -0.1, name: "广阳", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿县", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.25 },
                            { x: 0.15, y: -0.15, r: map * 0.2 }
                        ]
                    },
                    "唐": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "幽州", isMajor: true },
                            { x: 0.1, y: -0.1, name: "蓟县", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿州", isMajor: true },
                            { x: 0.2, y: 0.2, name: "檀州", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "潮白河", labelX: 0.25, labelY: 0.1 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.35 },
                            { x: 0.15, y: -0.15, r: map * 0.3 },
                            { x: 0.1, y: 0.2, r: map * 0.25 }
                        ]
                    },
                    "清": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "北京", isMajor: true },
                            { x: 0.1, y: -0.1, name: "大兴", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿州", isMajor: true },
                            { x: 0.2, y: 0.2, name: "通州", isMajor: true },
                            { x: -0.2, y: -0.1, name: "良乡", isMajor: false },
                            { x: 0.15, y: 0.1, name: "顺义", isMajor: false },
                            { x: -0.1, y: -0.2, name: "房山", isMajor: false }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "潮白河", labelX: 0.25, labelY: 0.1 },
                            { x1: -0.25, y1: 0.3, x2: -0.1, y2: 0.1, name: "桑乾河", labelX: -0.15, labelY: 0.2 },
                            { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.3, name: "通惠河", labelX: 0.2, labelY: 0.25 },
                            { x1: -0.2, y1: -0.2, x2: 0.1, y2: -0.1, name: "金水河", labelX: -0.05, labelY: -0.15 },
                            { x1: 0.15, y1: 0.1, x2: 0.25, y2: 0.2, name: "温榆河", labelX: 0.2, labelY: 0.15 },
                            { x1: -0.1, y1: -0.2, x2: 0.1, y2: -0.1, name: "房山河", labelX: 0, labelY: -0.15 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.65 },
                            { x: 0.15, y: -0.15, r: map * 0.55 },
                            { x: 0.1, y: 0.2, r: map * 0.45 },
                            { x: -0.1, y: 0.1, r: map * 0.5 },
                            { x: 0.2, y: 0.2, r: map * 0.4 },
                            { x: 0.15, y: 0.1, r: map * 0.35 },
                            { x: -0.1, y: -0.2, r: map * 0.3 }
                        ]
                    },
                    "民国": {
                        cities: [
                            {x: -0.1, y: 0.1, name: "北平", isMajor: true},
                            {x: 0.1, y: -0.1, name: "大兴", isMajor: true},
                            {x: -0.15, y: 0.15, name: "涿州", isMajor: true},
                            {x: 0.2, y: 0.2, name: "通州", isMajor: true},
                            {x: -0.2, y: -0.1, name: "良乡", isMajor: false},
                            {x: 0.15, y: 0.1, name: "顺义", isMajor: false},
                            {x: -0.1, y: -0.2, name: "房山", isMajor: false},
                            {x: 0.25, y: -0.15, name: "昌平", isMajor: false}
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "潮白河", labelX: 0.25, labelY: 0.1 },
                            { x1: -0.25, y1: 0.3, x2: -0.1, y2: 0.1, name: "桑乾河", labelX: -0.15, labelY: 0.2 },
                            { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.3, name: "通惠河", labelX: 0.2, labelY: 0.25 },
                            { x1: -0.2, y1: -0.2, x2: 0.1, y2: -0.1, name: "金水河", labelX: -0.05, labelY: -0.15 },
                            { x1: 0.15, y1: 0.1, x2: 0.25, y2: 0.2, name: "温榆河", labelX: 0.2, labelY: 0.15 },
                            { x1: -0.1, y1: -0.2, x2: 0.1, y2: -0.1, name: "房山河", labelX: 0, labelY: -0.15 },
                            { x1: 0.25, y1: -0.15, x2: 0.3, y2: -0.1, name: "昌平河", labelX: 0.28, labelY: -0.12 }
                        ],
                        populationDensity: [
                            {x: -0.2, y: -0.2, r: map * 0.7},
                            {x: 0.15, y: -0.15, r: map * 0.6},
                            {x: 0.1, y: 0.2, r: map * 0.5},
                            {x: -0.1, y: 0.1, r: map * 0.55},
                            {x: 0.2, y: 0.2, r: map * 0.45},
                            {x: 0.15, y: 0.1, r: map * 0.4},
                            {x: -0.1, y: -0.2, r: map * 0.35},
                            {x: 0.25, y: -0.15, r: map * 0.3}
                        ]
                    },
                    "隋": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "幽州城", isMajor: true },
                            { x: 0.1, y: -0.1, name: "蓟县", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿郡", isMajor: true }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "潮白河", labelX: 0.25, labelY: 0.1 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.4 },
                            { x: 0.15, y: -0.15, r: map * 0.3 }
                        ]
                    },
                     "辽": {
                        cities: [
                            { x: -0.1, y: 0.1, name: "南京", isMajor: true },
                            { x: 0.1, y: -0.1, name: "析津府", isMajor: true },
                            { x: -0.15, y: 0.15, name: "涿州", isMajor: true }
                        ],
                        rivers: [
                            { x1: -0.3, y1: 0.2, x2: 0.3, y2: -0.2, name: "永定河", labelX: 0.1, labelY: -0.1 },
                            { x1: -0.2, y1: -0.3, x2: 0.2, y2: 0.1, name: "蓟水", labelX: 0, labelY: -0.2 },
                            { x1: 0.2, y1: 0.3, x2: 0.3, y2: -0.1, name: "潮白河", labelX: 0.25, labelY: 0.1 },
                            { x1: -0.25, y1: 0.3, x2: -0.1, y2: 0.1, name: "桑乾河", labelX: -0.15, labelY: 0.2 }
                        ],
                        populationDensity: [
                            { x: -0.2, y: -0.2, r: map * 0.45 },
                            { x: 0.15, y: -0.15, r: map * 0.35 },
                            { x: 0.1, y: 0.2, r: map * 0.25 }
                        ]
                    }
                };

                // Get data for the current dynasty
                const data = dynastyMapData[dynasty] || dynastyMapData["隋"]; // Default to Sui dynasty data

                // Create map group
                const mapGroup = svg.append("g")
                    .attr("class", "map-group");

                // Create map background circle
                mapGroup.append("circle")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", map)
                    .style("fill", mapColors.background)
                    .style("stroke", mapColors.border)
                    .style("stroke-width", 1);

                // Add population dense areas
                data.populationDensity.forEach(density => {
                    mapGroup.append("circle")
                        .attr("cx", density.x * map)
                        .attr("cy", density.y * map)
                        .attr("r", density.r)
                        .style("fill", mapColors.density)
                        .style("stroke", mapColors.densityBorder)
                        .style("stroke-width", 1);
                });

                // Add rivers
                data.rivers.forEach(river => {
                    // Draw river
                    mapGroup.append("line")
                        .attr("x1", river.x1 * map)
                        .attr("y1", river.y1 * map)
                        .attr("x2", river.x2 * map)
                        .attr("y2", river.y2 * map)
                        .style("stroke", mapColors.river)
                        .style("stroke-width", 2)
                        .style("opacity", 0.8);

                    // Add river label
                    mapGroup.append("text")
                        .attr("x", river.labelX * map)
                        .attr("y", river.labelY * map)
                        .attr("class", "river-label")
                        .style("font-size", "8px")
                        .style("fill", mapColors.river)
                        .text(river.name);
                });

                // Add city points
                data.cities.forEach(city => {
                    // Draw city point
                    mapGroup.append("circle")
                        .attr("cx", city.x * map)
                        .attr("cy", city.y * map)
                        .attr("r", city.isMajor ? 4 : 3)
                        .style("fill", mapColors.city);

                    // Add city label
                    mapGroup.append("text")
                        .attr("x", (city.x + 0.02) * map)
                        .attr("y", (city.y + 0.02) * map)
                        .attr("class", "city-label")
                        .style("font-size", "8px")
                        .style("fill", "#333")
                        .text(city.name);
                });

                // Add legend
                const legend = mapGroup.append("g")
                    .attr("class", "map-legend")
                    .attr("transform", `translate(${-map * 0.65}, ${-map * 0.65})`);

                // Population dense area legend
                legend.append("circle")
                    .attr("r", 5)
                    .style("fill", mapColors.density)
                    .style("stroke", mapColors.densityBorder);

                legend.append("text")
                    .attr("x", 10)
                    .attr("y", 4)
                    .style("font-size", "8px")
                    .text("人口密集区");

                // River legend
                legend.append("line")
                    .attr("x1", 0)
                    .attr("y1", 15)
                    .attr("x2", 10)
                    .attr("y2", 15)
                    .style("stroke", mapColors.river)
                    .style("stroke-width", 2);

                legend.append("text")
                    .attr("x", 15)
                    .attr("y", 18)
                    .style("font-size", "8px")
                    .text("河流");

                // City legend
                legend.append("circle")
                    .attr("cx", 0)
                    .attr("cy", 30)
                    .attr("r", 4)
                    .style("fill", mapColors.city);

                legend.append("text")
                    .attr("x", 10)
                    .attr("y", 34)
                    .style("font-size", "8px")
                    .text("主要城市");
            }


            // Filter data for the specified dynasty
            const filteredRiverData = (riverData || []).filter(d => d.朝代 === dynasty);
            const filteredVegetationData = (vegetationData || []).filter(d => d.历史时期 === dynasty);
            const filteredClimateData = (climateData || []).filter(d => d.历史时期 === dynasty);
            const filteredPopulationData = (populationData || []).filter(d => d.历史时期 === dynasty);

            // Update each section with filtered data
            createRiverSegments(filteredRiverData, false, 0, 2 * Math.PI / 3);
            createVegetationSegments(filteredVegetationData, 2 * Math.PI / 3, 4 * Math.PI / 3);
            createClimateSegments(filteredClimateData, 4 * Math.PI / 3, 2 * Math.PI);
            createPopulationSegments(filteredPopulationData);

            // Cleanup function
            return () => {
                d3.select(d3Container.current).selectAll("*").remove();
            };
        }
    }, [dynasty, startYear, endYear, riverData, vegetationData, climateData, populationData]); // Dependencies

    return (
        <div ref={d3Container} id="chart3"></div>
    );
}

export default DynastyVisualization;
