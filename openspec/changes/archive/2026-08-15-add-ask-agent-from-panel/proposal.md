# 從面板框選一段去問 AI

## Why

讀者在面板裡讀到看不懂的一句話——可能是 narration 的某個說法,也可能是 snippet 裡的一段程式碼——**現在唯一的出路是關掉面板,自己把脈絡重述一遍去問 AI**。

而重述脈絡恰恰是他做不到的事:他不懂才要問,不懂就講不清楚。他得自己說出「我在讀某份導讀的第 7 步,那步在講 `src/viewProvider.ts` 第 45 到 52 行,主題是⋯⋯」——**這些資訊 CodeWalk 全都在手上,讀者卻得靠記憶重打一次。**

導讀目前是單向的:面板能把讀者送到程式碼,不能把讀者的疑問送出去。這是 CodeTour 那個世代的工具結構上做不到的事(它誕生在沒有 agent 的年代),也是競品分析後確認 CodeWalk 少數能站住的差異點之一(見 `docs/competitive-analysis.md`)。

**為什麼是現在**:這件事不動 `.codewalk.json` 格式合約、不新增外部依賴、不需要讀者做任何設定,是整條 agent 橋接路線上**唯一可以獨立出貨**的一塊。後續的 `add-mcp-bridge` 會讓它更好,但不是它的前提。

## What Changes

### 面板側

- **走讀畫面固定一個「問 AI」入口**。主功能是「問這一步」,框選只是讓問題更精確——**這是一個功能兩種輸入,不是兩個功能**
  - 浮出式入口單獨存在的話可發現性等於零:讀者不會知道有這功能,除非碰巧框選
- 讀者框選文字時,可在游標附近浮出同一組按鈕(省去移動滑鼠);取消選取即消失
- 兩顆按鈕**並列**,不是主次關係:
  - **送進 Chat**(Send to Chat)—— 執行 `workbench.action.chat.open`,把組好的 prompt 填進 VS Code / Cursor 的 chat 輸入框
  - **複製提問**(Copy prompt)—— 把**同一段** prompt 寫進剪貼簿,給在終端機跑 agent 的讀者
  - 文案刻意寫「提問」而非「複製」:讀者框選了一段程式碼再按「複製」,會預期拿到那段程式碼,結果拿到一長串問句。這不是措辭美感,是**心智模型衝突**
- **不做能力偵測、不加設定項、不記憶偏好**。理由見下方 Out of Scope

### prompt 組成:帶指標,不帶內容

由 host 端組裝(webview 拿不到 `vscode` API,也不該持有組裝規則):

- 導讀檔的 **repo 相對路徑**與步驟索引(如 `.codewalk/2026-08-07-codebase-tour.codewalk.json` 的 `steps[6]`)
- 步驟序號與**步驟標題**——很短,但讓讀者掃一眼 prompt 就知道在問哪一步,不必回頭對
- 該步對應的 `file` 與行號
- **該步的錨定狀態**——`stale` 時註明「這段程式碼在導讀產出後已被改動」,否則 agent 會照著過時內容推論並給出很有自信的錯答案
- 讀者框選的那段文字(沒有框選時省略)
- 一句指示:請先讀那份導讀的該步再回答

**刻意不帶 narration 全文。** 實測本 repo 兩份導讀共 48 步:繁中 narration 中位數 545 字元、最長 806;英文中位數 1305、最長 1816。全塞進去會讓 chat 輸入框需要捲動才看得完,而 `isPartialQuery: true` 的用意正是**讓讀者看得到、能修改**——塞滿等於白設。

而「agent 可能讀不到那個檔」不構成反對理由:**prompt 裡的 `src/viewProvider.ts:45-52` 本來就是指標而非內容**,讀不到導讀檔的 agent 同樣讀不到原始碼檔案,這個功能對它整個是壞的。為一個已經壞掉的情況加長 prompt 沒有收益。

反過來,agent 照路徑讀進去拿到的**比我們塞的更多**:整段 narration、`terms`、`items`、前後步全在。

> 這也是 MCP「把手」模式的低成本前身——`add-mcp-bridge` 上線後只是把「檔案路徑 + 步驟索引」換成 `codewalk_current_step`,**prompt 的形狀與讀者體驗都不變**。

**行號必須經 `effectiveLineRange()` 換算**,不能直接用 JSON 裡記載的值——內容只是位移時該用偵測到的新行號。這與面板顯示、編輯器跳轉走的是同一份既有邏輯,不另立一套。

