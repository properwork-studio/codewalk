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
- Quiz 每個選項可選填 `optionExplanations` 解釋為什麼對/為什麼錯,結果頁列出全部選項解釋並標示正確選項與讀者的選擇,長度需與 `options` 相符 → [spec](../../openspec/specs/walk-player/spec.md)
- ref 漂移偵測:比對 workspace HEAD 與導讀釘住的 commit,不符時顯示警告 → [spec](../../openspec/specs/walk-player/spec.md)
- 視覺跟隨編輯器主題(讀 VS Code CSS 變數渲染介面;程式碼片段的語法配色一併跟隨,見下方語法高亮條目)→ [spec](../../openspec/specs/walk-player/spec.md)
- Step 內顯示提示/陷阱警告/待辦標記(annotation:tip/pitfall/todo)→ [spec](../../openspec/specs/walk-player/spec.md)
- Step 內顯示外部連結參考,點擊開啟外部瀏覽器 → [spec](../../openspec/specs/walk-player/spec.md)
- Step 內顯示程式碼片段引用(snippet),語法高亮預覽並可點擊跳轉編輯器 → [spec](../../openspec/specs/walk-player/spec.md)
- Step 內顯示改動片段(diff),逐行以背景色與 `+`/`-` 標記字元呈現新增/刪除/context,同時顯示舊版與新版雙欄行號並套用語法高亮,點擊可跳轉編輯器 → [spec](../../openspec/specs/walk-player/spec.md)
- snippet/diff 的語法高亮配色跟隨讀者當前的 VS Code 主題(依 Shiki 讀取主題 tokenColors);無法解析當前主題、或讀者切換主題時降級/即時重繪為內建預設配色,不中斷走讀 → [spec](../../openspec/specs/syntax-highlighting/spec.md)
- 上述說明元件(annotation/reference/snippet/diff)依 `.codewalk.json` 的 `items` 陣列原始順序自由交錯顯示 → [spec](../../openspec/specs/walk-player/spec.md)
- Quiz 作答紀錄:送出後留存該導讀最後一次的時間與結果(不寫入 `.codewalk.json`,存於 workspace 狀態),導讀列表顯示通過圖示、分數與相對時間,無紀錄不顯示;`ref` 變更(導讀重新產生)後舊紀錄失效;不阻擋重新走讀或重新作答 → [spec](../../openspec/specs/walk-player/spec.md)
- 列表上每筆作答紀錄可透過 `⋮`「更多動作」選單清除,選單內「清除 Quiz 紀錄」文字明確、兩段式確認(點兩下才真的刪)避免誤觸,同時只有一份導讀的選單能展開 → [spec](../../openspec/specs/walk-player/spec.md)
- 走讀畫面可隨時透過「返回列表」按鈕或 Esc 直接回到導讀選擇畫面,不需先走完全部步驟,也不會留下作答紀錄 → [spec](../../openspec/specs/walk-player/spec.md)

## 主要流程

開啟面板 → 選擇 `.codewalk.json` → 逐步瀏覽(每步自動跳轉高亮程式碼,可隨時返回列表)→ 走到最後一步 → 進入 Quiz 自測 → 顯示分數與(未達門檻時的)重走建議 → 可重新挑戰 Quiz / 重新走一次 / 回到導讀列表。

## 資料實體

- `.codewalk.json`(本模組擁有,格式單點定義於 `shared/schema.ts`):對外開放格式,欄位改名/刪除視同破壞性變更
- postMessage 協定(本模組擁有,單點定義於 `shared/protocol.ts`):extension host ⇄ webview 的訊息合約

## E2E 覆蓋

無自動化 E2E——VS Code extension 的 host↔webview↔vscode API 整合行為改走 Extension Development Host 手動驗證 checklist(見 `openspec/changes/archive/2026-08-01-walk-player/tasks.md` 第 10、11 節,`items` 相關 checklist 見 `openspec/changes/archive/2026-08-01-add-step-items/tasks.md`,`diff` 相關 checklist 見 `openspec/changes/archive/2026-08-01-add-diff-item/tasks.md` 第 6、7 節,語法高亮換 Shiki 與跟隨編輯器主題相關 checklist 見 `openspec/changes/archive/2026-08-03-switch-to-shiki-highlighter/tasks.md`);純邏輯(schema 驗證、協定序列化、quiz 計分、ref 比對、snippet 讀檔、Shiki 語言註冊、主題檔 JSONC 解析與 `include` 繼承、diff 逐行分類與雙欄行號計算)由 Vitest 單元測試覆蓋。

