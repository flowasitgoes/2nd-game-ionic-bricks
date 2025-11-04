import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, NgZone, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';

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
}

enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

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
  timeLeft: number = 60; // 60秒游戏时间
  targets: Target[] = [];
  hitEffects: HitEffect[] = [];
  private targetIdCounter: number = 0;
  private gameInterval: any;
  private targetSpawnInterval: any;
  private countdownInterval: any;
  private audioContext: AudioContext | null = null;
  private soundsEnabled = true;
  private soundVolume = 0.3;

  constructor(
    private router: Router,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.initAudio();
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
    this.gameState = GameState.PLAYING;
    this.score = 0;
    this.timeLeft = 60;
    this.targets = [];
    this.hitEffects = [];
    this.targetIdCounter = 0;

    // 等待DOM更新后再开始游戏
    setTimeout(() => {
      // 开始倒计时
      this.startCountdown();

      // 开始生成靶子
      this.startTargetSpawning();

      // 开始游戏循环
      this.startGameLoop();
    }, 100);
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

    // 标记为击中
    target.hit = true;
    target.visible = false;
    
    // 增加分数
    this.score += 10;

    // 创建击中效果
    this.createHitEffect(target.x, target.y);

    // 播放击中音效
    this.playSound('hit');

    // 短暂延迟后移除靶子
    setTimeout(() => {
      this.targets = this.targets.filter(t => t.id !== target.id);
    }, 300);
  }

  private createHitEffect(x: number, y: number): void {
    this.hitEffects.push({
      x,
      y,
      life: 20,
      maxLife: 20
    });
  }

  @HostListener('click', ['$event'])
  onGameAreaClick(event: MouseEvent): void {
    if (this.gameState !== GameState.PLAYING) {
      return;
    }

    // 检查是否点击了空白区域（未击中靶子）
    const target = event.target as HTMLElement;
    if (!target.classList.contains('target') && !target.closest('.target')) {
      // 可以添加扣分逻辑，或者只是播放失败音效
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
  }

  private playSound(type: string): void {
    if (!this.soundsEnabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    switch (type) {
      case 'hit':
        oscillator.frequency.value = 600;
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(this.soundVolume * 0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
        break;
      case 'miss':
        oscillator.frequency.value = 200;
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(this.soundVolume * 0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.05);
        break;
      case 'gameOver':
        oscillator.frequency.value = 300;
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(this.soundVolume * 0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
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

  trackByTargetId(index: number, target: Target): number {
    return target.id;
  }
}

