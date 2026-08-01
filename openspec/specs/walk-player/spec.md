# walk-player

## Purpose

側邊面板播放 `.codewalk/` 導讀 JSON 的核心互動能力——步驟導覽、檔案行號跳轉、可收合術語註解、互動 quiz、ref 漂移警告。讓讀者在 VS Code 內以可重複執行、可互動自測的方式理解陌生 codebase,取代只能啃 diff 或聽口頭講解的現況。

## Requirements

### Requirement: 載入導讀檔案
系統 SHALL 掃描目前開啟 workspace 的 `.codewalk/` 目錄,列出其中符合 schema 的 `*.codewalk.json` 導讀檔案,並讓讀者選擇一份載入到側邊面板播放。

#### Scenario: 正常載入導讀
- **GIVEN** workspace 的 `.codewalk/` 目錄下存在至少一份格式正確的 `*.codewalk.json`
- **WHEN** 讀者開啟 CodeWalk 側邊面板並選擇該檔案
- **THEN** 系統顯示該導讀的第一個 step

#### Scenario: 目錄不存在或無可用檔案
- **GIVEN** workspace 沒有 `.codewalk/` 目錄,或目錄內沒有任何 `*.codewalk.json`
- **WHEN** 讀者開啟 CodeWalk 側邊面板
- **THEN** 系統顯示「找不到導讀檔案」的提示,不拋出未處理例外

#### Scenario: 檔案格式不符 schema
- **GIVEN** 選定的 `.codewalk.json` 內容不符合 `shared/schema.ts` 定義的格式
- **WHEN** 系統嘗試載入該檔案
- **THEN** 系統顯示格式錯誤訊息並中止載入,不使 extension 崩潰

### Requirement: 步驟導覽
讀者 SHALL 能以上一步/下一步方式逐步瀏覽 walk 的 steps,並透過快捷鍵操作,不需要滑鼠介入。

#### Scenario: 以快捷鍵前進到下一步
- **GIVEN** 讀者正在瀏覽某個 walk 的第 N 步(N 小於總步數)
- **WHEN** 讀者按下「下一步」快捷鍵
- **THEN** 系統顯示第 N+1 步,並依該步驟定位對應程式碼位置

#### Scenario: 以快捷鍵回到上一步
- **GIVEN** 讀者正在瀏覽某個 walk 的第 N 步(N 大於 1)
- **WHEN** 讀者按下「上一步」快捷鍵
- **THEN** 系統顯示第 N-1 步

#### Scenario: 已在最後一步時嘗試前進
- **GIVEN** 讀者正在瀏覽 walk 的最後一步
- **WHEN** 讀者按下「下一步」快捷鍵
- **THEN** 系統維持在最後一步,不報錯,並提示已達結尾(可進入 quiz)

### Requirement: 檔案行號跳轉
每個 step 對應程式碼位置(`startLine`、`endLine`)時,系統 SHALL 自動開啟對應檔案並跳轉、高亮該範圍。

#### Scenario: 正常跳轉並高亮
- **GIVEN** 目前 step 指定的目標檔案存在於 workspace
- **WHEN** 讀者切換到該 step
- **THEN** 系統在編輯器開啟該檔案,捲動到 `startLine`,並高亮 `startLine` 到 `endLine` 範圍

#### Scenario: 目標檔案不存在
- **GIVEN** 目前 step 指定的目標檔案已被刪除或路徑錯誤
- **WHEN** 讀者切換到該 step
- **THEN** 系統顯示「找不到檔案」提示,不中斷整個導覽流程,讀者仍可繼續下一步

### Requirement: 可收合術語註解
系統 SHALL 讓讀者展開或收合 step 內嵌的術語解釋,預設為收合狀態,不佔用主要閱讀空間。

#### Scenario: 展開術語註解
- **GIVEN** 目前 step 帶有術語註解,且處於收合狀態
- **WHEN** 讀者點擊該術語
- **THEN** 系統展開顯示該術語的解釋內容

#### Scenario: 收合已展開的術語註解
- **GIVEN** 某則術語註解目前處於展開狀態
- **WHEN** 讀者再次點擊該術語
- **THEN** 系統收合該解釋內容

