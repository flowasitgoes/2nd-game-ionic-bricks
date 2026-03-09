// 歌曲配置
export interface Song {
  id: number;
  name: string;
  description: string;
  chordSequence: string[]; // 和弦序列（颜色代码）
  bpm: number; // 节拍速度
  difficulty: 'easy' | 'medium' | 'hard';
}

// 颜色到和弦的映射
export const COLOR_TO_CHORD: { [key: string]: string } = {
  '#4ECDC4': 'Cmaj7', // 青色
  '#FF6B6B': 'Am7',   // 红色
  '#FFD93D': 'G',     // 黄色
  '#95E1D3': 'Fmaj7', // 浅青色
  '#FFA07A': 'Dm7'    // 橘色
};

// 预设歌曲库
export const SONGS: Song[] = [
  {
    id: 1,
    name: '经典进行',
    description: '最经典的和弦进行 C-Am-F-G',
    chordSequence: ['#4ECDC4', '#FF6B6B', '#95E1D3', '#FFD93D'], // C-Am-F-G
    bpm: 120,
    difficulty: 'easy'
  },
  {
    id: 2,
    name: '小星星',
    description: 'C-C-G-G-F-F-G',
    chordSequence: [
      '#4ECDC4', '#4ECDC4', '#FFD93D', '#FFD93D',
      '#95E1D3', '#95E1D3', '#FFD93D'
    ],
    bpm: 100,
    difficulty: 'easy'
  },
  {
    id: 3,
    name: '卡农进行',
    description: '经典的卡农和弦进行',
    chordSequence: [
      '#4ECDC4', '#FFA07A', '#FF6B6B', '#FFD93D',
      '#95E1D3', '#FFD93D', '#FF6B6B', '#FFD93D'
    ], // C-Dm-Am-G-F-G-Am-G
    bpm: 110,
    difficulty: 'medium'
  },
  {
    id: 4,
    name: '流行进行',
    description: 'I-V-vi-IV 经典流行进行',
    chordSequence: [
      '#4ECDC4', '#FFD93D', '#FF6B6B', '#95E1D3'
    ], // C-G-Am-F
    bpm: 130,
    difficulty: 'easy'
  },
  {
    id: 5,
    name: '浪漫进行',
    description: '浪漫的和弦组合',
    chordSequence: [
      '#4ECDC4', '#FFA07A', '#95E1D3', '#FFD93D',
      '#FF6B6B', '#95E1D3', '#FFD93D', '#4ECDC4'
    ],
    bpm: 90,
    difficulty: 'medium'
  }
];

