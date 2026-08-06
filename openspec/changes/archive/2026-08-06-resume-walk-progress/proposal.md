## Why

讀者導讀讀到一半,切去 file explorer 或其他側邊面板處理事情,回頭時每次都被彈回導讀列表——
VS Code 在側邊面板隱藏時會 dispose webview,重建後畫面從零開始,讀者得重新找回自己讀到哪。
一份三十步的導讀,中途查個檔案就等於前功盡棄,這讓「邊讀邊對照 code」這個最自然的使用方式
變成懲罰。

同樣的斷點也發生在跨天閱讀:關掉 VS Code 隔天再開,上次讀到第幾步完全沒有留下痕跡。

## What Changes

- **同一 session 內回到面板時自動還原**:切走再回來,直接回到當時的 step、quiz 作答狀態或
  分數頁,讀者感覺不到面板曾被重建
- **跨 VS Code 重啟保存進度**:每份導讀各自記住讀到第幾步,關掉編輯器再開仍在
- **導讀列表新增【接續上次(第 N 步)】按鈕**:跨重啟後不自動跳回進度——讀者重開編輯器未必
  要繼續上次那件事——改為在列表上提供顯式入口,由讀者決定
- **走完 quiz 即重置該份進度**:已讀完的導讀不再顯示接續入口,下次從頭開始
- **恢復進度時不動編輯器**:還原導讀內容但不自動開檔跳轉,避免打斷讀者剛切去處理的事
- **走讀畫面新增【回到本步專案位置】按鈕**:補上恢復後把編輯器跳回當前 step 的顯式入口,
  並登記為 VS Code command 以便綁快捷鍵
- **同 session 內細節狀態原樣保留**:webview 改為 `retainContextWhenHidden`,捲動位置與
  已展開的術語註解不會因面板隱藏而重置

## Capabilities

### New Capabilities

- `reading-progress`: 閱讀進度的保存與恢復——面板重建後的自動還原、跨 VS Code 重啟的進度
  留存、導讀列表上的接續入口、以及走完 quiz 後的進度重置

### Modified Capabilities

- `walk-player`: 「檔案行號跳轉」原本只在 step 切換時自動觸發,現在新增【回到本步專案位置】
  這個顯式入口,讓讀者在恢復進度後主動把編輯器帶回當前 step;另需釐清「選擇導讀一律從第一步
  開始」與新增的「接續上次」入口之間的關係,兩者是並存的不同入口

## Impact

**Extension host**

- `src/viewProvider.ts`:`webviewReady` 分支需回灌 host 已持有的 `currentWalk` /
  `stepIndex`(目前只回送 theme 與檔案列表);新增進度寫入時機與「回到本步專案位置」的處理
- `src/extension.ts`:`registerWebviewViewProvider` 加上 `webviewOptions`;註冊新 command
- 新增進度儲存模組:仿 `src/attemptStore.ts` 的 `workspaceState` 寫法,以導讀相對路徑為 key

**協定**

- `shared/protocol.ts`:新增進度還原訊息;quiz 作答中的答案目前只活在 webview state,需要
  讓 host 能保管——這是本次協定面積增加的主要來源

**Webview**

- `ui/state.ts`、`ui/render.ts`、`ui/main.ts`:接收還原訊息後重建對應畫面狀態;導讀列表項目
  上的接續按鈕;走讀畫面上的回到位置按鈕

**其他**

- `package.json`:新增 command 與 keybinding 貢獻點
- 記憶體:`retainContextWhenHidden` 會讓面板隱藏時 webview context 續存
  (`dist/webview.js` 2.6 MB + Shiki),此代價已在 clarify 階段確認接受
- 與 `stale-step-detection` 有互動:跨重啟恢復時,程式碼可能已變動、錨可能失準,恢復流程需
  與既有的錨驗證銜接(細節留待 design)

## Open Questions

以下為實作取捨,不影響本提案範圍,留待 design 階段決定:

- 進度的儲存結構:與作答紀錄共用一份 `workspaceState` 條目,或各自獨立
- 跨重啟恢復時錨已失準的處理方式:照樣恢復並沿用既有失準提示,或另有降級行為
- quiz 作答中狀態如何納入協定而不過度膨脹訊息面積
- 【接續上次】按鈕在導讀列表上的視覺呈現,以及與既有「更多動作」選單的關係
