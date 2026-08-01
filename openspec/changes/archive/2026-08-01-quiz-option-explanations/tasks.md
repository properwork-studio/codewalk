> **建議開發方式**:本次變更橫跨「協定與 schema」與「webview UI」兩類元件。
> 任務 1(schema 與 validator)是純邏輯、可完整單元測試 → 用 **tdd skill**(red-green-refactor)執行。
> 任務 2(結果頁渲染與樣式)是 webview UI,無 DOM 測試環境 → 直接實作 + Extension Development Host 手動驗證。
> 任務 3(文件同步)直接編輯。
> extension host(`src/`)本次完全不動。

## 1. schema 新增 optionExplanations 欄位與驗證

- [x] 1.1 **[AFK]** 以 tdd 在 `shared/schema.test.ts` 先寫失敗測試,再改 `shared/schema.ts`,使 `Requirement: Quiz 選項解釋的格式驗證` 的三個 scenario 全部通過:
  - `CodewalkQuizQuestion` 新增 `optionExplanations?: string[]`
  - `validateQuizQuestion()` 新增分支:非陣列 → `quiz[i].optionExplanations 必須是陣列`;元素非字串或空字串 → `quiz[i].optionExplanations[j] 必須是非空字串`;長度不等於 `options.length` → `quiz[i].optionExplanations 的長度必須與 options 相同`
  - 錯誤一次收集完再回傳,不 fail-fast(沿用既有慣例)
- [x] 1.2 **[AFK]** 補一個明確的迴歸測試:完全不含 `optionExplanations` 的 `.codewalk.json` 仍通過驗證(對應 `Scenario: 省略欄位仍為合法格式`),保護「純加法、舊檔不壞」這個對外合約承諾
- [x] 1.3 **[AFK]** 驗證切片可獨立交付:`pnpm test` 與 `pnpm typecheck` 全綠,且在 `.codewalk/` 放一份長度刻意寫錯的測試 JSON,確認面板顯示的是指出題號與長度不符的錯誤訊息(而非泛用格式錯誤)

## 2. 結果頁顯示選項解釋

- [x] 2.1 **[AFK]** 改 `ui/render.ts` 的 `createQuizBreakdown()`,使 `Requirement: Quiz 選項解釋` 的五個 scenario 可通過:該題有 `optionExplanations` 時,在既有「你的答案 / 正確答案」之後追加解釋清單,每列含狀態圖示(正確選項 `codicon-pass`、其餘 `codicon-close`)、選項文字、對應解釋;讀者實際選的那一列加上 `is-your-answer` 標記;無此欄位時完全不產生區塊
- [x] 2.2 **[HITL]** 在 `ui/theme.css` 補樣式(色彩與字級為品味判斷,需人工確認):`.codewalk-quiz-breakdown-explanations`、`.codewalk-quiz-breakdown-explanation`、`.is-correct-option`、`.is-your-answer`;顏色一律取 VS Code CSS 變數,不重用 `.codewalk-warning` 與 `.codewalk-annotation-pitfall` 的樣式
  - 實作已完成、build 通過;實際畫面效果留待 2.3 在 Extension Development Host 中一併確認,樣式細節（色彩/間距）需你過目後才算數
- [x] 2.3 **[HITL]** 在 Extension Development Host 手動驗證:同一份導讀混合「有解釋 / 無解釋」的題目,確認答對題與答錯題都列出全部選項、正確選項與自己的選擇可分辨、無解釋的題目不留空區塊,並在深色與淺色主題下各看一次可讀性

## 3. 對外合約文件同步

- [x] 3.1 **[AFK]** 更新 `README.md` 的 `.codewalk.json` 格式段落:最小範例的 quiz 加上 `optionExplanations`,說明選填、索引對齊、長度必須與 `options` 相同
- [x] 3.2 **[AFK]** 更新 `docs/glossary.md`:新增 quiz 小節定義 `optionExplanations`,與既有 `CodewalkStep` 章節並列
- [x] 3.3 **[AFK]** 更新 `.codewalk/2026-08-01-codebase-tour.codewalk.json`:為 5 題各補上 `optionExplanations`(這份導讀第 16 步的 todo 元件正是標記此缺口),並把該 todo 改寫為說明新欄位的內容;順手確認 `.codewalk/` 其餘導讀未受影響

## 4. 驗證通過

- [x] 4.1 **[HITL]** 驗證通過:`pnpm test`(含新增的 validator 測試)、`pnpm typecheck`、`pnpm build` 全綠;Extension Development Host 手動驗證 checklist 走完——載入合法導讀 → 走完 steps → 作答 → 結果頁解釋顯示正確;載入 `optionExplanations` 長度寫錯的導讀 → 顯示格式錯誤且 extension 不崩潰;載入不含該欄位的舊導讀 → 行為與變更前完全相同
