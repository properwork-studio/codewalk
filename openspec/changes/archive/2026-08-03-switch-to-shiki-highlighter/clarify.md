# Clarify — switch-to-shiki-highlighter

## 背景

目前 snippet/diff 的語法高亮用 highlight.js。剛完成的語言擴充(commit `e2a040a`)在實機驗證時發現:highlight.js 是輕量 regex grammar,同一段程式碼在 webview 裡的顏色明顯比 VS Code 編輯器本身樸素——方法呼叫、參數、多數型別都不上色。Shiki 直接吃 TextMate grammar,是唯一能貼近編輯器的選項。

## Q1 —— 「與編輯器一致」要做到什麼程度?

- [x] **讀使用者當前主題 + 失敗降級**:抽出「主題來源」介面,實作為讀取使用者當前主題的 tokenColors;任一環節失敗退回 `dark-plus`/`light-plus`。監聽 `onDidChangeActiveColorTheme` 在切主題時重繪。`codewalk.snippetTheme` 移除(**BREAKING**)
- [ ] 只做 dark-plus/light-plus
- [ ] 這次只做介面與預設,真實主題讀取另開 change

### 查證結果(2026-08-03,實測)

**這條路徑大部分是公開 API,只有兩處沒有合約保證:**

| 步驟 | API | 有合約保證? |
|---|---|---|
| 讀當前主題名 | `workspace.getConfiguration('workbench').colorTheme` | ✅ |
| 反查主題 extension | `vscode.extensions.all` + `packageJSON.contributes.themes` | ✅ |
| 主題切換時重繪 | `window.onDidChangeActiveColorTheme` | ✅ |
| 內建主題檔路徑 | `env.appRoot/extensions/theme-defaults/themes/*.json` | ❌ |
| 主題 JSON 的 `include` 繼承 | 自行遞迴解析 | ❌ |

**降級行為是這個決策成立的前提**:上述任一步失敗(找不到 extension、讀檔失敗、JSON 解析失敗)都只會導致「顏色退回預設主題」,不會崩潰、不會空白、不會擋住走讀。實作時每一環都必須包 try/catch 並 fallback,這點要寫進 spec 的錯誤情境。

> **實作階段更新**:上表「內建主題檔路徑」原評估為無 API 保證,實作後發現此路不需要——VS Code 內建主題(`theme-defaults` 等)本身就以 extension 形式註冊,`vscode.extensions.all` 的 `ext.extensionPath` 天然涵蓋內建與第三方兩種來源,不需要另外 hardcode `env.appRoot`。詳見 design.md 決策 3,此處保留原始評估作為決策過程記錄。

**天花板(重要,實測)**:Shiki 的主題檔含 `semanticTokenColors` 欄位,但 `@shikijs/core` 完全不讀它。VS Code 編輯器的顏色是 `TextMate grammar + semantic tokens(來自 language server)` 兩層疊加,Shiki 只有前者。因此**即使讀到真實主題,100% 一致仍不可能**——裝了 redhat.java 時,編輯器裡 Java 的欄位/參數/區域變數有 semantic 細分色,snippet 給不出來。

決策理由:兩種差異量級不同。使用非預設主題時,固定用 dark-plus 是「整個色系不同」(一眼可辨);semantic 細分是同色系內的次級差異。讀真實主題能拿到大部分價值。

## Q2 —— 語言載入策略

- [x] **靜態內嵌現有 23 種**:不動 CSP、渲染維持同步、範圍最小
- [ ] 改成按需動態載入(涵蓋 Shiki 全部 200+ 語言)

### 查證結果(2026-08-03,實測)

否決動態載入的三個理由:

1. **CSP 是硬阻力**。專案現況 `src/viewProvider.ts:237` 是 `script-src 'nonce-${nonce}'`,純 nonce。動態 `import()` 產生的 chunk 帶不了 nonce,會被 CSP 直接擋掉。必須放寬成 `'nonce-x' ${webview.cspSource}` 或加 `'strict-dynamic'`——為了 lazy load 放寬安全設定,不划算
2. **grammar 相依會擴散**。`@shikijs/langs/php` 的 `embeddedLangs` 是 `["html","xml","sql","javascript","json","css"]`,載一個 php 要連帶拉 6 個 grammar(javascript/typescript 各約 190 KB),「按需」省下的量比直覺少很多
3. **渲染轉非同步**會多出「先無色再上色」的閃爍,要額外設計載入態

## 體積實測(esbuild minify)

| 配置 | 未壓縮 | gzip(≈VSIX 內大小) |
|---|---|---|
| 現況 highlight.js,23 語言 | 304 KB | 68 KB |
| **Shiki 精簡 + JS 引擎(本次採用方向)** | **2.44 MB** | 310 KB |
| Shiki 精簡 + oniguruma WASM | 2.98 MB | 520 KB |
| Shiki 完整包(全語言全主題) | 9.5 MB | 1.67 MB |

對照本機 134 個已安裝 extension:中位數 3 MB、P25 1 MB、P75 12 MB、58% 小於 5 MB。換完後 CodeWalk 約 3 MB,落在中位數,比同類的 CodeTour(24 MB)小一個數量級。**體積不是這個 change 的阻力**。

## 留給 design 決的

- **引擎選型**:JS 引擎(`@shikijs/engine-javascript`,省 570 KB 與 WASM 載入)vs oniguruma WASM(相容性最好)。JS 引擎不支援 oniguruma 特有 regex 語法,需實測 23 種 grammar 是否全部可用——**design 階段必須實測,不可憑推測**
- **非同步改造範圍**:`createHighlighterCore()` 是 async,而 `highlightSnippet()` 目前是同步呼叫。要決定是「host 端預先初始化後才送資料」還是「webview 端先出純文字再補色」
- **既有切行邏輯的去留**:`splitHighlightedLines()` 是為 highlight.js 的單塊 HTML 輸出寫的;Shiki 有 `codeToTokens()` 可直接拿到逐行 token,可能整段可以刪掉

## 已決:示範導讀的維護

`.codewalk/2026-08-03-language-highlight-demo.codewalk.json` 第五步用 diff 元件呈現副檔名對應表的改動,換 Shiki 後 `shared/language.ts` 的行號會失效。**決定在本 change 的 tasks 內順手更新**(含引用 `ui/highlight.ts` 的 snippet 行號),不另外處理。

## Open Questions

- 移除 `codewalk.snippetTheme` 是 BREAKING,但 MVP 尚未發佈,是否需要遷移路徑?(傾向:不需要,直接移除)
- diff 元件目前把每行去掉 `+`/`-` 前綴後再送高亮,換成 Shiki 的逐行 token API 後這個前處理要怎麼接?
