## Context

proposal 留下 6 個 Open Questions,其中第 1、2 點(DOM 建構方式、parser 選型)是連動的架構決策,會鎖死其餘四點的答案。本文以實測結果收掉全部六點。

**現況約束**(全部實測確認):

- `ui/render.ts` 立有明文紀律:「用 `textContent`(非 `innerHTML`)逐一附加 token,不需要跳脫 HTML」(`ui/render.ts:184`)。全檔零 `innerHTML`,唯一出現處是 `ui/main.ts:76` 的 `root.innerHTML = ''` 清空。這條紀律是本專案處理不受信任內容的既有防線
- webview CSP 為 `default-src 'none'; style-src ${cspSource}; font-src ${cspSource}; script-src 'nonce-${nonce}'`(`src/viewProvider.ts:239`),`enableCommandUris` 未開啟
- 敘述文字目前全部經 `el(tag, className, text)`(`ui/render.ts:14`)建立,該 helper 一律走 `textContent`
- `.codewalk-narration` 目前是單一 `<p>` 元素,配 `white-space: pre-line`(`ui/theme.css:664`),註解明寫其用途是「保留分段與條列的純文字標號」
- 現行 `dist/webview.js` 為 2786 KB(`openspec/decisions.md` 已定案不動)

**實測數據**(本次於 scratchpad 以 marked 實跑,非推測):

| 驗證項 | 結果 |
|---|---|
| `marked.lexer()` 的 block token 是否都帶 `raw` | 是——`paragraph`/`heading`/`list`/`blockquote`/`table`/`code`/`html` 全部有 |
| inline token 是否都帶 `raw` | 是——`text`/`codespan`/`strong`/`link` 全部有 |
| `Lexer.lexInline()` 是否可只解析行內語法 | 是——`- ` 在其眼中不成清單,自然落為 text |
| `gfm: false` 的效果 | 表格、autolink、刪除線**一併不成 token**,退為 paragraph 純文字 |
| `link` token 是否保留原始 href | 是——`javascript:alert(1)` 原封不動出現在 `token.href`,可自行檢查 |
| `heading` token 是否帶階層 | 是——`depth` 為 1/2/3… |
| marked 經 esbuild `--bundle --minify` 的體積 | 41 KB(現行 webview.js 的 1.5%) |

## Goals / Non-Goals

**Goals:**

- 在**不破壞零 `innerHTML` 紀律**的前提下渲染 markdown 子集
- 封閉子集的邊界由**機制**保證,而不是靠開發者記得過濾
- 「認不得就原樣輸出」是解析路徑的預設行為,而非逐語法補的例外
- 短欄位與長文欄位的語法分級不靠兩份程式碼

**Non-Goals:**

- 不追求與 CommonMark 完全一致的行為(單一換行語意即為刻意偏離)
- 不做解析結果快取或效能最佳化——`narration` 中位數 273 字,lex 成本在微秒級,量測前不預先最佳化
- 不改動 extension host 與 postMessage 協定

## Decisions

### D1:用 marked 的 **Lexer**,不用 marked 的 renderer

**決定**:引入 `marked`,但**只用 `Lexer`**(`marked.lexer()` / `Lexer.lexInline()`)取得 token 樹;**永不呼叫** `marked()`、`marked.parse()`、`marked.parser()` 這些會產出 HTML 字串的 API。

**為什麼不是自寫 parser**:封閉子集雖只有 6 種語法,但「正確」的成本集中在邊界——行內程式碼的多重反引號圍籬、粗體與程式碼的巢狀優先序、清單的縮排與延續行、連結文字裡的方括號。這些都是 CommonMark 花大篇幅定義的地方,自寫等於重新踩一次。

**為什麼不是 marked 的 HTML 輸出**:那條路要嘛破壞零 `innerHTML` 紀律,要嘛得在 HTML 字串上做消毒——而消毒字串正是這條紀律當初要避免的事。

**為什麼 Lexer 這條路可行**:實測確認每個 token 都帶 `raw`(產生該 token 的原始文字)。這一個欄位同時解決了兩個問題——不支援的語法直接輸出 `raw` 就是「原樣呈現」,而輸出用的是 `textContent`,天然無注入面。

**與既有慣例的呼應**:這正是 `ui/render.ts:184` 對 Shiki 採用的同一個模式——「Shiki 回傳結構化 token 而非 HTML 字串,天然沒有注入疑慮」。本 change 只是把同一招用在敘述文字上,不是新發明的模式。

**替代方案**:markdown-it 的 token stream 也可行,但其 token 沒有等同 `raw` 的欄位(只有 `markup`/`content`),降級路徑要自己重建原始文字。捨棄。

### D2:token → 手動建 DOM,零 `innerHTML` 紀律維持不變

