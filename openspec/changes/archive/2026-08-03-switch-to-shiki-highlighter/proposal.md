## Why

讀者在 CodeWalk 面板看程式碼時,顏色比旁邊的編輯器樸素很多——方法呼叫、參數、多數型別都沒有顏色;若讀者用的不是 VS Code 預設主題,面板與編輯器連整個色系都不同。視線在面板與編輯器之間來回時,等於要適應兩套配色,這與「讓讀者的注意力留在程式碼上」的產品目標相衝突。

根因是 highlight.js 用的是輕量 regex grammar,能表達的 token 種類遠少於 VS Code 編輯器所用的 TextMate grammar。這在剛完成的語言擴充(commit `145e3f7`)實機驗證時被確認:同一段 Java,編輯器裡有顏色的 token 在面板裡多半是素色。

## What Changes

- 語法高亮引擎由 highlight.js 換成 **Shiki**(直接使用 TextMate grammar,與 VS Code 編輯器同源)
- 高亮配色**跟隨讀者當前的 VS Code 主題**:讀取該主題的 `tokenColors` 餵給 Shiki
- 主題讀取的任一環節失敗時**降級**為 Shiki 內建的 `dark-plus`/`light-plus`,面板照常運作
- 讀者切換 VS Code 主題時,已顯示的 snippet/diff **重繪**為新主題配色
- **BREAKING**:移除 `codewalk.snippetTheme` 設定(原本提供 10 種 highlight.js 主題,換引擎後這些主題名一律失效;配色改由當前編輯器主題決定,設定失去存在理由)
- 語言覆蓋維持現有 23 種,不擴大也不縮減
- 同步更新 `.codewalk/2026-08-03-language-highlight-demo.codewalk.json` 中因本次改動而失效的行號引用

## Capabilities

### New Capabilities

- `syntax-highlighting`:程式碼片段的語法高亮行為合約——配色來源與降級、支援語言的判定、主題切換時的重繪、無法判定語言時的處置。原本這些行為散落在 `walk-player` 的 snippet/diff 兩個 requirement 的描述句裡,沒有獨立可測的合約;本次抽出成獨立 capability

### Modified Capabilities

- `walk-player`:「視覺跟隨編輯器主題」的適用範圍由介面樣式(背景、文字、強調色)**擴及程式碼高亮配色**——原 requirement 只約束 webview 讀取 VS Code CSS 變數渲染介面,未涵蓋程式碼片段內部的 token 配色

## Out of Scope / Non-goals

- **不追求與編輯器 100% 一致**。VS Code 的顏色是 `TextMate grammar + semantic tokens(來自 language server)` 兩層疊加,而 Shiki 只吃前者(已實測:Shiki 主題檔含 `semanticTokenColors` 欄位,但 `@shikijs/core` 完全不讀)。裝了 language server 的語言,其欄位/參數/區域變數的 semantic 細分色本次拿不到,亦不打算補
- **不擴大語言覆蓋範圍**。維持 23 種靜態內嵌;改成按需動態載入以涵蓋 Shiki 全部 200+ 語言的方案已在 clarify 階段否決(CSP 需放寬、grammar 相依擴散、渲染轉非同步)
- **不改變 `.codewalk.json` 格式**。本次不新增、不修改任何 schema 欄位
- **不改變 snippet/diff 的互動行為**。點擊跳轉、雙欄行號、加減行背景色一律維持現狀
- **不提供設定遷移路徑**。MVP 尚未發佈,`codewalk.snippetTheme` 直接移除

## Impact

**程式碼**

| 路徑 | 影響 |
|---|---|
| `ui/highlight.ts` | 引擎替換;`splitHighlightedLines()` 可能整段移除(Shiki 的 `codeToTokens()` 直接回傳逐行 token) |
| `ui/render.ts` | snippet/diff 的高亮結果消費方式改變 |
| `src/viewProvider.ts` | 新增主題讀取與 `onDidChangeActiveColorTheme` 監聽;移除 hljs 主題 CSS 的 `asWebviewUri` 掛載 |
| `shared/protocol.ts` | 若主題資料需由 host 送往 webview,新增對應訊息型別 |
| `package.json` | 移除 `codewalk.snippetTheme` 設定宣告;相依由 `highlight.js` 換成 `shiki` |
| `.codewalk/2026-08-03-language-highlight-demo.codewalk.json` | 更新失效的行號引用 |

**相依與體積**

- 移除 `highlight.js`,新增 `shiki`
- webview bundle 304 KB → 約 2.44 MB(gzip 68 KB → 310 KB)。extension 總量約 3 MB,落在一般 extension 的中位數,體積不構成阻力(實測數據見 `clarify.md`)

**行為**

- 使用 `codewalk.snippetTheme` 的既有設定會失效(BREAKING,MVP 未發佈故無實際使用者)
- 面板首次顯示 snippet 的路徑可能由同步轉非同步(`createHighlighterCore()` 為 async),具體改造方式由 design 決定

## Open Questions

- diff 元件目前把每行去掉 `+`/`-` 前綴後才送進高亮,換成 Shiki 的逐行 token API 後這個前處理如何銜接?(design 階段決定)
- 引擎選 `@shikijs/engine-javascript`(省 570 KB,但不支援 oniguruma 特有 regex 語法)或 oniguruma WASM?**必須實測 23 種 grammar 是否全部可用,不可憑推測**(design 階段決定)
