// src/components/GeoChart.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import Papa from 'papaparse';
import './GeoChart.css'; 
import 'leaflet/dist/leaflet.css';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent, TitleComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import useDynastyStore from '../store/dynastyStore';

echarts.use([PieChart, TooltipComponent, TitleComponent, LegendComponent, CanvasRenderer]);

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ICON_BASE_PATH = '/icons/';
const BASE_SVG_ICON_SIZE = [28, 28];

const createSvgIcon = (iconUrl, sizeArray) => {
  const [width, height] = sizeArray;
  return L.icon({
    iconUrl: iconUrl, iconSize: [width, height], iconAnchor: [width / 2, height], popupAnchor: [0, -height],      
  });
};

const warIcon = createSvgIcon(`${ICON_BASE_PATH}war.png`, BASE_SVG_ICON_SIZE);
const disasterIcon = createSvgIcon(`${ICON_BASE_PATH}disaster.png`, BASE_SVG_ICON_SIZE);
const eventIcon = createSvgIcon(`${ICON_BASE_PATH}event.png`, BASE_SVG_ICON_SIZE);

const CHART_CONTAINER_HEIGHT = '190px'; 

// 古典风格配色方案 - 基于中国传统色彩的浅色调
const ATTRIBUTE_COLORS = {
  'regime_change': '#E8C4A0',        // 浅朱砂色 - 政权更替
  'urban_reconstruction': '#D4C2A0', // 浅赭石色 - 城市重建
  'urban_expansion': '#F0E4B8',      // 浅藤黄色 - 城市扩建
  'population_change_positive': '#B8C8D4',  // 浅花青色 - 人口流入
  'population_change_negative': '#A8B4C0',  // 降低饱和度的花青色 - 人口流出
  'population_change_neutral': '#B0C0CC',   // 中性花青色 - 人口稳定
  'economic_cultural_impact_positive': '#C0D4C0',  // 浅石绿色 - 文化兴盛
  'economic_cultural_impact_negative': '#B0C4B0',  // 降低饱和度的石绿色 - 文化衰退
  'economic_cultural_impact_neutral': '#B8CCC8'    // 中性石绿色 - 文化稳定
};

