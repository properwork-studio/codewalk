## ADDED Requirements

### Requirement: agent 可透過 URI 開啟指定導讀與步驟

系統 SHALL 註冊一個 URI handler,讓外部程序(如產生導讀的 agent)可以用單一 URI 直接開啟面板、載入指定的導讀檔,並可選擇性地跳到指定步驟。`walk` 參數 SHALL 解讀為 workspace 相對路徑;`step` 參數(選填)SHALL 採 0-based 索引,與導讀檔內部 `steps` 陣列的索引基準一致。

#### Scenario: 未帶 step 參數,開啟導讀並停在第一步

- **GIVEN** 目前 workspace 的 `.codewalk/` 底下有一份有效的導讀檔
- **WHEN** 外部程序以 `vscode://.../open?walk=<相對路徑>`(不含 `step`)觸發 URI
- **THEN** 面板開啟並載入該份導讀,停在第一步(索引 0)

#### Scenario: 帶 step 參數,開啟導讀並跳到指定步驟

- **GIVEN** 目前 workspace 的 `.codewalk/` 底下有一份至少 8 步的有效導讀檔
- **WHEN** 外部程序以 `vscode://.../open?walk=<相對路徑>&step=6` 觸發 URI
- **THEN** 面板開啟並載入該份導讀,停在索引 6 對應的步驟(第 7 步)

#### Scenario: step 參數超出步驟範圍

- **GIVEN** 目前 workspace 的導讀檔只有 3 步(索引 0-2)
- **WHEN** 外部程序以 `step=99` 觸發 URI
- **THEN** 面板開啟並載入該份導讀,停在最後一個有效步驟(索引 2),不報錯、不中斷

#### Scenario: 沒有已開啟的 workspace

- **GIVEN** 目前的 VS Code 視窗沒有任何已開啟的 workspace
- **WHEN** 外部程序觸發任一 `open` URI
- **THEN** 系統顯示明確的錯誤提示,不嘗試以絕對路徑解讀 `walk` 參數,面板不進入任何載入中的狀態

#### Scenario: `walk` 參數指向不存在或格式錯誤的導讀檔

- **GIVEN** `walk` 參數指向的檔案不存在,或內容不符合導讀檔格式
- **WHEN** 外部程序觸發 `open` URI
- **THEN** 面板開啟並顯示與讀者手動選擇同一份壞掉檔案時相同的錯誤訊息,不靜默失敗

#### Scenario: `walk` 參數嘗試逸出 workspace

- **GIVEN** `walk` 參數帶有 `..` 或其他試圖指向 workspace 之外的路徑寫法
- **WHEN** 外部程序觸發 `open` URI
- **THEN** 系統拒絕解析為任何 workspace 外的檔案路徑,顯示明確的錯誤提示,不讀取或載入 workspace 之外的任何檔案

### Requirement: URI 觸發的開啟不因面板尚未建立而遺失

面板在本次 VS Code session 尚未被開啟過時(webview 尚未建立),系統 SHALL 保證 URI 觸發的開啟請求在面板建立完成後仍然生效,SHALL NOT 因為時序問題讓載入請求靜默遺失。

#### Scenario: 面板本次 session 尚未開啟過

- **GIVEN** 讀者這次開啟 VS Code 後從未點開過 CodeWalk 面板
- **WHEN** 外部程序觸發 `open` URI
- **THEN** 面板被建立、顯示,並正確載入 URI 指定的導讀與步驟——不是空白畫面或列表畫面

#### Scenario: 面板已經開啟且正在瀏覽其他導讀

- **GIVEN** 讀者的面板已開啟,正在瀏覽某份導讀的某一步
- **WHEN** 外部程序觸發指向另一份導讀的 `open` URI
- **THEN** 面板立即切換為載入 URI 指定的新導讀,取代原本瀏覽的內容

#### Scenario: URI 觸發開啟時,取代而非疊加原本的「接續上次進度」行為

- **GIVEN** 讀者曾經瀏覽過某份導讀並留有進度記錄,面板本次 session 尚未開啟過
- **WHEN** 外部程序觸發指向另一份導讀的 `open` URI
- **THEN** 面板載入的是 URI 指定的導讀與步驟,不是讀者上次瀏覽留下的進度

### Requirement: agent 可查詢讀者目前的閱讀狀態

系統 SHALL 提供一個唯讀查詢介面,讓 agent 可以取得讀者目前瀏覽到哪一份導讀、第幾步,以及該步驟對應的檔案位置與錨驗證狀態。查詢 SHALL NOT 改變讀者面板的任何狀態。

#### Scenario: 讀者正在瀏覽某份導讀的某一步