## 已知限制與技術債

- Quiz 選擇題與結果頁尚未做視覺美化(目前是 vanilla TS 的陽春樣式),使用者已確認排入下一步待辦(2026-08-01)
- schema 的 `startLine`/`endLine` 目前僅支援單行高亮(`startLine === endLine`),多行反白渲染邏輯尚未實作,欄位形狀已預留(2026-07-31)
- 沒有 `@vscode/test-electron` 整合測試,MVP 階段刻意選擇手動驗證 checklist(design.md 決策 4),回頭條件:出現第二個貢獻者或手動測試單輪超過 ~15 分鐘
- 作答紀錄存於 VS Code workspace 狀態,換機器、重裝 VS Code 或清除 extension 狀態即歸零,且無法手動編輯;導讀 `ref` 變更後舊紀錄不再顯示,但不做垃圾回收(殘留量級是每份導讀一筆、幾十 bytes,不值得處理)

## 變更歷史

- 2026-08-01 `walk-player` 新增 walk-player capability:VS Code extension MVP 播放器(步驟導覽、檔案跳轉、術語註解、Quiz 自測含可設定過關門檻、ref 漂移警告),含手動驗證階段追加的多項 bug 修復(quiz 結果頁/作答中無法離開、術語收合誤觸發、鍵盤快捷鍵失焦、檔案不存在錯誤未顯示)
- 2026-08-01 `add-step-items` 新增 `CodewalkStep.items`:tip/pitfall/todo/reference/snippet 五種說明元件(discriminated union,依陣列順序交錯顯示),snippet 支援語法高亮預覽(highlight.js 官方色票,`codewalk.snippetTheme` 設定可選 10 種主題)與點擊跳轉編輯器
- 2026-08-01 `quiz-option-explanations` 新增 `CodewalkQuizQuestion.optionExplanations`(選填字串陣列,索引對齊 `options`,長度不符即載入失敗):結果頁列出每個選項為什麼對/錯,答對與答錯的題目都會顯示,省略欄位時行為完全不變
- 2026-08-01 `add-diff-item` 新增 `CodewalkItem` 第 6 種 kind `diff`:呈現既有檔案內一段程式碼的改動前後差異,逐行以背景色、`+`/`-` 標記字元、舊版/新版雙欄行號呈現新增/刪除/context 並套用語法高亮,點擊沿用既有跳轉機制;`diffText` 只存 hunk 本體,validator 要求至少一行加減行且 `oldStartLine` 為正整數;不新增 postMessage 協定訊息
- 2026-08-03 `quiz-attempt-record` 新增 quiz 作答紀錄:送出後留存該導讀最後一次的時間與結果(存於 workspace 狀態,不寫入 `.codewalk.json`),導讀列表顯示過關圖示、分數、相對時間(無紀錄不顯示),`ref` 變更後舊紀錄自動失效;每筆紀錄可透過 `⋮`「更多動作」選單清除,選單內兩段式確認;不阻擋既有重走/重測流程。手動驗證階段一併補上走讀畫面的「返回列表」按鈕與 Esc 快捷鍵(既有 MVP 缺口),並歷經多輪修正列表項目 hover 對比度問題
- 2026-08-03 `switch-to-shiki-highlighter` 新增 `syntax-highlighting` capability,語法高亮引擎由 highlight.js 換成 Shiki(與 VS Code 編輯器同源的 TextMate grammar):snippet/diff 配色改讀讀者當前 VS Code 主題的 tokenColors,無法解析時降級為內建 dark-plus/light-plus,讀者切換主題時即時重繪、不需重開面板;**BREAKING**:移除 `codewalk.snippetTheme` 設定(MVP 未發佈無實際使用者)。不追求與編輯器 100% 一致——semantic tokens(語言伺服器提供的細分色)落在 TextMate 方案能力範圍外,已實測確認換 grammar 來源也無法解決,判定為長期限制
