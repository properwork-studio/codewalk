## Why

目前 `.codewalk.json` 的 `CodewalkStep` 只支援 `narration`(主敘述)與 `terms?`(可收合術語卡)兩種內容,導讀撰寫者無法在主線敘述之外附加「提示」「陷阱警告」「待確認標記」「外部連結」「額外程式碼引用」等補充資訊——這些內容目前只能硬塞進 `narration`,導致主線敘述與補充資訊混雜、讀者無法分辨重要程度。透過 grill-me 訪談壓實需求後,決定新增統一的 `items` 欄位承載這五種說明元件。

## What Changes

- **BREAKING**:`shared/schema.ts` 的 `CodewalkStep` 新增 `items?: CodewalkItem[]` 欄位,`CodewalkItem` 為 discriminated union(以 `kind` 區分),共 5 種:
  - `{ kind: 'tip'; text: string }`
  - `{ kind: 'pitfall'; misconception: string; reality: string }`
  - `{ kind: 'todo'; text: string }`
  - `{ kind: 'reference'; label: string; url: string }`(`url` 需通過 http/https 合法格式驗證)
  - `{ kind: 'snippet'; label: string; file: string; startLine: number; endLine: number }`
- `items` 陣列順序即畫面顯示順序,撰寫者可自由交錯排列五種 kind
- 既有 `terms?: CodewalkTerm[]` 維持獨立不動,不併入 `items`,不影響既有 `.codewalk.json` 檔案
- `ui/render.ts` 新增三種視覺元件:
  - annotation 橫幅(tip/pitfall/todo 共用渲染框架,依 kind 切換 icon/色調;pitfall 視覺語言與既有 `codewalk-warning` 系統警告刻意區隔)
  - reference 連結(點擊以 `vscode.env.openExternal` 開啟外部瀏覽器)
  - snippet 卡片(隨 step 載入預設展開、由 extension host 讀取 `file:startLine-endLine` 內容並用 highlight.js 高亮預覽;點擊重用既有 `jumpToLocation` 命令跳轉編輯器,找不到檔案時重用既有 jumpError 提示)
- extension host 新增讀取 snippet 程式碼內容的邏輯,隨 step payload 一併送到 webview(protocol 新增欄位,非新命令)

## Capabilities

### New Capabilities
(無)

### Modified Capabilities
- `walk-player`:新增「說明元件」相關 Requirements——annotation(tip/pitfall/todo)顯示、reference 外部連結開啟、snippet 預覽與跳轉,以及對應的 schema 驗證規則

## Impact

- `shared/schema.ts`:新增 `CodewalkItem` 型別與 `validateItem` 系列驗證邏輯
- `shared/protocol.ts`:step payload 需附帶 snippet 已讀取的程式碼內容(供 webview 預覽,不需 webview 另外請求)
- `ui/render.ts`:新增 annotation/reference/snippet 三種渲染函式與對應 CSS class
- `src/`(extension host):新增讀取 snippet `file:startLine-endLine` 內容的邏輯;`jumpToLocation` 命令重用不需修改
- webview 依賴新增 highlight.js(需評估 bundle size 對 esbuild 打包的影響)
- `docs/glossary.md`:已於 grill-me 階段新增 `items`/`CodewalkItem` 與五種 kind 的定義

## Open Questions

- 各 kind 的確切 icon 名稱與色票(codicon 選型)——留待 design.md 階段由實作者決定,不影響 schema/spec 層決策
- highlight.js 深/淺色兩顆 theme 的具體選型——同上,留待 design.md