**決定**:新增 `ui/markdown.ts`,對外只暴露兩個函式,回傳 `DocumentFragment` 而非字串:

```
renderMarkdownBlock(source: string, onOpenLink: (url: string) => void): DocumentFragment
renderMarkdownInline(source: string, onOpenLink: (url: string) => void): DocumentFragment
```

內部一律以 `document.createElement` + `textContent` 建構,沿用 `ui/render.ts` 既有的 `el()` helper 慣例。`onOpenLink` 由呼叫端注入,與 `renderReference()` 目前接 `handlers.onOpenReference` 的做法一致——`ui/markdown.ts` 不認識 postMessage,維持 webview 內部的分層。

**回傳 `DocumentFragment` 而非字串**:讓「本模組不可能產出 HTML 字串」成為型別層面的事實,而不是靠 code review 把關。

### D3:封閉子集用**雙層**機制保證,不靠白名單單打

**第一層 `gfm: false`**——實測確認這一個選項就讓表格、裸網址 autolink、刪除線**根本不成 token**,直接落為 paragraph 純文字。不要的語法擋在門外,比事後過濾可靠。

**第二層 token 白名單**——通過 lexer 的 token 型別中,只有下列進入渲染分支:

| token.type | 條件 | 產出 |
|---|---|---|
| `paragraph` | — | `<p class="codewalk-md-p">` |
| `heading` | **僅 `depth === 2`** | `<h3 class="codewalk-md-h">` |
| `list` | — | `<ul>` / `<ol>`,遞迴處理 `items` |
| `space` | — | 略過(區塊間距由 CSS margin 承擔) |
| `text`(inline) | — | 文字節點 |
| `codespan` | — | `<code class="codewalk-md-code">` |
| `strong` | — | `<strong>` |
| `link` | **href 為 http/https** | 可點擊元素,見 D5 |

**其餘一切**(`blockquote`、`code`、`html`、`table`、`em`、`del`、`image`、`depth !== 2` 的 heading、非 http/https 的 link)一律 `textContent = token.raw`。

**為什麼雙層**:`gfm: false` 擋掉 marked 未來可能預設開啟的 GFM 擴充;白名單擋掉 CommonMark 本身就有、而我們不要的語法(引用區塊、程式碼區塊、`#` 一級標題、`_斜體_`)。兩層各自負責一類風險。

**`heading` 只認 `depth === 2`**:`# 大標`、`### 三級` 的 token 型別同為 `heading`,靠 `depth` 分流,兩行判斷即可,不需要額外的預處理。產出 `<h3>` 而非 `<h2>`——面板已有導讀標題與步驟標題兩層,語意上這是第三層。

### D4:降級為純文字是**預設分支**,不是例外處理

**決定**:渲染函式的 `switch` 走 `default:` 就是 `fragment.append(document.createTextNode(token.raw))`。新增支援語法 = 新增一個 `case`;沒加 case 的一切自動安全降級。

**為什麼重要**:這讓 proposal 決策 7「降級是統一原則」在程式碼結構上成立,而不是靠 spec 文字約束。marked 未來版本若新增 token 型別,行為是「顯示原始文字」,不是崩潰或漏渲染。

### D5:內嵌連結複用既有的外部連結路徑

**決定**:`link` token 先驗 `new URL(token.href).protocol` 是否為 `http:`/`https:`——這與 `shared/schema.ts:92` 的 `isHttpUrl()` 是同一個判定。該函式目前是 module-private,本 change **為它加上 `export`** 並由 `ui/markdown.ts` 直接引用,不在 webview 端重寫一份。

**為什麼是 export 而非複製**:「什麼算合法連結」是 `.codewalk.json` 的格式合約,依 CLAUDE.md「schema 單點住 `shared/schema.ts`」的硬規則,判定只能有一處。複製一份等於埋下「validator 與渲染層對合法性看法分歧」的伏筆。加 `export` 不改任何行為,也不動型別與驗證規則。

- 通過 → 產出 `<button class="codewalk-md-link">`(**不是 `<a href>`**),文字為 link token 的內容,點擊呼叫 `onOpenLink(token.href)`,最終走既有的 `openReference` protocol 訊息 → `vscode.env.openExternal`
- 不通過 → `textContent = token.raw`,`[點我](command:xxx)` 原樣顯示

**為什麼用 button 不用 `<a>`**:與 `renderReference()`(`ui/render.ts:176`)完全一致。webview 內的 `<a href>` 有導航離開面板的風險,而「不在 CodeWalk 面板內導航離開」是 `walk-player` 既有 requirement 的明文要求。

**protocol 不需改動**:`openReference` 訊息已存在且形狀相符,`src/viewProvider.ts:79` 的處理分支原封不動。

