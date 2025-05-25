import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import './GeoChart.css';
import 'leaflet/dist/leaflet.css';



// 修复Leaflet默认图标问题
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 地名数据
const locationData = [
  { name: "天安门广场", latitude: 39.9042, longitude: 116.4074, eventType: "历史文化" },
  { name: "颐和园", latitude: 39.9998, longitude: 116.2752, eventType: "旅游景点" },
  { name: "八达岭长城", latitude: 40.3577, longitude: 116.0152, eventType: "世界遗产" },
  { name: "十三陵", latitude: 40.2778, longitude: 116.2194, eventType: "历史文化" },
  { name: "密云水库", latitude: 40.4167, longitude: 116.8833, eventType: "自然景观" },
  { name: "香山公园", latitude: 39.9926, longitude: 116.1964, eventType: "旅游景点" },
  { name: "雍和宫", latitude: 39.9481, longitude: 116.4189, eventType: "历史文化" },
  { name: "北海公园", latitude: 39.9289, longitude: 116.3883, eventType: "旅游景点" }
];

// 图层样式
const layerStyles = {
  population: { fillColor: '#8C6D46', weight: 1, opacity: 0.8, color: '#BF9D7E', fillOpacity: 0.5 },
  river: { color: '#4A90A4', weight: 2, opacity: 0.8 },
  lake: { fillColor: '#5B9BD5', weight: 1, opacity: 0.8, color: '#4A90A4', fillOpacity: 0.6 },
  ocean: { fillColor: '#2E5266', weight: 1, opacity: 0.8, color: '#2E5266', fillOpacity: 0.4 },
  urban: { fillColor: '#8B4513', weight: 0.5, opacity: 0.6, color: '#654321', fillOpacity: 0.3 }
};

// 类型颜色
const eventTypeColors = {
  "历史文化": "#8C6D46",
  "旅游景点": "#4A90A4",
  "世界遗产": "#D4AF37",
  "自然景观": "#2E5266"
};

