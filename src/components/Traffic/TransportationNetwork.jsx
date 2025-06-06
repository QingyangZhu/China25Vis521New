import React, { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useDynastyStore from '../../store/dynastyStore';
import './TransportationNetwork.css';

// 修复leaflet默认图标问题
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const TransportationNetwork = () => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const layersRef = useRef({});
  const markersRef = useRef([]);
  const linesRef = useRef([]);
  const routeLinesMapRef = useRef(new Map()); // 存储路线ID到polyline的映射
  
  const [routeData, setRouteData] = useState([]);
  const [detailData, setDetailData] = useState([]);
  const [selectedDynasty, setSelectedDynasty] = useState('宋-北宋');
  const [loading, setLoading] = useState(true);
  const [mapLayers, setMapLayers] = useState({
    modern: true,
    historical: true,
    satellite: false
  });
  const [historicalOpacity, setHistoricalOpacity] = useState(0.36);
  const [mapInitialized, setMapInitialized] = useState(false);
  const { selectedDynasties, getSelectedDisplayNames, selectedRoute, selectedRoutes, showAllRoutes } = useDynastyStore();

  // 添加组件挂载调试
  useEffect(() => {
    console.log('🚀 TransportationNetwork 组件已挂载');
    console.log('当前 mapContainerRef:', mapContainerRef.current);
    
    return () => {
      console.log('🔚 TransportationNetwork 组件将卸载');
    };
  }, []);

  // 监听 mapContainerRef 变化
  useEffect(() => {
    console.log('📍 mapContainerRef 发生变化:', mapContainerRef.current);
    if (mapContainerRef.current) {
      console.log('✅ 地图容器已获取到，元素详情:', {
        tagName: mapContainerRef.current.tagName,
        className: mapContainerRef.current.className,
        id: mapContainerRef.current.id,
        offsetParent: mapContainerRef.current.offsetParent,
        isConnected: mapContainerRef.current.isConnected
      });
    }
  }, [mapContainerRef.current]);

  // 系统主题颜色调色板
  const systemColorPalette = useMemo(() => [
    '#8C6D46', // 主题棕色
    '#A0522D', // 深棕色
    '#CD853F', // 秘鲁色
    '#DEB887', // 浅棕色
    '#F4A460', // 沙棕色
    '#D2691E', // 巧克力色
    '#B8860B', // 暗金色
    '#DAA520', // 金色
    '#BC8F8F', // 玫瑰棕
    '#8FBC8F', // 暗海绿
    '#708090', // 石板灰
    '#696969', // 暗灰色
    '#778899', // 浅石板灰
    '#2F4F4F', // 暗石板灰
    '#556B2F', // 暗橄榄绿
    '#A0522D', // 马鞍棕
    '#8B4513', // 马鞍棕
    '#6B8E23', // 橄榄色
    '#9ACD32', // 黄绿色
    '#32CD32'  // 酸橙绿
  ], []);

  // 历史地图图层配置 - 基于实际KML文件
  const historicalMaps = useMemo(() => {
    // 朝代名称到KML文件映射
    const dynastyToKmlMapping = {
      // 有KML文件的朝代
      '商': '商時期地圖',
      '先秦-春秋': '春秋時期地圖', 
      '先秦-战国': '戰國時期地圖',
      '秦': '秦代歷史地圖(Qin)',
      '汉-西汉': '西漢歷史地圖(W. Han)',
      '汉-东汉': '東漢歷史地圖(E. Han)',
      '三国': '三國歷史地圖(Sanguo)',
      '西晋': '西晉歷史地圖(W. Jing)',
      '东晋': '東晉歷史地圖(E. Jing)',
      '南朝': '南北朝歷史地圖(South and North)',
      '北朝': '南北朝歷史地圖(South and North)',
      '隋': '隋代歷史地圖(Sui)',
      '唐': '唐代歷史地圖(Tang)',
      '宋-北宋': '北宋歷史地圖(N. Song)',
      '宋-南宋': '南宋歷史地圖(S. Song)',
      '元': '元代歷史地圖(Yuan)',
      '明': '明代歷史地圖(Ming)',
      '清': '清代歷史地圖(Qing)'
    };

    // 从KML文件获取的实际URL映射
    const kmlUrlMapping = {
      '商時期地圖': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=shang-png-{z}-{x}-{y}',
      '春秋時期地圖': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=spring_autumn-png-{z}-{x}-{y}',
      '戰國時期地圖': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=warring_states-png-{z}-{x}-{y}',
      '秦代歷史地圖(Qin)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=bc0210-png-{z}-{x}-{y}',
      '西漢歷史地圖(W. Han)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=bc0007-png-{z}-{x}-{y}',
      '東漢歷史地圖(E. Han)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0140-png-{z}-{x}-{y}',
      '三國歷史地圖(Sanguo)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0262-png-{z}-{x}-{y}',
      '西晉歷史地圖(W. Jing)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0281-png-{z}-{x}-{y}',
      '東晉歷史地圖(E. Jing)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0382-png-{z}-{x}-{y}',
      '南北朝歷史地圖(South and North)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0497-png-{z}-{x}-{y}',
      '隋代歷史地圖(Sui)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0612-png-{z}-{x}-{y}',
      '唐代歷史地圖(Tang)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad0741-png-{z}-{x}-{y}',
      '北宋歷史地圖(N. Song)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad1111-png-{z}-{x}-{y}',
      '南宋歷史地圖(S. Song)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad1208-png-{z}-{x}-{y}',
      '元代歷史地圖(Yuan)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad1330-png-{z}-{x}-{y}',
      '明代歷史地圖(Ming)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad1582-png-{z}-{x}-{y}',
      '清代歷史地圖(Qing)': 'https://gis.sinica.edu.tw/ccts/file-exists.php?img=ad1820-png-{z}-{x}-{y}'
    };

    // 构建最终的历史地图配置
    const maps = {};
    
    // 为有KML文件的朝代配置真实URL
    Object.entries(dynastyToKmlMapping).forEach(([dynasty, kmlName]) => {
      if (kmlUrlMapping[kmlName]) {
        maps[dynasty] = {
          url: kmlUrlMapping[kmlName],
          name: kmlName,
          attribution: `${kmlName} | 中研院`
        };
      }
    });

    // 为其他朝代配置备用URL（使用相近时期的地图）
    const fallbackMaps = {
      '上古': maps['商'] || null,
      '远古': maps['商'] || null,
      '夏': maps['商'] || null,
      '先秦': maps['先秦-春秋'] || null,
      '先秦-西周': maps['先秦-春秋'] || null,
      '先秦-东周': maps['先秦-春秋'] || null,
      '汉': maps['汉-西汉'] || null,
      '十六国': maps['东晋'] || null,
      '北朝-北魏': maps['北朝'] || null,
      '北朝-东魏': maps['北朝'] || null,
      '北朝-西魏': maps['北朝'] || null,
      '北朝-北齐': maps['北朝'] || null,
      '北朝-北周': maps['北朝'] || null,
      '五代十国': maps['唐'] || null,
      '宋': maps['宋-北宋'] || null,
      '辽': maps['宋-北宋'] || null,
      '金': maps['宋-南宋'] || null,
      '近代': maps['清'] || null,
      '近代-民国': maps['清'] || null,
      '现代': maps['清'] || null
    };

    // 合并所有配置
    return { ...maps, ...fallbackMaps };
  }, []);

  // 判断经纬度是否在中国境内
  const isInChina = (longitude, latitude) => {
    return longitude >= 73 && longitude <= 135 && latitude >= 18 && latitude <= 54;
  };

  // 创建平滑曲线的函数
  const createSmoothCurve = (coordinates) => {
    // 首先验证输入坐标的有效性
    const validCoordinates = coordinates.filter(coord => {
      return Array.isArray(coord) && 
            coord.length >= 2 && 
            !isNaN(coord[0]) && !isNaN(coord[1]) && 
            isFinite(coord[0]) && isFinite(coord[1]);
    });
    
    if (validCoordinates.length < 2) return [];
    
    if (validCoordinates.length === 2) {
      // 对于只有两个点的情况，添加一个中间点来创建轻微的弧形
      const start = validCoordinates[0];
      const end = validCoordinates[1];
      
      // 验证起点和终点
      if (start[0] === end[0] && start[1] === end[1]) {
        return [start]; // 如果是同一个点，只返回一个点
      }
      
      const midLat = (start[0] + end[0]) / 2;
      const midLng = (start[1] + end[1]) / 2;
      
      // 计算距离，避免除零错误
      const distance = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
      
      if (distance === 0 || !isFinite(distance)) {
        return [start]; // 如果距离为0或无效，只返回起点
      }
      
      // 添加轻微的偏移来创建弧形效果
      const offset = distance * 0.1; // 偏移量为距离的10%
      
      // 计算垂直方向的偏移，确保不会产生NaN
      const perpLat = -(end[1] - start[1]) / distance * offset;
      const perpLng = (end[0] - start[0]) / distance * offset;
      
      // 验证计算结果
      const midPoint = [midLat + perpLat, midLng + perpLng];
      if (isNaN(midPoint[0]) || isNaN(midPoint[1]) || !isFinite(midPoint[0]) || !isFinite(midPoint[1])) {
        return [start, end]; // 如果中点计算失败，返回原始两点
      }
      
      return [start, midPoint, end];
    }

    const smoothCoordinates = [];
    
    for (let i = 0; i < validCoordinates.length - 1; i++) {
      const current = validCoordinates[i];
      const next = validCoordinates[i + 1];
      
      smoothCoordinates.push(current);
      
      // 在每两个点之间添加插值点来创建平滑效果
      const segments = 3; // 每段分成3个子段
      for (let j = 1; j < segments; j++) {
        const t = j / segments;
        
        // 使用贝塞尔曲线插值
        let controlLat = current[0];
        let controlLng = current[1];
        
        // 如果有前一个点，使用它来计算控制点
        if (i > 0) {
          const prev = validCoordinates[i - 1];
          controlLat += (current[0] - prev[0]) * 0.2;
          controlLng += (current[1] - prev[1]) * 0.2;
        }
        
        // 如果有后续点，也考虑它
        if (i < validCoordinates.length - 2) {
          const afterNext = validCoordinates[i + 2];
          controlLat += (afterNext[0] - next[0]) * 0.1;
          controlLng += (afterNext[1] - next[1]) * 0.1;
        }
        
        // 计算插值点
        const lat = current[0] * (1 - t) * (1 - t) + 2 * controlLat * (1 - t) * t + next[0] * t * t;
        const lng = current[1] * (1 - t) * (1 - t) + 2 * controlLng * (1 - t) * t + next[1] * t * t;
        
        // 验证插值结果
        if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
          smoothCoordinates.push([lat, lng]);
        }
      }
    }
    
    // 添加最后一个点
    if (validCoordinates.length > 0) {
      smoothCoordinates.push(validCoordinates[validCoordinates.length - 1]);
    }
    
    // 最终验证所有坐标
    return smoothCoordinates.filter(coord => 
      !isNaN(coord[0]) && !isNaN(coord[1]) && 
      isFinite(coord[0]) && isFinite(coord[1])
    );
  };

  // 地图初始化函数
  const initMap = () => {
    console.log('=== 开始地图初始化流程 ===');
    console.log('mapContainerRef.current:', mapContainerRef.current);
    console.log('mapRef.current:', mapRef.current);
    
    if (!mapContainerRef.current) {
      console.log('❌ 地图容器未找到，延时重试...');
      setTimeout(initMap, 500);
      return;
    }
    
    if (mapRef.current) {
      console.log('⚠️ 地图已存在，跳过初始化');
      return;
    }

    try {
      console.log('=== 开始创建Leaflet地图实例 ===');
      
      const container = mapContainerRef.current;
      console.log('容器元素:', container);
      console.log('容器样式:', window.getComputedStyle(container));
      console.log('容器尺寸:', {
        width: container?.offsetWidth,
        height: container?.offsetHeight,
        clientWidth: container?.clientWidth,
        clientHeight: container?.clientHeight,
        scrollWidth: container?.scrollWidth,
        scrollHeight: container?.scrollHeight
      });
      
      // 检查容器是否有有效尺寸
      if (!container?.offsetWidth || !container?.offsetHeight) {
        console.error('❌ 地图容器尺寸无效，尝试设置固定尺寸');
        container.style.width = '100%';
        container.style.height = '500px';
        container.style.minHeight = '500px';
        console.log('设置固定尺寸后:', {
          width: container.offsetWidth,
          height: container.offsetHeight
        });
      }
      
      // 检查Leaflet是否可用
      console.log('Leaflet对象:', L);
      if (!L || !L.map) {
        console.error('❌ Leaflet库未正确加载');
        return;
      }
      
      console.log('✅ 开始创建地图实例...');
      
      // 创建地图实例
      const map = L.map(container, {
        center: [39.9042, 116.4074],
        zoom: 5,
        maxBounds: [
          [16.957, 65.266],  // 南西
          [59.376, 145.437]  // 北东
        ],
        maxBoundsViscosity: 1.0,
        // 禁用attribution控件
        attributionControl: false,
        // 防止地图事件干扰UI
        keyboard: false,
        doubleClickZoom: true,
        boxZoom: true,
        tap: false,
        touchZoom: true,
        scrollWheelZoom: true,
        dragging: true
      });

      console.log('✅ 地图实例创建成功:', map);
      
      // 立即更新引用和状态
      mapRef.current = map;
      
      // 使用 React 的状态更新回调确保状态同步
      setMapInitialized(() => {
        console.log('🎉 地图初始化状态已更新为 true');
        return true;
      });

      // 添加现代地图图层（高德地图）
      console.log('添加现代地图图层...');
      const modernLayer = L.tileLayer('https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        maxZoom: 18
      });
      
      // 添加卫星图层
      const satelliteLayer = L.tileLayer('https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', {
        maxZoom: 18
      });

      layersRef.current = {
        modern: modernLayer,
        satellite: satelliteLayer,
        historical: null
      };

      // 默认添加现代地图
      modernLayer.addTo(map);
      console.log('✅ 现代地图图层已添加');

      // 监听图层加载事件
      modernLayer.on('loading', () => {
        console.log('🔄 图层开始加载...');
      });
      
      modernLayer.on('load', () => {
        console.log('✅ 图层加载完成');
      });
      
      modernLayer.on('tileerror', (e) => {
        console.error('❌ 图层加载错误:', e);
      });

      // 添加地图事件监听 - 确保不干扰UI
      map.on('click', (e) => {
        console.log('🗺️ 地图点击:', e.latlng);
        // 阻止事件冒泡到document
        e.originalEvent.stopPropagation();
      });
      
      map.on('mousedown', (e) => {
        // 阻止地图拖拽时干扰UI
        e.originalEvent.stopPropagation();
      });

      // 强制地图重新计算尺寸
      setTimeout(() => {
        if (map) {
          console.log('重新计算地图尺寸...');
          map.invalidateSize();
          console.log('✅ 地图尺寸重新计算完成');
          
          // 检查地图容器状态
          const mapContainer = map.getContainer();
          console.log('地图容器状态:', {
            container: mapContainer,
            size: map.getSize(),
            center: map.getCenter(),
            zoom: map.getZoom()
          });
          
          // 再次确认状态已正确设置
          console.log('🔍 最终状态检查:', {
            'mapRef.current': !!mapRef.current,
            'mapInitialized': mapInitialized
          });
        }
      }, 100);

      // 添加地图事件监听
      map.on('ready', () => {
        console.log('✅ 地图准备完成');
      });
      
      map.on('load', () => {
        console.log('✅ 地图加载完成');
      });

    } catch (error) {
      console.error('❌ 地图初始化失败:', error);
      console.error('错误堆栈:', error.stack);
      setMapInitialized(false);
    }
  };

  // 初始化地图
  useEffect(() => {
    console.log('🎯 地图初始化 useEffect 被触发');
    
    // 只有在地图未初始化且容器存在时才初始化
    if (!mapRef.current && mapContainerRef.current) {
      console.log('设置延时初始化...');
      const timer = setTimeout(initMap, 300);
      return () => clearTimeout(timer);
    } else if (mapRef.current) {
      console.log('✅ 地图已存在，跳过初始化');
    } else {
      console.log('⏳ 等待地图容器就绪...');
      // 如果容器还没准备好，设置较短的重试
      const timer = setTimeout(() => {
        if (mapContainerRef.current && !mapRef.current) {
          initMap();
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    // 清理函数仅在组件真正卸载时执行
    return () => {
      console.log('=== 地图组件清理 ===');
      if (mapRef.current) {
        console.log('清理地图实例');
        mapRef.current.remove();
        mapRef.current = null;
        setMapInitialized(false);
      }
    };
  }, []); // 移除容器引用依赖，避免警告

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        console.log('开始加载交通数据...');
        
        // 加载路线汇总数据
        const routeResponse = await fetch('/data/problem3/交通路线汇总.csv');
        const routeText = await routeResponse.text();
        const routeLines = routeText.split('\n').slice(1);
        
        const routeData = routeLines
          .filter(line => line.trim())
          .map(line => {
            const columns = line.split(',');
            return {
              route_id: columns[0],
              dynasty: columns[1],
              exact_year: columns[2],
              route_name: columns[3],
              transport_tool: columns[4],
              transport_route: columns[5],
              total_places: parseInt(columns[6]) || 0,
              found_places: parseInt(columns[7]) || 0,
              completion_rate: columns[8],
              all_places_found: columns[9] === 'True',
              original_text: columns[10]
            };
          });

        // 加载详细地点数据
        const detailResponse = await fetch('/data/problem3/交通路线地点详细.csv');
        const detailText = await detailResponse.text();
        const detailLines = detailText.split('\n').slice(1);
        
        const detailData = detailLines
          .filter(line => line.trim())
          .map(line => {
            const columns = line.split(',');
            return {
              route_id: columns[0],
              dynasty: columns[1],
              exact_year: columns[2],
              route_name: columns[3],
              place_name: columns[4],
              latitude: isNaN(parseFloat(columns[5])) ? 0 : parseFloat(columns[5]),
              longitude: isNaN(parseFloat(columns[6])) ? 0 : parseFloat(columns[6]),
              place_type: columns[7],
              place_years: columns[8],
              place_parent: columns[9],
              data_source: columns[10],
              order_in_route: parseInt(columns[11]) || 0,
              status: columns[12],
              search_strategy: columns[13]
            };
          });

        setRouteData(routeData);
        setDetailData(detailData);
        setLoading(false);
        
        // 调试：显示实际的朝代列表
        const actualDynasties = [...new Set(routeData.map(route => route.dynasty))].sort();
        console.log('📊 数据加载完成，实际朝代列表:', actualDynasties);
        console.log('🗺️ 已配置历史地图的朝代:', Object.keys(historicalMaps).sort());
        
        // 检查哪些朝代没有历史地图配置
        const missingMaps = actualDynasties.filter(dynasty => !historicalMaps[dynasty]);
        if (missingMaps.length > 0) {
          console.warn('⚠️ 以下朝代缺少历史地图配置:', missingMaps);
        } else {
          console.log('✅ 所有朝代都已配置历史地图');
        }
        
        console.log('交通数据加载完成', { routes: routeData.length, details: detailData.length });
      } catch (error) {
        console.error('Error loading transportation data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 获取可用的朝代列表
  const availableDynasties = useMemo(() => {
    const dynasties = [...new Set(routeData.map(route => route.dynasty))];
    return ['全部', ...dynasties.sort()];
  }, [routeData]);

  // 过滤数据基于选中的朝代和显示模式
  const filteredData = useMemo(() => {
    let filteredRoutes, filteredDetails;
    
    // 首先按朝代过滤
    if (selectedDynasty === '全部') {
      filteredRoutes = routeData;
      filteredDetails = detailData;
    } else {
      filteredRoutes = routeData.filter(route => route.dynasty === selectedDynasty);
      const routeIds = new Set(filteredRoutes.map(route => route.route_id));
      filteredDetails = detailData.filter(detail => routeIds.has(detail.route_id));
    }
    
    // 然后根据显示模式进一步过滤
    if (!showAllRoutes && selectedRoutes.length > 0) {
      // 仅显示选中的路线
      const selectedRouteNames = selectedRoutes
        .filter(r => r.dynasty === selectedDynasty)
        .map(r => r.routeName);
      
      if (selectedRouteNames.length > 0) {
        filteredRoutes = filteredRoutes.filter(route => 
          selectedRouteNames.includes(route.route_name)
        );
        const selectedRouteIds = new Set(filteredRoutes.map(route => route.route_id));
        filteredDetails = filteredDetails.filter(detail => 
          selectedRouteIds.has(detail.route_id)
        );
        
        console.log('🎯 仅显示选中路线:', selectedRouteNames, `过滤后剩余 ${filteredRoutes.length} 条路线`);
      }
    }
    
    return { routes: filteredRoutes, details: filteredDetails };
  }, [routeData, detailData, selectedDynasty, showAllRoutes, selectedRoutes]);

  // 路线颜色映射
  const routeColorMapping = useMemo(() => {
    const mapping = new Map();
    let colorIndex = 0;
    
    // 按朝代分组路线
    const dynastyRoutes = {};
    filteredData.routes.forEach(route => {
      if (!dynastyRoutes[route.dynasty]) {
        dynastyRoutes[route.dynasty] = [];
      }
      dynastyRoutes[route.dynasty].push(route.route_id);
    });
    
    // 为每个朝代的路线分配不同颜色
    Object.entries(dynastyRoutes).forEach(([dynasty, routes]) => {
      routes.forEach((routeId, index) => {
        // 确保同一朝代内的路线使用不同颜色
        const color = systemColorPalette[(colorIndex + index) % systemColorPalette.length];
        mapping.set(routeId, color);
      });
      // 每个朝代结束后，调整颜色索引以避免相邻朝代颜色太相似
      colorIndex += routes.length + 1;
    });
    
    return mapping;
  }, [filteredData.routes, systemColorPalette]);

  // 获取当前朝代的历史地图配置
  const currentHistoricalMap = useMemo(() => {
    if (selectedDynasty === '全部') return null;
    
    // 直接匹配朝代名称
    if (historicalMaps[selectedDynasty]) {
      console.log(`🗺️ 找到朝代 "${selectedDynasty}" 的历史地图:`, historicalMaps[selectedDynasty]);
      return historicalMaps[selectedDynasty];
    }
    
    // 如果没有直接匹配，记录并返回null
    console.log(`⚠️ 朝代 "${selectedDynasty}" 没有对应的历史地图配置`);
    return null;
  }, [selectedDynasty, historicalMaps]);

  // 更新历史地图图层
  useEffect(() => {
    if (!mapRef.current) {
      console.log('❌ 地图实例不存在，跳过历史地图更新');
      return;
    }

    console.log(`🔄 更新历史地图图层，当前朝代: "${selectedDynasty}"`);
    console.log('当前历史地图配置:', currentHistoricalMap);
    console.log('地图图层状态:', mapLayers);

    // 移除旧的历史地图图层
    if (layersRef.current.historical) {
      console.log('🗑️ 移除旧的历史地图图层');
      mapRef.current.removeLayer(layersRef.current.historical);
      layersRef.current.historical = null;
    }

    // 添加新的历史地图图层
    if (currentHistoricalMap && mapLayers.historical) {
      console.log(`✅ 添加新的历史地图图层: ${currentHistoricalMap.name}`);
      console.log('图层URL模板:', currentHistoricalMap.url);
      
      const historicalLayer = L.tileLayer(currentHistoricalMap.url, {
        minZoom: 0,
        maxZoom: 19,
        opacity: historicalOpacity,
        bounds: [
          [16.957, 65.266],
          [59.376, 145.437]
        ]
      });
      
      // 监听图层加载事件
      historicalLayer.on('loading', () => {
        console.log(`🔄 历史地图图层开始加载: ${currentHistoricalMap.name}`);
      });
      
      historicalLayer.on('load', () => {
        console.log(`✅ 历史地图图层加载完成: ${currentHistoricalMap.name}`);
      });
      
      historicalLayer.on('tileerror', (e) => {
        console.error(`❌ 历史地图图层加载错误: ${currentHistoricalMap.name}`, e);
      });
      
      historicalLayer.addTo(mapRef.current);
      layersRef.current.historical = historicalLayer;
      
      console.log(`🎉 历史地图图层已添加到地图: ${currentHistoricalMap.name}`);
    } else if (!currentHistoricalMap) {
      console.log(`⚠️ 朝代 "${selectedDynasty}" 没有对应的历史地图配置`);
    } else if (!mapLayers.historical) {
      console.log('ℹ️ 历史地图图层已被用户关闭');
    }
  }, [currentHistoricalMap, mapLayers.historical, historicalOpacity, selectedDynasty]);

  // 控制图层显示/隐藏
  useEffect(() => {
    if (!mapRef.current) return;

    // 控制现代地图
    if (mapLayers.modern && layersRef.current.modern && !mapRef.current.hasLayer(layersRef.current.modern)) {
      layersRef.current.modern.addTo(mapRef.current);
    } else if (!mapLayers.modern && layersRef.current.modern && mapRef.current.hasLayer(layersRef.current.modern)) {
      mapRef.current.removeLayer(layersRef.current.modern);
    }

    // 控制卫星图
    if (mapLayers.satellite && layersRef.current.satellite && !mapRef.current.hasLayer(layersRef.current.satellite)) {
      layersRef.current.satellite.addTo(mapRef.current);
    } else if (!mapLayers.satellite && layersRef.current.satellite && mapRef.current.hasLayer(layersRef.current.satellite)) {
      mapRef.current.removeLayer(layersRef.current.satellite);
    }
  }, [mapLayers]);

  // 清除地图上的标记和线条
  const clearMapElements = () => {
    if (!mapRef.current) return;

    // 清除标记
    markersRef.current.forEach(marker => {
      mapRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    // 清除线条
    linesRef.current.forEach(line => {
      mapRef.current.removeLayer(line);
    });
    linesRef.current = [];
    
    // 清除路线映射
    routeLinesMapRef.current.clear();
  };

  // 更新选中路线样式（不重新绘制整个地图）
  const updateSelectedRouteStyle = () => {
    if (!mapRef.current || !selectedRoute) return;

    console.log('🎨 更新选中路线样式:', selectedRoute);
    console.log('🗺️ 当前地图中的所有路线键值:', Array.from(routeLinesMapRef.current.keys()));
    
    // 重置所有路线样式
    routeLinesMapRef.current.forEach((polylineInfo, routeKey) => {
      const { polyline, originalStyle } = polylineInfo;
      polyline.setStyle({
        color: originalStyle.color,
        weight: originalStyle.weight,
        opacity: originalStyle.opacity,
        dashArray: ''
      });
    });

    // 尝试多种匹配方式
    const selectedKey = `${selectedRoute.dynasty}_${selectedRoute.routeName}`;
    console.log('🔍 尝试匹配的键值:', selectedKey);
    
    let selectedPolylineInfo = routeLinesMapRef.current.get(selectedKey);
    
    // 如果直接匹配失败，尝试模糊匹配
    if (!selectedPolylineInfo) {
      console.log('🔍 直接匹配失败，尝试模糊匹配...');
      for (const [routeKey, polylineInfo] of routeLinesMapRef.current.entries()) {
        console.log('检查路线键值:', routeKey, '路线名称:', polylineInfo.routeName);
        if (polylineInfo.routeName === selectedRoute.routeName && 
            polylineInfo.dynasty === selectedRoute.dynasty) {
          selectedPolylineInfo = polylineInfo;
          console.log('✅ 模糊匹配成功:', routeKey);
          break;
        }
        // 尝试路线名称的部分匹配
        if (polylineInfo.routeName.includes(selectedRoute.routeName) || 
            selectedRoute.routeName.includes(polylineInfo.routeName)) {
          selectedPolylineInfo = polylineInfo;
          console.log('✅ 部分匹配成功:', routeKey);
          break;
        }
      }
    }
    
    if (selectedPolylineInfo) {
      const { polyline, originalStyle } = selectedPolylineInfo;
      polyline.setStyle({
        color: '#FF6B35', // 选中路线使用橙红色高亮
        weight: originalStyle.weight + 2,
        opacity: 1,
        dashArray: '5, 5' // 选中路线使用虚线样式
      });
      console.log('✅ 选中路线样式已更新:', selectedRoute.routeName);
    } else {
      console.log('❌ 未找到匹配的路线:', selectedRoute);
      console.log('📋 可用的路线列表:');
      routeLinesMapRef.current.forEach((polylineInfo, routeKey) => {
        console.log(`  - ${routeKey}: ${polylineInfo.routeName} (${polylineInfo.dynasty})`);
      });
    }
  };

  // 更新地图上的交通路网
  useEffect(() => {
    if (!mapRef.current || loading) {
      console.log('🔄 地图或数据未准备好，跳过路网更新', { 
        mapExists: !!mapRef.current, 
        loading, 
        dataLength: filteredData.details.length 
      });
      return;
    }

    if (filteredData.details.length === 0) {
      console.log('🧹 清除地图元素（无数据）');
      clearMapElements();
      return;
    }

    console.log('🔄 更新地图路网，选中路线:', selectedRoute?.routeName);

    clearMapElements();

    // 创建节点标记（地点）
    const nodeMap = new Map();
    
    filteredData.details.forEach(detail => {
      // 过滤掉无效的经纬度 - 更严格的检查
      const lat = detail.latitude;
      const lng = detail.longitude;
      if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng) ||
          (lat === 0 && lng === 0) ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return;
      }
      
      const key = `${detail.latitude},${detail.longitude}`;
      if (!nodeMap.has(key)) {
        const isOverseas = !isInChina(detail.longitude, detail.latitude);
        
        nodeMap.set(key, {
          name: detail.place_name,
          dynasty: detail.dynasty,
          isOverseas,
          routes: [detail.route_id],
          routeNames: [detail.route_name]
        });
      } else {
        // 如果节点已存在，添加路线信息
        const node = nodeMap.get(key);
        if (!node.routes.includes(detail.route_id)) {
          node.routes.push(detail.route_id);
          node.routeNames.push(detail.route_name);
        }
      }
    });

    // 为每个节点创建标记
    nodeMap.forEach((nodeInfo, key) => {
      const [lat, lng] = key.split(',').map(parseFloat);
      
      // 使用节点的第一条路线的颜色作为节点颜色
      const primaryRouteId = nodeInfo.routes[0];
      const color = routeColorMapping.get(primaryRouteId) || '#8C6D46';
      
      // 判断是否是重要节点（多条路线交汇）
      const isImportantNode = nodeInfo.routes.length > 1;
        
        // 创建自定义图标
        const iconHtml = `
        <div class="${isImportantNode ? 'node-pulse' : ''}" style="
          width: ${nodeInfo.isOverseas ? 10 : 8}px;
          height: ${nodeInfo.isOverseas ? 10 : 8}px;
            background-color: ${color};
          border: ${nodeInfo.isOverseas ? '1px solid #FF4444' : '1px solid white'};
            border-radius: 50%;
            box-shadow: 0 1px 2px rgba(0,0,0,0.3);
          transition: all 0.3s ease;
          cursor: pointer;
          "></div>
        `;
        
        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-marker',
        iconSize: [nodeInfo.isOverseas ? 10 : 8, nodeInfo.isOverseas ? 10 : 8],
        iconAnchor: [nodeInfo.isOverseas ? 5 : 4, nodeInfo.isOverseas ? 5 : 4]
        });

      const marker = L.marker([lat, lng], {
          icon: customIcon
        });

      // 添加节点悬停效果
      marker.on('mouseover', function() {
        const iconElement = this.getElement().querySelector('div');
        if (iconElement) {
          iconElement.style.transform = 'scale(1.3)';
          iconElement.style.zIndex = '1000';
        }
      });
      
      marker.on('mouseout', function() {
        const iconElement = this.getElement().querySelector('div');
        if (iconElement) {
          iconElement.style.transform = 'scale(1)';
          iconElement.style.zIndex = '';
        }
      });

      const locationInfo = nodeInfo.isOverseas ? '（海外地点）' : '（中国境内）';
      const routesList = [...new Set(nodeInfo.routeNames)].join(', ');
      const routeCount = nodeInfo.routes.length;
      const importanceInfo = routeCount > 1 ? `<br/><strong>重要交通枢纽（${routeCount}条路线交汇）</strong>` : '';
      
      marker.bindPopup(`
        <div style="font-family: 'Noto Serif SC', serif;">
          <strong>${nodeInfo.name}</strong>${locationInfo}${importanceInfo}<br/>
          朝代: ${nodeInfo.dynasty}<br/>
          相关路线: ${routesList}
        </div>
      `);
      
      marker.addTo(mapRef.current);
      markersRef.current.push(marker);
    });

    // 处理地点数据，按路线分组
    const routeGroups = {};
    filteredData.details.forEach(detail => {
      if (!routeGroups[detail.route_id]) {
        routeGroups[detail.route_id] = [];
      }
      routeGroups[detail.route_id].push(detail);
    });

    // 创建线条（路线）
    Object.entries(routeGroups).forEach(([routeId, routePoints]) => {
      if (routePoints.length < 2) return;
      
    // 过滤掉无效的经纬度 - 更严格的检查
    routePoints = routePoints.filter(point => {
      const lat = point.latitude;
      const lng = point.longitude;
      // 检查是否为有效数字且不为0且在合理范围内
      return !isNaN(lat) && !isNaN(lng) && 
            isFinite(lat) && isFinite(lng) &&
            !(lat === 0 && lng === 0) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180;
    });

    if (routePoints.length < 2) return;

    // 按顺序排序
    routePoints.sort((a, b) => a.order_in_route - b.order_in_route);

    const dynasty = routePoints[0].dynasty;
    const routeName = routePoints[0].route_name;
    const color = routeColorMapping.get(routeId) || '#8C6D46';

    // 创建路线坐标数组 - 添加额外验证
    const coordinates = routePoints.map(point => [point.latitude, point.longitude])
      .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]) && isFinite(coord[0]) && isFinite(coord[1]));

    // 再次检查过滤后的坐标数组
    if (coordinates.length < 2) return;
      
      // 检查是否是国际路线
      const isInternational = routePoints.some(point => !isInChina(point.longitude, point.latitude));
      
      // // 创建平滑曲线
      // const smoothCoordinates = createSmoothCurve(coordinates);

      // // 最终验证平滑坐标
      // if (smoothCoordinates.length < 2) {
      //   console.warn(`路线 ${routeId} 的平滑坐标少于2个点，跳过创建`);
      //   return;
      // }

      // // 再次验证所有坐标都是有效的
      // const finalCoordinates = smoothCoordinates.filter(coord => 
      //   Array.isArray(coord) && coord.length >= 2 &&
      //   !isNaN(coord[0]) && !isNaN(coord[1]) && 
      //   isFinite(coord[0]) && isFinite(coord[1])
      // );

      // if (finalCoordinates.length < 2) {
      //   console.warn(`路线 ${routeId} 经过最终验证后坐标少于2个点，跳过创建`);
      //   return;
      // }

      // console.log(`创建路线 ${routeId}，坐标数量: ${finalCoordinates.length}`);

      // // 创建路线
      // const polyline = L.polyline(finalCoordinates, {
      // 直接使用直线连接，不需要平滑曲线
        console.log(`创建路线 ${routeId}，坐标数量: ${coordinates.length}`);

        // 创建路线（使用原始样式）
      const originalStyle = {
        color: color,
        weight: isInternational ? 2 : 1.5,
        opacity: isInternational ? 0.7 : 0.5
      };

      const polyline = L.polyline(coordinates, {
        ...originalStyle,
        dashArray: '',
        lineJoin: 'round',
        lineCap: 'round',
        smoothFactor: 1.0
      });

      // 保存路线引用供后续样式更新使用
      const routeKey = `${dynasty}_${routeName}`;
      console.log('📝 保存路线引用:', routeKey, '路线名称:', routeName, '朝代:', dynasty);
      routeLinesMapRef.current.set(routeKey, {
        polyline,
        originalStyle,
        routeName,
        dynasty,
        isInternational
      });
      
      // 添加路线悬停效果
      polyline.on('mouseover', function() {
        this.setStyle({
          weight: (isInternational ? 4 : 3) + 2,
          opacity: 1
        });
      });
      
      polyline.on('mouseout', function() {
        this.setStyle({
          weight: isInternational ? 4 : 3,
          opacity: isInternational ? 0.9 : 0.8
        });
      });
      
      const routeInfo = isInternational ? '（国际路线）' : '（境内路线）';
      polyline.bindPopup(`
        <div style="font-family: 'Noto Serif SC', serif;">
          <strong>${routeName}</strong>${routeInfo}<br/>
          朝代: ${dynasty}<br/>
          <small>点击路线查看详细信息</small>
        </div>
      `);
      
      polyline.addTo(mapRef.current);
      linesRef.current.push(polyline);
      
      // 创建沿路径移动的动画点
      createMovingMarker(coordinates, color, isInternational);
    });

    console.log('地图路网更新完成', { 
      markers: markersRef.current.length, 
      lines: linesRef.current.length,
      routeLines: routeLinesMapRef.current.size 
    });

    // 路网绘制完成后，应用选中路线样式
    if (selectedRoute) {
      setTimeout(() => updateSelectedRouteStyle(), 100);
    }
  }, [filteredData, loading, routeColorMapping]);

  // 监听选中路线变化，只更新样式，不重新绘制地图
  useEffect(() => {
    console.log('🎯 selectedRoute 发生变化:', selectedRoute);
    console.log('🗺️ 地图状态:', {
      mapExists: !!mapRef.current,
      routeCount: routeLinesMapRef.current.size,
      currentDynasty: selectedDynasty
    });
    
    if (mapRef.current && routeLinesMapRef.current.size > 0) {
      console.log('🎨 selectedRoute 变化，更新路线样式');
      updateSelectedRouteStyle();
    } else {
      console.log('⏳ 等待地图或路线数据准备完成...');
      // 延时重试
      const timer = setTimeout(() => {
        if (mapRef.current && routeLinesMapRef.current.size > 0 && selectedRoute) {
          console.log('🔄 延时重试更新选中路线样式');
          updateSelectedRouteStyle();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedRoute]);

  // 监听选中路线变化，自动切换到对应朝代
  useEffect(() => {
    if (selectedRoute && selectedRoute.dynasty && selectedRoute.dynasty !== selectedDynasty) {
      console.log('🎯 自动切换到选中路线的朝代:', selectedRoute.dynasty);
      setSelectedDynasty(selectedRoute.dynasty);
    }
  }, [selectedRoute, selectedDynasty]); // 添加selectedDynasty依赖

  // 朝代切换处理
  const handleDynastyChange = (dynasty) => {
    console.log('🔄 朝代切换:', dynasty);
    setSelectedDynasty(dynasty);
    
    // 调试：显示切换后的路线数据
    setTimeout(() => {
      console.log('🔍 朝代切换后的路线数据:');
      const dynastyRoutes = routeData.filter(route => route.dynasty === dynasty);
      console.log(`  - ${dynasty} 朝代共有 ${dynastyRoutes.length} 条路线`);
      dynastyRoutes.forEach(route => {
        console.log(`    * ${route.route_name} (ID: ${route.route_id})`);
      });
    }, 100);
  };

  // 图层控制处理
  const handleLayerToggle = (layerType) => {
    console.log('🔄 图层切换:', layerType);
    setMapLayers(prev => ({
      ...prev,
      [layerType]: !prev[layerType]
    }));
  };

  // 透明度控制处理
  const handleOpacityChange = (opacity) => {
    console.log('🔄 透明度调整:', opacity);
    setHistoricalOpacity(opacity);
    if (layersRef.current.historical) {
      layersRef.current.historical.setOpacity(opacity);
    }
  };

  // 防止地图事件干扰控制面板
  const handleControlClick = (e) => {
    e.stopPropagation();
  };

  // 创建沿路径移动的动画点
  const createMovingMarker = (path, color, isInternational) => {
    if (path.length < 2) return;
    
    // 创建移动点的图标
    const movingIcon = L.divIcon({
      html: `
        <div style="
          width: 8px;
          height: 8px;
          background-color: ${color};
          border: 1px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px ${color};
          animation: glow 1s ease-in-out infinite alternate;
        "></div>
      `,
      className: 'moving-marker',
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
    
    // 创建移动标记
    const movingMarker = L.marker(path[0], { icon: movingIcon });
    movingMarker.addTo(mapRef.current);
    
    // 动画参数
    const duration = isInternational ? 8000 : 6000; // 国际路线动画时间更长
    const startTime = Date.now();
    
    // 动画函数
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % duration) / duration;
      
      if (progress >= 1) {
        // 动画完成，重新开始
        setTimeout(() => animate(), 1000); // 1秒延迟后重新开始
        return;
      }
      
      // 计算当前位置
      const pathIndex = progress * (path.length - 1);
      const currentIndex = Math.floor(pathIndex);
      const nextIndex = Math.min(currentIndex + 1, path.length - 1);
      const segmentProgress = pathIndex - currentIndex;
      
      if (currentIndex < path.length - 1) {
        const currentPos = path[currentIndex];
        const nextPos = path[nextIndex];
        
        // 插值计算当前位置
        const lat = currentPos[0] + (nextPos[0] - currentPos[0]) * segmentProgress;
        const lng = currentPos[1] + (nextPos[1] - currentPos[1]) * segmentProgress;
        
        movingMarker.setLatLng([lat, lng]);
      }
      
      requestAnimationFrame(animate);
    };
    
    // 延迟启动动画，错开不同路线的动画时间
    const delay = Math.random() * 2000;
    setTimeout(() => animate(), delay);
    
    // 将移动标记添加到清理列表
    markersRef.current.push(movingMarker);
  };

  if (loading) {
    return (
      <div className="transportation-loading">
        <div className="loading-spinner"></div>
        <p>加载交通路网数据中...</p>
      </div>
    );
  }

  return (
    <div className="transportation-network">
      {/* 顶部控制区域：朝代选择 + 地图类型 */}
      <div 
        className="transportation-top-controls"
        onClick={handleControlClick}
        onMouseDown={handleControlClick}
        onMouseUp={handleControlClick}
      >
        <div className="dynasty-selector">
          <label>选择朝代:</label>
          <select 
            value={selectedDynasty} 
            onChange={(e) => {
              e.stopPropagation();
              handleDynastyChange(e.target.value);
            }}
            onFocus={(e) => e.stopPropagation()}
            onBlur={(e) => e.stopPropagation()}
            className="dynasty-select"
          >
            {availableDynasties.map(dynasty => (
              <option key={dynasty} value={dynasty}>{dynasty}</option>
            ))}
          </select>
        </div>
        
        <div 
          className="layer-controls"
          onClick={handleControlClick}
        >
          <label>
            <input 
              type="checkbox" 
              checked={mapLayers.modern}
              onChange={(e) => {
                e.stopPropagation();
                handleLayerToggle('modern');
              }}
              onClick={handleControlClick}
            />
            现代地图
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={mapLayers.historical}
              onChange={(e) => {
                e.stopPropagation();
                handleLayerToggle('historical');
              }}
              onClick={handleControlClick}
            />
            历史地图
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={mapLayers.satellite}
              onChange={(e) => {
                e.stopPropagation();
                handleLayerToggle('satellite');
              }}
              onClick={handleControlClick}
            />
            卫星图
          </label>
        </div>
        </div>
        
      {/* 中间地图区域 */}
      <div 
        ref={mapContainerRef}
        className="transportation-map"
        style={{ 
          width: '100%', 
          minHeight: '400px',
          backgroundColor: '#f0f0f0',
          position: 'relative'
        }}
      >
        {/* 地图容器状态指示 */}
        {!mapRef.current && !loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#666',
            fontSize: '16px',
            pointerEvents: 'none'
          }}>
            <div>🗺️ 正在初始化地图...</div>
            <div style={{ fontSize: '12px', marginTop: '8px' }}>
              请检查浏览器控制台获取详细信息
            </div>
          </div>
        )}
      </div>

      {/* 底部控制区域：透明度 + 统计信息 */}
      <div 
        className="transportation-bottom-controls"
        onClick={handleControlClick}
        onMouseDown={handleControlClick}
        onMouseUp={handleControlClick}
      >
        <div 
          className="opacity-control"
          onClick={handleControlClick}
        >
          <label>历史地图透明度:</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.1"
            value={historicalOpacity}
            onChange={(e) => {
              e.stopPropagation();
              handleOpacityChange(parseFloat(e.target.value));
            }}
            onMouseDown={handleControlClick}
            onMouseUp={handleControlClick}
          />
        </div>
        
        <div className="route-stats">
          <span>路线数量: {filteredData.routes.length}</span>
          <span>节点数量: {filteredData.details.length}</span>
          {/* <span>{currentHistoricalMap ? currentHistoricalMap.name : '无历史地图'}</span> */}
        </div>
      </div>
    </div>
  );
};

export default TransportationNetwork; 