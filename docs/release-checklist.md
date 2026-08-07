# 發布檢查清單

> 上架前置作業已完成(2026-08-07),以下是**只能由人執行**的步驟。
> 決策背景見 `openspec/decisions.md` 的「發佈已定案」。

## 已完成

- `package.json` 上架欄位齊備:publisher `properworkstudio`、MIT、repository / bugs / homepage、categories、keywords、icon
- `LICENSE`(MIT)、`CHANGELOG.md`(0.1.0)
- `resources/icon-128.png`(marketplace 圖示,128×128)
- README 改為使用者視角,含截圖、指令參考、英文語言提示
- `vsce package` 零 warning、250 個測試通過

## 待執行

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
