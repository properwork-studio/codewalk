## Why

讀者做完 quiz 後,整份成績就消失了——回到導讀列表只看得到一排標題,分不出哪些走過、哪些還沒碰、哪份上次沒過關該回頭再做一次。讀者被迫自己記,結果就是不記,導讀變成一次性消耗品而不是可回頭自測的材料。

## What Changes

- 讀者送出 quiz 後,系統記下該份導讀**最後一次**的作答時間與結果(分數、題數、是否過關),覆蓋前一次紀錄
- 導讀列表在每份導讀標題底下顯示該筆紀錄:過關圖示 + 分數 + 相對時間(例:`✓ 4/5 · 3 天前`);**沒有紀錄的導讀不顯示任何後置文字**,不留空位
- 相對時間帶小時級精度(剛剛 / N 分鐘前 / N 小時前 / 昨天 / N 天前 / 超過 30 天顯示絕對日期),滑鼠停留顯示完整時間
- 列表上每筆紀錄可單獨清除:點第一下轉為「確定?」,點第二下才真的刪除;滑鼠移出該列、按 Esc 或切換畫面即復原
- 作答紀錄**不阻擋任何既有行為**——有紀錄的導讀照樣可以重走、重做 quiz,入口與流程完全不變
- 紀錄存於 VS Code `workspaceState`,**不寫進 `.codewalk.json`**——非破壞性變更,既有導讀檔案完全不需要改

## Capabilities

### New Capabilities

無。作答紀錄是既有播放器能力的延伸,不構成獨立模組。

### Modified Capabilities

- `walk-player`:新增「作答紀錄」相關 requirement——送出 quiz 後持久化最後一次結果、導讀列表顯示紀錄(無紀錄時不顯示)、相對時間格式規則、單筆紀錄的兩段式清除互動

## Impact

**受影響的程式碼**

| 檔案 | 變更 |
|---|---|
| `shared/protocol.ts` | `WalkFileSummary` 新增選填的作答紀錄欄位;`WebviewToHostMessage` 新增清除單筆紀錄的訊息與其 parser 分支 |
| `src/extension.ts` | 把 `ExtensionContext` 傳給 `WalkPlayerViewProvider`(目前沒傳) |
| `src/viewProvider.ts` | 補存當前導讀路徑(`loadWalk(path)` 目前用完即丟);填實目前空著的 `quizSubmitted` case;處理清除訊息;`sendFileList` 帶上紀錄 |
| 新檔(host 側) | 作答紀錄的讀寫封裝(key 組成、序列化、查詢) |
| `ui/render.ts` | `renderFileList` 渲染紀錄列與清除鈕 |
| `ui/main.ts` | 清除互動的「確定?」暫態與復原條件 |
| 新檔(shared 或 ui 側) | 相對時間格式化(純函式,Vitest 覆蓋) |

**不受影響**

- `shared/schema.ts` 與 `.codewalk.json` 對外格式:完全不動,既有導讀檔案不需重新產生
- quiz 結果頁、走讀畫面、步驟導覽、檔案跳轉:一律不改

**相依**

- 依賴 VS Code `Memento` API(`context.workspaceState`),無新增第三方套件
- 紀錄 key 綁 `ref`,沿用既有「衍生快照紀律」:導讀重新產生(`ref` 變更)後舊紀錄不再顯示

## Out of Scope

- 「清除全部紀錄」的 Command Palette 指令
- 作答歷史、最佳成績、進步曲線——只留最後一次
- quiz 結果頁的「上次 2/5 → 這次 4/5」對比
- 走讀畫面頂部的成績提醒
- 跨機器 / 跨 clone 同步(`workspaceState` 換機器即歸零,為已知取捨)
- 逐題答對率等細部統計
- 孤兒紀錄清理:導讀檔刪除或 `ref` 變更後,舊紀錄留在 `workspaceState` 但查不到即不顯示,不做垃圾回收

## Open Questions

1. **分數由 host 端算,還是由 webview 在送出訊息時附帶?** 計分邏輯目前住 `ui/state.ts` 的 `submitQuiz`(webview 側);host 自行以 `correctIndex` 比對並套用 `resolvePassThreshold()` 等於實作第二份,但把 `score`/`passed` 放進 postMessage 又讓協定訊息變重。屬分層決策,留到 design 階段定案,會綁死協定形狀。
