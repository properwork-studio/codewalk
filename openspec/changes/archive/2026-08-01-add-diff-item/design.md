## Context

`CodewalkItem`(`shared/schema.ts`)目前是 tip/pitfall/todo/reference/snippet 五種 kind 的 discriminated union,`snippet` 的內容(`content`/`language`)是由 extension host 在每次 `walkLoaded`/`stepChanged` 時讀取真實檔案、透過 `HostToWebviewMessage.snippetPreviews` 送到 webview(`src/snippetPreview.ts`)。本次要新增 `diff` kind,呈現既有檔案內一段程式碼的改動前後差異(hunk),行為與視覺比照 `snippet`(見 grill-me 訪談結論、`docs/glossary.md`)。

關鍵差異:`diff` 的內容(`diffText`)是作者直接寫在 `.codewalk.json` 裡的靜態文字,不像 `snippet` 需要 host 即時讀真實檔案——這讓 `diff` 的實作可以完全略過 `snippetPreviews` 那一整套「host 讀檔 → postMessage 送內容 → webview 渲染」的協定往返。

現有分層慣例(不可打破,延續 `add-step-items` design.md 的決策):
- `shared/schema.ts`:`.codewalk.json` 格式單點定義
- `shared/protocol.ts`:host ⇄ webview 訊息單點定義
- `src/`(host):`fileJump.ts` 的 `jumpToStep(workspaceRoot, target: JumpTarget)` 只依賴 `{ file, startLine, endLine }`,不綁定特定 kind;`snippetPreview.ts` 的 `handleJumpToSnippet` 目前用 `item.kind !== 'snippet'` 擋掉其他 kind
- `ui/`(webview):禁碰 `vscode` API;`render.ts` 純 DOM 組裝;`highlight.ts` 的 `highlightSnippetLines(content, language)` 把整段內容丟 highlight.js、正確處理跨行 token(如多行註解/字串)後逐行切回陣列
- CSS 走 VS Code 暴露的 `--vscode-*` 變數(`theme.css`),不手刻顏色

## Goals / Non-Goals

**Goals:**
- `CodewalkItem` 新增 `diff` kind:`{ kind: 'diff'; label: string; file: string; startLine: number; endLine: number; oldStartLine: number; diffText: string }`(`oldStartLine` 為 2026-08-01 手動驗證階段追加,見決策 1 修訂)
- `diffText` 只存 hunk 本體(不含 `diff --git`/`---`/`+++`/`@@ @@` 檔頭),逐行以開頭字元(`+`/`-`/空白)判斷新增/刪除/context,可直接貼未經處理的 `git diff` hunk 內容(去掉檔頭那幾行)
- `startLine`/`endLine` 代表新版(現在檔案)行號範圍,點擊沿用既有跳轉機制;純刪除 hunk 時兩者相同,指向刪除處在新版檔案的插入點
- 渲染時逐行依開頭字元疊加 VS Code diff 編輯器的原生背景色(跟隨使用者實際主題),疊加語法高亮,並顯示舊版/新版雙欄行號與 `+`/`-` 標記字元(見決策 4 修訂)
- validator 要求 `diffText` 至少一行加/減行

**Non-Goals**(對齊 proposal.md 的 Out of Scope):
- 整檔新增/整檔刪除(無新舊兩側可比較)——新增用既有 `snippet`,刪除用文字說明
- 一個 item 裝多個不連續 hunk
- 解析 `git diff` 原始輸出的檔頭(`diff --git`/`---`/`+++`/`@@ @@`)並自動抽出 `file`/`startLine`/`endLine`/`oldStartLine`——這些欄位仍由作者手動填寫
- 逐字元(character-level)diff 高亮(如同一行內只有某幾個字元變了要特別標示)——只做逐「行」層級的加減辨識
- Side-by-side(左右分屏)呈現——仍是單一垂直堆疊的 unified diff 版面,只是行號欄位從單欄(僅新版)改為雙欄(舊版+新版)

