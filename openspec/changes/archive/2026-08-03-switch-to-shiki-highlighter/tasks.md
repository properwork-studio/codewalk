# Tasks — switch-to-shiki-highlighter

## 建議開發方式

本 change 橫跨三種元件,各自的執行方式不同:

| 元件 | 路徑 | 執行方式 |
|---|---|---|
| **webview UI** | `ui/highlight.ts`、`ui/render.ts` | 純邏輯與渲染,以 **tdd skill**(red-green-refactor)執行;高亮輸出可用 Vitest 直接斷言 token |
| **extension host** | `src/themeSource.ts`(新)、`src/viewProvider.ts` | 主題解析為純函式,可用 Vitest 覆蓋(以真實主題檔為 fixture);`vscode` API 的接線部分走 Extension Development Host 手動驗證 |
| **協定** | `shared/protocol.ts` | 訊息型別單一定義處,改動後兩端同時更新;既有 `protocol.test.ts` 需同步 |

切片原則:第 1、2、3 節各自是可獨立 demo 的端到端切片——完成第 1 節就能看到配色變化,不必等第 2 節。

---

## 1. 以 Shiki 取代 highlight.js(先用內建預設配色)

- [x] 1.1 **(AFK)** 引入 `shiki` 與 `@shikijs/engine-javascript`、移除 `highlight.js`;在 `ui/highlight.ts` 以 `createHighlighterCore()` + JS 引擎註冊現有 23 種語言,使既有的 `語言註冊` 測試(`EXTENSION_LANGUAGE` 每個值都必須被辨識)在新引擎下通過
- [x] 1.2 **(AFK)** 將 `highlightSnippetLines()` 改為以 `codeToTokens()` 回傳逐行 token,並移除 `splitHighlightedLines()` 與其兩條跨行 span 測試(該行為改由 Shiki 內建保證),使 `#### Scenario: 副檔名有對應的語言` 可通過
- [x] 1.3 **(AFK)** 改寫 `ui/render.ts` 依 token 的 `color`/`fontStyle` 產生 span,維持 snippet 行號與點擊跳轉不變;diff 維持「先剝 `+`/`-` 前綴 → 高亮 → 渲染時補回前綴與雙欄行號」的既有前處理
- [x] 1.4 **(AFK)** 實作未支援語言的純文字路徑,使 `#### Scenario: 副檔名沒有對應的語言` 可通過(含角括號等字元不破壞版面)
- [x] 1.5 **(AFK)** 實作高亮初始化期間的純文字渲染與就緒後重繪,使 `#### Scenario: 高亮就緒前瀏覽 step` 與 `#### Scenario: 就緒後自動更新` 可通過
- [x] 1.6 **(HITL)** 在 Extension Development Host 確認:snippet/diff 顏色已明顯較先前豐富(方法呼叫、型別、參數有色),且行號、點擊跳轉、diff 加減行背景色皆與改動前一致——使用者實測確認

## 2. 改讀使用者當前主題(含降級)

- [x] 2.1 **(AFK)** 新增 `src/themeSource.ts`,實作 `resolveEditorTheme()`:讀 `workbench.colorTheme` → 掃 `vscode.extensions.all` 的 `contributes.themes[]` 比對 `label`/`id` → 取得主題檔路徑與 `uiTheme`
- [x] 2.2 **(AFK)** 實作主題檔載入:JSONC 容錯解析、`include` 遞迴合併(`tokenColors` 串接、`colors` 淺層覆蓋)、深度上限 5 層;以 `.codewalk/samples/` 之外的真實主題檔為 fixture 撰寫測試(內建 `dark_plus.json` 含 `include`,可作為繼承案例)
- [x] 2.3 **(AFK)** 在 `shared/protocol.ts` 新增主題資料的 host→webview 訊息型別(`ResolvedEditorTheme`、`ThemeTokenColorRule`、`themeChanged`)——`protocol.test.ts` 未變動:`themeChanged` 是 host→webview 純型別新增,沒有對應的執行期解析函式(`parseWebviewToHostMessage` 只處理 webview→host 方向),沒有新邏輯需要測試
- [x] 2.4 **(AFK)** 在 `src/viewProvider.ts` 接線:載入導讀時解析主題並送往 webview;webview 端以該主題建立 highlighter,使 `#### Scenario: 讀者使用非預設主題` 可通過
- [x] 2.5 **(AFK)** 實作全鏈路降級:解析的任一環節失敗一律回傳 `null`,webview 依編輯器明暗改用內建 `dark-plus`/`light-plus`,使 `#### Scenario: 無法辨識當前主題` 與 `#### Scenario: 主題定義檔無法解析` 可通過
- [x] 2.6 **(HITL)** 在 Extension Development Host 以實際安裝的非預設主題確認配色與編輯器一致(含粗體/斜體)——使用者實測確認,並排查釐清 Groovy/Dart/Kotlin 的顏色落差為 semantic tokens 限制而非本次改動的 bug(design.md 決策 9)。「把 `workbench.colorTheme` 改成不存在的值」無法用這個方法測試:VS Code 對不合法的主題值會直接忽略、維持原主題不變,不會觸發任何變更——降級路徑改由 `themeParsing.test.ts` 的 21 條單元測試覆蓋(找不到主題定義、讀檔失敗、JSON 解析失敗、`tokenColors` 為空等各失敗分支)

