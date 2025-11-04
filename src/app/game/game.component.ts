import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
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

  constructor(
    private gameService: GameService,
    private ngZone: NgZone
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
    });
  }

  private checkPaddleCollision(newData: any): void {
    if (!this.canvas) return;
    
    const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
    
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
    if (this.gameData.state === GameState.PLAYING) {
      // 处理键盘输入
      this.handleKeyboardInput();
      
      // 更新小球
      this.gameService.updateBall();
      
      // 更新粒子
      this.updateParticles();
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

    // 绘制背景
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, width, height);

    if (this.gameData.state === GameState.MENU || 
        this.gameData.state === GameState.GAME_OVER || 
        this.gameData.state === GameState.VICTORY) {
      return; // 菜单和结束画面由 HTML 显示
    }

    // 绘制砖块
    this.drawBricks();

    // 绘制挡板
    this.drawPaddle();

    // 绘制小球
    this.drawBall();

    // 绘制粒子
    this.drawParticles();

    // 绘制 UI 信息（分数、生命等）
    this.drawUI();
  }

  private drawBricks(): void {
    if (!this.ctx) return;
    
    for (const brick of this.gameData.bricks) {
      if (!brick.hit) {
        // 绘制砖块
        this.ctx.fillStyle = brick.color;
        this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        
        // 绘制边框
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
      }
    }
  }

  private drawPaddle(): void {
    if (!this.canvas || !this.ctx) return;
    
    const paddleY = (this.canvas.height / (window.devicePixelRatio || 1)) - 30;
    const x = this.gameData.paddleX;
    const y = paddleY;
    const w = GAME_CONFIG.paddle.width;
    const h = GAME_CONFIG.paddle.height;
    const r = 5;
    
    // 绘制挡板（圆角矩形）
    this.ctx.fillStyle = '#4ECDC4';
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
    
    // 绘制边框
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  private drawBall(): void {
    if (!this.ctx) return;
    
    this.ctx.fillStyle = '#FFD93D';
    this.ctx.beginPath();
    this.ctx.arc(
      this.gameData.ballX,
      this.gameData.ballY,
      GAME_CONFIG.ball.radius,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
    
    // 绘制高光
    this.ctx.fillStyle = '#FFF';
    this.ctx.beginPath();
    this.ctx.arc(
      this.gameData.ballX - 2,
      this.gameData.ballY - 2,
      GAME_CONFIG.ball.radius * 0.3,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
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
    
    // 绘制分数
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`分数: ${this.gameData.score}`, 10, 30);
    
    // 绘制生命
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`生命: ${this.gameData.lives}`, width - 10, 30);
    
    // 绘制关卡
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`关卡: ${this.gameData.currentLevel + 1}`, width / 2, 30);

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
    for (let i = 0; i < 15; i++) {
      const angle = (Math.PI * 2 * i) / 15;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 30,
        maxLife: 30
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
}

