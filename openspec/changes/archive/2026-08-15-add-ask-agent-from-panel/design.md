## Context

面板目前是**單向**的:能把讀者送到程式碼(`revealCurrentStep`、`jumpToSnippet`),不能把讀者的疑問送出去。走讀畫面上讀者能做的每個動作都在改變自己的閱讀狀態,沒有一個是「把手上的東西交出去」。

既有可沿用的元件:

| 元件 | 可沿用之處 |
|---|---|
| `copyRegenerateHint` 訊息 + `handleCopyRegenerateHint()` | 「webview 送意圖 → host 寫剪貼簿」的完整寫法,`vscode.env.clipboard.writeText` 已在用 |
| `effectiveLineRange()`(`shared/protocol.ts`) | 位移後的有效行號,面板顯示與編輯器跳轉已共用同一份 |
| `AnchorReport` / `AnchorStepReport` | 錨定狀態現成,載入時已算好放在 `viewProvider.anchorReport` |
| `codewalk-reveal-step` 按鈕(`ui/render/walking.ts:163`) | 「對這一步做點什麼」的既有按鈕樣式與位置,新入口與它同性質 |
| `shared/i18n.ts` 的 `t()` | host 與 webview 共用同一份翻譯表 |

三個關鍵約束:

1. **webview 禁碰 `vscode` API** —— 選取文字在 webview,workspace 根目錄與命令執行在 host,prompt 必須跨接縫組裝
2. **面板很窄** —— VS Code 側邊欄預設約 300px,浮出層的水平空間極為有限
3. **走讀畫面的鍵盤事件目前會吃掉選取操作** —— `ui/main.ts:414` 起的 keydown 未檢查修飾鍵,Shift+方向鍵會觸發跳步驟

## Goals / Non-Goals

**Goals:**

- 讀者不必離開面板、不必重述脈絡,就能把「我卡在這一步的這個地方」交給自己的 AI
- 對「有 IDE 內建 chat」與「在終端機跑 agent」兩種讀者**同等有效**,不是主路徑加退路
- prompt 短到讀者願意在送出前讀完並修改
- 之後 `add-mcp-bridge` 上線時,**prompt 形狀與讀者體驗都不需要改變**
- 不新增任何外部依賴、不動 `.codewalk.json` 格式合約

**Non-Goals:**

- 不做能力偵測、設定項、偏好記憶
- 不接收 agent 的回覆——送出即斷
- 不處理 quiz 作答中與 quiz 結果畫面的追問
- 不新增快捷鍵
- 不改 `copyRegenerateHint` 現有的靜默行為

## Decisions

### 決策 1:prompt 帶指標,不帶 narration

prompt 給出**導讀檔路徑 + 步驟索引**,讓 agent 自己去讀,而不是把 narration 全文塞進去。

實測本 repo 兩份導讀共 48 步:

| | 中位數 | p90 | 最長 |
|---|---|---|---|
| 繁中 narration | 545 字元 | —— | 806 |
| 英文 narration | 1305 | 1574 | 1816 |

全帶會讓 chat 輸入框需要捲動才看得完,而 `isPartialQuery: true`(決策 4)的整個用意是**讓讀者看得到、能修改**——塞滿等於白設。

**「agent 可能讀不到那個檔」不構成反對理由**:prompt 裡的 `src/viewProvider.ts:45-52` 本來就是指標而非內容,讀不到導讀檔的 agent 同樣讀不到原始碼檔案,這個功能對它整體是壞的。為一個已經壞掉的情境加長 prompt 沒有收益。

反過來,agent 照路徑讀進去拿到的比我們塞的更多:整段 narration、`terms`、`items`、前後步全在。

**考慮過的替代方案**:

- *帶整步 narration* —— 自足、不依賴檔案存取。但如上,那個獨立性是假的
- *帶 narration 但超長時截斷* —— 截在哪都是武斷值,而且會攔腰切斷 markdown

**這也是 MCP 的低成本前身**:`add-mcp-bridge` 上線後只是把「檔案路徑 + 步驟索引」換成 `codewalk_current_step`,prompt 形狀不變。

### 決策 2:prompt 骨架用**介面語言**,不固定英文

