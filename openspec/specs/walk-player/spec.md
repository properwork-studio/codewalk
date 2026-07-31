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
