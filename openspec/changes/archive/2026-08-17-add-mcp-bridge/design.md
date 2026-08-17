## Context

`add-ask-agent-from-panel`(已上線)補了「讀者主動框選 → 送給 agent」這一半。這個 change 補剩下的兩半:**agent 產完導讀後自己開面板**(URI handler),以及**agent 主動查詢讀者目前讀到哪**(MCP pull)。兩者共用同一個前提——狀態(目前導讀、目前步驟、錨驗證結果)全部活在執行中的 `WalkPlayerViewProvider` 記憶體裡,兩個新機制都是「從外部把這份既有狀態接出去」,不新增狀態來源。

`openspec/decisions.md` 已定案技術路徑走 MCP、不走 `languageModelTools`;proposal.md 的 5 題 Open Questions已有方向。本文件把方向展開成具體元件與資料結構。

## Goals / Non-Goals

**Goals:**

- agent 可以用一個 `vscode://` URI 直接開啟指定導讀、跳到指定步驟
- agent 可以用標準 MCP 工具查詢讀者目前的閱讀狀態(唯讀)
- agent 可以用標準 MCP 工具列出目前 workspace 有哪些導讀
- MCP server 啟動失敗、找不到 workspace、埠被占用等情況都不影響面板本身的既有功能

**Non-Goals:**

- MCP push(`notifications/*` 主動通知)——`decisions.md` 已定案為加分而非前提
- 任何寫入類工具(agent 操控面板跳步、修改導讀內容)
- 真正的跨視窗鎖機制——多視窗協調只做健康檢查 + 通知,不做搶鎖、心跳、自動接管
- Cursor 對 `vscode://` scheme 的相容性驗證超出「機制存在、命令可執行」以外的細節

## Decisions

### 1. MCP 傳輸層:extension 內嵌的 Streamable HTTP,不是 agent 端 spawn 的 stdio

狀態活在執行中的 extension host 記憶體裡。stdio 由 agent 端 spawn 的話,起的是全新、獨立的 process,跟正在跑的 extension host 沒有共用記憶體,得再繞一層跨 process 溝通(檔案或 socket)才拿得到即時狀態——等於自己重新發明 HTTP。改用 **`@modelcontextprotocol/sdk`(官方 TypeScript SDK)的 Streamable HTTP transport**,server 由 extension 自己 `listen()`,直接持有 `WalkPlayerViewProvider` 的參照。

**沒有已開啟的 workspace 時,MCP server 不啟動。** 決策 3 的探索檔是依 workspace 路徑算 hash 命名,沒有 workspace 就沒有東西可 hash;`codewalk_current_step`/`codewalk_list_walks` 的資料來源(`getWorkspaceRoot()`)也全部依賴它,跟現有 `progressStore`/`attemptStore`/`anchorReport` 同一個既有的 gating 慣例一致。這不需要任何使用者可見的錯誤提示——探索檔不存在,agent 端本來就連不上,是自然的「不可用」狀態,不必額外設計一套「MCP 不可用」的通知。

**新依賴**:`@modelcontextprotocol/sdk`。這是這個 change 唯一新增的 npm 套件——手刻 MCP 的 JSON-RPC framing 是不小的協定面,官方 SDK 已經把 transport 層做好,跟現有 `marked`/`shiki` 這類「挑現成套件而非重造輪子」的慣例一致。

### 2. Port 選定:OS 動態分配,不用固定 port

`server.listen(0)` 讓 OS 給一個目前空閒的 port,而不是硬編一個固定號碼。理由:多個不同 workspace 各自開視窗時,固定 port 一定衝突;動態 port 天生不會撞號,代價是 agent 端得有辦法「發現」這個 port——見決策 3。

### 3. 探索機制:每個 workspace 一份探索檔

```
{os.tmpdir()}/codewalk-mcp/{sha256(workspaceRoot).slice(0, 16)}.json
{ "port": number, "pid": number }
```

Server 開始監聽後寫入;extension 停用時盡力刪除自己那份(見決策 9)。agent 端要連線時,自己算出目前工作的 workspace 路徑 hash,讀對應探索檔拿 port——不同 repo 各自開視窗時天生沒有交集,不需要額外協調。

### 4. 同一 workspace 雙開時:health check 決定覆蓋或通知,不做搶鎖

新視窗啟動 MCP server 前,先讀探索檔(若存在)→ 對記錄的 port 打 `GET /health`(短逾時,如 300ms)：

