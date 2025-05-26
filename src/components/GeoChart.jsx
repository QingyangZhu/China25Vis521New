import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import Papa from 'papaparse';
import './GeoChart.css';
import 'leaflet/dist/leaflet.css';
import * as echarts from 'echarts';
import 'echarts/lib/chart/pie';
import useDynastyStore from '../store/dynastyStore';

// 修复 Leaflet 默认图标问题
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GeoChart = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({});
  const markersRef = useRef([]);
  const isInitializedRef = useRef(false);
  const chartLayerRef = useRef(null);

  const [csvData, setCsvData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 从 store 获取选中的朝代
  const selectedDynasties = useDynastyStore((state) => state.selectedDynasties);
  const isOverview = selectedDynasties.includes('overview');

  // 初始化地图
  const initializeMap = useCallback(() => {
    if (!mapRef.current || isInitializedRef.current) return false;
    try {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [40.0, 116.4],
        zoom: 5,
        preferCanvas: true,
      });
      isInitializedRef.current = true;
      return true;
    } catch (err) {
      setError('地图初始化失败: ' + err.message);
      return false;
    }
  }, []);

  // 加载 Natural Earth GeoJSON 图层
  const loadMapData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const layerUrls = [
        '/data/population.geojson',
        '/data/river.geojson',
        '/data/lake.geojson',
        '/data/ocean.geojson',
        '/data/urban.geojson',
      ];
      const layerStyles = {
        population: { fillColor: '#8C6D46', weight: 1, opacity: 0.8, color: '#BF9D7E', fillOpacity: 0.5 },
        river: { color: '#4A90A4', weight: 2, opacity: 0.8 },
        lake: { fillColor: '#5B9BD5', weight: 1, opacity: 0.8, color: '#4A90A4', fillOpacity: 0.6 },
        ocean: { fillColor: '#2E5266', weight: 1, opacity: 0.8, color: '#2E5266', fillOpacity: 0.4 },
        urban: { fillColor: '#8B4513', weight: 0.5, opacity: 0.6, color: '#654321', fillOpacity: 0.3 },
      };

      const layerJsons = await Promise.all(layerUrls.map(url =>
        fetch(url).then(res => {
          if (!res.ok) throw new Error(`请求失败: ${res.status}`);
          return res.json();
        })
      ));

      // helper: 计算要素中心
      const getFeatureCenter = (feature) => {
        const coords = feature.geometry.coordinates;
        let latlngs = [];
        const type = feature.geometry.type;
        if (type === 'Polygon') {
          latlngs = coords[0].map(([lng, lat]) => [lat, lng]);
        } else if (type === 'MultiPolygon') {
          latlngs = coords.flat(2).map(([lng, lat]) => [lat, lng]);
        } else if (type === 'LineString') {
          latlngs = coords.map(([lng, lat]) => [lat, lng]);
        } else if (type === 'MultiLineString') {
          latlngs = coords.flat().map(([lng, lat]) => [lat, lng]);
        } else {
          return null;
        }
        return L.latLngBounds(latlngs).getCenter();
      };

      const layerNames = ['population', 'river', 'lake', 'ocean', 'urban'];
      const allFeatures = [];

      layerNames.forEach((layerName, i) => {
        const geojson = layerJsons[i];
        if (!geojson?.features) return;
        allFeatures.push(...geojson.features);

        if (layerName === 'population') {
          // 用圆点 + tooltip
          const popLayer = L.geoJSON(geojson, {
            pointToLayer: (feature, latlng) => {
              const name = feature.properties?.NAME_ZH || feature.properties?.name || '';
              const marker = L.circleMarker(latlng, {
                radius: 5,
                fillColor: '#8C6D46',
                color: '#000',
                weight: 1,
                opacity: 1,
                fillOpacity: 1,
              });
              if (name) {
                marker.bindTooltip(name, {
                  permanent: true,
                  direction: 'center',
                  className: 'label-tooltip'
                });
              }
              return marker;
            }
          });
          popLayer.addTo(mapInstanceRef.current);
          layersRef.current.population = popLayer;
        } else {
          // 其他图层
          const lyr = L.geoJSON(geojson, {
            style: layerStyles[layerName],
            onEachFeature: (feature, layer) => {
              const name = feature.properties?.name_zh || feature.properties?.NAME_ZH || feature.properties?.name;
              if (name) {
                layer.bindPopup(`${layerName}: ${name}`);
                if (['river','lake'].includes(layerName)) {
                  const center = getFeatureCenter(feature);
                  if (center) {
                    L.tooltip({
                      permanent: true,
                      direction: 'center',
                      className: 'label-tooltip'
                    })
                      .setLatLng(center)
                      .setContent(name)
                      .addTo(mapInstanceRef.current);
                  }
                }
              }
            }
          });
          lyr.addTo(mapInstanceRef.current);
          layersRef.current[layerName] = lyr;
        }
      });

      // relief.png 叠加
      const bounds = L.geoJSON({ type: "FeatureCollection", features: allFeatures }).getBounds();
      L.imageOverlay('/data/relief.png', bounds, { opacity: 0.5 }).addTo(mapInstanceRef.current);
      mapInstanceRef.current.fitBounds(bounds);

      setIsLoading(false);
      // 地图 + 图层就绪后，加载 CSV 并绘制一次标记
      updateMarkers();
    } catch (err) {
      setError('加载地图数据失败: ' + err.message);
      setIsLoading(false);
    }
  };

  // 读取 CSV
  useEffect(() => {
    fetch('/data/output_with_coordinates.csv')
      .then(res => res.text())
      .then(txt => {
        const { data } = Papa.parse(txt, { header: true });
        // 只保留必要字段
        const clean = data
          .filter(r => r.latitude && r.longitude)
          .map(r => ({
            dynasty: r.dynasty,
            position: r.position,
            war_name: r.war_name,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
            regime_change: Number(r.regime_change || 0),
            urban_reconstruction: Number(r.urban_reconstruction || 0),
            urban_expansion: Number(r.urban_expansion || 0),
            population_change: Number(r.population_change || 0),
            economic_cultural_impact: Number(r.economic_cultural_impact || 0),
          }));
        setCsvData(clean);
      })
      .catch(err => setError('CSV 加载失败: ' + err.message));
  }, []);

