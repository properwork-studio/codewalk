## Context

目前語法高亮由 webview 端的 `ui/highlight.ts` 以 highlight.js 執行:host(`src/snippetPreview.ts`)只負責讀檔並送出 `{ content, language }`,webview 收到後才上色;diff 的 `diffText` 內嵌在 walk JSON 裡,webview 直接自行高亮。配色來自 `codewalk.snippetTheme` 設定選定的一份 hljs 主題 CSS,由 `src/viewProvider.ts:228` 以 `asWebviewUri` 掛載。

限制:

- highlight.js 是輕量 regex grammar,token 種類遠少於 VS Code 編輯器所用的 TextMate grammar
- webview 沒有 `fs`,也不能 import `vscode`——讀取使用者主題檔只能在 host 端做
- webview 有 CSP(`src/viewProvider.ts:237`),目前為 `script-src 'nonce-${nonce}'`,不允許無 nonce 的動態 chunk
- 架構硬規則:host 負責檔案與編輯器操作,webview 純前端渲染,兩者只透過 `shared/protocol.ts` 的訊息型別溝通

本文件的所有選型結論皆有實測依據,測試腳本與原始輸出記錄於 `clarify.md` 與下方各決策。

## Goals / Non-Goals

**Goals:**

- snippet/diff 的程式碼配色與讀者當前的 VS Code 編輯器主題一致(TextMate 層)
- 主題讀取的任一環節失敗時必然降級,面板照常運作
- 讀者切換主題時已顯示的內容重繪
- 維持現有 23 種語言覆蓋與既有的 snippet/diff 互動行為

**Non-Goals:**

- 不追求與編輯器 100% 一致(semantic tokens 拿不到,見 proposal)
- 不擴大語言覆蓋、不改 `.codewalk.json` 格式、不改互動行為
- 不放寬 CSP

## Decisions

### 決策 1:引擎選 `@shikijs/engine-javascript`,不用 oniguruma WASM

**實測**:對 23 種 grammar 各跑一次高亮,兩種引擎皆 23/23 不拋錯。進一步比對實際 token 輸出(以 `.codewalk/samples/` 四個樣本檔與 `ui/highlight.ts` 全檔,加上 10 種語言的代表性片段,共 **1315 個 token**),逐一比對 `content` 與 `color`:

```
lang          tokens   diff        lang          tokens   diff
java             169      0        php/ruby/sql      39      0
groovy            66      0        swift/csharp      37      0
dart             136      0        cpp/scala         41      0
kotlin            81      0        markdown/yaml     19      0
typescript       707      0        html              20      0
                                   ─────────────────────────────
                                   合計 1315,差異 0 (0.000%)
```

JS 引擎不支援 oniguruma 特有 regex 語法的疑慮在這 23 種 grammar 上**沒有實際發生**。因此選 JS 引擎:省 570 KB、免去 WASM 載入這一個非同步步驟與一份額外資產。

**替代方案**:oniguruma WASM——相容性理論上最好,但本專案的語言集合證實用不到,多付 570 KB 與一個載入步驟。

**風險**:未來新增語言時 JS 引擎可能不支援該 grammar。緩解:新增語言時沿用同一份比對腳本驗證(見 tasks)。

### 決策 2:高亮仍在 webview 端執行,host 只負責取得主題資料

主題檔讀取必須在 host(webview 無 `fs`),但高亮本身放哪邊是選擇:

| | webview 高亮(採用) | host 高亮 |
|---|---|---|
| bundle 增量落點 | webview +2.4 MB | host +2.4 MB |
| 協定改動 | 新增一則主題訊息 | snippet 與 diff 都要改成傳 token,`SnippetPreviewResult` 結構重寫 |
| 載入時機 | 僅面板開啟時 | 每次 extension activate |
| 分層 | 維持現狀(渲染留在 webview) | host 承擔渲染職責 |

採用 webview 高亮。理由:協定改動最小、符合「host 做檔案操作/webview 做渲染」的既有分層、2.4 MB 只在面板開啟時付出而非每次 activate。

**資料流**:

```
host                                          webview
────────────────────────────────────────────────────────────
讀 workbench.colorTheme
  → 反查主題檔 → 遞迴解析 include
  → 正規化為 Shiki 主題物件
                    ── themeChanged ──▶  建立/更新 highlighter
                                          重繪目前 step 的 snippet/diff
onDidChangeActiveColorTheme
                    ── themeChanged ──▶  同上
```

### 決策 3:主題來源抽成介面,三段降級鏈

**實作拆成兩個檔案**(依專案慣例:純邏輯不 import `vscode`,只有 host 接線層碰 vscode API,見 `src/fileJump.ts`/`src/viewProvider.ts` 的既有分工):

