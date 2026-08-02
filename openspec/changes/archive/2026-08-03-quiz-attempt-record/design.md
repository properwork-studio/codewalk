## Context

播放器目前是無狀態的:每次開啟面板都從零開始,`quizSubmitted` 訊息通道雖然已經存在,但 host 端 `src/viewProvider.ts:100` 是個空 `case`——分數送到 host 就丟掉了。導讀列表(`ui/render.ts:25` 的 `renderFileList`)只渲染 `WalkFileSummary { path, title }`,沒有任何額外資訊可顯示。

本次要引入播放器的**第一個持久化狀態**。這是架構上的新面向,設計重點不在演算法,而在:狀態存哪裡、用什麼當身分、跨層(host ⇄ webview)怎麼流動,以及不能污染 `.codewalk.json` 這個對外開放格式。

**既有約束**

- 分層硬規則:`ui/` 禁碰 vscode API,持久化只能發生在 host 側
- `.codewalk.json` 是對外合約,欄位變更視同破壞性變更
- 衍生快照紀律:`ref` 釘住產出當下 commit,導讀不維護、過期即刪
- 抽象門檻 rule of three:重複第三次才抽共用
- MVP 無自動化 E2E,純邏輯靠 Vitest 覆蓋,整合行為走手動驗證 checklist

## Goals / Non-Goals

**Goals**

- 讀者送出 quiz 後,結果自動留存,回到列表就看得見,不需任何額外操作
- 沒作答過的導讀在視覺上完全不受影響(不留空位、不顯示佔位符)
- 紀錄過期(導讀重新產生)時自動失效,不顯示會誤導的舊分數
- 純邏輯(相對時間格式化、計分、紀錄查詢)可被 Vitest 完整覆蓋,不依賴 VS Code runtime

**Non-Goals**

- 不做作答歷史或最佳成績——只留最後一次
- 不做跨機器同步
- 不改 quiz 結果頁、步驟導覽本身的判斷邏輯
- 不改 `.codewalk.json` schema
- 不做孤兒紀錄的垃圾回收

> 手動驗證階段追加範圍(見決策 5 附註、決策 9):走讀畫面新增「返回列表」屬於既有 MVP 缺口的補完,不是「作答紀錄」功能本身的一部分,但因使用者在驗證本次變更時一併發現、且改動很小,決定併入本次一起做並補文件,而非另開一個 change。

## Decisions

### 決策 1:紀錄存 `context.workspaceState`,不寫回 `.codewalk.json`

**選擇**:VS Code `Memento`(`context.workspaceState`)。

**理由**:作答紀錄是**讀者的個人狀態**,不是導讀內容。三者的分野決定了存放位置——導讀內容屬於作者、進 git、多人共享;作答紀錄屬於讀者、不該進 git、每個人各自獨立。寫回 JSON 會讓這條界線消失:每做一次 quiz 就弄髒一個 git 追蹤的檔案,同一份導讀給團隊三個人看就會產生三方衝突,而且 `.codewalk.json` 是對外開放格式,塞個人狀態進去等同破壞性變更,所有既有導讀檔都要重新產生。

**考慮過的替代方案**

| 方案 | 否決理由 |
|---|---|
| 寫回 `.codewalk.json` 加 `lastAttempt` 欄位 | 個人狀態污染對外格式;動 git 追蹤檔;多人共用衝突;等同破壞性變更 |
| `.codewalk/.progress.json` + `.gitignore` | 看得到、可手動刪是優點,但要自己處理讀寫與併發,且使用者忘了 gitignore 就會 commit 進去 |
| `context.globalState` | 跨 workspace 保留聽起來有用,但用路徑當 key 時反而容易對不上(不同 clone 目錄各存一份仍然分裂),沒換到實質好處 |

**已知取捨**:換機器、重裝 VS Code 或清除 extension 狀態,紀錄就沒了;使用者也無法手動編輯。前者接受(紀錄是輔助,不是資產),後者由決策 5 的清除功能補上。

### 決策 2:紀錄身分 = 導讀路徑 + `ref`,`ref` 不符即視同未作答

**選擇**:每份導讀只存一筆紀錄,紀錄內帶 `ref`;讀取時比對當前導讀檔的 `ref`,不符就當作沒有紀錄。

