## 建議開發方式

- **協定與 schema**(`shared/schema.ts`、`shared/protocol.ts`):`tdd` skill,型別與解析/驗證邏輯先寫測試
- **extension host**(`src/snippetPreview.ts`、`src/viewProvider.ts` 的訊息路由):可獨立驗證的分支(檔案不存在)走 `tdd` skill;涉及真實 vscode API(`openExternal`、`jumpToStep`)的分支搭配 Extension Development Host 手動驗證
- **webview UI**(`ui/render.ts` 渲染邏輯、`ui/main.ts` 的 highlight.js 整合):狀態/邏輯部分走 `tdd` skill;純樣式與 icon/色票直接實作,搭配手動驗證(視覺類不易寫自動化測試)

## 1. Schema:CodewalkItem 型別與驗證

- [x] 1.1 在 `shared/schema.ts` 新增 `CodewalkItem` discriminated union(`tip`/`pitfall`/`todo`/`reference`/`snippet`)與 `CodewalkStep.items?: CodewalkItem[]`,撰寫 Vitest 涵蓋 5 種 kind 的合法輸入通過驗證 AFK tdd
- [x] 1.2 新增 `isHttpUrl()` 檢查與 `reference` 項目的 `validateItem` 分支,撰寫 Vitest 涵蓋 `url` 非 http/https 或格式不合法時回傳錯誤,使 spec.md「外部連結參考」的「reference.url 格式不合法」scenario 可通過 AFK tdd
- [x] 1.3 `snippet` 項目重用既有 `endLine` 不可小於 `startLine` 的驗證邏輯(抽出共用 `validateLineRange()` 給 step 與 snippet item 共用),撰寫 Vitest 涵蓋該錯誤情境 AFK tdd

## 2. annotation 類項目顯示(tip/pitfall/todo)

- [x] 2.1 `ui/render.ts` 新增 annotation 渲染函式:`tip`/`todo` 顯示單一 `text`,`pitfall` 同時顯示 `misconception`/`reality` 兩段內容且視覺樣式與既有 `codewalk-warning` class 區隔;涵蓋 spec.md「顯示 tip」「顯示 todo」「顯示 pitfall」「step 沒有任何 items」四個 scenario(DOM 渲染邏輯依專案既有慣例走手動驗證,非 jsdom 單元測試)AFK
- [x] 2.2 `ui/theme.css` 調整 tip/todo/pitfall 三種 kind 的 icon 與色票,人工檢視深/淺色主題下的視覺呈現與可讀性 HITL

## 3. 外部連結參考(reference)

- [x] 3.1 `shared/protocol.ts` 新增 `WebviewToHostMessage` 的 `openReference` 訊息;`src/viewProvider.ts` 收到後呼叫 `vscode.env.openExternal` AFK tdd
- [x] 3.2 `ui/render.ts` 顯示 `reference` 項目為可點擊連結,點擊時 postMessage `openReference`(程式碼已完成);Extension Development Host 手動驗證「點擊 reference 開啟外部瀏覽器」scenario 待人工執行 HITL

## 4. 程式碼片段引用(snippet)預覽與跳轉

- [x] 4.1 新增 `src/snippetPreview.ts` 的 `readSnippetPreviews(workspaceRoot, items)`,撰寫 Vitest 涵蓋「檔案不存在」錯誤分支與成功讀取分支(不需 vscode API,直接測真實讀檔行為,比預期範圍更完整)AFK tdd
- [x] 4.2 `shared/protocol.ts` 的 `walkLoaded`/`stepChanged` 訊息新增 `snippetPreviews` 欄位;`src/viewProvider.ts` 在 `loadWalk`/`setStep` 呼叫 `readSnippetPreviews` 並隨訊息送出目前 step 的預覽結果 AFK tdd
- [x] 4.3 `shared/protocol.ts` 新增 `WebviewToHostMessage` 的 `jumpToSnippet` 訊息;`src/viewProvider.ts` 收到後從 `items` 取出對應 snippet 呼叫既有 `jumpToStep`,失敗時沿用既有 `stepJumpError` 訊息,使 spec.md「snippet 引用的檔案不存在」scenario 可通過 AFK tdd
- [x] 4.4 新增 `ui/highlight.ts`:引入 `highlight.js/lib/core` 並手動註冊常見語言子集(typescript/javascript/json/python/go/rust/css/xml(含 html 別名)/markdown/bash/yaml),`highlightSnippet(content, language)` 對未註冊語言 fallback 為 escape 後的純文字;host 端已在 `readSnippetPreviews` 依副檔名判斷語言字串 AFK tdd
- [x] 4.5 `ui/render.ts` 顯示 snippet 項目(預設展開、`label` + 語法高亮預覽),點擊時 postMessage `jumpToSnippet`(程式碼已完成);Extension Development Host 手動驗證「顯示 snippet 預覽」「點擊跳轉編輯器」「切換 step 後跳轉位置回到主 step」三個 scenario 待人工執行 HITL
- [x] 4.6 `ui/theme.css` 手寫 `.vscode-dark`/`.vscode-light`(含 high-contrast 併入對應色系)兩組 hljs token 色票(第一版色票已完成,參照 VS Code 預設深/淺色主題慣用色);人工檢視深/淺色主題下的語法高亮可讀性待人工執行 HITL(已被 9.1/9.7 取代:改用 `@scope` 包裝 highlight.js 官方色票,不再手寫)

