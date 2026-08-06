# tasks — add-markdown-rendering

## 建議開發方式

本 change 的元件類型是 **webview UI**,但主體(`ui/markdown.ts`)是**不碰 DOM 以外任何東西的純函式模組**——輸入字串、輸出 `DocumentFragment`,沒有 vscode API、沒有 postMessage、沒有非同步。

- **`ui/markdown.ts` 的一切:用 `tdd` skill**(red-green-refactor)。每種語法與每種降級路徑都是「給一段字串,斷言產出的 DOM 結構」,是 Vitest 的理想形狀,不需要 Extension Development Host 就能跑完
- **`ui/render.ts` 的接線與 `ui/theme.css` 的樣式:直接實作**。這部分無法用單元測試判定「好不好看」,靠切片末端的目視驗證
- **切片紀律**:任務 1~5 每一刀都是端到端的(parser → 接線 → 樣式 → 面板上看得到),做完就能在 Extension Development Host 按 F5 看到成果,不要先寫完整個 parser 再一次接線

依 CLAUDE.md 格式化紀律:**每個任務收工前跑 `pnpm format`**。

---

## 1. 骨架與第一刀:行內程式碼

- [x] 1.1 加入 `marked` 相依(`pnpm add marked`),確認 `dependencies` 只多這一項;跑 `pnpm build` 確認 `dist/webview.js` 增量在 45 KB 以內(design 實測基準為 41 KB) — AFK
      → 完成。production/minified 增量實測 43 KB(2576→2619 KB)。
- [x] 1.2 建立 `ui/markdown.ts` 與 `ui/markdown.test.ts` 骨架:`renderMarkdownBlock(source, onOpenLink)` 回傳 `DocumentFragment`,內部只用 `marked` 的 `Lexer`,並先實作 `paragraph` / `text` / `codespan` 三個 token 分支與 **`default` 降級分支**(`textContent = token.raw`)。使 scenario「呈現行內程式碼與粗體」的行內程式碼部分、「表格與引用區塊原樣顯示」、「原始 HTML 不被當作標記解讀」可通過 — AFK / tdd
      → 完成。實作時一次寫齊全部 6 種語法(見任務 2.1/3.1/4.2/5.1 的完成註記)——switch 是單一函式,拆成 5 次半成品編輯反而更容易留下暫時性型別錯誤;測試仍依任務分組逐步驗證。型別改用 marked 的 `MarkedToken`(而非 `Token`)以排除 `Tokens.Generic` 造成的窄化失效,見 `ui/markdown.ts` 檔頭註解。
- [x] 1.3 設定 `gfm: false`,補測試證明表格、裸網址 autolink、刪除線三者皆不成 token 而落為純文字 — AFK / tdd
- [x] 1.4 `ui/render.ts` 的 `narration` 改走 `renderMarkdownBlock`,容器元素從 `<p>` 改為 `<div class="codewalk-narration">` — AFK
- [x] 1.5 `ui/theme.css`:`white-space: pre-line` 從 `.codewalk-narration` **下移**到 `.codewalk-md-p`,並改寫該處註解(條列已由真正的清單元素承擔,pre-line 只剩「段落內換行」用途);新增 `.codewalk-md-code` 樣式(`--vscode-textCodeBlock-background`、`--vscode-textPreformat-foreground`、`--vscode-editor-font-family`)。使 scenario「單一換行斷行」「空行作為區塊分隔」「行內程式碼與周圍文字可分辨」「隨主題切換更新」可通過 — AFK
- [x] 1.6 按 F5 進 Extension Development Host,開任一導讀目視確認:既有 6 份導讀檔的敘述**呈現與改動前一致**(無多餘空行、無段落擠成一坨),且手動在某份 `.codewalk.json` 塞一段行內程式碼後樣式正確、深淺主題各看一次 — HITL
      → 使用者確認通過。過程中發現並修正窄面板破版(見 7.2 完成註記)。

## 2. 粗體與二級小標

- [x] 2.1 `ui/markdown.ts` 加入 `strong` 與 `heading` 分支,`heading` **僅 `depth === 2`** 產出小標元素、其餘 depth 走降級。使 scenario「呈現行內程式碼與粗體」的粗體部分、「呈現二級小標」、「不支援的標題階層與支援的階層並存」可通過 — AFK / tdd
- [x] 2.2 `ui/theme.css` 新增 `.codewalk-md-h` 樣式(`1.1em`、`font-weight: 600`、上 margin 大於下 margin) — AFK
- [x] 2.3 目視確認小標字級明顯小於步驟標題、不與面板既有階層競爭;必要時微調數值 — HITL
      → 使用者確認通過,數值未調整。

