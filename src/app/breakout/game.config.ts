export interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  hit: boolean;
  points: number;
}

export interface LevelConfig {
  rows: number;
  cols: number;
  brickWidth: number;
  brickHeight: number;
  brickPadding: number;
  brickOffsetTop: number;
  brickOffsetLeft: number;
  colors: string[];
  points: number[];
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    rows: 3,
    cols: 5,
    brickWidth: 75,
    brickHeight: 20,
    brickPadding: 10,
    brickOffsetTop: 50,
    brickOffsetLeft: 35,
    colors: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
    points: [10, 20, 30]
  },
  {
    rows: 4,
    cols: 6,
    brickWidth: 70,
    brickHeight: 20,
    brickPadding: 10,
    brickOffsetTop: 50,
    brickOffsetLeft: 30,
    colors: ['#FF6B6B', '#FFA07A', '#4ECDC4', '#45B7D1'],
    points: [10, 15, 20, 25]
  },
  {
    rows: 5,
    cols: 7,
    brickWidth: 65,
    brickHeight: 18,
    brickPadding: 8,
    brickOffsetTop: 50,
    brickOffsetLeft: 25,
    colors: ['#FF6B6B', '#FFA07A', '#FFD93D', '#4ECDC4', '#45B7D1'],
    points: [10, 15, 20, 25, 30]
  },
  {
    rows: 6,
    cols: 8,
    brickWidth: 60,
    brickHeight: 18,
    brickPadding: 8,
    brickOffsetTop: 50,
    brickOffsetLeft: 20,
    colors: ['#FF6B6B', '#FF8E53', '#FFA07A', '#FFD93D', '#4ECDC4', '#45B7D1'],
    points: [10, 15, 20, 25, 30, 35]
  },
  {
    rows: 7,
    cols: 9,
    brickWidth: 55,
    brickHeight: 16,
    brickPadding: 7,
    brickOffsetTop: 50,
    brickOffsetLeft: 15,
    colors: ['#FF6B6B', '#FF8E53', '#FFA07A', '#FFD93D', '#95E1D3', '#4ECDC4', '#45B7D1'],
    points: [10, 15, 20, 25, 30, 35, 40]
  }
];

export const GAME_CONFIG = {
  paddle: {
    width: 100,
    height: 10,
    speed: 5
  },
  ball: {
    radius: 8,
    speed: 4
  },
  lives: 3,
  initialBallSpeedX: 4,
  initialBallSpeedY: -4
};

