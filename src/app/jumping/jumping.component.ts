import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { JumpingService, GameState } from './jumping.service';
import { Subscription } from 'rxjs';
import { JUMPING_CONFIG } from './jumping.config';

@Component({
  selector: 'app-jumping',
  templateUrl: './jumping.component.html',
  styleUrls: ['./jumping.component.scss'],
  standalone: false
})
export class JumpingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  private gameSubscription!: Subscription;
  gameData: any = {
    player: { x: 0, y: 0, width: 0, height: 0, vx: 0, vy: 0, onGround: false },
    platforms: [],
    cameraY: 0,
    score: 0,
    height: 0,
    gameTime: 0,
    state: GameState.MENU,
    canvasWidth: 0,
    canvasHeight: 0
  };

  get highScore(): number {
    return this.jumpingService.getHighScore();
  }

  private keysPressed: Set<string> = new Set();
  private keyHandlers: { [key: string]: (e: KeyboardEvent) => void } = {};

  constructor(
    private jumpingService: JumpingService,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.gameSubscription = this.jumpingService.gameData$.subscribe(data => {
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
    
    this.setupTouchEvents();
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
      
      if (this.jumpingService) {
        this.jumpingService.initializeCanvas(defaultWidth, defaultHeight);
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
    
    if (this.jumpingService) {
      this.jumpingService.initializeCanvas(rect.width, rect.height);
    }
  }

  private setupTouchEvents(): void {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      touchStartX = touch.clientX - rect.left;
      touchStartY = touch.clientY - rect.top;
      touchStartTime = Date.now();
      
      // 判断是移动还是跳跃
      const centerX = rect.width / 2;
      if (touchStartX < centerX) {
        this.jumpingService.setMoveLeft(true);
      } else {
        this.jumpingService.setMoveRight(true);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const currentX = touch.clientX - rect.left;
      const currentY = touch.clientY - rect.top;
      
      const centerX = rect.width / 2;
      if (currentX < centerX) {
        this.jumpingService.setMoveLeft(true);
        this.jumpingService.setMoveRight(false);
      } else {
        this.jumpingService.setMoveRight(true);
        this.jumpingService.setMoveLeft(false);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const touchEndTime = Date.now();
      const touchDuration = touchEndTime - touchStartTime;
      
      // 如果触摸时间很短（< 200ms），视为跳跃
      if (touchDuration < 200) {
        this.jumpingService.setJump(true);
        setTimeout(() => this.jumpingService.setJump(false), 100);
      }
      
      this.jumpingService.setMoveLeft(false);
      this.jumpingService.setMoveRight(false);
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.jumpingService.setMoveLeft(false);
      this.jumpingService.setMoveRight(false);
    }, { passive: false });
  }

  private setupKeyboardEvents(): void {
    const handleKeyDown = (e: KeyboardEvent) => {
      // P 键用于暂停/继续（在任何状态下都可以）
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.togglePause();
        return;
      }
      
      if (this.gameData.state !== GameState.PLAYING && 
          this.gameData.state !== GameState.PAUSED) {
        return;
      }
      
      // 空格键用于跳跃（这是最常见的跳跃键）
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        this.jumpingService.setJump(true);
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.jumpingService.setMoveLeft(true);
      }
      
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        this.jumpingService.setMoveRight(true);
      }
      
      // 上箭头或 W 键也可以跳跃
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        this.jumpingService.setJump(true);
      }
      
      this.keysPressed.add(e.key);
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.jumpingService.setMoveLeft(false);
      }
      
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.jumpingService.setMoveRight(false);
      }
      
      // 空格键、上箭头或 W 键释放时停止跳跃
      if (e.key === ' ' || e.key === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.jumpingService.setJump(false);
      }
      
      this.keysPressed.delete(e.key);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
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
    if (this.gameData.state === GameState.PLAYING) {
      this.jumpingService.update();
    }
  }

  private render(): void {
    if (!this.canvas || !this.ctx) {
      return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    
    this.ctx.clearRect(0, 0, width, height);

    if (this.gameData.state === GameState.MENU || 
        this.gameData.state === GameState.GAME_OVER) {
      return; // 菜单和结束画面由 HTML 显示
    }

    // 绘制背景
    this.drawBackground(width, height);

    // 绘制平台
    this.drawPlatforms();

    // 绘制玩家
    this.drawPlayer();

    // 绘制 UI
    this.drawUI();
  }

  private drawBackground(width: number, height: number): void {
    if (!this.ctx) return;
    
    // 天空渐变背景
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#87CEEB'); // 天蓝色
    gradient.addColorStop(0.5, '#98D8E8');
    gradient.addColorStop(1, '#B0E0E6'); // 浅蓝色
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
    
    // 绘制云朵（视差效果）
    this.drawClouds(width, height);
  }

  private drawClouds(width: number, height: number): void {
    if (!this.ctx) return;
    
    const cameraY = this.gameData.cameraY || 0;
    const cloudCount = 10;
    
    for (let i = 0; i < cloudCount; i++) {
      const cloudX = (i * 200 + (cameraY * 0.1)) % (width + 200) - 100;
      const cloudY = (i * 150 - cameraY * 0.05) % (height * 2) - height;
      
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.beginPath();
      this.ctx.arc(cloudX, cloudY, 30, 0, Math.PI * 2);
      this.ctx.arc(cloudX + 40, cloudY, 35, 0, Math.PI * 2);
      this.ctx.arc(cloudX + 80, cloudY, 30, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawPlatforms(): void {
    if (!this.ctx) return;
    
    const cameraY = this.gameData.cameraY || 0;
    
    for (const platform of this.gameData.platforms) {
      // 转换到屏幕坐标
      const screenY = platform.y - cameraY;
      
      // 只绘制屏幕内的平台
      if (screenY > -50 && screenY < this.canvas.height / (window.devicePixelRatio || 1) + 50) {
        // 绘制平台阴影
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(platform.x + 2, screenY + 2, platform.width, platform.height);
        
        // 绘制平台主体
        this.ctx.fillStyle = platform.color;
        this.ctx.fillRect(platform.x, screenY, platform.width, platform.height);
        
        // 绘制平台高光
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(platform.x, screenY, platform.width, 3);
        
        // 绘制平台边框
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(platform.x, screenY, platform.width, platform.height);
      }
    }
  }

  private drawPlayer(): void {
    if (!this.ctx) return;
    
    const player = this.gameData.player;
    const cameraY = this.gameData.cameraY || 0;
    const screenY = player.y - cameraY;
    
    // 绘制玩家阴影
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(
      player.x + player.width / 2 + 2,
      screenY + player.height + 2,
      player.width / 2,
      5,
      0, 0, Math.PI * 2
    );
    this.ctx.fill();
    
    // 绘制玩家身体（简单的小人形状）
    const centerX = player.x + player.width / 2;
    
    // 身体
    this.ctx.fillStyle = '#4ECDC4';
    this.ctx.fillRect(player.x + player.width * 0.3, screenY + player.height * 0.4, 
                      player.width * 0.4, player.height * 0.5);
    
    // 头部
    this.ctx.fillStyle = '#FFD93D';
    this.ctx.beginPath();
    this.ctx.arc(centerX, screenY + player.height * 0.3, player.width * 0.25, 0, Math.PI * 2);
    this.ctx.fill();
    
    // 眼睛
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(centerX - player.width * 0.08, screenY + player.height * 0.25, 
                      player.width * 0.05, player.width * 0.05);
    this.ctx.fillRect(centerX + player.width * 0.03, screenY + player.height * 0.25, 
                      player.width * 0.05, player.width * 0.05);
    
    // 手臂（根据移动方向调整）
    this.ctx.fillStyle = '#FF6B6B';
    if (player.vx > 0) {
      // 向右移动，右臂抬起
      this.ctx.fillRect(player.x + player.width * 0.6, screenY + player.height * 0.4, 
                        player.width * 0.2, player.height * 0.15);
    } else if (player.vx < 0) {
      // 向左移动，左臂抬起
      this.ctx.fillRect(player.x + player.width * 0.2, screenY + player.height * 0.4, 
                        player.width * 0.2, player.height * 0.15);
    } else {
      // 静止，双臂下垂
      this.ctx.fillRect(player.x + player.width * 0.2, screenY + player.height * 0.5, 
                        player.width * 0.2, player.height * 0.2);
      this.ctx.fillRect(player.x + player.width * 0.6, screenY + player.height * 0.5, 
                        player.width * 0.2, player.height * 0.2);
    }
    
    // 腿部
    this.ctx.fillStyle = '#4ECDC4';
    this.ctx.fillRect(player.x + player.width * 0.35, screenY + player.height * 0.85, 
                      player.width * 0.15, player.height * 0.15);
    this.ctx.fillRect(player.x + player.width * 0.5, screenY + player.height * 0.85, 
                      player.width * 0.15, player.height * 0.15);
    
    // 边框
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(player.x, screenY, player.width, player.height);
  }

  private drawUI(): void {
    if (!this.canvas || !this.ctx) return;
    
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    
    // 绘制分数
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`分数: ${this.gameData.score}`, 10, 30);
    
    // 绘制高度
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`高度: ${Math.floor(this.gameData.height)}m`, width - 10, 30);
    
    // 绘制计时器（右上角）
    const time = this.gameData.gameTime || 0;
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 18px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`⏱️ ${timeString}`, width - 10, 55);
    
    // 绘制最高分
    const highScore = this.jumpingService.getHighScore();
    if (highScore > 0) {
      this.ctx.textAlign = 'center';
      this.ctx.font = '16px Arial';
      this.ctx.fillText(`最高: ${Math.floor(highScore)}m`, width / 2, 30);
    }

    // 绘制暂停提示
    if (this.gameData.state === GameState.PAUSED) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, width, this.canvas.height / (window.devicePixelRatio || 1));
      
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 40px Arial';
      this.ctx.textAlign = 'center';
      const height = this.canvas.height / (window.devicePixelRatio || 1);
      this.ctx.fillText('暂停', width / 2, height / 2 - 20);
      
      this.ctx.font = '20px Arial';
      this.ctx.fillText('按 P 键继续', width / 2, height / 2 + 20);
    }
  }

  startGame(): void {
    this.jumpingService.startGame();
  }

  pauseGame(): void {
    this.jumpingService.pauseGame();
  }

  resumeGame(): void {
    this.jumpingService.resumeGame();
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

