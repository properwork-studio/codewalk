## Why

CodeWalk 目前是一座孤島:AI 產完 `.codewalk.json` 後,讀者得自己找檔案、手動開面板;讀者卡在某一步想追問,已能透過 `add-ask-agent-from-panel`(已上線)把當前脈絡送進 Chat,但那是讀者**主動框選、單向丟出**的動作——agent 沒有辦法自己查「讀者現在停在哪一份導讀的第幾步」。`docs/future-work.md` 第 2 項把這個缺口定義為「導讀是單向的」,`openspec/decisions.md` 已定案技術路徑走 MCP(理由:Cursor 原生支援 MCP 但不吃 VS Code 的 `languageModelTools` 貢獻點;MCP 同時涵蓋終端機 agent、可與 CodeGraph/DeepWiki 在同一層對話)。

這個 change 補上兩段還沒做的機制:**agent 產完導讀後自己把面板開起來**,以及**agent 可以主動查詢讀者目前的閱讀狀態**——把單向的「讀者讀給自己看」,變成 agent 與讀者共享同一份閱讀進度的雙向關係。

## What Changes

- 新增 `window.registerUriHandler`,註冊 `vscode://properworkstudio.codewalk-reader/open?walk=<相對路徑>&step=<索引>`(`step` 選填),供產生流程(如 `explain-change` skill)產完導讀後直接開面板並載入指定步驟
- 新增本機 MCP server,隨 extension 啟動,對外提供唯讀的 pull 工具:
  - `codewalk_current_step`:回傳讀者目前在看哪一份導讀、第幾步、該步的 `title`/`file`/行號範圍/錨驗證狀態
  - `codewalk_list_walks`:回傳目前 workspace 下可播放的導讀清單(路徑、標題)
- MCP server 的啟動/停止與 extension 生命週期綁定;找不到可用連接埠或啟動失敗時,extension 其餘功能不受影響(MCP 是加分,不是前提——沿用 `decisions.md` 對 push 通道的既有判斷,pull 工具比照辦理)
- **不做**:MCP push(`notifications/claude/channel` 這類主動推送)——`decisions.md` 已定案這屬於「加分不是前提」,且目前沒有具體使用情境需要它,留給 PR Review 註記(future-work 第 4 項)那個 change 再評估
- **不做**寫入類工具(如「幫讀者跳到第 N 步」)——pull 唯讀,不讓 agent 反過來操控讀者的面板狀態

## Capabilities

### New Capabilities

- `agent-bridge`:agent 與 CodeWalk 面板之間的雙向查詢/開啟機制,涵蓋 URI handler(agent → 面板開啟)與 MCP pull 工具(面板 → agent 查詢閱讀狀態)

### Modified Capabilities

(無——不更動 `walk-player`、`ask-agent` 既有 requirement,面板本身的播放行為不變,只是多一個外部可以查詢/開啟它的管道)

## Impact

- 新增 `src/uriHandler.ts`(或併入 `extension.ts`):註冊與解析 `vscode://` URI,呼叫既有 `WalkPlayerViewProvider` 的 `loadWalk`/`setStep` 對外介面(可能需要把目前是 `private` 的 `loadWalk` 開放為可從外部觸發,或新增一個 `openWalkAtStep(path, stepIndex?)` 公開方法)
- 新增 `src/mcpServer.ts`(或獨立目錄):本機 MCP server 實作,讀取 `WalkPlayerViewProvider` 的目前狀態(`currentWalk`/`currentWalkPath`/`stepIndex`/`anchorReport`)組成工具回傳值——沿用 `askAgentPrompt.ts` 已經在算的「有效行號」邏輯(錨驗證後的位置),避免兩處重算
- `package.json`:新增 `dependencies`(MCP TypeScript SDK)、可能新增 `contributes.commands` 或設定項(MCP server port 是否需要讓使用者可見/可設定,design 階段決定)
- 不動 `shared/schema.ts`(`.codewalk.json` 格式不變)、不動 `shared/protocol.ts`(webview ⇄ host 的既有訊息協定不變——MCP 是額外的對外介面,不經過 webview)
- `docs/`:更新 `future-work.md` 第 2 項狀態、可能需要新增一份面向 agent 開發者的「怎麼接 CodeWalk MCP」文件

## Out of Scope

- MCP push(主動通知 agent)——留給日後評估
- 寫入類 MCP 工具(agent 操控面板跳步、修改導讀)
- PR Review 註記(future-work 第 4 項,另開 change)
- Cursor 對 URI handler 的相容性驗證超出「機制存在」以外的細節(如 Cursor 是否需要不同的 scheme 註冊方式)——若 design 階段發現需要拆分,再拆

## Open Questions

以下 5 題已過一遍,方向已定,細節於 design 階段展開:

1. **MCP server 傳輸層**——走 **HTTP/SSE,由 extension 內嵌啟動**。理由:狀態(`currentWalk`/`stepIndex`)活在執行中的 extension host 記憶體裡,只有 extension 自己起的本機 server 能直接讀到即時狀態;stdio 由 agent 端 spawn 的話是全新、獨立的 process,沒有共用記憶體,得再繞一層跨 process 溝通,等於繞回 HTTP。動態 port 選定與探索機制見第 5 題。
2. **讀者沒開任何導讀時,`codewalk_current_step` 回傳什麼**——回傳**明確的「無」狀態**(如 `{ active: false }`),不是報錯。沒開導讀是合法狀態不是失敗,呼叫端不必用 try/catch 處理「正常情況」。
3. **URI handler 的 `step` 參數基準**——**0-based**,跟 `askAgentPrompt.ts` 內部 `steps[N]` 的既有慣例一致,agent 讀 `.codewalk.json` 的 `steps` 陣列本來就是 0-based,直接塞進 URL 不必換算。
4. **Multi-root workspace 的相對路徑基準**——沿用 `src/viewProvider.ts:22` 既有的 `getWorkspaceRoot()`(取 `workspaceFolders[0]`),不為 MCP 這條路另立一套換算邏輯。
5. **多視窗同時開著同一個/不同 workspace 時,MCP server 如何協調**——**每個 workspace 一份探索檔**(依 workspace 路徑算 hash 命名,存動態 port),天生解決「不同 repo 各自開視窗」的常見情境。同一個 workspace 被開兩次的邊角案例:後起的視窗**先對探索檔記錄的 port 做 health check**——確認前一個 server 還活著就**不覆蓋、不啟動自己的 server,改用 VS Code 通知告知讀者**(避免第一個視窗被默默覆蓋卻毫無所覺);health check 失敗(前一個視窗異常關閉留下的殭屍記錄)則直接覆蓋、視為自我修復,不需通知。不做自動接管 UI。