**理由**:導讀是衍生快照,重新產生時 `ref` 一定變,而 quiz 題目很可能整組換了。若只用路徑當 key,新導讀會沿用舊分數,列表顯示「上次 4/5」但那 4 題已經不存在——這是會誤導讀者的假資訊。綁 `ref` 讓紀錄跟著快照走,語意與專案既有的漂移偵測(`src/refDrift.ts` 比對 HEAD 與 `ref`)一致。

**考慮過的替代方案**

- **只用路徑**:最省事,但上述誤導問題無解
- **路徑 + quiz 內容 hash**:更精準(`ref` 變但題目沒改仍保留紀錄),代價是要自己定義 hash 的穩定性規則、處理選項順序等邊界,MVP 階段偏重

**已知取捨**:導讀只改個錯字重新產生,`ref` 一變紀錄就歸零。可接受——導讀本來就不維護、過期即刪。

### 決策 3:儲存結構是單一 key 的 map,key 用 workspace 相對路徑

**選擇**:`workspaceState` 只用一個 key,value 是以導讀相對路徑為索引的 map。

```jsonc
// key: "codewalk.quizAttempts"
{
  ".codewalk/2026-08-01-codebase-tour.codewalk.json": {
    "ref": "d463be3",       // 寫入當下該導讀檔的 ref,讀取時比對
    "at": 1754050080000,    // host 端 Date.now(),epoch 毫秒
    "score": 4,
    "total": 5,
    "passed": true
  }
}
```

**理由**

- **每個路徑只留一筆**:直接落實「只記最後一次」,新紀錄覆寫舊的,結構上不可能長出歷史
- **`ref` 存在 value 而非 key**:同一份導讀不會累積多個 `ref` 的殘骸,天然沒有孤兒紀錄累積的問題(每份導讀上限一筆,量級是幾十 bytes)
- **相對路徑**:repo 整個搬到別的目錄後紀錄還在;絕對路徑會失聯
- **`score`/`total`/`passed` 一起存成快照**:顯示列表時不必回頭重算門檻,`total` 與 `passed` 是寫入當下的事實,與 `ref` 一起構成一致的快照

**考慮過的替代方案**:扁平 key(`codewalk.attempt:<path>::<ref>`)一筆一個 Memento key。否決——清除單筆時要掃 `keys()` 做前綴比對,而且同一份導讀重複產生會不斷累積殘骸,需要額外的 GC 邏輯。

### 決策 4:計分函式上移到 `shared/schema.ts`,host 與 webview 共用(解決 proposal 的 Open Question)

**選擇**:把計分抽成 `shared/schema.ts` 的匯出函式,緊鄰既有的 `resolvePassThreshold()`;`ui/state.ts` 的 `submitQuiz()` 改為呼叫它,host 寫入紀錄時也呼叫它。`quizSubmitted` 協定訊息**維持現狀**(只帶 `answers`)。

```ts
// shared/schema.ts
export function scoreQuiz(walk: CodewalkFile, answers: readonly number[]): {
  score: number; total: number; passed: boolean;
}
```

**理由**:「幾分算過關」是行為合約的一部分,不是實作細節——證據是 `resolvePassThreshold()` 早就住在 `shared/schema.ts` 而不是 `ui/`。計分緊貼門檻,兩者分家才是反常。host 自己寫第二份 reduce 雖然只有五行,但規則一旦變複雜(例如加權題),兩份實作會無聲分歧,而分歧的症狀是「結果頁顯示過關、列表顯示未過關」這種最難查的 bug。

**與 rule of three 的關係**:這不是為了消除重複而建新抽象——`shared/` 已經存在且已經是 schema 與門檻的單點,這只是把同一族的邏輯移到它本來該在的位置,沒有新增抽象層。

**考慮過的替代方案**

- **host 自行以 `correctIndex` 比對**:協定完全不動,但如上,產生第二份計分真相
- **`quizSubmitted` 附帶 `score`/`passed`**:單一計分來源,但協定訊息變重,且讓 host 的持久化內容取決於 webview 送什麼——host 是儲存的擁有者,應該自己從 `answers` 導出結論

### 決策 5:清除以路徑為單位,webview 不需要知道 `ref`

**選擇**:新增 `{ type: 'clearAttempt'; path: string }` 訊息;host 收到後刪除 map 中該路徑的整筆紀錄,再重送 `walkFileList`。

