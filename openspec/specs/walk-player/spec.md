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
每個 step 對應程式碼位置(`startLine`、`endLine`)時,系統 SHALL 自動開啟對應檔案並跳轉、高亮該範圍。當該 step 經錨驗證判定為位移時,系統 SHALL 改以驗證後的新行號範圍跳轉並高亮;判定為失準時,系統 SHALL 開啟對應檔案但 SHALL NOT 選取或捲動到任何特定行,亦 SHALL NOT 使用 `.codewalk.json` 記錄的原行號。

#### Scenario: 正常跳轉並高亮
- **GIVEN** 目前 step 指定的目標檔案存在於 workspace
- **WHEN** 讀者切換到該 step
- **THEN** 系統在編輯器開啟該檔案,捲動到 `startLine`,並高亮 `startLine` 到 `endLine` 範圍

#### Scenario: 目標檔案不存在
- **GIVEN** 目前 step 指定的目標檔案已被刪除或路徑錯誤
- **WHEN** 讀者切換到該 step
- **THEN** 系統顯示「找不到檔案」提示,不中斷整個導覽流程,讀者仍可繼續下一步

#### Scenario: 位移的 step 以新行號跳轉
- **GIVEN** 目前 step 經錨驗證判定為位移,新位置與 `.codewalk.json` 記錄的行號不同
- **WHEN** 讀者切換到該 step
- **THEN** 系統在編輯器開啟該檔案,捲動並高亮**新位置**的範圍

#### Scenario: 失準的 step 不落在錯誤位置
- **GIVEN** 目前 step 經錨驗證判定為失準,但其檔案仍存在於 workspace
- **WHEN** 讀者切換到該 step
- **THEN** 系統在編輯器開啟該檔案,不選取任何行、不捲動到原 `startLine`,讀者仍可繼續下一步

### Requirement: 回到本步專案位置
走讀畫面 SHALL 提供明確的操作,讓讀者把編輯器帶回目前 step 對應的程式碼位置。此操作 SHALL 與切換 step 時的自動跳轉走相同規則——位移的 step 跳到驗證後的新行號、失準的 step 只開啟檔案而不選取任何行。此操作 SHALL 同時可透過鍵盤觸發,不強迫讀者把手移到滑鼠。當目前 step 沒有對應的程式碼位置時,系統 SHALL NOT 顯示此操作。

#### Scenario: 把編輯器帶回目前步驟

- **GIVEN** 讀者停在某份導讀的第 12 步,但編輯器目前開著不相干的檔案
- **WHEN** 讀者觸發「回到本步專案位置」
- **THEN** 系統在編輯器開啟第 12 步對應的檔案,捲動並高亮其行號範圍

#### Scenario: 位移的步驟跳到新行號

- **GIVEN** 目前 step 經錨驗證判定為位移,新位置與 `.codewalk.json` 記錄的行號不同
- **WHEN** 讀者觸發「回到本步專案位置」
- **THEN** 系統開啟該檔案,捲動並高亮**新位置**的範圍

#### Scenario: 失準的步驟不落在錯誤位置

- **GIVEN** 目前 step 經錨驗證判定為失準,但其檔案仍存在於 workspace
- **WHEN** 讀者觸發「回到本步專案位置」
- **THEN** 系統開啟該檔案,不選取任何行、不捲動到原 `startLine`

#### Scenario: 目標檔案不存在

- **GIVEN** 目前 step 指定的目標檔案已被刪除或路徑錯誤
- **WHEN** 讀者觸發「回到本步專案位置」
- **THEN** 系統顯示「找不到檔案」提示,不中斷閱讀流程,讀者仍可繼續下一步

#### Scenario: 以鍵盤觸發

- **GIVEN** 讀者停在某份導讀的走讀畫面,焦點在導讀面板上
- **WHEN** 讀者按下對應的快捷鍵
- **THEN** 系統的行為與觸發畫面上的操作完全相同

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
系統 SHALL 比對 `.codewalk.json` 的 `ref`(產出當下釘住的 commit)與目前 workspace 的 HEAD,兩者不一致時顯示警告。當該導讀含有任何具備有效 `anchor` 的 step 或 snippet 時,系統 SHALL 改以逐步的失準狀態呈現過期訊號,SHALL NOT 額外顯示整份的「行號可能漂移」警告——逐步狀態的判定與呈現見 `stale-step-detection` capability。整份警告 SHALL 僅在導讀完全不含有效 `anchor` 時作為唯一的過期訊號使用。無論以何種方式呈現,系統 SHALL 允許讀者繼續瀏覽整份導讀。

