## Context

`WalkPlayerViewProvider` 目前把「讀到哪」完全放在記憶體:`currentWalk` / `currentWalkPath` /
`stepIndex` / `anchorReport` 都是 provider 的 field。provider 本身活在 extension 生命週期,
不會因為側邊面板隱藏而消失——**狀態一直在手上,只是沒有回灌**。

`webviewReady` 的處理只送 `themeChanged` 與 `walkFileList`(`src/viewProvider.ts:59-62`),
所以 webview 每次重建都停在導讀列表。

既有可沿用的元件:

| 元件 | 可沿用之處 |
|---|---|
| `src/attemptStore.ts` | `workspaceState` + 單一 STORAGE_KEY + 相對路徑索引 + ref 比對的完整寫法 |
| `viewProvider.jumpToCurrentStep()` | 已封裝「錨驗證 → 有效行號 → 跳轉」,【回到本步專案位置】直接重用 |
| `buildAnchorReport()` | 載入時一次算完錨驗證,接續進度時照跑不必特例 |
| `ui/main.ts` 的 `#app` 鍵盤事件 | 既有快捷鍵是 webview 內監聽,不是 `contributes.keybindings` |

約束:webview 禁碰 vscode API,兩端只能經 `shared/protocol.ts` 溝通;`ui/` 的狀態機
(`ui/state.ts`)以 `screen` 欄位區分 fileList / walking / quiz / quizResult 四種畫面。

## Goals / Non-Goals

**Goals:**

- 同一 session 內切換面板再回來,讀者感覺不到 webview 曾被重建
- 跨 VS Code 重啟後,每份導讀各自記得讀到第幾步,並在列表上提供顯式接續入口
- 任何「恢復」動作都不擅自改動編輯器狀態
- 沿用 `AttemptStore` 的儲存慣例,不引入新的持久化機制

**Non-Goals:**

- 不做閱讀歷史(只留最後位置,不留軌跡)
- 不跨 workspace 同步進度(`workspaceState` 本來就是 per-workspace)
- 不在進度裡保存錨驗證結果——恢復時重算,程式碼可能已經變了
- 不處理 `.codewalk.json` 被刪除後 `workspaceState` 殘留的孤兒條目(與 `AttemptStore`
  現況一致,見 Open Questions)

## Decisions

### 決策 1:三層恢復,用 `currentWalk` 是否存在天然區分兩種情境

| 層 | 機制 | 覆蓋情境 |
|---|---|---|
| 1 | `retainContextWhenHidden: true` | 常態切面板——webview 根本不重建,連捲動位置都不變 |
| 2 | host 記憶體回灌 | 同 session 內 webview 真的被重建(view 被拖到別的容器、資源壓力回收) |
| 3 | `workspaceState` + 接續按鈕 | 跨 VS Code 重啟 |

關鍵是第 2、3 層怎麼分辨。答案不必額外標記:**extension host 重啟時 provider 是新建的,
`this.currentWalk` 必為 `undefined`**。所以 `webviewReady` 的分支邏輯是:

```
webviewReady:
  sendTheme()
  sendFileList()          // 一律送,列表資料本來就要有
  if (this.currentWalk)   // 同 session 重建 → 回灌,自動還原
    post walkRestored { walk, stepIndex, ... }
  // 否則什麼都不做 → 停在列表,接續入口由 sendFileList 帶的進度資訊驅動
```

*替代方案*:在 webview 用 `setState` 存一個「上次畫面」旗標來判斷。捨棄——webview 的 state
跨重啟也會被 VS Code 保留,反而分不清兩種情境,且真相來源該在 host。

### 決策 2:進度存 `workspaceState`,結構仿 `AttemptStore`

新增 `src/progressStore.ts`,與 `attemptStore.ts` 同構(同樣接 `AttemptMemento` 介面以便測試,
同樣由呼叫端每次傳入 `workspaceRoot`):

```jsonc
// key: "codewalk.readingProgress"
{
  "docs/onboarding.codewalk.json": { "ref": "a1b2c3d", "stepIndex": 11 },
  "docs/auth-flow.codewalk.json":  { "ref": "9f8e7d6", "stepIndex": 3 }
}
```

**不存「最後開啟的是哪份」**。跨重啟是回到導讀列表、每份導讀各自顯示自己的接續按鈕,沒有
「要自動開哪一份」的問題,這個欄位沒有消費者。

