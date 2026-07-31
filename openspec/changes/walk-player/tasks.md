## 建議開發方式

- **extension host**(指令、檔案操作、面板生命週期、git 比對):`tdd` skill(red-green-refactor),邏輯以 Vitest 覆蓋
- **協定與 schema**(`shared/protocol.ts`、`shared/schema.ts`):`tdd` skill,型別與解析/驗證邏輯先寫測試
- **webview UI**(vanilla TS 渲染邏輯,如 quiz 計分、術語收合狀態):狀態/邏輯部分走 `tdd` skill;純樣式與排版直接實作,搭配手動驗證(視覺類不易寫自動化測試)

## 1. 專案骨架與工具鏈

- [x] 1.1 初始化 pnpm 專案(`package.json`、`tsconfig.json` strict 模式)AFK
- [x] 1.2 設定 esbuild 打包(extension host 與 webview 兩個 bundle target)AFK
- [x] 1.3 建立 VS Code extension manifest(`package.json` 的 `contributes`:viewsContainers、views、commands、keybindings)AFK
- [x] 1.4 設定 Vitest 測試環境 AFK
- [x] 1.5 建立三層目錄骨架 `src/`、`ui/`、`shared/` 與空入口檔案 AFK

## 2. schema 與協定

- [x] 2.1 定義 `.codewalk.json` schema(`shared/schema.ts`):step(含 `startLine`/`endLine`)、內嵌術語註解、5 題 quiz、`ref` 欄位,使「載入導讀檔案」的格式驗證行為有型別基礎可用 AFK tdd
- [x] 2.2 定義 postMessage 協定型別(`shared/protocol.ts`):host↔webview 訊息(載入完成、切換 step、quiz 送出結果、ref 漂移狀態等)AFK tdd

## 3. 導讀載入與格式驗證

- [x] 3.1 實作 extension host 掃描 `.codewalk/` 目錄並列出可用檔案,使「正常載入導讀」與「目錄不存在或無可用檔案」scenario 可通過 AFK tdd
- [x] 3.2 實作 schema 驗證與錯誤處理,使「檔案格式不符 schema」scenario 可通過 AFK tdd
- [x] 3.3 實作 webview 檔案選擇 UI 與載入後顯示第一個 step AFK

## 4. 步驟導覽與檔案跳轉

- [x] 4.1 實作上一步/下一步快捷鍵與邊界處理,使「以快捷鍵前進到下一步」「以快捷鍵回到上一步」「已在最後一步時嘗試前進」scenario 可通過 AFK tdd
- [x] 4.2 實作 extension host 跳轉檔案並高亮 `startLine`~`endLine`,含檔案不存在的錯誤處理,使「正常跳轉並高亮」「目標檔案不存在」scenario 可通過 AFK tdd

## 5. 術語註解

- [x] 5.1 實作 webview 術語展開/收合互動(預設收合),使「展開術語註解」「收合已展開的術語註解」scenario 可通過 AFK tdd

## 6. Quiz 自測

- [x] 6.1 實作 quiz 計分邏輯(5 題,答對 <3 觸發建議提示),使「通過自測」「未通過自測」scenario 可通過 AFK tdd
- [x] 6.2 實作 quiz UI(題目呈現、作答、送出、顯示分數與提示文案)AFK;提示文案措辭 HITL

## 7. ref 漂移偵測

- [x] 7.1 實作比對 workspace HEAD 與 `.codewalk.json` 的 `ref`(呼叫 git),使「HEAD 與 ref 相符」「HEAD 與 ref 不符」scenario 可通過 AFK tdd

## 8. 視覺主題

- [x] 8.1 webview 讀取 VS Code 主題 CSS 變數渲染樣式,使「隨主題切換更新樣式」scenario 可通過 AFK

## 9. 打包與發佈

- [x] 9.1 設定 vsce 打包流程,產出可本地安裝的 VSIX AFK
- [x] 9.2 撰寫安裝與使用說明 HITL(草稿,措辭待使用者確認)

## 10. 驗證通過

