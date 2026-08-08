# 發布檢查清單

> **已發布(2026-08-09)。** v0.1.1 上線於 VS Code Marketplace 與 Open VSX。
> 決策背景見 `openspec/decisions.md` 的「發佈已定案」。

## 上線狀態

| 平台 | 版本 | 位址 |
|---|---|---|
| VS Code Marketplace | 0.1.1 | [properworkstudio.codewalk-reader](https://marketplace.visualstudio.com/items?itemName=properworkstudio.codewalk-reader) |
| Open VSX(Cursor) | 0.1.1 | [properworkstudio/codewalk-reader](https://open-vsx.org/extension/properworkstudio/codewalk-reader) |
| GitHub | tag `v0.1.1` | [properwork-studio/codewalk](https://github.com/properwork-studio/codewalk) |

安裝:`code --install-extension properworkstudio.codewalk-reader`

**識別碼 `properworkstudio.codewalk-reader` 永久不可改。**

## 已完成

- `package.json` 上架欄位齊備:publisher `properworkstudio`、MIT、repository / bugs / homepage、categories、keywords、icon
- `LICENSE`(MIT)、`CHANGELOG.md`
- `resources/icon-128.png`(marketplace 圖示,128×128)
- README 改為使用者視角,含指令參考;拆為 `README.md`(英文為主,marketplace 預設顯示)與 `README.zh-TW.md`(繁中),開頭互相連結
- `vsce package` 零 warning、302 個測試通過
- 新增英文版自我指涉導讀 `.codewalk/2026-08-08-codebase-tour-en.codewalk.json`(`2026-08-07-codebase-tour.codewalk.json` 的完整翻譯,`file`/`startLine`/`endLine`/`anchor` 逐一對齊、`ref` 相同),供英文顯示語言下截圖用——此後兩份導讀需並行維護,`src`/`shared`/`ui` 有結構性改動時兩邊的錨點都要重新產生
- README 加 MIT License badge(靜態,讀 `LICENSE`,不依賴外部即時數據)。Marketplace 版本/安裝數/評分 badge 照下方「發布後可補」處理
- 英文版截圖 `docs/images/panel-walking-en.png`(commit `24bf00b`)
- 全專案 JSDoc 盤點補齊(commit `53af8de`),並新增 `pnpm relocate-anchors` 供日後維護時對齊自帶導讀的 anchor
- 贊助管道接上 Ko-fi:`package.json` 的 `sponsor.url`、`.github/FUNDING.yml`、兩份 README 的 Support 段落;`.vscodeignore` 補 `.github/**` 避免 FUNDING.yml 被打包進 VSIX。Ko-fi 頁面、PayPal 連結、玉山提領皆已確認
- `docs/authoring-walks.md` 與繁中版:交給 AI 產生導讀的 prompt,三種範圍(整個 codebase / git diff / 指定範圍),兩份 README 的 Quick Start 已接上入口
- 路徑逸出防護(commit `798a6de`):`file` 欄位擋下絕對路徑與 `..`,host 端解析後再圍堵一次;`capabilities.untrustedWorkspaces` 明確宣告
- GitHub repo 建立並 push、marketplace 與 Open VSX 發布、tag `v0.1.1`、截圖確認顯示正常
- 發布用的 Azure DevOps PAT 與 Open VSX token 皆已撤銷

## 發布新版時

```bash
# 1. 改版號與 CHANGELOG
# 2. 驗證
pnpm test && pnpm typecheck && pnpm format:check && pnpm relocate-anchors
# 3. 打包
pnpm package
# 4. 先 push 再發布——marketplace 的 README 圖片抓的是 GitHub 的 HEAD
git push
set -x VSCE_PAT <token>          # fish;不要用 -p 傳,token 會留在畫面與 history
pnpm exec vsce publish --packagePath codewalk.vsix
npx ovsx publish codewalk.vsix -p <ovsx token>
git tag v<版本> && git push origin v<版本>
# 5. 用完撤銷 token,並清掉 vsce 的明文儲存
rm -f ~/.vsce
```

Marketplace 不允許覆蓋同版本,發布後要修正任何東西都得升版號。頁面與版本
歷史有快取,剛發布時看到舊版屬正常,強制重新整理即可。

## 發布後可補

- README 加 marketplace badges(版本 / 安裝數 / 評分)——已經有數據,隨時可加

  ```markdown
  ![Version](https://img.shields.io/visual-studio-marketplace/v/properworkstudio.codewalk-reader)
  ![Installs](https://img.shields.io/visual-studio-marketplace/i/properworkstudio.codewalk-reader)
  ```

- 操作 GIF(README 目前只有靜態截圖)。錄製需要 `brew install gifski`;
  節奏建議人工掌握,機器模擬的鍵盤操作看起來像自動測試錄影
- Open VSX namespace 驗證(目前 `verified: false`)——需到 EclipseFdn/open-vsx.org 開 issue 申請,不影響發布與安裝
