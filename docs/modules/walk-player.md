# walk-player

**狀態**:開發中|**負責介面**:CodeWalk 側邊面板(活動列容器 `codewalk`,webview view `codewalk.playerView`)

## 用途

互動式 codebase 導讀播放器。讀取 workspace 內 `.codewalk/*.codewalk.json` 導讀檔案,在 VS Code 側邊面板帶讀者逐步走過 code——取代只能啃 diff 或聽口頭講解的現況,讓「帶讀 code」變成可重複執行、可互動自測的體驗。

## 功能清單

- 掃描 `.codewalk/` 目錄、列出並載入導讀檔案,含格式驗證與錯誤處理 → [spec](../../openspec/specs/walk-player/spec.md)
- 步驟導覽(上一步/下一步,鍵盤方向鍵操作)→ [spec](../../openspec/specs/walk-player/spec.md)
- 檔案行號跳轉並高亮對應程式碼範圍,含檔案不存在的錯誤處理 → [spec](../../openspec/specs/walk-player/spec.md)
- 可收合術語註解 → [spec](../../openspec/specs/walk-player/spec.md)
- Quiz 自測與回饋,過關門檻可由 `.codewalk.json` 的 `passThreshold` 設定(省略時預設題數簡單多數)→ [spec](../../openspec/specs/walk-player/spec.md)
- ref 漂移偵測:比對 workspace HEAD 與導讀釘住的 commit,不符時顯示警告 → [spec](../../openspec/specs/walk-player/spec.md)
- 視覺跟隨編輯器主題(讀 VS Code CSS 變數)→ [spec](../../openspec/specs/walk-player/spec.md)
- Step 內顯示提示/陷阱警告/待辦標記(annotation:tip/pitfall/todo)→ [spec](../../openspec/specs/walk-player/spec.md)
- Step 內顯示外部連結參考,點擊開啟外部瀏覽器 → [spec](../../openspec/specs/walk-player/spec.md)
- Step 內顯示程式碼片段引用(snippet),語法高亮預覽並可點擊跳轉編輯器,語法高亮 theme 可由 `codewalk.snippetTheme` 設定 → [spec](../../openspec/specs/walk-player/spec.md)
- 上述說明元件(annotation/reference/snippet)依 `.codewalk.json` 的 `items` 陣列原始順序自由交錯顯示 → [spec](../../openspec/specs/walk-player/spec.md)

## 主要流程

開啟面板 → 選擇 `.codewalk.json` → 逐步瀏覽(每步自動跳轉高亮程式碼)→ 走到最後一步 → 進入 Quiz 自測 → 顯示分數與(未達門檻時的)重走建議 → 可重新挑戰 Quiz / 重新走一次 / 回到導讀列表。

## 資料實體

- `.codewalk.json`(本模組擁有,格式單點定義於 `shared/schema.ts`):對外開放格式,欄位改名/刪除視同破壞性變更
- postMessage 協定(本模組擁有,單點定義於 `shared/protocol.ts`):extension host ⇄ webview 的訊息合約

## E2E 覆蓋

無自動化 E2E——VS Code extension 的 host↔webview↔vscode API 整合行為改走 Extension Development Host 手動驗證 checklist(見 `openspec/changes/archive/2026-08-01-walk-player/tasks.md` 第 10、11 節,`items` 相關 checklist 見 `openspec/changes/archive/2026-08-01-add-step-items/tasks.md`);純邏輯(schema 驗證、協定序列化、quiz 計分、ref 比對、snippet 讀檔、highlight.js 語言解析)由 Vitest 單元測試覆蓋。

## 已知限制與技術債

- Quiz 選擇題與結果頁尚未做視覺美化(目前是 vanilla TS 的陽春樣式),使用者已確認排入下一步待辦(2026-08-01)
- schema 的 `startLine`/`endLine` 目前僅支援單行高亮(`startLine === endLine`),多行反白渲染邏輯尚未實作,欄位形狀已預留(2026-07-31)
- 沒有 `@vscode/test-electron` 整合測試,MVP 階段刻意選擇手動驗證 checklist(design.md 決策 4),回頭條件:出現第二個貢獻者或手動測試單輪超過 ~15 分鐘

## 變更歷史

- 2026-08-01 `walk-player` 新增 walk-player capability:VS Code extension MVP 播放器(步驟導覽、檔案跳轉、術語註解、Quiz 自測含可設定過關門檻、ref 漂移警告),含手動驗證階段追加的多項 bug 修復(quiz 結果頁/作答中無法離開、術語收合誤觸發、鍵盤快捷鍵失焦、檔案不存在錯誤未顯示)
- 2026-08-01 `add-step-items` 新增 `CodewalkStep.items`:tip/pitfall/todo/reference/snippet 五種說明元件(discriminated union,依陣列順序交錯顯示),snippet 支援語法高亮預覽(highlight.js 官方色票,`codewalk.snippetTheme` 設定可選 10 種主題)與點擊跳轉編輯器
