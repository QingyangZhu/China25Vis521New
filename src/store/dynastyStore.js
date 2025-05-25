// src/store/dynastyStore.js
import { create } from 'zustand';

// 朝代数据，按历史时间顺序排列
export const dynastyData = [
  { id: 1, name: '远古', start: -3000, end: -2500, color: '#8B4513' },
  { id: 2, name: '上古', start: -2500, end: -2070, color: '#A0522D' },
  { id: 3, name: '夏', start: -2070, end: -1600, color: '#CD853F' },
  { id: 4, name: '商', start: -1600, end: -1046, color: '#D2691E' },
  { id: 5, name: '先秦', start: -1046, end: -221, color: '#DEB887' },
  { id: 6, name: '先秦-西周', start: -1046, end: -771, color: '#F4A460', subOf: 5 },
  { id: 7, name: '先秦-东周', start: -770, end: -256, color: '#DAA520', subOf: 5 },
  { id: 8, name: '先秦-春秋', start: -770, end: -476, color: '#B8860B', subOf: 7 },
  { id: 9, name: '先秦-战国', start: -475, end: -221, color: '#9ACD32', subOf: 7 },
  { id: 10, name: '秦', start: -221, end: -207, color: '#556B2F' },
  { id: 11, name: '汉', start: -202, end: 220, color: '#6B8E23' },
  { id: 12, name: '汉-西汉', start: -202, end: 8, color: '#8FBC8F', subOf: 11 },
  { id: 13, name: '汉-东汉', start: 25, end: 220, color: '#98FB98', subOf: 11 },
  { id: 14, name: '三国', start: 220, end: 280, color: '#90EE90' },
  { id: 15, name: '西晋', start: 265, end: 316, color: '#87CEEB' },
  { id: 16, name: '十六国', start: 304, end: 439, color: '#4682B4' },
  { id: 17, name: '南朝', start: 420, end: 589, color: '#1E90FF' },
  { id: 18, name: '北朝', start: 386, end: 581, color: '#0000CD' },
  { id: 19, name: '北朝-北魏', start: 386, end: 534, color: '#4169E1', subOf: 18 },
  { id: 20, name: '北朝-东魏', start: 534, end: 550, color: '#6495ED', subOf: 18 },
  { id: 21, name: '北朝-西魏', start: 535, end: 556, color: '#7B68EE', subOf: 18 },
  { id: 22, name: '北朝-北齐', start: 550, end: 577, color: '#9370DB', subOf: 18 },
  { id: 23, name: '北朝-北周', start: 557, end: 581, color: '#8A2BE2', subOf: 18 },
  { id: 24, name: '隋', start: 581, end: 618, color: '#9932CC' },
  { id: 25, name: '唐', start: 618, end: 907, color: '#BA55D3' },
  { id: 26, name: '五代十国', start: 907, end: 960, color: '#DA70D6' },
  { id: 27, name: '宋', start: 960, end: 1279, color: '#FF1493' },
  { id: 28, name: '宋-北宋', start: 960, end: 1127, color: '#FF69B4', subOf: 27 },
  { id: 29, name: '宋-南宋', start: 1127, end: 1279, color: '#FFB6C1', subOf: 27 },
  { id: 30, name: '辽', start: 916, end: 1125, color: '#DC143C' },
  { id: 31, name: '金', start: 1115, end: 1234, color: '#B22222' },
  { id: 32, name: '元', start: 1271, end: 1368, color: '#8B0000' },
  { id: 33, name: '明', start: 1368, end: 1644, color: '#FF4500' },
  { id: 34, name: '清', start: 1644, end: 1912, color: '#FF6347' },
  { id: 35, name: '近代', start: 1912, end: 1949, color: '#FF7F50' },
  { id: 36, name: '近代-民国', start: 1912, end: 1949, color: '#FFA500', subOf: 35 },
  { id: 37, name: '现代', start: 1949, end: 2025, color: '#FFD700' }
];

// 创建Zustand store
const useDynastyStore = create((set, get) => ({
  // 选中的朝代列表（数组，支持多选）
  selectedDynasties: ['overview'],
  
  // 设置选中的朝代
  setSelectedDynasties: (dynasties) => set({ selectedDynasties: dynasties }),
  
  // 添加朝代到选中列表
  addDynasty: (dynasty) => {
    const current = get().selectedDynasties;
    // 如果选择了overview，则清除overview
    if (current.includes('overview')) {
      set({ selectedDynasties: [dynasty] });
    } else {
      // 如果朝代不在列表中，则添加
      if (!current.includes(dynasty)) {
        set({ selectedDynasties: [...current, dynasty] });
      }
    }
  },
  
  // 从选中列表移除朝代
  removeDynasty: (dynasty) => {
    const current = get().selectedDynasties;
    const newSelection = current.filter(d => d !== dynasty);
    // 如果移除后没有选中任何朝代，则设为overview
    set({ 
      selectedDynasties: newSelection.length === 0 ? ['overview'] : newSelection 
    });
  },
  
  // 切换朝代选中状态
  toggleDynasty: (dynasty) => {
    const current = get().selectedDynasties;
    if (dynasty === 'overview') {
      // 如果点击overview，则清除所有选择
      set({ selectedDynasties: ['overview'] });
    } else {
      // 如果当前是overview状态，则切换到指定朝代
      if (current.includes('overview')) {
        set({ selectedDynasties: [dynasty] });
      } else {
        // 否则切换朝代的选中状态
        if (current.includes(dynasty)) {
          get().removeDynasty(dynasty);
        } else {
          get().addDynasty(dynasty);
        }
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
  }
}));

export default useDynastyStore;