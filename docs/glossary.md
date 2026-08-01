# glossary.md — 格式與領域名詞定義

> 紀律:同一概念全專案只用同一個詞;新名詞在 grill-me / clarify 訪談中定案後寫入這裡。

## `.codewalk.json` / `CodewalkStep`

- **item(`CodewalkItem`)**:`CodewalkStep.items` 陣列的元素,統一容器類型,承載 tip / pitfall / todo / reference / snippet 五種說明元件。以 `kind` 欄位區分 discriminated union,陣列順序即畫面顯示順序(作者可自由交錯排列)。與既有 `terms?: CodewalkTerm[]`(可收合術語卡)是分開的獨立欄位,不混用。
  - **tip**:補充最佳實踐或延伸閱讀,語氣正向、不影響理解主線。`{ kind: 'tip'; text: string }`
  - **pitfall**:「容易誤解成 X,其實是 Y」的警示。結構化雙欄位(非單一 text):`{ kind: 'pitfall'; misconception: string; reality: string }`。視覺語言與系統層級的 refDrift/stepJump 警告(`codewalk-warning`)刻意區隔,避免讀者誤認成系統錯誤。
  - **todo**:標出「這段行為未來可能會變」的提醒。`{ kind: 'todo'; text: string }`
  - **reference**:外部連結(官方文件/RFC/issue)。`{ kind: 'reference'; label: string; url: string }`,`url` 需通過 http/https 合法格式驗證。
  - **snippet**:額外引用另一段相關程式碼(如「呼叫端在這裡」)。`{ kind: 'snippet'; label: string; file: string; startLine: number; endLine: number }`。面板上預設展開預覽實際程式碼內容(highlight.js 高亮,依深/淺色模式切換固定 theme);點擊會重用既有 jumpToLocation 機制跳轉編輯器,不記錄「正在查看 snippet」的額外狀態。
  - **diff**:呈現既有檔案內一段程式碼「改了什麼」的說明元件(前後差異對照),用於區塊性改動——整檔新增或整檔刪除不適用,應改用 `snippet`(整檔新增)或文字說明(整檔刪除)。`{ kind: 'diff'; label: string; file: string; startLine: number; endLine: number; diffText: string }`。`diffText` 只存 diff 的 hunk 本體(不含 `diff --git`/`---`/`+++`/`@@ @@` 等檔頭行),逐行依開頭字元(`+`/`-`/空白)判斷新增/刪除/context,驗證階段要求至少一行加減行(否則不算 diff,退化情境應改用 `snippet`)。`startLine`/`endLine` 一律代表**新版(現在檔案)**的行號範圍,供點擊跳轉使用,與舊版行號無關;純刪除 hunk 時兩者相同,指向刪除位置在新版檔案中的插入點。渲染時依每行開頭字元疊加紅/綠背景色,並重用 highlight.js 對去除開頭字元後的內容做語法高亮(共用 `codewalk.snippetTheme`)。點擊行為與 `snippet` 完全相同,跳轉編輯器、不額外記錄狀態。

## `CodewalkQuizQuestion.optionExplanations`

- **定位**:quiz 每題的選填欄位,`string[]`,索引與 `options` 一一對應,長度必須與 `options` 完全相同(驗證階段強制,長度不符會拒絕載入)。第 i 個字串說明第 i 個選項為什麼對或為什麼錯。
- **顯示時機**:讀者送出答案、進入 quiz 結果頁後,系統在該題的作答結果底下列出**所有**選項的文字與其解釋,並標示出正確選項與讀者實際選擇的選項——不論該題答對或答錯都會顯示,讓答對的讀者也能確認自己不是猜中的。
- **省略時**:結果頁維持既有行為(只顯示你的答案、答錯時額外顯示正確答案),不出現任何空白區塊。
- **與 `items` 的關係**:兩者是完全獨立的機制——`items` 是 step 內的說明元件,`optionExplanations` 是 quiz 選項的解釋,不互相影響。
