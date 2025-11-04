import { Component, OnInit, OnDestroy, HostListener, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { RhythmService, RhythmState } from './rhythm.service';
import { Subscription } from 'rxjs';
import { Note, KEY_CONFIG, RHYTHM_LEVELS, ACCURACY_THRESHOLDS, RANK_CONFIG } from './rhythm.config';

@Component({
  selector: 'app-rhythm',
  templateUrl: './rhythm.component.html',
  styleUrls: ['./rhythm.component.scss'],
  standalone: false
})
export class RhythmComponent implements OnInit, OnDestroy {
  gameData: any = {
    state: RhythmState.MENU,
    currentLevel: null,
    currentTime: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    notes: [],
    stats: {
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0
    },
    accuracy: 100
  };

  private gameSubscription!: Subscription;
  private noteHeight = 60; // 音符高度
  private fallDuration = 2000; // 下落时长（毫秒）- 2秒，不再提前3秒
  private hitLineY = 0; // 判定线位置

  // 可见音符（正在下落）
  visibleNotes: Array<Note & { y: number; opacity: number }> = [];

  constructor(
    private rhythmService: RhythmService,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit(): void {
    // 默认加载第一关
    this.rhythmService.loadLevel(1);
    
    this.gameSubscription = this.rhythmService.gameData$.subscribe(data => {
      this.gameData = data;
      this.ngZone.run(() => {
        this.updateVisibleNotes();
      });
    });

    // 在游戏运行时持续更新音符位置
    this.startUpdateLoop();
  }

  private startUpdateLoop(): void {
    const updateLoop = () => {
      if (this.gameData.state === RhythmState.PLAYING) {
        this.updateVisibleNotes();
      }
      requestAnimationFrame(updateLoop);
    };
    updateLoop();
  }

  ngOnDestroy(): void {
    if (this.gameSubscription) {
      this.gameSubscription.unsubscribe();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toUpperCase();
    if (KEY_CONFIG.keys.includes(key)) {
      event.preventDefault();
      this.rhythmService.handleKeyPress(key);
      
      // 视觉反馈
      this.showKeyFeedback(key);
    }
  }

  private showKeyFeedback(key: string): void {
    // 可以通过添加 CSS 类来实现按键反馈
    const keyElement = document.querySelector(`.key-${key.toLowerCase()}`);
    if (keyElement) {
      keyElement.classList.add('pressed');
      setTimeout(() => {
        keyElement.classList.remove('pressed');
      }, 100);
    }
  }

  private updateVisibleNotes(): void {
    if (!this.gameData.currentLevel || this.gameData.state !== RhythmState.PLAYING) {
      this.visibleNotes = [];
      return;
    }

    const currentTimeMs = this.gameData.currentTime * 1000;

    this.visibleNotes = this.gameData.notes
      .filter((note: Note) => {
        if (note.hit) return false;
        
        const noteTimeMs = note.time * 1000;
        const timeDiff = noteTimeMs - currentTimeMs;
        
        // 不提前显示：音符只在到达判定线前后很短时间显示
        // timeDiff > 0 表示音符还没到，timeDiff < 0 表示音符已经过了
        // 显示窗口：音符时间前0.5秒（刚好从顶部出现）到后0.5秒（消失）
        return timeDiff >= -500 && timeDiff <= 500;
      })
      .map((note: Note) => {
        const noteTimeMs = note.time * 1000;
        const timeDiff = noteTimeMs - currentTimeMs;
        
        // 计算音符位置：在0.5秒内从顶部下落到判定线
        // 当 timeDiff = 500ms 时，音符在顶部（0%）
        // 当 timeDiff = 0ms 时，音符在判定线（80%）
        // 当 timeDiff = -500ms 时，音符在判定线下方（100%，逐渐消失）
        const progress = 1 - (timeDiff / 500); // 从 500ms 时的 0 到 -500ms 时的 2
        const y = Math.max(0, Math.min(100, progress * 40 + 40)); // 映射到 40%-80% 范围（判定线在80%）
        
        // 计算透明度
        let opacity = 1;
        if (timeDiff < 0) {
          // 已经过了判定时间，逐渐消失
          opacity = Math.max(0, 1 + (timeDiff / 500));
        }

        return {
          ...note,
          y,
          opacity
        };
      });
  }

  getNotesForKey(key: string): Array<Note & { y: number; opacity: number }> {
    return this.visibleNotes.filter(note => note.key === key);
  }

  getNoteStyle(note: Note & { y: number; opacity: number }): any {
    const color = KEY_CONFIG.colors[note.key as keyof typeof KEY_CONFIG.colors] || '#fff';
    return {
      '--note-color': color,
      '--note-y': `${note.y}%`,
      '--note-opacity': note.opacity
    };
  }

  get Math(): typeof Math {
    return Math;
  }

  startGame(): void {
    this.rhythmService.startGame();
  }

  pauseGame(): void {
    this.rhythmService.pauseGame();
  }

  resumeGame(): void {
    this.rhythmService.resumeGame();
  }

  togglePause(): void {
    if (this.gameData.state === RhythmState.PLAYING) {
      this.pauseGame();
    } else if (this.gameData.state === RhythmState.PAUSED) {
      this.resumeGame();
    }
  }

  restartGame(): void {
    if (this.gameData.currentLevel) {
      this.rhythmService.loadLevel(this.gameData.currentLevel.id);
      this.rhythmService.startGame();
    }
  }

  selectLevel(levelId: number): void {
    this.rhythmService.loadLevel(levelId);
  }

  getRank(): string {
    const accuracy = this.gameData.accuracy / 100;
    for (const [rank, config] of Object.entries(RANK_CONFIG)) {
      if (accuracy >= config.min) {
        return rank;
      }
    }
    return 'D';
  }

  getRankName(): string {
    const rank = this.getRank();
    return RANK_CONFIG[rank as keyof typeof RANK_CONFIG].name;
  }

  getTotalNotes(): number {
    return this.gameData.stats.perfect + 
           this.gameData.stats.great + 
           this.gameData.stats.good + 
           this.gameData.stats.miss;
  }

  get rhythmState(): typeof RhythmState {
    return RhythmState;
  }

  get levels(): typeof RHYTHM_LEVELS {
    return RHYTHM_LEVELS;
  }

  get keyConfig(): typeof KEY_CONFIG {
    return KEY_CONFIG;
  }

  getKeyColor(key: string): string {
    return KEY_CONFIG.colors[key as keyof typeof KEY_CONFIG.colors] || '#fff';
  }

  getAccuracyColor(): string {
    const accuracy = this.gameData.accuracy;
    if (accuracy >= 90) return '#4ECDC4';
    if (accuracy >= 70) return '#FFD93D';
    if (accuracy >= 50) return '#FFA07A';
    return '#FF6B6B';
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}