### Requirement: Quiz 自測與回饋
Walk 結束時,系統 SHALL 提供 `.codewalk.json` 定義的選擇題 quiz(至少 1 題);作答完畢後系統 SHALL 顯示答對題數,當答對題數低於過關門檻時 SHALL 顯示建議提示(重走本 walk 或選擇更詳細版本)。過關門檻由 `.codewalk.json` 的 `passThreshold` 欄位指定;省略時系統 SHALL 使用預設門檻(題數的簡單多數,即 `ceil(題數 / 2)`)。

#### Scenario: 使用預設門檻通過自測
- **GIVEN** 讀者已完成 walk 所有 steps 並進入 quiz,該導讀共 5 題且未指定 `passThreshold`
- **WHEN** 讀者作答完畢且答對題數 ≥ 3(預設門檻)
- **THEN** 系統顯示分數,不顯示重走建議

#### Scenario: 使用預設門檻未通過自測
- **GIVEN** 讀者已完成 walk 所有 steps 並進入 quiz,該導讀共 5 題且未指定 `passThreshold`
- **WHEN** 讀者作答完畢且答對題數 < 3(預設門檻)
- **THEN** 系統顯示分數,並顯示「建議重走或選更詳細版本」提示

#### Scenario: 使用自訂門檻
- **GIVEN** 導讀的 `.codewalk.json` 指定 `passThreshold` 為某個小於等於題數的整數
- **WHEN** 讀者作答完畢
- **THEN** 系統以該自訂門檻(而非預設的簡單多數)判斷是否顯示重走建議

#### Scenario: 離開 quiz 結果頁
- **GIVEN** 讀者已在 quiz 結果頁(不論通過與否)
- **WHEN** 讀者選擇「重新挑戰 Quiz」「重新走一次導讀」或「回到導讀列表」
- **THEN** 系統分別回到全新作答的 quiz、walk 第一步、或導讀選擇畫面,不會停留在無法互動的結果頁

#### Scenario: 作答中途取消 quiz
- **GIVEN** 讀者已進入 quiz 但尚未送出答案
- **WHEN** 讀者選擇「取消,回到最後一步」
- **THEN** 系統回到 walk 的最後一步,不記錄任何作答結果,讀者不會被迫完成 quiz 才能離開

### Requirement: Quiz 選項解釋
`.codewalk.json` 的每一題 quiz SHALL 可選擇性提供 `optionExplanations`(字串陣列,索引對齊 `options`),說明每個選項為什麼對或為什麼錯。當某題提供該欄位時,系統 SHALL 在 quiz 結果頁該題的作答結果底下,列出**所有**選項的文字與其對應解釋,並明確標示哪一個是正確選項、哪一個是讀者實際選擇的選項。該區塊的視覺樣式 SHALL 與系統層級警告(ref 漂移、檔案跳轉錯誤)區隔,不使讀者誤認為系統錯誤。

#### Scenario: 顯示所有選項的解釋
- **GIVEN** 某題 quiz 提供了 `optionExplanations`,且讀者已送出答案進入結果頁
- **WHEN** 讀者檢視該題的作答結果
- **THEN** 系統列出該題每一個選項的文字與對應解釋,不只顯示讀者選擇的那一個

#### Scenario: 標示正確選項與讀者的選擇
- **GIVEN** 某題 quiz 提供了 `optionExplanations`,讀者選擇了錯誤選項
- **WHEN** 讀者檢視該題的解釋清單
- **THEN** 系統在清單中同時標示出正確選項與讀者實際選擇的選項,兩者可分辨

#### Scenario: 答對的題目同樣顯示解釋
- **GIVEN** 某題 quiz 提供了 `optionExplanations`,讀者答對該題
- **WHEN** 讀者檢視該題的作答結果
- **THEN** 系統仍列出所有選項的解釋,讓答對的讀者也能從其他選項的錯誤理由排除潛在誤解

#### Scenario: 未提供解釋的題目
- **GIVEN** 某題 quiz 未定義 `optionExplanations` 欄位
- **WHEN** 讀者檢視該題的作答結果
- **THEN** 系統不顯示任何解釋區塊或佔位文字,該題結果的呈現與新增此欄位之前完全相同

