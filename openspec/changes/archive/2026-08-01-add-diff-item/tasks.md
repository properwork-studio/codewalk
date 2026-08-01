## 建議開發方式

- **schema 與 validator**(`shared/schema.ts`):`tdd` skill,型別與驗證邏輯先寫測試
- **語言偵測共用模組**(`shared/language.ts`):純函式搬移+改 import,`tdd` skill 確認行為不變(重跑既有 `snippetPreview.test.ts`)
- **extension host**(`src/viewProvider.ts` 的訊息路由擴充):可獨立驗證的分支走 `tdd` skill;涉及真實 vscode API(`jumpToStep`)的分支搭配 Extension Development Host 手動驗證
- **webview UI**(`ui/render.ts` 渲染邏輯、`ui/highlight.ts` 重用):逐行分類/剝除開頭字元屬純邏輯,走 `tdd` skill;CSS 色票與版面直接實作,搭配手動驗證(視覺類不易寫自動化測試)

## 1. Schema:CodewalkItem 新增 diff 與驗證

- [x] 1.1 `shared/schema.ts` 的 `CodewalkItem` 新增 `{ kind: 'diff'; label: string; file: string; startLine: number; endLine: number; diffText: string }` 成員,`validateItem` 新增 `case 'diff'`(重用 `label`/`file`/`validateLineRange` 檢查邏輯),撰寫 Vitest 涵蓋合法 diff item 通過驗證,使 spec.md「改動片段呈現」相關 scenario 的資料前提成立 AFK tdd
- [x] 1.2 新增 `hasAtLeastOneChangedLine(diffText)` 檢查(依 `\n` 切行、捨棄結尾換行產生的尾端空字串元素,要求至少一行以 `+` 或 `-` 開頭),接入 `validateItem` 的 `diff` 分支,撰寫 Vitest 涵蓋「全部都是 context 行時拒絕載入」與「含至少一行加減行時正常載入」兩個情境,使 spec.md「改動片段格式驗證」的兩個 scenario 可通過 AFK tdd

## 2. 語言偵測搬到 shared,供 host 與 webview 共用

- [x] 2.1 新增 `shared/language.ts`,把 `src/snippetPreview.ts` 現有的 `EXTENSION_LANGUAGE`/`detectLanguage` 搬過去(內容不變),`src/snippetPreview.ts` 改為從 `shared/language.ts` import;重跑既有 `snippetPreview.test.ts` 確認行為無回歸 AFK tdd

## 3. 跳轉行為:diff 比照 snippet 重用既有跳轉機制

- [x] 3.1 `src/viewProvider.ts` 的 `handleJumpToSnippet` guard 從 `item.kind !== 'snippet'` 放寬為同時接受 `'snippet'` 與 `'diff'`,其餘邏輯(呼叫既有 `jumpToStep`、失敗時回傳既有 `stepJumpError`)不變;`viewProvider.ts` 頂層 import 真實 `vscode` 模組,無法在 Vitest node 環境載入(與既有 `fileJump.ts`/`design.md` 記錄的測試策略一致),使 spec.md「點擊 diff 跳轉編輯器」「diff 引用的檔案不存在」scenario 併入 6.2 的 Extension Development Host 手動驗證 checklist 一併確認,不走 tdd AFK

## 4. Webview 渲染:逐行加減色 + 語法高亮

- [x] 4.1 `ui/render.ts` 新增匯出的 `classifyDiffLines(diffText)` 純函式:切行、依開頭字元分類(`+`/`-`/其餘視為 context)並剝除加減行的開頭字元,捨棄結尾換行產生的尾端空行;新增 `renderDiff(item, itemIndex, onJumpToSnippet)` 呼叫 `classifyDiffLines` 後把剝除後的內容整段丟給既有 `highlightSnippetLines(content, language)`(`language` 來自 `shared/language.ts` 的 `detectLanguage(item.file)`)取回逐行 HTML,依分類結果包上對應行容器;撰寫 Vitest(`ui/render.test.ts`)涵蓋切行分類邏輯(含結尾換行的尾端空行處理、純刪除 hunk 只有 `-`/context 行、空白 context 行的情境)AFK tdd
- [x] 4.2 `renderItems` 的 `switch` 新增 `case 'diff'` 呼叫 `renderDiff`,標頭顯示 `label` 與 `file:startLine-endLine`、點擊觸發既有 `onJumpToSnippet(itemIndex)` handler(程式碼已完成);Extension Development Host 手動驗證「顯示 diff 加減行與語法高亮」「點擊 diff 跳轉編輯器」「純刪除 hunk 的跳轉位置」三個 scenario 待人工執行 HITL
- [x] 4.3 `ui/theme.css` 新增 `.codewalk-diff-line-added`/`.codewalk-diff-line-removed` 背景色,使用 `--vscode-diffEditor-insertedLineBackground`/`--vscode-diffEditor-removedLineBackground`(context 行不上背景色);標頭沿用既有 `codewalk-snippet-header`/`codewalk-snippet-file-ref` 風格類別命名為對應的 `codewalk-diff-*`,人工檢視深/淺色主題下的顏色對比與可讀性 HITL(視覺樣式已完成,人工檢視待 6.2 一併執行)