- **活著**:判定另一個視窗已經在為這個 workspace 服務,**不啟動自己的 server、不覆蓋探索檔**,用 `vscode.window.showInformationMessage` 通知讀者一次(不是靜默放棄——proposal 明確要求「不想默默被覆蓋沒有通知」)
- **沒反應**(逾時、連線被拒、或檔案根本不存在):視為殭屍記錄或首次啟動,直接覆蓋、正常啟動,不需通知(自我修復,不是异常)

不做的部分:不輪詢、不心跳、不提供「接管」的手動指令。真的要切換,讀者自己關掉前一個視窗,下次啟動任一視窗時 health check 就會判定殭屍並自動接手。

### 5. `codewalk_current_step`:直接讀 `WalkPlayerViewProvider` 的既有狀態,不重算

新增一個公開方法:

```ts
// src/viewProvider.ts
public getCurrentStepSnapshot(): CurrentStepSnapshot
```

```ts
type CurrentStepSnapshot =
  | { active: false }
  | {
      active: true;
      walkPath: string;      // workspace 相對路徑,見 toWorkspaceRelativePath()
      walkTitle: string;
      stepIndex: number;     // 0-based,與 steps[N] 慣例一致
      stepTitle: string;
      file: string;
      startLine: number;     // 經 effectiveLineRange() 換算的有效行號,與面板顯示一致
      endLine: number;
      anchorStatus: 'matched' | 'shifted' | 'stale' | 'unanchored';
    };
```

沒開任何導讀時回傳 `{ active: false }`(proposal 已定案,合法狀態不是錯誤)。行號一律走既有 `effectiveLineRange()`——這是第三處用到這個函式(面板顯示、`askAgentPrompt.ts`、現在加上 MCP),不另開一套算法。

**實作階段修正**:`src/workspacePath.ts` 早就存在(`798a6de`,`resolveInWorkspace()`,把導讀 `file` 欄位的相對路徑解成絕對路徑並擋 `..` 逸出),proposal Impact 表寫的「於此補齊」猜對了檔名但猜錯了狀態。`askAgentPrompt.ts` 原本私有的 `toPromptPath()`(反方向:絕對路徑換成 workspace 相對路徑)已搬進這支既有檔案、更名為 `toWorkspaceRelativePath(workspaceRoot, absolutePath)`,跟 `resolveInWorkspace(workspaceRoot, file)` 放一起——兩者互為反方向,同一個 workspace 邊界問題,沒有理由分兩個檔案。

MCP tool handler(在 `src/mcpServer.ts`)只是把 `provider.getCurrentStepSnapshot()` 的結果包成 MCP tool response,沒有自己的業務邏輯。

### 6. `codewalk_list_walks`:包一層既有的 `listWalkFiles()`

```ts
// 回傳形狀,對應 WalkFileSummary 但只取 agent 用得到的欄位
{ walks: Array<{ path: string; title: string }> }
```

`src/walkLoader.ts` 的 `listWalkFiles()` 已經是這份清單的唯一資料來源(webview 列表畫面也是靠它),MCP tool 直接呼叫,不重新掃描 `.codewalk/`。`path` 一樣換算成 workspace 相對路徑,理由同決策 5。

### 7. URI handler:`vscode://{publisher}.{name}/open?walk=<相對路徑>&step=<0-based 索引,選填>`

```ts
vscode.window.registerUriHandler({
  handleUri(uri) {
    if (uri.path !== '/open') return;
    const params = new URLSearchParams(uri.query);
    const walk = params.get('walk');
    if (!walk) return;
    const stepParam = params.get('step');
    const stepIndex = stepParam !== null ? Number(stepParam) : undefined;
    void provider.openWalkFromUri(walk, stepIndex);
  },
});
```

`walk` 一律解讀為 workspace 相對路徑,與 `getCurrentStepSnapshot()`/`codewalk_list_walks` 回傳的格式對稱——agent 從 `codewalk_list_walks` 拿到的 `path` 可以直接原樣塞進這個 URI,不必自己再做路徑轉換。沒有已開啟的 workspace 時,`openWalkFromUri` 顯示一則 `vscode.window.showErrorMessage`(不是靜默失敗——與 `ask-agent` capability「不可用時明確告知」的既有原則一致),不嘗試用絕對路徑退路(agent 產完導讀時一定知道自己在哪個 workspace 底下產的,沒有 workspace 這件事本身就是異常狀態,不是「檔案剛好在外面」那種正常情況)。

