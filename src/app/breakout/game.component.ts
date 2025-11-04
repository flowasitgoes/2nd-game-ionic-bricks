import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { GameService, GameState } from './game.service';
import { Subscription } from 'rxjs';
import { GAME_CONFIG } from './game.config';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
}

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  standalone: false
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  private gameSubscription!: Subscription;
  gameData: any = {
    score: 0,
    lives: 3,
    currentLevel: 0,
    bricks: [],
    paddleX: 0,
    ballX: 0,
    ballY: 0,
    ballSpeedX: 4,
    ballSpeedY: -4,
    state: GameState.MENU
  };
  private previousBricks: any[] = [];
  private previousBallY = 0;
  private wasBallAbovePaddle = false;
  private previousLevel = 0;
  
  private particles: Particle[] = [];
  private lastTouchX = 0;
  private isTouching = false;
  
  // 键盘控制
  private keysPressed: Set<string> = new Set();
  private keyHandlers: { [key: string]: (e: KeyboardEvent) => void } = {};
  
  private audioContext: AudioContext | null = null;
  private soundsEnabled = true;
  private soundVolume = 0.3;
  
  // 特效系统
  private previousPaddleX: number | null = null; // 使用 null 来标记未初始化
  private paddleMoveFlashIntensity = 0; // 挡板移动闪烁强度 (0-1)
  private paddleHitFlashIntensity = 0; // 挡板碰撞闪烁强度 (0-1)
  private animationTime = 0; // 动画时间，用于各种动画效果
  private stars: Array<{ x: number; y: number; size: number; brightness: number; twinkleSpeed: number }> = [];

  constructor(
    private gameService: GameService,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initAudio();
    this.gameSubscription = this.gameService.gameData$.subscribe(data => {
      // 检测砖块碰撞
      this.checkBrickCollisions(data);
      
      // 检测游戏状态变化
      if (this.gameData.state !== data.state) {
        if (data.state === GameState.GAME_OVER) {
          this.saveHighScore(data.score);
          this.playSound('gameOver');
        } else if (data.state === GameState.VICTORY) {
          this.saveHighScore(data.score);
          this.playSound('levelComplete');
        }
      }
      
      // 检测关卡变化（关卡完成）
      if (this.previousLevel !== data.currentLevel && data.state === GameState.PLAYING) {
        this.playSound('levelComplete');
      }
      
      // 检测挡板碰撞
      this.checkPaddleCollision(data);
      
      this.gameData = data;
      this.previousBricks = JSON.parse(JSON.stringify(data.bricks));
      this.previousBallY = data.ballY;
      this.previousLevel = data.currentLevel;
      
      // 初始化 previousPaddleX（如果还没初始化）
      if (this.previousPaddleX === null) {
        this.previousPaddleX = data.paddleX;
      }
    });
  }

  private checkPaddleCollision(newData: any): void {
    if (!this.canvas) return;
    
    const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
    
    // 检测挡板移动
    if (this.previousPaddleX !== null && Math.abs(newData.paddleX - this.previousPaddleX) > 0.5) {
      this.paddleMoveFlashIntensity = 1.0; // 激活黄色闪烁
    }
    this.previousPaddleX = newData.paddleX;
    
    if (!this.wasBallAbovePaddle && newData.ballY > canvasHeight - 50) {
      // 小球可能在挡板附近
      const paddleY = canvasHeight - 30;
      const paddleX = newData.paddleX;
      const paddleWidth = GAME_CONFIG.paddle.width;
      const ballX = newData.ballX;
      const ballY = newData.ballY;
      const ballRadius = GAME_CONFIG.ball.radius;
      
      // 检查是否在挡板范围内且小球向上移动（刚反弹）
      if (ballX + ballRadius >= paddleX &&
          ballX - ballRadius <= paddleX + paddleWidth &&
          ballY + ballRadius >= paddleY &&
          ballY - ballRadius <= paddleY + GAME_CONFIG.paddle.height &&
          newData.ballSpeedY < 0 && // 小球向上移动（刚反弹）
          this.previousBallY > ballY) {
        this.playSound('paddle');
        this.paddleHitFlashIntensity = 1.0; // 激活银色闪烁
      }
    }
    
    this.wasBallAbovePaddle = newData.ballY < canvasHeight - 50;
  }

  private checkBrickCollisions(newData: any): void {
    if (this.previousBricks.length === 0) {
      this.previousBricks = JSON.parse(JSON.stringify(newData.bricks));
      return;
    }

    for (let i = 0; i < newData.bricks.length; i++) {
      const newBrick = newData.bricks[i];
      const oldBrick = this.previousBricks[i];
      
      if (oldBrick && !oldBrick.hit && newBrick.hit) {
        // 砖块刚被击中
        this.createParticleExplosion(
          newBrick.x + newBrick.width / 2,
          newBrick.y + newBrick.height / 2,
          newBrick.color
        );
        this.playSound('hit');
      }
    }
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      // 使用 requestAnimationFrame 确保 DOM 已渲染
      requestAnimationFrame(() => {
        setTimeout(() => {
          this.initCanvas();
          this.startGameLoop();
        }, 100);
      });
    });
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.gameSubscription) {
      this.gameSubscription.unsubscribe();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    // 移除键盘事件监听器
    if (this.keyHandlers['keydown']) {
      window.removeEventListener('keydown', this.keyHandlers['keydown']);
    }
    if (this.keyHandlers['keyup']) {
      window.removeEventListener('keyup', this.keyHandlers['keyup']);
    }
  }

  private initCanvas(): void {
    if (!this.canvasRef || !this.canvasRef.nativeElement) {
      console.error('Canvas element not found');
      return;
    }
    
    this.canvas = this.canvasRef.nativeElement;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2d context');
      return;
    }
    this.ctx = ctx;
    
    // 设置画布尺寸（响应式）
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // 设置触摸事件
    this.setupTouchEvents();
    
    // 设置键盘事件
    this.setupKeyboardEvents();
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    // 确保有有效的尺寸
    if (rect.width === 0 || rect.height === 0) {
      console.warn('Canvas has zero size, using default');
      const defaultWidth = window.innerWidth || 375;
      const defaultHeight = window.innerHeight || 667;
      
      this.canvas.width = defaultWidth * dpr;
      this.canvas.height = defaultHeight * dpr;
      this.canvas.style.width = defaultWidth + 'px';
      this.canvas.style.height = defaultHeight + 'px';
      
      if (this.ctx) {
        this.ctx.scale(dpr, dpr);
      }
      
      if (this.gameService) {
        this.gameService.initializeCanvas(defaultWidth, defaultHeight);
      }
      return;
    }
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
    
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    if (this.gameService) {
      this.gameService.initializeCanvas(rect.width, rect.height);
    }
  }

  private setupTouchEvents(): void {
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.lastTouchX = touch.clientX - rect.left;
      this.isTouching = true;
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.isTouching) return;
      
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const currentX = touch.clientX - rect.left;
      const deltaX = currentX - this.lastTouchX;
      
      this.gameService.movePaddle(deltaX);
      this.lastTouchX = currentX;
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isTouching = false;
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.isTouching = false;
    }, { passive: false });
  }

  private setupKeyboardEvents(): void {
    // 键盘按下事件
    const handleKeyDown = (e: KeyboardEvent) => {
      // 处理暂停/继续（空格键）- 在任何状态下都可以暂停/继续
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        this.togglePause();
        return;
      }
      
      // 方向键只在游戏进行中响应
      if (this.gameData.state !== GameState.PLAYING && 
          this.gameData.state !== GameState.PAUSED) {
        return;
      }
      
      // 防止默认行为（如页面滚动）
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
          e.key === 'a' || e.key === 'A' || 
          e.key === 'd' || e.key === 'D') {
        e.preventDefault();
      }
      
      this.keysPressed.add(e.key);
    };
    
    // 键盘释放事件
    const handleKeyUp = (e: KeyboardEvent) => {
      this.keysPressed.delete(e.key);
    };
    
    // 添加事件监听器
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // 保存事件处理器以便在销毁时移除
    this.keyHandlers['keydown'] = handleKeyDown;
    this.keyHandlers['keyup'] = handleKeyUp;
  }

  private startGameLoop(): void {
    const gameLoop = () => {
      this.update();
      this.render();
      this.animationFrameId = requestAnimationFrame(gameLoop);
    };
    
    gameLoop();
  }

  private update(): void {
    // 更新动画时间
    this.animationTime += 0.016; // 假设60fps
    
    // 更新闪烁效果（衰减）
    if (this.paddleMoveFlashIntensity > 0) {
      this.paddleMoveFlashIntensity = Math.max(0, this.paddleMoveFlashIntensity - 0.15);
    }
    if (this.paddleHitFlashIntensity > 0) {
      this.paddleHitFlashIntensity = Math.max(0, this.paddleHitFlashIntensity - 0.2);
    }
    
    if (this.gameData.state === GameState.PLAYING) {
      // 处理键盘输入
      this.handleKeyboardInput();
      
      // 更新小球
      this.gameService.updateBall();
      
      // 更新粒子
      this.updateParticles();
      
      // 更新星星闪烁
      this.updateStars();
    }
  }

  private updateStars(): void {
    for (const star of this.stars) {
      star.brightness = 0.5 + 0.5 * Math.sin(this.animationTime * star.twinkleSpeed);
    }
  }

  private handleKeyboardInput(): void {
    const paddleSpeed = GAME_CONFIG.paddle.speed;
    
    // 左箭头键或 A 键
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('a') || this.keysPressed.has('A')) {
      this.gameService.movePaddle(-paddleSpeed);
    }
    
    // 右箭头键或 D 键
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('d') || this.keysPressed.has('D')) {
      this.gameService.movePaddle(paddleSpeed);
    }
  }

  private updateParticles(): void {
    this.particles = this.particles.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.2; // 重力
      particle.life--;
      return particle.life > 0;
    });
  }

  private render(): void {
    // 确保 canvas 和 context 已初始化
    if (!this.canvas || !this.ctx) {
      return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    
    // 清空画布
    this.ctx.clearRect(0, 0, width, height);

    // 绘制太空马戏团剧院背景
    this.drawCircusTheaterBackground(width, height);

    if (this.gameData.state === GameState.MENU || 
        this.gameData.state === GameState.GAME_OVER || 
        this.gameData.state === GameState.VICTORY) {
      return; // 菜单和结束画面由 HTML 显示
    }

    // 绘制砖块
    this.drawBricks();

    // 绘制挡板（带闪烁效果）
    this.drawPaddle();

    // 绘制小球
    this.drawBall();

    // 绘制粒子
    this.drawParticles();

    // 绘制 UI 信息（分数、生命等）
    this.drawUI();
  }

  private drawCircusTheaterBackground(width: number, height: number): void {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    
    // 初始化星星（如果还没初始化）
    if (this.stars.length === 0) {
      for (let i = 0; i < 100; i++) {
        this.stars.push({
          x: Math.random() * width,
          y: Math.random() * height * 0.7, // 只在舞台上方的区域
          size: Math.random() * 2 + 0.5,
          brightness: Math.random(),
          twinkleSpeed: Math.random() * 2 + 0.5
        });
      }
    }
    
    // 绘制深空背景（深紫色到黑色的渐变）
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0a0a1a'); // 顶部深紫
    bgGradient.addColorStop(0.5, '#1a1a2e'); // 中间
    bgGradient.addColorStop(1, '#0f0f1f'); // 底部更深
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // 绘制星星
    ctx.fillStyle = '#fff';
    for (const star of this.stars) {
      ctx.globalAlpha = star.brightness;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1.0;
    
    // 绘制舞台拱形（马戏团风格）
    const stageTop = height * 0.7; // 舞台顶部位置
    const archHeight = height * 0.3;
    const archWidth = width * 1.2;
    
    // 绘制拱形阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(width / 2, stageTop - archHeight * 0.5, archWidth / 2, archHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制拱形主体（金色渐变）
    const archGradient = ctx.createLinearGradient(width / 2 - archWidth / 2, stageTop - archHeight, 
                                                    width / 2 + archWidth / 2, stageTop);
    archGradient.addColorStop(0, '#FFD700');
    archGradient.addColorStop(0.5, '#FFA500');
    archGradient.addColorStop(1, '#FF8C00');
    ctx.fillStyle = archGradient;
    ctx.beginPath();
    ctx.ellipse(width / 2, stageTop - archHeight * 0.5, archWidth / 2, archHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制拱形边框
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(width / 2, stageTop - archHeight * 0.5, archWidth / 2, archHeight / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // 绘制拱形装饰线条
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(width / 2, stageTop - archHeight * 0.5, 
                  archWidth / 2 - i * 10, archHeight / 2 - i * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // 绘制聚光灯效果（从拱形上方照射下来）
    const spotlightCount = 3;
    for (let i = 0; i < spotlightCount; i++) {
      const spotX = (width / (spotlightCount + 1)) * (i + 1);
      const spotY = stageTop - archHeight * 0.3;
      
      // 聚光灯渐变
      const spotGradient = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, width * 0.4);
      spotGradient.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
      spotGradient.addColorStop(0.5, 'rgba(255, 255, 150, 0.15)');
      spotGradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
      
      ctx.fillStyle = spotGradient;
      ctx.beginPath();
      ctx.arc(spotX, spotY, width * 0.4, 0, Math.PI * 2);
      ctx.fill();
      
      // 聚光灯闪烁动画
      const pulse = 0.7 + 0.3 * Math.sin(this.animationTime * 2 + i);
      ctx.globalAlpha = pulse * 0.2;
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(spotX, spotY, width * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
    
    // 绘制舞台地板（透视效果）
    const floorY = height * 0.85;
    const floorGradient = ctx.createLinearGradient(0, floorY, 0, height);
    floorGradient.addColorStop(0, 'rgba(50, 50, 80, 0.8)');
    floorGradient.addColorStop(1, 'rgba(30, 30, 50, 1)');
    ctx.fillStyle = floorGradient;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(width, floorY);
    ctx.lineTo(width * 0.6, height);
    ctx.lineTo(width * 0.4, height);
    ctx.closePath();
    ctx.fill();
    
    // 绘制舞台地板线条（透视网格）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const lineY = floorY + (height - floorY) * (i / 5);
      const startX = width * 0.4 + (width * 0.2) * (i / 5);
      const endX = width * 0.6 - (width * 0.2) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(startX, lineY);
      ctx.lineTo(endX, lineY);
      ctx.stroke();
    }
    
    // 绘制侧边装饰柱（剧院风格）
    const pillarWidth = width * 0.08;
    const pillarGradient = ctx.createLinearGradient(0, 0, pillarWidth, 0);
    pillarGradient.addColorStop(0, 'rgba(139, 69, 19, 0.6)');
    pillarGradient.addColorStop(0.5, 'rgba(160, 82, 45, 0.8)');
    pillarGradient.addColorStop(1, 'rgba(101, 67, 33, 0.6)');
    
    // 左柱
    ctx.fillStyle = pillarGradient;
    ctx.fillRect(0, stageTop, pillarWidth, height - stageTop);
    ctx.strokeStyle = 'rgba(139, 69, 19, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, stageTop, pillarWidth, height - stageTop);
    
    // 右柱
    ctx.fillRect(width - pillarWidth, stageTop, pillarWidth, height - stageTop);
    ctx.strokeRect(width - pillarWidth, stageTop, pillarWidth, height - stageTop);
    
    // 绘制装饰横幅（在拱形上方）
    const bannerY = stageTop - archHeight * 0.8;
    const bannerGradient = ctx.createLinearGradient(0, bannerY, 0, bannerY + 20);
    bannerGradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
    bannerGradient.addColorStop(1, 'rgba(255, 140, 0, 0.2)');
    ctx.fillStyle = bannerGradient;
    ctx.fillRect(width * 0.2, bannerY, width * 0.6, 20);
    
    // 横幅文字装饰（简单线条模拟）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.25, bannerY + 10);
    ctx.lineTo(width * 0.35, bannerY + 10);
    ctx.moveTo(width * 0.65, bannerY + 10);
    ctx.lineTo(width * 0.75, bannerY + 10);
    ctx.stroke();
  }

  private drawBricks(): void {
    if (!this.ctx) return;
    
    for (const brick of this.gameData.bricks) {
      if (!brick.hit) {
        // 绘制8-bit风格的蛋糕
        this.drawCake(brick.x, brick.y, brick.width, brick.height, brick.color);
      }
    }
  }

  private drawCake(x: number, y: number, width: number, height: number, color: string): void {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    const pixelSize = Math.max(2, Math.floor(Math.min(width, height) / 10)); // 像素大小
    
    // 蛋糕主体颜色（根据砖块颜色调整）
    const cakeColor = this.getCakeColor(color);
    const frostingColor = this.getFrostingColor(color);
    const cherryColor = '#FF1744';
    const darkCakeColor = this.darkenColor(cakeColor, 0.2);
    
    // 绘制蛋糕主体（底层）- 带有阴影效果
    ctx.fillStyle = darkCakeColor;
    ctx.fillRect(x + 1, y + height * 0.6 + 1, width, height * 0.4);
    ctx.fillStyle = cakeColor;
    ctx.fillRect(x, y + height * 0.6, width, height * 0.4);
    
    // 绘制蛋糕主体装饰线条
    ctx.fillStyle = darkCakeColor;
    ctx.fillRect(x, y + height * 0.75, width, 1);
    
    // 绘制奶油层（中间层）- 波浪效果
    ctx.fillStyle = frostingColor;
    const creamY = y + height * 0.45;
    const creamH = height * 0.15;
    ctx.fillRect(x + width * 0.1, creamY, width * 0.8, creamH);
    
    // 绘制奶油装饰（小圆点）
    const dotSize = Math.max(1, pixelSize * 0.5);
    for (let i = 0; i < 3; i++) {
      const dotX = x + width * 0.2 + (i * width * 0.2);
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(dotX, creamY + creamH / 2, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 绘制蛋糕顶层（装饰层）
    ctx.fillStyle = cakeColor;
    ctx.fillRect(x + width * 0.15, y + height * 0.3, width * 0.7, height * 0.15);
    
    // 绘制8-bit像素风格的装饰点
    this.drawPixelPattern(ctx, x, y, width, height, cakeColor, frostingColor, pixelSize);
    
    // 绘制樱桃（在蛋糕顶部中央）
    const cherryX = x + width / 2 - pixelSize * 1.5;
    const cherryY = y + height * 0.25;
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(cherryX, cherryY, pixelSize * 3, pixelSize * 3);
    ctx.fillStyle = cherryColor;
    ctx.fillRect(cherryX, cherryY, pixelSize * 3, pixelSize * 2);
    
    // 樱桃高光
    ctx.fillStyle = '#FF5252';
    ctx.fillRect(cherryX + pixelSize * 0.5, cherryY + pixelSize * 0.5, pixelSize, pixelSize);
    
    // 绘制边框（8-bit风格）
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }

  private darkenColor(color: string, amount: number): string {
    // 简单的颜色变暗函数
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgb(${Math.floor(r * (1 - amount))}, ${Math.floor(g * (1 - amount))}, ${Math.floor(b * (1 - amount))})`;
    }
    return color;
  }

  private drawPixelPattern(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, 
                          cakeColor: string, frostingColor: string, pixelSize: number): void {
    // 在蛋糕主体上绘制像素点装饰
    const cols = Math.floor(width / pixelSize);
    const rows = Math.floor(height / pixelSize);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = x + col * pixelSize;
        const py = y + row * pixelSize;
        
        // 只在蛋糕主体区域绘制装饰
        if (py > y + height * 0.6) {
          // 随机绘制一些像素点作为装饰
          if ((row + col) % 3 === 0) {
            ctx.fillStyle = frostingColor;
            ctx.fillRect(px, py, pixelSize, pixelSize);
          }
        }
      }
    }
  }

  private getCakeColor(originalColor: string): string {
    // 根据原始颜色生成蛋糕颜色（更温暖的色调）
    const colorMap: { [key: string]: string } = {
      '#FF6B6B': '#FFB74D', // 红色 -> 橙色
      '#FFA07A': '#FFCC80', // 浅橙 -> 浅黄
      '#FF8E53': '#FFB74D', // 深橙 -> 橙色
      '#FFD93D': '#FFF176', // 黄色 -> 浅黄
      '#4ECDC4': '#81C784', // 青色 -> 绿色
      '#95E1D3': '#A5D6A7', // 浅青 -> 浅绿
      '#45B7D1': '#64B5F6'  // 蓝色 -> 浅蓝
    };
    return colorMap[originalColor] || '#FFB74D';
  }

  private getFrostingColor(originalColor: string): string {
    // 奶油颜色（白色到浅色）
    const colorMap: { [key: string]: string } = {
      '#FF6B6B': '#FFF9C4', // 浅黄奶油
      '#FFA07A': '#FFFDE7', // 极浅黄
      '#FF8E53': '#FFF9C4',
      '#FFD93D': '#FFFDE7',
      '#4ECDC4': '#E1F5FE', // 浅蓝奶油
      '#95E1D3': '#E8F5E9', // 浅绿奶油
      '#45B7D1': '#E3F2FD'  // 浅蓝
    };
    return colorMap[originalColor] || '#FFF9C4';
  }

  private drawPaddle(): void {
    if (!this.canvas || !this.ctx) return;
    
    const paddleY = (this.canvas.height / (window.devicePixelRatio || 1)) - 30;
    const x = this.gameData.paddleX;
    const y = paddleY;
    const w = GAME_CONFIG.paddle.width;
    const h = GAME_CONFIG.paddle.height;
    const r = 5;
    
    // 绘制挡板移动时的黄色闪烁光晕
    if (this.paddleMoveFlashIntensity > 0) {
      const glowSize = w * (1 + this.paddleMoveFlashIntensity * 0.5);
      const glowGradient = this.ctx.createRadialGradient(
        x + w / 2, y + h / 2, 0,
        x + w / 2, y + h / 2, glowSize
      );
      glowGradient.addColorStop(0, `rgba(255, 215, 0, ${this.paddleMoveFlashIntensity * 0.8})`);
      glowGradient.addColorStop(0.5, `rgba(255, 255, 0, ${this.paddleMoveFlashIntensity * 0.4})`);
      glowGradient.addColorStop(1, `rgba(255, 255, 0, 0)`);
      
      this.ctx.fillStyle = glowGradient;
      this.ctx.fillRect(x - glowSize / 2, y - glowSize / 2, glowSize, glowSize);
    }
    
    // 绘制球碰撞挡板时的银色闪烁光晕
    if (this.paddleHitFlashIntensity > 0) {
      const flashSize = w * (1 + this.paddleHitFlashIntensity * 1.0);
      const flashGradient = this.ctx.createRadialGradient(
        x + w / 2, y + h / 2, 0,
        x + w / 2, y + h / 2, flashSize
      );
      flashGradient.addColorStop(0, `rgba(255, 255, 255, ${this.paddleHitFlashIntensity * 0.9})`);
      flashGradient.addColorStop(0.3, `rgba(200, 200, 255, ${this.paddleHitFlashIntensity * 0.6})`);
      flashGradient.addColorStop(0.6, `rgba(150, 150, 200, ${this.paddleHitFlashIntensity * 0.3})`);
      flashGradient.addColorStop(1, `rgba(100, 100, 150, 0)`);
      
      this.ctx.fillStyle = flashGradient;
      this.ctx.fillRect(x - flashSize / 2, y - flashSize / 2, flashSize, flashSize);
      
      // 添加银色粒子效果
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const dist = this.paddleHitFlashIntensity * 30;
        const px = x + w / 2 + Math.cos(angle) * dist;
        const py = y + h / 2 + Math.sin(angle) * dist;
        
        this.ctx.fillStyle = `rgba(255, 255, 255, ${this.paddleHitFlashIntensity})`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    
    // 绘制挡板主体（带闪烁效果的基础颜色）
    let baseColor = '#4ECDC4';
    if (this.paddleMoveFlashIntensity > 0) {
      // 黄色闪烁时，挡板颜色也变亮
      const yellowMix = this.paddleMoveFlashIntensity * 0.5;
      baseColor = this.mixColors('#4ECDC4', '#FFD700', yellowMix);
    }
    if (this.paddleHitFlashIntensity > 0) {
      // 银色闪烁时，挡板颜色变银色
      const silverMix = this.paddleHitFlashIntensity * 0.7;
      baseColor = this.mixColors(baseColor, '#C0C0C0', silverMix);
    }
    
    this.ctx.fillStyle = baseColor;
    this.ctx.beginPath();
    
    // 兼容性处理：如果支持 roundRect 则使用，否则手动绘制
    if (this.ctx.roundRect) {
      this.ctx.roundRect(x, y, w, h, r);
    } else {
      // 手动绘制圆角矩形
      this.ctx.moveTo(x + r, y);
      this.ctx.lineTo(x + w - r, y);
      this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      this.ctx.lineTo(x + w, y + h - r);
      this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      this.ctx.lineTo(x + r, y + h);
      this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      this.ctx.lineTo(x, y + r);
      this.ctx.quadraticCurveTo(x, y, x + r, y);
      this.ctx.closePath();
    }
    
    this.ctx.fill();
    
    // 绘制高光效果
    const highlightGradient = this.ctx.createLinearGradient(x, y, x, y + h);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    this.ctx.fillStyle = highlightGradient;
    this.ctx.fill();
    
    // 绘制边框
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  private mixColors(color1: string, color2: string, ratio: number): string {
    // 简单的颜色混合函数
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);
    
    const r = Math.floor(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.floor(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.floor(b1 * (1 - ratio) + b2 * ratio);
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  private drawBall(): void {
    if (!this.ctx) return;
    
    const radius = GAME_CONFIG.ball.radius;
    const x = this.gameData.ballX;
    const y = this.gameData.ballY;
    
    // 计算嘴巴开口的角度（根据移动方向）
    let mouthAngle = 0;
    const speed = Math.sqrt(
      this.gameData.ballSpeedX * this.gameData.ballSpeedX +
      this.gameData.ballSpeedY * this.gameData.ballSpeedY
    );
    
    if (speed > 0) {
      // 根据速度方向计算嘴巴朝向
      mouthAngle = Math.atan2(this.gameData.ballSpeedY, this.gameData.ballSpeedX);
    }
    
    // 绘制吃豆人风格的嘴巴
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(mouthAngle);
    
    // 绘制主体（黄色圆形）
    this.ctx.fillStyle = '#FFD700'; // 金黄色
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0.25 * Math.PI, 1.75 * Math.PI); // 开口约270度
    this.ctx.lineTo(0, 0);
    this.ctx.closePath();
    this.ctx.fill();
    
    // 绘制边框
    this.ctx.strokeStyle = '#FFA000';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    
    // 绘制眼睛（8-bit风格）
    const eyeSize = radius * 0.3;
    const eyeX = -radius * 0.3;
    const eyeY = -radius * 0.4;
    
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(eyeX - eyeSize / 2, eyeY - eyeSize / 2, eyeSize, eyeSize);
    
    // 眼睛高光
    this.ctx.fillStyle = '#FFF';
    this.ctx.fillRect(eyeX - eyeSize / 4, eyeY - eyeSize / 3, eyeSize * 0.4, eyeSize * 0.4);
    
    this.ctx.restore();
  }

  private drawParticles(): void {
    if (!this.ctx) return;
    
    for (const particle of this.particles) {
      const alpha = particle.life / particle.maxLife;
      this.ctx.fillStyle = particle.color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawUI(): void {
    if (!this.canvas || !this.ctx) return;
    
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    
    // 绘制分数（改为蛋糕数）
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`🍰 已吃: ${this.gameData.score}`, 10, 30);
    
    // 绘制生命（改为机会）
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`机会: ${this.gameData.lives}`, width - 10, 30);
    
    // 绘制关卡（改为关卡）
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`第 ${this.gameData.currentLevel + 1} 关`, width / 2, 30);

    // 绘制暂停提示
    if (this.gameData.state === GameState.PAUSED) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, width, this.canvas.height / (window.devicePixelRatio || 1));
      
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 40px Arial';
      this.ctx.textAlign = 'center';
      const height = this.canvas.height / (window.devicePixelRatio || 1);
      this.ctx.fillText('暂停', width / 2, height / 2);
    }
  }

  createParticleExplosion(x: number, y: number, color: string): void {
    // 创建更多粒子，模拟蛋糕被吃掉的碎片效果
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 2 + Math.random() * 4;
      // 使用蛋糕相关的颜色
      const particleColor = i % 3 === 0 ? '#FFD93D' : (i % 3 === 1 ? '#FFF9C4' : '#FFB74D');
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: particleColor,
        life: 40,
        maxLife: 40
      });
    }
  }

  getHighScore(): number {
    const highScore = localStorage.getItem('breakoutHighScore');
    return highScore ? parseInt(highScore, 10) : 0;
  }

  saveHighScore(score: number): void {
    const currentHigh = this.getHighScore();
    if (score > currentHigh) {
      localStorage.setItem('breakoutHighScore', score.toString());
    }
  }

  private initAudio(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  private playSound(type: string): void {
    if (!this.soundsEnabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    switch (type) {
      case 'hit':
        oscillator.frequency.value = 800;
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(this.soundVolume * 0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
        break;
      case 'paddle':
        oscillator.frequency.value = 400;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(this.soundVolume * 0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.05);
        break;
      case 'gameOver':
        oscillator.frequency.value = 200;
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(this.soundVolume * 0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
        break;
      case 'levelComplete':
        // 胜利音效
        [440, 554, 659].forEach((freq, i) => {
          setTimeout(() => {
            const osc = this.audioContext!.createOscillator();
            const gain = this.audioContext!.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext!.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(this.soundVolume * 0.3, this.audioContext!.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.2);
            osc.start(this.audioContext!.currentTime);
            osc.stop(this.audioContext!.currentTime + 0.2);
          }, i * 100);
        });
        break;
    }
  }

  startGame(): void {
    this.gameService.startGame();
    // 保存最高分
    if (this.gameData.state === GameState.GAME_OVER || this.gameData.state === GameState.VICTORY) {
      this.saveHighScore(this.gameData.score);
    }
  }

  pauseGame(): void {
    this.gameService.pauseGame();
  }

  resumeGame(): void {
    this.gameService.resumeGame();
  }

  togglePause(): void {
    if (this.gameData.state === GameState.PLAYING) {
      this.pauseGame();
    } else if (this.gameData.state === GameState.PAUSED) {
      this.resumeGame();
    }
  }

  get gameState(): typeof GameState {
    return GameState;
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}

