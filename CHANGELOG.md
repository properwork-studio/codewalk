# 變更紀錄

本檔案格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號遵循 [語意化版本](https://semver.org/lang/zh-TW/)。

## [0.2.0] - 2026-08-17

### 新增

- **面板內框選追問**：在走讀面板的敘述或程式碼片段內框選一段文字，浮出兩顆按鈕——一顆把組好的 prompt（選取文字 + 當前步驟的標題/敘述/檔案位置 + 導讀標題）送進 VS Code / Cursor 的 chat（只填入不自動送出），一顆複製到剪貼簿供終端機 agent 使用；找不到對應指令時（如舊版 Cursor）自動退回剪貼簿
- **agent 可透過 URI 直接開啟指定導讀**：註冊 `vscode://properworkstudio.codewalk-reader/open?walk=<workspace 相對路徑>&step=<0-based 索引，選填>`，供產生導讀的流程（如 `explain-change` skill）產完直接開面板並跳到指定步驟
- **agent 可透過 MCP 查詢讀者的閱讀狀態**：extension 啟動時（有已開啟的 workspace 才會啟動）在本機起一個唯讀的 MCP server，提供 `codewalk_current_step`（讀者目前在看哪份導讀、第幾步、對應檔案與行號、錨驗證狀態）與 `codewalk_list_walks`（目前 workspace 下可播放的導讀清單）兩個工具；同一個 workspace 被多個視窗同時開啟時，以健康檢查判斷由哪個視窗提供服務，避免服務被默默覆蓋卻毫無所覺

### 修正

- 窄面板下，英文文案可能撐破按鈕版面

## [0.1.1] - 2026-08-09

### 修正

- `repository`／`homepage`／`bugs` 與 README 內的連結原本指向 `github.com/properworkstudio`，實際的 GitHub 組織是 `properwork-studio`（有連字號）。0.1.0 的 marketplace 頁面因此截圖破圖、Repository 與 Issues 連結皆為 404

### 變更

- extension 識別碼為 `properworkstudio.codewalk-reader`、顯示名稱為「CodeWalk Reader」——`codewalk` 與 `CodeWalk` 在 Marketplace 上都已被他人保留（VS Code Marketplace 的 `name` 與 `displayName` 皆需全域唯一）

## [0.1.0] - 2026-08-09

首個版本。純播放器，不含產生功能——`.codewalk.json` 需另外準備（人工撰寫或由其他工具產生）。

### 新增

- **導讀播放**：讀取 workspace 的 `.codewalk/*.codewalk.json`，在側邊面板逐步播放。每步自動跳轉並高亮對應的程式碼範圍，方向鍵即可前進後退
- **六種說明元件**：提示（tip）、常見誤解（pitfall）、待辦（todo）、外部連結（reference）、程式碼片段（snippet）、差異比對（diff）
- **可收合術語卡**：每步可附術語解釋，點擊展開
- **Quiz 自測**：走完導讀後可作答，附每個選項的對錯說明；過關門檻可用 `passThreshold` 指定，省略時為題數的簡單多數
- **作答紀錄**：導讀列表顯示上次的作答結果，可手動清除
- **語法高亮**：採用 Shiki，配色跟隨讀者當前的 VS Code 主題；支援 23 種語言，未支援的語言退回純文字而不猜色
- **導讀失準偵測**：`.codewalk.json` 的 `anchor` 欄位記錄產出當下的程式碼原文，載入時逐步比對現行檔案。單純位移會自動跟隨新行號，內容真的改動才標示失準，並可透過 `regenerateHint` 提供重新產生的方式
- **敘述 markdown 渲染**：`narration` 等欄位支援一組封閉的 markdown 子集（行內程式碼、粗體、連結、清單、二級小標），不支援的語法原樣顯示為純文字
- **閱讀進度**：讀到第幾步會留存，跨 VS Code 重啟仍可從導讀列表接續；作答完成後自動清除

### 已知限制

- 沒有內建的導讀產生器，需自行準備 `.codewalk.json`
- 導讀檔案的行號以 `ref` 釘住的 commit 為準；未提供 `anchor` 的導讀只能做粗略的 ref 比對
