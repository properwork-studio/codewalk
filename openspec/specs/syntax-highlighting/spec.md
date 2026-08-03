# syntax-highlighting

## Purpose

程式碼片段(snippet、diff)的語法高亮行為合約——配色來源與降級、支援語言的判定、主題切換時的重繪、高亮就緒前的顯示方式。讓 CodeWalk 面板內的程式碼配色與讀者的 VS Code 編輯器同源一致,不需讀者在兩套配色間切換注意力。

## Requirements

### Requirement: 程式碼配色跟隨讀者當前的編輯器主題

系統 SHALL 讓 snippet 與 diff 的程式碼內容,依讀者當前 VS Code 主題所定義的 token 顏色與字型樣式(粗體、斜體)上色,使面板內的程式碼與編輯器內同一段程式碼呈現一致的配色。

當系統無法取得當前主題的配色定義時,系統 SHALL 降級為預設配色並照常顯示程式碼,不得中斷走讀流程、不得顯示錯誤訊息、不得留下空白區塊。

#### Scenario: 讀者使用非預設主題

- **GIVEN** 讀者的 VS Code 使用一個非預設的佈景主題,且該主題定義了程式碼 token 的顏色
- **WHEN** 讀者瀏覽含 snippet 或 diff 的 step
- **THEN** 程式碼的關鍵字、字串、型別等 token 依該主題定義的顏色顯示,包含該主題指定的粗體與斜體樣式

#### Scenario: 無法辨識當前主題

- **GIVEN** 讀者當前設定的主題無法被系統辨識(例如主題已被移除、或設定值找不到對應的主題定義)
- **WHEN** 讀者瀏覽含 snippet 或 diff 的 step
- **THEN** 系統以預設配色顯示程式碼,依編輯器當前為淺色或深色套用對應的預設配色,走讀流程不受影響

#### Scenario: 主題定義檔無法解析

- **GIVEN** 讀者當前主題的定義檔存在但內容無法解析(格式錯誤、缺少 token 顏色定義,或繼承層數過深)
- **WHEN** 讀者瀏覽含 snippet 或 diff 的 step
- **THEN** 系統以預設配色顯示程式碼,不顯示錯誤訊息,讀者仍可繼續下一步

### Requirement: 切換主題時重繪已顯示的程式碼

系統 SHALL 在讀者切換 VS Code 佈景主題時,更新面板上已顯示的 snippet 與 diff 配色,不需讀者重新開啟面板或重新載入導讀。

#### Scenario: 切換主題後程式碼配色更新

- **GIVEN** CodeWalk 面板正顯示一個含 snippet 的 step
- **WHEN** 讀者在 VS Code 切換到另一個佈景主題
- **THEN** 面板上該 snippet 的程式碼配色更新為新主題的配色,且目前所在的 step 與捲動位置不變

#### Scenario: 切換到無法辨識的主題

- **GIVEN** CodeWalk 面板正顯示一個含 snippet 的 step,且目前配色來自可辨識的主題
- **WHEN** 讀者切換到一個系統無法辨識配色定義的主題
- **THEN** 面板上的程式碼降級為預設配色,走讀流程不受影響

### Requirement: 依檔案副檔名判定語言

系統 SHALL 依 snippet 或 diff 項目的 `file` 副檔名判定程式語言並據以上色。副檔名無對應語言時,系統 SHALL 以純文字顯示該段程式碼,不得推測語言。

#### Scenario: 副檔名有對應的語言

- **GIVEN** 某個 snippet 項目的 `file` 副檔名對應到系統支援的語言
- **WHEN** 讀者瀏覽該 step
- **THEN** 該段程式碼依對應語言的文法上色

#### Scenario: 副檔名沒有對應的語言

- **GIVEN** 某個 snippet 項目的 `file` 副檔名不對應任何系統支援的語言
- **WHEN** 讀者瀏覽該 step
- **THEN** 該段程式碼以純文字顯示,內容完整呈現且不因含有角括號等字元而破壞版面,系統不推測其語言

### Requirement: 高亮就緒前的顯示

系統 SHALL 在語法高亮尚未就緒時,先以純文字完整顯示程式碼內容,並在就緒後自動更新為上色後的內容,期間不得出現空白區塊。

#### Scenario: 高亮就緒前瀏覽 step

- **GIVEN** 面板剛開啟,語法高亮尚未就緒
- **WHEN** 讀者瀏覽一個含 snippet 的 step
- **THEN** 該 snippet 的程式碼以純文字完整顯示,行號與可點擊跳轉的行為與上色後一致

#### Scenario: 就緒後自動更新

- **GIVEN** 某個 snippet 正以純文字顯示,因為語法高亮尚未就緒
- **WHEN** 語法高亮完成初始化
- **THEN** 該 snippet 自動更新為上色後的內容,讀者不需切換 step 或重新開啟面板
