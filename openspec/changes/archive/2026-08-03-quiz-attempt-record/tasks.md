# tasks — quiz-attempt-record

## 建議開發方式

| 元件類型 | 涉及檔案 | 作法 |
|---|---|---|
| 純邏輯(相對時間、計分、紀錄查詢) | `ui/relativeTime.ts`、`shared/schema.ts`、`src/attemptStore.ts` | **tdd skill**(red-green-refactor)——這三者都是可完整單元測試的純函式或薄封裝,先寫失敗測試 |
| 協定與 schema | `shared/protocol.ts` | 直接實作 + 補 `shared/protocol.test.ts` 的 parser 分支測試(沿用既有測試風格) |
| extension host | `src/extension.ts`、`src/viewProvider.ts`、`src/walkLoader.ts` | 直接實作;host 與 VS Code API 綁定的部分無單元測試,靠 Extension Development Host 手動驗證 |
| webview UI | `ui/render.ts`、`ui/main.ts`、`ui/state.ts` | 直接實作;狀態轉換(確認態)補 `ui/state.test.ts`,視覺樣式由人工調整 |

**切片順序**:第 1、2 組是可獨立驗證的完整邏輯層(不碰 UI);第 3、4 組各是一個端到端可 demo 的垂直切片。

---

## 1. 相對時間格式化(純邏輯層,完整交付)

- [x] 1.1 **[AFK]** 以 tdd skill 實作 `ui/relativeTime.ts` 的 `formatRelativeTime(at, now)`,使「作答時間的相對顯示」的六個級距 scenario 全部通過:剛剛(< 1 分鐘)、N 分鐘前(< 60 分鐘)、N 小時前(< 24 小時)、昨天(日曆日差 1)、N 天前(日曆日差 2–30)、`YYYY-MM-DD`(日曆日差 > 30)
- [x] 1.2 **[AFK]** 補測試釘住兩套判準的交界,使「跨日但未滿 24 小時的紀錄」scenario 通過:昨天晚間、距今 9 小時 → 輸出「9 小時前」而非「昨天」(未滿 24 小時以毫秒判準優先,不看日曆日)
- [x] 1.3 **[AFK]** 實作完整絕對時間的格式化(`YYYY-MM-DD HH:mm`),供 hover 顯示使用,使「查看完整時間」scenario 的資料端就緒

## 2. 計分邏輯上移共用(重構,行為不變)

- [x] 2.1 **[AFK]** 將計分邏輯抽為 `shared/schema.ts` 的 `scoreQuiz(walk, answers)`,回傳 `{ score, total, passed }`,緊鄰既有 `resolvePassThreshold()`;`ui/state.ts` 的 `submitQuiz()` 改為呼叫它。**驗收條件:既有 `ui/state.test.ts` 完全不改動且全數通過**——本任務不得順手更動任何計分或門檻規則(design 決策 4、風險段落)
- [x] 2.2 **[AFK]** 為 `scoreQuiz()` 補 `shared/schema.test.ts` 測試:預設門檻、自訂 `passThreshold`、全對、全錯、未作答以 `-1` 表示的答案

## 3. 端到端切片 A:送出 quiz 後留存,列表顯示紀錄

> 本組完成後即可 demo:走完一份導讀 → 作答 → 回列表看到「✓ 4/5 · 剛剛」;另一份沒作答過的導讀不顯示任何後置文字。

