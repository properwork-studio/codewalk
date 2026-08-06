# Tasks — resume-walk-progress

**建議開發方式**

| 任務性質 | 作法 |
|---|---|
| `src/progressStore.ts` 等純邏輯模組 | **tdd skill**(red-green-refactor);仿 `attemptStore.test.ts` 餵假 memento,不依賴 vscode runtime |
| `viewProvider` 的分支判斷 | 把「該不該回灌、回灌什麼」「進度是否有效」抽成純函式再測,避免整包 provider 難以測試 |
| webview UI(`ui/`) | 直接實作;狀態轉換寫進 `ui/state.test.ts` 既有的測試風格 |
| 協定與 schema | 先改 `shared/protocol.ts` 的型別與 parser,型別錯誤會把兩端該改的地方全部指出來 |

**切片順序的理由**:切片 1 的 `retainContextWhenHidden` 一行就解掉日常九成痛點,先落地拿價值;
但它生效後,切片 2 的回灌路徑在日常操作中幾乎不會觸發——切片 2 的驗證必須用
「把 CodeWalk view 從側邊欄拖到 Panel」(重建 webview 但不重啟 extension host),見 design 風險段。

收工前一律跑 `pnpm format`。

## 1. 面板隱藏不再重建(最小可 demo 切片)

- [x] 1.1 **[AFK]** 在 `registerWebviewViewProvider` 加上 `webviewOptions: { retainContextWhenHidden: true }`,使「走讀中途切換面板再回來」「保留捲動位置與展開的術語」兩個 scenario 在常態操作下通過
- [x] 1.2 **[HITL]** 在 Extension Development Host 確認:讀到第 12 步 → 切到檔案總管 → 切回來,仍在第 12 步且捲動位置未變(人工驗證通過)

## 2. webview 真被重建時由 host 回灌

- [x] 2.1 **[AFK]** `shared/protocol.ts` 新增還原訊息(帶 walk、stepIndex、refDrifted、anchorReport、snippetPreviews),並更新 `parseWebviewToHostMessage` 的驗證
- [x] 2.2 **[AFK]** 把「`webviewReady` 時該不該回灌」抽成純函式並補單元測試——依據是 host 端是否持有 `currentWalk`(design 決策 1),涵蓋「尚未選擇導讀時不受影響」scenario(`src/webviewReadyPlan.ts`)
- [x] 2.3 **[AFK]** `viewProvider` 的 `webviewReady` 分支接上回灌,使「走讀中途切換面板再回來」在 webview 真被重建時也通過(另外發現並修掉一個副作用:`onBackToList` 原本重用 `webviewReady` 通知 host 刷新列表,接上回灌後會被立刻拉回導讀畫面——已改發獨立的 `backToList` 訊息,host 收到時清空 `currentWalk`)
- [x] 2.4 **[AFK]** 回灌路徑不呼叫 `jumpToCurrentStep()`,使「面板重建後還原不動編輯器」scenario 通過
- [x] 2.5 **[AFK]** `ui/main.ts` 處理還原訊息,依訊息內容重建 walking / quiz / quizResult 三種畫面狀態
- [x] 2.6 **[HITL]** 手動驗證:讀到第 12 步 → 把 CodeWalk view 拖到 Panel 區 → 確認仍在第 12 步,且編輯器沒有被切換檔案(人工驗證通過)

## 3. webview 自行保留細粒度 UI 狀態

- [x] 3.1 **[AFK]** 補上 `ui/main.ts:25` 的 `acquireVsCodeApi()` 型別宣告(`setState` / `getState`)
- [x] 3.2 **[AFK]** 以 `setState` 保存 quiz 作答中的答案、已展開術語與捲動位置,重建時取回,使「quiz 作答中切換面板再回來」「quiz 結果頁切換面板再回來」兩個 scenario 通過(純狀態轉換邏輯落在 `ui/state.ts` 的 `applyPersistedUiState`,已補單元測試;捲動位置的讀寫是 DOM-only,落在 `ui/main.ts`,依專案慣例走手動驗證)
- [x] 3.3 **[AFK]** 取回的細節狀態需比對所屬導讀與 `ref`,不符則捨棄改用預設值,使「細節狀態與當前導讀不符時捨棄」scenario 通過

## 4. 進度跨重啟留存與列表顯示