## Decisions

### 1. Schema:`CodewalkItem` 新增 `diff` 成員

```ts
export type CodewalkItem =
  | { kind: 'tip'; text: string }
  | { kind: 'pitfall'; misconception: string; reality: string }
  | { kind: 'todo'; text: string }
  | { kind: 'reference'; label: string; url: string }
  | { kind: 'snippet'; label: string; file: string; startLine: number; endLine: number }
  | { kind: 'diff'; label: string; file: string; startLine: number; endLine: number; oldStartLine: number; diffText: string };
```

`validateItem` 新增 `case 'diff'`:沿用 `snippet` 分支的 `label`/`file`/`validateLineRange` 檢查,額外新增 `diffText` 非空字串檢查,以及 `hasAtLeastOneChangedLine(diffText)`——把 `diffText` 依 `\n` 切行(捨棄結尾換行產生的尾端空字串元素),要求至少一行以 `+` 或 `-` 開頭,否則報錯「至少要有一行新增或刪除」。

**Alternatives considered**:validator 進一步檢查 `diffText` 每一行都必須以 `+`/`-`/空白 開頭(嚴格比對合法 hunk 格式)——捨棄,過嚴會拒絕作者手動編輯、忘了補空白前綴的 context 行;渲染端遇到不明開頭字元時 fallback 當 context 處理即可(見決策 3),validator 只把關「這確實是一段有改動的 diff」這個語意底線。

**2026-08-01 修訂(手動驗證階段,使用者要求 diff 顯示雙欄行號)**:新增 `oldStartLine: number`(舊版第一行的行號,`isPositiveInteger` 檢查,不需與 `startLine` 有大小關係限制——兩套編號各自獨立遞增)。理由見決策 4 修訂:要正確畫出「舊版行號」欄位,只有 `startLine`(新版起點)不夠算,必須額外知道舊版起點才能逐行推算。`endLine` 維持不變、不新增 `oldEndLine`——舊版終點只用於畫面顯示的行號推算,不像 `endLine` 需要拿去餵 `jumpToStep`(舊版程式碼已經不存在於 workspace,無處可跳),用逐行推算即可,不需要獨立欄位。

### 2. 內容傳遞:不新增 protocol 訊息,`diffText` 直接隨 `CodewalkFile` 送達 webview

`snippet` 需要 `snippetPreviews` 協定欄位,是因為內容來自「讀取當下真實檔案」,必須由有檔案系統存取權的 host 讀取。`diff` 的 `diffText` 是作者寫在 `.codewalk.json` 裡的靜態內容,`walkLoaded` 訊息的 `walk: CodewalkFile` 本來就完整帶著 `steps[].items[]`,webview 早已拿得到 `diffText` 本體——不需要新的協定往返。

**Alternatives considered**:比照 `snippet` 也開一組 `diffPreviews` 欄位——捨棄,沒有實際需要「host 端才能做」的工作(沒有檔案讀取、沒有錯誤處理分支),多開協定欄位只是重複已經有的資料,徒增維護面。

### 3. 語言偵測:抽出 `detectLanguage` 到 `shared/`,host 與 webview 共用

`diff` 的語法高亮需要依 `file` 副檔名判斷語言,但這次判斷邏輯要在 **webview** 端執行(渲染 `diffText` 時直接呼叫,理由見決策 2),而現有 `detectLanguage`/`EXTENSION_LANGUAGE`(副檔名 → 語言名稱對照表)住在 `src/snippetPreview.ts`——不属於 webview 能 import 的範圍(`src/` 是 host 專屬目錄,即使這段程式碼本身不碰 vscode API)。

把 `EXTENSION_LANGUAGE`/`detectLanguage` 搬到新檔案 `shared/language.ts`,`src/snippetPreview.ts` 改成從那裡 import(行為不變),`ui/render.ts` 渲染 `diff` item 時也從同一個模組 import 使用。