- [x] 3.1 **[AFK]** 在 `shared/protocol.ts` 新增 `AttemptSummary { at, score, total, passed }` 與 `WalkFileSummary.lastAttempt?`(選填,無紀錄時欄位不存在而非 `null`),並補 `shared/protocol.test.ts` 對應斷言
- [x] 3.2 **[AFK]** 以 tdd skill 實作 `src/attemptStore.ts`:單一 key `codewalk.quizAttempts` 存 `Record<相對路徑, { ref, at, score, total, passed }>`,提供寫入(覆蓋同路徑舊紀錄)、依路徑與 `ref` 查詢(`ref` 不符回傳無紀錄)、依路徑刪除;絕對↔workspace 相對路徑轉換在此層完成。以假的 `Memento`(單純的 get/update 物件)測試,不依賴 VS Code runtime
- [x] 3.3 **[AFK]** 將 `ExtensionContext` 從 `src/extension.ts` 傳入 `WalkPlayerViewProvider` 建構子,並在 provider 內建立 `attemptStore`
- [x] 3.4 **[AFK]** 在 `src/viewProvider.ts` 補存 `currentWalkPath`(`loadWalk(path)` 目前用完即丟),並填實目前為空的 `quizSubmitted` case:以 `scoreQuiz()` 算出結果後,連同 `currentWalk.ref` 與當下時間寫入 store;**寫入失敗以 try/catch 靜默忽略,不 post 任何錯誤訊息**,使「紀錄留存失敗不中斷讀者流程」scenario 通過
- [x] 3.5 **[AFK]** 讓 `sendFileList()` 為每份導讀附上 `lastAttempt`:`listWalkFiles()` 已逐檔解析全文,取用其 `ref` 與 store 比對,相符才附上——使「導讀重新產生後舊紀錄失效」scenario 通過(不增加額外檔案 I/O)
- [x] 3.6 **[AFK]** 在 `ui/render.ts` 的 `renderFileList` 渲染紀錄列:通過/未通過圖示(沿用 quiz 結果頁既有的 `icon('pass'/'error')` 與 `is-passed`/`is-failed` 命名慣例,非原訂的 `check`/`close`)、`score/total`、`formatRelativeTime()` 結果,並將完整絕對時間設為 `title`;`lastAttempt` 不存在時**完全不產生該節點**,使「沒有作答紀錄的導讀」scenario 的「不保留空白版位」成立
- [x] 3.7 **[HITL]** 調整紀錄列視覺:次要文字色與較小字級(視覺層級低於標題、不搶焦點),圖示配色一律取 VS Code CSS 變數,不自帶配色。需人工在深/淺色主題下確認對比度。**(實作改用 `--vscode-testing-iconPassed`/`--vscode-testing-iconFailed`,而非本任務原訂的 `--vscode-charts-green`,理由見 3.6 備註;深/淺色主題下的對比度確認已併入第 6 節的多輪 hover 對比度修正一起完成並經使用者驗證)**

## 4. 端到端切片 B:單筆紀錄的兩段式清除

> 本組完成後即可 demo:列表上點清除鈕 → 變「確定?」→ 再點一次紀錄消失;移開游標或按 Esc 則復原。

- [x] 4.1 **[AFK]** 在 `shared/protocol.ts` 新增 `{ type: 'clearAttempt'; path: string }` 與其 parser 分支(路徑為單位,不帶 `ref`),補對應測試
- [x] 4.2 **[AFK]** 在 `src/viewProvider.ts` 處理 `clearAttempt`:刪除 store 中該路徑的整筆紀錄後重送 `walkFileList`,使「兩段式清除紀錄」的最終結果與「清除後可重新作答」scenario 通過
- [x] 4.3 **[AFK]** 在 `ui/state.ts` 的 fileList state 加入 `pendingClearPath: string | null` 與其轉換函式,並補 `ui/state.test.ts`:觸發同一列 → 進入確認態、觸發另一列 → 前一列復原(使「同時只有一個項目處於確認狀態」scenario 通過)、復原動作 → 回到 `null`
- [x] 4.4 **[AFK]** 在 `ui/render.ts` 渲染清除控制項:僅在 `lastAttempt` 存在時產生(使「沒有紀錄時不顯示清除控制項」scenario 通過);一般態為 codicon `trash`,確認態改為文字「確定?」並套用警示色——視覺變化必須明顯,避免讀者誤判為「沒反應」而重複點擊(design 風險段落)
- [x] 4.5 **[AFK]** 在 `ui/main.ts` 接上清除互動:第一次觸發設 `pendingClearPath`、第二次觸發送出 `clearAttempt`;復原條件為游標移出該項目、按 Esc、離開列表畫面,使對應的三個復原 scenario 通過。**不使用計時器自動復原**(design 決策 6)
- [x] 4.6 **[AFK]** 確保清除控制項可由鍵盤聚焦(`button` 元素、可 Tab 到)與觸發(Enter/Space),使「以鍵盤清除紀錄」scenario 通過;確認 Esc 的處理不與既有鍵盤快捷鍵衝突(以原生 `<button>` 元素滿足,瀏覽器內建 Enter/Space 觸發 click 且天然在 tab 順序中,未另寫額外處理)

