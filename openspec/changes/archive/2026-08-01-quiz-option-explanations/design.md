## Context

`.codewalk.json` 的 quiz 目前只有三個欄位:`question`、`options`、`correctIndex`。結果頁(`ui/render.ts` 的 `createQuizBreakdown()`)因此只能顯示「題目 + 你的答案 + 答錯時的正確答案」,沒有任何說明為什麼。

相關的既有結構:

- `shared/schema.ts`:`CodewalkQuizQuestion` 型別與 `validateQuizQuestion()` 手寫驗證函式(不使用驗證套件,全專案一致)
- `ui/state.ts`:`QuizResult` 狀態帶著整份 `walk` 與 `answers`,所以 render 端拿得到題目物件的所有欄位,不需要新增任何狀態
- `ui/render.ts`:`createQuizBreakdown()` 逐題產生 `.codewalk-quiz-breakdown-item`,並以 `is-correct` / `is-incorrect` 兩個 class 區分色系
- `ui/theme.css`:既有 design token 一律取自 VS Code CSS 變數(`--vscode-testing-iconPassed`、`--vscode-errorForeground`、`--vscode-descriptionForeground` 等),不自帶固定色票

extension host 端(`src/`)不參與:JSON 載入後整份 `CodewalkFile` 隨 `walkLoaded` 訊息原封不動送到 webview,host 從不解讀 quiz 內容。

## Goals / Non-Goals

**Goals:**

- 讓導讀作者能為每個選項寫下「為什麼對 / 為什麼錯」,並在結果頁完整呈現
- 新欄位為選填,既有 `.codewalk.json` 一個字都不用改
- 索引錯位(解釋數量與選項數量不符)在載入階段就被擋下,不會在結果頁才發現對不上
- 不新增任何 protocol 訊息、不新增任何 webview 狀態

**Non-Goals:**

- 作答當下的即時回饋
- 每題的整體解釋欄位
- 解釋內容的 markdown / 連結渲染
- 既有計分、門檻、重走建議行為的任何變動

## Decisions

### 決策 1:平行陣列 `optionExplanations?: string[]`,而非把 `options` 改成物件聯集

```jsonc
{
  "question": "webview 送出的訊息在 host 端到達時是什麼型別?",
  "options": ["已經是 WebviewToHostMessage", "是 unknown"],
  "correctIndex": 1,
  "optionExplanations": [
    "錯:共用的只是編譯期型別,序列化通道不會保留它",
    "對:型別在編譯後消失,必須在執行期實際檢查欄位"
  ]
}
```

考慮過的替代方案:

| 方案 | 優點 | 為什麼不選 |
|---|---|---|
| `options: (string \| {text, explanation})[]` | 解釋與選項綁在一起,結構上不可能錯位 | 混合型別讓 `validateQuizQuestion()`、`renderQuiz()`、`createQuizBreakdown()` 三處都要加 normalize 層;`options[i]` 這種既有寫法全部要改 |
| 每題單一 `explanation: string` | 最省事 | 不符合 explain-change「每個選項附對錯理由」的規範,且無法對應到讀者實際選的那一個 |

選平行陣列的代價是索引對齊靠約定,這個代價由**驗證規則**承擔(見決策 2),不留給執行期。

### 決策 2:驗證規則——長度必須與 `options` 完全相同

`validateQuizQuestion()` 新增分支,`optionExplanations` 不是 `undefined` 時:

- 必須是陣列,否則 `quiz[i].optionExplanations 必須是陣列`
- 每個元素必須是非空字串,否則 `quiz[i].optionExplanations[j] 必須是非空字串`
- 長度必須等於 `options.length`,否則 `quiz[i].optionExplanations 的長度必須與 options 相同`

長度不符為什麼是硬錯誤而不是寬容處理(缺的當成沒有):因為作者最可能的錯誤就是「插入一個選項卻忘了插解釋」,寬容處理會讓解釋整排位移、每一則都掛到錯誤的選項上——顯示錯誤的解釋比不顯示解釋傷害更大。這與既有 `correctIndex` 必須落在 `options` 範圍內的嚴格程度一致。

