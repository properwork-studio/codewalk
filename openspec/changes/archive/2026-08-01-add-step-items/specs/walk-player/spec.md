## ADDED Requirements

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

### Requirement: 說明元件依序交錯顯示
系統 SHALL 依 `items` 陣列的原始順序顯示 tip、pitfall、todo、reference、snippet 五種項目,不強制固定分組或重新排序,讓撰寫者能自由交錯安排這些項目與主敘述的呈現順序。

#### Scenario: 混合排列多種 kind
- **GIVEN** 目前 step 的 `items` 依序為 `[tip, snippet, reference, pitfall]`
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統依相同順序由上而下顯示這四個項目
