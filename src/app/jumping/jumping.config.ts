export const JUMPING_CONFIG = {
  player: {
    width: 30,
    height: 40,
    jumpSpeed: -15,
    moveSpeed: 5,
    gravity: 0.8,
    maxFallSpeed: 20
  },
  platform: {
    minWidth: 80,
    maxWidth: 150,
    height: 20,
    minGap: 60,  // 减小最小间距，确保可跳
    maxGap: 120, // 减小最大间距，确保可跳
    colors: ['#4ECDC4', '#FF6B6B', '#FFD93D', '#95E1D3', '#FFA07A']
  },
  camera: {
    followSpeed: 0.1,
    offsetY: 0.3 // 玩家在屏幕上的位置（0.3 = 屏幕上方30%）
  },
  score: {
    pointsPerPlatform: 10,
    heightMultiplier: 0.1
  }
};

