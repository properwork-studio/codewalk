**建議開發方式**:本次全部是 extension host(`src/`)邏輯,不碰 webview——沒有 UI 切片。可抽成純函式的部分(路徑換算、snapshot 組裝、探索檔路徑計算)比照 `src/askAgentPrompt.ts` 的既有模式走 tdd skill(red-green-refactor);碰 `vscode` API 或實際網路/檔案 I/O 的部分(URI handler 接線、MCP transport、健康檢查、生命週期)不新增 mock 基礎設施,直接實作後留給任務 6.1 的 Extension Development Host checklist 驗證,與 `viewProvider.ts` 既有測試策略一致。

## 1. 共用工具抽出

- [x] 1.1(AFK, TDD)把 `src/askAgentPrompt.ts` 內的 `toPromptPath()` 搬到共用位置並 export,`askAgentPrompt.ts` 改為 import 使用;既有 `askAgentPrompt.test.ts` 全部維持綠燈,補上獨立測試覆蓋原有的相對路徑/絕對路徑退路案例。這是任務 3.1、2.2 都要用到的共用邏輯,先做掉避免兩邊各自重複實作。
  - **實作筆記**:`src/workspacePath.ts` 已存在(`798a6de`,`resolveInWorkspace()`),不是新檔案。函式搬進這支既有檔案、更名為 `toWorkspaceRelativePath(workspaceRoot, absolutePath)`,與既有 `resolveInWorkspace(workspaceRoot, file)` 互為反方向、放在一起。測試補進既有 `workspacePath.test.ts`。任務 2.2(URI handler 的 `walk` 參數解析)因此直接沿用 `resolveInWorkspace()` 的路徑逸出防護,design.md 決策 5/7/8 與 spec 已同步補上一個「`walk` 參數嘗試逸出 workspace」的 scenario。

## 2. URI handler:agent 開啟指定導讀與步驟

對應 spec `agent-bridge` 前兩個 Requirement、7 個 scenario。

- [x] 2.1(AFK)在 `WalkPlayerViewProvider` 新增 `pendingOpenRequest` 欄位與 `public async openWalkFromUri(relativePath: string, stepIndex?: number)`:面板已建立(`this.view` 存在)時直接呼叫既有 `loadWalk`/`setStep`;尚未建立時存進 `pendingOpenRequest` 並觸發 `${viewId}.focus`。`webviewReady` 的 handler 新增分支:有 `pendingOpenRequest` 就消費它、取代原本的 `sendRestoreIfActive()`。涵蓋 scenario「未帶 step」「帶 step」「step 超出範圍」(沿用既有 `setStep` 的 clamp)、「面板已開啟且正在瀏覽其他導讀」「取代而非疊加接續進度」。
- [x] 2.2(AFK)新增 `src/uriHandler.ts`:呼叫 `vscode.window.registerUriHandler`,解析 `open` 路徑與 `walk`/`step` query 參數(`step` 轉為 0-based 數字);`openWalkFromUri()`(任務 2.1)內部用既有 `resolveInWorkspace()` 把 `walk` 換成絕對路徑並擋 `..` 逸出,沒有 `getWorkspaceRoot()` 或路徑逸出時顯示錯誤、不繼續載入。涵蓋 scenario「沒有已開啟的 workspace」「`walk` 參數嘗試逸出 workspace」。`walk` 指向不存在或格式錯誤檔案的 scenario 沿用 `loadWalk` 既有的 `loadError` 行為,不需額外程式碼,驗證即可。
- [x] 2.3(HITL)`extension.ts` 註冊 `uriHandler.ts` 的 handler 並掛進 `context.subscriptions`;確認錯誤訊息文案(`shared/i18n.ts` 新增對應 key,繁英各一份)語意清楚,讀者看得懂發生了什麼。
  - **手動驗證發現的根因(design.md 決策 10)**:`package.json` 的 `activationEvents` 必須明確加上 `"onUri"`——`registerUriHandler` 是動態呼叫,不在 `contributes` 裡,VS Code 推論不出來。少了它,extension 這個 session 還沒被別的途徑啟動過時,第一次的 URI 會無處可去,面板毫無反應。已修正並移除連帶因誤判而加上的側邊欄補送邏輯(還原成最簡單的單次 `.focus()` 呼叫)。

