# glossary.md — 格式與領域名詞定義

> 紀律:同一概念全專案只用同一個詞;新名詞在 grill-me / clarify 訪談中定案後寫入這裡。

## `.codewalk.json` / `CodewalkStep`

- **item(`CodewalkItem`)**:`CodewalkStep.items` 陣列的元素,統一容器類型,承載 tip / pitfall / todo / reference / snippet 五種說明元件。以 `kind` 欄位區分 discriminated union,陣列順序即畫面顯示順序(作者可自由交錯排列)。與既有 `terms?: CodewalkTerm[]`(可收合術語卡)是分開的獨立欄位,不混用。
  - **tip**:補充最佳實踐或延伸閱讀,語氣正向、不影響理解主線。`{ kind: 'tip'; text: string }`
  - **pitfall**:「容易誤解成 X,其實是 Y」的警示。結構化雙欄位(非單一 text):`{ kind: 'pitfall'; misconception: string; reality: string }`。視覺語言與系統層級的 refDrift/stepJump 警告(`codewalk-warning`)刻意區隔,避免讀者誤認成系統錯誤。
  - **todo**:標出「這段行為未來可能會變」的提醒。`{ kind: 'todo'; text: string }`
  - **reference**:外部連結(官方文件/RFC/issue)。`{ kind: 'reference'; label: string; url: string }`,`url` 需通過 http/https 合法格式驗證。
  - **snippet**:額外引用另一段相關程式碼(如「呼叫端在這裡」)。`{ kind: 'snippet'; label: string; file: string; startLine: number; endLine: number }`。面板上預設展開預覽實際程式碼內容(highlight.js 高亮,依深/淺色模式切換固定 theme);點擊會重用既有 jumpToLocation 機制跳轉編輯器,不記錄「正在查看 snippet」的額外狀態。