### D6:單一換行的斷行語意由 **CSS 承擔**,不用 marked 的 `breaks` 選項

**決定**:`marked` 的 `breaks` 保持 `false`;`<p>` 與 `<li>` 保留 `white-space: pre-line`。

**為什麼**:實測 `breaks: true` 只影響 marked 的 **renderer**(把 `\n` 轉成 `<br>`),而我們不用 renderer;token 層的 `text.raw` 本來就完整保留 `\n`。既然 `textContent` 會把 `\n` 原樣塞進 DOM,只要目標元素有 `pre-line`,斷行就發生了。**這條決策在 token 路線下是零成本的**——不是新增行為,是既有 CSS 繼續生效。

**CSS 結構調整**:`.codewalk-narration` 從 `<p>` 改為 `<div>` 容器(markdown 會產生多個區塊元素),`white-space: pre-line` 從容器**下移**到 `.codewalk-md-p` 與 `.codewalk-md-li`。容器本身不設,以免 `space` token 略過後殘留的空白影響版面。`ui/theme.css:664` 那段註解需同步改寫——條列已改由真正的 `<ul>`/`<ol>` 承擔,pre-line 的用途縮小為「段落內的換行」。

### D7:短欄位用 `Lexer.lexInline()`,不是兩套 parser

**決定**:`renderMarkdownInline()` 呼叫 `Lexer.lexInline(source)`,共用同一份 inline token 渲染邏輯。

實測確認 `lexInline` 眼中 `- 項目` 就是普通文字,`## 標題` 亦然。所以 proposal 決策 5 的「短欄位只吃行內三種」不需要任何過濾程式碼——**選對入口就是規格**。

**套用對照**(呼叫端在 `ui/render.ts`):

| 函式 | 欄位 |
|---|---|
| `renderMarkdownBlock` | `narration`、`term.explanation`、`tip.text`、`todo.text`、`pitfall.misconception`、`pitfall.reality`、`optionExplanations[]` |
| `renderMarkdownInline` | `quiz.question`、`quiz.options[]`、`item.label`、`term.term`、`walk.title`、`step.title` |

### D8:巢狀清單支援,因為它是免費的

**決定**:支援。marked 的 `list` token 其 `items[].tokens` 內含巢狀 `list` token,遞迴渲染函式天然處理;要**限制**成一層反而得寫額外的深度檢查。不為了縮小規格而增加程式碼。

(收掉 proposal Open Question 3)

### D9:行內程式碼的跳脫跟隨 CommonMark

