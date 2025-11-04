import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Fruit, GAME_CONFIG } from './game.config';

export enum GameState {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over'
}

export interface GameData {
  score: number;
  lives: number;
  basketX: number;
  fruits: Fruit[];
  state: GameState;
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private gameData: GameData = {
    score: 0,
    lives: GAME_CONFIG.lives,
    basketX: 0,
    fruits: [],
    state: GameState.MENU
  };

  private gameDataSubject = new BehaviorSubject<GameData>(this.gameData);
  public gameData$: Observable<GameData> = this.gameDataSubject.asObservable();

  private canvasWidth = 0;
  private canvasHeight = 0;
  private lastSpawnTime = 0;

  constructor() {}

  initializeCanvas(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.resetGame();
  }

  resetGame(): void {
    this.gameData.score = 0;
    this.gameData.lives = GAME_CONFIG.lives;
    this.gameData.basketX = (this.canvasWidth - GAME_CONFIG.basket.width) / 2;
    this.gameData.fruits = [];
    this.gameData.state = GameState.MENU;
    this.lastSpawnTime = 0;
    this.notify();
  }

  startGame(): void {
    if (this.gameData.state === GameState.MENU || this.gameData.state === GameState.GAME_OVER) {
      this.resetGame();
    }
    this.gameData.state = GameState.PLAYING;
    this.lastSpawnTime = Date.now();
    this.notify();
  }

  pauseGame(): void {
    if (this.gameData.state === GameState.PLAYING) {
      this.gameData.state = GameState.PAUSED;
      this.notify();
    }
  }

  resumeGame(): void {
    if (this.gameData.state === GameState.PAUSED) {
      this.gameData.state = GameState.PLAYING;
      this.lastSpawnTime = Date.now();
      this.notify();
    }
  }

  moveBasket(direction: 'left' | 'right'): void {
    if (this.gameData.state !== GameState.PLAYING) return;

    const speed = GAME_CONFIG.basket.speed;
    if (direction === 'left') {
      this.gameData.basketX -= speed;
    } else {
      this.gameData.basketX += speed;
    }

    // 限制篮子在画布范围内
    if (this.gameData.basketX < 0) {
      this.gameData.basketX = 0;
    } else if (this.gameData.basketX + GAME_CONFIG.basket.width > this.canvasWidth) {
      this.gameData.basketX = this.canvasWidth - GAME_CONFIG.basket.width;
    }

    this.notify();
  }

  updateGame(deltaTime: number): void {
    if (this.gameData.state !== GameState.PLAYING) return;

    const currentTime = Date.now();

    // 生成新水果
    if (currentTime - this.lastSpawnTime >= GAME_CONFIG.fruit.spawnInterval) {
      this.spawnFruit();
      this.lastSpawnTime = currentTime;
    }

    // 更新所有水果位置
    this.gameData.fruits = this.gameData.fruits.map(fruit => {
      if (fruit.caught || fruit.missed) {
        return fruit;
      }

      const newY = fruit.y + fruit.speed;
      
      // 检查是否漏接（到达底部）
      if (newY + fruit.size > this.canvasHeight) {
        fruit.missed = true;
        this.loseLife();
        return fruit;
      }

      // 检查是否接到水果
      const basketY = this.canvasHeight - 30;
      const basketTop = basketY - GAME_CONFIG.basket.height;
      
      if (newY + fruit.size >= basketTop &&
          newY <= basketY &&
          fruit.x + fruit.size >= this.gameData.basketX &&
          fruit.x <= this.gameData.basketX + GAME_CONFIG.basket.width) {
        fruit.caught = true;
        this.gameData.score += GAME_CONFIG.pointsPerFruit;
        this.notify();
        return fruit;
      }

      return {
        ...fruit,
        y: newY
      };
    });

    // 移除已捕获或漏接的水果（延迟移除以便显示效果）
    this.gameData.fruits = this.gameData.fruits.filter(fruit => {
      if (fruit.caught || fruit.missed) {
        // 延迟移除，让玩家看到效果
        return fruit.y < this.canvasHeight + 50;
      }
      return true;
    });

    this.notify();
  }

  private spawnFruit(): void {
    const size = GAME_CONFIG.fruit.minSize + 
                 Math.random() * (GAME_CONFIG.fruit.maxSize - GAME_CONFIG.fruit.minSize);
    const speed = GAME_CONFIG.fruit.minSpeed + 
                 Math.random() * (GAME_CONFIG.fruit.maxSpeed - GAME_CONFIG.fruit.minSpeed);
    const type = GAME_CONFIG.fruit.types[
      Math.floor(Math.random() * GAME_CONFIG.fruit.types.length)
    ];
    
    const fruit: Fruit = {
      x: Math.random() * (this.canvasWidth - size),
      y: -size,
      size: size,
      type: type,
      speed: speed,
      caught: false,
      missed: false
    };

    this.gameData.fruits.push(fruit);
  }

  private loseLife(): void {
    this.gameData.lives--;
    
    if (this.gameData.lives <= 0) {
      this.gameData.state = GameState.GAME_OVER;
    }

    this.notify();
  }

  getGameData(): GameData {
    return { ...this.gameData };
  }

  private notify(): void {
    this.gameDataSubject.next({ ...this.gameData });
  }
}