- [x] 10.1 執行 Vitest 單元測試套件,全數通過(涵蓋 schema 驗證、協定序列化、quiz 計分、ref 比對等純邏輯)AFK
- [ ] 10.2 依 Extension Development Host 手動驗證 checklist 逐項確認:開面板 → 選擇並載入導讀 → 前後步導覽(含已達邊界情況)→ 檔案跳轉並高亮(含檔案不存在情況)→ 展開/收合術語註解 → 完成 quiz 並驗證通過與未通過兩種分支 → 改動 workspace HEAD 觸發 ref 漂移警告 → 切換 VS Code 淺色/深色主題確認樣式跟隨 HITL

## 11. Quiz 過關門檻可設定(手動驗證階段追加,對應 design.md 決策 7)

- [x] 11.1 修改 `shared/schema.ts`:`quiz` 題數改為至少 1 題、新增可選 `passThreshold` 欄位與驗證、新增 `resolvePassThreshold()`,使 spec.md「Quiz 自測與回饋」新增的「使用預設門檻通過/未通過」「使用自訂門檻」scenario 可通過 AFK tdd
- [x] 11.2 修改 `ui/state.ts` 的 `submitQuiz()` 改呼叫 `resolvePassThreshold()`,不再依賴寫死常數 AFK tdd
- [x] 11.3 修正「已在最後一步時按下一步無反應」的 UX 落差:`ui/render.ts` 的下一步按鈕在最後一步時 disabled,與上一步按鈕在第一步時的行為一致 AFK
- [x] 11.4 修正 quiz 結果頁無法離開的問題:新增 `restartWalk()`/`retryQuiz()` 純函式與 `jumpToStep` 協定訊息,結果頁加上「重新挑戰 Quiz」「重新走一次導讀」「回到導讀列表」三個動作,使 spec.md 新增的「離開 quiz 結果頁」scenario 可通過 AFK tdd
- [ ] 11.5 手動驗證:自訂 `passThreshold` 是否正確影響通過/未通過判定;quiz 結果頁三個離開動作是否都正常運作 HITL
- [x] 11.6 修正術語註解展開/收合「點開又立刻收合」的 bug:`details` 元素設定 `.open` 本身會非同步觸發 `toggle` 事件,原本監聽 `toggle` 會被自己的重繪動作二次觸發;改監聽 `summary` 的 `click` + `preventDefault()`,不透過原生 toggle 事件驅動狀態 AFK
- [x] 11.7 修正跳轉檔案會搶走面板焦點、導致連續按方向鍵快捷鍵在第二次之後失效的問題:`showTextDocument()` 加上 `preserveFocus: true` AFK
- [x] 11.8 修正 Quiz 作答中無法離開(必須送出答案才能離開)的問題:新增 `cancelQuiz()` 純函式,quiz 畫面加上「取消,回到最後一步」,使 spec.md 新增的「作答中途取消 quiz」scenario 可通過 AFK tdd
- [x] 11.9 修正方向鍵快捷鍵完全無反應的問題:原本靠 `package.json` keybindings 的 `webviewView == codewalk.playerView` when 條件比對觸發 VS Code 指令,實測不可靠;改為直接在 webview(`ui/main.ts`)監聽 `keydown`,只在 `walking` 畫面攔截方向鍵,不再依賴 when 條件;移除 `package.json` 的 `keybindings` 貢獻點,避免未來 when 條件生效時兩套機制同時觸發、一次按鍵跳兩步 AFK
- [x] 11.10 調整 Quiz 作答畫面按鈕排版:「取消」與「送出答案」移到同一列,取消置左、送出置右,取消按鈕改用 `--vscode-button-secondary*` 主題色與送出按鈕視覺區隔 AFK
- [ ] 11.11 手動驗證:連續按方向鍵快捷鍵是否能不間斷切換多個 step(且不再影響編輯器選取範圍);術語展開/收合是否正常;Quiz 作答中取消是否正確回到最後一步;Quiz 按鈕排版與顏色是否符合預期 HITL
