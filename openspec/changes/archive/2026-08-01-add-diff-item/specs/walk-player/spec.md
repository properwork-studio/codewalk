## ADDED Requirements

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

## MODIFIED Requirements

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