- **GIVEN** 讀者的面板已載入某份導讀,目前停在第 N 步
- **WHEN** agent 查詢目前的閱讀狀態
- **THEN** 回傳內容包含該導讀的路徑、標題、目前步驟索引與標題、對應的檔案與行號範圍、以及該步驟的錨驗證狀態

#### Scenario: 行號採用錨驗證後的有效位置

- **GIVEN** 讀者目前停在一個經錨驗證判定為位移的步驟
- **WHEN** agent 查詢目前的閱讀狀態
- **THEN** 回傳的行號範圍是驗證後的新位置,與面板顯示、編輯器跳轉一致,不是導讀檔原本記載的行號

#### Scenario: 步驟已失準時,狀態如實回報而非隱藏

- **GIVEN** 讀者目前停在一個經錨驗證判定為失準的步驟
- **WHEN** agent 查詢目前的閱讀狀態
- **THEN** 回傳內容明確標示該步驟為失準狀態,不是省略此欄位或回報為正常

#### Scenario: 讀者沒有開啟任何導讀

- **GIVEN** 讀者的面板停在導讀列表畫面,或面板尚未開啟
- **WHEN** agent 查詢目前的閱讀狀態
- **THEN** 回傳明確的「無使用中導讀」狀態,不是報錯,也不是回傳上一份已關閉導讀的殘留資料

### Requirement: agent 可列出目前 workspace 可播放的導讀

系統 SHALL 提供一個唯讀查詢介面,讓 agent 可以取得目前 workspace 下所有可播放導讀的路徑與標題清單。

#### Scenario: workspace 下有可播放的導讀

- **GIVEN** 目前 workspace 的 `.codewalk/` 底下有數份有效的導讀檔
- **WHEN** agent 查詢導讀清單
- **THEN** 回傳每份導讀的 workspace 相對路徑與標題,清單內容與面板列表畫面顯示的一致

#### Scenario: workspace 下沒有任何導讀

- **GIVEN** 目前 workspace 的 `.codewalk/` 不存在或底下沒有任何有效的導讀檔
- **WHEN** agent 查詢導讀清單
- **THEN** 回傳空清單,不是報錯

### Requirement: 查詢介面不啟動於沒有 workspace 的視窗

沒有已開啟的 workspace 時,系統 SHALL NOT 對外提供查詢介面。

#### Scenario: 視窗沒有已開啟的 workspace

- **GIVEN** 目前的 VS Code 視窗沒有任何已開啟的 workspace
- **WHEN** extension 啟動
- **THEN** 系統不對外提供任何可連線的查詢介面,且不顯示任何與此相關的錯誤提示——這是預期狀態,不是失敗

### Requirement: 同一個 workspace 被多個視窗同時開啟時,查詢介面不重複提供

同一個 workspace 被兩個以上的 VS Code 視窗同時開啟時,系統 SHALL 確保任一時刻最多只有一個查詢介面對外服務該 workspace,且後啟動的視窗 SHALL 在判定已有其他視窗提供服務時明確告知讀者。

#### Scenario: 第二個視窗開啟時,第一個視窗的服務仍在運作

- **GIVEN** 某個 workspace 已經有一個視窗在提供查詢介面
- **WHEN** 讀者開啟同一個 workspace 的第二個視窗
- **THEN** 第二個視窗不啟動自己的查詢介面,並明確告知讀者已有其他視窗在提供服務;第一個視窗的服務不受影響、agent 仍可正常查詢

#### Scenario: 前一個視窗異常結束後,新視窗接手服務

- **GIVEN** 某個 workspace 先前有視窗提供查詢介面,但該視窗已經關閉且未正常釋放
- **WHEN** 讀者開啟該 workspace 的新視窗
- **THEN** 新視窗判定舊服務已不可用,啟動自己的查詢介面接手服務,不需要讀者手動介入

### Requirement: 查詢介面與面板既有播放行為互不影響

MCP 查詢介面的啟動、連線與查詢 SHALL NOT 影響面板既有的播放行為;查詢介面的啟動失敗 SHALL NOT 阻斷或延誤面板的任何既有功能。

#### Scenario: 查詢介面啟動失敗時,面板功能不受影響

- **GIVEN** 查詢介面因故啟動失敗(如埠號分配失敗)
- **WHEN** 讀者照常使用面板瀏覽導讀、切換步驟、作答 quiz
- **THEN** 面板所有既有功能正常運作,不出現與查詢介面相關的錯誤訊息或延遲

#### Scenario: agent 查詢不改變讀者面板狀態

- **GIVEN** 讀者的面板正停在某一步
- **WHEN** agent 多次查詢目前的閱讀狀態或導讀清單
- **THEN** 讀者面板顯示的步驟、捲動位置、展開中的術語等狀態完全不受影響
