## MODIFIED Requirements

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