**理由**:`WalkFileSummary` 不需要為了清除而多帶 `ref`——webview 只認得「這一列」,以路徑為單位刪除既符合使用者直覺(「清掉這份導讀的紀錄」),又讓 webview 對 `ref` 完全無知。刪完重送整份列表而不是做增量更新,是因為列表本來就會在 `webviewReady` 時整份重建(`ui/main.ts:179`),沿用同一條路徑最省。

> **修訂備註**:協定訊息 `clearAttempt` 本身不受決策 6 的 UI 改版影響——不管觸發清除的是常駐按鈕還是選單項目,host 端收到的都是同一個 `{ type: 'clearAttempt'; path }`,這裡的設計維持原樣。

### 決策 6:兩段式清除包在「更多動作」選單裡,狀態住 webview,不用 VS Code modal

> **修訂**(手動驗證階段):原訂做法是列表上一個常駐的獨立清除鈕(trash 圖示),手動驗證時使用者反映「看起來像要刪除導讀檔案,而不是清除 Quiz 紀錄」——常駐的 trash 圖示與「刪除檔案」的視覺慣例衝突太強。改為把清除動作收進一個 `⋮`(kebab)選單入口,選單裡只有一個項目「清除 Quiz 紀錄」,用文字明確表達動作對象,不再借用容易誤讀的圖示語意。以下為修訂後的設計。

**選擇**:每份有 `lastAttempt` 的導讀項目旁多一個 `⋮` 選單入口(`aria-haspopup`/`aria-expanded`);點擊展開一個只有單一項目「清除 Quiz 紀錄」的小面板。fileList state 新增 `openMenuPath: string | null`(同時只有一份導讀的選單能展開)取代原本的常駐清除鈕。選單內的清除項目沿用兩段式確認:第一次觸發文字變「確定清除?」(`pendingClearPath: string | null`),第二次才送出 `clearAttempt` 並收合選單。復原條件簡化為:按 Esc、或點擊選單以外任何位置——兩者都收合選單並捨棄確認狀態;開啟另一份導讀的選單會自動收合前一個(`openMenuPath` 本身就是單一值,天然滿足「同時最多一個」)。

**理由**:webview 內 `confirm()` 會凍住整個面板(CSP 與 webview 生命週期的已知地雷),所以「跳確認」只剩 host 端 `showWarningMessage({ modal: true })` 一途——為了一個重做 quiz 就能救回來的紀錄,彈一個阻斷式 modal 太重。兩段式點擊不離開面板、不阻斷,誤點的代價是再點一下才生效。選單這層額外的「先點開才看得到清除項目」本身也是一種輕量防呆:不小心滑過去不會誤觸,比常駐按鈕更難誤點。

**不用單一項目的完整 ARIA menu widget**:選單永遠只有「清除 Quiz 紀錄」這一個動作,沒有計畫擴充第二項。實作成完整 `role="menu"`/`role="menuitem"` 並搭配方向鍵環狀導覽,是為多項目選單設計的互動模式,套在單一動作上是無謂的複雜度(rule of three 的精神同樣適用於互動模式,不只適用於程式碼抽象)。改用「揭露按鈕 + 一個一般 `<button>`」的輕量 disclosure 模式:`aria-haspopup`/`aria-expanded` 給出語意提示,展開後的項目是普通按鈕,Tab 順序天然是「入口 → 項目 → 下一列」,不需要自訂鍵盤導覽邏輯。

**點擊外部收合的實作陷阱**:webview 每次狀態變更都整棵樹重繪(`root.innerHTML = ''`),若用「點擊事件的 target 是否仍是選單的子孫節點」判斷點外部,會撞上時序問題——按鈕自身的 click handler 已經同步呼叫 `render()` 銷毀舊 DOM,等事件冒泡到 `document` 監聽器時,原始 target 的 `parentNode` 鏈已經斷了,導致「點選單本身」被誤判為「點外部」而立刻收合剛打開的選單。改用 `event.composedPath()`——瀏覽器在事件**派發當下**就固定這份路徑,不受後續 DOM 變動影響,可靠判斷「這次點擊當下是否發生在選單範圍內」。

**不用計時器自動復原**:計時器要測就得注入時鐘或等待,而 Esc/點擊外部是純事件驅動,單元測試好寫。