## 5. items 交錯排序

- [x] 5.1 確認 `ui/render.ts` 依 `step.items` 陣列原始順序渲染所有 kind,不重新分組排序(`renderItems` 用 `forEach` 依陣列順序組裝 DOM,無重排邏輯),涵蓋 spec.md「混合排列多種 kind」scenario AFK

## 6. 驗證通過

- [x] 6.1 執行 `pnpm test`,Vitest 單元測試套件全數通過(73 tests,涵蓋 items schema 驗證、reference URL 檢查、snippet 讀檔與檔案不存在分支、highlight.js 語言解析);另確認 `pnpm typecheck` 與 `pnpm build --production` 皆通過(webview.js 產出 80K minified)AFK
- [x] 6.2 依 Extension Development Host 手動驗證 checklist 逐項確認:單一 step 內混合排列 tip/pitfall/todo/reference/snippet 五種 kind → 各自視覺樣式與既有 `codewalk-warning`/`codewalk-term` 區隔清楚 → 點擊 reference 開啟外部瀏覽器 → snippet 預覽正確高亮並可點擊跳轉 → 跳轉後切換 step 確認回到主 step 位置 → 引用不存在的檔案確認顯示錯誤且不中斷導覽 → 切換 VS Code 淺色/深色主題確認 annotation 與 snippet 高亮樣式跟隨 HITL

## 7. 手動驗證階段追加:snippet 顯示體驗改善(對應使用者實測回饋)

- [x] 7.1 修正 snippet 預覽字體過大:`.codewalk-snippet-code` 改用固定 `0.8em`(原本依賴 `var(--vscode-editor-font-size)` 缺省時退回 `0.9em`,實測顯示過大)AFK
- [x] 7.2 新增行號標記:`ui/highlight.ts` 新增 `highlightSnippetLines()`,逐行輸出標籤配對完整的 HTML(掃描 token 追蹤開啟中的 `<span>` 堆疊,換行時補閉合、下一行重新打開,避免跨行 `<span>`(如多行註解)被直接按 `\n` 切開產生標籤不配對);`ui/render.ts` 的 `renderSnippetCode()` 逐行渲染,搭配 `item.startLine` 由 host 端 `startLine` 累加顯示行號,撰寫 Vitest 驗證跨行 span 情境下每一行的開始/結束標籤數量相等 AFK tdd
- [x] 7.3 新增可選的 snippet 語法高亮 theme:`package.json` 新增 `codewalk.snippetTheme` 設定(`auto`/`github-dark`/`github-light`/`monokai`/`dracula`,預設 `auto` 沿用原本跟隨 VS Code 深淺色的行為);`src/viewProvider.ts` 讀取設定(白名單驗證,防止使用者手改 `settings.json` 塞入非法字串導致 HTML 屬性注入)並寫入 `#app` 的 `data-codewalk-theme` 屬性,設定變更時透過 `onDidChangeConfiguration` 重繪 webview;`ui/theme.css` 新增四組具名色票,用 `#app[data-codewalk-theme="..."]` 的 id 選擇器覆蓋預設的 `.vscode-dark`/`.vscode-light` 規則(不需要 `!important`)AFK tdd(選項清單與色票來源已被 9.1/9.7 取代:最終 10 個選項改用 highlight.js 官方色票,預設值改為 `material-palenight`,見 8.2/9.8)
- [x] 7.4 人工驗證:snippet 字體大小是否適當、行號是否正確對應原始檔案行數、切換 `codewalk.snippetTheme` 設定的四個具名選項是否即時套用且視覺可讀 HITL

