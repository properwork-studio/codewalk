## ADDED Requirements

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
