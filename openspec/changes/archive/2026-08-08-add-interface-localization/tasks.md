# tasks — 介面語言雙語化

## 建議開發方式

本變更橫跨三類元件,各段對應不同作法:

| 段落 | 元件類型 | 作法 |
|---|---|---|
| 1、2 | 協定與 schema(`shared/`) | **tdd skill**——`t()`、`resolveLocale()`、`formatRelativeTime` 都是純函式,red-green-refactor 最直接 |
| 3–5 | webview UI(`ui/`) | 直接實作 + 既有 jsdom 測試;文案抽 key 是機械工作,測試斷言不動 |
| 6、7 | extension host(`src/`) | 直接實作;`getHtml()` 與 `activate()` 的變更靠 Extension Development Host 驗證 |
| 8 | manifest 與文件 | 直接實作 |

**切片原則**:第 1 段起每段都是可獨立驗證的端到端切片——切換 VS Code 顯示語言到 English、重載視窗,該段負責的畫面即應完全英文。不要先把所有字串抽完再一起接 `t()`。

**AFK/HITL**:未標注者為 AFK(agent 可獨立完成)。HITL 集中在英文文案審閱與發布前的手動驗證。

---

## 1. i18n 骨幹與導讀列表切片

- [x] 1.1 建立 `shared/i18n.ts`:`Locale` 型別、`zhTW` 表(`as const`)、`TranslationKey = keyof typeof zhTW`、`en: Record<TranslationKey, string>`、模組層 locale 狀態(預設 `'en'`)、`setLocale()`、`t(key, params?)` 的 `{name}` 插值。先只放 `fileList.` 前綴的 key
- [x] 1.2 以 tdd 寫 `shared/i18n.test.ts`:`t()` 單一與多個參數插值、參數缺漏時佔位符原樣保留、未呼叫 `setLocale()` 時回傳英文
- [x] 1.3 以 tdd 實作 `resolveLocale(language)` 使 interface-localization 的「繁體中文編輯器」「英文編輯器」「簡體中文編輯器歸入中文」「系統未提供對應語言時降級為英文」「無法取得顯示語言」五個 scenario 的判定部分可通過(純函式層級)
- [x] 1.4 `src/extension.ts` 的 `activate()` 首行呼叫 `setLocale(resolveLocale(vscode.env.language))`;`src/viewProvider.ts` 的 `getHtml()` 把 `<html lang>` 從寫死的 `zh-Hant` 改為依 locale 輸出 `zh-Hant` 或 `en`
- [x] 1.5 `ui/main.ts` 模組頂層(`import` 之後、`acquireVsCodeApi()` 附近)呼叫 `setLocale(resolveLocale(document.documentElement.lang))`,並加註解說明兩個 bundle 各持一份模組狀態、兩邊都必須各自設定
- [x] 1.6 `ui/render/fileList.ts` 的 5 條文案抽成 `fileList.` key 並補英文;既有測試檔加 `beforeEach(() => setLocale('zh-tw'))` 使斷言不需改寫(該檔原無 render 測試,已隨 9.3 新建)
- [x] 1.7 **切片驗收(HITL)**:Extension Development Host 切換顯示語言為 English 並重載視窗,導讀選擇畫面完全英文;切回繁中則完全繁中——已由使用者於 EDH 手動確認通過

## 2. 相對時間與英文單複數

- [x] 2.1 以 tdd 在 `shared/i18n.ts` 補 `time.` 前綴 key,分鐘與小時級距各備單數與複數兩條(繁中兩條內容相同,英文分別為 `minute`/`minutes`、`hour`/`hours`)
- [x] 2.2 以 tdd 改寫 `ui/relativeTime.ts` 的 `formatRelativeTime`,使 walk-player delta 的「剛送出的紀錄」「數小時前的紀錄」「跨日但未滿 24 小時的紀錄」「前一個日曆日的紀錄」「數天前的紀錄」「超過一個月的紀錄」六個繁中 scenario 維持通過
- [x] 2.3 以 tdd 補英文情境測試,使「英文介面的剛剛級距」「英文介面的單數形」「英文介面的複數形」「英文介面的日曆日級距」四個 scenario 可通過——特別確認 `1 minute ago` 不會變成 `1 minutes ago`
- [x] 2.4 確認 `formatAbsoluteDate` 與 `formatAbsoluteDateTime` **完全未被改動**,並補測試使「英文介面的絕對日期維持同一格式」「查看完整時間」兩個 scenario 可通過

