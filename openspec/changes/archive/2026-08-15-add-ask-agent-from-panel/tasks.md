# tasks — add-ask-agent-from-panel

## 建議開發方式

這個 change 橫跨三種元件,各自的做法不同:

| 元件 | 涵蓋任務 | 做法 |
|---|---|---|
| **協定與純函式**(`shared/protocol.ts`、`src/askAgentPrompt.ts`) | 1.1、1.2 | **tdd skill**(red-green-refactor)。`buildAskAgentPrompt` 是純函式,spec 的 scenario 幾乎一對一變成測試案例,是這個 change 最值得先 TDD 的部分 |
| **extension host**(`src/viewProvider.ts`) | 1.4、2.1、2.2 | 直接實作。碰 `vscode` API 不好單元測試,靠 Extension Development Host 手動驗證;所有可測邏輯已被抽到 1.2 |
| **webview UI**(`ui/render/walking.ts`、`ui/main.ts`、`ui/theme.css`) | 1.5、2.3、3.1–3.3 | 直接實作 + 手動驗證。jsdom 對 `Selection`、`Range.getBoundingClientRect()` 支援不足,**選取與浮出定位不寫單元測試**,列進 4.2 的手動 checklist |

任務**由上而下切片**:群組 1 完成即有可用功能(複製給終端機 agent),群組 2、3 各自再疊一層,任一群組做完都能單獨 demo。

**AFK** = agent 可獨立完成;**HITL** = 需人工介入(品味判斷、文案、版面)。

---

## 1. 讀者能把整個步驟複製給自己的 agent

做完這一組,在終端機跑 agent 的讀者已經有完整可用的功能——不依賴群組 2、3。

- [x] 1.1 **AFK** 在 `shared/protocol.ts` 新增 `askAgent`(webview→host,帶 `destination` 與選用的 `selection`)與 `askAgentResult`(host→webview,帶四種 `outcome`),並補上 `parseWebviewToHostMessage` 分支與 `shared/protocol.test.ts` 的驗證案例,使缺欄位/型別錯誤的訊息一律回傳 `null`
- [x] 1.2 **AFK** 新增 `src/askAgentPrompt.ts` 的 `buildAskAgentPrompt()` 純函式與測試,使 `ask-agent` 的以下 scenario 通過:
  - 「提問內容帶得出導讀位置」——含專案相對路徑、步驟索引、步驟標題、檔案與行號
  - 「提問內容不複述步驟敘述」
  - 「導讀檔位於專案之外」——退回絕對路徑(design 決策 12)
  - 「位移的步驟交出新行號」/「未位移的步驟沿用原行號」——行號一律經 `effectiveLineRange()`
  - 「失準步驟附上警示」/「正常步驟不附加警示」
  - 路徑一律正規化為正斜線(Windows 下 `path.relative` 回傳反斜線)
- [x] 1.3 **HITL** 在 `shared/i18n.ts` 新增提問骨架與按鈕文案(繁英各一份),使「繁體中文介面播放英文導讀」與「英文介面播放繁體中文導讀」通過。**骨架經 `t()`、引用內容不翻譯**(design 決策 2)。需人工定稿:「複製提問」的最終用詞——關鍵是要讓讀者知道複製的是一段提問,不是他框選的原文
- [x] 1.4 **AFK** 在 `src/viewProvider.ts` 接上 `askAgent` handler:取 workspace 根目錄與 `currentWalkPath` → 呼叫 1.2 → `destination: 'clipboard'` 時寫入剪貼簿 → 回送 `askAgentResult`,使「複製到剪貼簿」通過
- [x] 1.5 **HITL** 在 `ui/render/walking.ts` 加入常駐入口,與既有 `codewalk-reveal-step` 並列成一組步驟動作(design 決策 8),並在收到 `outcome: 'clipboard'` 時讓按鈕文字暫時變為「已複製」,使「走讀畫面一律提供入口」通過。需人工判斷:按鈕在窄面板下的擺放與是否折行