### 順帶修正:走讀畫面目前無法用鍵盤選字

`ui/main.ts` 的 keydown 處理沒有檢查修飾鍵:

```ts
if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
  event.preventDefault();
  onNextStep();
}
```

讀者按 **Shift+方向鍵想選取文字,會直接跳到下一步**。也就是說走讀畫面現在只能用滑鼠拖曳選字。本次必須修——否則「框選」這個前提在鍵盤上不成立。

### 送出行為

- 一律 `isPartialQuery: true`,**只填入不自動送出**。兩個理由:Cursor 本來就不自動送(即使 2.3+ 也只填入),設 `true` 讓兩邊行為一致;讀者送出前通常想補一句「我卡的是 X」
- `workbench.action.chat.open` 不存在時(Cursor 2.3 以前、其他 VS Code fork)**退回剪貼簿**,並讓讀者知道發生了什麼

### 協定

`shared/protocol.ts` 新增一則 webview → host 訊息(攜帶框選文字與目的地)與一則 host → webview 的結果回報。

> **修正(design 階段)**:本節原本寫「不新增 host → webview 訊息,這是單向動作」。那站不住——送進 Chat 失敗而退回剪貼簿時,若 webview 只做樂觀顯示,讀者會看到「已送出」但 chat 毫無動靜,而剪貼簿其實已經有東西了。**靜默且誤導是最糟的一種失敗。** 見 `design.md` 決策 6。

## Capabilities

### New Capabilities

- `ask-agent`: 讀者把導讀脈絡交給 AI 助手的完整行為——何時出現入口、prompt 由哪些欄位組成(含錨定狀態與行號換算規則)、兩條出口(chat 命令 / 剪貼簿)各自的成功與失敗行為、以及命令不可用時的退路

### Modified Capabilities

- `walk-player`: 「步驟導覽」requirement。快捷鍵改為**僅在未按下任何修飾鍵時生效**——按住修飾鍵的方向鍵屬文字選取操作,不得攔截為步驟切換

> **修正(specs 階段)**:本節原本寫「（無）」。`design.md` 決策 11 的 keydown 修正是**可觀察行為變更**,而且該決策的 Migration Plan 自己寫著「回退本功能時應獨立保留」——那正好證明它屬於 `walk-player` 而非 `ask-agent`:它修的是步驟導覽的缺陷,與本功能是否上線無關。

**已確認不需要 delta**(逐份掃過現有 6 份 spec):

- `interface-localization` —— 它的 requirement 規範的是**機制**(locale 判定與降級、介面文案與導讀內容的邊界、manifest 雙語、驗證錯誤固定英文),不是「哪些字串要翻譯」。新增按鈕文案是**滿足**既有 requirement,不是改變它。新字串照既有慣例進 `shared/i18n.ts` 兩份表
  - 提問骨架隨介面語言、引用內容保持原語言這條,是 `ask-agent` 自己的 requirement,套用的是 `interface-localization` 已劃定的邊界而非改變它
- `stale-step-detection` —— 本次**讀取** `AnchorReport` 的結果寫進 prompt,不改變它的判定規則或呈現方式
- `markdown-rendering`、`syntax-highlighting`、`reading-progress` —— 不涉及

## Impact

### 新增

| 檔案 | 內容 |
|---|---|
| `src/askAgentPrompt.ts` | prompt 組裝的純函式。**刻意獨立於 `viewProvider`**,因為它是這個功能唯一值得單元測試的邏輯(輸入 walk + stepIndex + 選取文字 + 錨定狀態,輸出字串),而 `viewProvider` 碰 `vscode` API 不好測 |

### 修改

| 檔案 | 內容 |
|---|---|
| `shared/protocol.ts` | 新增一則 webview → host 訊息與其 `parseWebviewToHostMessage` 分支 |
| `shared/i18n.ts` | 兩顆按鈕的文案 + 失敗提示,繁英各一份 |
| `src/viewProvider.ts` | 新訊息的 handler:組 prompt → 執行命令或寫剪貼簿 |
| `ui/render/walking.ts` | 固定入口與浮出按鈕的 DOM 與定位 |
| `ui/main.ts` | `selectionchange` 監聽、按鈕事件,**以及修正 keydown 未檢查修飾鍵導致 Shift+方向鍵跳步驟** |
| `ui/theme.css` | 固定入口與浮出按鈕的樣式 |
| `src/workspacePath.ts` | 若既有函式不足以把導讀絕對路徑轉成 repo 相對路徑,於此補齊 |