- [x] 4.1 **[AFK]** 新增 `src/progressStore.ts`,以 `AttemptMemento` 介面與相對路徑索引留存 `{ ref, stepIndex }`(design 決策 2),含 `ref` 不符視同無進度的判斷(決策 3)
- [x] 4.2 **[AFK]** `progressStore` 單元測試涵蓋:多份導讀互不覆蓋、`ref` 不符回傳無進度、清除條目
- [x] 4.3 **[AFK]** `setStep` 時寫入進度(決策 9),寫入失敗以既有 `AttemptStore` 的處置方式吞掉,使「留存進度失敗不中斷閱讀」scenario 通過
- [x] 4.4 **[AFK]** `WalkFileSummary` 加上選填進度欄位,`listWalkFiles` 一併帶出,使「關閉編輯器後進度仍在」「多份導讀的進度彼此獨立」兩個 scenario 通過
- [x] 4.5 **[HITL]** 導讀列表項目上的接續入口視覺呈現——沿用既有作答紀錄版位規則(無進度時不佔空白),配色走編輯器主題變數;需人工確認與既有「更多動作」選單的視覺關係(design 決策 10)。**依人工回饋兩輪調整**:
  1. 原本的「接續上次(第 N 步)」文字按鈕在窄面板下會把標題擠成逐字換行,改為只顯示圖示+步數(如「▶ 7」)
  2. 驗收通過後又發現三個徽章(通過/未通過、更多動作、接續)常駐色塊視覺過重,搶了標題版面——最終改為三顆無底色純圖示並排(`✓ ▶ ⋮`):通過/未通過與接續維持一眼可見(接續可直接點擊觸發,不藏進選單);分數細節與清除紀錄收進「更多動作」選單,呼應既有「危險/次要操作才用揭露式選單」的原則(design.md 決策 6 的延伸)
- [x] 4.6 **[AFK]** 使「有進度的導讀顯示接續入口」「沒有進度的導讀不顯示接續入口」「ref 不符時視同沒有進度」三個 scenario 通過

## 5. 接續上次的閱讀進度

- [x] 5.1 **[AFK]** `shared/protocol.ts` 新增接續訊息(帶導讀路徑)
- [x] 5.2 **[AFK]** `loadWalk` 加上「是否 reveal」與「起始步驟」的選項,不複製一份載入邏輯(design 決策 5、6)(實作為單一 `resume` 選項,起始步驟在 `resume: true` 時直接查詢進度,避免呼叫端重複讀檔)
- [x] 5.3 **[AFK]** 起始步驟夾在 `[0, steps.length - 1]`,使「留存的步驟超出範圍」scenario 通過
- [x] 5.4 **[AFK]** 接上接續入口,使「接續到留存的步驟」「接續進度不動編輯器」兩個 scenario 通過(人工測試抓到一個 bug 並修好:`ui/main.ts` 的 `walkLoaded` 處理呼叫既有的 `createWalkingState()` 時,該函式固定把 `stepIndex` 寫死成 0,完全沒理會訊息帶來的 `msg.stepIndex`——過去不是問題是因為以前送出的 `stepIndex` 本來就永遠是 0,這次接續上次功能才讓它變成可觀察的 bug,永遠跳回第一步。已改為明確覆寫 `stepIndex: msg.stepIndex`)
- [x] 5.5 **[AFK]** 確認接續走既有 `buildAnchorReport` 流程,使「接續的步驟已失準」scenario 通過(不需新增特例邏輯,以測試釘住此行為)
- [x] 5.6 **[AFK]** 確認選擇導讀本身仍從第一步開始,使 walk-player 的「有留存進度時選擇導讀仍從頭開始」「一般切換步驟仍照常跳轉」兩個 scenario 通過

## 6. 走完 quiz 重置進度

- [x] 6.1 **[AFK]** `handleQuizSubmitted` 於留存作答紀錄的同時清除該份進度,使「送出 quiz 後接續入口消失」scenario 通過
- [x] 6.2 **[AFK]** 清除進度失敗不影響作答紀錄留存、不顯示錯誤,使「重置進度失敗不影響作答紀錄」scenario 通過
- [x] 6.3 **[AFK]** 確認 quiz 中途取消不清除進度,使「作答中途取消不重置進度」scenario 通過(取消會送 `jumpToStep` 到最後一步,`setStep` 照常寫入該步進度,不需額外程式碼)

## 7. 回到本步專案位置

