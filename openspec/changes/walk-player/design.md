## Context

CodeWalk 是全新專案,目前 repo 內沒有既有的 `src/`、`ui/`、`shared/` 程式碼,本 design 是第一份技術設計文件,沒有既有慣例可沿用,決策以「MVP 現在的規模 + 一步」為準,不為想像中的未來(如二期產生器、多人協作)預先蓋抽象。

三層架構已在 proposal 定案:`src/`(extension host)⇄ `shared/protocol.ts`(postMessage 訊息型別單一定義)⇄ `ui/`(webview,禁碰 vscode API)。`.codewalk.json` 是對外開放格式,schema 單點住 `shared/schema.ts`,欄位改名/刪除視同破壞性變更。

proposal.md 留下 5 個未決事項,本文件逐一決策。

## Goals / Non-Goals

**Goals:**
- 定案 webview UI 技術選型
- 定案 `.codewalk.json` schema 的錨定方式與術語註解位置
- 定案 MVP 測試策略
- 定案圖解資產路徑

**Non-Goals:**
- 不做 CodeTour `.tour` 匯入相容(見下方決策 5)
- 不在 schema 加熟悉度層級欄位(見下方決策 3)
- 不設計產生器相關的任何介面(二期範圍)

## Decisions

### 1. webview UI 技術:vanilla TS

| 方案 | 解決什麼 | 代價 | 何時回頭改 |
|---|---|---|---|
| vanilla TS + DOM API | 元件少、無 build 複雜度增量、bundle 最小 | quiz 狀態機、術語收合狀態要手刻 render,狀態一多容易寫成一堆 imperative DOM 操作 | webview 內需要獨立管理狀態的元件數 ≥3 個,或任一元件手刻 render 邏輯超過 ~50 行難以維護時 |
| Preact | 宣告式渲染,quiz 這類多狀態互動元件寫起來直覺 | 多一個 runtime 依賴、build pipeline 要處理 JSX/htm、多一層除錯成本 | 一開始就用,不用等 |

MVP 的四個互動面向裡,只有 quiz(題目索引、已選答案、送出後計分、依分數顯示不同提示文案)有中度狀態機,其餘(step 導覽、檔案跳轉、術語收合)都是單一狀態或原生 `<details>` 就能處理,複雜度在 vanilla 可控範圍內。webview 與 host/protocol 層隔離,之後要換 Preact 遷移成本低,不必現在預先引入框架依賴。

**決定:vanilla TS。**

### 2. schema 錨定:`{startLine, endLine}`(單行時兩者相等)

| 方案 | 解決什麼 | 代價 | 何時回頭改 |
|---|---|---|---|
| 單一 `line: number` | MVP 場景(單行高亮)最簡單 | 未來要支援多行反白講解時是破壞性 schema 變更 | 多行反白需求明確出現時 |
| `{startLine, endLine}` | 一種欄位打兩用,不必事後做破壞性變更 | 無額外邏輯分支(MVP 一律 startLine===endLine) | — |

`.codewalk.json` 是對外合約,事後加欄位是破壞性變更;`{startLine, endLine}` 不新增 MVP 要處理的行為分支,只是把資料形狀選成面向擴充不破壞的版本。**這裡只鎖 schema 形狀,不代表要做「多行反白渲染」功能**——播放器 MVP 仍只依 `startLine` 定位並高亮單行,`endLine` 欄位先寫入但渲染邏輯不處理範圍。

**決定:`{startLine: number, endLine: number}`,MVP 一律 `startLine === endLine`。**

### 3. 術語註解:step 內嵌,不做全域字典;不加熟悉度層級

| 方案 | 解決什麼 | 代價 | 何時回頭改 |
|---|---|---|---|
| Step 內嵌 | schema 最簡單,播放器讀取邏輯單純(不用查表) | 同術語跨 step 重複時,內容一致性要靠人工/產生器維護 | 同一份 `.codewalk.json` 內同一術語出現 ≥3 次且需要保證一致性時 |
| 全域字典 + id 參照 | 集中定義、一致性由結構保證 | schema 多一層結構、播放器要做查表渲染、產生器要做去重判斷——而產生器本身是二期功能,目前沒有使用者 | — |

全域字典解決的是一個目前不存在的使用者(自動產生器)的維護痛點,屬於「為以後可能用到而加的彈性」。熟悉度層級同理:proposal 與已定決策都沒有提出使用情境,加進格式只是預先蓋一個沒人用的維度。

**決定:術語註解 step 內嵌;schema 不加熟悉度層級欄位。**

### 4. 整合測試:MVP 手動驗證 checklist + Vitest 覆蓋純邏輯