#### Scenario: HEAD 與 ref 相符
- **GIVEN** 目前 workspace 的 HEAD commit 等於導讀檔案的 `ref`
- **WHEN** 讀者載入該導讀
- **THEN** 系統不顯示漂移警告

#### Scenario: HEAD 與 ref 不符且導讀不含 anchor
- **GIVEN** 目前 workspace 的 HEAD commit 不等於導讀檔案的 `ref`,且該導讀的所有 step 與 snippet 皆未提供有效 `anchor`
- **WHEN** 讀者載入該導讀
- **THEN** 系統在面板顯示「行號可能漂移」警告,但仍允許讀者繼續瀏覽

#### Scenario: HEAD 與 ref 不符但導讀含 anchor
- **GIVEN** 目前 workspace 的 HEAD commit 不等於導讀檔案的 `ref`,且該導讀含有具備有效 `anchor` 的 step
- **WHEN** 讀者載入該導讀
- **THEN** 系統不顯示整份的「行號可能漂移」警告,改以逐步失準狀態呈現,並允許讀者繼續瀏覽

#### Scenario: HEAD 與 ref 不符但程式碼實際未變動
- **GIVEN** 目前 workspace 的 HEAD commit 不等於導讀檔案的 `ref`,但該導讀所有具備 `anchor` 的目標經驗證皆為相符
- **WHEN** 讀者載入該導讀
- **THEN** 系統不顯示任何過期警告或失準標記

### Requirement: 視覺跟隨編輯器主題

webview SHALL 讀取 VS Code 目前主題的 CSS 變數渲染介面,不使用自帶的固定配色。此規範同時適用於**程式碼片段內部的 token 配色**——snippet 與 diff 的程式碼上色 SHALL 依當前主題的定義呈現,不使用與編輯器無關的固定色票。程式碼配色的完整行為(降級、主題切換重繪、語言判定)見 `syntax-highlighting` capability。

#### Scenario: 隨主題切換更新樣式

- **GIVEN** CodeWalk 面板已開啟並顯示中
- **WHEN** 讀者在 VS Code 切換淺色/深色主題
- **THEN** 面板樣式(背景、文字、強調色)隨之更新,不需重新載入面板

#### Scenario: 程式碼配色一併跟隨主題

- **GIVEN** CodeWalk 面板已開啟並顯示一個含 snippet 或 diff 的 step
- **WHEN** 讀者在 VS Code 切換佈景主題
- **THEN** 除面板介面樣式外,程式碼片段內的 token 配色一併更新為新主題的配色,不需重新載入面板

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
系統 SHALL 讓每個 step 的 `items` 陣列中,`kind` 為 `snippet` 的項目在面板上預設展開、預覽該項目 `file`:`startLine`-`endLine` 範圍的實際程式碼內容(依語言做語法高亮);讀者點擊該項目後,系統 SHALL 開啟對應檔案並跳轉、高亮該範圍,行為與既有的檔案行號跳轉一致。當該項目經錨驗證判定為位移時,預覽內容、顯示的行號與點擊跳轉 SHALL 一律採用驗證後的新行號範圍;判定為失準時,系統 SHALL 改為顯示該項目 `anchor` 的內容並標示為產出當時的版本,SHALL NOT 預覽現行檔案在該行號範圍的內容。

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

#### Scenario: 位移的 snippet 以新行號預覽
- **GIVEN** 目前 step 的某個 `kind: 'snippet'` 項目經錨驗證判定為位移
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統預覽新位置的程式碼內容,顯示的行號為新位置的行號

#### Scenario: 失準的 snippet 顯示產出當時的內容
- **GIVEN** 目前 step 的某個 `kind: 'snippet'` 項目經錨驗證判定為失準,其 `file` 仍存在
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統顯示該項目 `anchor` 的內容並標示為產出當時的版本,不顯示現行檔案在該行號範圍的內容

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