**決定**:多重反引號圍籬(`` `a` `` / ` ``a`b`` ` )的行為由 marked 的 lexer 決定,不自訂。這是選用成熟 parser 的直接收益。

(收掉 proposal Open Question 4)

### D10:樣式的 design token

沿用 `ui/theme.css` 既有慣例(全部取 VS Code 變數,不自帶色票):

| 元素 | 變數 |
|---|---|
| 行內程式碼背景 | `--vscode-textCodeBlock-background` |
| 行內程式碼前景 | `--vscode-textPreformat-foreground`,fallback `--vscode-editor-foreground` |
| 行內程式碼字體 | `--vscode-editor-font-family`(既有慣例,見 snippet 樣式) |
| 連結前景 / hover | `--vscode-textLink-foreground` / `--vscode-textLink-activeForeground` |
| 小標前景 | `--vscode-foreground` |

**關於 `--vscode-textCodeBlock-background`**:此變數曾在 `2026-08-03-switch-to-shiki-highlighter` 被否決,但那次的情境是**整塊 snippet 的底色**——它與編輯器本體背景不同色,違反「配色跟編輯器一致」。本次用途是**句中的小塊行內程式碼**,正是該變數在 VS Code 自己的 hover 提示與 markdown 預覽裡的原始用途,情境相反,採用。(收掉 proposal Open Question 5)

**`##` 小標字級**:`1.1em` + `font-weight: 600`,上方 `margin` 大於下方(視覺上歸屬其後段落)。明顯小於 `step.title`,不與面板既有階層競爭。(收掉 proposal Open Question 6)

### D11:解析發生在 webview 端

**決定**:`ui/markdown.ts` 住 webview,extension host 完全不參與。

理由:host 對敘述內容一向不解讀(`walkLoaded` 原封不動轉送),協定不必改;且 markdown 是**呈現**問題,依 CLAUDE.md 的分層硬規則本就屬 `ui/`。

## Risks / Trade-offs

- **[marked 的 token 結構隨版本變動,`raw` 或型別名稱改變]** → 鎖 major 版本;`ui/markdown.test.ts` 對每個白名單 token 型別各寫一則測試,升級時測試會先紅。降級路徑是 `default` 分支,即使新版新增未知 token 也只會顯示原始文字,不會崩潰
- **[`gfm: false` 一併關掉的東西比預期多]** → 已實測確認關掉的是表格、autolink、刪除線,三者都在 Out of Scope 內,無誤傷
- **[`space` token 略過後,連續多個空行的呈現與現行不同]** → 現行 `pre-line` 會把三個空行顯示成三行空白,新做法一律是區塊間的固定 margin。實測既有 6 份導讀檔只用單一空行分段,影響為零;但這是**行為變更**,需在 spec 明寫
- **[`.codewalk-narration` 從 `<p>` 變 `<div>`]** → 任何依賴該選擇器為段落的樣式都要複驗;範圍限於 `ui/theme.css`,無外部相依
- **[bundle 增加 41 KB]** → 佔現行 2786 KB 的 1.5%。`openspec/decisions.md` 記載首次上色前的約 71 ms 成本與語言 grammar 才是大頭,41 KB 不改變該結論
- **[產生器寫錯 markdown 時沒有任何警告]** → 這是 proposal 決策 6 的已知代價(驗證器不 parse 敘述)。緩解:`shared/schema.ts` 的 JSDoc 寫明支援語法,產生器讀得到;`explain-change` SKILL.md 同步更新
- **[封閉子集會讓熟 markdown 的作者困惑]** → 「`##` 可用但 `#` 不可用」確實反直覺。緩解:降級行為讓錯誤立即可見(原始符號會直接顯示在面板上),不會靜默失效

## Migration Plan

無資料遷移——本 change 不改 `.codewalk.json` 的任何欄位、型別或驗證規則,只改既有字串的呈現方式。既有 6 份導讀檔實測零衝突(`*` 0 則、行首 `-` 0 則、反引號 0 則;8 處單一換行的下一行全部是清單項)。

**Rollback**:呼叫端從 `renderMarkdownBlock(x)` 換回 `el('p', cls, x)` 即可,`ui/markdown.ts` 為純新增檔案,無反向相依。

## Open Questions

proposal 的六點全數收掉:第 1 點見 D1/D2,第 2 點見 D1,第 3 點見 D8,第 4 點見 D9,第 5 點見 D10,第 6 點見 D10。

## 實作筆記(D12):短欄位的巢狀互動元素

D5 訂了內嵌連結的判定與開啟方式,但沒處理**連結渲染出的可點擊元素落在另一個已有點擊行為的元素內**的情況——實作接線任務 5.3 時發現,`item.label`(顯示在 `renderReference`/`renderSnippet`/`renderDiff` 的 `<button>` 內)、`term.term`(顯示在有 click handler 的 `<summary>` 內)、live quiz 畫面的 `quiz.options[]`(顯示在包著 `<input type="radio">` 的 `<label>` 內)都屬此類。若連結渲染成 `<button class="codewalk-md-link">`,會產生巢狀 `<button>`/巢狀互動元素——不只是無效 HTML,點擊語意也會打架(`<label>` 內的巢狀按鈕仍可能觸發外層 radio 切換)。

**決定**:`OpenLinkHandler` 擴為 `MaybeOpenLinkHandler = OpenLinkHandler | null`。呼叫端傳 `null` 時,`link` token 一律降級為原始文字(與非 http/https 網址走同一條路徑),程式碼與粗體不受影響。判定規則:**渲染位置是否落在另一個可點擊祖先內**——是則傳 `null`,否則傳真正的 `onOpenReference`。

| 欄位 | 渲染位置 | 可點擊祖先? | onOpenLink |
|---|---|---|---|
| `walk.title` | `<h2>` | 否 | 真實 handler |
| `step.title` | `<h3>` | 否 | 真實 handler |
| `quiz.question` | `<p>`(live quiz 與結果頁皆同) | 否 | 真實 handler |
| `quiz.options[]`(結果頁顯示) | `<p>`/`<div>` | 否 | 真實 handler |
| `quiz.options[]`(live quiz 作答) | `<label>` 包 `<input radio>` | 是 | `null` |
| `item.label`(reference/snippet/diff) | `<button>` | 是 | `null` |
| `term.term` | `<summary>`(有 click handler) | 是 | `null` |

同一個底層欄位(如 `quiz.options[]`)在不同渲染位置可能分屬不同判定——這是設計上的正常結果,不是不一致:規則綁的是**渲染位置**,不是欄位本身。

這條規則不改變 spec.md 的任何 requirement——「內嵌連結的開啟方式與安全邊界」談的是連結本身合法時的行為,沒有規定每個顯示位置都必須支援點擊;`null` 情境下的降級與非法網址走同一條「原樣顯示、不可點擊」路徑,行為上是一致的。

本文無新增待決事項。