## 3. 清單

- [x] 3.1 `ui/markdown.ts` 加入 `list` 分支,依 `ordered` 產出有序或無序清單,遞迴處理 `items[].tokens` 使巢狀自然成立;`space` token 略過。使 scenario「呈現無序與有序清單」「呈現巢狀清單」可通過 — AFK / tdd
- [x] 3.2 `ui/theme.css` 新增清單樣式,`white-space: pre-line` 一併套用到清單項目;縮排在 340px 寬的側邊面板下不擠壓內容 — AFK
- [x] 3.3 目視確認巢狀層級可分辨、清單與前後段落的間距一致 — HITL
      → 使用者確認通過。

## 4. 內嵌連結

- [x] 4.1 `shared/schema.ts` 的 `isHttpUrl()` 加上 `export`(不改行為、不改驗證規則),確認既有 `shared/schema.test.ts` 全綠 — AFK
- [x] 4.2 `ui/markdown.ts` 加入 `link` 分支:`href` 經 `isHttpUrl()` 通過才產出可點擊元素(用 `<button>`,比照 `renderReference()`,**不用 `<a href>`**),點擊呼叫注入的 `onOpenLink`;不通過則降級為 `token.raw`。使 scenario「非 http/https 的內嵌連結不可點擊」可通過 — AFK / tdd
      → 實作時發現 design.md 未預見的問題:多個短欄位(`item.label`、`term.term`、`quiz.options[]`)顯示在另一個已有點擊行為的元素內(`<button>`/`<summary>`/`<label>`),連結渲染成 `<button>` 會產生巢狀互動元素。修法:`onOpenLink` 型別擴為 `OpenLinkHandler | null`,`null` 表示該處連結一律降級為原始文字。已加測試、已更新 design.md(見該檔新增的實作筆記)。
- [x] 4.3 `ui/render.ts` 把既有的 `handlers.onOpenReference` 傳入 `renderMarkdownBlock`,確認走的是既有 `openReference` protocol 訊息,`shared/protocol.ts` 與 `src/` 零改動 — AFK
- [x] 4.4 `ui/theme.css` 新增 `.codewalk-md-link` 樣式(`--vscode-textLink-foreground` / `--vscode-textLink-activeForeground`),外觀與既有 reference 連結一致 — AFK
- [x] 4.5 在 Extension Development Host 實際點擊一個內嵌連結,確認以外部瀏覽器開啟、面板停留在原 step 不導航離開;再放一個 `[x](command:workbench.action.terminal.new)` 確認原樣顯示且點不動。使 scenario「點擊內嵌連結開啟外部瀏覽器」可通過 — HITL
      → 使用者確認通過。

## 5. 擴及其餘欄位

- [x] 5.1 `ui/markdown.ts` 新增 `renderMarkdownInline(source, onOpenLink)`,改走 `Lexer.lexInline()`,共用同一份 inline token 渲染邏輯。使 scenario「短欄位中的區塊語法不生效」可通過 — AFK / tdd
- [x] 5.2 `ui/render.ts` 其餘**長文欄位**改走 `renderMarkdownBlock`:`term.explanation`、`tip.text`、`todo.text`、`pitfall.misconception`、`pitfall.reality`、`quiz.optionExplanations[]`。使 scenario「其他長文欄位一致適用」可通過 — AFK
      → `renderPitfall` 的「誤解:」/「其實:」標籤原本與內容同一個 `<p>`;改用區塊渲染後兩者變成獨立元素,新增 `appendLabeledMarkdown()` 把標籤插進內容的第一個段落內部,維持視覺上同行(見 `ui/render.ts`)。
- [x] 5.3 `ui/render.ts` **短欄位**改走 `renderMarkdownInline`:`quiz.question`、`quiz.options[]`、`item.label`、`term.term`、`walk.title`、`step.title`。使 scenario「quiz 題目呈現行內程式碼」可通過 — AFK
      → 依任務 4.2 的巢狀互動元素規則分流:`walk.title`(<h2>)、`step.title`(<h3>)、`quiz.question`、quiz 結果頁的選項文字(純 `<p>`/`<div>`,非互動祖先)傳真正的 `onOpenReference`;`item.label`(在 button 內)、`term.term`(在有 click handler 的 summary 內)、live quiz 畫面的 `quiz.options[]`(在包 radio 的 label 內)傳 `null`。連帶更新 `QuizHandlers`/`QuizResultHandlers` 介面與 `ui/main.ts` 兩處呼叫端。
