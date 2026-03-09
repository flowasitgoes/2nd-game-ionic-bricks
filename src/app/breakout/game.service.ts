import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Brick, LevelConfig, LEVEL_CONFIGS, GAME_CONFIG } from './game.config';

export enum GameState {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over',
  VICTORY = 'victory'
}

export interface GameData {
  score: number;
  lives: number;
  currentLevel: number;
  bricks: Brick[];
  paddleX: number;
  ballX: number;
  ballY: number;
  ballSpeedX: number;
  ballSpeedY: number;
  state: GameState;
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private gameData: GameData = {
    score: 0,
    lives: GAME_CONFIG.lives,
    currentLevel: 0,
    bricks: [],
    paddleX: 0,
    ballX: 0,
    ballY: 0,
    ballSpeedX: GAME_CONFIG.initialBallSpeedX,
    ballSpeedY: GAME_CONFIG.initialBallSpeedY,
    state: GameState.MENU
  };

  private gameDataSubject = new BehaviorSubject<GameData>(this.gameData);
  public gameData$: Observable<GameData> = this.gameDataSubject.asObservable();

  private canvasWidth = 0;
  private canvasHeight = 0;

  constructor() {}

  initializeCanvas(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.resetGame();
  }

  resetGame(): void {
    this.gameData.score = 0;
    this.gameData.lives = GAME_CONFIG.lives;
    this.gameData.currentLevel = 0;
    this.gameData.paddleX = (this.canvasWidth - GAME_CONFIG.paddle.width) / 2;
    this.gameData.ballX = this.canvasWidth / 2;
    this.gameData.ballY = this.canvasHeight - 50;
    this.gameData.ballSpeedX = GAME_CONFIG.initialBallSpeedX;
    this.gameData.ballSpeedY = GAME_CONFIG.initialBallSpeedY;
    this.gameData.state = GameState.MENU;
    this.loadLevel(this.gameData.currentLevel);
    this.notify();
  }

