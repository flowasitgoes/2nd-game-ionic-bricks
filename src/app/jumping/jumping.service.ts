import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { JUMPING_CONFIG } from './jumping.config';

export enum GameState {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over'
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  scored: boolean; // 是否已经得分
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number; // 水平速度
  vy: number; // 垂直速度
  onGround: boolean;
}

export interface GameData {
  player: Player;
  platforms: Platform[];
  cameraY: number; // 摄像机位置（世界坐标）
  score: number;
  height: number; // 达到的高度
  gameTime: number; // 游戏时间（秒）
  state: GameState;
  canvasWidth: number;
  canvasHeight: number;
}

@Injectable({
  providedIn: 'root'
})
export class JumpingService {
  private gameData: GameData = {
    player: {
      x: 0,
      y: 0,
      width: JUMPING_CONFIG.player.width,
      height: JUMPING_CONFIG.player.height,
      vx: 0,
      vy: 0,
      onGround: false
    },
    platforms: [],
    cameraY: 0,
    score: 0,
    height: 0,
    gameTime: 0,
    state: GameState.MENU,
    canvasWidth: 0,
    canvasHeight: 0
  };

  private gameDataSubject = new BehaviorSubject<GameData>(this.gameData);
  public gameData$: Observable<GameData> = this.gameDataSubject.asObservable();

  private moveLeft = false;
  private moveRight = false;
  private jumpPressed = false;
  private canJump = true;

  constructor() {}

  initializeCanvas(width: number, height: number): void {
    this.gameData.canvasWidth = width;
    this.gameData.canvasHeight = height;
    this.resetGame();
  }

  resetGame(): void {
    const startX = this.gameData.canvasWidth / 2;
    const platformY = this.gameData.canvasHeight - 100;
    // 玩家应该站在平台上，所以玩家的底部 = 平台顶部
    // 玩家 y = 平台 y - 玩家 height
    const startY = platformY - JUMPING_CONFIG.player.height;

    this.gameData.player = {
      x: startX - JUMPING_CONFIG.player.width / 2, // 玩家中心对齐
      y: startY,
      width: JUMPING_CONFIG.player.width,
      height: JUMPING_CONFIG.player.height,
      vx: 0,
      vy: 0,
      onGround: true // 一开始就站在平台上
    };

    this.gameData.platforms = [];
    this.gameData.cameraY = 0;
    this.gameData.score = 0;
    this.gameData.height = 0;
    this.gameData.gameTime = 0;
    this.gameData.state = GameState.MENU;

    // 创建初始平台
    this.createInitialPlatforms();
    this.notify();
  }

  private createInitialPlatforms(): void {
    const canvasHeight = this.gameData.canvasHeight;
    const platformY = canvasHeight - 100;
    
    // 起始平台（玩家站立的平台）
    this.gameData.platforms.push({
      x: this.gameData.canvasWidth / 2 - 75,
      y: platformY,
      width: 150,
      height: JUMPING_CONFIG.platform.height,
      color: JUMPING_CONFIG.platform.colors[0],
      scored: false
    });

    // 生成更多平台
    this.generatePlatformsUpTo(canvasHeight + 2000);
  }

  private generatePlatformsUpTo(maxY: number): void {
    if (this.gameData.platforms.length === 0) return;

    const lastPlatform = this.gameData.platforms[this.gameData.platforms.length - 1];
    let currentY = lastPlatform.y;
    let lastX = lastPlatform.x + lastPlatform.width / 2; // 上一个平台的中心X

    while (currentY > maxY) {
      // 计算最大可跳距离
      // 跳跃高度 = (jumpSpeed^2) / (2 * gravity) ≈ 140
      // 考虑水平移动，最大水平距离约 200-250 像素
      const maxJumpDistance = 200; // 最大可跳距离（水平+垂直）
      
      const gap = JUMPING_CONFIG.platform.minGap + 
                  Math.random() * (JUMPING_CONFIG.platform.maxGap - JUMPING_CONFIG.platform.minGap);
      currentY -= gap;

      // 确保新平台在可跳范围内
      const width = JUMPING_CONFIG.platform.minWidth + 
                   Math.random() * (JUMPING_CONFIG.platform.maxWidth - JUMPING_CONFIG.platform.minWidth);
      
      // 计算新平台的位置，确保在可跳范围内
      const maxXOffset = Math.min(maxJumpDistance, this.gameData.canvasWidth - width);
      const xOffset = (Math.random() - 0.5) * maxXOffset * 0.8; // 限制偏移范围
      let x = lastX - width / 2 + xOffset;
      
      // 确保平台在屏幕内
      x = Math.max(0, Math.min(x, this.gameData.canvasWidth - width));
      
      const colorIndex = Math.floor(Math.random() * JUMPING_CONFIG.platform.colors.length);
      const newPlatform = {
        x,
        y: currentY,
        width,
        height: JUMPING_CONFIG.platform.height,
        color: JUMPING_CONFIG.platform.colors[colorIndex],
        scored: false
      };
      
      this.gameData.platforms.push(newPlatform);
      lastX = x + width / 2; // 更新上一个平台中心
    }
  }