*替代方案*:與作答紀錄共用一份條目。捨棄——兩者生命週期不同(進度會在走完 quiz 時被清除,
作答紀錄要留著給列表顯示),混在一起會讓「清除作答紀錄」與「重置進度」互相牽連。

### 決策 3:`ref` 不符視同沒有進度

沿用 `AttemptStore.get()` 的判斷:記錄的 `ref` 與導讀檔案當前 `ref` 不符時回傳 `undefined`。
導讀重新產生過,原本的「第 12 步」可能已經是完全不同的內容,接續到那裡比從頭開始更糟。

### 決策 4:quiz 答案等細粒度 UI 狀態走 webview 的 `setState`,不進 protocol

`acquireVsCodeApi()` 提供的 `setState()` / `getState()` 正是為 webview 重建而設計——VS Code
會在重建時把 state 還回來。quiz 作答中的答案、已展開的術語、捲動位置都屬於這一類:純 UI、
不需要 host 知道、也不值得為它們擴張協定面積。

分工因此很乾淨:

- **host 管粗粒度**:哪份導讀、第幾步——需要跨重啟、需要寫進 `workspaceState`
- **webview 管細粒度**:答案、展開狀態——只需活過一次重建

`ui/main.ts:25` 的 `acquireVsCodeApi()` 型別宣告目前只有 `postMessage`,需補上
`setState` / `getState`。

> 這一項修正了 clarify 階段的初步假設(當時寫的是「新增 protocol 欄位讓 host 保管 quiz
> 答案」)。需求不變——quiz 作答中仍會恢復已選答案——只是用更省的機制達成。

*替代方案*:webview 每次改答案就 postMessage 給 host 保管。捨棄——把 host 變成 UI 暫存狀態的
代理,每點一個選項一則訊息,協定面積與訊息量都不划算。

### 決策 5:所有「恢復」路徑一律不動編輯器

| 路徑 | 是否跳轉編輯器 |
|---|---|
| 選擇導讀(既有 `loadWalk`) | 跳(既有行為不變) |
| 切換 step(既有 `setStep`) | 跳(既有行為不變) |
| webview 重建回灌(決策 1 第 2 層) | **不跳** |
| 按【接續上次(第 N 步)】 | **不跳** |
| 按【回到本步專案位置】 | 跳 |

讀者切走面板通常是為了處理別的檔案,恢復時把編輯器搶走會打斷正在做的事。作法是給
`loadWalk` 加一個是否 reveal 的選項,而不是在恢復路徑複製一份載入邏輯。

### 決策 6:接續 = 不 reveal 的載入 + `setStep(N)`,錨驗證照常跑

按下【接續上次】走的是既有載入流程(含 `buildAnchorReport`),只是不 reveal 且起始 step 不是 0。
跨重啟後程式碼可能已經改了,錨可能失準——這正是 `stale-step-detection` 既有的職責,恢復流程
不需要任何特例,失準提示會照既有規則顯示。

`stepIndex` 需夾在 `[0, steps.length - 1]`:導讀重新產生後步數可能變少,雖然決策 3 的 ref 比對
已經擋掉大部分情況,邊界仍要守。

### 決策 7:走完 quiz 時清除該份進度

在既有 `handleQuizSubmitted()` 裡,記錄作答紀錄的同時清除該份導讀的進度條目。已讀完的導讀
下次從頭開始,列表上不再出現接續按鈕。

清除進度失敗不影響作答紀錄的留存,也不打斷讀者流程——與既有「紀錄留存失敗不中斷讀者流程」
的處置一致。

### 決策 8:【回到本步專案位置】重用 `jumpToCurrentStep()`

- webview 在走讀畫面顯示按鈕 → 送新訊息 `revealCurrentStep` → host 呼叫既有的
  `jumpToCurrentStep()`,錨驗證與失準降級全部沿用
- 同時註冊 `codewalk.revealCurrentStep` command(供 command palette 與使用者自綁快捷鍵),
  handler 與訊息共用同一個方法
- webview 內另綁鍵盤快捷鍵,與既有上一步/下一步同樣走 `#app` 的 keydown 監聽,不用
  `contributes.keybindings`——沿用專案現有作法

按鈕文案定為「回到本步**專案**位置」,不用「回到本步位置」——後者容易被讀成導讀內的位置。

### 決策 9:進度在每次 `setStep` 時寫入

