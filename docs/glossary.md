# glossary.md — 格式與領域名詞定義

> 紀律:同一概念全專案只用同一個詞;新名詞在 grill-me / clarify 訪談中定案後寫入這裡。

## `.codewalk.json` / `CodewalkStep`

- **item(`CodewalkItem`)**:`CodewalkStep.items` 陣列的元素,統一容器類型,承載 tip / pitfall / todo / reference / snippet 五種說明元件。以 `kind` 欄位區分 discriminated union,陣列順序即畫面顯示順序(作者可自由交錯排列)。與既有 `terms?: CodewalkTerm[]`(可收合術語卡)是分開的獨立欄位,不混用。
  - **tip**:補充最佳實踐或延伸閱讀,語氣正向、不影響理解主線。`{ kind: 'tip'; text: string }`
  - **pitfall**:「容易誤解成 X,其實是 Y」的警示。結構化雙欄位(非單一 text):`{ kind: 'pitfall'; misconception: string; reality: string }`。視覺語言與系統層級的 refDrift/stepJump 警告(`codewalk-warning`)刻意區隔,避免讀者誤認成系統錯誤。
  - **todo**:標出「這段行為未來可能會變」的提醒。`{ kind: 'todo'; text: string }`
  - **reference**:外部連結(官方文件/RFC/issue)。`{ kind: 'reference'; label: string; url: string }`,`url` 需通過 http/https 合法格式驗證。
  - **snippet**:額外引用另一段相關程式碼(如「呼叫端在這裡」)。`{ kind: 'snippet'; label: string; file: string; startLine: number; endLine: number }`。面板上預設展開預覽實際程式碼內容(Shiki 高亮,配色跟隨讀者當前的 VS Code 主題,無法解析時降級為內建的 dark-plus/light-plus,依編輯器深/淺色選用);點擊會重用既有 jumpToLocation 機制跳轉編輯器,不記錄「正在查看 snippet」的額外狀態。
  - **diff**:呈現既有檔案內一段程式碼「改了什麼」的說明元件(前後差異對照),用於區塊性改動——整檔新增或整檔刪除不適用,應改用 `snippet`(整檔新增)或文字說明(整檔刪除)。`{ kind: 'diff'; label: string; file: string; startLine: number; endLine: number; diffText: string }`。`diffText` 只存 diff 的 hunk 本體(不含 `diff --git`/`---`/`+++`/`@@ @@` 等檔頭行),逐行依開頭字元(`+`/`-`/空白)判斷新增/刪除/context,驗證階段要求至少一行加減行(否則不算 diff,退化情境應改用 `snippet`)。`startLine`/`endLine` 一律代表**新版(現在檔案)**的行號範圍,供點擊跳轉使用,與舊版行號無關;純刪除 hunk 時兩者相同,指向刪除位置在新版檔案中的插入點。渲染時依每行開頭字元疊加紅/綠背景色,並重用 Shiki 對去除開頭字元後的內容做語法高亮(配色來源與 snippet 相同,跟隨編輯器主題)。點擊行為與 `snippet` 完全相同,跳轉編輯器、不額外記錄狀態。

## 失準偵測(stale-step-detection)

- **漂移(drift)**:`ref`(產出當下釘住的 commit)與目前 workspace 的 HEAD **不一致**的整份訊號——只比對 commit,不看實際程式碼內容有沒有變。無錨導讀唯一的過期訊號,顯示為整份「行號可能漂移」警告。
- **錨(anchor)**:`CodewalkStep` 與 `kind: 'snippet'` 的可選欄位 `anchor?: string`,存該 `file`:`startLine`-`endLine` 範圍在導讀產出當下的程式碼**逐字原文**。`kind: 'diff'` 不使用 `anchor`——它已有 `diffText` 作為原文快照。
- **失準(stale)**:**單一 step 或 snippet 層級**的內容判定,獨立於漂移之外——即使 HEAD 與 `ref` 相同,理論上也可能因工作區未提交的改動而失準;反之 HEAD 與 `ref` 不同,但該 step 引用的程式碼恰好沒被動到,則不算失準。判定依序:目標檔案不存在 → 失準;現行內容與 `anchor` 逐字相同 → 相符;否則在整份檔案內搜尋 `anchor`,找到恰好一處 → 位移,找不到或找到多處 → 失準。**漂移的導讀不一定有失準的 step**,兩者是不同粒度的獨立訊號。
- **位移跟隨**:`anchor` 在檔案內找到唯一匹配、但位置與 `.codewalk.json` 記錄的行號不同時,系統自動改用新行號預覽與跳轉。**刻意不稱「校正」**——校正暗示系統在猜測或修補,而位移跟隨只在內容**逐字相同**時生效,對讀者沒有任何可能出錯的推測成分,因此也不對讀者顯示任何「已調整」的提示。
- **`regenerateHint`**:`CodewalkFile` 的頂層可選欄位,由產生器自述「如何重新產生這份導讀」的指令文字。播放器只負責顯示與提供「複製」動作,**不解讀、不執行**——維持播放器與產生器分離的紀律(見 `openspec/decisions.md`「播放器與產生器分離」)。