const GeoChart = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({});
  const isInitializedRef = useRef(false);

  const [warData, setWarData] = useState([]);
  const [disasterData, setDisasterData] = useState([]);
  const [eventData, setEventData] = useState([]);

  const warMarkersRef = useRef([]);
  const disasterMarkersRef = useRef([]);
  const eventMarkersRef = useRef([]);

  const warChartContainerRef = useRef(null);
  const disasterChartContainerRef = useRef(null);
  const eventChartContainerRef = useRef(null);

  const warChartInstanceRef = useRef(null);
  const disasterChartInstanceRef = useRef(null);
  const eventChartInstanceRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const selectedDynasties = useDynastyStore((state) => state.selectedDynasties);
  const isOverview = selectedDynasties.includes('overview');

  const scaledIconCache = useRef({});

  const getScaledIcon = useCallback((iconType, zoomLevel) => {
    const baseIconUrl = {
      war: `${ICON_BASE_PATH}war.png`, disaster: `${ICON_BASE_PATH}disaster.png`, event: `${ICON_BASE_PATH}event.png`,
    };
    let scaleFactor = 1.0; let scaleKey = 'large';
    if (zoomLevel <= 4) { scaleFactor = 0.6; scaleKey = 'small'; } 
    else if (zoomLevel <= 6) { scaleFactor = 0.8; scaleKey = 'medium'; }
    const cacheKey = `${iconType}-${scaleKey}`;
    if (scaledIconCache.current[cacheKey]) return scaledIconCache.current[cacheKey];
    
    // 所有图标都使用相同的基础尺寸
    const baseSize = BASE_SVG_ICON_SIZE;
    const newWidth = Math.round(baseSize[0] * scaleFactor);
    const newHeight = Math.round(baseSize[1] * scaleFactor);
    const newIcon = createSvgIcon(baseIconUrl[iconType], [newWidth, newHeight]);
    scaledIconCache.current[cacheKey] = newIcon;
    return newIcon;
  }, []); 

  const handleZoomEnd = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const currentZoom = mapInstanceRef.current.getZoom();

    warMarkersRef.current.forEach(marker => marker.setIcon(getScaledIcon('war', currentZoom)));
    disasterMarkersRef.current.forEach(marker => marker.setIcon(getScaledIcon('disaster', currentZoom)));
    eventMarkersRef.current.forEach(marker => marker.setIcon(getScaledIcon('event', currentZoom)));

    const popLayer = layersRef.current.population;
    if (popLayer && popLayer.eachLayer) {
      let newRadius = 5; 
      if (currentZoom <= 4) newRadius = 3; else if (currentZoom <= 6) newRadius = 4;
      popLayer.eachLayer(layer => { if (layer.setRadius) layer.setRadius(newRadius); });
    }
    if (mapRef.current) {
      mapRef.current.classList.remove('map-zoom-small', 'map-zoom-medium', 'map-zoom-large');
      if (currentZoom <= 4) mapRef.current.classList.add('map-zoom-small');
      else if (currentZoom <= 6) mapRef.current.classList.add('map-zoom-medium');
      else mapRef.current.classList.add('map-zoom-large');
    }
  }, [getScaledIcon]); 

  const initializeMap = useCallback(() => {
    if (!mapRef.current || isInitializedRef.current) return false;
    
    // 确保容器有有效的尺寸
    const container = mapRef.current;
    if (!container.offsetWidth || !container.offsetHeight) {
      console.warn('地图容器尺寸无效，延迟初始化');
      setTimeout(() => initializeMap(), 100);
      return false;
    }
    
    try {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [39.9042, 116.4074], 
        zoom: 6, 
        preferCanvas: false, // 改为false以避免Canvas相关问题
        renderer: L.svg(), // 明确使用SVG渲染器
        // 完全禁用Canvas相关选项
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true
      });
      isInitializedRef.current = true;
      
      // 延长等待时间确保DOM完全准备好
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          handleZoomEnd(); 
        }
      }, 300);
      
      mapInstanceRef.current.on('zoomend', handleZoomEnd);
      return true;
    } catch (err) {
      console.error('地图初始化错误:', err);
      setError('地图初始化失败: ' + err.message);
      return false;
    }
  }, [handleZoomEnd]); 

  const loadBaseMapLayers = async () => {
    if (!mapInstanceRef.current) return;
    try {
      const layerUrls = [
        '/data/population.geojson', '/data/river.geojson', '/data/lake.geojson',
        '/data/ocean.geojson', '/data/urban.geojson',
      ];
      const layerStyles = {
        population: { fillColor: '#8C6D46', weight: 1, opacity: 0.8, color: '#BF9D7E', fillOpacity: 0.5 },
        river: { color: '#4A90A4', weight: 2, opacity: 0.8 },
        lake: { fillColor: '#5B9BD5', weight: 1, opacity: 0.8, color: '#4A90A4', fillOpacity: 0.6 },
        ocean: { fillColor: '#2E5266', weight: 1, opacity: 0.8, color: '#2E5266', fillOpacity: 0.4 },
        urban: { fillColor: '#8B4513', weight: 0.5, opacity: 0.6, color: '#654321', fillOpacity: 0.3 },
      };
      const layerJsons = await Promise.all(layerUrls.map(url =>
        fetch(url).then(res => { if (!res.ok) throw new Error(`请求失败: ${res.status} for ${url}`); return res.json(); })
      ));
      const getFeatureCenter = (feature) => {
        const coords = feature.geometry.coordinates; let latlngs = []; const type = feature.geometry.type;
        if (type === 'Polygon') latlngs = coords[0].map(([lng, lat]) => [lat, lng]);
        else if (type === 'MultiPolygon') latlngs = coords.flat(2).map(([lng, lat]) => [lat, lng]);
        else if (type === 'LineString') latlngs = coords.map(([lng, lat]) => [lat, lng]);
        else if (type === 'MultiLineString') latlngs = coords.flat().map(([lng, lat]) => [lat, lng]);
        else return null;
        if (latlngs.length === 0 || !latlngs.every(ll => Array.isArray(ll) && ll.length === 2 && typeof ll[0] === 'number' && typeof ll[1] === 'number')) return null;
        try { return L.latLngBounds(latlngs).getCenter(); } catch (e) { console.warn("Error calculating feature center:", feature, e); return null; }
      };
      const layerNames = ['population', 'river', 'lake', 'ocean', 'urban'];
      const allFeatures = [];
      layerNames.forEach((layerName, i) => { 
        const geojson = layerJsons[i]; if (!geojson?.features) return; allFeatures.push(...geojson.features);
        let layerToAdd;
        if (layerName === 'population') {
          layerToAdd = L.geoJSON(geojson, {
            pointToLayer: (feature, latlng) => {
              const name = feature.properties?.NAME_ZH || feature.properties?.name || '';
              const marker = L.circleMarker(latlng, { 
                radius: 5, 
                fillColor: '#8C6D46', 
                color: '#000', 
                weight: 1, 
                opacity: 1, 
                fillOpacity: 1,
                renderer: L.svg() // 强制使用SVG渲染器
              });
              if (name) marker.bindTooltip(name, { permanent: true, direction: 'center', className: 'label-tooltip' });
              return marker;
            }
          });
        } else { 
          layerToAdd = L.geoJSON(geojson, {
            style: layerStyles[layerName],
            onEachFeature: (feature, layer) => {
              const name = feature.properties?.name_zh || feature.properties?.NAME_ZH || feature.properties?.name;
              if (name) {
                layer.bindPopup(`${layerName}: ${name}`);
                if (['river','lake'].includes(layerName)) {
                  const center = getFeatureCenter(feature);
                  if (center) L.tooltip({ permanent: true, direction: 'center', className: 'label-tooltip' }).setLatLng(center).setContent(name).addTo(mapInstanceRef.current);
                }
              }
            }
          });
        }
        layerToAdd.addTo(mapInstanceRef.current); layersRef.current[layerName] = layerToAdd;
      });

      if (allFeatures.length > 0) {
        const bounds = L.geoJSON({ type: "FeatureCollection", features: allFeatures }).getBounds();
        if (bounds.isValid()) {
          L.imageOverlay('/data/relief.png', bounds, { opacity: 0.5 }).addTo(mapInstanceRef.current);

          // 设置最大边界，避免拖动时出现空白
          mapInstanceRef.current.setMaxBounds(bounds);
          mapInstanceRef.current.options.maxBoundsViscosity = 1.0;

          // 将最小缩放级别锁定为初始级别（6），保证始终以北京为中心且边界不会露出
          const desiredZoom = 6.5;
          mapInstanceRef.current.setMinZoom(desiredZoom);
          // 确保当前缩放不会小于 desiredZoom
          if (mapInstanceRef.current.getZoom() < desiredZoom) {
            mapInstanceRef.current.setZoom(desiredZoom);
          }
          // 重新定位视图至北京（防止 fitBounds 等逻辑覆盖）
          mapInstanceRef.current.setView([39.9042, 116.4074], desiredZoom);


        } else console.warn("Calculated bounds for relief map are invalid.");
      }
       if (mapInstanceRef.current) { handleZoomEnd(); }
    } catch (err) {
      setError(prev => prev ? `${prev}\n加载地图图层数据失败: ${err.message}` : `加载地图图层数据失败: ${err.message}`);
    }
  };

  useEffect(() => { // CSV Data loading effect
    setIsLoading(true); setError(null);
    const parseOptions = { header: true, skipEmptyLines: true };
    const processRowAttributes = (r) => ({
      regime_change: Number(r.regime_change || 0), urban_reconstruction: Number(r.urban_reconstruction || 0),
      urban_expansion: Number(r.urban_expansion || 0), population_change: Number(r.population_change || 0),
      economic_cultural_impact: Number(r.economic_cultural_impact || 0),
    });
    Promise.all([
      fetch('/data/战争定位.csv').then(res => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status} for 战争定位.csv`))).then(txt => Papa.parse(txt, parseOptions).data),
      fetch('/data/灾害定位.csv').then(res => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status} for 灾害定位.csv`))).then(txt => Papa.parse(txt, parseOptions).data),
      fetch('/data/事件定位.csv').then(res => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status} for 事件定位.csv`))).then(txt => Papa.parse(txt, parseOptions).data)
    ])
    .then(([warRes, disasterRes, eventRes]) => {
      setWarData(warRes.filter(r => r.latitude && r.longitude).map(r => ({ ...r, latitude: parseFloat(r.latitude), longitude: parseFloat(r.longitude), ...processRowAttributes(r) })));
      setDisasterData(disasterRes.filter(r => r.latitude && r.longitude && r.disaster_type).map(r => ({ ...r, latitude: parseFloat(r.latitude), longitude: parseFloat(r.longitude), ...processRowAttributes(r) })));
      setEventData(eventRes.filter(r => r.latitude && r.longitude && r.event_name).map(r => ({ ...r, latitude: parseFloat(r.latitude), longitude: parseFloat(r.longitude), ...processRowAttributes(r) })));
      setIsLoading(false);
    })
    .catch(err => {
      console.error('CSV 数据加载或解析失败:', err);
      setError(`CSV 数据加载失败: ${err.message}. 请确保所有CSV文件均为 UTF-8 编码且位于 public/data/ 目录下。`);
      setIsLoading(false);
    });
  }, []);

  // 获取属性对应的颜色
  const getAttributeColor = (attributeConfig, value) => {
    const { key, positiveLabel, negativeLabel } = attributeConfig;
    
    if (positiveLabel && negativeLabel) {
      // 有正负值区分的属性
      if (value > 0) {
        return ATTRIBUTE_COLORS[`${key}_positive`];
      } else if (value < 0) {
        return ATTRIBUTE_COLORS[`${key}_negative`];
      } else {
        return ATTRIBUTE_COLORS[`${key}_neutral`];
      }
    } else {
      // 普通属性
      return ATTRIBUTE_COLORS[key] || '#E0E0E0';
    }
  };

  const renderNightingaleChartInContainer = (
    chartInstanceRef, 
    containerElement, 
    data, 
    title, 
    attributeConfig,
    showLegend
  ) => {
    if (!containerElement) return;
    if (chartInstanceRef.current) { chartInstanceRef.current.dispose(); chartInstanceRef.current = null; }
    containerElement.innerHTML = '';

    if (!data || data.length === 0) {
      const noDataEl = document.createElement('div');
      noDataEl.innerText = `${title.replace('属性', '').trim()}: 无相关数据`;
      noDataEl.className = 'chart-no-data-message';
      containerElement.appendChild(noDataEl);
      return;
    }

    const sum = (field) => data.reduce((acc, r) => acc + Number(r[field] || 0), 0);
    const absSum = (field) => Math.abs(sum(field));
    const chartValues = attributeConfig.map(attr => {
        // ... (您的 chartValues 逻辑保持不变)
        const total = sum(attr.key);
        let name = attr.label;
        if (attr.positiveLabel && attr.negativeLabel) {
          if (total > 0) name = attr.positiveLabel;
          else if (total < 0) name = attr.negativeLabel;
          else name = attr.neutralLabel || attr.label;
        }
        const value = (attr.positiveLabel || attr.isMagnitude) ? absSum(attr.key) : sum(attr.key);
        const showLabelForThisSector = (name === '人口流入' || name === '文化兴盛') && value > 0;
        const color = getAttributeColor(attr,total);

        return {
          name,
          value,
          itemStyle:{
            color: color
          },
          label: { show: showLabelForThisSector, position: 'outside', formatter: '{b}', fontSize: 9, },
          labelLine: { show: showLabelForThisSector, }
        };
    });

    const chart = echarts.init(containerElement);
    const option = {
      title: {
        text: title,
        left: 'center',
        top: 8,
        textStyle: { fontSize: 13, fontWeight: '600' }
      },
      tooltip: { // MODIFIED: 详细配置 tooltip
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)', // {a} 是系列名, {b} 是数据名, {c} 是数值, {d} 是百分比
        // confine: true, // 一个更简单的选项是设置 confine: true, Tooltip 会被限制在图表区域内

        // --- 新增：自定义 tooltip 位置 ---
        position: function (point, params, dom, rect, size) {


          const chartContainerWidth = size.viewSize[0];
          const chartContainerHeight = size.viewSize[1];
          const tooltipWidth = size.contentSize[0];
          const tooltipHeight = size.contentSize[1];

          let x = point[0] + 20; // 默认尝试放在鼠标右边20px处
          let y = point[1] - tooltipHeight / 2; // 默认尝试垂直居中于鼠标

          // 如果tooltip的右边界超出了图表容器的右边界，则尝试放到鼠标左边
          if (x + tooltipWidth > chartContainerWidth) {
            x = point[0] - tooltipWidth - 20; // 放到鼠标左边20px处
          }

          // 确保tooltip不会超出图表容器的左边界
          if (x < 0) {
            x = 5; // 距离左边界5px的内边距
          }

          // 垂直方向的边界检查和调整
          if (y < 0) { // 如果tooltip的上边界超出了图表容器的上边界
            y = 5; // 距离上边界5px的内边距
          } else if (y + tooltipHeight > chartContainerHeight) { // 如果tooltip的下边界超出了图表容器的下边界
            y = chartContainerHeight - tooltipHeight - 5; // 距离下边界5px的内边距
          }

          return [x, y]; // 返回计算好的tooltip左上角坐标 [x, y]
        }
        // --- 自定义 tooltip 位置结束 ---
      },
      legend: {
        show: showLegend,
        top: showLegend ? 30 : 'auto',
        left: 'center',
        textStyle: { fontSize: 10 }
      },
      series: [{
  name: '属性值',
  type: 'pie',
  radius: [15, 55],
  // MODIFIED: 调整当显示图例时饼图的垂直中心位置
  center: ['50%', showLegend ? '72%' : '55%'], 
  roseType: 'area',
  itemStyle: { borderRadius: 4, emphasis: { shadowBlur: 8, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.4)' }},
  label: { show: false, },
  labelLine: { show: false, },
  data: chartValues,
}]
    };
    chart.setOption(option);
    chartInstanceRef.current = chart;
  };

  const COMMON_ATTRIBUTE_CONFIG = [
    { key: 'regime_change', label: '政权更替', isMagnitude: true }, 
    { key: 'urban_reconstruction', label: '城市重建', isMagnitude: true },
    { key: 'urban_expansion', label: '城市扩建', isMagnitude: true }, 
    { key: 'population_change', label: '人口变化', positiveLabel: '人口流入', negativeLabel: '人口流出', neutralLabel: '人口稳定' },
    { key: 'economic_cultural_impact', label: '文经影响', positiveLabel: '文化兴盛', negativeLabel: '文化衰退', neutralLabel: '文化稳定' }
  ];
  
  const updateVisualizations = useCallback(() => {
    if (!mapInstanceRef.current || isLoading) return;

    // 安全地移除现有标记
    try {
      [...warMarkersRef.current, ...disasterMarkersRef.current, ...eventMarkersRef.current].forEach(m => {
        if (m && mapInstanceRef.current && mapInstanceRef.current.hasLayer(m)) {
          mapInstanceRef.current.removeLayer(m);
        }
      });
    } catch (err) {
      console.warn('移除标记时出现错误:', err);
    }
    warMarkersRef.current = []; disasterMarkersRef.current = []; eventMarkersRef.current = [];

    const currentDynastyNames = selectedDynasties.filter(d => d !== 'overview').join('、') || '所有时期';
    const filterByDynasty = (data) => data.filter(row => {
        const rowDynasties = String(row.dynasty || '').split('、').map(d => d.trim());
        return selectedDynasties.some(dynasty => dynasty !== 'overview' && rowDynasties.includes(dynasty));
    });

    let warToShow = [], disasterToShow = [], eventToShow = [];
    const specificDynastySelected = !isOverview && selectedDynasties.filter(d => d !== 'overview').length > 0;

    if (isOverview) {
      // 当是“全局总览”时，使用所有数据
warToShow = warData;
   disasterToShow = disasterData;
   eventToShow = eventData;
  } else if (specificDynastySelected) {
      // 当选择了具体朝代时，使用过滤后的数据
   warToShow = filterByDynasty(warData);
   disasterToShow = filterByDynasty(disasterData);
   eventToShow = filterByDynasty(eventData);
  } else {
      // 其他情况（例如，没有选择任何朝代），显示空数据
      warToShow = [];
      disasterToShow = [];
      eventToShow = [];
    }

    // 2. 将 Marker 的渲染逻辑移出之前的 if 判断
    // 这样，无论是总览还是特定朝代，只要有数据就会在地图上显示标记
  const currentZoom = mapInstanceRef.current.getZoom();
  
    // 创建SVG渲染器实例以确保一致的渲染方式
  const svgRenderer = L.svg();
  
  const initialWarIcon = getScaledIcon('war', currentZoom);
  warToShow.forEach(loc => { 
    const marker = L.marker([loc.latitude, loc.longitude], { 
      icon: initialWarIcon,
      renderer: svgRenderer 
    }); 
    marker.bindPopup(`<div style="text-align:center;"><h3 style="margin:0 0 5px;">${loc.position || '未知地点'}</h3><p style="margin:0;">${loc.war_name}</p></div>`); 
    marker.addTo(mapInstanceRef.current); 
    warMarkersRef.current.push(marker); 
  });
  
  const initialDisasterIcon = getScaledIcon('disaster', currentZoom);
  disasterToShow.forEach(loc => { 
    const marker = L.marker([loc.latitude, loc.longitude], { 
      icon: initialDisasterIcon,
      renderer: svgRenderer 
    }); 
    marker.bindPopup(`<div style="text-align:center;"><h3 style="margin:0 0 5px;">${loc.disaster_type}</h3><p style="margin:0;">${loc.position || ''}</p></div>`); 
    marker.addTo(mapInstanceRef.current); 
    disasterMarkersRef.current.push(marker); 
  });
  
  const initialEventIcon = getScaledIcon('event', currentZoom);
  eventToShow.forEach(loc => { 
    const marker = L.marker([loc.latitude, loc.longitude], { 
      icon: initialEventIcon,
      renderer: svgRenderer 
    }); 
    marker.bindPopup(`<div style="text-align:center;"><h3 style="margin:0 0 5px;">${loc.event_name}</h3><p style="margin:0;">${loc.position || ''}</p></div>`); 
    marker.addTo(mapInstanceRef.current); 
    eventMarkersRef.current.push(marker); 
  });
  
  const chartTitleSuffix = isOverview ? "总览概况" : currentDynastyNames;

    // 3. 修改图表渲染逻辑，直接使用处理好的数据
    // 删除了之前会阻止总览数据显示的 dataForChart 函数
  renderNightingaleChartInContainer(warChartInstanceRef, warChartContainerRef.current, warToShow, `战争属性`, COMMON_ATTRIBUTE_CONFIG, true);
  renderNightingaleChartInContainer(disasterChartInstanceRef, disasterChartContainerRef.current, disasterToShow, `灾害属性`, COMMON_ATTRIBUTE_CONFIG, false);
  renderNightingaleChartInContainer(eventChartInstanceRef, eventChartContainerRef.current, eventToShow, `不稳定事件属性`, COMMON_ATTRIBUTE_CONFIG, false);
    

  }, [warData, disasterData, eventData, selectedDynasties, isOverview, isLoading, getScaledIcon]);


  useEffect(() => { // Main map initialization and cleanup
    const timer = setTimeout(() => {
      if (initializeMap()) {
        loadBaseMapLayers();
      }
    }, 100); // 延迟初始化以确保DOM准备完成
    
    return () => {
      clearTimeout(timer);
      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.off('zoomend', handleZoomEnd);
          mapInstanceRef.current.remove();
        }
      } catch (err) {
        console.warn('地图清理时出现错误:', err);
      }
      
      // 清理图表实例
      try {
        warChartInstanceRef.current?.dispose();
        disasterChartInstanceRef.current?.dispose(); 
        eventChartInstanceRef.current?.dispose();
      } catch (err) {
        console.warn('图表清理时出现错误:', err);
      }
      
      mapInstanceRef.current = null; 
      isInitializedRef.current = false;
    };
  }, [initializeMap, handleZoomEnd]);

  useEffect(() => { // Update visualizations when data or selections change
    if (isInitializedRef.current && mapInstanceRef.current && !isLoading) {
      updateVisualizations();
      // 使用setTimeout异步处理invalidateSize，避免ResizeObserver循环
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize(false);
        }
      }, 0);
    }
  }, [selectedDynasties, warData, disasterData, eventData, isLoading, updateVisualizations]);

  return (
    <div className="geochart-page-container">
      <div className="geochart-main-layout">
        <div ref={mapRef} className="geochart-map-area">
            {error && (
              <div className="geochart-message-overlay geochart-error-message">
                <strong>发生错误!</strong>
                {error.split('\n').map((line, i) => <p key={i}>{line}</p>)}
              </div>
            )}
            {isLoading && !error && (
              <div className="geochart-message-overlay geochart-loading-message">
                ⏳ 正在加载地图和数据...
              </div>
            )}
        </div>
        <div className="geochart-sidebar">
            <div className="charts-group-container">
                <div ref={warChartContainerRef} className="geochart-chart-instance" style={{ height: CHART_CONTAINER_HEIGHT, minHeight: CHART_CONTAINER_HEIGHT }}></div>
                <div ref={disasterChartContainerRef} className="geochart-chart-instance" style={{ height: CHART_CONTAINER_HEIGHT, minHeight: CHART_CONTAINER_HEIGHT }}></div>
                <div ref={eventChartContainerRef} className="geochart-chart-instance" style={{ height: CHART_CONTAINER_HEIGHT, minHeight: CHART_CONTAINER_HEIGHT }}></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default GeoChart;