`workspaceState.update()` 是記憶體更新 + 非同步落地,成本低,`AttemptStore` 也是直接寫。
不做節流——節流會讓「切了 step 立刻關掉 VS Code」漏掉最後一步。

### 決策 10:接續入口併入導讀列表既有的紀錄版位

列表項目已經會顯示作答紀錄。接續入口放在同一區塊,沿用既有版位規則:沒有進度時不顯示、
不保留空白版位。`shared/protocol.ts` 的 `WalkFileSummary` 加一個選填的進度欄位,與既有
`lastAttempt?` 同樣的可選寫法。

視覺上跟隨編輯器主題變數,不自帶配色(專案既有設計原則)。

> **人工驗收後修訂**:本決策原本設想接續按鈕是「文字徽章」,與既有作答紀錄的常駐色塊
> (通過圖示 + `4/5` + 相對時間)並列。實際在 Extension Development Host 驗收時發現三塊
> 常駐色塊在列表項目一多、面板變窄時視覺過重,且「接續上次(第 N 步)」文字會把中文標題
> 擠成逐字換行。改為兩輪調整:
>
> 1. 接續入口先簡化成「圖示 + 步數」(不帶文字),解決標題擠壓問題
> 2. 進一步把三個元素統一成無底色純圖示並排(`✓ 通過狀態` `▶ 接續` `⋮ 更多動作`):
>    通過/未通過與接續維持一眼可見、可直接互動(接續是常用動作,不藏進選單);分數細節
>    (`4/5`、相對時間)與「清除 Quiz 紀錄」收進既有的「更多動作」揭露式選單,呼應
>    「危險/次要操作才用選單」的既有原則(design.md 決策 6 的延伸)。分數細節的顯示方式
>    也從常駐文字改為 hover/focus 才出現的自製 tooltip(沿用既有 `.codewalk-attempt-tooltip`
>    機制,原生 `title` 在 webview 裡不生效)。
>
> `WalkFileSummary.progress` 欄位本身、`ref` 比對邏輯不受影響,只有 `ui/render.ts` 的
> 呈現方式改變。

## Risks / Trade-offs

**[回灌路徑日常幾乎不會觸發,容易寫錯又測不到]** → 決策 1 第 1 層生效後,第 2 層在日常使用中
很少發生。緩解:把「該不該回灌、回灌什麼」抽成不依賴 vscode runtime 的純函式做單元測試;手動
驗證用「把 CodeWalk view 從側邊欄拖到 Panel」——這會重建 webview 但不重啟 extension host,
正好是第 2 層的情境。

**[`retainContextWhenHidden` 讓面板隱藏時仍佔記憶體]** → `dist/webview.js` 2.6 MB 加 Shiki,
面板隱藏後不會釋放。此代價已在 clarify 階段確認接受。緩解:僅此一個 webview view,不會累積;
若日後成為問題,拿掉這一層仍有第 2 層回灌兜底,體驗只損失捲動位置與展開狀態。

**[進度與作答紀錄兩份條目可能不一致]** → 例如進度指向第 5 步、作答紀錄卻顯示已通過。緩解:
決策 7 讓走完 quiz 即清進度,正常流程下兩者互斥;決策 3 的 ref 比對是第二道防線。

**[`workspaceState` 累積孤兒條目]** → 導讀檔案被刪除後,進度條目不會自動清掉。與
`AttemptStore` 現況相同,不在本次處理(見 Open Questions)。

**[webview `setState` 與 host 進度可能對不上]** → 例如 host 記第 5 步、webview state 留著第 3 步
的 quiz 答案。緩解:回灌時以 host 送來的 walk 與 stepIndex 為準,webview state 只在
「同一份導讀、同一個 ref」時才採用,否則丟棄。

## Migration Plan

無資料遷移:`codewalk.readingProgress` 是新的 `workspaceState` key,既有使用者讀不到進度,
列表上就不顯示接續按鈕,行為與現況相同。

回退:移除 `webviewOptions` 與新增的訊息處理即可回到現行行為;殘留的 `workspaceState` 條目
不影響舊版程式(舊版不讀這個 key)。

## Open Questions

- 孤兒條目清理:是否要在 `listWalkFiles` 掃描時順手清掉已不存在的導讀對應條目?這會同時適用
  於作答紀錄,屬於既有問題,建議另開 change 一併處理,不混進本次範圍
- webview 內【回到本步專案位置】的快捷鍵鍵位:需避開既有上一步/下一步與瀏覽器預設行為,
  實作時確認