| 方案 | 解決什麼 | 代價 | 何時回頭改 |
|---|---|---|---|
| 手動驗證 checklist | 零額外 build/CI 成本,一人開發下比寫 test harness 快 | 沒有回歸保護,人為疏漏風險 | 出現第二個貢獻者,或手動測試單輪耗時超過 ~15 分鐘,或曾因忘記手動測而上線壞掉 |
| `@vscode/test-electron` | 真實 VS Code instance,自動化涵蓋 command 註冊、面板開啟、真實檔案操作 | 啟動 Electron instance、CI 設定成本、跑測試慢,對元件少的 MVP 是不成比例的前期投資 | 同上 |

`.codewalk.json` 解析、postMessage 協定序列化、quiz 計分規則、ref 漂移比對邏輯屬純邏輯,不碰 vscode API,一律用 Vitest 覆蓋。真正需要真實 VS Code instance 才能驗證的(面板開啟、檔案跳轉是否定位到正確行號)MVP 走手動 checklist。

**決定:純邏輯(schema 解析/協定序列化/quiz 計分/ref 比對)用 Vitest;extension host 端到端行為用手動驗證 checklist(寫進 tasks.md)。**

### 5. CodeTour `.tour` 匯入相容:不做

生態借力的好處(降低他人上手門檻)不敵範圍蔓延風險——`.tour` 格式沒有術語註解、quiz、ref 漂移警告這些 CodeWalk 核心概念,匯入相容等於要在兩套語意間做轉換與取捨,而 MVP 連自己的格式都還沒經過實戰驗證。

**決定:MVP 不做,非 Goal。**

### 6. 圖解資產路徑:`.codewalk/assets/` 相對路徑

沿用 `.codewalk.json` 本身住在 `.codewalk/` 目錄的慣例,圖片等資產放同目錄下的 `assets/` 子目錄,`.codewalk.json` 內以相對路徑參照,webview 顯示時透過 `asWebviewUri` 轉換(CSP 要求,見版本陷阱)。

**決定:`.codewalk/assets/<file>`,schema 內欄位存相對路徑字串。**

### 7. Quiz 題數與過關門檻:可設定,預設簡單多數(手動驗證階段追加)

MVP 實作完成、進入手動驗證後,使用者要求 quiz 過關門檻(原本固定「5 題、答對 ≥3」)開放可設定。因為這個 change 尚未 archive,直接在既有 artifact 上修訂,不另開新 change。

| 方案 | 解決什麼 | 代價 | 何時回頭改 |
|---|---|---|---|
| 固定 5 題、門檻 3(原決策) | 最簡單,MVP 早期不需要考慮跨導讀差異 | 不同難度/長度的導讀無法有不同的過關標準 | 使用者明確要求可設定時(已發生) |
| `quiz` 題數改為任意 ≥1,新增可選欄位 `passThreshold`,省略時預設 `ceil(題數/2)` | 產生器/人工撰寫者可依導讀難度調整過關標準;省略時的預設值與原本 5 題/3 題行為完全一致,不破壞既有範例檔案 | schema 多一個可選欄位與一個分支;`resolvePassThreshold()` 需要在 webview 端跟 schema 端維持單一計算邏輯 | 若未來需要更複雜的計分規則(如依題目難度加權),再擴充 |

**決定**:`shared/schema.ts` 移除寫死的 `QUIZ_QUESTION_COUNT`/`QUIZ_PASS_THRESHOLD`,改為 `quiz.length >= 1` + 可選 `passThreshold`(驗證範圍 `1 <= passThreshold <= quiz.length`);新增 `resolvePassThreshold(walk)` 作為單一計算點,`ui/state.ts` 的 `submitQuiz()` 改呼叫它,不再各自硬編門檻數字。

## Risks / Trade-offs

- [`{startLine, endLine}` 但 MVP 只用單行語意] → 若後續真的要做多行反白,渲染邏輯要另外設計,但 schema 本身不用再改一次,风险已在決策 2 降低
- [vanilla TS 手刻 quiz 狀態機] → 若 quiz 邏輯後續變複雜(如支援多種題型),回頭條件已於決策 1 列出,屆時遷移 webview 到 Preact 不影響 host/protocol 層
- [手動驗證 checklist 依賴人工執行] → 每次 release 前照 checklist 走一輪,checklist 本身納入 tasks.md 由 apply 階段產出,不是口頭約定
- [不做全域字典可能導致術語內容跨 step 不一致] → MVP 產生器尚未存在(人工/AI 輔助編寫 JSON 的量不大),風險可接受;回頭條件已於決策 3 列出
