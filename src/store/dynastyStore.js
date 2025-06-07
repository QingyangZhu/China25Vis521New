// src/store/dynastyStore.js
import { create } from 'zustand';

// 朝代数据，按历史时间顺序排列
// 使用与背景配色协调的统一色系 - 基于古铜色调的渐变
export const dynastyData = [
  { id: 1, name: '远古', start: -3000, end: -2500, color: '#A0826B' },
  { id: 2, name: '上古', start: -2500, end: -2070, color: '#A5876E' },
  { id: 3, name: '夏', start: -2070, end: -1600, color: '#AA8C72' },
  { id: 4, name: '商', start: -1600, end: -1046, color: '#AF9175' },
  { id: 5, name: '先秦', start: -1046, end: -221, color: '#B49679' },
  { id: 6, name: '先秦-西周', start: -1046, end: -771, color: '#B19B7C', subOf: 5 },
  { id: 7, name: '先秦-东周', start: -770, end: -256, color: '#BDA080', subOf: 5 },
  { id: 8, name: '先秦-春秋', start: -770, end: -476, color: '#BAA583', subOf: 7 },
  { id: 9, name: '先秦-战国', start: -475, end: -221, color: '#C0AA87', subOf: 7 },
  { id: 10, name: '秦', start: -221, end: -207, color: '#B59B7D' },
  { id: 11, name: '汉', start: -202, end: 220, color: '#C2AF8A' },
  { id: 12, name: '汉-西汉', start: -202, end: 8, color: '#BFB48E', subOf: 11 },
  { id: 13, name: '汉-东汉', start: 25, end: 220, color: '#C5B991', subOf: 11 },
  { id: 14, name: '三国', start: 220, end: 280, color: '#CABE95' },
  { id: 15, name: '西晋', start: 265, end: 316, color: '#CFC398' },
  { id: 16, name: '十六国', start: 304, end: 439, color: '#D4C89C' },
  { id: 17, name: '南朝', start: 420, end: 589, color: '#D9CD9F' },
  { id: 18, name: '北朝', start: 386, end: 581, color: '#DED2A3' },
  { id: 19, name: '北朝-北魏', start: 386, end: 534, color: '#E3D7A6', subOf: 18 },
  { id: 20, name: '北朝-东魏', start: 534, end: 550, color: '#E8DCAA', subOf: 18 },
  { id: 21, name: '北朝-西魏', start: 535, end: 556, color: '#EDE1AD', subOf: 18 },
  { id: 22, name: '北朝-北齐', start: 550, end: 577, color: '#F2E6B1', subOf: 18 },
  { id: 23, name: '北朝-北周', start: 557, end: 581, color: '#F7EBB4', subOf: 18 },
  { id: 24, name: '隋', start: 581, end: 618, color: '#A88A6D' },
  { id: 25, name: '唐', start: 618, end: 907, color: '#AD8F70' },
  { id: 26, name: '五代十国', start: 907, end: 960, color: '#B29474' },
  { id: 27, name: '宋', start: 960, end: 1279, color: '#B79977' },
  { id: 28, name: '宋-北宋', start: 960, end: 1127, color: '#BC9E7B', subOf: 27 },
  { id: 29, name: '宋-南宋', start: 1127, end: 1279, color: '#C1A37E', subOf: 27 },
  { id: 30, name: '辽', start: 916, end: 1125, color: '#C6A882' },
  { id: 31, name: '金', start: 1115, end: 1234, color: '#CBAD85' },
  { id: 32, name: '元', start: 1271, end: 1368, color: '#D0B289' },
  { id: 33, name: '明', start: 1368, end: 1644, color: '#D5B78C' },
  { id: 34, name: '清', start: 1644, end: 1912, color: '#DABC90' },
  { id: 35, name: '近代', start: 1912, end: 1949, color: '#DFC193' },
  { id: 36, name: '近代-民国', start: 1912, end: 1949, color: '#E4C697', subOf: 35 },
  { id: 37, name: '现代', start: 1949, end: 2025, color: '#E9CB9A' }
];