- `src/themeParsing.ts`(純函式,可單元測試):`findThemeDefinition`、`loadRawTheme`(含 `include` 遞迴)、`mergeIncludedTheme`、`normalizeTokenColors`、`themeKindFromUiTheme`
- `src/themeSource.ts`(vscode API 薄封裝,不寫單元測試,由 Extension Development Host 驗證):

```ts
// 回傳可直接餵給 Shiki 的主題物件;任一環節失敗回傳 null,由呼叫端決定降級
export async function resolveEditorTheme(): Promise<ResolvedEditorTheme | null>
// 降級路徑用:讀者編輯器目前是淺色還是深色
export function currentThemeKind(): 'light' | 'dark'
```

解析順序(**實測驗證過的路徑**):

1. 讀 `workspace.getConfiguration('workbench').get('colorTheme')` → 得到主題 **label**(實測:使用者當前值為 `"Eva Dark Italic Bold"`)
2. 掃 `vscode.extensions.all` 的 `packageJSON.contributes.themes[]`,比對 `label` 或 `id`,取得 `path` 與 `uiTheme`(實測反查到 `fisheva.eva-theme-2.9.0` → `Eva-Dark-Italic-Bold.json`,950 條 `tokenColors`)。**內建主題(如 `theme-defaults`)也以 extension 形式註冊**,`ext.extensionPath` 天然涵蓋兩種來源,不需要另外 hardcode `env.appRoot` 路徑
3. 讀該 JSON,若有 `include` 則**遞迴解析並合併**(`tokenColors` 串接),深度上限 5 層。實測:VS Code 內建 `dark_plus.json` 的 `include` 為 `./dark_vs.json`,這條路徑是真實存在的
4. 正規化:補上 Shiki 需要的 `name`(host 端遞增產生,見下方降級段落),並依 `uiTheme` 推導 `kind`(`vs`/`hc-light` → `light`,其餘 → `dark`)

**降級**:上述任一步失敗(找不到 label、找不到 extension、讀檔失敗、JSON 解析失敗、無 `tokenColors`)一律回傳 `null`。`kind`(淺色/深色)則**一律**由 host 端的 `currentThemeKind()` 讀 `vscode.window.activeColorTheme.kind` 算出、隨 `themeChanged` 協定訊息一起送給 webview——`window.activeColorTheme` 是 extension host API,webview 的 JS context 拿不到,不能像最初設想的那樣讓 webview 自己讀。webview 收到 `theme: null` 時,改依 host 送來的 `kind` 選用 Shiki 內建的 `dark-plus`/`light-plus`。每一步都必須包 try/catch——這是「讀真實主題」這個決策能成立的前提。

**注意**:VS Code 主題檔是 **JSONC**(允許 `//` 註解與 trailing comma),`JSON.parse` 會直接失敗。必須用容錯解析;若最終仍失敗,走降級而不是拋錯。

**實測確認 Shiki 吃得下**:把上述解析結果餵給 `createHighlighterCore`,對 Java 上色後 `public=#A78CFA(斜體粗體)`、`String=#56B7C3(斜體)`,與 dark-plus 的 `#569CD6`/`#4EC9B0` 明顯不同,連 `fontStyle` 都正確還原。

### 決策 4:改用 `codeToTokens()` 逐行 token,移除 `splitHighlightedLines()`

highlight.js 對整段輸出單一塊 HTML,跨行的 `<span>` 無法直接按 `\n` 切開,因此 `ui/highlight.ts` 有一段 30 行的 `splitHighlightedLines()` 手動追蹤標籤堆疊。Shiki 的 `codeToTokens()` **直接回傳 `tokens: ThemedToken[][]`(外層即行)**,這段程式碼連同它的兩條測試一併移除——它們保護的行為改由 Shiki 內建保證。

`highlightSnippetLines()` 的對外形狀改為回傳逐行 token 陣列,`ui/render.ts` 依 token 的 `color`/`fontStyle` 產生 span。

### 決策 5:diff 的前處理維持現狀

diff 目前逐行去掉 `+`/`-` 前綴後才送高亮,以免前綴字元污染文法解析。這個前處理與引擎無關,維持不變:仍是「先剝前綴 → 高亮剝除後的內容 → 渲染時補回前綴與雙欄行號」。差別只在高亮回傳的是 token 而非 HTML 字串。

### 決策 6:非同步初始化與首次渲染

`createHighlighterCore()` 是 async,而目前 `highlightSnippet()` 是同步呼叫。採用:webview 啟動時即開始初始化 highlighter,**在完成前 snippet/diff 先以純文字(逃脫過)渲染,完成後重繪**。理由:純文字是既有的降級形狀(未支援語言就是這樣顯示),不需要新的載入態視覺,也不會出現空白區塊。

### 決策 7:移除 `codewalk.snippetTheme`

移除 `package.json` 的設定宣告、`src/viewProvider.ts:38` 的讀取與 `:70` 的 `onDidChangeConfiguration` 分支,以及 `:228`/`:245` 的 hljs 主題 CSS 掛載。配色改由當前編輯器主題決定,此設定失去存在理由。MVP 未發佈,不提供遷移路徑。

