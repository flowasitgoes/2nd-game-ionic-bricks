import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { JumpingService, GameState, EffectEvent, GameMode } from './jumping.service';
import { Subscription } from 'rxjs';
import { JUMPING_CONFIG } from './jumping.config';
import { Song } from './jumping-songs.config';

interface MeteorLine {
  x: number;
  y: number;
  length: number;
  angle: number;
  speed: number;
  life: number;
  maxLife: number;
  color: string;
}

interface RainbowRing {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  rotation: number;
}

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
    gameMode: GameMode.FREE,
    currentSong: null,
    creativeSequence: [],
    songProgress: 0,
    state: GameState.MENU,
    canvasWidth: 0,
    canvasHeight: 0
  };

  availableSongs: Song[] = [];
  selectedSongId: number | null = null;
  isPlayingCreative = false;

  get highScore(): number {
    return this.jumpingService.getHighScore();
  }

  private keysPressed: Set<string> = new Set();
  private keyHandlers: { [key: string]: (e: KeyboardEvent) => void } = {};
  
  // 特效系统
  private meteorLines: MeteorLine[] = [];
  private rainbowRings: RainbowRing[] = [];
  
  // 音频系统
  private audioContext: AudioContext | null = null;
  private soundsEnabled = true;
  private soundVolume = 0.3;

  constructor(
    public jumpingService: JumpingService, // 改为 public，让模板可以访问
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initAudio();
    this.availableSongs = this.jumpingService.getAvailableSongs();
    this.gameSubscription = this.jumpingService.gameData$.subscribe(data => {
      this.gameData = data;
    });
  }

  private initAudio(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
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
    
    if (this.audioContext) {
      this.audioContext.close();
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
      
      // 处理特效事件
      this.processEffectEvents();
    }
    
    // 更新特效
    this.updateEffects();
  }

  private processEffectEvents(): void {
    const events = this.jumpingService.getEffectEvents();
    
    for (const event of events) {
      if (event.type === 'platform_land') {
        this.createMeteorEffect(event.x, event.y, event.platformColor || '#FFD93D');
      } else if (event.type === 'rainbow_encourage') {
        this.createRainbowRing(event.x, event.y);
      } else if (event.type === 'platform_sound') {
        // 播放平台对应的和弦音效
        this.playPlatformChord(event.platformColor || '#4ECDC4');
      }
    }
    
    // 清除已处理的事件
    this.jumpingService.clearEffectEvents();
  }

  private playPlatformChord(color: string): void {
    if (!this.soundsEnabled || !this.audioContext) return;

    // 和弦频率映射（基于 A4 = 440Hz）
    const chordFrequencies: { [key: string]: number[] } = {
      '#4ECDC4': [261.63, 329.63, 392.00, 493.88], // Cmaj7 - 青色：冷静、平衡、开阔
      '#FF6B6B': [440.00, 523.25, 659.25, 783.99], // Am7 - 红色：热情、能量
      '#FFD93D': [392.00, 493.88, 587.33],         // G - 黄色：光亮、活泼、温暖
      '#95E1D3': [349.23, 440.00, 523.25, 659.25], // Fmaj7 - 浅青色：纯净、梦幻
      '#FFA07A': [293.66, 349.23, 440.00, 523.25]  // Dm7 - 橘色：亲切、浪漫
    };

    const frequencies = chordFrequencies[color] || chordFrequencies['#4ECDC4'];
    
    // 根据游戏模式调整持续时间
    let duration = 0.4;
    if (this.gameData.gameMode === GameMode.SONG && this.gameData.currentSong) {
      // 歌曲模式：根据BPM调整持续时间，让节奏更明显
      const beatDuration = 60 / this.gameData.currentSong.bpm; // 每拍的时间
      duration = beatDuration * 0.8; // 稍短一点，让下一个和弦能及时进入
    }
    
    const currentTime = this.audioContext.currentTime;

    // 同时播放和弦中的所有音符（真正的和弦效果）
    frequencies.forEach((freq, index) => {
      if (!this.audioContext) return;
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine'; // 使用正弦波，更柔和，像钢琴/琴声

      // 音量设置：根音稍大，其他音稍小，让和弦更自然
      const baseVolume = this.soundVolume * 0.2;
      const volume = index === 0 ? baseVolume : baseVolume * 0.8; // 根音稍大
      
      gainNode.gain.setValueAtTime(volume, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + duration);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);
    });
  }

  // 播放创作模式的序列
  playCreativeSequence(): void {
    const sequence = this.jumpingService.getCreativeSequence();
    if (sequence.length === 0) {
      alert('还没有创作序列！先跳跃一些平台吧！');
      return;
    }
    
    this.isPlayingCreative = true;
    const beatDuration = 0.5; // 每个和弦的间隔
    
    sequence.forEach((color, index) => {
      setTimeout(() => {
        this.playPlatformChord(color);
        if (index === sequence.length - 1) {
          setTimeout(() => {
            this.isPlayingCreative = false;
          }, 500);
        }
      }, index * beatDuration * 1000);
    });
  }

  clearCreativeSequence(): void {
    this.jumpingService.setGameMode(GameMode.CREATIVE); // 这会清空序列
  }

  private createMeteorEffect(worldX: number, worldY: number, color: string): void {
    // 使用世界坐标，在渲染时转换
    // 创建流星线条（平行线效果，像流星一样）
    const lineCount = 12; // 增加线条数量，更像流星
    for (let i = 0; i < lineCount; i++) {
      const angle = (Math.PI * 2 * i) / lineCount;
      const length = 80 + Math.random() * 60;
      const speed = 4 + Math.random() * 3;
      
      this.meteorLines.push({
        x: worldX, // 世界坐标
        y: worldY, // 世界坐标
        length,
        angle,
        speed,
        life: 1.0,
        maxLife: 1.0,
        color: color
      });
    }
  }

  private createRainbowRing(worldX: number, worldY: number): void {
    // 使用世界坐标
    this.rainbowRings.push({
      x: worldX,
      y: worldY,
      radius: 20,
      life: 1.0,
      maxLife: 2.0, // 彩虹光圈持续时间更长
      rotation: 0
    });
  }

  private updateEffects(): void {
    // 更新流星线条（世界坐标移动）
    this.meteorLines = this.meteorLines.filter(line => {
      line.life -= 0.05;
      // 线条在世界坐标中移动
      line.x += Math.cos(line.angle) * line.speed;
      line.y += Math.sin(line.angle) * line.speed;
      return line.life > 0;
    });
    
    // 更新彩虹光圈（世界坐标中保持位置，但半径和旋转会变化）
    this.rainbowRings = this.rainbowRings.filter(ring => {
      ring.life -= 0.02;
      ring.radius += 2;
      ring.rotation += 0.15; // 旋转速度
      return ring.life > 0;
    });
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

    // 绘制特效
    this.drawEffects();

    // 绘制 UI
    this.drawUI();
  }

  private drawEffects(): void {
    if (!this.ctx) return;
    
    const cameraY = this.gameData.cameraY || 0;
    
    // 绘制流星线条特效
    for (const line of this.meteorLines) {
      const screenX = line.x;
      const screenY = line.y - cameraY;
      const alpha = line.life / line.maxLife;
      
      // 创建渐变色
      const gradient = this.ctx.createLinearGradient(
        screenX, screenY,
        screenX + Math.cos(line.angle) * line.length,
        screenY + Math.sin(line.angle) * line.length
      );
      
      // 根据平台颜色设置渐变
      if (line.color === '#FFD93D' || line.color === '#FFA07A') {
        // 黄色或橘色平台
        const baseColor = line.color === '#FFD93D' ? '#FFD93D' : '#FFA07A';
        gradient.addColorStop(0, line.color);
        gradient.addColorStop(0.5, this.lightenColor(line.color, 0.3));
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        gradient.addColorStop(0, line.color);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(screenX, screenY);
      this.ctx.lineTo(
        screenX + Math.cos(line.angle) * line.length,
        screenY + Math.sin(line.angle) * line.length
      );
      this.ctx.stroke();
      this.ctx.restore();
    }
    
    // 绘制彩虹光圈特效
    for (const ring of this.rainbowRings) {
      const screenX = ring.x;
      const screenY = ring.y - cameraY;
      const alpha = ring.life / ring.maxLife;
      
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(screenX, screenY);
      this.ctx.rotate(ring.rotation);
      
      // 绘制彩虹色光圈（多个同心圆）
      const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
      for (let i = 0; i < 3; i++) {
        const currentRadius = ring.radius + i * 15;
        const colorIndex = Math.floor((ring.rotation * 10 + i) % colors.length);
        
        // 创建彩虹渐变
        const ringGradient = this.ctx.createLinearGradient(-currentRadius, 0, currentRadius, 0);
        for (let j = 0; j < colors.length; j++) {
          ringGradient.addColorStop(j / colors.length, colors[(colorIndex + j) % colors.length]);
        }
        
        this.ctx.strokeStyle = ringGradient;
        this.ctx.lineWidth = 4 - i;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      
      this.ctx.restore();
    }
  }

  private lightenColor(color: string, amount: number): string {
    // 简单的颜色变亮函数
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgb(${Math.min(255, Math.floor(r + (255 - r) * amount))}, ${Math.min(255, Math.floor(g + (255 - g) * amount))}, ${Math.min(255, Math.floor(b + (255 - b) * amount))})`;
    }
    return color;
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
    
    // 绘制游戏模式和歌曲信息
    if (this.gameData.gameMode === GameMode.SONG && this.gameData.currentSong) {
      this.ctx.font = '16px Arial';
      this.ctx.fillText(`🎼 ${this.gameData.currentSong.name}`, width - 10, 80);
      const progress = Math.floor((this.gameData.songProgress / this.gameData.currentSong.chordSequence.length) * 100);
      this.ctx.fillText(`进度: ${progress}%`, width - 10, 100);
    } else if (this.gameData.gameMode === GameMode.CREATIVE) {
      this.ctx.font = '16px Arial';
      this.ctx.fillText(`🎹 创作模式`, width - 10, 80);
      const sequenceLength = this.jumpingService.getCreativeSequence().length;
      this.ctx.fillText(`序列: ${sequenceLength}`, width - 10, 100);
    }
    
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

  get gameMode(): typeof GameMode {
    return GameMode;
  }

  selectMode(mode: 'free' | 'song' | 'creative'): void {
    if (mode === 'song') {
      this.jumpingService.setGameMode(GameMode.SONG);
      // 如果没有选择歌曲，默认选择第一首
      if (!this.selectedSongId && this.availableSongs.length > 0) {
        this.selectSong(this.availableSongs[0].id);
      }
    } else if (mode === 'creative') {
      this.jumpingService.setGameMode(GameMode.CREATIVE);
      this.selectedSongId = null;
    } else {
      this.jumpingService.setGameMode(GameMode.FREE);
      this.selectedSongId = null;
    }
  }

  selectSong(songId: number): void {
    this.selectedSongId = songId;
    this.jumpingService.setGameMode(GameMode.SONG, songId);
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}

