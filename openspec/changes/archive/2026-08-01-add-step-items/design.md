## Context

`CodewalkStep` 目前只有 `narration`(主敘述字串)與 `terms?`(可收合術語卡,獨立於本次變更)。本次要新增 `items?: CodewalkItem[]`,让撰寫者能在主敘述之外附加 tip/pitfall/todo/reference/snippet 五種補充內容,陣列順序即畫面顯示順序。

現有分層慣例(不可打破):
- `shared/schema.ts`:`.codewalk.json` 對外開放格式單點定義,`CodewalkFile`/`CodewalkStep` 皆在此
- `shared/protocol.ts`:`HostToWebviewMessage`/`WebviewToHostMessage` 是 extension host ⇄ webview 唯一溝通管道
- `src/`(extension host):`viewProvider.ts` 是訊息路由中樞;`fileJump.ts` 的 `jumpToStep(workspaceRoot, target: JumpTarget)` 已經是通用函式,不綁定「目前 step」,可直接重用於 snippet 跳轉
- `ui/`(webview):禁碰 `vscode` API,`render.ts` 純 DOM 組裝,`state.ts` 管狀態轉換
- webview CSP 為 `default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'`——沒有 `unsafe-inline`,任何 CSS 都必須來自打包後的 stylesheet,不能用內嵌 `style=""` 或 `<style>`;VS Code 會自動在 webview `<body>` 加上 `vscode-dark`/`vscode-light`/`vscode-high-contrast`/`vscode-high-contrast-light` class,不需要額外偵測主題的程式碼

## Goals / Non-Goals

**Goals:**
- `CodewalkStep.items` 支援 tip/pitfall/todo/reference/snippet 五種 kind,discriminated union,陣列順序即顯示順序
- snippet 項目於面板上預設展開、預覽實際程式碼內容(highlight.js,依 `vscode-dark`/`vscode-light` body class 切換色票),點擊後重用既有 `jumpToStep` 跳轉編輯器
- reference 項目點擊後以 `vscode.env.openExternal` 開啟外部瀏覽器
- pitfall 視覺與既有 `codewalk-warning`(refDrift/stepJump 系統警告)明確區隔
- `reference.url` 通過 http/https 合法格式檢查

**Non-Goals**(對齊 proposal.md 的 Out of Scope):
- items 陣列筆數上限、拖曳重排 UI
- 既有 `terms` 併入 `items` 的遷移
- shiki/textmate 級語法高亮,或 100% 貼合使用者實際安裝的 VS Code 主題色票
- 「正在查看 snippet」的面板狀態追蹤與返回按鈕
- http/https 以外的 URL 協定驗證

## Decisions

### 1. Schema:`CodewalkItem` discriminated union

```ts
export type CodewalkItem =
  | { kind: 'tip'; text: string }
  | { kind: 'pitfall'; misconception: string; reality: string }
  | { kind: 'todo'; text: string }
  | { kind: 'reference'; label: string; url: string }
  | { kind: 'snippet'; label: string; file: string; startLine: number; endLine: number };

// CodewalkStep 新增:
items?: CodewalkItem[];
```

`shared/schema.ts` 新增 `validateItem(item, path, errors)`,依 `kind` 分派到對應驗證邏輯,規則與現有 `validateTerm`/`validateStep` 同一套風格(`isNonEmptyString`/`isPositiveInteger`);`snippet` 的 `startLine`/`endLine` 驗證重用 `validateStep` 現有的「`endLine` 不可小於 `startLine`」邏輯。

`reference.url` 新增 `isHttpUrl(value)` 檢查:用 `new URL(value)` try/catch 取得 `protocol`,限定 `http:`/`https:`,不做超出此範圍的格式要求(不擋 query string、fragment、非常見但合法的字元)。

**Alternatives considered**:純 regex 比對 URL 格式——捨棄,`new URL()` 是標準函式、比自寫 regex 更不容易漏判邊界情況(如 IPv6 host、port)。

### 2. `terms` 與 `items` 保持獨立欄位

不做遷移,`terms?: CodewalkTerm[]` 原樣保留。理由已在 proposal.md 記錄:避免既有 `.codewalk.json` 檔案破壞性遷移,且兩者語意不同(術語解釋 vs 敘述延伸)。

### 3. Protocol:snippet 內容由 host 隨 step 一起推送,不新增請求命令

`walkLoaded`/`stepChanged` 訊息新增 `snippetPreviews` 欄位,只包含**目前 step** 的 snippet 預覽結果(不預讀整份 walk,不多開一組請求/回應命令):