**鍵盤可及性**:選單入口與選單內的清除項目都是原生 `<button>`,天生可 Tab 聚焦、Enter/Space 觸發;選單展開時額外把焦點移到選單項目上(而非留在入口按鈕上),讓「開啟選單」與「觸發清除」之間不需要多按一次 Tab。

### 決策 7:相對時間格式化是 webview 側的純函式,`now` 由參數注入

**選擇**:新增 `ui/relativeTime.ts`,匯出 `formatRelativeTime(at: number, now: number): string`。階梯:

| 條件 | 輸出 |
|---|---|
| `< 1 分鐘` | 剛剛 |
| `< 60 分鐘` | N 分鐘前 |
| `< 24 小時` | N 小時前 |
| 日曆日差 = 1 | 昨天 |
| 日曆日差 2–30 | N 天前 |
| 日曆日差 > 30 | `YYYY-MM-DD` |

分鐘/小時級以「距今毫秒」判定,天級以**日曆日差**判定(不是 24 小時倍數)——「昨天 23:50 做的,現在早上 8 點」讀者認知是昨天,不是「8 小時前」的隔壁那格。兩套判準的交界在 24 小時處,以毫秒判準優先。

**放 `ui/` 不放 `shared/`**:host 完全不需要格式化,它只存 epoch 毫秒。`shared/` 的定位是**跨層合約**(協定與 schema),放單邊使用的顯示邏輯進去會稀釋那個定位。

**`now` 走參數注入**而非函式內取用系統時間,是為了讓 Vitest 能直接餵固定時間測每一格邊界,不必 mock 全域時鐘。

### 決策 8:寫入失敗靜默忽略,不打斷 quiz 流程

**選擇**:`workspaceState.update()` 失敗時不彈錯誤、不阻斷,讀者照樣看到結果頁。

**理由**:紀錄是輔助功能,失敗的後果只是「列表少一行字」。為此中斷讀者剛答完題的正回饋,代價遠大於收益。

### 決策 9(手動驗證階段追加):走讀畫面補上「返回列表」

**背景**:手動驗證本次變更時發現,走讀畫面(`renderWalking`)完全沒有離開的出口——原本只有走到最後一步進 quiz、或在 quiz 結果頁才有「回到導讀列表」。這是既有 MVP 的既存缺口,`.codewalk.json` schema 與作答紀錄機制都不涉及,嚴格說不屬於本次變更的範圍(design.md 原本的 Non-Goals 明講「不改走讀畫面…的任何行為」)。但使用者評估改動很小、且是驗證本次功能時自然發現的相鄰問題,決定併入本次一起修,不另開一個 change。

**選擇**:`renderWalking` 頂部新增一個「返回列表」按鈕(沿用 quiz 結果頁「回到導讀列表」的 `list-unordered` 圖示與字樣,保持一致);同時比照方向鍵的既有鍵盤優先原則,加上 Esc 快捷鍵。觸發後直接回到導讀選擇畫面,`webviewReady` 帶回最新列表(含剛才可能已存在的其他導讀紀錄)。

**不留下作答紀錄**:這條路徑不會觸發 `quizSubmitted`,自然不會寫入任何紀錄,與「作答中途取消」的既有語意一致——沒完成 quiz 就沒有紀錄。

**Esc 衝突檢查**:走讀畫面目前沒有其他功能佔用 Esc;導讀列表畫面另外用 Esc 收合清除選單(決策 6),兩者分屬不同 screen 的鍵盤事件分支,互不影響。

## 資料流

```
webviewReady / clearAttempt 後
  host: listWalkFiles() → 逐檔讀取 ref → 查 map → ref 相符才附上 lastAttempt
  host → webview: { type: 'walkFileList', files: [{ path, title, lastAttempt? }] }

送出 quiz
  webview → host: { type: 'quizSubmitted', answers }
  host: scoreQuiz(currentWalk, answers) → 以 currentWalkPath + currentWalk.ref 寫入 map
  (不回推;回列表時 webview 會重送 webviewReady,自然拿到新紀錄)

清除
  webview → host: { type: 'clearAttempt', path }
  host: 刪除 map[相對路徑] → 重送 walkFileList
```

**協定變更**

