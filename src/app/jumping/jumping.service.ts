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
  maxHeight: number; // 曾经达到的最高高度
  fallDistance: number; // 当前坠落距离
}

export interface EffectEvent {
  type: 'platform_land' | 'rainbow_encourage';
  platformColor?: string;
  x: number;
  y: number;
  timestamp: number;
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
    maxHeight: 0,
    fallDistance: 0,
    state: GameState.MENU,
    canvasWidth: 0,
    canvasHeight: 0
  };

  private effectEvents: EffectEvent[] = [];
  private previousHeight: number = 0;
  private previousOnGround: boolean = false;

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
    this.gameData.maxHeight = 0;
    this.gameData.fallDistance = 0;
    this.gameData.gameTime = 0;
    this.gameData.state = GameState.MENU;
    this.previousHeight = 0;
    this.previousOnGround = false;
    this.effectEvents = [];

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

    // 找到最上方的平台（Y值最小的）
    const highestPlatform = this.gameData.platforms.reduce((prev, curr) => 
      curr.y < prev.y ? curr : prev
    );
    
    let currentY = highestPlatform.y;
    let lastX = highestPlatform.x + highestPlatform.width / 2; // 上一个平台的中心X
    let attempts = 0;
    const maxAttempts = 1000; // 防止无限循环

    while (currentY > maxY && attempts < maxAttempts) {
      attempts++;
      
      // 计算最大可跳距离
      const maxJumpDistance = 200;
      
      // 保持间距在可跳范围内（60-120像素）
      const gap = JUMPING_CONFIG.platform.minGap + 
                  Math.random() * (JUMPING_CONFIG.platform.maxGap - JUMPING_CONFIG.platform.minGap);
      currentY -= gap;

      // 确保新平台在可跳范围内
      const width = JUMPING_CONFIG.platform.minWidth + 
                   Math.random() * (JUMPING_CONFIG.platform.maxWidth - JUMPING_CONFIG.platform.minWidth);
      
      // 计算新平台的位置，确保在可跳范围内
      const maxXOffset = Math.min(maxJumpDistance, this.gameData.canvasWidth - width);
      const xOffset = (Math.random() - 0.5) * maxXOffset * 0.8;
      let x = lastX - width / 2 + xOffset;
      
      // 确保平台在屏幕内
      x = Math.max(0, Math.min(x, this.gameData.canvasWidth - width));
      
      // 检查新平台是否与现有平台重叠
      // 重叠判断：垂直距离小于30像素（平台高度20 + 小间隙）且水平重叠
      const overlapThreshold = 30; // 真正的重叠阈值，比 minGap 小得多
      const overlaps = this.gameData.platforms.some(platform => {
        const verticalDistance = Math.abs(platform.y - currentY);
        const horizontalOverlap = !(x + width < platform.x || x > platform.x + platform.width);
        // 只有真正的重叠才跳过（垂直距离很小且水平重叠）
        return verticalDistance < overlapThreshold && horizontalOverlap;
      });
      
      // 如果真正重叠，尝试调整X位置而不是跳过
      if (overlaps) {
        // 尝试调整X位置避免重叠
        let adjustedX = x;
        let foundPosition = false;
        for (let tryX = 0; tryX < this.gameData.canvasWidth - width; tryX += 20) {
          adjustedX = tryX;
          const stillOverlaps = this.gameData.platforms.some(platform => {
            const verticalDistance = Math.abs(platform.y - currentY);
            const horizontalOverlap = !(adjustedX + width < platform.x || adjustedX > platform.x + platform.width);
            return verticalDistance < overlapThreshold && horizontalOverlap;
          });
          if (!stillOverlaps) {
            x = adjustedX;
            foundPosition = true;
            break;
          }
        }
        // 如果调整X位置后仍然重叠，才跳过这个平台
        if (!foundPosition) {
          continue; // 跳过这个位置，但 currentY 已经减少了，所以间距会保持
        }
      }
      
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
    const maxFallDistance = canvasHeight * 1.5;
    if (!lowestPlatformBelow || (lowestPlatformBelow.y - playerBottom > maxFallDistance)) {
      // 在玩家下方生成一个平台
      const platformY = playerBottom + 300;
      const width = JUMPING_CONFIG.platform.minWidth + 
                   Math.random() * (JUMPING_CONFIG.platform.maxWidth - JUMPING_CONFIG.platform.minWidth);
      
      // 尝试生成不重叠的平台位置
      let x = Math.random() * (this.gameData.canvasWidth - width);
      let attempts = 0;
      const maxAttempts = 20;
      
      // 检查是否与现有平台重叠（使用更合理的重叠阈值）
      while (attempts < maxAttempts) {
        const overlaps = this.gameData.platforms.some(platform => {
          const verticalDistance = Math.abs(platform.y - platformY);
          const horizontalOverlap = !(x + width < platform.x || x > platform.x + platform.width);
          // 只有真正的重叠才需要调整（垂直距离小于30像素）
          return verticalDistance < 30 && horizontalOverlap;
        });
        
        if (!overlaps) {
          break; // 找到不重叠的位置
        }
        
        // 尝试新位置
        x = Math.random() * (this.gameData.canvasWidth - width);
        attempts++;
      }
      
      // 确保在屏幕内
      x = Math.max(0, Math.min(x, this.gameData.canvasWidth - width));
      
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
    // 必须严格站在平台上才能跳跃
    if (this.jumpPressed && this.canJump) {
      // 只有在平台上才能跳跃（移除容差，防止空中连续跳跃）
      if (player.onGround) {
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

    // 更新高度和坠落距离
    const currentHeight = -player.y;
    const newMaxHeight = Math.max(this.gameData.maxHeight, currentHeight);
    
    // 更新最高高度（记录历史最高）
    if (newMaxHeight > this.gameData.maxHeight) {
      this.gameData.maxHeight = newMaxHeight;
      this.gameData.fallDistance = 0; // 到达新高度，重置坠落距离
    }
    
    // 更新当前显示高度（实时反映玩家位置）
    if (currentHeight > this.gameData.height) {
      // 往上爬时，高度增加
      this.gameData.height = currentHeight;
      this.gameData.fallDistance = 0; // 上升时重置坠落距离
    } else if (currentHeight < this.gameData.height) {
      // 如果高度下降，增加坠落距离并扣除高度
      this.gameData.fallDistance += this.gameData.height - currentHeight;
      this.gameData.height = currentHeight;
    }
    
    // 检测平台着陆并触发特效
    this.checkPlatformLanding();
    
    // 检查得分（踩到新平台）
    this.checkPlatformScoring();

    // 生成玩家下方的平台（安全网）
    this.generatePlatformsBelow();
    
    // 生成新平台（向上）- 只生成一次，避免重复
    const lowestPlatform = this.gameData.platforms.length > 0 
      ? Math.min(...this.gameData.platforms.map(p => p.y))
      : this.gameData.cameraY;
    
    // 只在需要时生成新平台（距离相机一定范围）
    if (lowestPlatform > this.gameData.cameraY - this.gameData.canvasHeight * 0.5) {
      this.generatePlatformsUpTo(lowestPlatform - 800); // 生成更多平台
    }
    
    // 如果玩家在向下移动，在其上方生成平台（让玩家可以跳回去）
    if (player.vy > 2 && player.y < this.gameData.cameraY + this.gameData.canvasHeight * 0.5) {
      const highestPlatform = this.gameData.platforms.length > 0
        ? Math.max(...this.gameData.platforms.map(p => p.y))
        : player.y;
      // 如果玩家上方没有足够的平台，生成新的
      if (highestPlatform > player.y - 1000) {
        this.generatePlatformsUpTo(player.y - 1200);
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

  private checkPlatformLanding(): void {
    const player = this.gameData.player;
    
    // 检测刚着陆到平台（从不在平台上变为在平台上）
    if (!this.previousOnGround && player.onGround) {
      // 找到玩家当前站立的平台
      for (const platform of this.gameData.platforms) {
        const playerBottom = player.y + player.height;
        const isOnPlatform = Math.abs(playerBottom - platform.y) < 5 &&
                           player.x + player.width > platform.x &&
                           player.x < platform.x + platform.width;
        
        if (isOnPlatform) {
          // 检查是否是黄色或橘色平台
          const isYellow = platform.color === '#FFD93D';
          const isOrange = platform.color === '#FFA07A';
          
          // 只有黄色或橘色平台才触发流星特效
          if (isYellow || isOrange) {
            this.effectEvents.push({
              type: 'platform_land',
              platformColor: platform.color,
              x: platform.x + platform.width / 2,
              y: platform.y,
              timestamp: this.gameData.gameTime
            });
          }
          
          // 如果坠落超过500米后重新站到平台，触发彩虹鼓励特效
          if (this.gameData.fallDistance > 500) {
            this.effectEvents.push({
              type: 'rainbow_encourage',
              x: player.x + player.width / 2,
              y: player.y + player.height / 2,
              timestamp: this.gameData.gameTime
            });
            this.gameData.fallDistance = 0; // 重置坠落距离
          }
          
          break;
        }
      }
    }
    
    this.previousOnGround = player.onGround;
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

  getEffectEvents(): EffectEvent[] {
    return this.effectEvents;
  }

  clearEffectEvents(): void {
    this.effectEvents = [];
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