  // 生成玩家下方的平台（安全网）
  private generatePlatformsBelow(): void {
    const player = this.gameData.player;
    const playerBottom = player.y + player.height;
    const cameraY = this.gameData.cameraY;
    const canvasHeight = this.gameData.canvasHeight;
    
    // 找到玩家下方最近的平台
    let lowestPlatformBelow: Platform | null = null;
    let lowestY = Infinity;
    
    for (const platform of this.gameData.platforms) {
      if (platform.y > playerBottom && platform.y < lowestY) {
        lowestY = platform.y;
        lowestPlatformBelow = platform;
      }
    }
    
    // 如果玩家下方没有平台，或者距离太远（超过屏幕高度），生成新平台
    const maxFallDistance = canvasHeight * 1.5; // 允许下落的最大距离
    if (!lowestPlatformBelow || (lowestPlatformBelow.y - playerBottom > maxFallDistance)) {
      // 在玩家下方生成一个平台
      const platformY = playerBottom + 300; // 在玩家下方300像素处
      const width = JUMPING_CONFIG.platform.minWidth + 
                   Math.random() * (JUMPING_CONFIG.platform.maxWidth - JUMPING_CONFIG.platform.minWidth);
      const x = Math.random() * (this.gameData.canvasWidth - width);
      
      const colorIndex = Math.floor(Math.random() * JUMPING_CONFIG.platform.colors.length);
      const newPlatform: Platform = {
        x,
        y: platformY,
        width,
        height: JUMPING_CONFIG.platform.height,
        color: JUMPING_CONFIG.platform.colors[colorIndex],
        scored: false
      };
      
      this.gameData.platforms.push(newPlatform);
    }
  }

  setMoveLeft(moving: boolean): void {
    this.moveLeft = moving;
  }

  setMoveRight(moving: boolean): void {
    this.moveRight = moving;
  }

  setJump(jumping: boolean): void {
    this.jumpPressed = jumping;
  }