// 创建Zustand store
const useDynastyStore = create((set, get) => ({
  // 选中的朝代列表（数组，支持单选）
  selectedDynasties: ['隋'],
  
  // 设置选中的朝代
  setSelectedDynasties: (dynasties) => set({ selectedDynasties: dynasties }),
  
  // 添加朝代到选中列表（单选模式）
  addDynasty: (dynasty) => {
    // 直接设置为单个朝代
    set({ selectedDynasties: [dynasty] });
  },
  
  // 从选中列表移除朝代（单选模式）
  removeDynasty: (dynasty) => {
    // 移除后自动设为overview
    set({ selectedDynasties: ['overview'] });
  },
  
  // 切换朝代选中状态（单选模式）
  toggleDynasty: (dynasty) => {
    const current = get().selectedDynasties;
    if (dynasty === 'overview') {
      // 点击overview，设置为overview状态
      set({ selectedDynasties: ['overview'] });
    } else {
      // 点击具体朝代
      if (current.includes(dynasty) && current.length === 1) {
        // 如果当前已选中该朝代且只选中了这一个，则切换到overview
        set({ selectedDynasties: ['overview'] });
      } else {
        // 否则选中该朝代（单选）
        set({ selectedDynasties: [dynasty] });
      }
    }
  },
  
  // 清除所有选择，回到overview
  clearSelection: () => set({ selectedDynasties: ['overview'] }),
  
  // 获取选中朝代的显示名称
  getSelectedDisplayNames: () => {
    const selected = get().selectedDynasties;
    if (selected.includes('overview')) {
      return ['全局总览'];
    }
    return selected;
  },
  
  // 获取第一个选中的朝代（用于向后兼容）
  getPrimaryDynasty: () => {
    const selected = get().selectedDynasties;
    return selected[0] || 'overview';
  },

  // 选中的交通路线信息
  selectedRoute: null,
  
  // 多选路线管理
  selectedRoutes: [], // 多选路线数组
  showAllRoutes: true, // true: 显示所有路线, false: 仅显示选中路线
  
  // 设置选中的交通路线（单选，向后兼容）
  setSelectedRoute: (routeInfo) => {
    console.log('🎯 Store: 设置选中路线', routeInfo);
    set({ selectedRoute: routeInfo });
  },
  
  // 切换路线的选中状态（多选）
  toggleRouteSelection: (routeInfo) => {
    const { selectedRoutes } = get();
    const isSelected = selectedRoutes.some(r => 
      r.routeName === routeInfo.routeName && r.dynasty === routeInfo.dynasty
    );
    
    if (isSelected) {
      // 取消选中
      set({ 
        selectedRoutes: selectedRoutes.filter(r => 
          !(r.routeName === routeInfo.routeName && r.dynasty === routeInfo.dynasty)
        )
      });
    } else {
      // 添加选中
      set({ selectedRoutes: [...selectedRoutes, routeInfo] });
    }
  },
  
  // 设置显示模式
  setShowAllRoutes: (showAll) => set({ showAllRoutes: showAll }),
  
  // 清除所有选中的路线
  clearAllSelectedRoutes: () => set({ selectedRoutes: [], selectedRoute: null }),
  
  // 清除选中的交通路线（向后兼容）
  clearSelectedRoute: () => {
    console.log('🎯 Store: 清除选中路线');
    set({ selectedRoute: null });
  },

  // 古城数据状态
  cityData: {
    warData: [],
    disasterData: [],
    eventData: [],
    loading: false
  },
  
  // 设置古城数据
  setCityData: (data) => set({ 
    cityData: { 
      ...get().cityData, 
      ...data 
    } 
  }),
  
  // 古城数据显示控制
  showCityDataInCharts: {
    war: false,
    disaster: false,
    event: false
  },
  
  // 设置古城数据显示状态
  setShowCityDataInCharts: (showStates) => set({
    showCityDataInCharts: { 
      ...get().showCityDataInCharts, 
      ...showStates 
    }
  })
}));

export default useDynastyStore;