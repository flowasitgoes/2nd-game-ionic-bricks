# 上傳到 itch.io 步驟

## 1. 建置並打包（建議）

```bash
npm run build:itch
```

會產生 `platform-jumper-itch.zip`，**ZIP 根目錄就是 index.html**，符合 itch.io 規定。

## 2. 或手動打包

- 先執行 `npm run build`
- 進入 `www` 資料夾，**把「裡面的檔案」**壓成 ZIP（不要壓整個 www 資料夾）
- 確保 ZIP 解壓後第一層就有 `index.html`、`main.*.js`、`assets/` 等

## 3. 上傳

- 到遊戲的 Edit 頁 → Uploads
- 刪除舊的 ZIP（若有）
- 上傳新的 `platform-jumper-itch.zip`
- 類型選 **HTML**
- 勾選 **This file will be played in the browser**

## 4. 技術說明

- 本專案已使用 **Hash 路由**（`#/home`、`#/jumping`），itch.io 靜態託管不會對不存在的路徑回傳 404。
- `<base href="./">` 讓 JS/CSS 在子路徑下正確載入。
