## ADDED Requirements

### Requirement: 錨欄位的格式與驗證
`.codewalk.json` 的每個 step 與每個 `kind: 'snippet'` 項目 SHALL 可選擇性提供 `anchor` 欄位,內容為該 `file`:`startLine`-`endLine` 範圍在導讀產出當下的程式碼原文。`kind: 'diff'` 項目 SHALL NOT 使用 `anchor`。系統 SHALL 在載入時驗證:`anchor` 若存在必須是字串;內容去除空白字元後為空者 SHALL 視同未提供 `anchor`,不參與後續驗證。`anchor` 為可選欄位——未提供時 SHALL NOT 產生任何格式錯誤。

#### Scenario: 省略 anchor 仍為合法格式
- **GIVEN** 一份 `.codewalk.json` 的所有 step 與 snippet 都沒有 `anchor` 欄位
- **WHEN** 系統載入該檔案
- **THEN** 系統正常載入並播放,不產生任何格式錯誤

#### Scenario: anchor 型別不合法
- **GIVEN** 一份 `.codewalk.json` 的某個 step 的 `anchor` 是數字而非字串
- **WHEN** 系統載入該檔案
- **THEN** 系統顯示格式錯誤訊息並指出該 step 的位置,不載入該導讀

#### Scenario: anchor 內容僅有空白
- **GIVEN** 一份 `.codewalk.json` 的某個 step 的 `anchor` 僅含空白字元與換行
- **WHEN** 系統載入該檔案
- **THEN** 系統正常載入,該 step 視同未提供 `anchor`,不對其做失準判定

### Requirement: 載入時的錨驗證與失準判定
讀者載入導讀時,系統 SHALL 對該導讀**所有**具備 `anchor` 的 step 與 snippet 逐一驗證,將每個目標判定為下列四種狀態之一:相符、位移、失準、未錨定。判定 SHALL 依序進行:目標檔案不存在時判為**失準**;現行檔案在該行號範圍的內容與 `anchor` 相同時判為**相符**;否則在該檔案全文中尋找 `anchor`——恰好出現一次時判為**位移**,出現零次或兩次以上時判為**失準**。比對前系統 SHALL 將換行統一為 LF,且 SHALL NOT 忽略縮排或尾隨空白的差異。系統 SHALL NOT 因驗證結果而修改 `.codewalk.json` 檔案內容。

#### Scenario: 程式碼未變動
- **GIVEN** 某 step 具備 `anchor`,且現行檔案在 `startLine`-`endLine` 的內容與 `anchor` 逐字相同
- **WHEN** 讀者載入該導讀
- **THEN** 系統將該 step 判定為相符,不顯示任何失準標記

#### Scenario: 程式碼內容已被改寫
- **GIVEN** 某 step 具備 `anchor`,但該段程式碼已被改寫,`anchor` 在該檔案全文中找不到
- **WHEN** 讀者載入該導讀
- **THEN** 系統將該 step 判定為失準

#### Scenario: 錨在檔案中出現多處
- **GIVEN** 某 step 的 `anchor` 內容在現行檔案中出現兩次以上
- **WHEN** 讀者載入該導讀
- **THEN** 系統將該 step 判定為失準,不任意選擇其中一處

#### Scenario: 目標檔案已被刪除或改名
- **GIVEN** 某 step 具備 `anchor`,但其 `file` 已不存在於 workspace
- **WHEN** 讀者載入該導讀
- **THEN** 系統將該 step 判定為失準,不中斷導讀載入,讀者仍可瀏覽其餘步驟

#### Scenario: 僅縮排改變
- **GIVEN** 某 step 的程式碼內容文字相同但縮排已改變,`anchor` 在該檔案全文中找不到完全相同的內容
- **WHEN** 讀者載入該導讀
- **THEN** 系統將該 step 判定為失準,不將縮排差異視為相符

### Requirement: 單純位移時跟隨新行號
當某 step 或 snippet 的 `anchor` 在現行檔案中找到**恰好一處**逐字相同的內容、但位置與 `.codewalk.json` 記錄的行號不同時,系統 SHALL 以找到的新位置作為該目標的有效行號,用於程式碼預覽、檔案跳轉與行號顯示。此情形 SHALL NOT 視為失準,系統 SHALL NOT 顯示任何失準標記或「行號已調整」提示。

#### Scenario: 上游插入程式碼造成整段下移
- **GIVEN** 某 step 的 `anchor` 內容未變,但因檔案上方新增了程式碼而整段下移
- **WHEN** 讀者載入該導讀並瀏覽到該 step
- **THEN** 系統以新位置預覽程式碼並跳轉,面板顯示的行號為新位置的行號,且不顯示失準標記

#### Scenario: 位移後點擊 snippet 跳轉
- **GIVEN** 某 `kind: 'snippet'` 項目被判定為位移
- **WHEN** 讀者點擊該項目
- **THEN** 系統在編輯器開啟該檔案,捲動並高亮**新位置**的範圍,而非 `.codewalk.json` 記錄的原行號範圍