## 5. 文件同步與驗證

- [x] 5.1 **[AFK]** 在 `docs/glossary.md` 新增「作答紀錄(attempt record)」條目:定義為某份導讀最後一次完成 quiz 的快照(時間、分數、題數、是否過關),明確標示**不屬於 `.codewalk.json` 格式**、住 VS Code workspace 狀態、經 `WalkFileSummary.lastAttempt` 送到 webview;統一用詞為「作答紀錄」,不用「成績」「進度」
- [x] 5.2 **[AFK]** 更新 `docs/modules/walk-player.md`:功能清單新增作答紀錄與清除;「已知限制與技術債」新增「作答紀錄存於 VS Code workspace 狀態,換機器/重裝即歸零;導讀 `ref` 變更後舊紀錄不再顯示但不做垃圾回收」
- [x] 5.3 **[HITL]** 執行 Extension Development Host 手動驗證 checklist:
  - [x] 走完一份導讀 → 作答送出 → 回列表顯示「✓ N/M · 剛剛」,分數與過關狀態正確
  - [x] 未達門檻的作答顯示未通過圖示,且結果頁的重走建議行為不變
  - [x] 未作答過的導讀項目只有標題,版面無多餘空白列
  - [x] 重新作答同一份導讀 → 列表只顯示最新一次,舊分數消失
  - [x] 作答中途「取消,回到最後一步」→ 列表不出現紀錄
  - [x] 有紀錄的導讀可正常重新走讀與重新作答,無任何阻擋或確認
  - [x] 手動修改該導讀 `.codewalk.json` 的 `ref` → 回列表紀錄消失,呈現與未作答相同
  - [x] 開啟「更多動作」選單 → 點「清除 Quiz 紀錄」變確認態、再點一次紀錄消失並收合選單;按 Esc 或點選單外 → 收合且紀錄仍在
  - [x] 兩份有紀錄的導讀:第一份選單開啟中點第二份的選單入口 → 第一份自動收合
  - [x] 純鍵盤操作:Tab 到選單入口、Enter 開啟後焦點自動落在清除項目上,無需重新從頭 Tab,再 Enter 兩次可清除
  - [x] hover 分數區塊任一處顯示完整 `YYYY-MM-DD HH:mm`
  - [x] 深色與淺色主題下,清除控制項的 hover 狀態與選單皆清楚可辨識(歷經 6.7/6.9/6.10/6.11 四輪修正,根因是 CSS specificity 被全域 `button:hover:not(:disabled)` 蓋掉)
  - [x] 走讀畫面的「返回列表」按鈕與 Esc 快捷鍵可正常返回列表,不留下作答紀錄
  - [x] 關閉再開啟 VS Code → 紀錄仍在(持久化生效)
- [x] 5.4 **[HITL]** 驗證通過:`pnpm test` 全綠(含新增的 `ui/relativeTime.test.ts`、`src/attemptStore.test.ts`、`shared/schema.test.ts` 與 `shared/protocol.test.ts` 新分支,以及**未經改動即通過的既有 `ui/state.test.ts`**),且 5.3 手動 checklist 全數勾選

## 6. 手動驗證階段的修正與追加

> 第一輪手動驗證(5.3)發現三個正確性/可及性問題與兩個產品層級的判斷,經與使用者確認方向後修正,詳細理由見 design.md 決策 6、9。

