import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, NgZone, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';

interface Target {
  id: number;
  x: number;
  y: number;
  size: number;
  visible: boolean;
  hit: boolean;
  spawnTime: number;
  disappearTime: number;
}

interface HitEffect {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  score: number;
  ringIndex: number;
}

enum GameState {
  MENU = 'MENU',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

const RING_SCORES = [25, 10, 5, 3, 1];

@Component({
  selector: 'app-shooting',
  templateUrl: './shooting.component.html',
  styleUrls: ['./shooting.component.scss'],
  standalone: false
})
export class ShootingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameArea', { static: false }) gameAreaRef!: ElementRef<HTMLElement>;
  
  gameState: GameState = GameState.MENU;
  score: number = 0;
  timeLeft: number = 60;
  countdownNumber: number = 3;
  combo: number = 0;
  maxCombo: number = 0;
  targets: Target[] = [];
  hitEffects: HitEffect[] = [];
  crosshairX = 0;
  crosshairY = 0;
  private targetIdCounter: number = 0;
  private gameInterval: any;
  private targetSpawnInterval: any;
  private countdownInterval: any;
  private countdownTimer: any;
  private audioContext: AudioContext | null = null;
  private soundsEnabled = true;
  private soundVolume = 0.35;
  private readonly COMBO_TIMEOUT_MS = 1500;
  private lastHitTime = 0;
  readonly totalTime = 60;

  toggleSound(): void {
    this.soundsEnabled = !this.soundsEnabled;
  }