#### Scenario: 同一份導讀混合有無解釋的題目
- **GIVEN** 一份導讀中部分題目提供 `optionExplanations`、部分題目未提供
- **WHEN** 讀者送出答案進入結果頁
- **THEN** 系統只為有提供的題目顯示解釋區塊,其餘題目維持原有呈現,不影響分數與過關判斷

### Requirement: Quiz 選項解釋的格式驗證
系統 SHALL 在載入 `.codewalk.json` 時驗證 `optionExplanations`:該欄位存在時必須是字串陣列、每個元素為非空字串、且長度與同一題的 `options` 完全相同。任一條件不符時系統 SHALL 顯示格式錯誤訊息並中止載入,不使 extension 崩潰。

#### Scenario: 解釋數量與選項數量不符
- **GIVEN** 某題 quiz 有 4 個 `options`,但 `optionExplanations` 只有 3 個元素
- **WHEN** 系統嘗試載入該檔案
- **THEN** 系統顯示指出該題與長度不符的格式錯誤訊息並中止載入,不以位移後的順序顯示解釋

#### Scenario: 解釋內容為空字串或非字串
- **GIVEN** 某題 quiz 的 `optionExplanations` 含有空字串、只有空白的字串,或非字串的元素
- **WHEN** 系統嘗試載入該檔案
- **THEN** 系統顯示格式錯誤訊息並中止載入

#### Scenario: 省略欄位仍為合法格式
- **GIVEN** 一份 `.codewalk.json` 的所有 quiz 題目都沒有 `optionExplanations` 欄位
- **WHEN** 系統載入該檔案
- **THEN** 系統正常載入並播放,不產生任何格式錯誤

### Requirement: ref 漂移偵測
系統 SHALL 比對 `.codewalk.json` 的 `ref`(產出當下釘住的 commit)與目前 workspace 的 HEAD,兩者不一致時顯示警告。

#### Scenario: HEAD 與 ref 相符
- **GIVEN** 目前 workspace 的 HEAD commit 等於導讀檔案的 `ref`
- **WHEN** 讀者載入該導讀
- **THEN** 系統不顯示漂移警告

#### Scenario: HEAD 與 ref 不符
- **GIVEN** 目前 workspace 的 HEAD commit 不等於導讀檔案的 `ref`
- **WHEN** 讀者載入該導讀
- **THEN** 系統在面板顯示「行號可能漂移」警告,但仍允許讀者繼續瀏覽

### Requirement: 視覺跟隨編輯器主題
webview SHALL 讀取 VS Code 目前主題的 CSS 變數渲染介面,不使用自帶的固定配色。

#### Scenario: 隨主題切換更新樣式
- **GIVEN** CodeWalk 面板已開啟並顯示中
- **WHEN** 讀者在 VS Code 切換淺色/深色主題
- **THEN** 面板樣式(背景、文字、強調色)隨之更新,不需重新載入面板

### Requirement: 步驟內顯示提示、陷阱警告與待辦標記
系統 SHALL 讓每個 step 的 `items` 陣列中,`kind` 為 `tip`、`pitfall`、`todo` 的項目以對應視覺樣式顯示——`tip` 為正向語氣提示、`todo` 為待確認標記、`pitfall` 顯示「容易誤解成 X,其實是 Y」兩段式內容(`misconception`/`reality`)。`pitfall` 的視覺樣式 SHALL 與系統層級的 ref 漂移/檔案跳轉錯誤警告明確區隔,避免讀者將內容提醒誤認為系統錯誤。

#### Scenario: 顯示 tip
- **GIVEN** 目前 step 的 `items` 含一個 `kind: 'tip'` 項目
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統以正向語氣樣式顯示該提示文字

#### Scenario: 顯示 todo
- **GIVEN** 目前 step 的 `items` 含一個 `kind: 'todo'` 項目
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統以待確認標記樣式顯示該文字

#### Scenario: 顯示 pitfall
- **GIVEN** 目前 step 的 `items` 含一個 `kind: 'pitfall'` 項目,包含 `misconception` 與 `reality` 兩段內容
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統同時顯示 `misconception` 與 `reality` 兩段內容,且視覺樣式與系統層級警告(ref 漂移、檔案跳轉錯誤)不同

