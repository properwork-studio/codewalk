# 發布檢查清單

> 上架前置作業已完成(2026-08-07),以下是**只能由人執行**的步驟。
> 決策背景見 `openspec/decisions.md` 的「發佈已定案」。

## 已完成

- `package.json` 上架欄位齊備:publisher `properworkstudio`、MIT、repository / bugs / homepage、categories、keywords、icon
- `LICENSE`(MIT)、`CHANGELOG.md`(0.1.0)
- `resources/icon-128.png`(marketplace 圖示,128×128)
- README 改為使用者視角,含指令參考;拆為 `README.md`(英文為主,marketplace 預設顯示)與 `README.zh-TW.md`(繁中),開頭互相連結
- `vsce package` 零 warning、279 個測試通過
- 新增英文版自我指涉導讀 `.codewalk/2026-08-08-codebase-tour-en.codewalk.json`(`2026-08-07-codebase-tour.codewalk.json` 的完整翻譯,`file`/`startLine`/`endLine`/`anchor` 逐一對齊、`ref` 相同),供英文顯示語言下截圖用——此後兩份導讀需並行維護,`src`/`shared`/`ui` 有結構性改動時兩邊的錨點都要重新產生
- README 加 MIT License badge(靜態,讀 `LICENSE`,不依賴外部即時數據,不必等發布)。Marketplace 版本/安裝數/評分 badge 仍照下方「發布後可補」延後
- 英文版截圖 `docs/images/panel-walking-en.png` 已補上(commit `24bf00b`),`README.md` 的引用不再是死連結
- 全專案 JSDoc 盤點補齊(commit `53af8de`),並新增 `pnpm relocate-anchors` 供日後維護時對齊自帶導讀的 anchor
- 贊助管道接上 Ko-fi:`package.json` 新增 `sponsor.url`(marketplace 與擴充套件面板會長出 Sponsor 按鈕)、`.github/FUNDING.yml`、兩份 README 的 Support 段落;`.vscodeignore` 補 `.github/**` 避免 FUNDING.yml 被打包進 VSIX

## 待執行

### 0. 確認 Ko-fi 頁面與收款鏈路已就緒(硬性前置,擋發布)

程式碼側已完成:`package.json` 的 `sponsor.url`、`.github/FUNDING.yml`、
兩份 README 都已指向 `https://ko-fi.com/properworkstudio`。

發布前需人工確認(我無法從外部驗證——Ko-fi 有 Cloudflare 保護,對存在與
不存在的帳號一律回 403):

1. 瀏覽器開 <https://ko-fi.com/properworkstudio>,確認頁面存在且已公開
2. Ko-fi `Settings → Payments` 已連上 PayPal(Stripe 不用理,台灣不支援)
3. 玉山「玉山全球通」PayPal 提領已綁定 —— **這一項要在對外掛連結前完成**

**帶著連不到的 Ko-fi 網址發布,marketplace 與 VS Code 擴充套件面板上的
Sponsor 按鈕就是一顆死連結**,比沒有按鈕更糟。`sponsor.url` 語法上是合法
網址,`vsce package` **不會**幫你擋。

背景:GitHub Sponsors 與 Buy Me a Coffee 的出金都走 Stripe,而 Stripe 不支援
台灣收款,所以走 Ko-fi(款項直接進 PayPal,Ko-fi 全程不經手)。台灣 PayPal 依
法規強制自動提領,沒先綁好提領,首筆款項會卡在流程中間;非玉山存戶申請審核
約 5 個工作天。

### 1. 建立 GitHub repo 並 push(硬性前置)

```bash
# GitHub 上建立 properworkstudio/codewalk,設為 public
git remote add origin https://github.com/properworkstudio/codewalk.git
git push -u origin main
```

**不做這步,marketplace 頁面會壞掉**——vsce 把 README 的相對路徑轉成
`https://github.com/properworkstudio/codewalk/raw/HEAD/...`,repo 不存在或非
public 時,截圖與所有連結都是死的。

### 2. 發布到 VS Code Marketplace

需要 Azure DevOps 的 Personal Access Token(scope: Marketplace → Manage)。

```bash
pnpm package                 # 產生 codewalk.vsix
npx vsce login properworkstudio
npx vsce publish
```

發布後 extension 識別碼為 `properworkstudio.codewalk`,**永久不可改**。

### 3. (可選)發布到 Open VSX,供 Cursor 使用

Cursor 不能用微軟 Marketplace(ToS 只授權自家產品)。需先註冊 Eclipse
Foundation 帳號並簽 Publisher Agreement。

```bash
npx ovsx create-namespace properworkstudio -p <token>
npx ovsx publish codewalk.vsix -p <token>
```

同一份 VSIX 可以雙推,不必重新打包。

## 發布後可補

- README 加 marketplace badges(版本 / 安裝數 / 評分)——發布前加會顯示成
  破圖或 0,所以留到有數據再說

  ```markdown
  ![Version](https://img.shields.io/visual-studio-marketplace/v/properworkstudio.codewalk)
  ![Installs](https://img.shields.io/visual-studio-marketplace/i/properworkstudio.codewalk)
  ```

- 操作 GIF(README 目前只有靜態截圖)。錄製需要 `brew install gifski`;
  節奏建議人工掌握,機器模擬的鍵盤操作看起來像自動測試錄影