- [x] 6.1 **[AFK]** 修正鍵盤焦點遺失:全樹重繪(`root.innerHTML = ''`)會讓清除控制項連同焦點一起被銷毀,Tab 順序被打斷、彈回文件最前面;改為重繪後主動把焦點還給對應列的控制項(`ui/main.ts` 的 `restoreFileListFocus`)
- [x] 6.2 **[AFK]** 修正 hover 完整時間顯示範圍過窄:`title` 從只掛在時間文字的小 `span` 移到整個分數區塊,hover 圖示、分數、時間任一處都看得到完整時間
- [x] 6.3 **[AFK]** 加強清除控制項的 hover 對比度:改用 `--vscode-icon-foreground` / `--vscode-errorForeground` / `--vscode-toolbar-hoverBackground` 等專用於小型圖示按鈕的 token
- [x] 6.4 **[AFK]** 依使用者回饋,把清除控制項從常駐 trash 圖示改為 `⋮`「更多動作」選單入口(內含「清除 Quiz 紀錄」一項文字),避免被誤認成刪除導讀檔案;沿用既有兩段式確認邏輯,同時只有一份導讀的選單能展開;同步改寫 design.md 決策 6 與 specs/walk-player/spec.md 的「清除單筆作答紀錄」requirement
- [x] 6.5 **[AFK]** 走讀畫面新增「返回列表」按鈕與 Esc 快捷鍵,補齊既有 MVP 缺口(不留下作答紀錄);同步新增 design.md 決策 9 與 specs/walk-player/spec.md 的「從走讀畫面返回導讀列表」requirement
- [x] 6.6 **[AFK]** 第二輪手動驗證發現原生 `title` 屬性在 webview 裡不會顯示 tooltip:改用純 CSS 自製 tooltip(`:hover`/`:focus-within` 控制顯示,套用 `--vscode-editorHoverWidget-*` token),並讓分數區塊可被 Tab 聚焦以支援鍵盤查看
- [x] 6.7 **[AFK]** `⋮` 選單入口與選單項目的 hover 對比度不足(原本只換背景色、文字/圖示顏色不變):改用 `--vscode-list-activeSelectionForeground`/`--vscode-list-activeSelectionBackground`(VS Code 主題保證高對比的「選取中」配色),同步套用到「返回列表」按鈕的 hover
- [x] 6.8 **[AFK]** 「確定清除?」項目的 hover 改為紅底白字(`--vscode-inputValidation-errorBackground` + `--vscode-inputValidation-errorForeground`),不沿用一般選單項目的中性 hover 配色,強化「這會刪除東西」的視覺回饋
- [x] 6.9 **[AFK]** 第三輪驗證發現 `list.activeSelection*` 在使用者主題下前景/背景對比不足(background 是亮色系 cyan、foreground 沒跟著變深)——這組 token 只有在真正的 List/Tree 元件裡才保證互相對比,挪來自訂 UI 沒有這層保證。改用本檔案裡已證實在使用者主題下清楚可辨的 `--vscode-button-secondaryBackground`/`--vscode-button-secondaryForeground`(`.codewalk-file-item` 原本就用這組),套用到 `⋮` 選單入口、選單項目、返回列表按鈕的 hover
- [x] 6.10 **[AFK]** 第四輪驗證發現連 `button.secondary*` 這組在使用者主題下前景背景也一樣不清楚——不再猜測哪組主題 token 夠對比,改成疊加一層相對主背景淺/深的半透明(`--codewalk-hover-overlay`,依 VS Code 注入在 `<body>` 的 `vscode-light`/`vscode-dark`/`vscode-high-contrast(-light)` class 切換深淺),前景色完全不動,適用任何主題
- [x] 6.11 **[AFK]** 用 DevTools 找到真正根因:前四輪換色全部被本檔案既有的全域 `button:hover:not(:disabled) { background-color: var(--vscode-button-hoverBackground); }` 用更高的 CSS specificity 默默蓋掉(該 token 在使用者的 Nightfox 主題下正是那個亮 cyan),不是主題色選錯。修法是幫 `.codewalk-attempt-menu-trigger`/`.codewalk-attempt-menu-item`/`.codewalk-back-to-list` 三處 hover 規則加上 `button.` 型別選擇器與 `:not(:disabled)`,把 specificity 拉到明確高於該全域規則(`.is-pending:hover` 因多一個 class 早已具備足夠 specificity,是唯一從第三輪起就顯示正確的項目,間接印證了這個診斷)