## 3. MCP 查詢資料層(不含 transport)

對應 spec 「agent 可查詢讀者目前的閱讀狀態」「agent 可列出目前 workspace 可播放的導讀」兩個 Requirement。

- [x] 3.1(AFK, TDD)新增純函式 `buildCurrentStepSnapshot()`(建議放 `src/currentStepSnapshot.ts`,同 `askAgentPrompt.ts` 的抽法):輸入 `currentWalk`/`currentWalkPath`/`stepIndex`/`anchorStatus`/`workspaceRoot`(型別同 `buildAskAgentPrompt` 的參數),輸出 design.md 決策 5 定義的 `CurrentStepSnapshot`(`active: false` 或帶完整欄位)。行號一律走既有 `effectiveLineRange()`,路徑一律走 1.1 的 `toPromptPath()`。測試涵蓋:有作用中導讀、無作用中導讀(`active: false`)、位移步驟採新行號、失準步驟如實回報 `anchorStatus: 'stale'`。
- [x] 3.2(AFK)在 `WalkPlayerViewProvider` 新增 `public getCurrentStepSnapshot()`:組好 3.1 函式需要的參數後呼叫它,不含額外邏輯。
- [x] 3.3(AFK, TDD)新增純函式(實作放獨立檔案 `src/agentWalkList.ts`)把 `WalkFileSummary[]`(`listWalkFiles()` 的回傳)轉成 `codewalk_list_walks` 的回傳形狀(`{ walks: Array<{ path, title }> }`),`path` 經 1.1 的相對路徑換算。測試涵蓋:有導讀時的欄位篩選與路徑轉換、空陣列時回傳空清單。

## 4. MCP server:transport、探索機制、生命週期

對應 design.md 決策 1-4、9,spec 「查詢介面不啟動於沒有 workspace 的視窗」「同一個 workspace 被多個視窗同時開啟時⋯」「查詢介面與面板既有播放行為互不影響」三個 Requirement。

- [x] 4.1(HITL)`package.json` 新增 `@modelcontextprotocol/sdk` 依賴,跑一次 `pnpm build` 確認 esbuild 能正常打包進 `dist/extension.js`。
  - **實作筆記**:`pnpm build` 乾淨通過,`dist/extension.js` 從既有的體積成長到 ~873KB(含 SDK)。這是 Node 端 bundle,不影響 webview 那份已知的 2.6MB 瓶頸。兩個工具都是零參數,沒用到 zod schema,沒有額外依賴。
- [x] 4.2(AFK, TDD)純函式:`computeDiscoveryFilePath(workspaceRoot)`(組出 `{tmpdir}/codewalk-mcp/{hash}.json` 路徑,hash 演算法見 design.md 決策 3)。測試涵蓋:同路徑輸入穩定得到同一個 hash、不同路徑得到不同 hash。
- [x] 4.3(AFK)新增 `src/mcpServer.ts`:用 `@modelcontextprotocol/sdk` 建立 MCP server,註冊 `codewalk_current_step`(呼叫 3.2)與 `codewalk_list_walks`(呼叫 3.3)兩個唯讀工具,掛 Streamable HTTP transport、`listen(0)` 取得動態 port。提供 `startMcpServer(provider, workspaceRoot)`/`stopMcpServer()` 兩個對外函式。
- [x] 4.4(AFK)在 `mcpServer.ts` 實作啟動流程:讀 4.2 算出的探索檔路徑 → 若存在,對記錄的 port 打一次短逾時的 `GET /health` → 活著就 `vscode.window.showInformationMessage` 通知並跳過啟動;沒反應(逾時/連線被拒/檔案不存在)就正常啟動、`listen(0)` 後把 `{port, pid}` 寫入探索檔。`stop()` 關閉 HTTP server 並盡力刪除自己寫入的探索檔(try/catch 吞掉失敗)。涵蓋 scenario「第二個視窗開啟時,第一個視窗的服務仍在運作」「前一個視窗異常結束後,新視窗接手服務」。
- [x] 4.5(AFK)`extension.ts`:`workspaceFolders[0]` 存在時才呼叫 `void startMcpServer(...).catch(() => {})`(fire-and-forget,不擋 `activate()`);`deactivate()` 從空函式改為呼叫並回傳 `stopMcpServer()`。涵蓋 scenario「視窗沒有已開啟的 workspace」「查詢介面啟動失敗時,面板功能不受影響」。