### Requirement: Quiz 作答紀錄的留存
讀者送出 quiz 後,系統 SHALL 為該份導讀留存最後一次的作答紀錄,內容包含作答時間、答對題數、總題數與是否通過門檻。同一份導讀 SHALL 只保留最後一次紀錄——再次作答時新紀錄 SHALL 覆蓋舊紀錄,系統 SHALL NOT 保留作答歷史。紀錄 SHALL 與導讀的 `ref` 一併留存,且 SHALL NOT 寫入 `.codewalk.json` 檔案本身。作答紀錄 SHALL NOT 影響任何既有流程:有紀錄的導讀仍可重新走讀、重新作答,入口與操作方式完全不變。

選擇導讀 SHALL 一律從第一個 step 開始播放。導讀列表上的接續入口是**另一個獨立的入口**,兩者並存:讀者選擇導讀本身時從頭開始,只有明確觸發接續入口時才停在留存的步驟。

#### Scenario: 送出 quiz 後留存紀錄
- **GIVEN** 讀者已完成某份導讀的所有 steps 並進入 quiz
- **WHEN** 讀者作答完畢並送出
- **THEN** 系統留存該份導讀的作答紀錄,包含當下時間、答對題數、總題數與是否通過門檻

#### Scenario: 再次作答覆蓋舊紀錄
- **GIVEN** 某份導讀已有一筆作答紀錄(例如 2/5、未通過)
- **WHEN** 讀者重新作答該導讀的 quiz 並送出(例如答對 4 題)
- **THEN** 系統以新結果取代舊紀錄,該導讀僅存在一筆紀錄(4/5、通過),舊的 2/5 不再存在於任何位置

#### Scenario: 有紀錄不阻擋重新走讀或重新作答
- **GIVEN** 某份導讀已有一筆作答紀錄
- **WHEN** 讀者選擇該導讀
- **THEN** 系統照常從第一個 step 開始播放,走到結尾仍可進入 quiz 作答,不出現任何確認、警告或阻擋

#### Scenario: 有留存進度時選擇導讀仍從頭開始
- **GIVEN** 某份導讀留有第 12 步的進度,列表上同時顯示接續入口
- **WHEN** 讀者選擇該導讀本身(而非觸發接續入口)
- **THEN** 系統從第一個 step 開始播放,不跳到第 12 步、不出現任何確認或詢問

#### Scenario: 作答中途取消不留下紀錄
- **GIVEN** 讀者已進入某份導讀的 quiz 但尚未送出答案,且該導讀原本沒有作答紀錄
- **WHEN** 讀者選擇「取消,回到最後一步」
- **THEN** 系統不為該導讀建立任何作答紀錄

#### Scenario: 紀錄留存失敗不中斷讀者流程
- **GIVEN** 讀者送出 quiz,但系統留存紀錄的動作失敗
- **WHEN** 系統處理該次送出
- **THEN** 系統照常顯示 quiz 結果頁與分數,不顯示錯誤訊息、不中斷讀者流程

### Requirement: 導讀列表顯示作答紀錄
導讀選擇畫面 SHALL 在每份導讀的項目上顯示該導讀的最後一次作答紀錄,內容包含是否通過的圖示、答對題數與總題數、以及作答時間。當某份導讀沒有作答紀錄時,系統 SHALL NOT 顯示任何紀錄相關內容,亦 SHALL NOT 保留空白版位。當留存紀錄的 `ref` 與該導讀檔案目前的 `ref` 不相符時,系統 SHALL 視同沒有紀錄而不顯示——避免對已重新產生、題目可能已更換的導讀顯示過期分數。

#### Scenario: 顯示已通過的作答紀錄
- **GIVEN** 某份導讀有一筆通過門檻的作答紀錄(5 題中答對 4 題)
- **WHEN** 讀者開啟導讀選擇畫面
- **THEN** 系統在該導讀項目上顯示通過圖示、`4/5` 與作答時間

#### Scenario: 顯示未通過的作答紀錄
- **GIVEN** 某份導讀有一筆未通過門檻的作答紀錄(5 題中答對 2 題)
- **WHEN** 讀者開啟導讀選擇畫面
- **THEN** 系統在該導讀項目上顯示未通過圖示、`2/5` 與作答時間