錯誤訊息沿用既有的 `path` 前綴慣例(`quiz[0].optionExplanations`),與其他欄位的訊息風格一致,且一次收集全部錯誤、不 fail-fast。

### 決策 3:結果頁的呈現——每題底下列出全部選項

`createQuizBreakdown()` 在既有的「你的答案 / 正確答案」兩行之後,當該題有 `optionExplanations` 時追加一個解釋清單,每一列包含:

- 狀態圖示:正確選項用 `codicon-pass`,其餘用 `codicon-close`
- 選項文字(`options[i]`)
- 該選項的解釋(`optionExplanations[i]`)
- 讀者實際選的那一列額外加上標記(`is-your-answer`),讓「我選的是這個」一眼可辨

沒有 `optionExplanations` 的題目完全不產生這個區塊(不留空 `div`),與 `items` 為空時的處理方式一致。

新增的 CSS class 一律沿用既有命名前綴:`.codewalk-quiz-breakdown-explanations`、`.codewalk-quiz-breakdown-explanation`、修飾子 `.is-correct-option` / `.is-your-answer`。顏色取既有 design token:正確選項用結果頁既有的通過色、錯誤選項用 `--vscode-descriptionForeground`(降低視覺權重,避免整頁都是紅字),讀者選的那一列用 `--vscode-focusBorder` 作左側標示。**不重用** `.codewalk-warning` 與 `.codewalk-annotation-pitfall` 的樣式,理由與 pitfall 當初的決策相同:內容說明不該長得像系統錯誤。

### 決策 4:不動 protocol、不動 state

`QuizResult` 已經帶著整份 `walk`,`createQuizBreakdown()` 從 `state.walk.quiz[i].optionExplanations` 直接取用即可。這次變更**不新增**任何 `HostToWebviewMessage` / `WebviewToHostMessage` 成員,也不新增任何 `ui/state.ts` 的狀態欄位或函式——純粹是「同一份資料多渲染一段」。

`submitQuiz()` 的計分邏輯完全不受影響。

### 決策 5:文件同步範圍

- `README.md` 的 `.codewalk.json` 格式段落:最小範例的 quiz 加上 `optionExplanations`,並說明選填與長度規則
- `docs/glossary.md`:新增 `optionExplanations` 的定義,放在既有 `.codewalk.json` / `CodewalkStep` 章節之後另起 quiz 小節
- `docs/modules/walk-player.md`:走 `/sync-module-docs`,不在本次 tasks 手動改

## Risks / Trade-offs

| 風險 | 影響 | 緩解 |
|---|---|---|
| 舊導讀沒有解釋,新舊混用時體驗不一致 | 讀者對某些導讀看得到理由、某些看不到 | 選填欄位的必然結果;缺欄位時區塊完全不出現,不會顯示「無解釋」之類的佔位文字造成誤會 |
| 結果頁變長(5 題 × 4 選項 = 20 段文字) | 側邊面板需要大量捲動 | 解釋文字用較小字級與降權顏色;錯誤選項不用強調色,視覺重心仍在分數環與對錯圖示 |
| 索引對齊仍需作者自己數 | 寫錯會被驗證擋下,但要重讀錯誤訊息才知道哪裡錯 | 錯誤訊息明確指出題號與「長度必須與 options 相同」,而非泛用的格式錯誤 |
| 對外合約新增欄位 | 已散出去的舊 JSON 需確認不受影響 | 純加法變更;`shared/schema.test.ts` 明確補一個「沒有 optionExplanations 仍通過驗證」的案例作為迴歸保護 |

## 測試策略

- **Vitest 可覆蓋**:`validateCodewalk()` 對新欄位的所有分支(合法、非陣列、含空字串、長度不符、完全省略)
- **手動驗證 checklist**:結果頁的實際渲染(有解釋 / 無解釋 / 讀者選的那一列標記 / 深淺色主題下的可讀性)——與既有 UI 行為一致,不為此引入 DOM 測試環境