**Alternatives considered**:在 `ui/` 底下另外複製一份同樣的副檔名對照表——捨棄,兩處各自維護同一張表格,未來新增副檔名對應(如 `.vue`、`.svelte`)容易只改到一邊、悄悄產生行為分歧;搬到 `shared/` 是最小幅度的歸位,不是新增抽象。

### 4. 渲染:逐行剝除開頭字元,重用 `highlightSnippetLines` 做語法高亮

`renderDiff(item, itemIndex, onJumpToSnippet)`(`ui/render.ts`)邏輯:

1. `diffText.split('\n')`,若最後一個元素是空字串(來自結尾換行)則捨棄
2. 逐行取開頭字元判斷型態:`'+' → added`、`'-' → removed`、其餘 → `context`;取該行去掉開頭字元後的內容(不明開頭字元或空字串行,視同 context、整行內容原樣保留,不強制剝除)
3. 把所有「剝除開頭字元後」的行內容用 `'\n'` 重新組回一整段字串,一次丟給 `highlightSnippetLines(content, language)`(`language` 來自決策 3 的 `detectLanguage(item.file)`)——與 `snippet` 走同一套多行 token 續接邏輯,確保跨行的語法結構(如多行字串)不會因為逐行分開高亮而斷裂
4. 依步驟 2 記錄的型態陣列,把步驟 3 拿回的逐行 HTML 各自包進對應的行容器(`codewalk-diff-line-added`/`-removed`/`-context`)

**Alternatives considered**:逐行各自呼叫 `highlightSnippet`(不重組整段)——捨棄,會讓跨行語法結構(如 template literal、區塊註解)在每一行單獨判斷時失去上下文,顏色判斷更容易出錯;`snippet` 已經用「整段高亮再切行」解決過這個問題,直接重用。

**2026-08-01 修訂(手動驗證階段,使用者要求雙欄行號 + `+`/`-` 標記,像 GitHub PR diff 一樣)**:`classifyDiffLines(diffText, oldStartLine, newStartLine)` 新增兩個參數與回傳欄位:

```ts
export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  oldLineNumber: number | null; // 新增行沒有舊版行號
  newLineNumber: number | null; // 刪除行沒有新版行號
}
```

逐行維護兩個獨立計數器(`oldLine` 從 `oldStartLine` 起、`newLine` 從 `startLine` 起):`context` 行兩個計數器都遞增並各自記錄目前值;`added` 行只遞增/記錄 `newLine`(`oldLineNumber: null`);`removed` 行只遞增/記錄 `oldLine`(`newLineNumber: null`)。這與 `git diff`/GitHub PR diff 頁面算雙欄行號的邏輯完全相同。

`renderDiffCode` 每一行的 gutter 從原本單純的背景色,改成三個欄位由左到右:`+`/`-`/(空白)標記字元 → 舊版行號(`removed`/`context` 顯示、`added` 留空)→ 新版行號(`added`/`context` 顯示、`removed` 留空)→ 程式碼內容。標記字元與行號都是**純文字**,不影響決策 5 的整行背景色(背景色仍套用在整個 row,標記字元只是額外的視覺強化,對色盲/不容易分辨紅綠背景色的讀者也是重要的輔助資訊)。

**Alternatives considered**:只顯示單欄行號(僅新版,刪除行留空)——這是使用者看過畫面後主動要求的修訂前版本,捨棄理由是「跟 Git Diff 一樣」的期待包含看到舊版行號往前推算的位置感(例如「這段程式碼原本在第 8 行,改完後變成第 10 行」),單欄看不出這個資訊。

### 5. 視覺:加減行背景色用 VS Code 內建 diff 編輯器變數

