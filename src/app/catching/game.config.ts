export interface Fruit {
  x: number;
  y: number;
  size: number;
  type: 'apple' | 'banana' | 'orange' | 'strawberry' | 'grape';
  speed: number;
  caught: boolean;
  missed: boolean;
  spawnedAt?: number;
}

export interface Bird {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  wingPhase: number;
}

export const GAME_CONFIG = {
  basket: {
    width: 110,
    height: 28,
    speed: 14
  },
  fruit: {
    minSize: 32,
    maxSize: 52,
    minSpeed: 1.0,
    maxSpeed: 2.2,
    spawnInterval: 3200,
    types: ['apple', 'banana', 'orange', 'strawberry', 'grape'] as const
  },
  bird: {
    width: 28,
    height: 18,
    minSpeed: 1.8,
    maxSpeed: 3.5,
    spawnInterval: 4000,
    verticalAmplitude: 25,
    verticalFrequency: 0.002
  },
  lives: 3,
  pointsPerFruit: 10,
  comboBonusPerHit: 2
};