## 5. items 交錯排序涵蓋 diff

- [x] 5.1 確認 `renderItems` 的 `switch` 新增的 `case 'diff'` 分支沿用既有 `forEach` 依 `items` 陣列原始順序組裝 DOM 的邏輯,未新增任何重排/分組程式碼(`ui/render.ts` 無 jsdom 測試環境,DOM 順序驗證比照既有慣例走人工/程式碼檢視,非新增 Vitest),使 spec.md「混合排列包含 diff 的多種 kind」scenario 的實作前提成立,實際畫面驗證併入 6.2 AFK

## 6. 驗證通過

- [x] 6.1 執行 `pnpm test`(10 個測試檔、100 tests 全數通過,含本次新增的 `shared/schema.test.ts` diff item 案例、`shared/language.test.ts`、`ui/render.test.ts`)、`pnpm typecheck`、`pnpm build --production`,三者皆通過,`dist/webview.js`/`dist/extension.js` 正常產出 AFK
- [x] 6.2 依 Extension Development Host 手動驗證 checklist 逐項確認:單一 step 內混合 `diff` 與既有五種 kind → `diff` 加減行背景色與語法高亮正確呈現 → 點擊 `diff` 跳轉編輯器且位置正確(含純刪除 hunk 的情境)→ 引用不存在的檔案時顯示錯誤且不中斷導覽 → 切換 VS Code 淺色/深色主題確認加減行背景色跟隨主題 HITL(使用者確認全數通過,同時提出 7. 的追加需求)

## 7. 手動驗證階段追加:diff 顯示雙欄行號與 +/- 標記(對應使用者實測回饋)

- [x] 7.1 `shared/schema.ts` 的 `diff` 成員新增 `oldStartLine: number`,`validateItem` 的 `diff` 分支新增 `isPositiveInteger(it.oldStartLine)` 檢查,撰寫 Vitest 涵蓋缺漏/非正整數時拒絕載入,使 spec.md「oldStartLine 缺漏或不是正整數」scenario 可通過 AFK tdd
- [x] 7.2 `ui/render.ts` 的 `classifyDiffLines` 改簽章為 `classifyDiffLines(diffText, oldStartLine, newStartLine)`,`DiffLine` 新增 `oldLineNumber`/`newLineNumber`(型態為 `number | null`):`context` 行兩個計數器都遞增並記錄、`added` 行只記錄 `newLineNumber`、`removed` 行只記錄 `oldLineNumber`;調整既有 `ui/render.test.ts` 呼叫方式,新增測試涵蓋雙欄行號的遞增與留空情境,使 spec.md「顯示雙欄行號」scenario 可通過 AFK tdd
- [x] 7.3 `renderDiffCode` 的每一行新增 `+`/`-`/(空白)標記字元欄位與舊版/新版兩個行號欄位(留空時顯示空白,不顯示 `0` 或 `-`),`renderDiff` 呼叫 `classifyDiffLines` 時傳入 `item.oldStartLine`/`item.startLine`(程式碼完成);`ui/theme.css` 新增對應欄位的樣式(標記字元依新增/刪除上色、行號欄位比照既有 `codewalk-snippet-line-number` 的淡化前景色慣例),人工檢視版面對齊與可讀性待 7.5 一併執行
- [x] 7.4 更新 `.codewalk/2026-08-01-diff-item-demo.codewalk.json` 四個 `diff` item,補上正確的 `oldStartLine`(第一、二步依實際 `git diff` hunk header 的 `-` 起始行號;第三、四步為情境示範,依內部一致推算),第四步同步修正 `endLine`(原本誤標 3,依新版行號實際只到 2);重跑暫時驗證測試確認 `validateCodewalk` 通過後刪除 AFK
- [x] 7.5 依 Extension Development Host 手動驗證 checklist 確認:每個 diff 項目的加減行同時顯示 `+`/`-` 標記字元與舊版/新版雙欄行號、新增行留空舊版欄位、刪除行留空新版欄位、行號隨內容正確遞增,搭配深/淺色主題檢視可讀性 HITL(使用者確認全數通過)