新增 CSS class 使用 `--vscode-diffEditor-insertedLineBackground`(新增行)與 `--vscode-diffEditor-removedLineBackground`(刪除行)——這兩個變數就是 VS Code 內建 diff 檢視器本身用來畫整行背景色的變數,使用者換了主題或自訂了 diff 顏色都會自動跟著變,完全符合專案「視覺跟隨編輯器主題」的設計原則,不需要另外決定紅/綠的實際色碼。Context 行不上背景色,維持透明。

語法高亮(token 顏色)沿用 `snippet` 既有的 `.hljs` 容器 class 與 `dist/hljs-themes.css` 機制,疊加在上述背景色之上——background-color 與文字顏色是兩個獨立圖層,不衝突。

**Alternatives considered**:自訂固定紅/綠色碼(如 `#3fb95022`/`#f8514922`)——捨棄,無法跟隨使用者實際主題,且專案已有現成的 `--vscode-diffEditor-*` 變數可以直接對應這個確切用途,沒有理由不用。

### 6. 點擊跳轉:擴充既有 `jumpToSnippet` 訊息,不新增訊息型別

`WebviewToHostMessage.jumpToSnippet`(`{ type: 'jumpToSnippet'; stepIndex: number; itemIndex: number }`)語意只是「跳轉到某個 step 底下某個 item 標示的位置」,`diff` 與 `snippet` 需要的資訊完全相同(`file`/`startLine`/`endLine`)。`src/viewProvider.ts` 的 `handleJumpToSnippet` guard 從 `item.kind !== 'snippet'` 改成 `item.kind !== 'snippet' && item.kind !== 'diff'`,其餘邏輯(呼叫 `jumpToStep(root, item)`、失敗時回 `stepJumpError`)不用改——`JumpTarget` 介面只要求 `file`/`startLine`/`endLine`,`diff` 物件結構上滿足。`ui/render.ts` 的 `renderDiff` 同樣呼叫既有 `onJumpToSnippet(itemIndex)` handler。

**Alternatives considered**:新增 `jumpToItem` 取代 `jumpToSnippet`,兩個 kind 都改用新名字——捨棄,目前只有兩種 kind 需要這個行為,對照 `add-step-items` design.md 決策 3 記錄過的 rule of three 慣例(第三個呼叫點出現才抽/改名),現在改名純粹是命名好看、沒有實質收益,卻要動到兩個檔案的既有呼叫點;之後若第三種 kind 也需要同樣跳轉行為,再一併評估改名。

## Risks / Trade-offs

- **[Risk]** 作者手動編輯 `diffText` 時忘記幫 context 行補開頭空白字元,導致該行被誤判成別的型態或內容多算一個字元 → **Mitigation**:渲染端只依「第一個字元是否為 `+`/`-`」判斷加減,其餘一律當 context 且不強制剝除開頭字元,最差情況只是該行縮排看起來多一格,不會整段渲染失敗;validator 不到逐行格式的嚴格程度(見決策 1)
- **[Risk]** `--vscode-diffEditor-insertedLineBackground`/`removedLineBackground` 在極少數自訂主題下可能未定義或對比度不足 → **Mitigation**:這兩個變數是 VS Code 內建 diff 編輯器本身依賴的核心變數,所有官方與主流第三方主題都會定義;風險與現有 `--vscode-editorWarning-foreground` 等已使用變數相同等級,專案已接受
- **[Risk]** `shared/language.ts` 抽出後,`src/snippetPreview.ts` 的既有 import 路徑改變 → **Mitigation**:純粹搬移+改 import,行為不變,既有 `snippetPreview.test.ts` 測試案例可直接驗證無回歸

## Migration Plan

無需遷移。`diff` 為 `CodewalkItem` discriminated union 新增的成員,既有 `.codewalk.json` 檔案不含 `diff` kind 的 item,行為完全不受影響。`shared/language.ts` 抽出屬內部重構,不影響任何對外格式或協定。

## Open Questions

無——所有分支已在 grill-me 訪談與本次 design 過程中定案。