### 既有性質剛好幫上忙(不需額外處理)

- `theme.css` 的 `user-select: none` **只套在行號與 diff 的 +/- 標記上** —— 讀者框選 snippet 裡的程式碼時不會把行號一起框進去,拿到的是乾淨的原始碼
- 「複製到剪貼簿」在 repo 內已有先例:`copyRegenerateHint` 訊息 + `vscode.env.clipboard.writeText`。同一個模式、同一支 API,**這半邊幾乎沒有新東西**

### 不受影響

- **`.codewalk.json` 格式與 `shared/schema.ts`** —— prompt 全部由既有欄位組成,零欄位新增,**非破壞性變更**
- `package.json` 的 `engines`(`^1.90.0`)—— `workbench.action.chat.open` 是執行既有命令,不是使用新 API,不需要提高版本下限
- 無新增 npm 依賴

## Out of Scope

以下明確不做,避免範圍蔓延:

- **能力偵測**(判斷讀者有沒有 Copilot / Cursor 訂閱後決定顯示哪顆按鈕)—— 偵測不到真正想知道的事:VS Code 現在內建 Copilot Chat,命令一定存在,沒登入的人按下去只是跳登入頁。而且「複製」對終端機 agent 使用者是**主路徑不是退路**,藏進失敗分支等於當他們不存在
- **設定項與偏好記憶** —— 兩顆並列的成本只是多一次點擊。有人抱怨再說(rule of three)
- **開新終端機直接跑 `claude -p`** —— extension 要自己管 CLI 路徑與 fallback,踩 `decisions.md`「MVP 期禁止把產生邏輯寫進 extension」最深
- **MCP server 與 agent 主動拉脈絡** —— 屬 `add-mcp-bridge`。本次 prompt 自帶完整脈絡,不依賴任何協定
- **面板接收 agent 的回覆** —— 送出後即斷,面板不知道 agent 說了什麼
- **在編輯器裡框選程式碼後問 AI** —— VS Code 的「Add to Chat」與 Cursor 的 `Cmd+L` 原生已支援。本次要補的是**導讀脈絡**,不是重做編輯器已有的功能
- **快捷鍵** —— `ui/main.ts` 有一段實測留下的註解:中文輸入法作用中時字母鍵的 keydown 會被攔截去組字(實測 `R` 在中文輸入法環境下完全無反應)。**字母鍵對主要讀者不可靠**,而走讀畫面已用掉方向鍵、Escape、Home、`r`/`R`,剩下的非字母鍵不多。且這個動作前面通常有滑鼠選取,手已不在鍵盤上——「手不離方向鍵」的設計原則在這裡不適用。等有人要再說
- **`copyRegenerateHint` 的複製回饋** —— 那顆現有按鈕是靜默寫入剪貼簿、零提示,是既有的小缺陷。本次的新按鈕會有回饋(按鈕文字暫時變「已複製」),但**不順手改舊的**:那會需要為 `walk-player` 開 delta spec,為一個 1.5 秒的提示不值得。留作獨立小改
- **quiz 結果畫面的追問** —— 「我為什麼答錯」其實是全流程中追問價值最高的時刻,`optionExplanations` 解釋完仍想深入很合理。但它**不是免費的**:prompt 組成不同(要帶題目、選項、讀者的答案與正解),等於多一套組裝分支。列為明確的 Out of Scope 而非默認跳過,值得單獨評估
- **quiz 作答中的追問** —— 明確不做。quiz 的整個存在理由是確認讀者真的懂了,作答中給他一鍵問 AI 等於拆掉自己的差異化(見 `openspec/decisions.md` quiz 定位)

## Open Questions

1. **複製按鈕的最終用詞** —— 方向已定(必須點出「複製的是一段提問」而不是框選的原文),繁中暫定「複製提問」、英文 "Copy prompt"。實作時看實際版面再微調
2. **固定入口擺在走讀畫面哪個位置** —— 需要看實際版面決定,不與既有按鈕搶視線
3. **導讀檔不在 workspace 內時的行為** —— 相對路徑算不出來時,prompt 該退回絕對路徑還是省略指標?(後者會讓 agent 無從讀起)
4. **浮出按鈕的定位策略** —— 選取範圍靠近面板邊緣時的擺放;面板本身很窄,兩顆按鈕可能塞不下同一行