## 5. 文件收尾

- [x] 5.1(HITL)更新 `docs/future-work.md` 第 2 項狀態(URI handler 與 MCP pull 已完成,MCP push 仍列為後續);簡短說明 agent 開發者怎麼連上這個 MCP server(探索檔路徑、兩個工具的用途)——放進 `docs/` 既有慣例的位置,篇幅精簡,不寫成完整教學文件。

## 6. 驗證通過

- [x] 6.1(HITL)`pnpm test`(349 通過)、`pnpm typecheck`、`pnpm format:check`、`pnpm build` 全部通過;`pnpm relocate-anchors` 確認 repo 自身兩份導讀相符,無需 `--write`。手動驗證改走 `.vsix` 正式安裝(而非 Extension Development Host——手動驗證過程發現使用者環境的 `--extensionDevelopmentPath` 因第三方工具 `vscode-custom-css` 而失效,詳見 design.md 決策 10 的偵錯記錄),checklist:
  - [x] URI 開啟導讀(不帶 step / 帶 step / step 超出範圍)分別驗證停在正確步驟
  - [x] 面板本次 session 未開啟過時觸發 URI,確認面板正確建立並載入(不是空白或列表畫面)——**手動驗證發現並修正了真正的根因(`activationEvents` 缺 `"onUri"`,design.md 決策 10)**
  - [x] 面板已開啟並瀏覽中時觸發指向另一份導讀的 URI,確認立即切換
  - [x] 沒有開啟 workspace 的視窗觸發 URI,確認顯示明確錯誤(全螢幕 loadError,非 toast)、不嘗試絕對路徑解讀
  - [x] `walk` 指向不存在的檔案,確認顯示「找不到檔案」錯誤畫面而非無反應(手動驗證發現並修正:`loadWalk()` 原本沒包 try/catch,`readFile` 對不存在的檔案直接 throw,見 tasks.md 1.1 實作筆記)
  - [x] `walk` 帶 `../` 試圖逸出 workspace,確認顯示明確錯誤、不讀取 workspace 外的檔案
  - [x] 用 MCP Inspector 連上探索檔記錄的 port,呼叫 `codewalk_current_step`——分別在「有作用中導讀」「導讀列表畫面」兩種情況下驗證回傳內容
  - [x] 呼叫 `codewalk_list_walks`,確認清單內容與面板列表畫面一致
  - [x] 開兩個視窗指向同一個 workspace(用不同 `--user-data-dir` 強制開出獨立視窗測試),確認第二個視窗顯示「已有其他視窗提供服務」通知、探索檔 port 未被覆蓋、第一個視窗的 MCP server 仍可正常查詢
  - [x] 關閉第一個視窗後開新視窗,確認新視窗能正常接手啟動 MCP server(port/pid 換新,不需手動介入)
  - [x] 沒有 workspace 的視窗確認 MCP server 未啟動,且面板既有功能(瀏覽、切換步驟、quiz)不受影響
