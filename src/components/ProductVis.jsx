import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import './ProductVis.css';
import ProductDetailView from './ProductDetailView';

const ProductVis = ({ showDataPoints = true }) => {
  const mainRef = useRef(null);
  const tooltipRef = useRef(null);
  const svgRef = useRef(null); // 添加SVG的引用
  const [selectedDynasty, setSelectedDynasty] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [populationData, setPopulationData] = useState(null);
  const [bubbleData, setBubbleData] = useState(null);
  const [rawData, setRawData] = useState(null); // 添加原始CSV数据状态
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState(''); // 添加搜索状态
  const [showDetailView, setShowDetailView] = useState(false); // 添加下钻视图状态
  const [selectedDynastyForDetail, setSelectedDynastyForDetail] = useState(null); // 选中的朝代
  const [selectedCategoryForDetail, setSelectedCategoryForDetail] = useState(null); // 选中的物产大类
  const itemsPerPage = 5; // 每页显示5个物产

  // 使用ref来存储最新的状态值，避免handleWheel的依赖项问题
  const stateRef = useRef({
    currentPage: 0,
    searchTerm: '',
    bubbleData: null
  });

  // 添加防抖和重绘控制
  const redrawTimeoutRef = useRef(null);
  const isInitializedRef = useRef(false);

  // 更新stateRef
  useEffect(() => {
    stateRef.current = {
      currentPage,
      searchTerm,
      bubbleData
    };
  }, [currentPage, searchTerm, bubbleData]);

  // 处理花瓣点击事件
  const handlePetalClick = (dynasty, category) => {
    console.log('handlePetalClick 被调用:', dynasty, category);
    console.log('准备设置状态...');
    setSelectedDynastyForDetail(dynasty);
    setSelectedCategoryForDetail(category);
    setShowDetailView(true);
    console.log('状态设置完成 - 应该显示详情视图');
    console.log('showDetailView将被设置为:', true);
    console.log('selectedDynastyForDetail将被设置为:', dynasty);
    console.log('selectedCategoryForDetail将被设置为:', category);
  };

  // 关闭下钻视图
  const handleCloseDetailView = () => {
    setShowDetailView(false);
    setSelectedDynastyForDetail(null);
    setSelectedCategoryForDetail(null);
    
    // 延迟重新绘制主视图，确保DOM已经更新
    setTimeout(async () => {
      if (rawData && bubbleData) {
        try {
          // 清除之前的SVG引用，强制重新初始化
          svgRef.current = null;
          
          // 重新初始化SVG
          const svg = initializeSvg();
          if (svg) {
            // 重新加载和处理人口数据
            const populationCsvText = await fetch('/data/problem3/人口数量统计.csv').then(res => res.text());
            const populationRawData = d3.csvParse(populationCsvText);
            const processedPopulationData = processPopulationData(populationRawData, bubbleData);
            
            const data = d3.csvParse(rawData);
            const processedData = processData(data);
            
            // 更新人口数据状态
            setPopulationData(processedPopulationData);
            drawMainView(processedData, processedPopulationData, bubbleData);
            
            // 重新添加样式标签
            const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            style.textContent = `
              .x-axis-group .domain {
                stroke: #4A4A4A;
                stroke-width: 2px;
              }
              .x-axis-group .tick line {
                stroke: #4A4A4A;
                stroke-width: 2px;
              }
              .x-axis-group .tick text {
                font-size: 14px;
                font-weight: bold;
              }
            `;
            svg.node().appendChild(style);
          }
        } catch (error) {
          console.error('重新绘制主视图时出错：', error);
        }
      }
    }, 100);
  };

  // 处理人口数据CSV
  const processPopulationData = (rawData, bubbleData) => {
    const yearlyData = [];
    const dynastyRanges = new Map(); // 存储每个朝代的年份范围
    
    // 从人口数据CSV中提取年份和人口数据（只使用location为"北京"的数据）
    rawData.forEach(item => {
      if (item.dynasty && item.exact_year && item.location === '北京' && item.population_count && item.population_count !== '无') {
        const year = parseInt(item.exact_year);
        const population = parseInt(item.population_count);
        
        if (!isNaN(year) && !isNaN(population)) {
          yearlyData.push({
            year: year,
            dynasty: item.dynasty,
            population: population
          });
          
          // 更新朝代年份范围
          if (!dynastyRanges.has(item.dynasty)) {
            dynastyRanges.set(item.dynasty, { min: year, max: year, years: [] });
          }
          const range = dynastyRanges.get(item.dynasty);
          range.min = Math.min(range.min, year);
          range.max = Math.max(range.max, year);
          range.years.push(year);
        }
      }
    });

    // 按年份排序
    yearlyData.sort((a, b) => a.year - b.year);

    // 从bubble_data中获取所有朝代，确保覆盖所有需要的朝代
    const allDynastiesFromBubble = bubbleData ? [...new Set(bubbleData.map(d => d.dynasty))] : [];
    
    // 从人口数据中获取所有朝代
    const allDynastiesFromPopulation = [...new Set(yearlyData.map(d => d.dynasty))];
    
    // 合并所有朝代
    const mergedDynasties = [...new Set([...allDynastiesFromBubble, ...allDynastiesFromPopulation])];
    
    // 为没有年份范围的朝代设置默认年份范围
    mergedDynasties.forEach(dynasty => {
      if (!dynastyRanges.has(dynasty)) {
        // 根据朝代设置大概的年份范围
        let yearRange = { min: 0, max: 0, years: [0] };
        
        if (dynasty.includes('远古')) {
          yearRange = { min: -5000, max: -2000, years: [-3000] };
        } else if (dynasty.includes('商')) {
          yearRange = { min: -1600, max: -1046, years: [-1400] };
        } else if (dynasty.includes('先秦-西周')) {
          yearRange = { min: -1046, max: -771, years: [-900] };
        } else if (dynasty.includes('先秦-东周') || dynasty.includes('先秦-春秋')) {
          yearRange = { min: -770, max: -476, years: [-600] };
        } else if (dynasty.includes('先秦-战国')) {
          yearRange = { min: -475, max: -221, years: [-350] };
        } else if (dynasty.includes('汉-西汉')) {
          yearRange = { min: -202, max: 8, years: [-100] };
        } else if (dynasty.includes('汉-东汉')) {
          yearRange = { min: 25, max: 220, years: [100] };
        } else if (dynasty.includes('三国')) {
          yearRange = { min: 220, max: 280, years: [250] };
        } else if (dynasty.includes('西晋')) {
          yearRange = { min: 265, max: 316, years: [290] };
        } else if (dynasty.includes('十六国')) {
          yearRange = { min: 304, max: 439, years: [370] };
        } else if (dynasty.includes('北朝-北魏')) {
          yearRange = { min: 386, max: 534, years: [460] };
        } else if (dynasty.includes('北朝')) {
          yearRange = { min: 386, max: 581, years: [480] };
        } else if (dynasty.includes('唐')) {
          yearRange = { min: 618, max: 907, years: [750] };
        } else if (dynasty.includes('辽')) {
          yearRange = { min: 907, max: 1125, years: [1000] };
        } else if (dynasty.includes('金')) {
          yearRange = { min: 1115, max: 1234, years: [1180] };
        } else if (dynasty.includes('元')) {
          yearRange = { min: 1271, max: 1368, years: [1320] };
        } else if (dynasty.includes('明')) {
          yearRange = { min: 1368, max: 1644, years: [1500] };
        } else if (dynasty.includes('清')) {
          yearRange = { min: 1644, max: 1912, years: [1800] };
        } else if (dynasty.includes('近代-民国')) {
          yearRange = { min: 1912, max: 1949, years: [1930] };
        } else if (dynasty.includes('近代')) {
          yearRange = { min: 1840, max: 1949, years: [1900] };
        }
        
        dynastyRanges.set(dynasty, yearRange);
        
        // 添加默认的年度数据点
        const defaultPopulation = dynasty.includes('元') ? 500000 : 
                                 dynasty.includes('明') ? 800000 : 
                                 dynasty.includes('清') ? 700000 : 200000;
        
        yearlyData.push({
          year: yearRange.years[0],
          dynasty: dynasty,
          population: defaultPopulation
        });
      }
    });

    // 重新按年份排序
    yearlyData.sort((a, b) => a.year - b.year);

    // 计算每个朝代的中心年份（用于花瓣图定位）
    const dynastyCenters = new Map();
    dynastyRanges.forEach((range, dynasty) => {
      const centerYear = (range.min + range.max) / 2;
      dynastyCenters.set(dynasty, centerYear);
    });

    // 定义朝代顺序
    const dynastyOrder = [
      "远古", "商", "先秦-西周", "先秦-东周", "先秦-春秋", "先秦-战国", 
      "汉-西汉", "汉-东汉", "三国", "西晋", "十六国", 
      "北朝-北魏", "北朝-东魏", "北朝-西魏", "北朝-北齐", "北朝-北周",
      "隋", "唐", "五代十国", "宋-北宋", "宋-南宋", 
      "辽", "金", "元", "明", "清", "近代", "近代-民国"
    ];

    // 获取所有朝代并排序
    const allDynasties = [...dynastyRanges.keys()];
    const sortedDynasties = allDynasties.sort((a, b) => {
      const indexA = dynastyOrder.indexOf(a);
      const indexB = dynastyOrder.indexOf(b);
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    return {
      yearlyData: yearlyData,
      dynastyRanges: dynastyRanges,
      dynastyCenters: dynastyCenters,
      dynasties: sortedDynasties
    };
  };

  // 处理时间序列数据
  const processTimelineData = (rawData) => {
    const timelineMap = new Map();
    
    rawData.forEach(item => {
      if (item.exact_year && item.exact_year !== '无') {
        const year = parseInt(item.exact_year);
        if (!isNaN(year)) {
          if (!timelineMap.has(year)) {
            timelineMap.set(year, new Map());
          }
          
          // 处理物产小类
          if (item.product_subcategory) {
            const subcategories = item.product_subcategory.replace(/[（）]/g, '').split('、');
            subcategories.forEach(subcat => {
              const count = timelineMap.get(year).get(subcat) || 0;
              timelineMap.get(year).set(subcat, count + 1);
            });
          }
        }
      }
    });

    // 转换为数组格式
    return Array.from(timelineMap).map(([year, subcats]) => ({
      year,
      subcategories: Array.from(subcats).map(([name, count]) => ({
        name,
        count
      })).sort((a, b) => b.count - a.count)
    })).sort((a, b) => a.year - b.year);
  };

  // 数据处理函数
  const processData = (rawData) => {
    const dynastyGroups = {};
    
    rawData.forEach(item => {
      if (!dynastyGroups[item.dynasty]) {
        dynastyGroups[item.dynasty] = {
          dynasty: item.dynasty,
          categories: new Map(), // 使用Map存储每个大类及其小类
          products: []
        };
      }
      
      if (item.product_category) {
        // 处理物产大类和小类
        const categories = item.product_category.replace(/[（）]/g, '').split('、');
        const subcategories = item.product_subcategory ? 
          item.product_subcategory.replace(/[（）]/g, '').split('、') : [];
        
        categories.forEach((category, index) => {
          if (!dynastyGroups[item.dynasty].categories.has(category)) {
            dynastyGroups[item.dynasty].categories.set(category, new Set());
          }
          
          // 将对应的小类添加到相应的大类中
          if (subcategories[index]) {
            subcategories[index].split('、').forEach(subcat => {
              dynastyGroups[item.dynasty].categories.get(category).add(subcat);
            });
          }
        });
      }

      if (item.product_subcategory && item.location) {
        dynastyGroups[item.dynasty].products.push({
          subcategory: item.product_subcategory,
          location: item.location
        });
      }
    });

    // 转换数据结构
    return Object.values(dynastyGroups).map(group => ({
      ...group,
      categoryData: Array.from(group.categories.entries()).map(([category, subcats]) => ({
        category,
        subcategoryCount: subcats.size,
        subcategories: Array.from(subcats)
      })),
      categories: Array.from(group.categories.keys()),
      totalSubcategories: Array.from(group.categories.values())
        .reduce((total, subcats) => total + subcats.size, 0)
    }));
  };

  // 初始化SVG
  const initializeSvg = () => {
    if (!mainRef.current) {
      console.warn('mainRef.current 为空，无法初始化SVG');
      return null;
    }

    if (!svgRef.current) {
      const width = mainRef.current.clientWidth;
      const height = mainRef.current.clientHeight;

      svgRef.current = d3.select(mainRef.current)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .attr('id', 'mainSvg'); // 添加ID以便在控制台中查找
    }
    return svgRef.current;
  };

  // 数字转汉字函数（优化版）
  const numberToChinese = (num) => {
    if (num === 0) return '零';
    
    // 数字到汉字的映射
    const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const units = ['', '十', '百', '千', '万'];
    
    // 优化的转换逻辑，确保准确性
    if (num >= 100000000) { // 一亿以上
      const yi = Math.floor(num / 100000000);
      const remainder = num % 100000000;
      if (remainder === 0) {
        return digits[yi] + '亿';
      } else if (remainder >= 10000000) {
        return digits[yi] + '亿' + digits[Math.floor(remainder / 10000000)] + '千万';
      } else if (remainder >= 1000000) {
        return digits[yi] + '亿' + digits[Math.floor(remainder / 1000000)] + '百万';
      } else {
        return digits[yi] + '亿';
      }
    } else if (num >= 10000000) { // 千万以上
      const qianwan = Math.floor(num / 10000000);
      const remainder = num % 10000000;
      if (remainder === 0) {
        return digits[qianwan] + '千万';
      } else if (remainder >= 1000000) {
        return digits[qianwan] + '千' + digits[Math.floor(remainder / 1000000)] + '百万';
      } else {
        return digits[qianwan] + '千万';
      }
    } else if (num >= 1000000) { // 百万以上
      const baiwan = Math.floor(num / 1000000);
      const remainder = num % 1000000;
      if (remainder === 0) {
        return digits[baiwan] + '百万';
      } else if (remainder >= 100000) {
        return digits[baiwan] + '百' + digits[Math.floor(remainder / 100000)] + '十万';
      } else {
        return digits[baiwan] + '百万';
      }
    } else if (num >= 100000) { // 十万以上
      const shiwan = Math.floor(num / 100000);
      const remainder = num % 100000;
      if (remainder === 0) {
        return digits[shiwan] + '十万';
      } else if (remainder >= 10000) {
        return digits[shiwan] + '十' + digits[Math.floor(remainder / 10000)] + '万';
      } else {
        return digits[shiwan] + '十万';
      }
    } else if (num >= 10000) { // 万以上
      const wan = Math.floor(num / 10000);
      const remainder = num % 10000;
      if (remainder === 0) {
        return digits[wan] + '万';
      } else if (remainder >= 1000) {
        return digits[wan] + '万' + digits[Math.floor(remainder / 1000)] + '千';
      } else {
        return digits[wan] + '万';
      }
    } else if (num >= 1000) { // 千以上
      const qian = Math.floor(num / 1000);
      return digits[qian] + '千';
    } else if (num >= 100) { // 百以上
      const bai = Math.floor(num / 100);
      return digits[bai] + '百';
    } else if (num >= 10) { // 十以上
      const shi = Math.floor(num / 10);
      if (shi === 1) {
        return '十';
      } else {
        return digits[shi] + '十';
      }
    } else {
      return digits[Math.round(num)];
    }
  };

  // 绘制组合视图（花瓣图和面积图）
  const drawCombinedView = (data, populationData, container, dynastyXScale, width, height) => {
    if (!data || !populationData || !populationData.yearlyData) return;

    const margin = { top: 10, right: 30, bottom: 0, left: 60 }; // 增加左边距为汉字留出更多空间
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 为每个朝代内的数据点分配x坐标（在朝代区域内均匀分布）
    const processedAreaData = [];
    populationData.dynasties.forEach(dynasty => {
      const dynastyData = populationData.yearlyData
        .filter(d => d.dynasty === dynasty)
        .sort((a, b) => a.year - b.year);
      
      if (dynastyData.length > 0) {
        const dynastyStart = dynastyXScale(dynasty);
        const dynastyWidth = dynastyXScale.bandwidth();
        
        dynastyData.forEach((d, index) => {
          let x;
          if (dynastyData.length === 1) {
            // 如果只有一个数据点，放在朝代区域中心
            x = dynastyStart + dynastyWidth / 2;
          } else {
            // 如果有多个数据点，在朝代区域内均匀分布
            x = dynastyStart + (dynastyWidth * (index + 1)) / (dynastyData.length + 1);
          }
          
          processedAreaData.push({
            ...d,
            x: x
          });
        });
      }
    });

    // 按x坐标排序，确保面积图连续
    processedAreaData.sort((a, b) => a.x - b.x);

    // 创建y轴比例尺（固定最大值为160万）
    const maxPopulation = 1600000; // 160万
    const yScale = d3.scaleLinear()
      .domain([0, maxPopulation])
      .range([innerHeight, 0]);

    // 创建面积生成器（使用处理后的x坐标）
    const area = d3.area()
      .x(d => d.x)
      .y0(innerHeight)
      .y1(d => yScale(d.population))
      .curve(d3.curveBasis);

    // 创建渐变定义（必须在绘制面积图之前）
    const defs = container.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'areaGradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', 0).attr('y2', innerHeight);

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#246b69')
      .attr('stop-opacity', 1.0);

    gradient.append('stop')
      .attr('offset', '80%')
      .attr('stop-color', '#246b69')
      .attr('stop-opacity', 0.7);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#dbc08e')
      .attr('stop-opacity', 0.5);

    // 绘制面积图
    container.append('path')
      .datum(processedAreaData)
      .attr('class', 'area')
      .attr('d', area)
      .attr('fill', 'url(#areaGradient)')
      .attr('stroke', '#a09590')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.8)
      .style('pointer-events', 'none'); // 不拦截鼠标事件

    // 添加Y轴（使用汉字显示，自定义刻度）
    const customTicks = [0, 200000, 400000, 600000, 800000, 1000000, 1200000, 1400000, 1600000]; // 20万间隔
    container.append('g')
      .call(d3.axisLeft(yScale)
        .tickValues(customTicks)
        .tickFormat(d => numberToChinese(d)))
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('color', '#6b5d4f')
      .style('pointer-events', 'none') // 不拦截鼠标事件
      .selectAll('text')
      .attr('font-size', '12px');

    // 在面积图上绘制人口数据点（根据showDataPoints控制显示）
    if (showDataPoints) {
      const dataPoints = container.selectAll('.population-point')
        .data(processedAreaData)
        .join('g')
        .attr('class', 'population-point')
        .attr('transform', d => `translate(${d.x}, ${yScale(d.population)})`);

      // 添加外圈发光效果
      dataPoints.append('circle')
        .attr('class', 'point-glow')
        .attr('r', 8)
        .attr('fill', 'none')
        .attr('stroke', '#dbc08e')
        .attr('stroke-width', 2)
        .attr('opacity', 0.6);

      // 添加内圈数据点
      dataPoints.append('circle')
        .attr('class', 'point-core')
        .attr('r', 4)
        .attr('fill', '#8b6f47')
        .attr('stroke', '#dbc08e')
        .attr('stroke-width', 2)
        .attr('opacity', 0.9);

      // 添加数据点交互效果
      dataPoints
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).select('.point-glow')
            .transition()
            .duration(200)
            .attr('r', 12)
            .attr('opacity', 0.8);
          
          d3.select(this).select('.point-core')
            .transition()
            .duration(200)
            .attr('r', 6)
            .attr('fill', '#6b5d4f');

          const tooltip = d3.select(tooltipRef.current);
          tooltip
            .style('opacity', 1)
            .html(`
              <div>朝代：${d.dynasty}</div>
              <div>年份：${d.year}年</div>
              <div>人口：${numberToChinese(d.population)}</div>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function(event, d) {
          d3.select(this).select('.point-glow')
            .transition()
            .duration(200)
            .attr('r', 8)
            .attr('opacity', 0.6);
          
          d3.select(this).select('.point-core')
            .transition()
            .duration(200)
            .attr('r', 4)
            .attr('fill', '#8b6f47');

          d3.select(tooltipRef.current).style('opacity', 0);
        });
    }

    // 不再需要单独的年份x轴，因为朝代标签已经在上方显示

    // 计算每个朝代在面积图上的峰值位置（用于花瓣定位）
    const dynastyPeaks = new Map();
    populationData.dynasties.forEach(dynasty => {
      const dynastyProcessedData = processedAreaData.filter(d => d.dynasty === dynasty);
      if (dynastyProcessedData.length > 0) {
        const maxPop = d3.max(dynastyProcessedData, d => d.population);
        const peakData = dynastyProcessedData.find(d => d.population === maxPop);
        dynastyPeaks.set(dynasty, {
          x: peakData.x,
          y: yScale(peakData.population)
        });
      } else {
        // 如果没有数据，使用朝代区域中心
        dynastyPeaks.set(dynasty, {
          x: dynastyXScale(dynasty) + dynastyXScale.bandwidth() / 2,
          y: innerHeight / 2
        });
      }
    });

    // 计算花瓣大小（减小整体尺寸）
    const dynastyRadius = Math.min(dynastyXScale.bandwidth(), innerHeight / 6);

    // 创建物产大类颜色比例尺（与气泡图保持一致）
    const allCategories = new Set();
    data.forEach(dynastyData => {
      dynastyData.categoryData.forEach(category => {
        allCategories.add(category.category);
      });
    });
    
    const categoryColorScale = d3.scaleOrdinal()
      .domain([...allCategories])
      .range([
        '#c5aeb7', // 暖粉灰 - 温润柔和
        '#beb6a9', // 暖米灰 - 古朴自然
        '#c1b2b9', // 淡紫灰 - 雅致沉稳
        '#b6bbb3', // 暖青灰 - 清雅宁静
        '#beb9be', // 中性灰 - 素雅平和
        '#b3b5b8', // 蓝灰调 - 淡雅悠远
        '#afacb6', // 紫灰调 - 古典韵味
        '#aebbb7', // 青灰调 - 水墨意境
        '#a9b9b9', // 青蓝灰 - 天空悠远
        '#c8c2a8'  // 暖黄灰 - 增加黄调平衡
      ]);

    // 为每个朝代创建花瓣组
    const dynastyGroups = container.selectAll('.dynasty-group')
      .data(data)
      .join('g')
      .attr('class', 'dynasty-group')
      .style('z-index', '9999') // 设置最高的z-index，确保花瓣显示在最前面
      .attr('transform', d => {
        const peak = dynastyPeaks.get(d.dynasty);
        if (peak) {
          return `translate(${peak.x}, ${Math.max(peak.y - 20, dynastyRadius)})`; // 减小与面积图的距离
        } else {
          // 如果没有峰值数据，使用朝代区域中心
          return `translate(${dynastyXScale(d.dynasty) + dynastyXScale.bandwidth()/2}, ${dynastyRadius})`;
        }
      });

    // 为每个朝代绘制花瓣
    dynastyGroups.each(function(dynastyData) {
      const group = d3.select(this);
      
      // 准备花瓣数据
      const petalData = dynastyData.categoryData.map(category => ({
        subcategoryCount: category.subcategoryCount,
        category: category.category,
        subcategories: category.subcategories,
        dynasty: dynastyData.dynasty,
        startAngle: 0,
        endAngle: Math.PI / 6
      }));

      // 计算总角度和起始偏移
      const totalAngle = petalData.length * (Math.PI / 6);
      const startOffset = -totalAngle / 2;

      // 设置每个花瓣的角度
      petalData.forEach((d, i) => {
        d.startAngle = startOffset + i * (Math.PI / 4);
        d.endAngle = d.startAngle + Math.PI / 4;
      });

      // 创建弧形生成器（减小花瓣大小）
      const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(d => {
          const scale = d3.scaleLinear()
            .domain([1, d3.max(petalData, d => d.subcategoryCount)])
            .range([dynastyRadius * 0.4, dynastyRadius * 0.8]);
          return scale(d.subcategoryCount);
        })
        .cornerRadius(10);

      // 绘制花瓣
      const petals = group.selectAll('.petal')
        .data(petalData)
        .join('path')
        .attr('class', 'petal')
        .attr('d', arc)
        .attr('fill', d => categoryColorScale(d.category))
        .attr('opacity', 0.8)
        .attr('cursor', 'pointer')
        .style('pointer-events', 'all')
        .style('z-index', '10000') // 为花瓣设置最高z-index
        .attr('stroke', 'transparent') // 透明边框，增加点击区域
        .attr('stroke-width', 8) // 增加点击区域
        // 清除所有可能存在的旧事件监听器
        .on('mouseover', null)
        .on('mouseout', null) 
        .on('click', null)
        .on('mouseover.petal', null)
        .on('mouseout.petal', null) 
        .on('click.petal', null)
        .on('mouseover.petal-v2', null)
        .on('mouseout.petal-v2', null) 
        .on('click.petal-v2', null)
        // 重新绑定事件
        .on('mouseenter.petal-v4', function(event, d) {
          // 使用mouseenter代替mouseover，减少重复触发
          d3.select(this)
            .attr('opacity', 1)
            .attr('fill', d => d3.color(categoryColorScale(d.category)).darker(0.3));
          const tooltip = d3.select(tooltipRef.current);
          tooltip
            .style('opacity', 1)
            .html(`
              <div>朝代：${d.dynasty}</div>
              <div>物产大类：${d.category}</div>
              <div>包含小类：${d.subcategoryCount}种</div>
              <div style="color: #666; font-size: 12px; margin-top: 5px;">点击查看详细信息</div>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseleave.petal-v4', function(event, d) {
          // 使用mouseleave代替mouseout
          d3.select(this)
            .attr('opacity', 0.8)
            .attr('fill', d => categoryColorScale(d.category));
          d3.select(tooltipRef.current).style('opacity', 0);
        })
        .on('click.petal-v4', function(event, d) {
          console.log('花瓣被点击:', d.dynasty, d.category);
          
          // 移除alert，直接调用函数
          event.stopPropagation();
          event.preventDefault();
          handlePetalClick(d.dynasty, d.category);
        });
    });
  };

  // 绘制主视图（包含花瓣图、折线图和气泡图）
  const drawMainView = (data, populationData, bubbleData) => {
    if (!data || !populationData || !bubbleData) {
      console.error('缺少必要的数据:', { data, populationData, bubbleData });
      return;
    }

    // 检查mainRef是否存在
    if (!mainRef.current) {
      console.warn('mainRef.current 为空，跳过绘制。当前状态:', {
        showDetailView,
        hasMainRef: !!mainRef,
        mainRefCurrent: mainRef.current,
        componentMounted: document.contains(mainRef.current)
      });
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;

    // 彻底清除之前的内容和所有事件监听器
    svg.selectAll('*').each(function() {
      // 清除每个元素上的所有事件监听器
      d3.select(this).on('.click', null).on('.mouseover', null).on('.mouseout', null);
    }).remove();
    svg.on('.click', null); // 清除SVG上的点击事件监听器

    // 获取容器的宽度
    const containerWidth = mainRef.current.clientWidth;
    const containerHeight = mainRef.current.clientHeight;
    
    // 设置更大的SVG宽度，比容器宽度大50%
    const width = containerWidth * 1.5;
    const height = containerHeight*1.2;
    
    // 更新SVG尺寸
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .style('overflow', 'visible');

    // 调整边距，整体右移
    const margin = { 
      top: -60,  // 增加顶部边距为朝代名称留出空间
      right: 20,
      bottom: 50, // 减小底部边距，因为不需要x轴了
      left: 80 // 增加左边距，使整体图形右移
    };
    const contentWidth = width - margin.left - margin.right;
    const contentHeight = height - margin.top - margin.bottom;

    // 调整视图区域比例（面积图更高，气泡图更矮）
    const combinedHeight = contentHeight * 0.7;
    const bubbleHeight = contentHeight * 0.3;

    // 获取所有需要显示的朝代（包括人口数据和气泡数据中的朝代）
    const populationDynasties = populationData.dynasties;
    const bubbleDynasties = bubbleData ? [...new Set(bubbleData.map(d => d.dynasty))] : [];
    const allDynasties = [...new Set([...populationDynasties, ...bubbleDynasties])];
    
    // 按照人口数据中的顺序排序，确保一致性
    const orderedDynasties = populationData.dynasties.filter(dynasty => 
      allDynasties.includes(dynasty)
    );
    
    // 调试日志（可选）
    // console.log('人口数据朝代:', populationDynasties);
    // console.log('气泡数据朝代:', bubbleDynasties);
    // console.log('所有朝代:', allDynasties);
    // console.log('有序朝代:', orderedDynasties);
    
    // 创建朝代x轴比例尺（用于气泡图和背景分区）
    const dynastyXScale = d3.scaleBand()
      .domain(orderedDynasties)
      .range([0, contentWidth])
      .padding(0.1);

    // 创建统一的朝代颜色比例尺（确保所有视图使用相同的映射）
    const dynasties = orderedDynasties;
    const dynastyColorScale = d3.scaleOrdinal()
      .domain(dynasties)
      .range([
        '#f9f7f4', // 宣纸白 - 淡雅底色
        '#f5f2ed', // 米白色 - 温润如玉
        '#f1ede6', // 淡米色 - 素雅清淡
        '#ede8df', // 浅灰米 - 水墨晕染
        '#e9e3d8', // 淡土色 - 古朴自然
        '#e5ded1', // 浅褐色 - 竹纸色
        '#e1d9ca', // 淡茶色 - 清香淡雅
        '#ddd4c3', // 浅驼色 - 温和柔润
        '#d9cfbc', // 淡卡其 - 素净雅致
        '#d5cab5'  // 浅棕灰 - 古韵悠长
      ]);

    // 创建背景分隔区域组
    const backgroundGroup = svg.append('g')
      .attr('class', 'background-group')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // 绘制朝代背景分隔区域
    backgroundGroup.selectAll('.dynasty-background')
      .data(dynasties)
      .join('rect')
      .attr('class', 'dynasty-background')
      .attr('x', d => dynastyXScale(d))
      .attr('y', 0)
      .attr('width', dynastyXScale.bandwidth())
      .attr('height', contentHeight)
      .attr('fill', d => dynastyColorScale(d))
      .attr('opacity', 0.6)
      .attr('stroke', '#c7b299')
      .attr('stroke-width', 1)
      .style('pointer-events', 'none'); // 不拦截鼠标事件

    // 添加朝代名称（垂直排列）
    dynasties.forEach(dynasty => {
      const dynastyChars = dynasty.split('');
      const dynastyGroup = backgroundGroup.append('g')
        .attr('class', 'dynasty-label-group');

      // 添加朝代名称的背景矩形
      // const nameHeight = dynastyChars.length * 16 + 8; // 进一步减小额外空间，从10改为8
      // const bgRect = dynastyGroup.append('rect')
      //   .attr('class', 'dynasty-name-bg')
      //   .attr('x', dynastyXScale(dynasty) + dynastyXScale.bandwidth() / 2 - 9) // 从-10改为-9，进一步减小
      //   .attr('y', 12) // 从10改为12，稍微向下移动
      //   .attr('width', 18) // 从20改为18，进一步减小宽度
      //   .attr('height', nameHeight)
      //   .attr('fill', 'rgba(199, 178, 153, 0.1)')
      //   .attr('stroke', 'rgba(199, 178, 153, 0.3)')
      //   .attr('stroke-width', 0.5) // 从1改为0.5，更细的边框
      //   .attr('rx', 3); // 从4改为3，更小的圆角

      // 然后添加文字
      dynastyChars.forEach((char, index) => {
        dynastyGroup.append('text')
          .attr('class', 'dynasty-label')
          .attr('x', dynastyXScale(dynasty) + dynastyXScale.bandwidth() / 2)
          .attr('y', 20 + index * 16) // 从18改为16，减小字符间距
          .attr('text-anchor', 'middle')
          .attr('font-family', "'Noto Serif SC', serif")
          .attr('font-size', '13px') // 从14px减小到13px
          .attr('font-weight', 'normal')
          .attr('fill', '#8c6d46') // 加深颜色，从#4a3f35改为#2d2520
          .style('pointer-events', 'none') // 不拦截鼠标事件
          .text(char);
      });

      // 朝代名称仅用于显示，无交互功能
    });

    // 创建组（不再需要x轴组）
    const combinedGroup = svg.append('g')
      .attr('class', 'combined-group')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    const bubbleGroup = svg.append('g')
      .attr('class', 'bubble-group')
      .attr('transform', `translate(${margin.left}, ${margin.top + combinedHeight})`);

    // SVG点击事件监听器（仅用于调试）
    // svg.on('click', function(event) {
    //   console.log('SVG被点击，坐标:', event.offsetX, event.offsetY);
    // });

    // 绘制组合视图
    drawCombinedView(data, populationData, combinedGroup, dynastyXScale, contentWidth, combinedHeight);

    // 绘制气泡图，传递统一的朝代颜色比例尺
    if (dynastyXScale) {
      drawBubbleView(bubbleData, bubbleGroup, contentWidth, bubbleHeight, dynastyXScale, dynastyColorScale);
    }

    // 添加物产大类图例
    const allCategories = new Set();
    data.forEach(dynastyData => {
      dynastyData.categoryData.forEach(category => {
        allCategories.add(category.category);
      });
    });

    const categoryColorScale = d3.scaleOrdinal()
      .domain([...allCategories])
      .range([
        '#c5aeb7', // 暖粉灰 - 温润柔和
        '#beb6a9', // 暖米灰 - 古朴自然
        '#c1b2b9', // 淡紫灰 - 雅致沉稳
        '#b6bbb3', // 暖青灰 - 清雅宁静
        '#beb9be', // 中性灰 - 素雅平和
        '#b3b5b8', // 蓝灰调 - 淡雅悠远
        '#afacb6', // 紫灰调 - 古典韵味
        '#aebbb7', // 青灰调 - 水墨意境
        '#a9b9b9', // 青蓝灰 - 天空悠远
        '#c8c2a8'  // 暖黄灰 - 增加黄调平衡
      ]);

    // 创建图例组 - 位于气泡图左下角
    const legendGroup = svg.append('g')
      .attr('class', 'legend-group')
      .attr('transform', `translate(${margin.left + 10}, ${height - 10})`);

    // 计算横向布局参数
    const categoriesArray = [...allCategories];
    const itemsPerRow = 5; // 每行显示5个项目
    const itemWidth = 60; // 每个图例项的宽度
    const itemHeight = 20; // 每个图例项的高度
    const rows = Math.ceil(categoriesArray.length / itemsPerRow);

    // 添加图例背景
    const legendBg = legendGroup.append('rect')
      .attr('x', -5)
      .attr('y', -25)
      .attr('width', itemsPerRow * itemWidth + 10)
      .attr('height', rows * itemHeight + 35)
      .attr('fill', 'rgba(249, 247, 244, 0.9)')
      .attr('stroke', '#c7b299')
      .attr('stroke-width', 1)
      .attr('rx', 6);

    // 添加图例标题
    legendGroup.append('text')
      .attr('x', (itemsPerRow * itemWidth) / 2)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', '#4a3f35')
      .text('物产大类');

    // 添加图例项 - 横向布局
    const legendItems = legendGroup.selectAll('.legend-item')
      .data(categoriesArray)
      .join('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => {
        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;
        return `translate(${col * itemWidth}, ${row * itemHeight + 5})`;
      });

    // 添加颜色方块
    legendItems.append('rect')
      .attr('x', 0)
      .attr('y', -8)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', d => categoryColorScale(d))
      .attr('stroke', '#a09590')
      .attr('stroke-width', 1)
      .attr('rx', 2);

    // 添加文字标签
    legendItems.append('text')
      .attr('x', 18)
      .attr('y', 0)
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', '11px')
      .attr('fill', '#4a3f35')
      .attr('dominant-baseline', 'middle')
      .text(d => d.length > 6 ? d.substring(0, 6) + '...' : d); // 长文本截断
  };

  // 绘制气泡图
  const drawBubbleView = (data, container, width, height, xScale, dynastyColorScale) => {
    const margin = { top: 10, right: 30, bottom: 60, left: 60 }; // 增加底部边距为搜索框留出更多空间
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 获取所有唯一的朝代和产品
    const dynasties = [...new Set(data.map(d => d.dynasty))];
    let products = [...new Set(data.map(d => d.product))];
    const categories = [...new Set(data.map(d => d.category))];

    // 根据搜索词过滤产品
    if (searchTerm.trim()) {
      products = products.filter(product => 
        product.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 计算当前页的产品范围
    const start = currentPage * itemsPerPage;
    const currentProducts = products.slice(start, start + itemsPerPage);

    // 清除之前的内容
    container.selectAll('*').remove();

    // 创建新的容器组
    const g = container.append('g')
      .attr('transform', `translate(0,0)`); // 移除左边距，因为container已经包含了边距

    // 创建比例尺
    const yScale = d3.scaleBand()
      .domain(currentProducts)
      .range([0, innerHeight])
      .padding(0.1);

    const rScale = d3.scaleSqrt()
      .domain([0, d3.max(data, d => d.count)])
      .range([2, 18]); // 从[3, 25]调整为[2, 18]，减小气泡大小

    // 使用传统绘画风格的淡雅色彩作为物产类别颜色
    const colorScale = d3.scaleOrdinal()
      .domain(categories)
      .range([
        '#c5aeb7', // 暖粉灰 - 温润柔和
        '#beb6a9', // 暖米灰 - 古朴自然
        '#c1b2b9', // 淡紫灰 - 雅致沉稳
        '#b6bbb3', // 暖青灰 - 清雅宁静
        '#beb9be', // 中性灰 - 素雅平和
        '#b3b5b8', // 蓝灰调 - 淡雅悠远
        '#afacb6', // 紫灰调 - 古典韵味
        '#aebbb7', // 青灰调 - 水墨意境
        '#a9b9b9', // 青蓝灰 - 天空悠远
        '#c8c2a8'  // 暖黄灰 - 增加黄调平衡
      ]);

    // 绘制气泡
    const bubbles = g.selectAll('.bubble')
      .data(data.filter(d => currentProducts.includes(d.product)))
      .join('circle')
      .attr('class', 'bubble')
      .attr('cx', d => xScale(d.dynasty) + xScale.bandwidth()/2)
      .attr('cy', d => yScale(d.product) + yScale.bandwidth()/2)
      .attr('r', d => rScale(d.count))
      .style('fill', d => colorScale(d.category))
      .style('opacity', 0.8);

    // 添加搜索高亮效果
    if (searchTerm.trim()) {
      bubbles
        .style('opacity', d => 
          d.product.toLowerCase().includes(searchTerm.toLowerCase()) ? 0.9 : 0.3
        )
        .style('stroke-width', d => 
          d.product.toLowerCase().includes(searchTerm.toLowerCase()) ? 2 : 1
        );
    }

    // 添加交互效果
    bubbles
      .on('mouseover', function(event, d) {
        d3.select(this)
          .classed('highlighted', true)
          .style('opacity', 1)
          .style('fill', d3.color(colorScale(d.category)).darker(0.3)); // 颜色变深

        const tooltip = d3.select(tooltipRef.current);
        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        tooltip.html(`
          <div>朝代: ${d.dynasty}</div>
          <div>物产: ${d.product}</div>
          <div>类别: ${d.category}</div>
          <div>频次: ${d.count}</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function(event, d) {
        const isHighlighted = searchTerm.trim() && 
          d.product.toLowerCase().includes(searchTerm.toLowerCase());
        
        d3.select(this)
          .classed('highlighted', false)
          .style('fill', colorScale(d.category)) // 恢复原色
          .style('opacity', isHighlighted ? 0.9 : (searchTerm.trim() ? 0.3 : 0.8));
        
        d3.select(tooltipRef.current)
          .transition()
          .duration(500)
          .style('opacity', 0);
      });

    // 只添加Y轴，X轴现在是共享的
    g.append('g')
      .call(d3.axisLeft(yScale))
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('color', '#6b5d4f')
      .attr('font-size', '12px');

    // 将页码信息移到底部
    g.append('text')
      .attr('class', 'page-info')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + margin.bottom - 25) // 调整位置，在搜索框上方
      .attr('text-anchor', 'middle')
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('font-size', '12px')
      .attr('fill', '#6b5d4f')
      .text(() => {
        const totalProducts = [...new Set(data.map(d => d.product))].length;
        const filteredTotal = products.length;
        if (searchTerm.trim()) {
          return `搜索结果：显示 ${start + 1}-${Math.min(start + itemsPerPage, filteredTotal)} 项，共 ${filteredTotal} 项（总计 ${totalProducts} 项）`;
        } else {
          return `显示 ${start + 1}-${Math.min(start + itemsPerPage, filteredTotal)} 项，共 ${filteredTotal} 项`;
        }
      });
  };

  // 处理滚轮事件
  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const { currentPage, searchTerm, bubbleData } = stateRef.current;
    
    if (!bubbleData) return;

    // 获取过滤后的产品列表
    let products = [...new Set(bubbleData.map(d => d.product))];
    if (searchTerm.trim()) {
      products = products.filter(product => 
        product.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    const maxPage = Math.ceil(products.length / itemsPerPage) - 1;

    // 检查鼠标位置是否在气泡图区域
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseY = event.clientY - rect.top;
    const totalHeight = rect.height;
    const bubbleChartStart = totalHeight * 0.6; // 因为气泡图在底部40%的区域

    if (mouseY >= bubbleChartStart) {
      if (event.deltaY > 0 && currentPage < maxPage) {
        setCurrentPage(prev => prev + 1);
      } else if (event.deltaY < 0 && currentPage > 0) {
        setCurrentPage(prev => prev - 1);
      }
    }
  }, [itemsPerPage]); // 现在只依赖于常量

  // 初始化数据和事件监听
  useEffect(() => {
    // 如果正在显示下钻视图，不执行初始化
    if (showDetailView) return;

    // 等待DOM元素准备好
    const waitForElement = () => {
      return new Promise((resolve) => {
        if (mainRef.current) {
          resolve();
        } else {
          // 使用requestAnimationFrame等待下一个渲染周期
          requestAnimationFrame(() => {
            if (mainRef.current) {
              resolve();
            } else {
              // 如果仍然没有准备好，使用setTimeout再次尝试
              setTimeout(() => {
                if (mainRef.current) {
                  resolve();
                } else {
                  console.warn('mainRef在多次尝试后仍为空，跳过初始化');
                }
              }, 100);
            }
          });
        }
      });
    };

    const loadData = async () => {
      try {
        // 等待DOM元素准备好
        await waitForElement();
        
        // 再次检查mainRef
        if (!mainRef.current) {
          console.warn('等待后mainRef仍为空，跳过数据加载');
          return;
        }

        // 初始化SVG
        const svg = initializeSvg();
        if (!svg) {
          console.warn('SVG初始化失败，跳过数据加载');
          return;
        }

        const [csvText, populationCsvText, bubData] = await Promise.all([
          fetch('/data/problem3/物产数据_按朝代排序.csv').then(response => response.text()),
          fetch('/data/problem3/人口数量统计.csv').then(response => response.text()),
          fetch('/data/problem3/bubble_data.json').then(response => response.json())
        ]);

        const data = d3.csvParse(csvText);
        const populationRawData = d3.csvParse(populationCsvText);
        const processedData = processData(data);
        const processedPopulationData = processPopulationData(populationRawData, bubData);
        
        setPopulationData(processedPopulationData);
        setBubbleData(bubData);
        setRawData(csvText);
        drawMainView(processedData, processedPopulationData, bubData);

        // 设置初始化完成标志
        isInitializedRef.current = true;

        // 将引用暴露到window对象，方便在控制台中访问
        window.mainSvg = svgRef.current;
        window.d3 = d3;

        // 添加一个样式标签到SVG中
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
          .x-axis-group .domain {
            stroke: #4A4A4A;
            stroke-width: 2px;
          }
          .x-axis-group .tick line {
            stroke: #4A4A4A;
            stroke-width: 2px;
          }
          .x-axis-group .tick text {
            font-size: 14px;
            font-weight: bold;
          }
        `;
        svgRef.current.node().appendChild(style);
      } catch (error) {
        console.error('数据加载错误：', error);
      }
    };

    loadData();

    // 添加滚轮事件监听
    const addWheelListener = () => {
      const mainElement = mainRef.current;
      if (mainElement) {
        mainElement.addEventListener('wheel', handleWheel, { passive: false });
      }
    };

    // 延迟添加事件监听器，确保元素已经准备好
    setTimeout(addWheelListener, 100);

    return () => {
      const mainElement = mainRef.current;
      if (mainElement) {
        mainElement.removeEventListener('wheel', handleWheel);
      }
      // 清理防抖定时器和重置初始化标志
      if (redrawTimeoutRef.current) {
        clearTimeout(redrawTimeoutRef.current);
      }
      isInitializedRef.current = false;
    };
  }, [showDetailView]); // 移除handleWheel依赖，避免循环

  // 当页码、搜索词或显示选项改变时，只重绘气泡图部分（带防抖）
  useEffect(() => {
    // 如果正在显示下钻视图，不重新绘制主视图
    if (showDetailView || !isInitializedRef.current) return;
    
    // 清除之前的防抖定时器
    if (redrawTimeoutRef.current) {
      clearTimeout(redrawTimeoutRef.current);
    }
    
    // 设置防抖重绘
    redrawTimeoutRef.current = setTimeout(() => {
      if (bubbleData && populationData && mainRef.current && svgRef.current) {
        try {
          // 只重绘气泡图部分，而不是整个视图
          const svg = svgRef.current;
          const bubbleGroup = svg.select('.bubble-group');
          
          if (!bubbleGroup.empty()) {
            const containerWidth = mainRef.current.clientWidth;
            const containerHeight = mainRef.current.clientHeight;
            const width = containerWidth * 1.5;
            const height = containerHeight * 1.2;
            const margin = { top: -60, right: 20, bottom: 50, left: 80 };
            const contentWidth = width - margin.left - margin.right;
            const contentHeight = height - margin.top - margin.bottom;
            const combinedHeight = contentHeight * 0.7;
            const bubbleHeight = contentHeight * 0.3;
            
            // 获取朝代比例尺
            const populationDynasties = populationData.dynasties;
            const bubbleDynasties = bubbleData ? [...new Set(bubbleData.map(d => d.dynasty))] : [];
            const allDynasties = [...new Set([...populationDynasties, ...bubbleDynasties])];
            const orderedDynasties = populationData.dynasties.filter(dynasty => 
              allDynasties.includes(dynasty)
            );
            
            const dynastyXScale = d3.scaleBand()
              .domain(orderedDynasties)
              .range([0, contentWidth])
              .padding(0.1);
            
            const dynastyColorScale = d3.scaleOrdinal()
              .domain(orderedDynasties)
              .range([
                '#f9f7f4', '#f5f2ed', '#f1ede6', '#ede8df', '#e9e3d8',
                '#e5ded1', '#e1d9ca', '#ddd4c3', '#d9cfbc', '#d5cab5'
              ]);
            
            // 重绘气泡图
            drawBubbleView(bubbleData, bubbleGroup, contentWidth, bubbleHeight, dynastyXScale, dynastyColorScale);
          }
        } catch (error) {
          console.error('重新绘制气泡图时出错：', error);
        }
      }
    }, 150); // 150ms防抖延迟
    
    return () => {
      if (redrawTimeoutRef.current) {
        clearTimeout(redrawTimeoutRef.current);
      }
    };
  }, [currentPage, searchTerm, showDataPoints, bubbleData, populationData, showDetailView]);

  // 当搜索词改变时重置页码
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm]);

  return (
    <div className="product-vis-container">
      {!showDetailView ? (
        <>
          <div className="search-container">
            <input
              type="text"
              placeholder="搜索物产名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="clear-search-btn"
              >
                清除
              </button>
            )}
          </div>
          <div 
            className="main-view" 
            ref={mainRef}
            style={{ cursor: 'default' }}
          />
          <div className="tooltip" ref={tooltipRef} />
        </>
      ) : (
        <div className="detail-view-container">
          <button className="back-button" onClick={handleCloseDetailView}>
            ← 返回
          </button>
          <ProductDetailView 
            dynasty={selectedDynastyForDetail}
            category={selectedCategoryForDetail}
            onClose={handleCloseDetailView}
            isEmbedded={true}
          />
        </div>
      )}
    </div>
  );
};

export default ProductVis; 