## 作答紀錄(attempt record)

- **定位**:讀者某份導讀**最後一次**完成 quiz 的快照,含作答時間、答對題數、總題數、是否通過門檻。**不屬於 `.codewalk.json` 格式**——不寫入導讀檔案本身,存於 VS Code 的 workspace 狀態(`workspaceState`),經 `WalkFileSummary.lastAttempt`(`shared/protocol.ts`)送到 webview 顯示。統一用詞為「作答紀錄」,不用「成績」「進度」等說法。
- **身分**:以導讀檔案的 workspace 相對路徑 + `ref` 為索引;`ref` 不符(導讀已重新產生)時視同沒有紀錄,不顯示過期分數。
- **只留最後一次**:再次作答會覆蓋舊紀錄,不保留歷史、不記最佳成績。
- **不阻擋任何流程**:有紀錄的導讀仍可正常重新走讀、重新作答;紀錄留存失敗也不中斷讀者剛完成的作答流程。

## Markdown 渲染(markdown-rendering)

- **敘述欄位**:泛指 `.codewalk.json` 裡會被播放器依 markdown 子集解析、而非顯示原始標記字元的字串欄位——分成兩類,分類依渲染位置而非欄位語意:
  - **長文欄位**:`narration`、`terms[].explanation`、`tip`/`todo` 的 `text`、`pitfall` 的 `misconception`/`reality`、`optionExplanations`。支援完整六種語法:行內程式碼、粗體、連結、無序清單(含巢狀)、有序清單、二級小標(僅 `##`)
  - **短欄位**:`CodewalkFile.title`、`CodewalkStep.title`、`CodewalkTerm.term`、`CodewalkQuizQuestion.question`/`options`、`items[].label`。只支援行內三種(程式碼/粗體/連結)——清單與小標在按鈕、`<summary>` 這類元件裡本來就會破壞版面,原樣顯示為純文字
  - 完整語法清單與各欄位分類定義住 `shared/schema.ts` 的 JSDoc(單點,不在此重複維護)
- **降級為純文字(graceful degradation)**:認不得或不合法的語法(表格、圖片、引用區塊、程式碼區塊、`#`/`###` 以下標題、原始 HTML、格式錯誤的標記),一律原樣顯示為純文字——不中止導讀載入、不影響同一欄位其餘內容或同一份導讀其他部分的呈現。統一規則,不是逐語法各自處理的特例。內嵌連結網址非 http/https 時走同一條路徑(原樣顯示、不可點擊)。
- **連結不可點擊的另一種情況**:短欄位若顯示在另一個已有點擊行為的元素內(`item.label` 在按鈕內、`term.term` 在有點擊事件的 `<summary>` 內、quiz 作答畫面的選項在包著 radio 的 `<label>` 內),即使網址合法也不渲染成可點擊元素,同樣原樣顯示——避免巢狀互動元素(無效 HTML,且點擊語意會打架)。同一欄位在不同渲染位置可能分屬不同判定,規則綁的是渲染位置而非欄位本身。

## `CodewalkQuizQuestion.optionExplanations`

- **定位**:quiz 每題的選填欄位,`string[]`,索引與 `options` 一一對應,長度必須與 `options` 完全相同(驗證階段強制,長度不符會拒絕載入)。第 i 個字串說明第 i 個選項為什麼對或為什麼錯。
- **顯示時機**:讀者送出答案、進入 quiz 結果頁後,系統在該題的作答結果底下列出**所有**選項的文字與其解釋,並標示出正確選項與讀者實際選擇的選項——不論該題答對或答錯都會顯示,讓答對的讀者也能確認自己不是猜中的。
- **省略時**:結果頁維持既有行為(只顯示你的答案、答錯時額外顯示正確答案),不出現任何空白區塊。
- **與 `items` 的關係**:兩者是完全獨立的機制——`items` 是 step 內的說明元件,`optionExplanations` 是 quiz 選項的解釋,不互相影響。