`interface-localization` 已經劃過這條界:**診斷輸出固定英文,介面文案隨顯示語言**(`shared/schema.ts` 的驗證錯誤是前者)。

prompt 是讀者要**讀、要改、要按送出**的東西——它是介面文案,不是診斷輸出。所以骨架(「我正在讀⋯」「我不懂的是⋯」「請先讀⋯再解釋」)經 `t()`,由 `shared/i18n.ts` 提供繁英兩份。

嵌進去的內容(步驟標題、選取文字)自然保持導讀本身的語言,不翻譯。繁中介面播英文導讀時 prompt 會是中文骨架 + 英文內容——這是正確的,因為骨架說的是**讀者的話**,內容是**導讀的話**。

### 決策 3:prompt 由 host 組裝,抽成 `src/askAgentPrompt.ts` 純函式

webview 拿不到 workspace 根目錄(算不出相對路徑),也不該持有組裝規則。

抽成獨立檔案而非塞進 `viewProvider` 的理由:**它是這個功能唯一值得單元測試的邏輯**——輸入 walk、stepIndex、選取文字、錨定狀態、workspace 根目錄,輸出字串;`viewProvider` 碰 `vscode` API 不好測。

簽章大致:

```ts
buildAskAgentPrompt(input: {
  walk: CodewalkFile;
  walkPath: string;          // 絕對路徑
  workspaceRoot: string | undefined;
  stepIndex: number;
  stepStatus: AnchorStatus;
  selection?: string;        // 沒有框選時省略
}): string
```

### 決策 4:一律 `isPartialQuery: true`,只填入不送出

```ts
await vscode.commands.executeCommand('workbench.action.chat.open', {
  query: prompt,
  isPartialQuery: true,
});
```

兩個理由:

1. **Cursor 本來就不自動送**(即使 2.3+ 也只填入)。設 `true` 讓兩個編輯器行為一致,不必為此分歧寫兩套說明
2. 讀者送出前通常想補一句「我卡的是 X 那部分」——自動送出剝奪這個機會,而這正是決策 1 讓 prompt 保持短的原因

### 決策 5:不預先偵測命令,用 try/catch 退回剪貼簿

```ts
try {
  await vscode.commands.executeCommand('workbench.action.chat.open', { ... });
  outcome = 'chat';
} catch {
  await vscode.env.clipboard.writeText(prompt);
  outcome = 'chatUnavailable';
}
```

**考慮過** `vscode.commands.getCommands(true)` 預先檢查:為了一顆按鈕去取回數千筆命令 ID 不划算,而且它只答得出「命令存不存在」,答不出「執行失敗」。try/catch 兩種都涵蓋。

命令不存在的實際情境:Cursor 2.3 以前、其他 VS Code fork。

### 決策 6:必須新增 host → webview 訊息(修正 proposal)

proposal 寫「不新增 host → webview 訊息,這是單向動作」。**那是錯的**,決策 5 讓它站不住:

送進 Chat 失敗而退回剪貼簿時,如果 webview 只做樂觀顯示,讀者按了按鈕會看到「已送出」但 chat 什麼都沒發生,而剪貼簿裡其實已經有東西了——**最糟的一種失敗:靜默且誤導**。

所以新增:

```ts
| { type: 'askAgentResult'; outcome: 'chat' | 'clipboard' | 'chatUnavailable' | 'failed' }
```

| outcome | 何時 | webview 顯示 |
|---|---|---|
| `chat` | 命令執行成功 | 不特別提示——chat 面板自己會跳出來,那就是回饋 |
| `clipboard` | 讀者按了「複製提問」 | 按鈕文字暫時變「已複製」 |
| `chatUnavailable` | 命令不存在或失敗,已改寫剪貼簿 | 明確告知「這個編輯器沒有可用的 Chat,已改為複製到剪貼簿」 |
| `failed` | 連剪貼簿都失敗 | 錯誤提示 |