### Requirement: 失準步驟的呈現
系統 SHALL 對被判定為失準的 step 與 snippet 顯示失準標記,標記的視覺樣式 SHALL 與既有的系統層級警告(ref 漂移、檔案跳轉錯誤)一致,並與內容型提示(`tip`、`pitfall`、`todo`)明確區隔。失準目標的程式碼區塊 SHALL 顯示 `anchor` 的內容(即導讀產出當下的程式碼),並明確標示該內容為產出當時的版本、現行版本已不同;系統 SHALL NOT 顯示現行檔案在該行號範圍的內容。系統 SHALL 為失準目標提供「開啟現行檔案」動作,讀者觸發時系統 SHALL 開啟該檔案但 SHALL NOT 選取或捲動到任何特定行。失準 SHALL NOT 中斷導覽——讀者仍可瀏覽所有步驟並作答 quiz。

#### Scenario: 失準 step 顯示產出當時的程式碼
- **GIVEN** 某 step 被判定為失準
- **WHEN** 讀者瀏覽到該 step
- **THEN** 系統顯示失準標記,並顯示該 step `anchor` 的內容,同時標示該內容為產出當時的版本

#### Scenario: 失準時不顯示現行檔案內容
- **GIVEN** 某 `kind: 'snippet'` 項目被判定為失準,其 `file` 仍存在且該行號範圍有其他程式碼
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統顯示的程式碼為 `anchor` 的內容,不顯示現行檔案在該行號範圍的內容

#### Scenario: 開啟現行檔案不落在錯誤位置
- **GIVEN** 某失準目標顯示「開啟現行檔案」動作
- **WHEN** 讀者觸發該動作
- **THEN** 系統在編輯器開啟該檔案,不選取任何行、不捲動到 `.codewalk.json` 記錄的原行號

#### Scenario: 目標檔案不存在時的開啟動作
- **GIVEN** 某目標因 `file` 不存在而被判定為失準
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統顯示「找不到檔案」提示與 `anchor` 內容,不提供「開啟現行檔案」動作,且不中斷導覽

#### Scenario: 失準不阻擋導覽與作答
- **GIVEN** 一份導讀有部分 step 被判定為失準
- **WHEN** 讀者使用上一步/下一步瀏覽並完成 quiz 作答
- **THEN** 系統照常切換步驟、照常計分與留存作答紀錄,不因失準而封鎖任何操作

### Requirement: 重生引導
當一份導讀含有**任何一個**被判定為失準的目標時,系統 SHALL 在面板顯示重生提示,說明該導讀已有步驟與現行程式碼不符、建議重新產生。`.codewalk.json` SHALL 可選擇性提供頂層 `regenerateHint` 欄位(非空字串,允許多行),內容為該導讀的重新產生方式;提供該欄位時,系統 SHALL 額外顯示「複製重生指令」動作,讀者觸發後系統 SHALL 將 `regenerateHint` 的內容原樣複製到剪貼簿。系統 SHALL NOT 解讀、改寫或執行 `regenerateHint` 的內容,亦 SHALL NOT 自行產生導讀。

#### Scenario: 有失準步驟時顯示重生提示
- **GIVEN** 一份導讀的 21 個 step 中有 3 個被判定為失準
- **WHEN** 讀者載入該導讀
- **THEN** 系統在面板顯示重生提示,說明該導讀已有步驟與現行程式碼不符

#### Scenario: 複製重生指令
- **GIVEN** 一份含失準步驟的導讀提供了 `regenerateHint`
- **WHEN** 讀者觸發「複製重生指令」動作
- **THEN** 系統將 `regenerateHint` 的內容原樣複製到剪貼簿,不執行任何產生行為

#### Scenario: 未提供 regenerateHint
- **GIVEN** 一份含失準步驟的導讀沒有 `regenerateHint` 欄位
- **WHEN** 讀者載入該導讀
- **THEN** 系統顯示重生提示文字,但不顯示「複製重生指令」動作

#### Scenario: 全部相符時不顯示重生提示
- **GIVEN** 一份導讀的所有具備 `anchor` 的目標皆判定為相符或位移
- **WHEN** 讀者載入該導讀
- **THEN** 系統不顯示重生提示

#### Scenario: regenerateHint 格式不合法
- **GIVEN** 一份 `.codewalk.json` 的 `regenerateHint` 為空字串
- **WHEN** 系統載入該檔案
- **THEN** 系統顯示格式錯誤訊息,不載入該導讀

### Requirement: 無錨導讀維持既有行為
當一份導讀的所有 step 與 snippet 皆未提供有效 `anchor` 時,系統 SHALL NOT 顯示任何失準標記或重生提示,SHALL NOT 改變程式碼預覽與檔案跳轉的行為,並 SHALL 沿用既有的 ref 漂移警告作為唯一的過期訊號。

#### Scenario: 舊版導讀行為不變
- **GIVEN** 一份在本功能推出前產出、不含任何 `anchor` 的導讀,且目前 HEAD 與其 `ref` 不同
- **WHEN** 讀者載入該導讀
- **THEN** 系統顯示既有的「行號可能漂移」警告,不顯示任何逐步失準標記,程式碼預覽與跳轉行為與本功能推出前完全一致

#### Scenario: 部分錨定的導讀
- **GIVEN** 一份導讀只有部分 step 提供 `anchor`
- **WHEN** 讀者載入該導讀
- **THEN** 系統只對具備 `anchor` 的目標做失準判定,未提供 `anchor` 的目標照既有行為預覽與跳轉,不因缺少 `anchor` 而標記為失準
