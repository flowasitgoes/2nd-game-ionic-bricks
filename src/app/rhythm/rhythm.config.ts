// 节奏游戏配置
export interface Note {
  id: number;
  key: string; // 'A', 'S', 'D', 'F' 等
  time: number; // 时间点（秒）
  hit: boolean; // 是否已击中
  accuracy?: 'perfect' | 'great' | 'good' | 'miss'; // 准确度
}

export interface RhythmLevel {
  id: number;
  name: string;
  bpm: number; // 每分钟节拍数
  notes: Note[];
  duration: number; // 总时长（秒）
}

// 准确度判定阈值（毫秒）
export const ACCURACY_THRESHOLDS = {
  perfect: 50, // ±50ms
  great: 100,   // ±100ms
  good: 150     // ±150ms
};

// 按键配置
export const KEY_CONFIG = {
  keys: ['A', 'S', 'D', 'F'],
  colors: {
    'A': '#FF6B6B',
    'S': '#4ECDC4',
    'D': '#FFD93D',
    'F': '#95E1D3'
  }
};

// 评分系统
export const SCORE_CONFIG = {
  perfect: 100,
  great: 50,
  good: 25,
  miss: 0
};

// 评级系统
export const RANK_CONFIG = {
  S: { min: 0.95, name: 'S级 - 完美演奏！' },
  A: { min: 0.85, name: 'A级 - 优秀表现！' },
  B: { min: 0.70, name: 'B级 - 不错的表现！' },
  C: { min: 0.50, name: 'C级 - 继续努力！' },
  D: { min: 0.00, name: 'D级 - 多练习吧！' }
};

