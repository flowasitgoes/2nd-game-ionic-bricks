import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Note, RhythmLevel, RHYTHM_LEVELS, ACCURACY_THRESHOLDS, SCORE_CONFIG } from './rhythm.config';

export enum RhythmState {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  FINISHED = 'finished'
}

export interface RhythmGameData {
  state: RhythmState;
  currentLevel: RhythmLevel | null;
  currentTime: number; // 当前游戏时间（秒）
  score: number;
  combo: number;
  maxCombo: number;
  notes: Note[];
  stats: {
    perfect: number;
    great: number;
    good: number;
    miss: number;
  };
  accuracy: number; // 准确度百分比
}

@Injectable({
  providedIn: 'root'
})
export class RhythmService {
  private gameData: RhythmGameData = {
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

  private gameDataSubject = new BehaviorSubject<RhythmGameData>(this.gameData);
  public gameData$: Observable<RhythmGameData> = this.gameDataSubject.asObservable();

  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private startTime: number = 0;
  private animationFrameId: number = 0;
  private isPlaying: boolean = false;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  loadLevel(levelId: number): void {
    const level = RHYTHM_LEVELS.find(l => l.id === levelId);
    if (!level) {
      console.error('Level not found:', levelId);
      return;
    }

    // 深拷贝关卡数据
    this.gameData.currentLevel = { ...level };
    this.gameData.notes = level.notes.map(note => ({ ...note }));
    this.gameData.currentTime = 0;
    this.gameData.score = 0;
    this.gameData.combo = 0;
    this.gameData.maxCombo = 0;
    this.gameData.stats = {
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0
    };
    this.gameData.accuracy = 100;
    this.gameData.state = RhythmState.MENU;

    this.notify();
  }

  startGame(): void {
    if (!this.gameData.currentLevel) return;

    this.gameData.state = RhythmState.PLAYING;
    this.gameData.currentTime = 0;
    this.startTime = Date.now();
    this.isPlaying = true;

    // 生成简单的节拍音乐
    this.playBeatMusic();

    this.startGameLoop();
    this.notify();
  }

  pauseGame(): void {
    if (this.gameData.state === RhythmState.PLAYING) {
      this.gameData.state = RhythmState.PAUSED;
      this.isPlaying = false;
      this.stopMusic();
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.notify();
    }
  }

  resumeGame(): void {
    if (this.gameData.state === RhythmState.PAUSED) {
      this.gameData.state = RhythmState.PLAYING;
      this.isPlaying = true;
      this.startTime = Date.now() - (this.gameData.currentTime * 1000);
      this.playBeatMusic();
      this.startGameLoop();
      this.notify();
    }
  }

  private startGameLoop(): void {
    const gameLoop = () => {
      if (!this.isPlaying || this.gameData.state !== RhythmState.PLAYING) {
        return;
      }

      // 更新游戏时间
      this.gameData.currentTime = (Date.now() - this.startTime) / 1000;

      // 检查是否游戏结束
      if (this.gameData.currentLevel && 
          this.gameData.currentTime >= this.gameData.currentLevel.duration) {
        this.finishGame();
        return;
      }

      // 检查未击中的音符（超过判定窗口）
      this.checkMissedNotes();

      this.notify();
      this.animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();
  }

  private checkMissedNotes(): void {
    const currentTimeMs = this.gameData.currentTime * 1000;
    const missThreshold = ACCURACY_THRESHOLDS.good;

    for (const note of this.gameData.notes) {
      if (!note.hit) {
        const timeDiff = Math.abs(currentTimeMs - note.time * 1000);
        
        // 如果音符已经过了判定窗口，标记为 miss
        if (currentTimeMs > note.time * 1000 + missThreshold) {
          note.hit = true;
          note.accuracy = 'miss';
          this.gameData.stats.miss++;
          this.gameData.combo = 0;
          this.updateAccuracy();
          this.playMissSound();
        }
      }
    }
  }

  handleKeyPress(key: string): void {
    if (this.gameData.state !== RhythmState.PLAYING) return;

    const currentTimeMs = this.gameData.currentTime * 1000;

    // 找到最接近的未击中音符
    let closestNote: Note | null = null;
    let closestDistance = Infinity;

    for (const note of this.gameData.notes) {
      if (!note.hit && note.key.toUpperCase() === key.toUpperCase()) {
        const distance = Math.abs(currentTimeMs - note.time * 1000);
        
        // 在判定窗口内
        if (distance <= ACCURACY_THRESHOLDS.good && distance < closestDistance) {
          closestNote = note;
          closestDistance = distance;
        }
      }
    }

    if (closestNote) {
      // 判定准确度
      let accuracy: 'perfect' | 'great' | 'good' = 'good';
      if (closestDistance <= ACCURACY_THRESHOLDS.perfect) {
        accuracy = 'perfect';
      } else if (closestDistance <= ACCURACY_THRESHOLDS.great) {
        accuracy = 'great';
      }

      // 更新音符状态
      closestNote.hit = true;
      closestNote.accuracy = accuracy;

      // 更新分数和统计
      this.gameData.score += SCORE_CONFIG[accuracy] * (1 + this.gameData.combo * 0.1);
      this.gameData.combo++;
      this.gameData.maxCombo = Math.max(this.gameData.maxCombo, this.gameData.combo);
      this.gameData.stats[accuracy]++;

      // 更新准确度
      this.updateAccuracy();

      // 播放音效
      this.playHitSound(accuracy);
    } else {
      // 按错键，重置连击
      this.gameData.combo = 0;
    }

    this.notify();
  }

  private updateAccuracy(): void {
    const total = this.gameData.stats.perfect + 
                 this.gameData.stats.great + 
                 this.gameData.stats.good + 
                 this.gameData.stats.miss;
    
    if (total === 0) {
      this.gameData.accuracy = 100;
      return;
    }

    const hit = this.gameData.stats.perfect + 
                this.gameData.stats.great + 
                this.gameData.stats.good;
    
    this.gameData.accuracy = (hit / total) * 100;
  }

  private finishGame(): void {
    this.gameData.state = RhythmState.FINISHED;
    this.isPlaying = false;
    this.stopMusic();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.notify();
  }

  private playBeatMusic(): void {
    if (!this.audioContext) return;

    // 简单的节拍生成
    const bpm = this.gameData.currentLevel?.bpm || 120;
    const beatInterval = 60 / bpm; // 每拍间隔（秒）

    let beatCount = 0;
    const playBeat = () => {
      if (!this.isPlaying || this.gameData.state !== RhythmState.PLAYING) return;

      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      // 主拍使用低音
      const frequency = beatCount % 4 === 0 ? 220 : 440;
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, this.audioContext!.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.1);
      
      oscillator.start(this.audioContext!.currentTime);
      oscillator.stop(this.audioContext!.currentTime + 0.1);

      beatCount++;
      
      if (this.gameData.currentLevel && 
          this.gameData.currentTime < this.gameData.currentLevel.duration) {
        setTimeout(playBeat, beatInterval * 1000);
      }
    };

    playBeat();
  }

  private playHitSound(accuracy: 'perfect' | 'great' | 'good'): void {
    if (!this.audioContext) return;

    const frequencies = {
      perfect: 880,
      great: 660,
      good: 440
    };

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequencies[accuracy];
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  private playMissSound(): void {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = 200;
    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }

  private stopMusic(): void {
    // 简单的节拍音乐会在游戏循环中自动停止
  }

  getGameData(): RhythmGameData {
    return { ...this.gameData };
  }

  private notify(): void {
    this.gameDataSubject.next({ ...this.gameData });
  }
}