**`failed` 這條路徑是刻意不寫單元測試的**(驗證階段曾列為 WARNING,這裡記錄結論而非默默略過)。`writeAskAgentClipboard()` 活在 `WalkPlayerViewProvider` 裡,跟這個類別的其他方法一樣依賴真實 `vscode` API——類別頂端的 JSDoc 已經寫明「幾乎所有方法都需要真實的 vscode API,無法在 Vitest 環境測試」,而且專案從未替 `vscode` 模組設 mock(`decisions.md` 的檔案組織決策刻意把可測邏輯抽成 `anchorCheck.ts`/`webviewReadyPlan.ts`/`walkLoader.ts` 這類不碰 `vscode` 的模組,而不是反過來替 `vscode` 建 mock)。這條分支本身只是「try/catch 再 post 一則訊息」,沒有值得抽出來的邏輯,為它單獨引入 mock 基礎設施不符合這個專案一貫的權衡。**這是接受的殘餘風險,不是遺漏。**

### 決策 7:單一訊息帶 `destination`,不拆兩則

```ts
| { type: 'askAgent'; destination: 'chat' | 'clipboard'; selection?: string }
```

**考慮過**依既有慣例(`copyRegenerateHint`、`revealCurrentStep` 都是一意圖一則)拆成兩則訊息。不採用:兩則的 payload 完全相同、`parseWebviewToHostMessage` 會有兩個逐字重複的分支、host 端 prompt 組裝要呼叫兩次。**意圖本來就是同一個(把這一步交出去),差別只在送到哪。**

`selection` 省略即代表「問整步」——不需要另一個布林欄位。

### 決策 8:固定入口與 `codewalk-reveal-step` 並列成一組步驟動作

位置在檔案行號那行之後、narration 之前,與既有的「回到本步位置」按鈕相鄰。

理由:兩者同性質(**對這一步做點什麼**,不是改變閱讀狀態),而且該位置在版面上緣,長 narration 時不必捲動就看得到。

**考慮過**放在 narration 之後(讀完才會想問)。不採用:narration 中位數 545 字,按鈕會落在摺線以下,可發現性反而更差——而可發現性正是設固定入口的唯一理由(浮出式入口的問題就是沒人知道它存在)。

### 決策 9:浮出層垂直跟隨選取、水平固定貼齊容器左緣

面板約 300px 寬,兩顆按鈕橫排已接近極限。若水平追隨游標,靠右選取時必然溢出,得再寫一套 clamp 邏輯。

**貼齊左緣**讓水平位置成為常數,只算垂直——用 `Range.getBoundingClientRect()` 的 `bottom`。代價是滑鼠可能要多移動一點,但那正是固定入口存在的意義:大部分情況讀者根本不需要浮出層。

浮出層是**暫態**,不進 `PersistedUiState`——面板重建後不還原,重新選取即可。

**實作時修正(手動驗證發現)**:顯隱不能用 `hidden` 屬性。`hidden` 是靠瀏覽器內建的 `[hidden] { display: none }` 生效,但 `theme.css` 對 `.codewalk-ask-agent-popup` 這個 class 自己也設了 `display`——同優先度下作者樣式表永遠贏過瀏覽器內建樣式,會讓 `hidden` 完全失效(浮出後永遠消不掉,實測正是這個症狀)。改用行內 `style.display` 控制,行內樣式的優先度贏過任何 class 規則,徹底避開這個衝突。**這個坑值得記住**:任何時候一個元素同時被 CSS class 設定 `display` 又想用 `hidden` 屬性切換顯隱,都會踩到同一個問題。

### 決策 10:只在走讀畫面觸發

`document.addEventListener('selectionchange')`,但只在 `current.screen === 'walking'` 時處理。

- `fileList` —— 沒有值得問的脈絡
- `quiz` —— 作答中問 AI 等於拆掉 quiz 的存在理由(見 `openspec/decisions.md` quiz 定位)
- `quizResult` —— 有價值但 prompt 組成不同(要帶題目、選項、讀者答案與正解),屬另案

### 決策 11:keydown 改為「任一修飾鍵按下就不攔截」

不是只放行 `shiftKey`:

```ts
if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
```

Shift+方向鍵是逐字選取,Cmd/Alt+方向鍵是跳行首行尾與逐詞移動,Shift 加上它們是成段選取——**這些全都是選取操作**,逐一列舉會漏。既有的方向鍵、Escape、Home、`r`/`R` 在無修飾鍵時行為完全不變。

**考慮過**改為「有非空選取時不攔截」。不採用:選取存在時讀者仍可能想按方向鍵翻步驟,而且判定時序脆弱(keydown 發生在 selection 更新之前)。

