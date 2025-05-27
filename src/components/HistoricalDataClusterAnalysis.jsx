// src/components/HistoricalDataClusterAnalysis.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import useDynastyStore, { dynastyData } from '../store/dynastyStore';

const HistoricalDataClusterAnalysis = () => {
  const { selectedDynasties } = useDynastyStore();
  
  const [reformData, setReformData] = useState([]);
  const [disasterData, setDisasterData] = useState([]);
  const [selectedDataType, setSelectedDataType] = useState('reform');
  const [clusteredData, setClusteredData] = useState([]);
  const [correlationMatrix, setCorrelationMatrix] = useState([]);
  const [pcaResult, setPcaResult] = useState({ pcaData: [], pc1Variance: 0, pc2Variance: 0 });
  
  const pcaRef = useRef();
  const parallelRef = useRef();
  const radarRef = useRef();
  const heatmapRef = useRef();

  // 递归查找主朝代名称
  const getMainDynasty = (dynastyName) => {
    const dynasty = dynastyData.find(d => d.name === dynastyName);
    if (!dynasty || !dynasty.subOf) {
      return dynastyName;
    }
    const parentDynasty = dynastyData.find(d => d.id === dynasty.subOf);
    return parentDynasty ? getMainDynasty(parentDynasty.name) : dynastyName;
  };

  const mapToMainDynasties = (data) => {
    return data.map(item => ({
      ...item,
      dynasty: getMainDynasty(item.dynasty)
    }));
  };

  // K-means聚类算法
  const kMeans = (data, k = 2, maxIter = 100) => {
    if (data.length === 0) return [];
    
    const points = data.map(d => [d.scale, d.population_change, d.economic_cultural_impact]);
    
    // 随机初始化中心点
    let centroids = [];
    for (let i = 0; i < k; i++) {
      const randomPoint = points[Math.floor(Math.random() * points.length)];
      centroids.push([...randomPoint]);
    }
    
    let assignments = new Array(points.length);
    
    for (let iter = 0; iter < maxIter; iter++) {
      let changed = false;
      for (let i = 0; i < points.length; i++) {
        let minDist = Infinity;
        let newCluster = 0;
        
        for (let j = 0; j < k; j++) {
          const dist = Math.sqrt(
            Math.pow(points[i][0] - centroids[j][0], 2) +
            Math.pow(points[i][1] - centroids[j][1], 2) +
            Math.pow(points[i][2] - centroids[j][2], 2)
          );
          if (dist < minDist) {
            minDist = dist;
            newCluster = j;
          }
        }
        
        if (assignments[i] !== newCluster) {
          changed = true;
          assignments[i] = newCluster;
        }
      }
      
      if (!changed) break;
      
      // 更新中心点
      for (let j = 0; j < k; j++) {
        const clusterPoints = points.filter((_, i) => assignments[i] === j);
        if (clusterPoints.length > 0) {
          centroids[j] = [
            clusterPoints.reduce((sum, p) => sum + p[0], 0) / clusterPoints.length,
            clusterPoints.reduce((sum, p) => sum + p[1], 0) / clusterPoints.length,
            clusterPoints.reduce((sum, p) => sum + p[2], 0) / clusterPoints.length
          ];
        }
      }
    }
    
    return data.map((d, i) => ({
      ...d,
      cluster: assignments[i]
    }));
  };

  // 计算相关性矩阵
  const calculateCorrelation = (data) => {
    if (data.length === 0) return [];
    
    const fields = ['scale', 'population_change', 'economic_cultural_impact'];
    const matrix = [];
    
    for (let i = 0; i < fields.length; i++) {
      const row = [];
      for (let j = 0; j < fields.length; j++) {
        const x = data.map(d => d[fields[i]]);
        const y = data.map(d => d[fields[j]]);
        
        const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
        const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
        
        const numerator = x.reduce((sum, val, idx) => sum + (val - meanX) * (y[idx] - meanY), 0);
        const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
        const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));
        
        const correlation = denomX === 0 || denomY === 0 ? 0 : numerator / (denomX * denomY);
        row.push({ x: fields[j], y: fields[i], value: correlation });
      }
      matrix.push(row);
    }
    
    return matrix.flat();
  };

  // PCA降维算法
  const performPCA = (data) => {
    if (data.length === 0) return { pcaData: [], pc1Variance: 0, pc2Variance: 0 };
    
    const features = ['scale', 'population_change', 'economic_cultural_impact'];
    const matrix = data.map(d => features.map(f => d[f]));
    const n = matrix.length;
    const m = features.length;
    
    // 计算均值并中心化数据
    const means = features.map((_, j) => 
      matrix.reduce((sum, row) => sum + row[j], 0) / n
    );
    
    const centeredMatrix = matrix.map(row => 
      row.map((val, j) => val - means[j])
    );
    
    // 计算协方差矩阵
    const covMatrix = Array(m).fill().map(() => Array(m).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        covMatrix[i][j] = centeredMatrix.reduce((sum, row) => 
          sum + row[i] * row[j], 0
        ) / (n - 1);
      }
    }
    
    // 幂迭代法求特征向量（适用于3x3矩阵）
    const powerIteration = (matrix, iterations = 100) => {
      let v = [1, 1, 1];
      
      for (let iter = 0; iter < iterations; iter++) {
        const newV = [0, 0, 0];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            newV[i] += matrix[i][j] * v[j];
          }
        }
        
        const norm = Math.sqrt(newV.reduce((sum, val) => sum + val * val, 0));
        if (norm > 0) {
          v = newV.map(val => val / norm);
        }
      }
      
      // 计算对应特征值
      const matrixV = [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          matrixV[i] += matrix[i][j] * v[j];
        }
      }
      const eigenvalue = matrixV.reduce((sum, val, i) => sum + val * v[i], 0);
      
      return { vector: v, value: eigenvalue };
    };
    
    // 获取前两个主成分
    const pc1 = powerIteration(covMatrix);
    
    const deflatedMatrix = Array(m).fill().map(() => Array(m).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        deflatedMatrix[i][j] = covMatrix[i][j] - pc1.value * pc1.vector[i] * pc1.vector[j];
      }
    }
    
    const pc2 = powerIteration(deflatedMatrix);
    
    // 投影到主成分空间
    const pcaData = data.map((d, index) => {
      const centeredRow = features.map((f, j) => d[f] - means[j]);
      const pc1Score = centeredRow.reduce((sum, val, j) => sum + val * pc1.vector[j], 0);
      const pc2Score = centeredRow.reduce((sum, val, j) => sum + val * pc2.vector[j], 0);
      
      return {
        ...d,
        pc1: pc1Score,
        pc2: pc2Score
      };
    });
    
    // 计算方差解释比例
    const totalVariance = pc1.value + pc2.value + (covMatrix[0][0] + covMatrix[1][1] + covMatrix[2][2] - pc1.value - pc2.value);
    const pc1Variance = pc1.value / totalVariance;
    const pc2Variance = pc2.value / totalVariance;
    
    return { 
      pcaData, 
      pc1Variance: Math.max(0, Math.min(1, pc1Variance)), 
      pc2Variance: Math.max(0, Math.min(1, pc2Variance))
    };
  };

  const parseCSV = (content) => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        dynasty: values[0]?.trim() || '',
        scale: parseInt(values[1]) || 0,
        population_change: parseInt(values[2]) || 0,
        economic_cultural_impact: parseInt(values[3]) || 0
      };
    }).filter(d => d.dynasty && !isNaN(d.scale));
  };

  // 数据加载
  useEffect(() => {
    const loadData = async () => {
      try {
        const [reformResponse, disasterResponse] = await Promise.all([
          fetch('/data/制度改革.csv'),
          fetch('/data/灾变.csv')
        ]);
        
        if (!reformResponse.ok || !disasterResponse.ok) {
          console.warn('部分数据文件加载失败');
          return;
        }
        
        const reformContent = await reformResponse.text();
        const disasterContent = await disasterResponse.text();
        
        const reformParsed = parseCSV(reformContent);
        const disasterParsed = parseCSV(disasterContent);
        
        setReformData(mapToMainDynasties(reformParsed));
        setDisasterData(mapToMainDynasties(disasterParsed));
        
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    
    loadData();
  }, []);

  // 数据筛选和分析
  useEffect(() => {
    const currentData = selectedDataType === 'reform' ? reformData : disasterData;
    let filteredData = [];
    
    if (selectedDynasties.includes('overview')) {
      filteredData = currentData;
    } else {
      filteredData = currentData.filter(d => selectedDynasties.includes(d.dynasty));
    }
    
    if (filteredData.length > 0) {
      const clustered = kMeans(filteredData);
      const pca = performPCA(clustered);
      setClusteredData(clustered);
      setPcaResult(pca);
      setCorrelationMatrix(calculateCorrelation(filteredData));
    } else {
      setClusteredData([]);
      setPcaResult({ pcaData: [], pc1Variance: 0, pc2Variance: 0 });
      setCorrelationMatrix([]);
    }
  }, [reformData, disasterData, selectedDataType, selectedDynasties]);

  // PCA降维图
  useEffect(() => {
    if (!pcaResult.pcaData.length || !pcaRef.current) return;
    
    const svg = d3.select(pcaRef.current);
    svg.selectAll("*").remove();
    
    svg.attr('viewBox', '0 0 400 300').attr('preserveAspectRatio', 'xMidYMid meet');
    
    const margin = { top: 30, right: 60, bottom: 60, left: 60 };
    const width = 400 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 检查聚类数据存在性
    const clusterDataCheck = [0, 1].map(cluster => {
      const clusterPoints = pcaResult.pcaData.filter(d => d.cluster === cluster);
      return { cluster, hasData: clusterPoints.length > 0, points: clusterPoints };
    });
    
    const xExtent = d3.extent(pcaResult.pcaData, d => d.pc1);
    const yExtent = d3.extent(pcaResult.pcaData, d => d.pc2);
    
    const xScale = d3.scaleLinear().domain(xExtent).range([0, width]);
    const yScale = d3.scaleLinear().domain(yExtent).range([height, 0]);
    const colorScale = d3.scaleOrdinal().domain([0, 1]).range(['#D4A574', '#A5A8AD']);
    
    const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d3.format(".2f"));
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".2f"));
    
    g.append("g").attr("transform", `translate(0,${height})`).call(xAxis)
      .attr("font-family", "'Noto Serif SC', serif").attr("color", "#4A4A4A");
    
    g.append("g").call(yAxis)
      .attr("font-family", "'Noto Serif SC', serif").attr("color", "#4A4A4A");
    
    // 坐标轴标签
    g.append("text")
      .attr("x", width / 2).attr("y", height + 40)
      .style("text-anchor", "middle")
      .style("font-family", "'Noto Serif SC', serif")
      .style("font-size", "12px").style("fill", "#4A4A4A")
      .text(`PC1 (${(pcaResult.pc1Variance * 100).toFixed(1)}%)`);
    
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2).attr("y", -40)
      .style("text-anchor", "middle")
      .style("font-family", "'Noto Serif SC', serif")
      .style("font-size", "12px").style("fill", "#4A4A4A")
      .text(`PC2 (${(pcaResult.pc2Variance * 100).toFixed(1)}%)`);
    
    // 网格线
    g.selectAll(".grid-line-x")
      .data(xScale.ticks(5))
      .enter().append("line")
      .attr("x1", d => xScale(d)).attr("x2", d => xScale(d))
      .attr("y1", 0).attr("y2", height)
      .style("stroke", "#DCD1BB").style("stroke-width", 0.5).style("opacity", 0.5);
    
    g.selectAll(".grid-line-y")
      .data(yScale.ticks(5))
      .enter().append("line")
      .attr("x1", 0).attr("x2", width)
      .attr("y1", d => yScale(d)).attr("y2", d => yScale(d))
      .style("stroke", "#DCD1BB").style("stroke-width", 0.5).style("opacity", 0.5);
    
    // 数据点
    g.selectAll(".pca-point")
      .data(pcaResult.pcaData)
      .enter().append("circle")
      .attr("cx", d => xScale(d.pc1)).attr("cy", d => yScale(d.pc2))
      .attr("r", 4)
      .style("fill", d => colorScale(d.cluster))
      .style("stroke", "white").style("stroke-width", 1).style("opacity", 0.8)
      .on("mouseover", function(event, d) {
        d3.select(this).attr("r", 6).style("opacity", 1);
        
        const tooltip = g.append("g")
          .attr("class", "pca-tooltip")
          .attr("transform", `translate(${xScale(d.pc1) + 10}, ${yScale(d.pc2) - 10})`);
        
        tooltip.append("rect")
          .attr("x", 0).attr("y", -20).attr("width", 120).attr("height", 40)
          .style("fill", "rgba(0,0,0,0.8)").style("rx", 4);
        
        tooltip.append("text").attr("x", 5).attr("y", -10)
          .style("fill", "white").style("font-size", "10px").text(`朝代: ${d.dynasty}`);
        tooltip.append("text").attr("x", 5).attr("y", 5)
          .style("fill", "white").style("font-size", "10px").text(`聚类: ${d.cluster + 1}`);
        tooltip.append("text").attr("x", 5).attr("y", 15)
          .style("fill", "white").style("font-size", "10px").text(`PC1: ${d.pc1.toFixed(2)}, PC2: ${d.pc2.toFixed(2)}`);
      })
      .on("mouseout", function() {
        d3.select(this).attr("r", 4).style("opacity", 0.8);
        g.selectAll(".pca-tooltip").remove();
      });
    
    // 图例
    const legend = svg.append("g").attr("transform", `translate(${width + margin.left + 10}, ${margin.top})`);
    
    legend.selectAll(".legend-item")
      .data(clusterDataCheck)
      .enter().append("g")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`)
      .each(function(d) {
        d3.select(this).append("circle")
          .attr("cx", 5).attr("cy", 5).attr("r", 4)
          .style("fill", colorScale(d.cluster))
          .style("stroke", "white").style("stroke-width", 1)
          .style("opacity", d.hasData ? 1 : 0.3);
        
        d3.select(this).append("text")
          .attr("x", 15).attr("y", 8)
          .text(`聚类 ${d.cluster + 1}`)
          .style("font-size", "9px")
          .style("font-family", "'Noto Serif SC', serif")
          .style("fill", "#4A4A4A")
          .style("opacity", d.hasData ? 1 : 0.6);
        
        if (!d.hasData) {
          d3.select(this).append("text")
            .attr("x", 15).attr("y", 18)
            .text("(无数据)")
            .style("font-size", "7px")
            .style("font-family", "'Noto Serif SC', serif")
            .style("fill", "#4A4A4A")
            .style("opacity", 0.5);
        }
      });
    
  }, [pcaResult]);

  // 平行坐标图
  useEffect(() => {
    if (!clusteredData.length || !parallelRef.current) return;
    
    const svg = d3.select(parallelRef.current);
    svg.selectAll("*").remove();
    
    const dimensions = ['scale', 'population_change', 'economic_cultural_impact'];
    const labels = ['事件规模', '人口变化', '经济文化影响'];
    
    svg.attr('viewBox', '0 0 400 300').attr('preserveAspectRatio', 'xMidYMid meet');
    
    const margin = { top: 30, right: 60, bottom: 60, left: 60 };
    const width = 400 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 检查聚类数据存在性
    const clusterDataCheck = [0, 1].map(cluster => {
      const clusterPoints = clusteredData.filter(d => d.cluster === cluster);
      return { cluster, hasData: clusterPoints.length > 0, points: clusterPoints };
    });
    
    const y = {};
    dimensions.forEach(dim => {
      const extent = d3.extent(clusteredData, d => d[dim]);
      y[dim] = d3.scaleLinear().domain(extent).range([height, 0]);
    });
    
    const x = d3.scalePoint().range([0, width]).domain(dimensions);
    const colorScale = d3.scaleOrdinal().domain([0, 1]).range(['#D4A574', '#A5A8AD']);
    
    // 连线
    g.selectAll(".line")
      .data(clusteredData)
      .enter().append("path")
      .attr("d", d => d3.line()(dimensions.map(p => [x(p), y[p](d[p])])))
      .style("fill", "none")
      .style("stroke", d => colorScale(d.cluster))
      .style("stroke-width", 1.5).style("opacity", 0.6);
    
    // 坐标轴
    g.selectAll(".axis")
      .data(dimensions)
      .enter().append("g")
      .attr("transform", d => `translate(${x(d)},0)`)
      .each(function(d, i) {
        d3.select(this).call(d3.axisLeft(y[d]).ticks(5).tickFormat(d3.format("d")));
        d3.select(this).selectAll("line, path").style("stroke", "#DCD1BB");
        d3.select(this).selectAll("text")
          .style("fill", "#4A4A4A")
          .style("font-family", "'Noto Serif SC', serif")
          .style("font-size", "10px");
        d3.select(this).append("text")
          .style("text-anchor", "middle").attr("y", height + 20)
          .text(labels[i])
          .style("fill", "#4A4A4A").style("font-size", "10px")
          .style("font-family", "'Noto Serif SC', serif");
      });
    
    // 图例
    const legend = svg.append("g").attr("transform", `translate(${width + margin.left + 10}, ${margin.top})`);
    
    legend.selectAll(".legend-item")
      .data(clusterDataCheck)
      .enter().append("g")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`)
      .each(function(d) {
        d3.select(this).append("rect")
          .attr("width", 10).attr("height", 10)
          .style("fill", colorScale(d.cluster))
          .style("opacity", d.hasData ? 1 : 0.3);
        
        d3.select(this).append("text")
          .attr("x", 15).attr("y", 8)
          .text(`聚类 ${d.cluster + 1}`)
          .style("font-size", "9px")
          .style("font-family", "'Noto Serif SC', serif")
          .style("fill", "#4A4A4A")
          .style("opacity", d.hasData ? 1 : 0.6);
        
        if (!d.hasData) {
          d3.select(this).append("text")
            .attr("x", 15).attr("y", 18)
            .text("(无数据)")
            .style("font-size", "7px")
            .style("font-family", "'Noto Serif SC', serif")
            .style("fill", "#4A4A4A")
            .style("opacity", 0.5);
        }
      });
    
  }, [clusteredData]);

  // 雷达图
  useEffect(() => {
    if (!clusteredData.length || !radarRef.current) return;
    
    const svg = d3.select(radarRef.current);
    svg.selectAll("*").remove();
    
    svg.attr('viewBox', '0 0 300 300').attr('preserveAspectRatio', 'xMidYMid meet');
    
    const width = 300;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 60;
    
    const g = svg.append("g").attr("transform", `translate(${width/2}, ${height/2})`);
    
    const dimensions = ['scale', 'population_change', 'economic_cultural_impact'];
    const labels = ['事件规模', '人口变化', '经济文化影响'];
    
    // 计算聚类均值
    const clusterMeans = [0, 1].map(cluster => {
      const clusterData = clusteredData.filter(d => d.cluster === cluster);
      if (clusterData.length === 0) return null;
      return dimensions.map(dim => {
        const mean = clusterData.reduce((sum, d) => sum + d[dim], 0) / clusterData.length;
        return mean;
      });
    });
    
    // 标准化数据
    const allValues = clusteredData.flatMap(d => dimensions.map(dim => d[dim]));
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    
    const normalizedMeans = clusterMeans.map(means => 
      means === null ? null : means.map(val => maxVal === minVal ? 0.5 : (val - minVal) / (maxVal - minVal))
    );
    
    const angleSlice = Math.PI * 2 / dimensions.length;
    
    // 网格
    const levels = 5;
    for (let level = 1; level <= levels; level++) {
      const levelRadius = radius * level / levels;
      g.append("circle").attr("r", levelRadius)
        .style("fill", "none").style("stroke", "#ddd").style("stroke-width", 0.5);
    }
    
    // 轴线和标签
    dimensions.forEach((dim, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      g.append("line")
        .attr("x1", 0).attr("y1", 0).attr("x2", x).attr("y2", y)
        .style("stroke", "#ddd").style("stroke-width", 0.5);
      
      g.append("text")
        .attr("x", x * 1.15).attr("y", y * 1.15)
        .text(labels[i])
        .style("text-anchor", "middle").style("font-size", "10px")
        .style("font-family", "'Noto Serif SC', serif").style("fill", "#4A4A4A");
    });
    
    const colorScale = d3.scaleOrdinal().domain([0, 1]).range(['#D4A574', '#A5A8AD']);
    
    // 雷达图
    normalizedMeans.forEach((means, cluster) => {
      if (means === null) return;
      
      const pathData = means.map((val, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        const x = Math.cos(angle) * (val * radius);
        const y = Math.sin(angle) * (val * radius);
        return [x, y];
      });
      
      pathData.push(pathData[0]);
      
      const line = d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveLinearClosed);
      
      g.append("path")
        .datum(pathData).attr("d", line)
        .style("fill", colorScale(cluster)).style("fill-opacity", 0.3)
        .style("stroke", colorScale(cluster)).style("stroke-width", 2);
      
      pathData.slice(0, -1).forEach(point => {
        g.append("circle")
          .attr("cx", point[0]).attr("cy", point[1]).attr("r", 3)
          .style("fill", colorScale(cluster));
      });
    });
    
    // 图例
    const legend = svg.append("g").attr("transform", `translate(${width/2 - 60}, ${height - 50})`);
    
    [0, 1].forEach((cluster, i) => {
      const hasData = normalizedMeans[cluster] !== null;
      const legendItem = legend.append("g").attr("transform", `translate(${i * 80}, 0)`);
      
      legendItem.append("rect")
        .attr("width", 10).attr("height", 10)
        .style("fill", colorScale(cluster))
        .style("opacity", hasData ? 1 : 0.3);
      
      legendItem.append("text")
        .attr("x", 15).attr("y", 8)
        .text(`聚类 ${cluster + 1}`)
        .style("font-size", "9px")
        .style("font-family", "'Noto Serif SC', serif")
        .style("fill", "#4A4A4A")
        .style("opacity", hasData ? 1 : 0.6);
      
      if (!hasData) {
        legendItem.append("text")
          .attr("x", 15).attr("y", 18)
          .text("(无数据)")
          .style("font-size", "7px")
          .style("font-family", "'Noto Serif SC', serif")
          .style("fill", "#4A4A4A")
          .style("opacity", 0.5);
      }
    });
    
  }, [clusteredData]);

  // 相关性热图
  useEffect(() => {
    if (!correlationMatrix.length || !heatmapRef.current) return;
    
    const svg = d3.select(heatmapRef.current);
    svg.selectAll("*").remove();
    
    svg.attr('viewBox', '0 0 280 320').attr('preserveAspectRatio', 'xMidYMid meet');
    
    const margin = { top: 60, right: 30, bottom: 30, left: 90 };
    const width = 280 - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;
    
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    
    const labels = ['事件规模', '人口变化', '经济文化影响'];
    const fields = ['scale', 'population_change', 'economic_cultural_impact'];
    
    const cellSize = width / 3;
    
    const colorScale = d3.scaleSequential()
      .domain([1, -1])
      .interpolator(t => {
        const corrValue = 1 - 2 * t;
        if (corrValue < 0) {
          const intensity = Math.abs(corrValue);
          return d3.interpolateRgb('#BF9D7E', '#8C6D46')(intensity);
        } else {
          const intensity = corrValue;
          return d3.interpolateRgb('#DCD1BB', '#9E2B25')(intensity);
        }
      });
    
    // 热图格子
    correlationMatrix.forEach(d => {
      const i = fields.indexOf(d.y);
      const j = fields.indexOf(d.x);
      
      g.append("rect")
        .attr("x", j * cellSize).attr("y", i * cellSize)
        .attr("width", cellSize).attr("height", cellSize)
        .style("fill", colorScale(d.value))
        .style("stroke", "white").style("stroke-width", 1);
      
      g.append("text")
        .attr("x", j * cellSize + cellSize / 2)
        .attr("y", i * cellSize + cellSize / 2)
        .text(d.value.toFixed(2))
        .style("text-anchor", "middle").style("dominant-baseline", "middle")
        .style("font-size", "10px").style("font-weight", "bold")
        .style("fill", Math.abs(d.value) > 0.5 ? "white" : "black");
    });
    
    // 标签
    labels.forEach((label, i) => {
      g.append("text")
        .attr("x", -5).attr("y", i * cellSize + cellSize / 2)
        .text(label)
        .style("text-anchor", "end").style("dominant-baseline", "middle")
        .style("font-size", "9px")
        .style("font-family", "'Noto Serif SC', serif")
        .style("fill", "#4A4A4A");
      
      g.append("text")
        .attr("x", i * cellSize + cellSize / 2).attr("y", -5)
        .text(label)
        .style("text-anchor", "middle").style("font-size", "9px")
        .style("font-family", "'Noto Serif SC', serif")
        .style("fill", "#4A4A4A");
    });
    
    // 颜色条
    const legendWidth = 120;
    const legendHeight = 10;
    const legendG = svg.append("g")
      .attr("transform", `translate(${(280 - legendWidth) / 2 + 30}, ${height + margin.top})`);
    
    const legendScale = d3.scaleLinear().domain([-1, 1]).range([0, legendWidth]);
    const legendAxis = d3.axisBottom(legendScale).ticks(3).tickFormat(d3.format(".1f"));
    
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "heatmap-gradient")
      .attr("x1", "0%").attr("x2", "100%");
    
    gradient.selectAll("stop")
      .data(d3.range(-1, 1.1, 0.2))
      .enter().append("stop")
      .attr("offset", d => ((d + 1) / 2) * 100 + "%")
      .style("stop-color", d => {
        if (d < 0) {
          const intensity = Math.abs(d);
          return d3.interpolateRgb('#BF9D7E', '#8C6D46')(intensity);
        } else {
          const intensity = d;
          return d3.interpolateRgb('#DCD1BB', '#9E2B25')(intensity);
        }
      });
    
    legendG.append("rect")
      .attr("width", legendWidth).attr("height", legendHeight)
      .style("fill", "url(#heatmap-gradient)");
    
    legendG.append("g")
      .attr("transform", `translate(0, ${legendHeight})`)
      .call(legendAxis)
      .selectAll("text")
      .style("font-family", "'Noto Serif SC', serif")
      .style("font-size", "8px").style("fill", "#4A4A4A");
    
    legendG.append("text")
      .attr("x", legendWidth / 2).attr("y", -3)
      .text("相关性系数")
      .style("text-anchor", "middle").style("font-size", "9px")
      .style("font-family", "'Noto Serif SC', serif")
      .style("fill", "#4A4A4A");
    
  }, [correlationMatrix]);

  const getSelectionText = () => {
    if (selectedDynasties.includes('overview')) {
      return '全局总览';
    } else if (selectedDynasties.length === 1) {
      return selectedDynasties[0];
    } else {
      return `${selectedDynasties.length}个朝代`;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* 控制面板 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '10px',
        padding: '0 5px'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#8C6D46' }}>
          历史数据聚类与相关性分析
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#4A4A4A' }}>数据类型:</span>
          <select
            value={selectedDataType}
            onChange={(e) => setSelectedDataType(e.target.value)}
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              border: '1px solid #DCD1BB',
              borderRadius: '3px',
              backgroundColor: '#F5F1E4',
              color: '#4A4A4A',
              fontFamily: "'Noto Serif SC', serif"
            }}
          >
            <option value="reform">制度改革</option>
            <option value="disaster">灾变</option>
          </select>
        </div>
      </div>

      {/* 状态信息 */}
      <div style={{ 
        fontSize: '10px', 
        color: '#4A4A4A', 
        marginBottom: '8px',
        textAlign: 'center'
      }}>
        当前: {selectedDataType === 'reform' ? '制度改革' : '灾变'} - {getSelectionText()} 
        ({clusteredData.length}个数据点)
      </div>

      {/* 图表区域 */}
      {clusteredData.length > 0 ? (
        <div style={{ 
          display: 'flex', 
          flex: 1, 
          gap: '8px',
          height: 'calc(100% - 60px)' 
        }}>
          <div style={{ 
            flex: 1, 
            border: '1px solid #DCD1BB', 
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.5)'
          }}>
            <svg ref={pcaRef} width="100%" height="100%" />
          </div>
          
          <div style={{ 
            flex: 1, 
            border: '1px solid #DCD1BB', 
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.5)'
          }}>
            <svg ref={parallelRef} width="100%" height="100%" />
          </div>
          
          <div style={{ 
            flex: 1, 
            border: '1px solid #DCD1BB', 
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.5)'
          }}>
            <svg ref={radarRef} width="100%" height="100%" />
          </div>
          
          <div style={{ 
            flex: 1, 
            border: '1px solid #DCD1BB', 
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.5)'
          }}>
            <svg ref={heatmapRef} width="100%" height="100%" />
          </div>
        </div>
      ) : (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#777',
          fontSize: '12px'
        }}>
          当前选择没有可显示的数据
        </div>
      )}
    </div>
  );
};

export default HistoricalDataClusterAnalysis;