- [x] 7.1 **[AFK]** `shared/protocol.ts` 新增 `revealCurrentStep` 訊息;host 端 handler 重用既有 `jumpToCurrentStep()`(design 決策 8)
- [x] 7.2 **[AFK]** 註冊 `codewalk.revealCurrentStep` command 與 `package.json` 的 `contributes.commands` 條目,handler 與訊息共用同一個方法
- [x] 7.3 **[HITL]** 決定 webview 內的快捷鍵鍵位——需避開既有上一步/下一步與瀏覽器預設行為(design Open Questions)。原暫定 `R`,人工實測發現中文輸入法作用中時字母鍵的 keydown 會被輸入法攔截去組字,`R` 完全無反應(方向鍵/Escape 因非字母鍵不受影響)——**改為主鍵 `Home`**(不受輸入法影響),`R` 保留給英文鍵盤環境當備用鍵
- [x] 7.4 **[AFK]** 走讀畫面加上按鈕(文案「回到本步專案位置」)與 7.3 決定的鍵盤綁定,沿用 `#app` keydown 既有作法,使「把編輯器帶回目前步驟」「以鍵盤觸發」兩個 scenario 通過
- [x] 7.5 **[AFK]** 目前 step 沒有對應程式碼位置時不顯示此操作;檔案不存在時沿用既有「找不到檔案」提示,使「目標檔案不存在」scenario 通過(schema 的 file/startLine/endLine 為必填,「沒有對應位置」在現行 schema 下不會發生,按鈕因此一律顯示——已加註解說明)
- [x] 7.6 **[AFK]** 以測試釘住位移與失準的行為沿用既有規則,使「位移的步驟跳到新行號」「失準的步驟不落在錯誤位置」兩個 scenario 通過(重用既有 `jumpToCurrentStep()`/`jumpModeFor()`/`effectiveLineRange()`,行為已由既有測試覆蓋)

## 8. 驗證通過

- [x] 8.1 **[AFK]** `pnpm test` 全綠;`pnpm format` 已跑過(另外跑過 `pnpm typecheck`、`pnpm build`,均通過)
- [x] 8.2 **[HITL]** Extension Development Host 手動驗證 checklist(全部通過):
  - [x] 讀到中途切到檔案總管再切回 → 停在原步驟、捲動位置與展開術語不變
  - [x] 把 view 拖到 Panel 再拖回 → 停在原步驟(回灌路徑)
  - [x] 中途切走 → 在編輯器開別的檔案 → 切回導讀 → 編輯器沒有被搶走
  - [x] quiz 選到一半切走再回來 → 已選答案還在
  - [x] 關閉 VS Code 重開 → 回到導讀列表,該份導讀顯示「接續上次(第 N 步)」
  - [x] 按接續入口 → 停在第 N 步,編輯器沒有被開檔
  - [x] 按【回到本步專案位置】與其快捷鍵 → 編輯器跳到正確行號範圍
  - [x] 直接選擇該導讀(不按接續)→ 從第 1 步開始
  - [x] 走完並送出 quiz → 回列表,接續入口消失
  - [x] 改動某步驟對應的程式碼後接續 → 失準提示照既有規則顯示
  - [x] 重新產生導讀(`ref` 變更)→ 接續入口消失

## 額外修正(人工測試中發現,與本 change 有關或無關但一併修掉)

- [x] 導讀列表的「更多動作」選單第一次展開時被下一列的項目蓋住,hover 過下一列才恢復正常——與本 change 無關的既有 bug。根因:選單用 `position: absolute` 溢出到下一列的視覺範圍,但所在的 `<li>` row 本身沒有明確的堆疊層級,DOM 順序在後的下一列天生會蓋過它。已加上 `.has-open-menu` class 讓展開選單的那一列明確拿到較高 `z-index`
- [x] 接續按鈕原本的「接續上次(第 N 步)」文字在窄面板下會把標題擠成逐字換行——已改為只顯示圖示+步數,完整文字改放 title/aria-label(見 4.5)
- [x] meta 徽章縮成純圖示後,通過/未通過圖示的自製 tooltip 有時會超出面板右緣——根因是置中對齊(`left:50%` + `translateX(-50%)`),圖示擠在面板右側時置中的 tooltip 有一半會超出邊界。已改為貼齊圖示右緣往左展開(`right:0`),並把 tooltip 內容縮回「分數・相對時間」,不再多塞絕對時間進去