#### Scenario: step 沒有任何 items
- **GIVEN** 目前 step 未定義 `items` 欄位,或 `items` 為空陣列
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統不顯示任何說明元件區塊,不影響 narration 與既有內容的顯示

### Requirement: 外部連結參考
系統 SHALL 讓每個 step 的 `items` 陣列中,`kind` 為 `reference` 的項目顯示為可點擊連結(`label` 為顯示文字);讀者點擊後,系統 SHALL 以作業系統預設瀏覽器開啟該連結,不在 CodeWalk 面板內導航離開。

#### Scenario: 點擊 reference 開啟外部瀏覽器
- **GIVEN** 目前 step 的 `items` 含一個 `kind: 'reference'` 項目,`url` 為合法的 http/https 網址
- **WHEN** 讀者點擊該連結
- **THEN** 系統以外部瀏覽器開啟該網址,CodeWalk 面板本身不離開目前 step

#### Scenario: reference.url 格式不合法
- **GIVEN** 選定的 `.codewalk.json` 內某個 `kind: 'reference'` 項目的 `url` 不是合法的 http/https 網址
- **WHEN** 系統嘗試載入該檔案
- **THEN** 系統顯示格式錯誤訊息並中止載入,不使 extension 崩潰

### Requirement: 程式碼片段引用
系統 SHALL 讓每個 step 的 `items` 陣列中,`kind` 為 `snippet` 的項目在面板上預設展開、預覽該項目 `file`:`startLine`-`endLine` 範圍的實際程式碼內容(依語言做語法高亮);讀者點擊該項目後,系統 SHALL 開啟對應檔案並跳轉、高亮該範圍,行為與既有的檔案行號跳轉一致。

#### Scenario: 顯示 snippet 預覽
- **GIVEN** 目前 step 的 `items` 含一個 `kind: 'snippet'` 項目,其 `file` 存在於 workspace
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統顯示該項目 `label`,並預覽 `file` 內 `startLine` 到 `endLine` 範圍的程式碼內容

#### Scenario: 點擊 snippet 跳轉編輯器
- **GIVEN** 目前 step 顯示一個 `kind: 'snippet'` 項目的預覽
- **WHEN** 讀者點擊該項目
- **THEN** 系統在編輯器開啟該項目指定的檔案,捲動到 `startLine`,並高亮 `startLine` 到 `endLine` 範圍

#### Scenario: 切換 step 後跳轉位置回到主 step
- **GIVEN** 讀者剛點擊某 snippet 使編輯器跳轉到該 snippet 的位置
- **WHEN** 讀者按下「上一步」或「下一步」切換到另一個 step
- **THEN** 系統將編輯器跳轉到新 step 主要的 `file`:`startLine`-`endLine` 位置,不停留在先前 snippet 的位置

#### Scenario: snippet 引用的檔案不存在
- **GIVEN** 目前 step 的某個 `kind: 'snippet'` 項目指定的 `file` 已被刪除或路徑錯誤
- **WHEN** 讀者瀏覽該 step,或點擊該 snippet 項目
- **THEN** 系統顯示「找不到檔案」提示,不中斷整個導覽流程,讀者仍可繼續下一步

### Requirement: 改動片段呈現
系統 SHALL 讓每個 step 的 `items` 陣列中,`kind` 為 `diff` 的項目顯示其 `label`、`file`:`startLine`-`endLine`,並將 `diffText` 逐行依開頭字元(`+` 為新增、`-` 為刪除、其餘為 context)以對應背景色與 `+`/`-` 標記字元顯示,每行同時顯示舊版(依 `oldStartLine` 起算)與新版(依 `startLine` 起算)行號——新增行不顯示舊版行號、刪除行不顯示新版行號;內容依 `file` 的語言做語法高亮。讀者點擊該項目後,系統 SHALL 開啟對應檔案並跳轉、高亮 `startLine` 到 `endLine` 範圍,行為與既有的檔案行號跳轉一致。