## 3. 走讀畫面切片

- [x] 3.1 `ui/render/walking.ts` 的 14 條文案抽成 `walking.` key 並補英文。注意 `第 {current} / {total} 步` 這類含插值的字串,英文需重排句構為 `Step {current} of {total}` 而非逐字對譯
- [x] 3.2 `ui/render/items.ts` 的 5 條文案抽成 key 並補英文(「容易誤解的地方」「誤解:」「其實:」「以下為產出當時的內容,現行版本已不同」「開啟現行檔案」)——後兩者與 walking.ts 共用的「開啟現行檔案」「找不到檔案」收斂進共用的 `stale.` 命名空間,避免同一段文案在兩檔各維護一份
- [x] 3.3 既有 walking 與 items 相關測試檔加 `beforeEach(() => setLocale('zh-tw'))`(walking.ts、items.ts 原無斷言文案的 render 測試,`items.test.ts` 只測 `classifyDiffLines` 純函式、不受影響,故無需改動)
- [x] 3.4 **切片驗收(HITL)**:英文介面下走讀畫面完全英文,而導讀本身的 step 標題與敘述維持原文——使 interface-localization 的「英文介面播放繁體中文導讀」scenario 成立——已由使用者於 EDH 手動確認通過

## 4. quiz 畫面切片

- [x] 4.1 `ui/render/quiz.ts` 的 16 條文案抽成 `quiz.` key 並補英文
- [x] 4.2 處理 quiz 的三處**組合字串**——`第 {n} 題{(已作答)}`、`已作答 {n} / {total} 題`、`得分 {score} / {total} 題,{通過|未通過}`。英文重新設計為 `Question {n} (answered)`、`{answered} of {total} answered`、`Score {score} of {total}, {status}` 完整句子,不逐字對譯
- [x] 4.3 既有 quiz 相關測試檔加 `beforeEach(() => setLocale('zh-tw'))`(quiz.ts 原無斷言文案的 render 測試,無需改動)
- [x] 4.4 **切片驗收(HITL)**:英文介面下 quiz 作答畫面與結果頁完全英文,而題目、選項與選項解釋維持導讀原文——使「quiz 內容不隨介面語言變動」scenario 成立——已由使用者於 EDH 手動確認通過

## 5. host 側文案

- [x] 5.1 `src/viewProvider.ts`、`fileJump.ts`、`snippetPreview.ts` 的 6 條文案抽成 `host.` key 並補英文,由 host 端翻好再經既有 postMessage 欄位傳出——確認 `shared/protocol.ts` 全程未被改動。`walkLoader.ts`(JSON 解析失敗)與 `themeParsing.ts`(主題 include 過深,實際上被靜默 catch、從未顯示給讀者)兩條在實作中判定屬格式合約診斷/內部診斷同一類,改為固定英文字面、不經 `t()`,與第 6 節的 schema 驗證錯誤同一套處理——已同步更新 `design.md`/`proposal.md` 的元件表反映此判斷
- [x] 5.2 使「錯誤訊息以外的載入失敗提示仍隨介面語言」scenario 可通過:繁中介面下「未開啟 workspace」以繁中呈現
- [x] 5.3 既有 host 相關測試檔(`fileJump.test.ts`、`snippetPreview.test.ts`)加 `beforeEach(() => setLocale('zh-tw'))`,斷言文字不需改寫

## 6. 格式驗證錯誤英文化