#### Scenario: 沒有作答紀錄的導讀
- **GIVEN** 某份導讀從未被作答過
- **WHEN** 讀者開啟導讀選擇畫面
- **THEN** 該導讀項目只顯示標題,不顯示分數、時間或任何佔位文字,版面不因此保留空白列

#### Scenario: 導讀重新產生後舊紀錄失效
- **GIVEN** 某份導讀有一筆作答紀錄,之後該導讀檔案被重新產生,`ref` 已與紀錄中留存的 `ref` 不同
- **WHEN** 讀者開啟導讀選擇畫面
- **THEN** 系統不顯示該筆舊紀錄,該導讀項目呈現與從未作答過相同的外觀

#### Scenario: 作答完回到列表即時反映
- **GIVEN** 讀者剛送出某份導讀的 quiz 並停留在結果頁
- **WHEN** 讀者選擇「回到導讀列表」
- **THEN** 列表上該導讀項目立即顯示這次的作答紀錄,不需要重開面板或重新載入

### Requirement: 作答時間的相對顯示
作答紀錄的時間 SHALL 以相對於目前時間的方式呈現,並依距今長短採用不同精度:未滿 1 分鐘顯示「剛剛」、未滿 1 小時顯示「N 分鐘前」、未滿 24 小時顯示「N 小時前」、日曆日相差 1 天顯示「昨天」、日曆日相差 2 至 30 天顯示「N 天前」、日曆日相差超過 30 天顯示 `YYYY-MM-DD` 絕對日期。天數級距 SHALL 以日曆日相差計算,而非以 24 小時的倍數計算。讀者將游標停留在時間上時,系統 SHALL 顯示完整的絕對日期與時間。

#### Scenario: 剛送出的紀錄
- **GIVEN** 某筆作答紀錄的時間距今未滿 1 分鐘
- **WHEN** 系統呈現該筆紀錄的時間
- **THEN** 顯示「剛剛」

#### Scenario: 數小時前的紀錄
- **GIVEN** 某筆作答紀錄的時間距今 3 小時
- **WHEN** 系統呈現該筆紀錄的時間
- **THEN** 顯示「3 小時前」

#### Scenario: 跨日但未滿 24 小時的紀錄
- **GIVEN** 某筆作答紀錄的時間是昨天晚間,距今 9 小時
- **WHEN** 系統呈現該筆紀錄的時間
- **THEN** 顯示「9 小時前」(未滿 24 小時以小時級距優先,不顯示「昨天」)

#### Scenario: 前一個日曆日的紀錄
- **GIVEN** 某筆作答紀錄的時間距今超過 24 小時,且日曆日相差 1 天
- **WHEN** 系統呈現該筆紀錄的時間
- **THEN** 顯示「昨天」

#### Scenario: 數天前的紀錄
- **GIVEN** 某筆作答紀錄的日曆日相差 5 天
- **WHEN** 系統呈現該筆紀錄的時間
- **THEN** 顯示「5 天前」

#### Scenario: 超過一個月的紀錄
- **GIVEN** 某筆作答紀錄的日曆日相差 45 天
- **WHEN** 系統呈現該筆紀錄的時間
- **THEN** 顯示該筆紀錄的 `YYYY-MM-DD` 絕對日期,不顯示「45 天前」

#### Scenario: 查看完整時間
- **GIVEN** 導讀列表上顯示著某筆作答紀錄的相對時間
- **WHEN** 讀者將游標停留在該時間上
- **THEN** 系統顯示該筆紀錄的完整絕對日期與時間