```ts
export type SnippetPreviewResult =
  | { itemIndex: number; ok: true; content: string; language: string }
  | { itemIndex: number; ok: false; message: string };

export type HostToWebviewMessage =
  | { type: 'walkFileList'; files: WalkFileSummary[] }
  | { type: 'walkLoaded'; walk: CodewalkFile; stepIndex: number; refDrifted: boolean; snippetPreviews: SnippetPreviewResult[] }
  | { type: 'stepChanged'; stepIndex: number; snippetPreviews: SnippetPreviewResult[] }
  | { type: 'loadError'; message: string }
  | { type: 'stepJumpError'; message: string };
```

`itemIndex` 對應 `step.items` 陣列索引(不是另建 id),webview 渲染時用同一個 index 去 `step.items[itemIndex]` 對齊。

新增 `src/snippetPreview.ts`:

```ts
export async function readSnippetPreviews(workspaceRoot: string, items: CodewalkItem[]): Promise<SnippetPreviewResult[]>
```

對 `items` 中 `kind === 'snippet'` 的項目逐一讀檔、切出 `startLine..endLine` 行、依副檔名判斷語言(見決策 5),檔案不存在時回傳 `{ ok: false, message: '找不到檔案:...' }`(與 `fileJump.ts` 的 `JumpResult` 錯誤訊息風格一致)。

**Alternatives considered**:webview 收到 `walkLoaded` 後另外 postMessage 請求每個 snippet 內容——捨棄,決策已定「隨 step 載入即顯示」,多一組請求/回應徒增協定複雜度且無實際收益(內容本來就隨 step 切換一起送)。

`join(workspaceRoot, file)` + `existsSync` 這段檢查目前只有 `fileJump.ts` 一處(內聯,無獨立函式),`snippetPreview.ts` 會是第二處重複——依 rule of three 暫不抽共用;第三個呼叫點出現時再抽。

### 4. Snippet 點擊跳轉:重用 `jumpToStep`,不新增跳轉函式

`fileJump.ts` 的 `jumpToStep(workspaceRoot, target: JumpTarget)` 本來就不綁定「目前 step」,`JumpTarget` 形狀(`file`/`startLine`/`endLine`)與 snippet 完全相同。`WebviewToHostMessage` 新增:

```ts
| { type: 'jumpToSnippet'; stepIndex: number; itemIndex: number }
```

`viewProvider.ts` 收到後從 `currentWalk.steps[stepIndex].items[itemIndex]` 取出 snippet(非 snippet kind 則忽略),直接呼叫既有 `jumpToStep`,失敗時沿用既有 `stepJumpError` 訊息——不新增錯誤型別,對齊「重用現有 jumpError 機制」的決策。webview 端不記錄「正在查看 snippet」狀態,下次 `nextStep`/`prevStep`/`jumpToStep` 觸發的 `jumpToCurrentStep` 會照常把編輯器帶回主 step 位置。

### 5. Reference 點擊:webview 不自帶 `<a href>` 導航,改走 postMessage

`WebviewToHostMessage` 新增:

```ts
| { type: 'openReference'; url: string }
```

`viewProvider.ts` 收到後呼叫 `vscode.env.openExternal(vscode.Uri.parse(msg.url))`。不用原生 `<a target="_blank">`,理由:webview 內的外部導航行為在不同 VS Code 版本/平台不一致,且違反「webview 禁碰 vscode API、host 才能碰外部系統」的分層慣例——由 host 統一呼叫 `openExternal` 更可控。

### 6. Snippet 語法高亮:`highlight.js/lib/core` + 手動註冊語言子集,依 `vscode-dark`/`vscode-light` class 切換自訂色票

`ui/main.ts` 引入 `highlight.js/lib/core`,只手動 `register` 專案常見語言(`typescript`/`javascript`/`json`/`python`/`go`/`rust`/`css`/`html`/`markdown`/`bash`/`yaml`),不用 `highlight.js/lib/common`(內建 ~35 種語言,bundle 較肥)。語言判斷靠 `file` 副檔名對應簡單 map,對應不到的副檔名或未註冊語言 fallback 為純文字(不呼叫 `highlightAuto`,避免猜錯語言导致顏色誤導)。

~~不直接引入 highlight.js 官方預建 theme CSS(如 `github-dark.css`)——那些 theme 是全域 `.hljs-*` selector,沒有 dark/light 切換的 scope 機制。改為手寫兩組小型 CSS(`.vscode-dark .codewalk-snippet-code .hljs-*` / `.vscode-light .codewalk-snippet-code .hljs-*`),只覆蓋實際會用到的 token class~~(見下方「2026-08-01 修訂」,此段已被取代)。