  startGame(): void {
    if (this.gameData.state === GameState.MENU || this.gameData.state === GameState.GAME_OVER) {
      this.resetGame();
      this.gameData.state = GameState.PLAYING;
      this.notify();
    }
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

  update(): void {
    if (this.gameData.state !== GameState.PLAYING) {
      return;
    }

    // 更新游戏时间（假设每帧约16.67ms，即60fps）
    this.gameData.gameTime += 0.0167;

    const player = this.gameData.player;
    const config = JUMPING_CONFIG.player;

    // 处理水平移动
    if (this.moveLeft && !this.moveRight) {
      player.vx = -config.moveSpeed;
    } else if (this.moveRight && !this.moveLeft) {
      player.vx = config.moveSpeed;
    } else {
      player.vx = 0;
    }

    // 先应用重力（基于上一帧的状态）
    player.vy += config.gravity;
    if (player.vy > config.maxFallSpeed) {
      player.vy = config.maxFallSpeed;
    }

    // 为了防止快速下落时穿过平台，使用连续碰撞检测
    // 如果下落速度太快，分多步检测
    const maxStep = Math.max(1, Math.ceil(Math.abs(player.vy) / 10)); // 每10像素检测一次
    const stepSize = player.vy / maxStep;
    
    // 更新玩家位置（分步进行，每步都检测碰撞）
    player.x += player.vx;
    
    // 水平边界检测
    if (player.x < 0) {
      player.x = 0;
    } else if (player.x + player.width > this.gameData.canvasWidth) {
      player.x = this.gameData.canvasWidth - player.width;
    }
    
    // 垂直移动分步检测（防止穿墙）
    let hitPlatform = false;
    for (let step = 0; step < maxStep && !hitPlatform; step++) {
      const previousY = player.y;
      player.y += stepSize;
      
      // 每步都检测碰撞
      this.checkPlatformCollisions();
      
      // 如果已经站在平台上，停止移动
      if (player.onGround) {
        hitPlatform = true;
      }
    }
    
    // 处理跳跃（在碰撞检测之后，现在知道是否在地面上了）
    // 简化条件：只要在地面上就可以跳，或者如果下落速度很慢（接近地面）也可以跳
    if (this.jumpPressed && this.canJump) {
      // 如果在地面上，或者下落速度很慢（说明刚离开平台），可以跳跃
      if (player.onGround || (player.vy >= 0 && player.vy < 3)) {
        player.vy = config.jumpSpeed;
        player.onGround = false;
        this.canJump = false;
      }
    }

    // 如果释放跳跃键，重置 canJump（允许再次跳跃）
    if (!this.jumpPressed) {
      this.canJump = true;
    }

    // 更新摄像机位置（跟随玩家）
    const targetCameraY = player.y - this.gameData.canvasHeight * JUMPING_CONFIG.camera.offsetY;
    this.gameData.cameraY += (targetCameraY - this.gameData.cameraY) * JUMPING_CONFIG.camera.followSpeed;

    // 更新高度分数
    const newHeight = Math.max(this.gameData.height, -player.y);
    if (newHeight > this.gameData.height) {
      this.gameData.height = newHeight;
    }

    // 检查得分（踩到新平台）
    this.checkPlatformScoring();

    // 生成玩家下方的平台（安全网）
    this.generatePlatformsBelow();
    
    // 生成新平台（向上）
    const lowestPlatform = Math.min(...this.gameData.platforms.map(p => p.y));
    if (lowestPlatform > this.gameData.cameraY - this.gameData.canvasHeight) {
      this.generatePlatformsUpTo(lowestPlatform - 500);
    }
    
    // 如果玩家在向下移动，在其上方生成平台（让玩家可以跳回去）
    if (player.vy > 2 && player.y < this.gameData.cameraY + this.gameData.canvasHeight * 0.5) {
      const highestPlatform = Math.max(...this.gameData.platforms.map(p => p.y));
      // 如果玩家上方没有足够的平台，生成新的
      if (highestPlatform > player.y - 800) {
        this.generatePlatformsUpTo(player.y - 1000);
      }
    }

    // 移除屏幕外的平台（保留玩家附近的范围）
    const keepRange = this.gameData.canvasHeight * 3;
    this.gameData.platforms = this.gameData.platforms.filter(
      platform => platform.y < this.gameData.cameraY + keepRange &&
                  platform.y > this.gameData.cameraY - keepRange
    );

    // 检查游戏结束（掉出屏幕）
    const screenTop = this.gameData.cameraY;
    if (player.y > screenTop + this.gameData.canvasHeight) {
      this.gameData.state = GameState.GAME_OVER;
      this.saveHighScore();
    }

    this.notify();
  }

  private checkPlatformCollisions(): void {
    const player = this.gameData.player;
    player.onGround = false;

    for (const platform of this.gameData.platforms) {
      // 检查碰撞 - 使用更宽松和可靠的条件
      const playerBottom = player.y + player.height;
      const playerTop = player.y;
      const playerLeft = player.x;
      const playerRight = player.x + player.width;
      const platformTop = platform.y;
      const platformBottom = platform.y + platform.height;
      const platformLeft = platform.x;
      const platformRight = platform.x + platform.width;
      
      // 水平碰撞检测 - 玩家必须与平台有水平重叠
      const horizontalOverlap = playerRight > platformLeft &&
                                playerLeft < platformRight;
      
      // 检查玩家是否在平台上方或已经穿透平台
      // 玩家底部应该在平台顶部附近（允许50像素容差）
      const isOnTopOfPlatform = playerBottom >= platformTop - 50 && 
                                playerBottom <= platformTop + 20 &&
                                playerTop < platformTop;
      
      // 如果玩家从上方落下（或已经在平台上方）且水平重叠，则站在平台上
      if (horizontalOverlap && isOnTopOfPlatform && player.vy >= 0) {
        // 确保玩家站在平台上
        player.y = platform.y - player.height;
        player.vy = 0;
        player.onGround = true;
        break;
      }
      
      // 额外检查：如果玩家已经在平台内部（穿透检测）
      if (horizontalOverlap && 
          playerTop < platformBottom && 
          playerBottom > platformTop &&
          playerTop < platformTop &&
          player.vy >= 0) {
        // 修复位置，让玩家站在平台上
        player.y = platform.y - player.height;
        player.vy = 0;
        player.onGround = true;
        break;
      }
    }
  }

  private checkPlatformScoring(): void {
    const player = this.gameData.player;
    
    for (const platform of this.gameData.platforms) {
      if (!platform.scored && 
          player.onGround &&
          player.y >= platform.y - player.height - 1 &&
          player.y <= platform.y - player.height + 1 &&
          player.x + player.width > platform.x &&
          player.x < platform.x + platform.width) {
        
        platform.scored = true;
        this.gameData.score += JUMPING_CONFIG.score.pointsPerPlatform;
      }
    }
  }

  private saveHighScore(): void {
    const currentHigh = this.getHighScore();
    if (this.gameData.height > currentHigh) {
      localStorage.setItem('jumpingHighScore', this.gameData.height.toString());
    }
  }

  getHighScore(): number {
    const highScore = localStorage.getItem('jumpingHighScore');
    return highScore ? parseInt(highScore, 10) : 0;
  }

  private notify(): void {
    this.gameDataSubject.next({ ...this.gameData });
  }
}