  get isSoundOn(): boolean {
    return this.soundsEnabled;
  }

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private title: Title,
    private meta: Meta
  ) {}

  ngOnInit(): void {
    this.initAudio();
    this.title.setTitle('射擊靶場 | 三合一遊戲小盒子');
    this.meta.updateTag({
      name: 'description',
      content: '簡單輕鬆地射擊小遊戲，靶子緩慢得隨機出現，搭配簡易的配音，療癒你的無聊時刻，展現你的瞄準技巧。'
    });
  }

  ngAfterViewInit(): void {
    // 视图初始化后可以获取容器引用
  }

  ngOnDestroy(): void {
    this.clearAllIntervals();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  private initAudio(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  startGame(): void {
    this.gameState = GameState.COUNTDOWN;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.timeLeft = this.totalTime;
    this.targets = [];
    this.hitEffects = [];
    this.targetIdCounter = 0;
    this.countdownNumber = 3;
    this.lastHitTime = 0;

    this.playSound('countdown');
    this.countdownTimer = setInterval(() => {
      this.ngZone.run(() => {
        this.countdownNumber--;
        if (this.countdownNumber > 0) {
          this.playSound('countdown');
        } else if (this.countdownNumber === 0) {
          this.playSound('go');
        } else {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
          this.gameState = GameState.PLAYING;
          this.crosshairX = window.innerWidth / 2;
          this.crosshairY = window.innerHeight / 2;
          setTimeout(() => {
            this.startCountdown();
            this.startTargetSpawning();
            this.startGameLoop();
          }, 100);
        }
      });
    }, 1000);
  }

  private startCountdown(): void {
    this.countdownInterval = setInterval(() => {
      this.ngZone.run(() => {
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          this.endGame();
        }
      });
    }, 1000);
  }

  private startTargetSpawning(): void {
    // 立即生成第一个靶子
    this.spawnTarget();

    // 每2-4秒生成一个新靶子
    this.targetSpawnInterval = setInterval(() => {
      this.ngZone.run(() => {
        if (this.gameState === GameState.PLAYING) {
          this.spawnTarget();
        }
      });
    }, 2000 + Math.random() * 2000);
  }

  private spawnTarget(): void {
    // 优先使用 ViewChild 引用，如果没有则使用 querySelector
    const container = this.gameAreaRef?.nativeElement || document.querySelector('.game-area') as HTMLElement;
    if (!container) {
      console.warn('Game area container not found');
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // 检查容器尺寸是否有效
    if (containerWidth <= 0 || containerHeight <= 0) {
      console.warn('Container has invalid dimensions:', containerWidth, containerHeight);
      // 如果尺寸无效，使用窗口尺寸作为后备
      const fallbackWidth = window.innerWidth;
      const fallbackHeight = window.innerHeight;
      if (fallbackWidth > 0 && fallbackHeight > 0) {
        this.spawnTargetWithDimensions(fallbackWidth, fallbackHeight);
      }
      return;
    }

    this.spawnTargetWithDimensions(containerWidth, containerHeight);
  }

  private spawnTargetWithDimensions(containerWidth: number, containerHeight: number): void {
    // 先确定靶子大小（60-100px）
    const targetSize = 60 + Math.random() * 40;
    
    // 由于使用 translate(-50%, -50%) 居中，需要确保中心点距离边界至少 size/2
    // 同时还要考虑游戏信息区域（顶部需要更多空间）
    const margin = targetSize / 2 + 10; // 额外10px边距
    const topMargin = margin + 100; // 顶部需要更多空间（游戏信息区域）
    const bottomMargin = margin;
    const leftMargin = margin;
    const rightMargin = margin;
    
    const minX = leftMargin;
    const maxX = containerWidth - rightMargin;
    const minY = topMargin;
    const maxY = containerHeight - bottomMargin;
    
    // 确保有有效的生成范围
    if (maxX <= minX || maxY <= minY) {
      console.warn('Invalid spawn range:', { minX, maxX, minY, maxY, containerWidth, containerHeight });
      return;
    }

    const target: Target = {
      id: this.targetIdCounter++,
      x: Math.random() * (maxX - minX) + minX,
      y: Math.random() * (maxY - minY) + minY,
      size: targetSize,
      visible: true,
      hit: false,
      spawnTime: Date.now(),
      disappearTime: Date.now() + 2000 + Math.random() * 2000 // 2-4秒后消失
    };

    this.targets.push(target);
    this.playSound('spawn');
    // 调试日志（可以在发布时移除）
    if (this.targets.length <= 3) {
      console.log('Target spawned:', { 
        id: target.id, 
        x: target.x, 
        y: target.y, 
        size: target.size,
        total: this.targets.length 
      });
    }
  }

  private startGameLoop(): void {
    this.gameInterval = setInterval(() => {
      this.ngZone.run(() => {
        if (this.gameState === GameState.PLAYING) {
          this.updateTargets();
          this.updateHitEffects();
        }
      });
    }, 16); // ~60fps
  }

  private updateTargets(): void {
    const now = Date.now();
    this.targets = this.targets.filter(target => {
      // 检查是否应该消失
      if (!target.hit && now >= target.disappearTime) {
        return false; // 移除超时的靶子
      }
      return true;
    });
  }

  private updateHitEffects(): void {
    this.hitEffects = this.hitEffects.filter(effect => {
      effect.life--;
      return effect.life > 0;
    });
  }

  onTargetClick(target: Target, event: MouseEvent): void {
    event.stopPropagation();

    if (this.gameState !== GameState.PLAYING || target.hit || !target.visible) {
      return;
    }

    const el = (event.currentTarget as HTMLElement);
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = target.size / 2;
    const ratio = Math.min(1, dist / radius);

    let ringIndex: number;
    if (ratio <= 0.125) ringIndex = 0;
    else if (ratio <= 0.375) ringIndex = 1;
    else if (ratio <= 0.625) ringIndex = 2;
    else if (ratio <= 0.875) ringIndex = 3;
    else ringIndex = 4;

    const baseScore = RING_SCORES[ringIndex];
    const now = Date.now();
    if (now - this.lastHitTime > this.COMBO_TIMEOUT_MS) {
      this.combo = 0;
    }
    this.combo++;
    this.lastHitTime = now;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const comboBonus = this.combo >= 2 ? Math.min(this.combo - 1, 5) * 2 : 0;
    const addScore = baseScore + comboBonus;

    target.hit = true;
    target.visible = false;
    this.score += addScore;

    this.createHitEffect(target.x, target.y, baseScore, ringIndex);
    this.playSound('hit', ringIndex);
    if (this.combo >= 2) this.playSound('combo');

    setTimeout(() => {
      this.targets = this.targets.filter(t => t.id !== target.id);
    }, 300);
  }

  private createHitEffect(x: number, y: number, score: number, ringIndex: number): void {
    this.hitEffects.push({
      x,
      y,
      life: 24,
      maxLife: 24,
      score,
      ringIndex
    });
  }

  @HostListener('click', ['$event'])
  onGameAreaClick(event: MouseEvent): void {
    if (this.gameState !== GameState.PLAYING) {
      return;
    }

    const targetEl = event.target as HTMLElement;
    if (!targetEl.classList.contains('target') && !targetEl.closest('.target')) {
      this.combo = 0;
      this.playSound('miss');
    }
  }

  private endGame(): void {
    this.gameState = GameState.GAME_OVER;
    this.clearAllIntervals();
    this.saveHighScore(this.score);
    this.playSound('gameOver');
  }

  private clearAllIntervals(): void {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
    if (this.targetSpawnInterval) {
      clearInterval(this.targetSpawnInterval);
      this.targetSpawnInterval = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private playSound(type: string, ringIndex?: number): void {
    if (!this.soundsEnabled || !this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'spawn':
        osc.frequency.setValueAtTime(720, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(this.soundVolume * 0.22, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      case 'countdown':
        osc.frequency.value = 520;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(this.soundVolume * 0.4, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      case 'go':
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(this.soundVolume * 0.5, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      case 'hit': {
        const pitch = 400 + (4 - (ringIndex ?? 0)) * 120;
        osc.frequency.value = pitch;
        osc.type = 'sine';
        gain.gain.setValueAtTime(this.soundVolume * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case 'combo':
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(this.soundVolume * 0.2, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case 'miss':
        osc.frequency.value = 180;
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(this.soundVolume * 0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      case 'gameOver': {
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.4);
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(this.soundVolume * 0.4, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }
      default:
        break;
    }
  }

  getHighScore(): number {
    const highScore = localStorage.getItem('shootingHighScore');
    return highScore ? parseInt(highScore, 10) : 0;
  }

  private saveHighScore(score: number): void {
    const currentHigh = this.getHighScore();
    if (score > currentHigh) {
      localStorage.setItem('shootingHighScore', score.toString());
    }
  }

  restartGame(): void {
    this.clearAllIntervals();
    this.startGame();
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  get GameState() {
    return GameState;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.gameState === GameState.PLAYING) {
      this.crosshairX = event.clientX;
      this.crosshairY = event.clientY;
    }
  }

  trackByTargetId(index: number, target: Target): number {
    return target.id;
  }

  getRingClass(ringIndex: number): string {
    const classes = ['ring-center', 'ring-inner', 'ring-mid', 'ring-outer', 'ring-edge'];
    return classes[ringIndex] ?? 'ring-mid';
  }
}

