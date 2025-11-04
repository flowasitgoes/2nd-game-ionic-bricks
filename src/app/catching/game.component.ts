import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { GameService, GameState } from './game.service';
import { Subscription } from 'rxjs';
import { GAME_CONFIG } from './game.config';

@Component({
  selector: 'app-catch-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  standalone: false
})
export class CatchGameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  private gameSubscription!: Subscription;
  gameData: any = {
    score: 0,
    lives: 3,
    basketX: 0,
    fruits: [],
    state: GameState.MENU
  };
  
  // 键盘控制
  private keysPressed: Set<string> = new Set();
  private keyHandlers: { [key: string]: (e: KeyboardEvent) => void } = {};
  private lastUpdateTime = 0;
  
  constructor(
    private gameService: GameService,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.gameSubscription = this.gameService.gameData$.subscribe(data => {
      // 检测游戏状态变化
      if (this.gameData.state !== data.state) {
        if (data.state === GameState.GAME_OVER) {
          this.saveHighScore(data.score);
        }
      }
      
      this.gameData = data;
    });
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
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
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    this.setupKeyboardEvents();
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    if (rect.width === 0 || rect.height === 0) {
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

  private setupKeyboardEvents(): void {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        this.togglePause();
        return;
      }
      
      if (this.gameData.state !== GameState.PLAYING && 
          this.gameData.state !== GameState.PAUSED) {
        return;
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
          e.key === 'a' || e.key === 'A' || 
          e.key === 'd' || e.key === 'D') {
        e.preventDefault();
      }
      
      this.keysPressed.add(e.key);
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      this.keysPressed.delete(e.key);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    this.keyHandlers['keydown'] = handleKeyDown;
    this.keyHandlers['keyup'] = handleKeyUp;
  }

  private startGameLoop(): void {
    this.lastUpdateTime = Date.now();
    const gameLoop = () => {
      this.update();
      this.render();
      this.animationFrameId = requestAnimationFrame(gameLoop);
    };
    
    gameLoop();
  }

  private update(): void {
    if (this.gameData.state === GameState.PLAYING) {
      // 处理键盘输入
      this.handleKeyboardInput();
      
      // 更新游戏状态
      const currentTime = Date.now();
      const deltaTime = currentTime - this.lastUpdateTime;
      this.gameService.updateGame(deltaTime);
      this.lastUpdateTime = currentTime;
    }
  }

  private handleKeyboardInput(): void {
    // 左箭头键或 A 键
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('a') || this.keysPressed.has('A')) {
      this.gameService.moveBasket('left');
    }
    
    // 右箭头键或 D 键
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('d') || this.keysPressed.has('D')) {
      this.gameService.moveBasket('right');
    }
  }

  private render(): void {
    if (!this.canvas || !this.ctx) {
      return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    
    // 清空画布
    this.ctx.clearRect(0, 0, width, height);

    // 绘制背景
    this.drawBackground(width, height);

    if (this.gameData.state === GameState.MENU || 
        this.gameData.state === GameState.GAME_OVER) {
      return; // 菜单和结束画面由 HTML 显示
    }

    // 绘制水果
    this.drawFruits();

    // 绘制篮子
    this.drawBasket();

    // 绘制 UI 信息
    this.drawUI();

    // 绘制暂停提示
    if (this.gameData.state === GameState.PAUSED) {
      this.drawPauseScreen(width, height);
    }
  }

  private drawBackground(width: number, height: number): void {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    
    // 绘制天空渐变背景
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#87CEEB'); // 天蓝色
    bgGradient.addColorStop(0.7, '#E0F6FF'); // 浅蓝色
    bgGradient.addColorStop(1, '#F0F8FF'); // 淡蓝色
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // 绘制云朵
    this.drawClouds(ctx, width, height);
  }

  private drawClouds(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    
    // 绘制几朵云
    const clouds = [
      { x: width * 0.2, y: height * 0.1, size: 30 },
      { x: width * 0.5, y: height * 0.15, size: 40 },
      { x: width * 0.8, y: height * 0.12, size: 35 }
    ];
    
    clouds.forEach(cloud => {
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.size * 0.6, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
      ctx.arc(cloud.x - cloud.size * 0.6, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
      ctx.arc(cloud.x, cloud.y - cloud.size * 0.5, cloud.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private drawFruits(): void {
    if (!this.ctx) return;
    
    for (const fruit of this.gameData.fruits) {
      if (fruit.missed) {
        // 漏接的水果显示为灰色
        this.drawFruitShape(fruit, true);
      } else {
        this.drawFruitShape(fruit, false);
      }
    }
  }

  private drawFruitShape(fruit: any, isMissed: boolean): void {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    const x = fruit.x + fruit.size / 2;
    const y = fruit.y + fruit.size / 2;
    const size = fruit.size;
    
    ctx.save();
    ctx.globalAlpha = isMissed ? 0.5 : 1.0;
    
    switch (fruit.type) {
      case 'apple':
        this.drawApple(ctx, x, y, size, isMissed);
        break;
      case 'banana':
        this.drawBanana(ctx, x, y, size, isMissed);
        break;
      case 'orange':
        this.drawOrange(ctx, x, y, size, isMissed);
        break;
      case 'strawberry':
        this.drawStrawberry(ctx, x, y, size, isMissed);
        break;
      case 'grape':
        this.drawGrape(ctx, x, y, size, isMissed);
        break;
    }
    
    ctx.restore();
  }

  private drawApple(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, isMissed: boolean): void {
    const color = isMissed ? '#888' : '#FF4444';
    const darkColor = isMissed ? '#666' : '#CC0000';
    
    // 苹果主体
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.4, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 高光
    ctx.fillStyle = isMissed ? '#999' : '#FF6666';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.1, y - size * 0.15, size * 0.15, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 叶子
    if (!isMissed) {
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.ellipse(x, y - size * 0.5, size * 0.1, size * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBanana(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, isMissed: boolean): void {
    const color = isMissed ? '#888' : '#FFEB3B';
    const darkColor = isMissed ? '#666' : '#FFC107';
    
    // 香蕉主体（弯曲）
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = size * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.3, y - size * 0.3);
    ctx.quadraticCurveTo(x, y + size * 0.2, x + size * 0.3, y + size * 0.3);
    ctx.stroke();
    
    // 填充
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.25;
    ctx.stroke();
  }

  private drawOrange(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, isMissed: boolean): void {
    const color = isMissed ? '#888' : '#FF9800';
    
    // 橙子主体
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // 纹理
    ctx.strokeStyle = isMissed ? '#666' : '#FF6F00';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(angle) * size * 0.4,
        y + Math.sin(angle) * size * 0.4
      );
      ctx.stroke();
    }
  }

  private drawStrawberry(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, isMissed: boolean): void {
    const color = isMissed ? '#888' : '#F44336';
    
    // 草莓主体
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.4);
    ctx.lineTo(x - size * 0.3, y + size * 0.4);
    ctx.lineTo(x + size * 0.3, y + size * 0.4);
    ctx.closePath();
    ctx.fill();
    
    // 种子
    ctx.fillStyle = isMissed ? '#666' : '#FFD700';
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.beginPath();
        ctx.arc(
          x - size * 0.1 + i * size * 0.1,
          y - size * 0.1 + j * size * 0.2,
          size * 0.03,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    
    // 叶子
    if (!isMissed) {
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.ellipse(x, y - size * 0.4, size * 0.15, size * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGrape(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, isMissed: boolean): void {
    const color = isMissed ? '#888' : '#9C27B0';
    
    // 葡萄串（多个小圆）
    const grapeCount = 6;
    for (let i = 0; i < grapeCount; i++) {
      const angle = (i * Math.PI * 2) / grapeCount;
      const grapeX = x + Math.cos(angle) * size * 0.2;
      const grapeY = y + Math.sin(angle) * size * 0.2;
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(grapeX, grapeY, size * 0.15, 0, Math.PI * 2);
      ctx.fill();
      
      // 高光
      if (!isMissed) {
        ctx.fillStyle = '#BA68C8';
        ctx.beginPath();
        ctx.arc(grapeX - size * 0.05, grapeY - size * 0.05, size * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawBasket(): void {
    if (!this.canvas || !this.ctx) return;
    
    const basketY = (this.canvas.height / (window.devicePixelRatio || 1)) - 30;
    const x = this.gameData.basketX;
    const y = basketY;
    const w = GAME_CONFIG.basket.width;
    const h = GAME_CONFIG.basket.height;
    
    // 篮子主体
    const basketGradient = this.ctx.createLinearGradient(x, y, x, y + h);
    basketGradient.addColorStop(0, '#8B4513');
    basketGradient.addColorStop(1, '#654321');
    this.ctx.fillStyle = basketGradient;
    this.ctx.fillRect(x, y - h, w, h);
    
    // 篮子边框
    this.ctx.strokeStyle = '#5D4037';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y - h, w, h);
    
    // 篮子编织纹理
    this.ctx.strokeStyle = '#6D4C41';
    this.ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x + (w / 4) * i, y - h);
      this.ctx.lineTo(x + (w / 4) * i, y);
      this.ctx.stroke();
    }
    
    // 篮子把手
    this.ctx.strokeStyle = '#5D4037';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(x + w / 2, y - h - 10, 15, Math.PI, 0, false);
    this.ctx.stroke();
  }

  private drawUI(): void {
    if (!this.canvas || !this.ctx) return;
    
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    
    // 绘制分数
    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`🍎 分数: ${this.gameData.score}`, 10, 35);
    
    // 绘制生命值
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`❤️ 生命: ${this.gameData.lives}`, width - 10, 35);
  }

  private drawPauseScreen(width: number, height: number): void {
    if (!this.ctx) return;
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, width, height);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 40px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('暂停', width / 2, height / 2);
  }

  startGame(): void {
    this.gameService.startGame();
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

  getHighScore(): number {
    const highScore = localStorage.getItem('catchHighScore');
    return highScore ? parseInt(highScore, 10) : 0;
  }

  saveHighScore(score: number): void {
    const currentHigh = this.getHighScore();
    if (score > currentHigh) {
      localStorage.setItem('catchHighScore', score.toString());
    }
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}

