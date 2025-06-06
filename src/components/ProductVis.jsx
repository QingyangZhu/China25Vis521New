import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import './ProductVis.css';
import ProductDetailView from './ProductDetailView';

const ProductVis = () => {
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
  const itemsPerPage = 5; // 每页显示5个物产

  // 处理朝代点击事件
  const handleDynastyClick = (dynasty) => {
    setSelectedDynastyForDetail(dynasty);
    setShowDetailView(true);
  };

  // 关闭下钻视图
  const handleCloseDetailView = () => {
    setShowDetailView(false);
    setSelectedDynastyForDetail(null);
    
    // 延迟重新绘制主视图，确保DOM已经更新
    setTimeout(() => {
      if (rawData && populationData && bubbleData) {
        // 清除之前的SVG引用，强制重新初始化
        svgRef.current = null;
        
        // 重新初始化SVG
        const svg = initializeSvg();
        if (svg) {
          const data = d3.csvParse(rawData);
          const processedData = processData(data);
          drawMainView(processedData, populationData, bubbleData);
          
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
      }
    }, 100);
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

  // 绘制组合视图（花瓣图和面积图）
  const drawCombinedView = (data, populationData, container, xScale, width, height) => {
    if (!data || !populationData || !populationData.data) return;

    const margin = { top: 10, right: 30, bottom: 0, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 创建y轴比例尺
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(populationData.data, d => d.population)])
      .range([innerHeight, 0]);

    // 创建面积生成器
    const area = d3.area()
      .x(d => xScale(d.dynasty) + xScale.bandwidth()/2)
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
      .datum(populationData.data)
      .attr('class', 'area')
      .attr('d', area)
      .attr('fill', 'url(#areaGradient)')
      .attr('stroke', '#a09590')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.8);

    // 添加Y轴
    container.append('g')
      .call(d3.axisLeft(yScale))
      .attr('font-family', "'Noto Serif SC', serif")
      .attr('color', '#6b5d4f')
      .selectAll('text')
      .attr('font-size', '12px');

    // 计算每个朝代的最高点y值
    const peakPoints = new Map();
    populationData.data.forEach(d => {
      peakPoints.set(d.dynasty, yScale(d.population));
    });

    // 计算花瓣大小
    const dynastyRadius = Math.min(xScale.bandwidth(), innerHeight / 4);

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
      .attr('transform', d => {
        const peakY = peakPoints.get(d.dynasty) || innerHeight/2;
        return `translate(${xScale(d.dynasty) + xScale.bandwidth()/2}, ${Math.max(peakY - 30, dynastyRadius)})`; // 确保花瓣不会太靠上
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

      // 创建弧形生成器
      const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(d => {
          const scale = d3.scaleLinear()
            .domain([1, d3.max(petalData, d => d.subcategoryCount)])
            .range([dynastyRadius * 0.6, dynastyRadius * 1.2]);
          return scale(d.subcategoryCount);
        })
        .cornerRadius(15);

      // 绘制花瓣
      const petals = group.selectAll('.petal')
        .data(petalData)
        .join('path')
        .attr('class', 'petal')
        .attr('d', arc)
        .attr('fill', d => categoryColorScale(d.category)) // 使用物产大类对应的颜色
        .attr('opacity', 0.8)
        .attr('cursor', 'pointer');

      // 添加交互效果
      petals
        .on('mouseover', function(event, d) {
          d3.select(this)
            .attr('opacity', 1)
            .attr('fill', d => d3.color(categoryColorScale(d.category)).darker(0.3)); // 颜色变深
          const tooltip = d3.select(tooltipRef.current);
          tooltip
            .style('opacity', 1)
            .html(`
              <div>朝代：${d.dynasty}</div>
              <div>物产大类：${d.category}</div>
              <div>包含小类：${d.subcategoryCount}种</div>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function(event, d) {
          d3.select(this)
            .attr('opacity', 0.8)
            .attr('fill', d => categoryColorScale(d.category)); // 恢复原色
          d3.select(tooltipRef.current).style('opacity', 0);
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
      console.warn('mainRef.current 为空，跳过绘制');
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;

    // 清除之前的内容，但保留SVG元素本身
    svg.selectAll('*').remove();

    // 获取容器的宽度
    const containerWidth = mainRef.current.clientWidth;
    const containerHeight = mainRef.current.clientHeight;
    
    // 设置更大的SVG宽度，比容器宽度大20%
    const width = containerWidth * 1.2;
    const height = containerHeight;
    
    // 更新SVG尺寸
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .style('overflow', 'visible');

    // 减小左右边距以增加内容区域宽度
    const margin = { 
      top: -30,  // 增加顶部边距为朝代名称留出空间
      right: 20,
      bottom: 50, // 减小底部边距，因为不需要x轴了
      left: 40
    };
    const contentWidth = width - margin.left - margin.right;
    const contentHeight = height - margin.top - margin.bottom;

    // 调整视图区域比例（去掉x轴高度）
    const combinedHeight = contentHeight * 0.6;
    const bubbleHeight = contentHeight * 0.4;

    // 创建x轴比例尺
    const xScale = d3.scaleBand()
      .domain([...new Set(populationData.data.map(d => d.dynasty))])
      .range([0, contentWidth])
      .padding(0.1);

    // 创建统一的朝代颜色比例尺（确保所有视图使用相同的映射）
    const dynasties = [...new Set(populationData.data.map(d => d.dynasty))];
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
      .attr('x', d => xScale(d))
      .attr('y', 0)
      .attr('width', xScale.bandwidth())
      .attr('height', contentHeight)
      .attr('fill', d => dynastyColorScale(d))
      .attr('opacity', 0.6)
      .attr('stroke', '#c7b299')
      .attr('stroke-width', 1);

    // 添加朝代名称（垂直排列）- 现在可点击
    dynasties.forEach(dynasty => {
      const dynastyChars = dynasty.split('');
      const dynastyGroup = backgroundGroup.append('g')
        .attr('class', 'dynasty-label-group')
        .style('cursor', 'pointer');

      // 先添加朝代名称的背景矩形，增加点击区域
      const nameHeight = dynastyChars.length * 16 + 8; // 进一步减小额外空间，从10改为8
      const bgRect = dynastyGroup.append('rect')
        .attr('class', 'dynasty-name-bg')
        .attr('x', xScale(dynasty) + xScale.bandwidth() / 2 - 9) // 从-10改为-9，进一步减小
        .attr('y', 12) // 从10改为12，稍微向下移动
        .attr('width', 18) // 从20改为18，进一步减小宽度
        .attr('height', nameHeight)
        .attr('fill', 'rgba(199, 178, 153, 0.1)')
        .attr('stroke', 'rgba(199, 178, 153, 0.3)')
        .attr('stroke-width', 0.5) // 从1改为0.5，更细的边框
        .attr('rx', 3); // 从4改为3，更小的圆角

      // 然后添加文字
      dynastyChars.forEach((char, index) => {
        dynastyGroup.append('text')
          .attr('class', 'dynasty-label')
          .attr('x', xScale(dynasty) + xScale.bandwidth() / 2)
          .attr('y', 20 + index * 16) // 从18改为16，减小字符间距
          .attr('text-anchor', 'middle')
          .attr('font-family', "'Noto Serif SC', serif")
          .attr('font-size', '13px') // 从14px减小到13px
          .attr('font-weight', 'normal')
          .attr('fill', '#8c6d46') // 加深颜色，从#4a3f35改为#2d2520
          .text(char);
      });

      // 添加一个透明的大矩形作为事件接收器
      dynastyGroup.append('rect')
        .attr('class', 'dynasty-event-receiver')
        .attr('x', xScale(dynasty) + xScale.bandwidth() / 2 - 15)
        .attr('y', 5)
        .attr('width', 30)
        .attr('height', nameHeight + 15)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', function() {
          // 高亮整个朝代名称组
          dynastyGroup.selectAll('text')
            .attr('fill', '#5a4a3a')
            .attr('font-weight', 'bold');
          
          // 高亮背景矩形
          dynastyGroup.select('.dynasty-name-bg')
            .attr('fill', 'rgba(199, 178, 153, 0.3)');
          
          // 高亮对应的背景区域
          backgroundGroup.selectAll('.dynasty-background')
            .filter(d => d === dynasty)
            .attr('opacity', 0.8)
            .attr('stroke-width', 2);
        })
        .on('mouseleave', function() {
          // 恢复朝代名称样式
          dynastyGroup.selectAll('text')
            .attr('fill', '#8c6d46')
            .attr('font-weight', 'normal');
          
          // 恢复背景矩形
          dynastyGroup.select('.dynasty-name-bg')
            .attr('fill', 'rgba(199, 178, 153, 0.1)');
          
          // 恢复背景区域样式
          backgroundGroup.selectAll('.dynasty-background')
            .filter(d => d === dynasty)
            .attr('opacity', 0.6)
            .attr('stroke-width', 1);
        })
        .on('click', function(event) {
          event.stopPropagation(); // 防止事件冒泡
          handleDynastyClick(dynasty);
        });
    });

    // 创建组（不再需要x轴组）
    const combinedGroup = svg.append('g')
      .attr('class', 'combined-group')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    const bubbleGroup = svg.append('g')
      .attr('class', 'bubble-group')
      .attr('transform', `translate(${margin.left}, ${margin.top + combinedHeight})`);

    // 绘制组合视图
    drawCombinedView(data, populationData, combinedGroup, xScale, contentWidth, combinedHeight);

    // 绘制气泡图，传递统一的朝代颜色比例尺
    if (xScale) {
      drawBubbleView(bubbleData, bubbleGroup, contentWidth, bubbleHeight, xScale, dynastyColorScale);
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
  }, [bubbleData, currentPage, searchTerm]);

  // 初始化数据和事件监听
  useEffect(() => {
    // 如果正在显示下钻视图，不执行初始化
    if (showDetailView) return;

    const loadData = async () => {
      try {
        // 初始化SVG
        const svg = initializeSvg();
        if (!svg) {
          console.warn('SVG初始化失败，跳过数据加载');
          return;
        }

        const [csvText, popData, bubData] = await Promise.all([
          fetch('/data/problem3/物产数据_按朝代排序.csv').then(response => response.text()),
          fetch('/data/problem3/population_data.json').then(response => response.json()),
          fetch('/data/problem3/bubble_data.json').then(response => response.json())
        ]);

        const data = d3.csvParse(csvText);
        const processedData = processData(data);
        setPopulationData(popData);
        setBubbleData(bubData);
        setRawData(csvText);
        drawMainView(processedData, popData, bubData);

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
    const mainElement = mainRef.current;
    if (mainElement) {
      mainElement.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (mainElement) {
        mainElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel, showDetailView]); // 添加showDetailView作为依赖项

  // 当页码改变时重新绘制图表
  useEffect(() => {
    // 如果正在显示下钻视图，不重新绘制主视图
    if (showDetailView) return;
    
    if (bubbleData && populationData) {
      const loadAndDrawData = async () => {
        try {
          const csvText = await fetch('/data/problem3/物产数据_按朝代排序.csv').then(res => res.text());
          const data = d3.csvParse(csvText);
          const processedData = processData(data);
          drawMainView(processedData, populationData, bubbleData);
        } catch (error) {
          console.error('重新绘制图表时出错：', error);
        }
      };

      loadAndDrawData();
    }
  }, [currentPage, bubbleData, populationData, searchTerm, showDetailView]); // 添加showDetailView依赖

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
            onClose={handleCloseDetailView}
            isEmbedded={true}
          />
        </div>
      )}
    </div>
  );
};

export default ProductVis; 