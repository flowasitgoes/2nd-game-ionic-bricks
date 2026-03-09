import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';

const TEXTS = {
  en: {
    title: '🧗 Platform Jumper',
    subtitle: 'Cute, playful UI • Sound like playing music • No win or lose — just relax. Fall or climb forever.',
    startGame: 'Start Game',
    description: 'Every jump has fun interactions and chords. No pressure, no game over: climb as high as you like or enjoy falling. Endless and stress-free. Great for kids, casual players, and anyone new to web games — computer-friendly.',
    playBtn: 'Play'
  },
  zh: {
    title: '🧗 跳躍階梯遊戲',
    subtitle: '可愛有趣的互動 • 跳躍像在彈奏 • 沒有輸贏，純舒壓。可以一直掉下去，也可以慢慢跳上去，無止境。',
    startGame: '開始遊戲',
    description: '每次跳躍都有可愛互動與和弦聲，像在彈琴。沒有壓力、不會 Game Over，想往上跳或享受往下掉都可以，無止境、超舒壓。適合小孩、年輕人、長輩與剛接觸網頁小遊戲的玩家，電腦友善。',
    playBtn: '開始玩'
  }
};

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  currentLang: 'en' | 'zh' = 'en';

  get t() {
    return TEXTS[this.currentLang];
  }

  constructor(
    private router: Router,
    private title: Title,
    private meta: Meta
  ) {}

  ngOnInit(): void {
    this.updateMeta();
  }

  toggleLang(): void {
    this.currentLang = this.currentLang === 'en' ? 'zh' : 'en';
    this.updateMeta();
  }

  private updateMeta(): void {
    const descEn = 'Platform Jumper: jump stairs / jump platforms with abstract rock-climbing spirit. Infinite jumps, infinite retries. Every step has piano- and guitar-like sounds. No win or lose — relax, fall or climb forever. For kids, casual players, elders & web game beginners; computer-friendly.';
    const descZh = '跳躍階梯遊戲（Platform Jumper）：跳平台遊戲，抽象化攀岩精神，無限跳躍、無限重試。每跳一格都有鋼琴、吉他般的有趣音階與聲效，沒有輸贏、超舒壓。適合小孩、年輕人、長輩與剛接觸網頁小遊戲的玩家，電腦友善。';
    const titleEn = 'Platform Jumper | Jump Stairs Game — Music, Endless Climb, Relaxing Web Game';
    const titleZh = '跳躍階梯遊戲 | Platform Jumper — 音樂階梯跳躍、無限攀爬、舒壓小遊戲';

    if (this.currentLang === 'en') {
      this.title.setTitle(titleEn);
      this.meta.updateTag({ name: 'description', content: descEn });
      this.meta.updateTag({ property: 'og:title', content: titleEn });
      this.meta.updateTag({ property: 'og:description', content: descEn });
      this.meta.updateTag({ name: 'twitter:title', content: titleEn });
      this.meta.updateTag({ name: 'twitter:description', content: descEn });
    } else {
      this.title.setTitle(titleZh);
      this.meta.updateTag({ name: 'description', content: descZh });
      this.meta.updateTag({ property: 'og:title', content: titleZh });
      this.meta.updateTag({ property: 'og:description', content: descZh });
      this.meta.updateTag({ name: 'twitter:title', content: titleZh });
      this.meta.updateTag({ name: 'twitter:description', content: descZh });
    }
  }

  navigateToGame(game: 'breakout' | 'rhythm' | 'shooting' | 'catching' | 'jumping'): void {
    this.router.navigate([`/${game}`]);
  }
}