**實作階段修正**:`walk` 是外部程序傳進來的字串,不是 `.codewalk.json` 內部欄位——`resolveInWorkspace()` 現成擋 `..` 逸出與絕對路徑注入的第二層防護(見 `src/workspacePath.ts` 的既有 docstring),這裡直接重用,不再用素樸的 `join(root, relativePath)`。解析失敗(`resolveInWorkspace()` 回傳 `null`)比照「`walk` 指向不存在的檔案」同一條錯誤路徑處理,不需要另外設計錯誤訊息——對讀者來說兩者都是「這個 URI 給的路徑不對」。

### 8. URI 觸發開啟時,面板可能還沒建立過——`pendingOpenRequest` 補上這段空窗

`loadWalk()` 靠 `this.post()` 把載入結果送給 webview,而 `post()` 沒有佇列——webview 的訊息監聽還沒掛上時送出的訊息會直接遺失(現有 `webviewReady` → `sendRestoreIfActive()` 這條路本來就是為了處理「面板重建後怎麼補回狀態」而存在的同一類問題)。URI handler 觸發開啟時比照辦理:

```ts
// src/viewProvider.ts
private pendingOpenRequest: { path: string; stepIndex?: number } | undefined;

public async openWalkFromUri(relativePath: string, stepIndex?: number): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage(t('host.noWorkspace'));
    return;
  }
  const absPath = resolveInWorkspace(root, relativePath);
  if (!absPath) {
    vscode.window.showErrorMessage(t('host.noWorkspace')); // 實際文案見任務 2.3,錯誤原因不同、訊息需另擬
    return;
  }
  if (this.view) {
    // 面板這個 session 已經建立過,webviewReady 不會再觸發一次,直接載入
    await this.loadWalk(absPath);
    if (stepIndex !== undefined) await this.setStep(stepIndex);
  } else {
    this.pendingOpenRequest = { path: absPath, stepIndex };
  }
  void vscode.commands.executeCommand(`${WalkPlayerViewProvider.viewId}.focus`);
}
```

`webviewReady` 的 handler 多一個分支:有 `pendingOpenRequest` 就消費它(`loadWalk` + 選填的 `setStep`)、清空欄位,取代原本的 `sendRestoreIfActive()`——URI 明確指定了要開哪份導讀,不該被「上次讀到哪」蓋過去。

### 9. Extension 生命週期:MCP 啟動不擋 `activate()`,失敗不影響其他功能

`extension.ts` 的 `activate()` 目前是同步函式、沒有 async 工作。MCP server 的啟動(含決策 4 的 health check,一次網路往返)是 fire-and-forget:

```ts
export function activate(context: vscode.ExtensionContext): void {
  // ...既有註冊...
  const uriHandler = vscode.window.registerUriHandler({ handleUri: (uri) => provider.handleOpenUri(uri) });
  context.subscriptions.push(uriHandler);

  void startMcpServer(provider, context).catch(() => {
    // MCP 是加分不是前提(proposal.md、decisions.md 已定案)——啟動失敗
    // 不影響面板本身的任何既有功能,也不用任何形式的錯誤提示打斷讀者。
  });
}
```

`deactivate()` 從空函式改成呼叫 `stopMcpServer()`(關 HTTP server + 刪自己的探索檔,best-effort,失敗吞掉)——這是本專案第一個需要真正清理邏輯的 `deactivate()`,因為探索檔活在 `os.tmpdir()`,不是 VS Code 會自動回收的資源(`context.subscriptions` 只管得到 extension 自己註冊的 disposable)。

### 10. `package.json` 的 `activationEvents` 必須明確列出 `"onUri"`

**手動驗證發現的問題**(不在原本的決策清單內,過程見下方偵錯記錄):第一次觸發 URI 時,面板完全沒反應,連錯誤訊息都沒有;但「先手動點開 CodeWalk 面板、再觸發 URI」就完全正常。一開始誤判為「側邊欄沒有實際切過去」,依此假設嘗試了三版修法(`<view>.focus` 延遲重送、`workbench.view.extension.<container>`、`WebviewView.show()`),手動驗證後確認**全部無效**——因為診斷方向從一開始就錯了。