## 3. 主題切換即時重繪

- [x] 3.1 **(AFK)** 在 `src/viewProvider.ts` 監聽 `window.onDidChangeActiveColorTheme`,重新解析主題並送往 webview;webview 收到後重繪目前 step 的 snippet/diff,使 `#### Scenario: 切換主題後程式碼配色更新` 與 walk-player 的 `#### Scenario: 程式碼配色一併跟隨主題` 可通過
- [x] 3.2 **(AFK)** 確保重繪後目前 step 與捲動位置不變;切換到無法辨識的主題時降級,使 `#### Scenario: 切換到無法辨識的主題` 可通過
- [x] 3.3 **(HITL)** 在 Extension Development Host 連續切換數個主題(含淺色↔深色),確認配色即時更新且不需重開面板、step 與捲動位置不變——使用者實測確認即時重繪正常運作(過程中曾以為沒有即時套用,經插入除錯 log 逐層排查,證實 pipeline 正確,只是切換到的主題彼此顏色接近導致視覺上不易察覺)

## 4. 移除舊設定與相依

- [x] 4.1 **(AFK)** 移除 `package.json` 的 `codewalk.snippetTheme` 設定宣告,以及 `src/viewProvider.ts` 中該設定的讀取、`onDidChangeConfiguration` 分支、hljs 主題 CSS 的 `asWebviewUri` 掛載與 `<link>`
- [x] 4.2 **(AFK)** 確認 `highlight.js` 相依與其主題 CSS 資產已完全移除,`pnpm build` 後 webview bundle 不含 hljs 殘留
- [x] 4.3 **(AFK)** 將引擎比對腳本(JS 引擎 vs oniguruma 的 token 逐一比對)收進 repo 作為回歸工具,供未來新增語言時重跑——design 決策 1 的緩解措施

## 5. 更新示範導讀

- [x] 5.1 **(AFK)** 更新 `.codewalk/2026-08-03-language-highlight-demo.codewalk.json`:第五步的 diff 項目(`shared/language.ts`)與 snippet 項目(`ui/highlight.ts`)行號因本次改動失效,重新對齊;若 `splitHighlightedLines()` 已移除,該步的敘述一併修正
- [x] 5.2 **(AFK)** 以驗證腳本確認該 demo 通過 schema 驗證,且所有引用的檔案存在、行號未超出檔案範圍

## 6. 驗證通過

- [x] 6.1 **(AFK)** 單元測試全數通過(`pnpm test`),且新增/修改的測試涵蓋本 change 的所有 scenario
- [x] 6.2 **(HITL)** Extension Development Host 手動驗證 checklist——使用者實測全數確認通過:
  - snippet 與 diff 配色與編輯器一致(以當前非預設主題比對同一檔案)
  - snippet/diff/tip/pitfall 的背景色與編輯器背景一致(決策 8,實測發現原本用
    `--vscode-textCodeBlock-background` 導致底色是灰色、跟編輯器深色背景不一致,已修正)
  - 切換主題後配色即時更新,step 與捲動位置不變
  - 主題設定為不存在的值時降級為預設配色,走讀不中斷(改用單元測試覆蓋,見 2.6 備註)
  - 未支援副檔名的 snippet 以純文字完整顯示
  - 點擊 snippet/diff 跳轉、雙欄行號、加減行背景色皆與改動前一致
  - `codewalk.snippetTheme` 已從設定介面消失
