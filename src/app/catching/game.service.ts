import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Fruit, Bird, GAME_CONFIG } from './game.config';
import { CatchGameSoundService } from './catch-game-sound.service';

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
  birds: Bird[];
  state: GameState;
  combo: number;
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
    birds: [],
    state: GameState.MENU,
    combo: 0
  };

  private gameDataSubject = new BehaviorSubject<GameData>(this.gameData);
  public gameData$: Observable<GameData> = this.gameDataSubject.asObservable();

  private canvasWidth = 0;
  private canvasHeight = 0;
  private lastSpawnTime = 0;
  private lastBirdSpawnTime = 0;
  private birdIdCounter = 0;

  constructor(private sound: CatchGameSoundService) {}

  initializeCanvas(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.resetGame();
  }

  resetGame(): void {
    this.gameData.score = 0;
    this.gameData.lives = GAME_CONFIG.lives;
    this.gameData.basketX = Math.max(0, (this.canvasWidth - GAME_CONFIG.basket.width) / 2);
    this.gameData.fruits = [];
    this.gameData.birds = [];
    this.gameData.combo = 0;
    this.gameData.state = GameState.MENU;
    this.lastSpawnTime = 0;
    this.lastBirdSpawnTime = 0;
    this.notify();
  }

  startGame(): void {
    if (this.gameData.state === GameState.MENU || this.gameData.state === GameState.GAME_OVER) {
      this.resetGame();
    }
    this.gameData.state = GameState.PLAYING;
    this.lastSpawnTime = Date.now();
    this.lastBirdSpawnTime = Date.now();
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
    this.clampBasket();
    this.notify();
  }

  setBasketPosition(centerX: number): void {
    if (this.gameData.state !== GameState.PLAYING && this.gameData.state !== GameState.PAUSED) return;
    const w = GAME_CONFIG.basket.width;
    this.gameData.basketX = centerX - w / 2;
    this.clampBasket();
    this.notify();
  }

  private clampBasket(): void {
    const w = GAME_CONFIG.basket.width;
    if (this.gameData.basketX < 0) this.gameData.basketX = 0;
    else if (this.gameData.basketX + w > this.canvasWidth) this.gameData.basketX = this.canvasWidth - w;
  }

  updateGame(deltaTime: number): void {
    if (this.gameData.state !== GameState.PLAYING) return;

    const currentTime = Date.now();

    // 生成新水果
    if (currentTime - this.lastSpawnTime >= GAME_CONFIG.fruit.spawnInterval) {
      this.spawnFruit();
      this.lastSpawnTime = currentTime;
    }

    // 生成小鳥
    if (currentTime - this.lastBirdSpawnTime >= GAME_CONFIG.bird.spawnInterval) {
      this.spawnBird();
      this.lastBirdSpawnTime = currentTime;
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
        this.gameData.combo = 0;
        this.sound.playMiss();
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
        this.gameData.combo++;
        const bonus = this.gameData.combo >= 2
          ? (this.gameData.combo - 1) * GAME_CONFIG.comboBonusPerHit
          : 0;
        this.gameData.score += GAME_CONFIG.pointsPerFruit + bonus;
        this.sound.playCatch();
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

    // 更新小鳥位置並檢測與籃子碰撞
    const basketY = this.canvasHeight - 30;
    const basketTop = basketY - GAME_CONFIG.basket.height;
    const bw = GAME_CONFIG.basket.width;
    const bx = this.gameData.basketX;

    this.gameData.birds = this.gameData.birds.filter(bird => {
      bird.wingPhase += 0.25;
      const wobble = (GAME_CONFIG.bird.verticalAmplitude * 0.02) * Math.sin(bird.wingPhase);
      bird.x += bird.vx;
      bird.y += bird.vy + wobble;

      if (bird.x + bird.width < 0 || bird.x > this.canvasWidth) return false;

      const birdLeft = bird.x;
      const birdRight = bird.x + bird.width;
      const birdTop = bird.y;
      const birdBottom = bird.y + bird.height;
      const basketLeft = bx;
      const basketRight = bx + bw;
      if (birdRight >= basketLeft && birdLeft <= basketRight && birdBottom >= basketTop && birdTop <= basketY) {
        this.sound.playBirdHit();
        this.loseLife();
        return false;
      }
      return true;
    });

    this.notify();
  }

  private spawnBird(): void {
    const cfg = GAME_CONFIG.bird;
    const speed = cfg.minSpeed + Math.random() * (cfg.maxSpeed - cfg.minSpeed);
    const fromLeft = Math.random() > 0.5;
    const bird: Bird = {
      id: this.birdIdCounter++,
      x: fromLeft ? -cfg.width : this.canvasWidth,
      y: 60 + Math.random() * (this.canvasHeight - 150),
      vx: fromLeft ? speed : -speed,
      vy: (Math.random() - 0.5) * 0.8,
      width: cfg.width,
      height: cfg.height,
      wingPhase: Math.random() * Math.PI * 2
    };
    this.gameData.birds.push(bird);
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
      missed: false,
      spawnedAt: Date.now()
    };

    this.gameData.fruits.push(fruit);
    this.sound.playFruitSpawn(fruit.type);
  }

  private loseLife(): void {
    this.gameData.lives--;
    if (this.gameData.lives <= 0) {
      this.gameData.state = GameState.GAME_OVER;
      this.sound.playGameOver();
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

