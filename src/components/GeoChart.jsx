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

const warIcon = createSvgIcon(`${ICON_BASE_PATH}war.svg`, BASE_SVG_ICON_SIZE);
const disasterIcon = createSvgIcon(`${ICON_BASE_PATH}disaster.svg`, BASE_SVG_ICON_SIZE);
const eventIcon = createSvgIcon(`${ICON_BASE_PATH}event.svg`, BASE_SVG_ICON_SIZE);

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
      war: `${ICON_BASE_PATH}war.svg`, disaster: `${ICON_BASE_PATH}disaster.svg`, event: `${ICON_BASE_PATH}event.svg`,
    };
    let scaleFactor = 1.0; let scaleKey = 'large';
    if (zoomLevel <= 4) { scaleFactor = 0.6; scaleKey = 'small'; } 
    else if (zoomLevel <= 6) { scaleFactor = 0.8; scaleKey = 'medium'; }
    const cacheKey = `${iconType}-${scaleKey}`;
    if (scaledIconCache.current[cacheKey]) return scaledIconCache.current[cacheKey];
    const newWidth = Math.round(BASE_SVG_ICON_SIZE[0] * scaleFactor);
    const newHeight = Math.round(BASE_SVG_ICON_SIZE[1] * scaleFactor);
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
    try {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [38.0, 105.0], zoom: 4, preferCanvas: true,
      });
      isInitializedRef.current = true;
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
        handleZoomEnd(); 
      } , 150);
      mapInstanceRef.current.on('zoomend', handleZoomEnd);
      return true;
    } catch (err) {
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
              const marker = L.circleMarker(latlng, { radius: 5, fillColor: '#8C6D46', color: '#000', weight: 1, opacity: 1, fillOpacity: 1 });
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
           if(isInitializedRef.current && (!selectedDynasties.length || selectedDynasties.includes('overview'))) {
             mapInstanceRef.current.fitBounds(bounds);
          }
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
    
    // 处理数据并设置颜色
    const chartValues = attributeConfig.map(attr => {
        const total = sum(attr.key); 
        let name = attr.label;
        if (attr.positiveLabel && attr.negativeLabel) {
          if (total > 0) name = attr.positiveLabel; 
          else if (total < 0) name = attr.negativeLabel; 
          else name = attr.neutralLabel || attr.label;
        }
        const value = (attr.positiveLabel || attr.isMagnitude) ? absSum(attr.key) : sum(attr.key);
        
        // 确定这个扇形是否显示标签
        const showLabelForThisSector = (name === '人口流入' || name === '文化兴盛') && value > 0;

        return { 
            name, 
            value,
            // 设置每个扇形的颜色
            itemStyle: {
              color: getAttributeColor(attr, total)
            },
            label: {
                show: showLabelForThisSector,
                position: 'outside',
                formatter: '{b}',
                fontSize: 9,
            },
            labelLine: {
                show: showLabelForThisSector,
            }
        };
    });
  
    const chart = echarts.init(containerElement);
    const option = {
      title: { 
        text: title, 
        left: 'center', 
        top: 8, 
        textStyle: { 
          fontSize: 13, 
          fontWeight: '600',
          color: '#8C6D46'  // 使用项目主色调
        }
      },
      tooltip: { 
        trigger: 'item', 
        formatter: '{a} <br/>{b}: {c} ({d}%)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#DCD1BB',
        textStyle: {
          color: '#4A4A4A'
        }
      },
      legend: { 
        show: showLegend,
        top: showLegend ? 30 : 'auto',
        left: 'center', 
        textStyle: { 
          fontSize: 10,
          color: '#4A4A4A'
        }
      },
      series: [{
        name: '属性值', 
        type: 'pie', 
        radius: [15, 55],
        center: ['50%', showLegend ? '62%' : '55%'],
        roseType: 'area',
        itemStyle: { 
          borderRadius: 4, 
          borderWidth: 1,
          borderColor: '#FFFFFF',
          emphasis: { 
            shadowBlur: 8, 
            shadowOffsetX: 0, 
            shadowColor: 'rgba(0,0,0,0.4)' 
          }
        },
        label: { 
            show: false,
        },
        labelLine: { 
            show: false,
        },
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

    [...warMarkersRef.current, ...disasterMarkersRef.current, ...eventMarkersRef.current].forEach(m => mapInstanceRef.current.removeLayer(m));
    warMarkersRef.current = []; disasterMarkersRef.current = []; eventMarkersRef.current = [];

    const currentDynastyNames = selectedDynasties.filter(d => d !== 'overview').join('、') || '所有时期';
    const filterByDynasty = (data) => data.filter(row => {
        const rowDynasties = String(row.dynasty || '').split('、').map(d => d.trim());
        return selectedDynasties.some(dynasty => dynasty !== 'overview' && rowDynasties.includes(dynasty));
    });

    let warToShow = [], disasterToShow = [], eventToShow = [];
    const specificDynastySelected = !isOverview && selectedDynasties.filter(d => d !== 'overview').length > 0;

    if (specificDynastySelected) {
        warToShow = filterByDynasty(warData);
        disasterToShow = filterByDynasty(disasterData);
        eventToShow = filterByDynasty(eventData);

        const currentZoom = mapInstanceRef.current.getZoom();
        const initialWarIcon = getScaledIcon('war', currentZoom);
        warToShow.forEach(loc => { const marker = L.marker([loc.latitude, loc.longitude], { icon: initialWarIcon }); marker.bindPopup(`<div style="text-align:center;"><h3 style="margin:0 0 5px;">${loc.position || '未知地点'}</h3><p style="margin:0;">${loc.war_name}</p></div>`); marker.addTo(mapInstanceRef.current); warMarkersRef.current.push(marker); });
        const initialDisasterIcon = getScaledIcon('disaster', currentZoom);
        disasterToShow.forEach(loc => { const marker = L.marker([loc.latitude, loc.longitude], { icon: initialDisasterIcon }); marker.bindPopup(`<div style="text-align:center;"><h3 style="margin:0 0 5px;">${loc.disaster_type}</h3><p style="margin:0;">${loc.position || ''}</p></div>`); marker.addTo(mapInstanceRef.current); disasterMarkersRef.current.push(marker); });
        const initialEventIcon = getScaledIcon('event', currentZoom);
        eventToShow.forEach(loc => { const marker = L.marker([loc.latitude, loc.longitude], { icon: initialEventIcon }); marker.bindPopup(`<div style="text-align:center;"><h3 style="margin:0 0 5px;">${loc.event_name}</h3><p style="margin:0;">${loc.position || ''}</p></div>`); marker.addTo(mapInstanceRef.current); eventMarkersRef.current.push(marker); });
    }
    
    const chartTitleSuffix = isOverview ? "总览概况" : currentDynastyNames;
    const dataForChart = (data) => specificDynastySelected ? data : [];

    renderNightingaleChartInContainer(warChartInstanceRef, warChartContainerRef.current, dataForChart(warToShow), `${chartTitleSuffix}战争属性`, COMMON_ATTRIBUTE_CONFIG, true);
    renderNightingaleChartInContainer(disasterChartInstanceRef, disasterChartContainerRef.current, dataForChart(disasterToShow), `${chartTitleSuffix}灾害属性`, COMMON_ATTRIBUTE_CONFIG, false);
    renderNightingaleChartInContainer(eventChartInstanceRef, eventChartContainerRef.current, dataForChart(eventToShow), `${chartTitleSuffix}事件属性`, COMMON_ATTRIBUTE_CONFIG, false);

  }, [warData, disasterData, eventData, selectedDynasties, isOverview, isLoading, getScaledIcon]);


  useEffect(() => { // Main map initialization and cleanup
    if (initializeMap()) {
      loadBaseMapLayers();
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('zoomend', handleZoomEnd);
      }
      warChartInstanceRef.current?.dispose(); disasterChartInstanceRef.current?.dispose(); eventChartInstanceRef.current?.dispose();
      mapInstanceRef.current?.remove(); mapInstanceRef.current = null; isInitializedRef.current = false;
    };
  }, [initializeMap, handleZoomEnd]);

  useEffect(() => { // Update visualizations when data or selections change
    if (isInitializedRef.current && mapInstanceRef.current && !isLoading) {
      updateVisualizations();
      mapInstanceRef.current.invalidateSize(false);
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