**Alternatives considered**:
- shiki/textmate tokenizer——grill-me 階段已比較過,重量級成本與 highlight.js 相比不划算,兩者都做不到 100% 貼合使用者實際主題色票
- ~~引入完整 highlight.js 官方 theme CSS 檔——捨棄,無法配合 body class 做 dark/light 切換,且會夾帶用不到的語言/元素樣式~~(已被下方修訂推翻:`@scope` 解決了「配合 body class 切換」這個當初捨棄的理由)

**2026-08-01 修訂(手動驗證階段,使用者要求新增更多可選 theme 後發現手寫色票不可持續)**:改用 `@scope` CSS at-rule 直接包住 `node_modules/highlight.js/styles/*.css` 官方主題檔案原文,不逐條改寫 selector、不手寫顏色:
- `esbuild.js` 新增 `buildHljsThemesCss()`:對每個 `codewalk.snippetTheme` 設定值,讀對應官方 `.css` 來源、包進 `@scope (#app[data-codewalk-theme='<value>']) { ... }`,輸出成 `dist/hljs-themes.css`;`auto` 額外依 `.vscode-dark`/`.vscode-light`(含 high-contrast 併入對應深淺)包兩份
- `ui/render.ts` 的 snippet 程式碼容器加上 `hljs` class,對應官方 CSS 的 `.hljs { background; color }` 規則
- `@scope` 的 scope-start 選擇器(`#app[data-codewalk-theme='...']`)天生比原本 `.vscode-dark .codewalk-snippet-code .hljs-keyword` 這類三層 class 選擇器 specificity 更高(id + attribute),不需要 `!important`,原本「配合 body class 動態切換」拿來否決官方 CSS 的理由不再成立
- 原本 `ui/theme.css` 裡 ~150 行手寫色票整段刪除,改由建置流程產生,`highlight.js` 版本更新時色票也會自動跟著更新

**2026-08-01 修訂之修訂**:上一版修訂誤判 `dracula`/`material-palenight` 沒有 highlight.js 官方版本,因而改名為 `rose-pine-moon`/`tokyo-night-dark` 頂替——實際上兩者都在 `styles/base16/` 子目錄下(`base16/dracula.css`、`base16/material-palenight.css`),只是先前只查了 `styles/` 外層、漏看子目錄。修正後 `dracula`/`material-palenight` 改回對應各自的官方 base16 檔案;`rose-pine-moon`/`tokyo-night-dark` 本身也是合法的官方主題,使用者選擇保留當作額外選項,`codewalk.snippetTheme` 最終共 10 個值(`auto` + 9 個具名主題)。

## Risks / Trade-offs

- **[Risk]** 手動註冊的語言子集覆蓋不到撰寫者引用的所有語言(如 Ruby、Java)→ **Mitigation**:未註冊語言 fallback 為無高亮純文字顯示,不影響「跳轉到編輯器看真實內容」這個核心路徑,只是預覽少了顏色
- **[Risk]** `highlight.js/lib/core` + 多語言註冊仍會增加 `webview.js` bundle size → **Mitigation**:只註冊實際常用的十來種語言(非 `common` 全量),且此為一次性 bundle size 增加,不影響執行期效能
- **[Risk]** 每次切換 step 都即時讀檔(snippet 內容)可能在極端情況(超大檔案)有感知延遲 → **Mitigation**:只讀取當前 step 的 snippet、只切出 `startLine..endLine` 行,不預讀整份 walk,檔案 I/O 本身是本機磁碟操作,風險低
- **[Risk]** `reference.url` 的 http/https 檢查比現有 schema 驗證風格更嚴格,可能拒絕撰寫者原本能接受的寬鬆格式 → **Mitigation**:用標準 `URL` 建構子而非手寫 regex,只鎖 protocol,不額外檢查 path/query 格式,已是最寬鬆的合法性檢查

## Migration Plan

無需遷移。`items` 為新增的可選欄位(`items?`),既有 `.codewalk.json` 檔案不受影響、無需改寫;`terms` 欄位維持原樣。`shared/protocol.ts` 的訊息新增欄位(`snippetPreviews`)非破壞性——webview/host 版本本來就綁定同一次 build 產出,不存在跨版本相容問題。

## Open Questions

- 各 kind 的 icon 名稱(codicon)與 tip/todo/reference/snippet 標籤的確切色票——留給實作階段依 codicon 圖示庫挑選,不影響本設計的資料流與分層
- highlight.js 手動註冊的語言子集清單是否需要涵蓋更多語言——先以專案目前常見語言起手,回頭條件:有撰寫者反映常用語言未被覆蓋