// 示例关卡数据
export const RHYTHM_LEVELS: RhythmLevel[] = [
  {
    id: 1,
    name: '入门练习',
    bpm: 120,
    duration: 30,
    notes: [
      { id: 1, key: 'A', time: 1.0, hit: false },
      { id: 2, key: 'S', time: 1.5, hit: false },
      { id: 3, key: 'D', time: 2.0, hit: false },
      { id: 4, key: 'F', time: 2.5, hit: false },
      { id: 5, key: 'A', time: 3.0, hit: false },
      { id: 6, key: 'S', time: 3.5, hit: false },
      { id: 7, key: 'D', time: 4.0, hit: false },
      { id: 8, key: 'F', time: 4.5, hit: false },
      { id: 9, key: 'A', time: 5.5, hit: false },
      { id: 10, key: 'S', time: 6.0, hit: false },
      { id: 11, key: 'D', time: 6.5, hit: false },
      { id: 12, key: 'F', time: 7.0, hit: false },
      { id: 13, key: 'A', time: 8.0, hit: false },
      { id: 14, key: 'S', time: 8.5, hit: false },
      { id: 15, key: 'D', time: 9.0, hit: false },
      { id: 16, key: 'F', time: 9.5, hit: false },
      { id: 17, key: 'A', time: 10.5, hit: false },
      { id: 18, key: 'S', time: 11.0, hit: false },
      { id: 19, key: 'D', time: 11.5, hit: false },
      { id: 20, key: 'F', time: 12.0, hit: false },
      { id: 21, key: 'A', time: 13.0, hit: false },
      { id: 22, key: 'S', time: 13.5, hit: false },
      { id: 23, key: 'D', time: 14.0, hit: false },
      { id: 24, key: 'F', time: 14.5, hit: false },
      { id: 25, key: 'A', time: 15.5, hit: false },
      { id: 26, key: 'S', time: 16.0, hit: false },
      { id: 27, key: 'D', time: 16.5, hit: false },
      { id: 28, key: 'F', time: 17.0, hit: false },
      { id: 29, key: 'A', time: 18.0, hit: false },
      { id: 30, key: 'S', time: 18.5, hit: false },
      { id: 31, key: 'D', time: 19.0, hit: false },
      { id: 32, key: 'F', time: 19.5, hit: false },
      { id: 33, key: 'A', time: 20.5, hit: false },
      { id: 34, key: 'S', time: 21.0, hit: false },
      { id: 35, key: 'D', time: 21.5, hit: false },
      { id: 36, key: 'F', time: 22.0, hit: false },
      { id: 37, key: 'A', time: 23.0, hit: false },
      { id: 38, key: 'S', time: 23.5, hit: false },
      { id: 39, key: 'D', time: 24.0, hit: false },
      { id: 40, key: 'F', time: 24.5, hit: false },
      { id: 41, key: 'A', time: 25.5, hit: false },
      { id: 42, key: 'S', time: 26.0, hit: false },
      { id: 43, key: 'D', time: 26.5, hit: false },
      { id: 44, key: 'F', time: 27.0, hit: false },
      { id: 45, key: 'A', time: 28.0, hit: false },
      { id: 46, key: 'S', time: 28.5, hit: false },
      { id: 47, key: 'D', time: 29.0, hit: false },
      { id: 48, key: 'F', time: 29.5, hit: false }
    ]
  },
  {
    id: 2,
    name: '进阶挑战',
    bpm: 140,
    duration: 45,
    notes: [
      { id: 1, key: 'A', time: 0.5, hit: false },
      { id: 2, key: 'S', time: 1.0, hit: false },
      { id: 3, key: 'D', time: 1.5, hit: false },
      { id: 4, key: 'F', time: 2.0, hit: false },
      { id: 5, key: 'A', time: 2.5, hit: false },
      { id: 6, key: 'S', time: 3.0, hit: false },
      { id: 7, key: 'D', time: 3.5, hit: false },
      { id: 8, key: 'F', time: 4.0, hit: false },
      { id: 9, key: 'A', time: 4.5, hit: false },
      { id: 10, key: 'S', time: 5.0, hit: false },
      { id: 11, key: 'D', time: 5.5, hit: false },
      { id: 12, key: 'F', time: 6.0, hit: false },
      { id: 13, key: 'A', time: 7.0, hit: false },
      { id: 14, key: 'S', time: 7.5, hit: false },
      { id: 15, key: 'D', time: 8.0, hit: false },
      { id: 16, key: 'F', time: 8.5, hit: false },
      { id: 17, key: 'A', time: 9.0, hit: false },
      { id: 18, key: 'S', time: 9.5, hit: false },
      { id: 19, key: 'D', time: 10.0, hit: false },
      { id: 20, key: 'F', time: 10.5, hit: false },
      { id: 21, key: 'A', time: 11.5, hit: false },
      { id: 22, key: 'S', time: 12.0, hit: false },
      { id: 23, key: 'D', time: 12.5, hit: false },
      { id: 24, key: 'F', time: 13.0, hit: false },
      { id: 25, key: 'A', time: 14.0, hit: false },
      { id: 26, key: 'S', time: 14.5, hit: false },
      { id: 27, key: 'D', time: 15.0, hit: false },
      { id: 28, key: 'F', time: 15.5, hit: false },
      { id: 29, key: 'A', time: 16.5, hit: false },
      { id: 30, key: 'S', time: 17.0, hit: false },
      { id: 31, key: 'D', time: 17.5, hit: false },
      { id: 32, key: 'F', time: 18.0, hit: false },
      { id: 33, key: 'A', time: 19.0, hit: false },
      { id: 34, key: 'S', time: 19.5, hit: false },
      { id: 35, key: 'D', time: 20.0, hit: false },
      { id: 36, key: 'F', time: 20.5, hit: false },
      { id: 37, key: 'A', time: 21.5, hit: false },
      { id: 38, key: 'S', time: 22.0, hit: false },
      { id: 39, key: 'D', time: 22.5, hit: false },
      { id: 40, key: 'F', time: 23.0, hit: false },
      { id: 41, key: 'A', time: 24.0, hit: false },
      { id: 42, key: 'S', time: 24.5, hit: false },
      { id: 43, key: 'D', time: 25.0, hit: false },
      { id: 44, key: 'F', time: 25.5, hit: false },
      { id: 45, key: 'A', time: 26.5, hit: false },
      { id: 46, key: 'S', time: 27.0, hit: false },
      { id: 47, key: 'D', time: 27.5, hit: false },
      { id: 48, key: 'F', time: 28.0, hit: false },
      { id: 49, key: 'A', time: 29.0, hit: false },
      { id: 50, key: 'S', time: 29.5, hit: false },
      { id: 51, key: 'D', time: 30.0, hit: false },
      { id: 52, key: 'F', time: 30.5, hit: false },
      { id: 53, key: 'A', time: 31.5, hit: false },
      { id: 54, key: 'S', time: 32.0, hit: false },
      { id: 55, key: 'D', time: 32.5, hit: false },
      { id: 56, key: 'F', time: 33.0, hit: false },
      { id: 57, key: 'A', time: 34.0, hit: false },
      { id: 58, key: 'S', time: 34.5, hit: false },
      { id: 59, key: 'D', time: 35.0, hit: false },
      { id: 60, key: 'F', time: 35.5, hit: false },
      { id: 61, key: 'A', time: 36.5, hit: false },
      { id: 62, key: 'S', time: 37.0, hit: false },
      { id: 63, key: 'D', time: 37.5, hit: false },
      { id: 64, key: 'F', time: 38.0, hit: false },
      { id: 65, key: 'A', time: 39.0, hit: false },
      { id: 66, key: 'S', time: 39.5, hit: false },
      { id: 67, key: 'D', time: 40.0, hit: false },
      { id: 68, key: 'F', time: 40.5, hit: false },
      { id: 69, key: 'A', time: 41.5, hit: false },
      { id: 70, key: 'S', time: 42.0, hit: false },
      { id: 71, key: 'D', time: 42.5, hit: false },
      { id: 72, key: 'F', time: 43.0, hit: false },
      { id: 73, key: 'A', time: 44.0, hit: false },
      { id: 74, key: 'S', time: 44.5, hit: false }
    ]
  }
];