**真正的根因**:`package.json` 的 `activationEvents` 是空陣列。VS Code 會從 `contributes`(`views`、`commands`)推論隱含的啟動事件,但 `registerUriHandler` 是在 `activate()` 內動態呼叫的,`contributes` 沒有對應的宣告可以推論——**VS Code 沒有任何理由在 URI 抵達時啟動這個 extension**。這個 session 若還沒被別的途徑啟動過(手動開過面板 → 觸發 `contributes.views` 推論出的 `onView:codewalk.playerView`;或執行過任一指令 → 觸發 `onCommand:*`),`activate()` 從未執行,`registerUriHandler` 從未註冊,URI 事件無處可去——完全解釋「去過一次面板就正常」的模式,跟側邊欄視覺切換與否無關。

**修法**:`activationEvents` 改為 `["onUri"]`,明確告訴 VS Code「收到 `vscode://` URI 時啟動我」。三版側邊欄修法連帶還原成最簡單的單次 `<view>.focus` 呼叫——根因修好後,extension 在 URI 抵達前就已啟動、`registerWebviewViewProvider()`/`registerCommand()` 都已在同一次同步的 `activate()` 內完成註冊,不再有「view 剛建立、command 還沒就緒」這回事,不需要任何補送或延遲。

**偵錯記錄(給日後看不懂為什麼決策文件這麼長的人)**:這個問題花了一整個下午,大半時間耗在「怎麼看到 log」而非「log 說了什麼」——F5 搭配 `.vscode/launch.json` 一直開出沒有 workspace 的空白視窗(該檔案的 `args` 原本漏了 `${workspaceFolder}` 這個純位置參數,只給了 `--extensionDevelopmentPath`,已一併修正)、`code --extensionDevelopmentPath=X X` 這個 CLI 因為使用者裝了 `vscode-custom-css`(修改 VS Code 本體檔案的第三方工具)导致命令列參數被忽略、只開出一般視窗。最後改用寫檔案的暫時性 `debugLog()`(不依賴任何 VS Code UI)並打包成 `.vsix` 正式安裝,才排除掉環境雜訊、看清楚 `activate()` 從未被呼叫這個事實。

## Risks / Trade-offs

- **[Risk]** 兩個視窗幾乎同時啟動同一個 workspace,都在對方寫入探索檔之前讀到「沒有記錄」→ 都各自起了 server,一個變成沒人連得到的孤兒 → **Mitigation**:不解——這個時間窗極窄(兩次 activate 剛好同一瞬間),真正的鎖機制(檔案鎖、重試協商)換來的複雜度不成比例,MVP 階段接受這個邊角案例
- **[Risk]** 讀者頻繁 reload 同一個視窗(開發時常見)→ 每次 reload 都是「先 deactivate(刪探索檔)再 activate(沒記錄,正常啟動)」,不會誤判成雙開 → **Mitigation**:不需要,деactivate 的探索檔清理已經避免了這個情境;只有兩個**同時活著**的視窗才會觸發通知
- **[Risk]** health check 這次網路往返增加 MCP 啟動的延遲 → **Mitigation**:整段包在決策 9 的 fire-and-forget 裡,不阻塞 `activate()` 本身,讀者感知不到
- **[Risk]** `os.tmpdir()` 是機器全域路徑,理論上可能被其他程式清空或占用同名目錄 → **Mitigation**:機率低到不值得處理;探索檔遺失的後果只是「這次啟動時的 health check 誤判成殭屍、正常覆蓋」,不是資料遺失
- **[Risk]** `@modelcontextprotocol/sdk` 是新依賴,增加 bundle 大小與供應鏈面 → **Mitigation**:MCP server 跑在 extension host(Node 環境),不進 webview bundle(2.6MB 那份已知瓶頸完全不受影響);供應鏈風險與現有 `marked`/`shiki` 同一等級,無特殊處理

## Migration Plan

不涉及任何資料格式遷移——`.codewalk.json` schema 不變、`workspaceState` 既有欄位不變。純新增元件,可安全地整支回退(移除 `src/uriHandler.ts` 相關程式碼、`src/mcpServer.ts`、`package.json` 的新依賴與 `extension.ts` 的兩處新增註冊),不留殘餘狀態。

## Open Questions

proposal.md 的 5 題已在上述決策中定案。實作過程中若浮現新的技術細節(如 MCP SDK 實際 API 用法的取捨),記錄在對應的 tasks 註記,不追加到本節。
