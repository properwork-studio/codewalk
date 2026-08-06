# Clarify — resume-walk-progress

問答日期:2026-08-06。以下為已確認的需求前提,proposal / design / specs 一律以此為準,不再重問。

## 原始痛點

導讀讀到一半,切去 file explorer 或其他面板處理事情,回頭時 webview view 已被 VS Code
dispose 並重建,讀者每次都被彈回導讀列表,無法接續閱讀。

技術根因:`WalkPlayerViewProvider` 的 `webviewReady` 分支只回送 `themeChanged` 與
`walkFileList`(`src/viewProvider.ts:59-62`),沒有回灌 host 端已持有的
`currentWalk` / `currentWalkPath` / `stepIndex`。

## 已確認決策

### 1. 恢復範圍:walking + quiz + quizResult 全部

回到面板時,walking 畫面恢復到當前 step;quiz 作答中恢復已選答案;quizResult 恢復分數頁。
quiz 答案目前只活在 webview state,需要新增 protocol 欄位讓 host 保管。

### 2. 兩種情境行為不同

| 情境 | 行為 |
|---|---|
| 同一 VS Code session 內切面板再回來 | **自動**還原到當前 step / 作答狀態,無中斷感 |
| 關掉 VS Code 隔天再開 | 回到**導讀列表**,該份導讀上顯示「接續上次(第 N 步)」按鈕,讀者自己按 |

跨重啟刻意不自動跳:讀者重開編輯器時未必要繼續上次那件事。

### 3. 進度粒度:每份導讀各自記

以導讀相對路徑為 key,與現有 `AttemptStore` 同構。交替閱讀多份導讀時不互相覆蓋。

### 4. 走完 quiz 即重置

某份導讀一旦走到 quiz 結束(quizResult),該份的保存進度重置,列表上不再顯示「接續上次」
按鈕——已讀完的導讀下次從頭開始。

### 5. 恢復進度時不自動跳編輯器

還原導讀內容即可,不動編輯器。讀者可能剛切去別的檔案處理事情,自動跳轉會打斷。

改為提供顯式入口:**【回到本步專案位置】** 按鈕(walking 畫面上),並登記為 VS Code
command 以便綁快捷鍵,符合「手不離方向鍵」的設計原則。

> 命名注意:按鈕文案用「回到本步**專案**位置」,不是「回到本步位置」——後者語意含糊。

### 6. 兩個按鈕是不同的東西

| 按鈕 | 位置 | 作用 |
|---|---|---|
| 【接續上次(第 N 步)】 | 導讀列表 | 跨重啟後,跳到該份導讀上次讀到的 step |
| 【回到本步專案位置】 | 走讀畫面 | 把編輯器跳回當前 step 對應的程式碼行範圍 |

### 7. session 內細節狀態靠 `retainContextWhenHidden`

在 `registerWebviewViewProvider` 加 `webviewOptions: { retainContextWhenHidden: true }`,
讓同一 session 內的捲動位置、已展開術語註解原樣保留。跨重啟則靠 host 回灌。

已知代價:面板隱藏時 webview context 仍佔記憶體(`dist/webview.js` 2.6 MB + Shiki)。
此代價已知悉並接受。

## 待 design 階段決定(非需求問題)

- 保存位置與資料結構(預期 `workspaceState`,與 `AttemptStore` 同一套路)
- 跨重啟恢復時 anchor 可能已失準,與 stale-step-detection 的互動方式
- quiz 作答中狀態如何納入 protocol 而不過度膨脹訊息面積
- 「接續上次」按鈕在導讀列表上的視覺呈現與既有「更多動作」選單的關係