//南丁格尔图
const createNightingaleChartLayer = (periodData) => {
  if (!mapInstanceRef.current || !periodData.length || isOverview) return;

  // 计算五类属性聚合值
  const sum = (field) => periodData.reduce((acc, r) => acc + Number(r[field] || 0), 0);
  const absSum = (field) => Math.abs(sum(field));
  const sign = (field) => Math.sign(sum(field));

  // 先计算各字段的总和
  const totalPopulationChange = sum('population_change');
  const totalEconomicImpact = sum('economic_cultural_impact');


  const values = [
    { name: '政权更替', value: sum('regime_change') },
    { name: '城市重建', value: sum('urban_reconstruction') },
    { name: '城市扩建', value: sum('urban_expansion') },
    {
      // 根据总和的符号决定显示名称
      name: totalPopulationChange > 0 
        ? '人口流入' 
        : totalPopulationChange < 0 
          ? '人口流出' 
          : '人口稳定',
      value: absSum('population_change')
    },
    {
      // 根据总和的符号决定显示名称
      name: totalEconomicImpact > 0 
        ? '文化兴盛' 
        : totalEconomicImpact < 0 
          ? '文化衰退' 
          : '文化稳定',
      value: absSum('economic_cultural_impact')
    }
  ];

  // 创建 ECharts 图表容器
  const chartContainer = document.createElement('div');
  chartContainer.style.width = '350px'; // 增加宽度以容纳完整标签
  chartContainer.style.height = '350px';
  chartContainer.style.position = 'relative'; // 为点击提示定位做准备

  const chart = echarts.init(chartContainer);
  
  // 解决点击事件不响应的问题
  chartContainer.style.pointerEvents = 'auto';
  
  const option = {
    title: { 
      text: `${selectedDynasties.join('、')}时期属性图`, 
      left: 'center', 
      top: 0,
      textStyle: {
        fontSize: 12
      }
    },
    tooltip: { 
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      top: '10%',
      left: 'center'
    },
    series: [{
      name: '属性值',
      type: 'pie',
      radius: [40, 120], // 调整内半径给标签更多空间
      center: ['50%', '50%'],
      roseType: 'area',
      itemStyle: { 
        borderRadius: 8,
        emphasis: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      label: {
        show: true,
        formatter: (params) => {
          // 缩短过长的标签
          const name = params.name.length > 4 ? params.name.substring(0, 4) + '...' : params.name;
          return `${name}: ${params.value}`;
        },
        position: 'outside',
        alignTo: 'labelLine',
        bleedMargin: 5,
        distanceToLabelLine: 5
      },
      labelLine: {
        show: true,
        length: 10,
        length2: 10,
        smooth: true
      },
      data: values,
      emphasis: {
        label: {
          show: true,
          fontSize: '14',
          fontWeight: 'bold'
        }
      }
    }]
  };

  chart.setOption(option);

  // 点击事件处理 - 修复不响应问题
  let tooltip = null;
  
  chart.on('click', (params) => {
    // 移除之前的提示框
    if (tooltip) {
      chartContainer.removeChild(tooltip);
    }
    
    // 创建新的提示框
    tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(50, 50, 50, 0.9)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.zIndex = '9999';
    tooltip.style.fontSize = '14px';
    tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    
    // 计算位置 - 确保在图表容器内
    const mouseX = params.event.event.offsetX;
    const mouseY = params.event.event.offsetY;
    
    tooltip.style.left = `${Math.min(mouseX + 15, 250)}px`;
    tooltip.style.top = `${Math.min(mouseY + 15, 300)}px`;
    
    tooltip.innerHTML = `
      <div style="margin-bottom:4px;"><strong>${params.name}</strong></div>
      <div style="margin-bottom:2px;">数值: ${params.value}</div>
      <div>占比: ${params.percent}%</div>
    `;
    
    chartContainer.appendChild(tooltip);
    
    // 5秒后自动移除
    setTimeout(() => {
      if (tooltip && chartContainer.contains(tooltip)) {
        chartContainer.removeChild(tooltip);
        tooltip = null;
      }
    }, 5000);
  });

  // 鼠标移出图表时移除提示
  chartContainer.addEventListener('mouseleave', () => {
    if (tooltip) {
      chartContainer.removeChild(tooltip);
      tooltip = null;
    }
  });

  // 转为 Leaflet 图层
  const chartLatLng = L.latLng(39.9042, 116.4074);
  const chartIcon = L.divIcon({
    html: chartContainer,
    className: 'echarts-tooltip-container', // 添加类名以便样式控制
    iconSize: [350, 350], // 增大尺寸
    iconAnchor: [175, 175]
  });

  // 清除旧图层
  if (chartLayerRef.current) {
    mapInstanceRef.current.removeLayer(chartLayerRef.current);
  }

  const marker = L.marker(chartLatLng, { 
    icon: chartIcon,
    interactive: true // 确保可交互
  });
  marker.addTo(mapInstanceRef.current);
  chartLayerRef.current = marker;
};

  // 增加标记
  const updateMarkers = useCallback(() => {
    if (!mapInstanceRef.current) return;

    // 先清除旧标记
    markersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    markersRef.current = [];
    
    // 清除图表
    if (chartLayerRef.current) {
      mapInstanceRef.current.removeLayer(chartLayerRef.current);
      chartLayerRef.current = null;
    }

    // 如果是全局总览，不显示任何标记
    if (isOverview) return;

    // 筛选符合选中朝代的记录
    const toShow = csvData.filter(row => {
      const rowDynasties = row.dynasty.split('、').map(d => d.trim());
      return selectedDynasties.some(dynasty => rowDynasties.includes(dynasty));
    });

    // 添加标记
    toShow.forEach(loc => {
      const marker = L.marker([loc.latitude, loc.longitude]);
      marker.bindPopup(
        `<div style="text-align:center;">
          <h3 style="margin:0 0 5px;">${loc.position}</h3>
          <p style="margin:0;">${loc.war_name}</p>
        </div>`
      );
      marker.addTo(mapInstanceRef.current);
      markersRef.current.push(marker);
    });

    // 创建图表
    createNightingaleChartLayer(toShow);
  }, [csvData, selectedDynasties, isOverview]);

  // 首次初始化地图 & 加载图层
  useEffect(() => {
    if (initializeMap()) {
      loadMapData();
    }
    return () => {
      mapInstanceRef.current?.remove();
      isInitializedRef.current = false;
    };
  }, [initializeMap]);

  // 每当选中朝代或 csvData 变化时，刷新标记
  useEffect(() => {
    if (isInitializedRef.current) {
      updateMarkers();
    }
  }, [selectedDynasties, csvData, updateMarkers]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* 地图容器 */}
      <div
        ref={mapRef}
        className="flex-1 relative"
        style={{ minHeight: '500px', background: '#f0f0f0' }}
      >
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-100 text-red-600 z-10">
            错误: {error}
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60 z-10">
            正在加载地图...
          </div>
        )}
      </div>
    </div>
  );
};

export default GeoChart;