## 2. 讀者能把整個步驟送進編輯器內建 Chat

- [x] 2.1 **AFK** `destination: 'chat'` 時叫用 `workbench.action.chat.open` 並帶 `isPartialQuery: true`,使「送進 Chat」與「填入後停住等待讀者」通過(design 決策 4)
- [x] 2.2 **AFK** 以 try/catch 包住命令叫用,失敗時改寫剪貼簿並回報 `outcome: 'chatUnavailable'`,使「編輯器沒有可用的 Chat」通過。**不預先用 `getCommands()` 偵測**(design 決策 5)
- [x] 2.3 **HITL** webview 依四種 `outcome` 顯示對應回饋,使「剪貼簿也失敗」通過。`chatUnavailable` 必須明確告知已改用剪貼簿——**不得靜默,也不得在未實際填入 Chat 時表示已送出**。需人工決定:提示沿用 `stepJumpError` 的面板內警告樣式,還是走 `vscode.window.showInformationMessage`(design Open Question 2)

## 3. 框選讓提問更精確

3.1 是 3.2–3.4 的前提——不修它,讀者無法用鍵盤在面板內選取文字。

- [x] 3.1 **AFK** 修正 `ui/main.ts` 的 walking 分支 keydown:任一修飾鍵(`shift`/`ctrl`/`meta`/`alt`)按下時不攔截,使 `walk-player` 的「按住修飾鍵的方向鍵用於選取而非切換步驟」通過。**無修飾鍵時的既有行為(方向鍵、Escape、Home、`r`/`R`)完全不變**
- [x] 3.2 **AFK** 在 `ui/main.ts` 監聽 `selectionchange`,僅於 `screen === 'walking'` 處理,使「作答中框選不出現入口」「結果畫面框選不出現入口」「導讀列表框選不出現入口」通過
- [x] 3.3 **HITL** 就近入口的浮出、定位與消失,使「取消選取後就近入口消失」通過。垂直跟隨選取結尾、水平貼齊容器左緣(design 決策 9)。需人工調整:選取跨多段落或靠近面板底緣時的定位(design Open Question 3、4)
- [x] 3.4 **AFK** 把框選內容併入 `askAgent` 訊息與 prompt,使「框選後提問」與「未框選時以整步為對象」通過。`selection` 省略即代表問整步,不另加布林欄位(design 決策 7)

## 4. 驗證

- [x] 4.1 **AFK** `pnpm test`、`pnpm typecheck`、`pnpm format` 全綠
- [x] 4.2 **AFK** 跑 `pnpm relocate-anchors` 檢查、必要時 `--write --ref HEAD` 對齊。**本次改動的 `shared/protocol.ts`、`src/viewProvider.ts`、`ui/main.ts`、`ui/render/walking.ts` 四個檔案都被 `.codewalk/` 的導讀引用**,`tests/repoWalks.test.ts` 必定會紅;若 narration 本身也過時,才需依 `regenerateHint` 重新產生
- [x] 4.3 **HITL** Extension Development Host 手動驗證 checklist:
  - 常駐入口在走讀畫面一律顯示;quiz 作答、quiz 結果、導讀列表三個畫面都不顯示
  - 滑鼠拖曳選取 → 就近入口出現;取消選取 → 消失
  - **Shift+方向鍵能在面板內選取文字且不切換步驟**;無修飾鍵的方向鍵翻頁如常
  - 「複製提問」→ 貼到終端機的 agent,它讀得到導讀檔並答得出來
  - 「送進 Chat」→ 內容填入輸入框且**停在那裡不自動送出**
  - 在 Cursor 與 VS Code 各驗一次;若手邊有 Cursor 2.3 以前的版本,確認落到剪貼簿並顯示告知
  - 切換編輯器顯示語言(繁中 ↔ 英文),確認骨架跟著變、引用的導讀內容維持原語言
  - 找一個失準的步驟,確認提問內含「程式碼已被改動」的警示
  - 把側邊欄拉到最窄,確認兩顆按鈕不橫向溢出