### 決策 8:snippet/diff 與 tip/pitfall 提示框的背景色改用 `--vscode-editor-background`

實作驗證階段發現:`ui/theme.css` 原本讓 `.codewalk-snippet-code`/`.codewalk-diff-code` 用 `--vscode-textCodeBlock-background`(VS Code 給 hover 提示框、markdown 預覽這類「小塊程式碼」用的疊加灰色),跟編輯器本體背景明顯不同色,與本 change「配色跟編輯器一致」的目標直接矛盾——手動驗證時實測發現面板底色是灰的、編輯器底色是深色,一比對就看出來。改用 `--vscode-editor-background`。

`.codewalk-annotation-tip`/`.codewalk-annotation-pitfall`(提示/陷阱警告框)也用了同一個變數,雖然不在本 change 原始範圍內(是更早的 `add-step-items` change 引進的既有元件),但同樣的視覺不一致問題存在,順手一併修正,維持面板整體視覺語言統一。邊框顏色(`textLink-foreground`/`charts-purple`)不變,只改背景。

### 決策 9(修正 proposal 的一處誤判):Groovy/Dart/Kotlin 的顏色落差是 semantic tokens,不是 grammar 品質

實作驗證階段一度懷疑是「Shiki 內建的 Groovy grammar 比編輯器實際用的 grammar 弱」(字串內插 `${}` 裡的識別字、Gradle DSL 方法名如 `doLast` 沒有上色)。**已實測推翻**:直接把使用者機器上 `vscjava.vscode-gradle` extension 附帶、編輯器實際在用的**真實** grammar 檔案(`syntaxes/groovy.tmLanguage.json`)原封不動載進 Shiki 重新 tokenize 同一段程式碼,結果與 Shiki 內建 grammar **完全一致**——`${project.name}` 裡的 `project.name` 仍是未拆解的單一 token、`doLast` 仍未上色。

這證實落差不在「grammar 來源」,而是 proposal.md 一開始就寫明的 Non-Goal:**semantic tokens**(來自 Gradle/Java language server 對「這是已知 DSL 屬性/方法」的語意分析,疊加在 TextMate 語法著色之上)。這一層落在任何 TextMate/Shiki 方案的能力範圍之外,不管換哪個語言的 grammar 檔案都一樣,唯一解法是內嵌對應語言的 language server——完全不同量級的工程,不在此 change 範圍內。維持 proposal.md 原有的 Non-Goals 聲明不變,此處只是記錄「換 grammar 來源」這條路徑已實測排除,避免日後重複調查。

## Risks / Trade-offs

| 風險 | 緩解 |
|---|---|
| webview bundle 304 KB → 2.4 MB,面板首次開啟變慢 | 本地載入(`vscode-webview://`)無網路成本;決策 6 的「先純文字後重繪」讓延遲不表現為空白畫面。若實測有感,再評估把 grammar 拆出 |
| 主題 JSON 為 JSONC,`JSON.parse` 會失敗 | 用容錯解析;失敗即降級(決策 3) |
| `include` 可能循環或過深 | 深度上限 5 層,超過即降級 |
| VS Code 改版改變內建主題路徑或 `contributes.themes` 結構 | 全鏈路 try/catch → 降級為 dark-plus/light-plus。後果是「顏色悄悄退回預設」而非崩潰;以手動驗證 checklist 定期確認 |
| 第三方主題品質不一(缺 `tokenColors`、欄位異常) | 視為解析失敗,降級 |
| 與編輯器仍非 100% 一致(semantic tokens) | 已於 proposal Non-goals 聲明。實測使用者當前主題本身不含 `semanticTokenColors`,實際落差更小 |
| 未來新增語言時 JS 引擎可能不支援 | 保留引擎比對腳本,新增語言時重跑(決策 1) |

## Migration Plan

1. 先落地 `src/themeSource.ts` 與協定訊息(此時 webview 仍用 highlight.js,主題資料先不消費)——可獨立驗證解析鏈與降級
2. 再替換 webview 端引擎與渲染,移除 `splitHighlightedLines()` 及其測試
3. 最後移除 `codewalk.snippetTheme` 設定與 hljs 主題 CSS 掛載,並移除 `highlight.js` 相依
4. 更新 `.codewalk/2026-08-03-language-highlight-demo.codewalk.json` 中失效的行號引用

**回退**:本 change 不改 `.codewalk.json` 格式,也不改任何持久化資料(`attemptStore` 不受影響),回退僅需 revert commit。

## Open Questions

- 主題物件經 `postMessage` 傳輸時,950 條 `tokenColors` 的序列化成本是否需要在 host 端先裁剪(只保留 `scope`/`settings`)?傾向先不最佳化,實作時量測再決定
