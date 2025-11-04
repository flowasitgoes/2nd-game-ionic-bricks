export interface Fruit {
  x: number;
  y: number;
  size: number;
  type: 'apple' | 'banana' | 'orange' | 'strawberry' | 'grape';
  speed: number;
  caught: boolean;
  missed: boolean;
}

export const GAME_CONFIG = {
  basket: {
    width: 80,
    height: 20,
    speed: 5
  },
  fruit: {
    minSize: 20,
    maxSize: 35,
    minSpeed: 2,
    maxSpeed: 5,
    spawnInterval: 1500, // 毫秒
    types: ['apple', 'banana', 'orange', 'strawberry', 'grape'] as const
  },
  lives: 3,
  pointsPerFruit: 10
};