### Requirement: 清除單筆作答紀錄
導讀列表上每一筆有作答紀錄的項目 SHALL 提供一個「更多動作」選單入口,選單內 SHALL 有「清除 Quiz 紀錄」一項,與「開啟這份導讀」的主要操作在視覺與觸發區域上明確區隔,避免讀者誤認為是刪除導讀檔案。清除 SHALL 採兩段式確認:選單內的清除項目第一次觸發時系統 SHALL 將其切換為視覺上可辨識的確認狀態,第二次觸發才 SHALL 真正清除紀錄並收合選單。確認狀態與選單開啟狀態 SHALL 在讀者按下 Esc、或點擊選單以外的任何位置時自動復原(收合選單、捨棄確認狀態,不清除紀錄),且同一時間 SHALL 至多一份導讀的選單處於開啟狀態——開啟另一份導讀的選單時,原本開啟的選單 SHALL 自動收合。選單入口與選單內的清除項目 SHALL 可由鍵盤聚焦與觸發。沒有作答紀錄的導讀項目 SHALL NOT 顯示「更多動作」選單入口。

#### Scenario: 兩段式清除紀錄
- **GIVEN** 導讀列表上某份導讀顯示著作答紀錄,讀者已開啟其「更多動作」選單
- **WHEN** 讀者觸發選單內的「清除 Quiz 紀錄」第一次,接著再觸發第二次
- **THEN** 第一次後該項目切換為確認狀態且紀錄仍在,第二次後系統清除該筆紀錄並收合選單,該導讀項目呈現與從未作答過相同的外觀

#### Scenario: 只觸發一次不會清除
- **GIVEN** 讀者已開啟某份導讀的「更多動作」選單
- **WHEN** 讀者只觸發「清除 Quiz 紀錄」一次
- **THEN** 紀錄仍完整保留,列表上該筆分數與時間不變,選單維持開啟並顯示確認狀態

#### Scenario: 以 Esc 收合選單並取消確認狀態
- **GIVEN** 讀者已開啟某份導讀的「更多動作」選單,且已觸發過一次清除(處於確認狀態)
- **WHEN** 讀者按下 Esc
- **THEN** 選單收合、確認狀態一併捨棄,紀錄未被清除

#### Scenario: 點擊選單以外的區域收合選單
- **GIVEN** 讀者已開啟某份導讀的「更多動作」選單
- **WHEN** 讀者點擊該選單以外的任何位置
- **THEN** 選單收合,任何確認狀態一併捨棄,紀錄未被清除

#### Scenario: 同時只有一份導讀的選單處於開啟狀態
- **GIVEN** 導讀列表上有兩份導讀各自顯示著作答紀錄,且第一份的「更多動作」選單已開啟
- **WHEN** 讀者開啟第二份的「更多動作」選單
- **THEN** 第一份的選單自動收合(連同其任何確認狀態),只有第二份的選單處於開啟狀態,兩筆紀錄都未被清除

#### Scenario: 以鍵盤清除紀錄
- **GIVEN** 導讀列表上某份導讀顯示著作答紀錄
- **WHEN** 讀者以鍵盤聚焦到該筆的「更多動作」選單入口、開啟選單,並對選單內的清除項目觸發兩次
- **THEN** 系統清除該筆紀錄,全程不需要使用滑鼠

#### Scenario: 清除後可重新作答
- **GIVEN** 某份導讀的作答紀錄已被清除
- **WHEN** 讀者重新走讀該導讀並完成 quiz
- **THEN** 系統為該導讀留存新的作答紀錄,列表上重新顯示

#### Scenario: 沒有紀錄時不顯示選單入口
- **GIVEN** 某份導讀從未被作答過,或其紀錄已被清除
- **WHEN** 讀者開啟導讀選擇畫面
- **THEN** 該導讀項目上不出現「更多動作」選單入口

### Requirement: 從走讀畫面返回導讀列表
讀者在走讀畫面(尚未進入或完成 quiz)時,SHALL 有明確的操作可以直接返回導讀選擇畫面,不需要先走到最後一步或完成 quiz。此操作 SHALL NOT 對目前導讀留下任何作答紀錄。

#### Scenario: 從走讀中途返回列表
- **GIVEN** 讀者正在瀏覽某份導讀的中間步驟(尚未到達最後一步)
- **WHEN** 讀者觸發「返回列表」
- **THEN** 系統回到導讀選擇畫面,不留下任何作答紀錄

#### Scenario: 從最後一步返回列表而不進入 quiz
- **GIVEN** 讀者已瀏覽到某份導讀的最後一步,但尚未進入 quiz
- **WHEN** 讀者觸發「返回列表」
- **THEN** 系統回到導讀選擇畫面,不留下任何作答紀錄
