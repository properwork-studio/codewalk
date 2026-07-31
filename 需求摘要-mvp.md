# 需求摘要:CodeWalk MVP(播放器)

> grill-me 產出格式;供 `/opsx:new` 直接作為 proposal 素材。2026-07-31。

- **一句話**:VS Code extension,讀 `.codewalk/` 的導讀 JSON,在側邊面板帶讀者逐步走 codebase——步驟導覽+檔案行號跳轉+可收合術語註解+互動 quiz。

## 已定決策(附理由,詳見 openspec/decisions.md)

- 播放器/產生器分離,格式開放(產生需 AI 脈絡、播放需 UI 自由,分離各取所長)
- quiz 互動住 extension(存在理由);<3/5 顯示「建議重走或選更詳細版本」
- `ref` 釘 commit+漂移警告(衍生快照紀律沿用 harness)
- 視覺跟隨編輯器主題;快捷鍵優先(手不離方向鍵)
- MVP 以 VSIX 發佈

## Out of Scope(MVP)

- 產生功能(二期:shell out `claude -p`)
- Marketplace 上架、多語系、JetBrains 支援
- tour 錄製 UI(產生器的事,不是播放器的)
- 編輯既有 tour 的 UI(改 JSON 即可)

## 未決事項(進 clarify.md 處理)

- webview UI 技術:vanilla TS vs Preact?(傾向 vanilla,MVP 元件少)
- schema 細節:step 錨定用單行 `line` 還是範圍 `selection`?術語註解是 step 內嵌還是全域字典?熟悉度層級要不要進格式?
- 要不要做 CodeTour `.tour` 匯入相容?(生態借力 vs 範圍蔓延)
- 整合測試策略:@vscode/test-electron 的成本值不值,或 MVP 用手動驗證 checklist?
- 圖解資產(直覺章節的圖)怎麼帶:相對路徑進 `.codewalk/assets/`?

## 建議變更分級

**重大**——新產品第一個 capability(`walk-player`),走完整 OpenSpec 流程;正好作為本 repo 的 dogfooding 驗證鏈。
