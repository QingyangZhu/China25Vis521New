import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './TimeControl.css';
import useDynastyStore, { dynastyNameMapping } from '../../store/dynastyStore';

const TimeControl = ({ onDynastyClick, onOpenWordCloud }) => {
    const svgRef = useRef(null);
    const contentAreaRef = useRef(null);
    const leftLabelsRef = useRef(null);
    const containerRef = useRef(null);
    const chart9Ref = useRef(null);
    const { selectedDynasties, toggleDynasty } = useDynastyStore();
    
    // 添加状态来存储新的数据源
    const [radarDataSources, setRadarDataSources] = useState({
        merceData: [], // 经济数据
        populationData: [], // 人口数据
        productData: [], // 物产资源数据
        trafficData: [] // 交通发展数据
    });

    // 加载新的数据源
    useEffect(() => {
        const loadRadarDataSources = async () => {
            try {
                const [merceData, populationData, productData, trafficData] = await Promise.all([
                    d3.csv('/data/merce-pj.csv'),
                    d3.csv('/data/problem3/人口数量统计.csv'),
                    d3.csv('/data/problem3/物产数据_按朝代排序.csv'),
                    d3.csv('/data/problem3/交通数据综合分析/analysis_csv_outputs/朝代发展水平等级分布_20250604_213238.csv')
                ]);
                
                setRadarDataSources({
                    merceData,
                    populationData,
                    productData,
                    trafficData
                });
            } catch (error) {
                console.error('加载雷达图数据源失败:', error);
            }
        };
        
        loadRadarDataSources();
    }, []);

    // 朝代名称映射函数
    const mapDynastyName = (dynastyName) => {
        const mapping = {
            '上古时代': '上古',
            '远古时代': '远古',
            '西楚': '楚',
            '三国': '魏晋',
            '五胡十六国': '十六国',
            '南北朝': '北朝',
            '五代十国': '五代',
            '民国': '近代-民国',
            '中国': '现代'
        };
        return mapping[dynastyName] || dynastyName;
    };

    // 智能匹配朝代名称（用于处理数据源中的变体）
    const findMatchingDynasty = (targetDynasty, dataSourceDynasties) => {
        const mapped = mapDynastyName(targetDynasty);
        
        // 精确匹配
        let match = dataSourceDynasties.find(d => d === mapped);
        if (match) return match;
        
        // 部分匹配
        match = dataSourceDynasties.find(d => d.includes(mapped) || mapped.includes(d));
        if (match) return match;
        
        // 特殊情况处理
        const specialMappings = {
            '夏': ['夏商', '夏商时期'],
            '商': ['夏商', '夏商时期', '商'],
            '周': ['西周', '东周', '先秦-西周'],
            '秦': ['先秦-战国', '秦'],
            '汉': ['汉-西汉', '汉-东汉'],
            '晋': ['西晋', '魏晋'],
            '唐': ['唐'],
            '宋': ['宋-北宋', '宋-南宋'],
            '元': ['元'],
            '明': ['明'],
            '清': ['清'],
        };
        
        const alternatives = specialMappings[mapped];
        if (alternatives) {
            match = dataSourceDynasties.find(d => alternatives.some(alt => d.includes(alt) || alt.includes(d)));
            if (match) return match;
        }
        
        return null;
    };

    // 处理朝代数据，计算六维雷达图数据
    const calculateRadarData = (dynastyName) => {
        if (!radarDataSources.merceData.length) {
            // 数据还未加载完成，返回默认值
            return {
                political: 0,
                military: 0,
                economy: 0,
                population: 0,
                resource: 0,
                traffic: 0
            };
        }

        const mappedName = mapDynastyName(dynastyName);
        
        // 1. 政治和军事数据（保持原有逻辑）
        const csvDataItem = csvData.find(item => item['历史时期'] === dynastyName);
        const political = csvDataItem ? +csvDataItem['政治'] : 0;
        const military = csvDataItem ? +csvDataItem['军事'] * 10 : 0;
        
        // 2. 经济数据（从merce-pj.csv获取）
        const merceItemDynasties = radarDataSources.merceData.map(item => item['朝代']);
        const matchedMerceDynasty = findMatchingDynasty(dynastyName, merceItemDynasties);
        const merceItem = matchedMerceDynasty ? 
            radarDataSources.merceData.find(item => item['朝代'] === matchedMerceDynasty) : null;
        const economy = merceItem ? +merceItem['综合评分'] * 20 : 0; // 调整比例
        
        // 3. 人口数据（使用硬编码数据，与您提供的人口等级一致）
        const population = csvDataItem ? +csvDataItem['人口'] * 20 : 0; // 将2-5的范围缩放到40-100
        
        // 4. 物产资源数据（从物产数据计算种类数量）
        const productDynasties = [...new Set(radarDataSources.productData.map(item => item.dynasty))];
        const matchedProductDynasty = findMatchingDynasty(dynastyName, productDynasties);
        const productItems = matchedProductDynasty ? 
            radarDataSources.productData.filter(item => item.dynasty === matchedProductDynasty) :
            radarDataSources.productData.filter(item => {
                return item.dynasty.includes(mappedName) || mappedName.includes(item.dynasty);
            });
            
        const uniqueCategories = new Set();
        productItems.forEach(item => {
            if (item.product_category) {
                // 解析产品分类，可能有多个分类用括号分隔
                const categories = item.product_category.match(/（([^）]+)）/g);
                if (categories) {
                    categories.forEach(cat => {
                        const cleanCat = cat.replace(/[（）]/g, '');
                        uniqueCategories.add(cleanCat);
                    });
                }
            }
        });
        const resource = Math.min(uniqueCategories.size * 8, 100); // 每种类型8分，最高100分
        
        // 5. 交通发展数据（从交通数据获取）
        const trafficDynasties = radarDataSources.trafficData.map(item => item['朝代']);
        const matchedTrafficDynasty = findMatchingDynasty(dynastyName, trafficDynasties);
        const trafficItem = matchedTrafficDynasty ? 
            radarDataSources.trafficData.find(item => item['朝代'] === matchedTrafficDynasty) : null;
        const traffic = trafficItem ? +trafficItem['综合得分'] : 0;
        
        return {
            political,
            military,
            economy,
            population,
            resource,
            traffic
        };
    };

    // 定义朝代数据
    const dynastyData = [
        { name: "上古时代", period: "人类文明出现到三皇五帝时期", startPos: 0, duration: 15, start: -3000, end: -2400 },
        { name: "远古时代", period: "三皇五帝到夏商周以前", startPos: 15, duration: 8, start: -2400, end: -2070 },
        { name: "夏", period: "约公元前2070-公元前1600年", startPos: 23, duration: 7, start: -2070, end: -1600 },
        { name: "商", period: "约公元前1600-公元前1046年", startPos: 30, duration: 10, start: -1600, end: -1046 },
        {
            name: "周", startPos: 40, duration: 25, start: -1046, end: -256,
            subDynasties: [
                { name: "西周", period: "约公元前1046-公元前771年",  startPos: 40, duration: 12.5, start: -1046, end: -771 },
                { name: "春秋", period: "公元前770年-公元前476年", startPos: 52.5, duration: 6.7, start: -770, end: -476 },
                { name: "战国", period: "公元前475年-公元前221年", startPos: 60.2, duration: 7.8, start: -475, end: -221 }
            ]
        },
        { name: "秦", period: "公元前221年-公元前207年", startPos: 68, duration: 2, start: -221, end: -207 },
        { name: "西楚", period: "公元前206年-公元前202年", startPos: 70, duration: 1, start: -206, end: -202 },
        {
            name: "汉", startPos: 71, duration: 25, start: -202, end: 220,
            subDynasties: [
                { name: "西汉", period: "公元前202年-公元8年", startPos: 71, duration: 6, start: -202, end: 8 },
                { name: "新朝", period: "8年-23年",  startPos: 77, duration: 4, start: 8, end: 23 },
                { name: "玄汉", period: "23年2月-25年9月",  startPos: 81, duration: 1, start: 23, end: 25 },
                { name: "东汉", period: "25年-220年",  startPos: 82, duration: 14, start: 25, end: 220 }
            ]
        },
        {
            name: "三国", startPos: 96, duration: 8, start: 220, end: 280,
            subDynasties: [
                { name: "曹魏", period: "220年-265年",  startPos: 96, duration: 4, start: 220, end: 265 },
            ]
        },
        {
            name: "晋", startPos: 104, duration: 12, start: 265, end: 420,
            subDynasties: [
                { name: "西晋", period: "265年-316年", startPos: 104, duration: 6, start: 265, end: 316 },
                { name: "东晋", period: "317年-420年", startPos: 110, duration: 6, start: 317, end: 420 }
            ]
        },
        {
            name: "五胡十六国", period: "304年439年", startPos: 116, duration: 14, start: 304, end: 439,
            subDynasties: [
                { name: "前赵", period: "304年-329年", startPos: 116, duration: 3, start: 304, end: 329 },
                { name: "后赵", period: "319年-351年", startPos: 119, duration: 3, start: 319, end: 351 },
                { name: "前燕", period: "337年-370年", startPos: 122, duration: 3, start: 337, end: 370 },
                { name: "后燕", period: "384年-407年", startPos: 125, duration: 3, start: 384, end: 407 },
            ]
        },
        {
            name: "南北朝", startPos: 130, duration: 18, start: 386, end: 589,
            subDynasties: [
                {
                    name: "北朝", subDynasties: [
                        { name: "北魏", period: "386年-534年",  startPos: 144, duration: 4, start: 386, end: 534 },
                        { name: "东魏", period: "534年-550年",  startPos: 148, duration: 2, start: 534, end: 550 },
                        { name: "北齐", period: "550年-577年",  startPos: 150, duration: 2, start: 550, end: 577 },
                        { name: "西魏", period: "535年-556年",  startPos: 152, duration: 2, start: 535, end: 556 },
                        { name: "北周", period: "557年-581年",  startPos: 154, duration: 2, start: 557, end: 581 }
                    ]
                }
            ]
        },
        { name: "隋", period: "581年-618年", startPos: 148, duration: 4, start: 581, end: 618 },
        { name: "唐", period: "618年-907年", startPos: 152, duration: 29, start: 618, end: 907 },
        {
            name: "五代十国", startPos: 181, duration: 13, start: 907, end: 960,
        },
        {
            name: "宋", startPos: 194, duration: 32, start: 960, end: 1279,
            subDynasties: [
                { name: "北宋", period: "960年-1127年",  startPos: 194, duration: 16, start: 960, end: 1127 },
                { name: "南宋", period: "1127年-1279年",  startPos: 210, duration: 16, start: 1127, end: 1279 }
            ]
        },
        { name: "辽", period: "907年-1125年", startPos: 196, duration: 13, start: 907, end: 1125 },
        { name: "金", period: "1115年-1234年", startPos: 220, duration: 12, start: 1115, end: 1234 },
        { name: "元", period: "1206年-1368年", startPos: 232, duration: 20, start: 1206, end: 1368 },
        { name: "明", period: "1368年-1644年", startPos: 252, duration: 28, start: 1368, end: 1644 },
        { name: "清", period: "1616年-1911年", startPos: 280, duration: 30, start: 1616, end: 1911 },
        { name: "民国", period: "1912年-1949年", startPos: 310, duration: 4, start: 1912, end: 1949 },
        { name: "中国", period: "1949年-", startPos: 314, duration: 5, start: 1949, end: new Date().getFullYear() }
    ];

    // 定义时间标记数据
    const timeMarkers = [
        { year: -750, abstractPos: 46, isMajor: true },
        { year: -500, abstractPos: 56, isMajor: true },
        { year: -250, abstractPos: 66 },
        { year: 0, abstractPos: 71.5, isMajor: true },
        { year: 250, abstractPos: 100 },
        { year: 500, abstractPos: 142, isMajor: true },
        { year: 750, abstractPos: 168 },
        { year: 1000, abstractPos: 195, isMajor: true },
        { year: 1250, abstractPos: 230 },
        { year: 1500, abstractPos: 260, isMajor: true },
        { year: 1750, abstractPos: 295 },
        { year: 1900, abstractPos: 309 },
        { year: 1949, abstractPos: 314 },
    ];

    // 定义发展程度数据
    const csvData = [
        { "历史时期": "上古时代", "政治": 21, "军事": 1.3, "资源": 2.9, "交通": 1.0, "人口": 2, "发展程度": 18 },
        { "历史时期": "远古时代", "政治": 31, "军事": 1.5, "资源": 2.9, "交通": 1.0, "人口": 3, "发展程度": 29 },
        { "历史时期": "夏", "政治": 41, "军事": 1.8, "资源": 3.3, "交通": 1.0, "人口": 2, "发展程度": 23 },
        { "历史时期": "商", "政治": 53, "军事": 4.0, "资源": 3.3, "交通": 1.5, "人口": 3, "发展程度": 50 },
        { "历史时期": "周", "政治": 71, "军事": 6.5, "资源": 3.6, "交通": 1.5, "人口": 3, "发展程度": 51 },
        { "历史时期": "秦", "政治": 70, "军事": 8.5, "资源": 3.4, "交通": 1.7, "人口": 3, "发展程度": 68 },
        { "历史时期": "西楚", "政治": 38, "军事": 7.0, "资源": 3.4, "交通": 1.7, "人口": 2, "发展程度": 39 },
        { "历史时期": "汉", "政治": 78, "军事": 8.0, "资源": 3.4, "交通": 1.0, "人口": 4, "发展程度": 63 },
        { "历史时期": "三国", "政治": 32, "军事": 7.5, "资源": 3.6, "交通": 1.0, "人口": 2, "发展程度": 32 },
        { "历史时期": "晋", "政治": 47, "军事": 4.0, "资源": 3.4, "交通": 1.0, "人口": 2, "发展程度": 36 },
        { "历史时期": "五胡十六国", "政治": 18, "军事": 3.5, "资源": 3.5, "交通": 1.0, "人口": 2, "发展程度": 14 },
        { "历史时期": "南北朝", "政治": 46, "军事": 5.0, "资源": 3.5, "交通": 1.0, "人口": 3, "发展程度": 39 },
        { "历史时期": "隋", "政治": 63, "军事": 6.5, "资源": 3.7, "交通": 1.0, "人口": 4, "发展程度": 65 },
        { "历史时期": "唐", "政治": 84, "军事": 9.0, "资源": 3.7, "交通": 1.0, "人口": 4, "发展程度": 85 },
        { "历史时期": "五代十国", "政治": 28, "军事": 3.0, "资源": 3.7, "交通": 1.0, "人口": 2, "发展程度": 24 },
        { "历史时期": "宋", "政治": 63, "军事": 5.5, "资源": 3.7, "交通": 1.0, "人口": 3, "发展程度": 57 },
        { "历史时期": "辽", "政治": 66, "军事": 7.0, "资源": 4.0, "交通": 1.0, "人口": 4, "发展程度": 71 },
        { "历史时期": "金", "政治": 86, "军事": 7.5, "资源": 3.6, "交通": 1.5, "人口": 4, "发展程度": 72 },
        { "历史时期": "元", "政治": 88, "军事": 9.5, "资源": 3.7, "交通": 1.6, "人口": 5, "发展程度": 94 },
        { "历史时期": "明", "政治": 95, "军事": 6.0, "资源": 3.6, "交通": 1.0, "人口": 4, "发展程度": 70 },
        { "历史时期": "清", "政治": 98, "军事": 7, "资源": 3.6, "交通": 1.3, "人口": 4, "发展程度": 78 },
        { "历史时期": "民国", "政治": 63, "军事": 4.5, "资源": 3.3, "交通": 1.3, "人口": 5, "发展程度": 83 },
        { "历史时期": "中国", "政治": 100, "军事": 10.0, "资源": 4.1, "交通": 2.6, "人口": 5, "发展程度": 100 }
    ];

    useEffect(() => {
        const svg = d3.select(svgRef.current);
        const contentArea = contentAreaRef.current;
        const leftLabels = leftLabelsRef.current;
        const container = containerRef.current;

        if (!contentArea || !svg.node()) {
            console.error("Content area or SVG container not found.");
            return;
        }

        const svgWidth = contentArea.clientWidth;
        const svgHeight = parseInt(svg.style('height'));

        const lastDynasty = dynastyData[dynastyData.length - 1];
        const totalAbstractWidth = lastDynasty.startPos + lastDynasty.duration;

        const xScale = d3.scaleLinear()
            .domain([0, totalAbstractWidth])
            .range([0, svgWidth]);

        const yScaleBars = d3.scaleLinear()
            .domain([0, d3.max(csvData, d => +d['发展程度']) || 0])
            .range([0, svgHeight * 0.3]);

        const timeScaleLineY = svgHeight * 0.3;
        const timeMarkerHeight = 6;
        const majorTimeMarkerHeight = 9;
        const yearLabelOffset = 15;

        const dynastyBarAreaY = svgHeight * 0.65;
        const dynastyBarAreaHeight = svgHeight * 0.4;

        // Draw Time Scale
        svg.append("line")
            .attr("class", "time-scale-line")
            .attr("x1", 0)
            .attr("y1", timeScaleLineY)
            .attr("x2", svgWidth)
            .attr("y2", timeScaleLineY);

        svg.selectAll("line.time-marker")
            .data(timeMarkers)
            .enter()
            .append("line")
            .attr("class", d => `time-marker${d.isMajor ? ' major' : ''}`)
            .attr("x1", d => xScale(d.abstractPos))
            .attr("y1", timeScaleLineY - 3)
            .attr("x2", d => xScale(d.abstractPos))
            .attr("y2", timeScaleLineY);

        svg.selectAll("text.year-label")
            .data(timeMarkers)
            .enter()
            .append("text")
            .attr("class", "year-label")
            .attr("x", d => xScale(d.abstractPos))
            .attr("y", timeScaleLineY + yearLabelOffset)
            .text(d => d.year === 0 ? '0' : (d.year < 0 ? `${-d.year}` : `${d.year}`));

        // Process dynasty data with sub-dynasties
        const layeredDynastyData = [];
        const layers = [];

        function processSubDynasties(dynasty, parentStartPos, parentDuration) {
            if (!dynasty.subDynasties) return [];

            const subDynasties = [];
            let currentPos = parentStartPos;
            const subDuration = parentDuration / dynasty.subDynasties.length;

            dynasty.subDynasties.forEach(subDynasty => {
                subDynasties.push({
                    name: subDynasty.name,
                    startPos: currentPos,
                    duration: subDuration,
                    endPos: currentPos + subDuration,
                    isSubDynasty: true,
                    parentName: dynasty.name
                });
                currentPos += subDuration;
            });

            return subDynasties;
        }

        dynastyData.forEach(dynasty => {
            const startAbstract = dynasty.startPos;
            const durationAbstract = dynasty.duration;
            const endAbstract = startAbstract + durationAbstract;

            const minAbstractDuration = 0.5;
            const adjustedEndAbstract = startAbstract + Math.max(durationAbstract, minAbstractDuration);

            let assignedLayer = 0;
            let placed = false;

            while(!placed) {
                if (!layers[assignedLayer]) {
                    layers[assignedLayer] = [{ start: startAbstract, end: adjustedEndAbstract }];
                    placed = true;
                } else {
                    let overlaps = false;
                    const buffer = 0.1;
                    for (const existing of layers[assignedLayer]) {
                        if (startAbstract < existing.end - buffer && adjustedEndAbstract > existing.start + buffer) {
                            overlaps = true;
                            break;
                        }
                    }
                    if (!overlaps) {
                        layers[assignedLayer].push({ start: startAbstract, end: adjustedEndAbstract });
                        placed = true;
                    } else {
                        assignedLayer++;
                    }
                }
            }

            layeredDynastyData.push({
                ...dynasty,
                layer: assignedLayer,
                endPos: endAbstract,
                isSubDynasty: false
            });

            if (dynasty.subDynasties) {
                const subDynasties = processSubDynasties(dynasty, startAbstract, durationAbstract);
                layeredDynastyData.push(...subDynasties.map(sub => ({
                    ...sub,
                    layer: assignedLayer
                })));
            }
        });

        const maxLayers = layers.length > 0 ? layers.length : 1;
        const dynastyItemHeight = dynastyBarAreaHeight / maxLayers;

        // Draw main dynasty borders
        svg.selectAll("line.dynasty-border-left")
            .data(layeredDynastyData.filter(d => !d.isSubDynasty))
            .enter()
            .append("line")
            .attr("class", "dynasty-border-left")
            .attr("x1", d => xScale(d.startPos))
            .attr("y1", d => dynastyBarAreaY + d.layer * dynastyItemHeight)
            .attr("x2", d => xScale(d.startPos))
            .attr("y2", d => dynastyBarAreaY + d.layer * dynastyItemHeight + dynastyItemHeight);

        svg.selectAll("line.dynasty-border-right")
            .data(layeredDynastyData.filter(d => !d.isSubDynasty))
            .enter()
            .append("line")
            .attr("class", "dynasty-border-right")
            .attr("x1", d => xScale(d.endPos))
            .attr("y1", d => dynastyBarAreaY + d.layer * dynastyItemHeight)
            .attr("x2", d => xScale(d.endPos))
            .attr("y2", d => dynastyBarAreaY + d.layer * dynastyItemHeight + dynastyItemHeight);

        // Draw sub-dynasty separators
        svg.selectAll("line.sub-dynasty-separator")
            .data(layeredDynastyData.filter(d => d.isSubDynasty))
            .enter()
            .append("line")
            .attr("class", "sub-dynasty-separator")
            .attr("x1", d => xScale(d.startPos))
            .attr("y1", d => dynastyBarAreaY + d.layer * dynastyItemHeight + dynastyItemHeight / 2 - 12)
            .attr("x2", d => xScale(d.startPos))
            .attr("y2", d => dynastyBarAreaY + d.layer * dynastyItemHeight + dynastyItemHeight / 2 - 5);

        // Draw dynasty names
        svg.selectAll("text.dynasty-text")
            .data(layeredDynastyData)
            .enter()
            .append("text")
            .attr("class", d => `dynasty-text ${d.isSubDynasty ? 'sub-dynasty-text' : ''}`)
            .attr("x", d => {
                const startPx = xScale(d.startPos);
                const endPx = xScale(d.endPos);
                const widthPx = Math.max(endPx - startPx, 5);
                return startPx + widthPx / 2;
            })
            .attr("y", d => {
                const baseY = dynastyBarAreaY + d.layer * dynastyItemHeight + dynastyItemHeight / 2;
                return d.isSubDynasty ? baseY - 8 : baseY;
            })
            .text(d => d.name)
            .style("font-size", d => d.isSubDynasty ? "9px" : "10px")
            .style("fill", d => d.isSubDynasty ? "#8a7c6c" : "#6e543c")
            .style("font-family", "KaiTi, 楷体, serif")
            .style("font-weight", d => {
            const mappedName = dynastyNameMapping[d.name] || d.name;
            return selectedDynasties.includes(mappedName) ? "900" : "normal";
        })
            .style("cursor", "pointer")
            .attr("title", d => {
                const availableDynasties = ['元', '明', '清'];
                const hasWordCloud = availableDynasties.includes(d.name);
                return hasWordCloud ? 
                    "单击选择朝代并查看词云，右键也可查看词云" : 
                    "单击选择朝代（该朝代暂无词云数据）";
            })
            .on("click", function(event, d) {
                const targetDynasty = d;
                if (targetDynasty) {
                    // 映射时间轴朝代名称到交通枢纽分析朝代名称
                    const mappedDynastyName = dynastyNameMapping[targetDynasty.name] || targetDynasty.name;
                    
                    // 使用 store 的 toggleDynasty 方法 - 使用映射后的名称
                    toggleDynasty(mappedDynastyName);

                    // 更新字体样式 - 这里仍使用原始名称比较显示状态
                    svg.selectAll(".dynasty-text")
                        .style("font-weight", d => {
                            const mappedName = dynastyNameMapping[d.name] || d.name;
                            return selectedDynasties.includes(mappedName) ? "900" : "normal";
                        });

                    // 检查是否有该朝代的词云数据，如果有则自动显示词云，否则通过回调关闭词云
                    const availableDynasties = ['元', '明', '清'];
                    
                    // 使用延迟调用避免状态冲突
                    setTimeout(() => {
                        if (availableDynasties.includes(targetDynasty.name) && onOpenWordCloud) {
                            console.log('选择有词云数据的朝代，自动显示词云:', targetDynasty.name);
                            onOpenWordCloud(targetDynasty.name);
                        } else if (onOpenWordCloud) {
                            // 选择了没有词云数据的朝代，通过传递null来关闭词云
                            console.log('选择了没有词云数据的朝代，关闭词云:', targetDynasty.name);
                            onOpenWordCloud(null);
                        }
                    }, 100);

                    // 调用处理函数 - 单选模式，传递当前选中的朝代信息
                    if (onDynastyClick) {
                        // 使用setTimeout确保状态已更新
                        setTimeout(() => {
                            const { selectedDynasties: updatedSelection } = useDynastyStore.getState();
                            if (updatedSelection.includes('overview')) {
                                // 如果是overview状态，传递元朝时间范围作为默认
                                onDynastyClick(updatedSelection, 1206, 1368);
                            } else {
                                // 如果选中了具体朝代，传递该朝代的时间范围
                                onDynastyClick(updatedSelection, targetDynasty.start, targetDynasty.end);
                            }
                        }, 150);
                    }
                }
            })
            .on("contextmenu", function(event, d) {
                // 阻止默认的右键菜单
                event.preventDefault();
                
                const targetDynasty = d;
                if (targetDynasty && onOpenWordCloud) {
                    // 检查是否有该朝代的词云数据
                    const availableDynasties = ['元', '明', '清'];
                    if (availableDynasties.includes(targetDynasty.name)) {
                        console.log('右键点击朝代，显示词云:', targetDynasty.name);
                        onOpenWordCloud(targetDynasty.name);
                    } else {
                        console.log('该朝代没有词云数据:', targetDynasty.name);
                        // 创建临时提示元素
                        const tooltip = d3.select("body").append("div")
                            .style("position", "absolute")
                            .style("background", "rgba(0,0,0,0.8)")
                            .style("color", "white")
                            .style("padding", "10px")
                            .style("border-radius", "5px")
                            .style("font-size", "12px")
                            .style("z-index", "9999")
                            .style("pointer-events", "none")
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY + 10) + "px")
                            .text(`暂无${targetDynasty.name}朝代的词云数据。当前仅提供元朝、明朝和清朝的人口主题词云数据。`);
                        
                        // 2秒后自动消失
                        setTimeout(() => {
                            tooltip.remove();
                        }, 2000);
                    }
                }
            });

        // Draw data bars
        const barData = csvData.map(csvItem => {
            const correspondingDynasty = dynastyData.find(dynasty => dynasty.name === csvItem['历史时期']);
            if (correspondingDynasty) {
                // 计算六维雷达图数据
                const radarScores = calculateRadarData(csvItem['历史时期']);
                
                return {
                    startPos: correspondingDynasty.startPos,
                    duration: correspondingDynasty.duration,
                    development: +csvItem['发展程度'],
                    period: csvItem['历史时期'],
                    scores: radarScores
                };
            }
            return null;
        }).filter(item => item !== null);

        // 创建tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "white")
            .style("border", "1px solid #ddd")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
            .style("font-size", "12px")
            .style("z-index", "1000")
            .style("max-height", "30px")
            .style("overflow-y", "auto");

        // 创建雷达图容器
        const radarContainer = d3.select("body").append("div")
            .attr("class", "radar-container")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "white")
            .style("border", "1px solid #ddd")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
            .style("z-index", "1000");

        // 绘制柱状图
        svg.selectAll("rect.data-bar")
            .data(barData)
            .enter()
            .append("rect")
            .attr("class", "data-bar")
            .attr("x", d => {
                const barAbstractPos = d.startPos + d.duration / 2;
                const barCenterX = xScale(barAbstractPos);
                const barWidth = 8;
                return barCenterX - barWidth / 2;
            })
            .attr("y", d => {
                const barHeight = yScaleBars(d.development);
                return timeScaleLineY - barHeight;
            })
            .attr("width", 8)
            .attr("height", d => Math.max(0, yScaleBars(d.development)))
            .on("mouseover", function(event, d) {
                // 显示tooltip - 智能定位
                const tooltipWidth = 120;
                const tooltipHeight = 50;
                
                let tooltipLeft = event.pageX + 10;
                let tooltipTop = event.pageY + 30;
                
                // 防止tooltip超出屏幕右边界
                if (tooltipLeft + tooltipWidth > window.innerWidth) {
                    tooltipLeft = event.pageX - tooltipWidth - 10;
                }
                
                // 防止tooltip超出屏幕下边界
                if (tooltipTop + tooltipHeight > window.innerHeight) {
                    tooltipTop = event.pageY - tooltipHeight - 10;
                }
                
                // 防止tooltip超出屏幕上边界
                if (tooltipTop < 0) {
                    tooltipTop = 10;
                }
                
                // 防止tooltip超出屏幕左边界
                if (tooltipLeft < 0) {
                    tooltipLeft = 10;
                }

                tooltip
                    .style("visibility", "visible")
                    .html(`
                        <div style="font-weight: bold; margin-bottom: 5px;">${d.period}</div>
                        <div>发展程度: ${d.development}</div>
                    `)
                    .style("left", tooltipLeft + "px")
                    .style("top", tooltipTop + "px");

                // 显示雷达图
                const radarWidth = 150;
                const radarHeight = 150;
                const radarRadius = Math.min(radarWidth, radarHeight) / 2 - 20;

                // 智能定位雷达图容器，避免超出屏幕边界
                const mouseX = event.pageX;
                const mouseY = event.pageY;
                const containerWidth = radarWidth + 20; // 加上padding
                const containerHeight = radarHeight + 20;
                
                let left = mouseX + 120;
                let top = mouseY - 100;
                
                // 防止右侧超出屏幕
                if (left + containerWidth > window.innerWidth) {
                    left = mouseX - containerWidth - 20;
                }
                
                // 防止底部超出屏幕
                if (top + containerHeight > window.innerHeight) {
                    top = mouseY - containerHeight - 10;
                }
                
                // 防止顶部超出屏幕
                if (top < 0) {
                    top = mouseY + 10;
                }
                
                // 防止左侧超出屏幕
                if (left < 0) {
                    left = 10;
                }

                radarContainer
                    .style("visibility", "visible")
                    .style("left", left + "px")
                    .style("top", top + "px")
                    .html("");

                const radarSvg = radarContainer.append("svg")
                    .attr("width", radarWidth)
                    .attr("height", radarHeight);

                const radarG = radarSvg.append("g")
                    .attr("transform", `translate(${radarWidth/2},${radarHeight/2})`);

                // 绘制雷达图背景
                const categories = ['政治', '军事', '经济', '人口', '物产资源', '交通发展'];
                const maxValue = 100;
                const angleSlice = Math.PI * 2 / categories.length;

                // 绘制网格
                for (let level = 1; level <= 5; level++) {
                    const levelRadius = radarRadius * level / 5;
                    radarG.append("circle")
                        .attr("r", levelRadius)
                        .style("fill", "none")
                        .style("stroke", "#ddd")
                        .style("stroke-width", 0.5);
                }

                // 绘制轴线和标签
                categories.forEach((category, i) => {
                    const angle = angleSlice * i - Math.PI / 2;
                    const x = Math.cos(angle) * radarRadius;
                    const y = Math.sin(angle) * radarRadius;

                    // 绘制轴线
                    radarG.append("line")
                        .attr("x1", 0)
                        .attr("y1", 0)
                        .attr("x2", x)
                        .attr("y2", y)
                        .style("stroke", "#ddd")
                        .style("stroke-width", 0.5);

                    // 添加标签
                    radarG.append("text")
                        .attr("x", x * 1.1)
                        .attr("y", y * 1.1)
                        .style("font-size", "10px")
                        .style("text-anchor", "middle")
                        .text(category);
                });

                // 绘制数据
                const data = [
                    d.scores.political,
                    d.scores.military,
                    d.scores.economy,
                    d.scores.population,
                    d.scores.resource,
                    d.scores.traffic
                ];

                const lineGenerator = d3.line()
                    .x((d, i) => Math.cos(angleSlice * i - Math.PI / 2) * (d / maxValue) * radarRadius)
                    .y((d, i) => Math.sin(angleSlice * i - Math.PI / 2) * (d / maxValue) * radarRadius)
                    .curve(d3.curveLinearClosed);

                // 绘制填充区域
                radarG.append("path")
                    .datum(data)
                    .attr("d", lineGenerator)
                    .style("fill", "rgba(152, 115, 74, 0.2)")
                    .style("stroke", "#98734a")
                    .style("stroke-width", 2);

                // 绘制数据点
                data.forEach((value, i) => {
                    const angle = angleSlice * i - Math.PI / 2;
                    const x = Math.cos(angle) * (value / maxValue) * radarRadius;
                    const y = Math.sin(angle) * (value / maxValue) * radarRadius;

                    radarG.append("circle")
                        .attr("cx", x)
                        .attr("cy", y)
                        .attr("r", 3)
                        .style("fill", "#98734a");
                });
            })
            .on("mouseout", function() {
                tooltip.style("visibility", "hidden");
                radarContainer.style("visibility", "hidden");
            });

        // Adjust left label alignment
        const timeScaleLineYInSVG = timeScaleLineY;
        const contentAreaTop = contentArea.offsetTop;
        const timeScaleLineAbsoluteTopInContainer = contentAreaTop + timeScaleLineYInSVG;

        const ceLabelItemHeight = document.querySelector('.era-label-ce').offsetHeight;
        const ceBoxTopPadding = parseInt(getComputedStyle(document.querySelector('.era-label-ce')).paddingTop || '0');

        const requiredLeftLabelsPaddingTop = timeScaleLineAbsoluteTopInContainer - (ceLabelItemHeight / 2) - ceBoxTopPadding;
        leftLabels.style.paddingTop = requiredLeftLabelsPaddingTop + 'px';

        const dynastyRowLabel = document.querySelector('.dynasty-row-label');
        const dynastyRowLabelHeight = dynastyRowLabel.offsetHeight;
        const ceLabelItemMarginBottom = parseInt(getComputedStyle(document.querySelector('.era-label-ce')).marginBottom || '0');

        const topOfDynastyBarsAreaYInSVG = dynastyBarAreaY;
        const topOfDynastyBarsAreaAbsoluteInContainer = contentAreaTop + topOfDynastyBarsAreaYInSVG;

        const leftLabelsAbsoluteTopInContainer = leftLabels.getBoundingClientRect().top - container.getBoundingClientRect().top;

        const dynastyRowLabelRequiredMarginTop = (topOfDynastyBarsAreaAbsoluteInContainer - leftLabelsAbsoluteTopInContainer) - (requiredLeftLabelsPaddingTop + ceLabelItemHeight + ceLabelItemMarginBottom);
        dynastyRowLabel.style.marginTop = dynastyRowLabelRequiredMarginTop + 'px';

        leftLabels.style.height = contentArea.offsetHeight + 'px';

        // Cleanup function
        return () => {
            svg.selectAll("*").remove();
        };
    }, [selectedDynasties, toggleDynasty, dynastyData, radarDataSources]);

    useEffect(() => {
        // Load and process CSV data
        Promise.all([
            d3.csv('/data/坐标轴_制度改革.csv'),
            d3.csv('/data/坐标轴_灾变.csv')
        ]).then(([reformData, disasterData]) => {
            const chart9 = d3.select(chart9Ref.current);
            chart9.selectAll("*").remove();

            const margin = { top: 5, right: 20, bottom: 10, left: 20 };
            const width = chart9.node().getBoundingClientRect().width - margin.left - margin.right;
            const height = chart9.node().getBoundingClientRect().height - margin.top - margin.bottom;

            const svg = chart9.append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // Combine and process data
            const allData = [...reformData, ...disasterData].map(d => ({
                year: +d.exact_year,
                scale: +d.scale,
                type: d.exact_year in reformData ? 'reform' : 'disaster'
            }));

            // Create scales
            const xScale = d3.scaleLinear()
                .domain([-2500, new Date().getFullYear() + 10])
                .range([-1500, width + 5]);

            const yScale = d3.scaleLinear()
                .domain([0, 5])
                .range([0, height + 5]);

            // Add bars
            svg.selectAll("rect")
                .data(allData)
                .enter()
                .append("rect")
                .attr("x", d => xScale(d.year))
                .attr("y", 0)
                .attr("width", 1.5)
                .attr("height", d => Math.max(0, yScale(d.scale)))
                .attr("fill", d => d.type === 'reform' ? '#A5A8AD' : '#D4A574')
                .attr("opacity", 0.8);

            // Add axes
            const xAxis = d3.axisBottom(xScale)
                .ticks(10);

            const yAxis = d3.axisLeft(yScale)
                .ticks(3);

            // Add legend
            const legend = svg.append("g")
                .attr("class", "chart-legend")
                .attr("transform", "translate(10, 5)");

            // 灾变事件图例
            legend.append("g")
                .attr("class", "legend-item")
                .append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 15)
                .attr("height", 3)
                .attr("fill", "#D4A574");

            legend.append("text")
                .attr("x", 20)
                .attr("y", 4)
                .attr("font-size", "7px")
                .attr("fill", "#4A4A4A")
                .text("灾变事件");

            // 制度改革图例
            legend.append("g")
                .attr("class", "legend-item")
                .attr("transform", "translate(50, 0)")
                .append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 15)
                .attr("height", 3)
                .attr("fill", "#A5A8AD");

            legend.append("text")
                .attr("x", 70)
                .attr("y", 4)
                .attr("font-size", "7px")
                .attr("fill", "#4A4A4A")
                .text("制度改革");

        }).catch(error => {
            console.error("Error loading CSV data:", error);
        });
    }, []);

    return (
        <div style={{width: '100%', height: '100%'}}>
            <div id='chart9' ref={chart9Ref} style={{height:'25%',width:'100%'}}></div>
            <div style={{height:'60%',width:'100%',padding:'0 2px'}}>
                <div className="timeline-container" ref={containerRef}>
                    <div className="left-labels" ref={leftLabelsRef}>
                        <div className="era-label-ce">公元</div>
                        <div className="dynasty-row-label">朝代</div>
                    </div>
                    <div className="content-area" ref={contentAreaRef}>
                        <svg ref={svgRef} className="d3-svg-container"></svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimeControl; 