```ts
// shared/protocol.ts
export interface AttemptSummary {
  at: number;        // epoch 毫秒
  score: number;
  total: number;
  passed: boolean;
}

export interface WalkFileSummary {
  path: string;
  title: string;
  lastAttempt?: AttemptSummary;   // 新增,選填——無紀錄或 ref 不符時不出現
}

// WebviewToHostMessage 新增
| { type: 'clearAttempt'; path: string }
```

`lastAttempt` 選填是刻意的:「沒有紀錄」用**欄位不存在**表達,而不是塞一個空物件或 `null`,渲染端的判斷就是單純的「有沒有這個欄位」,不會有「有物件但值是零分」的模糊地帶。

## 元件清單

**新增**

| 路徑 | 職責 |
|---|---|
| `src/attemptStore.ts` | host 側紀錄讀寫:包 `Memento`,負責絕對↔相對路徑轉換、`ref` 比對、寫入/刪除/查詢 |
| `ui/relativeTime.ts` | 相對時間格式化純函式(決策 7) |
| `src/attemptStore.test.ts`、`ui/relativeTime.test.ts` | Vitest 覆蓋 |

**修改**

| 路徑 | 變更 |
|---|---|
| `shared/schema.ts` | 新增 `scoreQuiz()`(決策 4) |
| `shared/protocol.ts` | `AttemptSummary`、`WalkFileSummary.lastAttempt`、`clearAttempt` 訊息與 parser 分支 |
| `src/extension.ts` | 把 `ExtensionContext` 傳進 `WalkPlayerViewProvider` |
| `src/viewProvider.ts` | 建構子收 context;補存 `currentWalkPath`;填實 `quizSubmitted`;處理 `clearAttempt`;`sendFileList` 附上 `lastAttempt` |
| `src/walkLoader.ts` | `listWalkFiles` 需回傳或保留 `ref` 供比對 |
| `ui/state.ts` | `submitQuiz` 改呼叫 `scoreQuiz`;fileList state 加 `pendingClearPath` |
| `ui/render.ts` | `renderFileList` 渲染紀錄列與清除鈕 |
| `ui/main.ts` | 清除互動的確認態與復原條件 |

**UI 沿用既有慣例**:圖示走既有 `icon()` helper 的 codicon(過關 `check` / 未過關 `close`,清除 `trash`),顏色一律用 VS Code CSS 變數(`--vscode-charts-green`、`--vscode-errorForeground`、`--vscode-descriptionForeground`),不自帶配色——與 `codewalk-file-item` 現有樣式同一套。紀錄列的視覺層級低於標題(次要文字色、小一號),不搶焦點。

## Risks / Trade-offs

- **[讀者換機器或重裝後紀錄全失,以為是 bug]** → 決策 1 的已知取捨。文件(`docs/modules/walk-player.md` 已知限制)明列;不做 UI 提示,避免為邊緣情境增加噪音
- **[`sendFileList` 現在要多讀每個檔案的 `ref`]** → `listWalkFiles` 本來就已經逐檔 `loadCodewalkFile()` 解析全文(`src/walkLoader.ts:32`),`ref` 是現成的,不增加 I/O
- **[`ref` 一變紀錄就消失,讀者可能覺得「我明明做過」]** → 這正是決策 2 要的行為;顯示過期分數的誤導性更高。導讀重產本來就等於換一份材料
- **[兩段式清除誤觸:點一下沒反應會讓人再點一下,反而更容易刪掉]** → 確認態必須有明確的視覺變化(圖示換成文字「確定?」並改用警示色),讓第二下是有意識的動作,而不是「以為沒反應」的重試
- **[`scoreQuiz` 移到 `shared/` 動到既有的 quiz 計分路徑]** → 這條路徑目前有 `ui/state.test.ts` 覆蓋;移動時保持函式行為完全不變,既有測試必須全綠才算安全,不順手改計分規則

## Migration Plan

無資料遷移——首次啟用時 `workspaceState` 沒有該 key,查詢一律回傳「無紀錄」,列表行為與現況完全相同。

**Rollback**:移除功能即可,`workspaceState` 殘留的 key 不影響任何既有行為(沒有程式碼會讀它),不需要清理步驟。`.codewalk.json` 全程未動,既有導讀檔案在任何版本下都能正常載入。

## Open Questions

無。proposal 列出的「分數由 host 算還是 webview 帶」已由決策 4 定案。