### 決策 12:導讀檔路徑算不出相對路徑時退回絕對路徑

`path.relative(workspaceRoot, walkPath)` 結果以 `..` 開頭(或沒有 workspace)時,prompt 直接帶絕對路徑。

agent 有檔案系統存取,絕對路徑一樣讀得到。**考慮過**改帶 narration 全文——那會產生第二種 prompt 形狀,為了一個罕見情境把組裝邏輯變成兩套,不划算。

路徑一律正規化為正斜線(Windows 下 `path.relative` 回傳反斜線,而導讀檔內的 `file` 欄位本來就是正斜線,混用會讓 prompt 看起來像兩個不同的專案)。

### 決策 13:`stale` 時在 prompt 內明說

錨定狀態為 `stale` 時加一行「這段程式碼在導讀產出後已被改動,導讀描述的內容可能與現況不符」。

沒有這行,agent 會照著導讀的敘述去讀現在的檔案,得出一個**很有自信的錯答案**——這比答不出來更糟。

`shifted` 不需特別說明:行號已經過 `effectiveLineRange()` 換算,agent 拿到的就是現在的正確位置。`unanchored` 也不說——那只代表導讀沒提供 anchor,不代表內容有問題。

## Risks / Trade-offs

| 風險 | 緩解 |
|---|---|
| Cursor 的 `workbench.action.chat.open` 支援是 2.3(2026-01)才加的,更早的版本按了會落到剪貼簿 | 決策 5、6 讓它變成**明確告知的降級**而非靜默失敗;而剪貼簿本來就是等價出口,不是懲罰 |
| **Chat 面板冷啟動吃掉 query**(手動驗證發現,非設計階段預見):這個 VS Code session 第一次開啟 Chat 面板時,`workbench.action.chat.open` 的 Promise 常在 Chat 自己的 webview 真正掛載完成前就 resolve,`query` 因此沒被套用——讀者要點兩次才生效,第二次以後都正常 | `chatWarmedUp` 旗標:只在 provider 生命週期的第一次呼叫額外等待 400ms 後補送一次,之後的呼叫不受影響。冷啟動當下面板連可互動的輸入框都還沒掛出來,補送不會蓋掉讀者已輸入的內容。這是時序上的務實補救,不是根治——VS Code 沒有 API 能讓 extension 得知「Chat webview 真的準備好接收輸入」 |
| 讀者的 chat 若處於不會主動讀檔的模式,拿到指標卻讀不進去 | 無法從 extension 端控制。prompt 內明寫「請先讀那份導讀的 steps[N]」是最強的可用手段;真正的解法是 `add-mcp-bridge` |
| `selectionchange` 在拖曳選取過程中高頻觸發 | 浮出層只在事件中更新位置與顯隱,不重繪整個畫面;必要時加一層 `requestAnimationFrame` 節流 |
| 修正 keydown 修飾鍵後,原本「按住 Shift 連續翻步驟」的使用者會覺得壞了 | 該行為從未被規範,且與選取直接衝突;無修飾鍵的翻頁完全不變 |
| 面板寬度極窄(讀者把側邊欄拉到最小)時兩顆按鈕塞不下 | 決策 9 已避開水平溢出;按鈕在極窄時折行,不橫向捲動 |

## Migration Plan

無資料遷移——不動 `.codewalk.json`、不動 `workspaceState`、不新增依賴。

回退方式是移除新增的訊息分支與 UI;決策 11 的 keydown 修正**應獨立保留**,它修的是既有缺陷,與本功能是否上線無關。

## Open Questions

1. **固定入口的按鈕文案** —— 繁中暫定「問 AI」。要不要更明確(如「拿這一步問 AI」)得看實際版面寬度
2. **`chatUnavailable` 的提示顯示在哪** —— 沿用 `stepJumpError` 的面板內警告樣式,還是走 `vscode.window.showInformationMessage`?前者一致但會佔走讀畫面版面
3. **浮出層要不要在選取範圍很長(跨多個段落)時改變定位策略** —— 貼齊選取結尾可能落在畫面外
4. **prompt 的步驟索引寫法** —— `第 7 步(steps[6])` 同時給人看的序號與給 agent 用的索引,略顯囉嗦但兩者都需要;是否有更乾淨的寫法待實作時看