## 8. 手動驗證階段追加(第二輪回饋):字體/行高微調、新增三種 theme、顯示檔案路徑

- [x] 8.1 調整 snippet 字體與行高:字體從 `0.8em` 調到 `0.88em`(前一輪改太小),`line-height` 從 `1.5` 調到 `1.7` AFK
- [x] 8.2 `codewalk.snippetTheme` 新增三個選項:`night-owl`、`atom-one-dark`、`material-palenight`,`package.json` enum/`src/viewProvider.ts` 白名單、`ui/theme.css` 色票同步新增 AFK
- [x] 8.3 snippet 標頭新增顯示檔案路徑與行號(`${item.file}:${item.startLine}-${item.endLine}`,樣式與主 step 的 `codewalk-file-ref` 一致風格但字級較小),不論預覽成功或找不到檔案都會顯示,讓讀者一眼看到來源位置 AFK
- [x] 8.4 人工驗證:字體/行高觀感是否恰當、三個新 theme 切換是否正確套用、snippet 標頭的檔案路徑是否正確對應原始檔案 HITL

## 9. 手動驗證階段追加(第三輪回饋):snippet theme 改用 highlight.js 官方色票,不再手寫維護

- [x] 9.1 `esbuild.js` 新增 `buildHljsThemesCss()`:讀取 `node_modules/highlight.js/styles/*.css` 官方主題檔,用 CSS `@scope` 包裝(不逐條改寫 selector)輸出成 `dist/hljs-themes.css`;`auto` 依 `.vscode-dark`/`.vscode-light`(high-contrast 併入對應深淺)分別包 `github-dark`/`github` 兩份;7 個具名選項對應各自官方來源檔;新增到 `main()` 的建置流程(watch 與一次性 build 都會產生)AFK
- [x] 9.2(初版誤判,見 9.7 修正)`codewalk.snippetTheme` 的 `dracula`/`material-palenight` 一開始誤判無官方對應版本,曾改名為色調接近的 `rose-pine-moon`/`tokyo-night-dark` 頂替
- [x] 9.3 `ui/render.ts` 的 snippet 程式碼容器加上 `hljs` class,對應官方 CSS 的 `.hljs { background; color }` 規則;`src/viewProvider.ts` 的 `getHtml()` 新增 `<link>` 引入 `dist/hljs-themes.css` AFK
- [x] 9.4 `ui/theme.css` 刪除原本手寫的 ~150 行 highlight.js 色票(auto 與具名 theme),`.codewalk-snippet-code` 移除不再需要的 `border-top`,行號改用 `color: inherit; opacity` 跟隨目前主題前景色,不用逐 theme 指定 AFK
- [x] 9.5 `openspec/changes/add-step-items/design.md` 決策 6 加註 2026-08-01 修訂,記錄「不引入官方 theme CSS」的原始理由(無法配合 dark/light 切換)已被 `@scope` 推翻 AFK
- [x] 9.7(修正 9.2 的誤判)`dracula`/`material-palenight` 其實在 `node_modules/highlight.js/styles/base16/` 子目錄下有官方檔案(`base16/dracula.css`、`base16/material-palenight.css`),先前只查了 `styles/` 外層漏看子目錄;修正後兩者改回對應各自官方 base16 檔案,`rose-pine-moon`/`tokyo-night-dark` 使用者選擇保留當額外選項——`esbuild.js` 的 `NAMED_HLJS_THEMES`、`package.json` enum/descriptions、`src/viewProvider.ts` 白名單同步更新為最終 10 個選項(`auto` + 9 個具名主題),`design.md` 加註修正紀錄 AFK
- [x] 9.6 人工驗證:10 個 `codewalk.snippetTheme` 選項(含 auto 的深/淺色雙模式)畫面色票是否正確套用、`dist/hljs-themes.css` 沒有載入失敗(檢查是否有 CSP 相關錯誤)、`dracula`/`material-palenight`/`rose-pine-moon`/`tokyo-night-dark` 視覺觀感是否可接受 HITL
- [x] 9.8 預設值改為 `material-palenight`(原本是 `auto`):`package.json` 的 `default`;`src/viewProvider.ts` 新增 `DEFAULT_SNIPPET_THEME` 常數,`resolveSnippetTheme()` 對白名單外的值(含使用者手改 `settings.json` 塞入的非法字串)一律 fallback 回這個常數而非寫死 `'auto'` AFK