- [x] 5.4 補測試:未閉合的粗體標記、格式殘缺的連結語法皆原樣顯示且不拋例外。使 scenario「格式錯誤不影響導讀可播放性」可通過 — AFK / tdd
- [x] 5.5 目視確認短欄位在按鈕、`<summary>`、radio 標籤、面板標題列中的版面未被破壞(特別是 `item.label` 與 `term.term` 這兩個放在互動元件內的欄位) — HITL
      → 使用者驗證時發現窄面板下短欄位/長文欄位的識別字(如 `shared/schema.ts`)會撐破容器,見 7.2 完成註記的修復。修復後使用者確認通過。

## 6. 合約與產生器同步

- [x] 6.1 `shared/schema.ts` 各敘述欄位補 JSDoc:支援的六種語法、長文/短欄位的分級、認不得就原樣輸出的降級規則。這是開放格式合約的一部分,任何產生器都要讀得到 — AFK
- [x] 6.2 更新 `.claude/skills/explain-change/SKILL.md` 的輸出指引,教產生器在敘述中使用行內程式碼與 `##` 小標,並明列不支援的語法 — AFK
      → 順手改掉 SKILL.md 原本「narration 目前是純文字渲染(不解析 Markdown)」的過時說明(改動前即存在,本 change 讓它失真)。
- [x] 6.3 更新 `README.md` 的格式說明;`docs/glossary.md` 新增「敘述欄位(長文欄位 / 短欄位)」與「降級為純文字」兩則定義 — AFK

## 7. Dogfooding 與驗證

- [x] 7.1 重生 `.codewalk/2026-08-03-codebase-tour.codewalk.json`,用新語法改寫敘述(識別字包行內程式碼、長 step 加 `##` 小標與清單);**這一步的目的是暴露「渲染出來到底好不讀」**,若讀起來比改版前差,回頭調整前面各組的樣式而不是硬套語法 — HITL
      → 內容改寫涵蓋第 1、2、3、4、5、8、11、15、20、21 步(共 10 步)的 narration + quiz 前 3 題,涵蓋全部 6 種語法,含一處巢狀清單;`validateCodewalk()` 實測通過。使用者確認讀感良好,且確認其餘未重生的 step 呈現仍正確(該檔的 `ref` 目前未明顯漂移,不需整份重新產生)。
- [x] 7.2 驗證通過:`pnpm test` 全綠、`pnpm format` 無變動、`pnpm build` 成功;Extension Development Host 手動驗證 checklist——(a) 既有 5 份未重生的導讀檔呈現正常無回歸;(b) 重生後的 codebase-tour 六種語法各看一次;(c) 深淺主題各切一次確認行內程式碼與連結配色跟隨;(d) 面板寬度拉到最窄確認清單與小標不破版;(e) 塞一份含表格、`<script>`、`command:` 連結的測試導讀,確認全部原樣顯示且無任何執行或載入行為 — HITL
      → 自動化部分:`pnpm test` 226/226 全綠、`pnpm format` 無變動、`pnpm build` 成功。手動 checklist (a)(b)(c)(e) 使用者確認通過;(d) 面板縮到最小時初次發現破版,修復如下,修復後使用者複驗通過:
        - **成因**:`.codewalk-annotation` 是 flex row,承載內容的 `.codewalk-annotation-text` 沒設 `min-width: 0`——flex 子項預設不縮到比內容窄,長識別字(如 `shared/schema.ts`)撐開整個框;同時行內程式碼(`<code>`)沒有 `overflow-wrap`,`/` 不是瀏覽器預設的斷行點,整段變成不可斷的長條。
        - **修法**:`.codewalk-md-p`/`.codewalk-md-h`/`.codewalk-md-list li`/`.codewalk-md-code` 加 `overflow-wrap: anywhere`;`.codewalk-annotation-text`/`.codewalk-file-item-title`/`.codewalk-term-label`/`.codewalk-quiz-question-title` 加 `min-width: 0`(比照既有 `.codewalk-snippet-header-text` 的作法);新增 `.codewalk-reference-label` 類別並同樣加 `min-width: 0` + `overflow-wrap: anywhere`,`.codewalk-reference` 加 `max-width: 100%`;`.codewalk-quiz-breakdown-question` 加 `flex-wrap: wrap` + `overflow-wrap: anywhere`(該處的行內渲染結果是多個節點直接掛在 flex row 下,無中介容器)。
        - **踩雷記錄**:修完 CSS 後只跑了 `pnpm typecheck`/`test`/`format`,忘了重新 `pnpm build`——導致使用者第二次驗證時看到的仍是修復前的 `dist/webview.css`,誤以為修復無效。之後才發現並重新建置。