#### Scenario: 顯示 diff 加減行與語法高亮
- **GIVEN** 目前 step 的 `items` 含一個 `kind: 'diff'` 項目,`diffText` 含新增、刪除、context 三種行
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統顯示該項目 `label`,並依每行開頭字元以不同背景色與 `+`/`-` 標記字元呈現新增、刪除、context 行,行內容依 `file` 的語言顯示語法高亮

#### Scenario: 顯示雙欄行號
- **GIVEN** 目前 step 的 `items` 含一個 `kind: 'diff'` 項目,`oldStartLine` 為 10、`startLine` 為 12,`diffText` 依序為一行 context、一行刪除、一行新增
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統為 context 行同時顯示舊版與新版行號、為刪除行只顯示舊版行號(新版行號留空)、為新增行只顯示新版行號(舊版行號留空),且行號依序遞增

#### Scenario: 點擊 diff 跳轉編輯器
- **GIVEN** 目前 step 顯示一個 `kind: 'diff'` 項目
- **WHEN** 讀者點擊該項目
- **THEN** 系統在編輯器開啟該項目指定的 `file`,捲動到 `startLine`,並高亮 `startLine` 到 `endLine` 範圍

#### Scenario: 純刪除 hunk 的跳轉位置
- **GIVEN** 目前 step 的 `kind: 'diff'` 項目,其 `diffText` 只包含刪除行(沒有新增行),`startLine` 與 `endLine` 相同
- **WHEN** 讀者點擊該項目
- **THEN** 系統跳轉到該行,呈現刪除發生處在新版檔案中的位置

#### Scenario: diff 引用的檔案不存在
- **GIVEN** 目前 step 的某個 `kind: 'diff'` 項目指定的 `file` 已被刪除或路徑錯誤
- **WHEN** 讀者點擊該 diff 項目
- **THEN** 系統顯示「找不到檔案」提示,不中斷整個導覽流程,讀者仍可繼續下一步;該 diff 項目本身的加減行內容(來自 `diffText`)不受影響,仍正常顯示

### Requirement: 改動片段格式驗證
系統 SHALL 在載入 `.codewalk.json` 時驗證 `kind` 為 `diff` 的項目:`diffText` 必須是非空字串,且至少包含一行以 `+` 或 `-` 開頭的內容;`oldStartLine` 必須是正整數。不符合時系統 SHALL 顯示格式錯誤訊息並中止載入,不使 extension 崩潰。

#### Scenario: oldStartLine 缺漏或不是正整數
- **GIVEN** 某個 `kind: 'diff'` 項目缺少 `oldStartLine` 欄位,或該欄位不是正整數
- **WHEN** 系統嘗試載入該檔案
- **THEN** 系統顯示格式錯誤訊息並中止載入

#### Scenario: diffText 沒有任何加減行
- **GIVEN** 某個 `kind: 'diff'` 項目的 `diffText` 全部都是 context 行(沒有任何一行以 `+` 或 `-` 開頭)
- **WHEN** 系統嘗試載入該檔案
- **THEN** 系統顯示指出該項目至少需要一行新增或刪除的格式錯誤訊息並中止載入

#### Scenario: diffText 含至少一行加減行時正常載入
- **GIVEN** 某個 `kind: 'diff'` 項目的 `diffText` 至少含一行以 `+` 或 `-` 開頭的內容
- **WHEN** 系統嘗試載入該檔案
- **THEN** 系統正常載入並播放,不產生格式錯誤

### Requirement: 說明元件依序交錯顯示
系統 SHALL 依 `items` 陣列的原始順序顯示 tip、pitfall、todo、reference、snippet、diff 六種項目,不強制固定分組或重新排序,讓撰寫者能自由交錯安排這些項目與主敘述的呈現順序。

#### Scenario: 混合排列多種 kind
- **GIVEN** 目前 step 的 `items` 依序為 `[tip, snippet, reference, pitfall]`
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統依相同順序由上而下顯示這四個項目

#### Scenario: 混合排列包含 diff 的多種 kind
- **GIVEN** 目前 step 的 `items` 依序為 `[tip, diff, todo]`
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統依相同順序由上而下顯示這三個項目
