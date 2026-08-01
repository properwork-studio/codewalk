## Why

`/explain-change` 產生導讀時,有時本次改動不只是新增檔案,還修改了既有程式碼或實作。目前 `CodewalkStep.items` 的五種說明元件(tip/pitfall/todo/reference/snippet)都只能呈現「現在長怎樣」的單一版本內容,無法表達「改了什麼、原本是什麼樣子」。讀者要理解一次改動,往往有一半時間是在看這次動了哪裡,而不是看整個 codebase 的現況——需要一種類似 Git Diff 的視覺元件,直接在導讀步驟裡呈現改動前後的加減行對照。

## What Changes

- 為 `CodewalkStep.items` 新增第 6 種說明元件 `diff`(discriminated union 成員),欄位:`{ kind: 'diff'; label: string; file: string; startLine: number; endLine: number; diffText: string }`
- `diffText` 只存 diff 的 hunk 本體(不含 `diff --git`/`---`/`+++`/`@@ @@` 等檔頭行),逐行依開頭字元(`+`/`-`/空白)區分新增/刪除/context
- `startLine`/`endLine` 代表**新版(現在檔案)**的行號範圍,供點擊跳轉編輯器使用,與 `snippet` 語意一致;純刪除 hunk 時兩者相同,指向刪除發生處在新版檔案中的插入點
- validator 新增規則:`diffText` 至少要有一行加/減行,否則拒絕載入(避免退化成純 context、語意上該用 `snippet` 表達的情況)
- 渲染時逐行依開頭字元疊加紅/綠背景色,並重用既有 highlight.js 語法高亮邏輯(去除開頭字元後的內容),共用 `codewalk.snippetTheme` 設定
- 點擊行為比照 `snippet`:重用既有 `jumpToLocation` 機制跳轉編輯器,不記錄額外狀態、不新增 postMessage 協定訊息
- `docs/glossary.md` 已於需求訪談階段新增 `diff` 定義(先行沉澱,非本 change 產出)

## Capabilities

### New Capabilities

(無)

### Modified Capabilities

- `walk-player`:`CodewalkStep.items` 的 schema 新增 `diff` kind,渲染邏輯需支援加減行背景色疊加語法高亮,互動行為(點擊跳轉)延伸既有 `jumpToLocation` 機制

## Impact

- `shared/schema.ts`:`CodewalkItem` discriminated union 新增 `diff` 成員,`validateCodewalkFile`(或對應 validator)新增 `diffText` 至少一行加減行的檢查
- `ui/render.ts`:新增 `diff` item 的渲染邏輯(逐行背景色 + highlight.js 疊圖),與既有 `snippet` 渲染共用語法高亮與主題設定
- `ui/theme.css`(或既有 CSS 檔):新增加/減行背景色的樣式規則,需適配深/淺色主題
- 不影響 `shared/protocol.ts`(沿用既有 `jumpToLocation` 訊息,無新協定)
- 不影響既有 `.codewalk.json` 檔案的相容性(新欄位為新增 discriminated union 成員,省略 `diff` kind 的舊檔案行為不變)