// 自定义图标
const createCustomIcon = (eventType) => {
  const color = eventTypeColors[eventType] || '#6b7280';
  return L.divIcon({
    html: `<div style="
      background-color: ${color};
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    "></div>`,
    className: 'custom-marker',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

const GeoChart = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({});
  const markersRef = useRef([]);
  const isInitializedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEventTypes, setSelectedEventTypes] = useState(
    Object.keys(eventTypeColors).reduce((acc, type) => {
      acc[type] = true;
      return acc;
    }, {})
  );

  // 初始化地图
  const initializeMap = useCallback(() => {
    console.log("尝试初始化地图...");
    if (!mapRef.current || isInitializedRef.current) return false;

    try {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [40.0, 116.4],
        zoom: 9,
        preferCanvas: true
      });

      isInitializedRef.current = true;

      return true;
    } catch (err) {
      setError('地图初始化失败: ' + err.message);
      return false;
    }
  }, []);

  const loadMapData = async () => {
  if (!mapInstanceRef.current) return;

  try {
    setIsLoading(true);
    setError(null);

    const layerUrls = [
      '/data/population.geojson',
      '/data/river.geojson',
      '/data/lake.geojson',
      '/data/ocean.geojson',
      '/data/urban.geojson'
    ];

    const layerJsons = await Promise.all(layerUrls.map(url =>
      fetch(url).then(res => {
        if (!res.ok) throw new Error(`请求失败: ${res.status}`);
        return res.json();
      })
    ));

    const getFeatureCenter = (feature) => {
      const coords = feature.geometry.coordinates;
      const type = feature.geometry.type;

      let latlngs = [];

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

      const bounds = L.latLngBounds(latlngs);
      return bounds.getCenter();
    };

    const layerNames = ['population', 'river', 'lake', 'ocean', 'urban'];
    const layerData = Object.fromEntries(layerNames.map((name, i) => [name, layerJsons[i]]));
    const allFeatures = [];

    layerNames.forEach(layerName => {
      const geojson = layerData[layerName];
      if (!geojson?.features) return;

      allFeatures.push(...geojson.features);

      // ✅ 特殊处理 population（使用圆点和贴标签）
      if (layerName === 'population') {
        const layer = L.geoJSON(geojson, {
          pointToLayer: (feature, latlng) => {
            const name = feature.properties?.NAME_ZH || feature.properties?.name || '';
            const marker = L.circleMarker(latlng, {
              radius: 5,
              fillColor: '#8C6D46',
              color: '#000',
              weight: 1,
              opacity: 1,
              fillOpacity: 1
            });

            if (name) {
              marker.bindTooltip(name, {
                permanent: true,
                direction: 'center',
                offset: [12, -12],
                className: 'label-tooltip'
              });
            }

            return marker;
          }
        });

        layer.addTo(mapInstanceRef.current);
        layersRef.current[layerName] = layer;
        return;
      }

      // ✅ 其他图层（lake、river等）使用默认样式 + 显示中文名
      const layer = L.geoJSON(geojson, {
        style: layerStyles[layerName],
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name_zh || feature.properties?.NAME_ZH || feature.properties?.name;
          if (name) {
            layer.bindPopup(`${layerName}: ${name}`);

            const center = getFeatureCenter(feature);
            if (center && ['river', 'lake'].includes(layerName)) {
              const label = L.tooltip({
                permanent: true,
                direction: 'center',
                className: 'label-tooltip'
              })
                .setLatLng(center)
                .setContent(name);
              label.addTo(mapInstanceRef.current);
            }
          }
        }
      });

      layer.addTo(mapInstanceRef.current);
      layersRef.current[layerName] = layer;
    });

    // 📷 relief.png 图层叠加
    const geojsonLayer = L.geoJSON({ type: "FeatureCollection", features: allFeatures });
    const bounds = geojsonLayer.getBounds();
    L.imageOverlay('/data/relief.png', bounds, { opacity: 0.5 }).addTo(mapInstanceRef.current);

    // 🔍 缩放到图层范围
    mapInstanceRef.current.fitBounds(bounds);

    updateMarkers();
    setIsLoading(false);
  } catch (err) {
    setError('加载地图数据失败: ' + err.message);
    setIsLoading(false);
  }
};
  // 添加地名标记
  const updateMarkers = useCallback(() => {
    if (!mapInstanceRef.current) return;

    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    locationData
      .filter(loc => selectedEventTypes[loc.eventType])
      .forEach(loc => {
        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: createCustomIcon(loc.eventType)
        });
        marker.bindPopup(`
          <div style="text-align: center;">
            <h3 style="margin: 0 0 5px;">${loc.name}</h3>
            <p style="margin: 0;">类型: ${loc.eventType}</p>
            <p style="margin: 0;">坐标: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}</p>
          </div>
        `);
        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      });
  }, [selectedEventTypes]);

  useEffect(() => {
  const success = initializeMap();
  console.log("地图初始化成功？", success);
  if (success) {
    loadMapData();
  }
  return () => {
    mapInstanceRef.current?.remove();
    isInitializedRef.current = false;
  };
}, []);


  useEffect(() => {
    if (isInitializedRef.current) {
      updateMarkers();
    }
  }, [selectedEventTypes, updateMarkers]);

  const toggleEventType = useCallback((type) => {
    setSelectedEventTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  }, []);



  return (
  <div className="w-full h-full flex flex-col">
    {/* 控制面板 */}
    <div className="p-2 bg-amber-50 border-b text-sm">
      <span className="mr-2">筛选事件类型:</span>
      {Object.entries(eventTypeColors).map(([type, color]) => (
        <label key={type} className="mr-3">
          <input
            type="checkbox"
            checked={selectedEventTypes[type]}
            onChange={() => toggleEventType(type)}
            className="mr-1"
          />
          <span style={{ color }}>{type}</span>
        </label>
      ))}
    </div>

    {/* 地图容器 */}
    <div
      ref={mapRef}
      className="flex-1 relative"
      style={{ minHeight: '500px', background: '#f0f0f0' }}
    >
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100 text-red-600 z-[1000]">
          错误: {error}
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60 z-[999]">
          正在加载地图...
        </div>
      )}
    </div>
  </div>
);


};

export default GeoChart;