- [x] 6.1 `shared/schema.ts` 的 42 條驗證錯誤(41 處 `errors.push()` 加第 307 行的陣列字面值)全部改寫為英文字面,**不經 `t()`**;維持既有的資訊要求——每條仍指出違規欄位的路徑與不符原因
- [x] 6.2 `shared/schema.ts` 檔頭補一段註解,說明驗證錯誤固定英文是刻意的例外與其理由,避免日後被「順手」接進 `t()`
- [x] 6.3 更新 `shared/schema.test.ts` 中比對訊息子字串的 3 處斷言(`陣列`→`array`、`長度`→`length`,×2),使「繁中介面下的格式錯誤」「英文介面下的格式錯誤」兩個 scenario 可通過——兩者顯示的訊息內容必須完全相同(掃過全 repo 測試,無其他測試斷言 schema 錯誤的具體文字)

## 7. manifest 雙語

- [x] 7.1 建立 `package.nls.json`(英文,VS Code 強制的預設)與 `package.nls.zh-tw.json`(繁中覆蓋),涵蓋 `extension.description` 與 4 個 command title
- [x] 7.2 `package.json` 的 `description` 與 4 個 command `title` 改為 `%key%` 引用;`displayName` 與 `category` 維持 `CodeWalk` 不進 nls
- [x] 7.3 **切片驗收(HITL)**:切換顯示語言後開啟指令面板搜尋 CodeWalk,使「英文編輯器的指令名稱」「繁體中文編輯器的指令名稱」兩個 scenario 成立——已由使用者於 EDH 手動確認通過

## 8. 文件與決策修訂

- [x] 8.1 改寫 `README.md` 開頭的介面語言提示——原本標示「介面為繁中」已不成立,改為說明介面隨 VS Code 顯示語言自動切換,並註明導讀內容不受影響
- [x] 8.2 更新 `openspec/decisions.md`:以本次結論取代「介面語言:繁中優先,英文版後補」該條,並新增一條 spec 書寫慣例——scenario 引號內的文案指涉繁中介面的對應元素,英文介面為其譯文
- [x] 8.3 在 `docs/glossary.md` 新增「介面在地化」一節,定義「介面語言(UI locale)」與「導讀內容語言」兩個詞的分界,並註明格式驗證錯誤固定英文的例外

## 9. 收尾與驗證

- [x] 9.1 **(HITL)** 逐條審閱全部英文文案的品質——重點在術語一致性(`walk`、`step`、`quiz` 的譯法全篇統一)與是否有直譯腔。此項回答 design 的 Open Question 1——已由使用者確認通過
- [x] 9.2 以 `grep` 掃 `ui/`、`src/` 的中文字串字面值,確認結果只剩註解與 JSDoc——實測結果乾淨(唯一命中是 JSDoc 內文字誤觸發 grep pattern,非字串字面值)
- [x] 9.3 新建 `ui/render/fileList.test.ts`(該檔原無 render 測試),含「未呼叫 `setLocale()` 時繪製結果為英文」測試,把最容易靜默失敗的路徑釘住;另補 `shared/i18n.test.ts` 的對應單元測試
- [x] 9.4 執行 `pnpm format`(僅重排 `shared/i18n.ts` 兩條長字串,無實質變動)與 `pnpm typecheck`(通過,`0` 錯誤)。另跑 `pnpm build` 確認 host/webview 兩個 bundle 皆成功產出
- [x] 9.5 **驗證通過(HITL)**:自我指涉導讀(`.codewalk/2026-08-07-codebase-tour.codewalk.json`)已重新產生並更新 `ref`,`pnpm test` 276/276 全數通過、`pnpm typecheck` 0 錯誤。Extension Development Host 人工驗證清單全數確認通過:(a) 英文顯示語言下走完「選擇導讀 → 走讀 → quiz 作答 → 結果頁 → 返回列表」全流程,畫面無任何殘留中文;(b) 繁中顯示語言下重跑同一流程,無任何殘留英文(格式驗證錯誤除外);(c) 載入一份格式錯誤的導讀,兩種語言下顯示的錯誤訊息完全相同;(d) 切換顯示語言後確認留存的閱讀進度與作答紀錄仍在。過程中額外發現並修復一個獨立於本次 i18n 範圍的 UX bug(錯誤畫面缺少返回列表按鈕,已修復,詳見 `ui/render/fileList.ts` 的 `renderError`)