  loadLevel(levelIndex: number): void {
    if (levelIndex >= LEVEL_CONFIGS.length) {
      this.gameData.state = GameState.VICTORY;
      this.notify();
      return;
    }

    const config = LEVEL_CONFIGS[levelIndex];
    this.gameData.currentLevel = levelIndex;
    this.gameData.bricks = [];

    // 根据画布宽度动态调整砖块大小和位置
    const scale = Math.min(this.canvasWidth / 400, 1.2); // 以 400px 为基准
    const brickWidth = config.brickWidth * scale;
    const brickHeight = config.brickHeight * scale;
    const brickPadding = config.brickPadding * scale;
    const totalWidth = config.cols * brickWidth + (config.cols - 1) * brickPadding;
    const brickOffsetLeft = (this.canvasWidth - totalWidth) / 2;

    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.cols; col++) {
        const brickX = col * (brickWidth + brickPadding) + brickOffsetLeft;
        const brickY = row * (brickHeight + brickPadding) + config.brickOffsetTop;
        
        this.gameData.bricks.push({
          x: brickX,
          y: brickY,
          width: brickWidth,
          height: brickHeight,
          color: config.colors[row % config.colors.length],
          hit: false,
          points: config.points[row % config.points.length]
        });
      }
    }

    this.notify();
  }

  startGame(): void {
    if (this.gameData.state === GameState.MENU || this.gameData.state === GameState.GAME_OVER) {
      this.resetGame();
    }
    this.gameData.state = GameState.PLAYING;
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
      this.notify();
    }
  }

  movePaddle(deltaX: number): void {
    if (this.gameData.state !== GameState.PLAYING) return;

    this.gameData.paddleX += deltaX;
    
    // 限制挡板在画布范围内
    if (this.gameData.paddleX < 0) {
      this.gameData.paddleX = 0;
    } else if (this.gameData.paddleX + GAME_CONFIG.paddle.width > this.canvasWidth) {
      this.gameData.paddleX = this.canvasWidth - GAME_CONFIG.paddle.width;
    }

    this.notify();
  }

  updateBall(): void {
    if (this.gameData.state !== GameState.PLAYING) return;

    // 更新小球位置
    this.gameData.ballX += this.gameData.ballSpeedX;
    this.gameData.ballY += this.gameData.ballSpeedY;

    // 检测与墙壁的碰撞（左右）
    if (this.gameData.ballX - GAME_CONFIG.ball.radius <= 0 || 
        this.gameData.ballX + GAME_CONFIG.ball.radius >= this.canvasWidth) {
      this.gameData.ballSpeedX = -this.gameData.ballSpeedX;
    }

    // 检测与顶部墙壁的碰撞
    if (this.gameData.ballY - GAME_CONFIG.ball.radius <= 0) {
      this.gameData.ballSpeedY = -this.gameData.ballSpeedY;
    }

    // 检测与底部的碰撞（失去生命）
    if (this.gameData.ballY + GAME_CONFIG.ball.radius >= this.canvasHeight) {
      this.loseLife();
      return;
    }

    // 检测与挡板的碰撞
    this.checkPaddleCollision();

    // 检测与砖块的碰撞
    this.checkBrickCollision();

    this.notify();
  }

  private checkPaddleCollision(): void {
    const ball = {
      x: this.gameData.ballX,
      y: this.gameData.ballY,
      radius: GAME_CONFIG.ball.radius
    };

    const paddle = {
      x: this.gameData.paddleX,
      y: this.canvasHeight - 30,
      width: GAME_CONFIG.paddle.width,
      height: GAME_CONFIG.paddle.height
    };

    // 检查小球是否在挡板范围内
    if (ball.x + ball.radius >= paddle.x &&
        ball.x - ball.radius <= paddle.x + paddle.width &&
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height &&
        this.gameData.ballSpeedY > 0) {
      
      // 计算碰撞点在挡板上的位置（0-1），影响反弹角度
      const hitPos = (ball.x - paddle.x) / paddle.width;
      const angle = (hitPos - 0.5) * Math.PI / 3; // -60° 到 +60°
      
      const speed = Math.sqrt(
        this.gameData.ballSpeedX * this.gameData.ballSpeedX +
        this.gameData.ballSpeedY * this.gameData.ballSpeedY
      );

      this.gameData.ballSpeedX = Math.sin(angle) * speed;
      this.gameData.ballSpeedY = -Math.abs(Math.cos(angle) * speed);
      
      // 确保小球在挡板上方
      this.gameData.ballY = paddle.y - ball.radius;
    }
  }

  private checkBrickCollision(): void {
    const ball = {
      x: this.gameData.ballX,
      y: this.gameData.ballY,
      radius: GAME_CONFIG.ball.radius
    };

    for (const brick of this.gameData.bricks) {
      if (brick.hit) continue;

      // AABB 碰撞检测
      if (ball.x + ball.radius >= brick.x &&
          ball.x - ball.radius <= brick.x + brick.width &&
          ball.y + ball.radius >= brick.y &&
          ball.y - ball.radius <= brick.y + brick.height) {
        
        brick.hit = true;
        this.gameData.score += brick.points;

        // 确定碰撞方向（从哪一边碰撞）
        const ballCenterX = ball.x;
        const ballCenterY = ball.y;
        const brickCenterX = brick.x + brick.width / 2;
        const brickCenterY = brick.y + brick.height / 2;

        const dx = ballCenterX - brickCenterX;
        const dy = ballCenterY - brickCenterY;

        // 根据碰撞方向反弹
        if (Math.abs(dx) > Math.abs(dy)) {
          this.gameData.ballSpeedX = -this.gameData.ballSpeedX;
        } else {
          this.gameData.ballSpeedY = -this.gameData.ballSpeedY;
        }

        // 检查是否所有砖块都被消除
        if (this.gameData.bricks.every(b => b.hit)) {
          this.nextLevel();
        }

        this.notify();
        return;
      }
    }
  }

  private loseLife(): void {
    this.gameData.lives--;
    
    if (this.gameData.lives <= 0) {
      this.gameData.state = GameState.GAME_OVER;
    } else {
      // 重置小球位置
      this.gameData.ballX = this.canvasWidth / 2;
      this.gameData.ballY = this.canvasHeight - 50;
      this.gameData.ballSpeedX = GAME_CONFIG.initialBallSpeedX;
      this.gameData.ballSpeedY = GAME_CONFIG.initialBallSpeedY;
    }

    this.notify();
  }

  private nextLevel(): void {
    this.gameData.currentLevel++;
    
    // 重置小球位置
    this.gameData.ballX = this.canvasWidth / 2;
    this.gameData.ballY = this.canvasHeight - 50;
    this.gameData.ballSpeedX = GAME_CONFIG.initialBallSpeedX;
    this.gameData.ballSpeedY = GAME_CONFIG.initialBallSpeedY;
    
    this.loadLevel(this.gameData.currentLevel);
  }

  getGameData(): GameData {
    return { ...this.gameData };
  }

  private notify(): void {
    this.gameDataSubject.next({ ...this.gameData });
  }
}

