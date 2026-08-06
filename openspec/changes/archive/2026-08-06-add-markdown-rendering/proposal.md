## Why

導讀的敘述文字目前一律以純文字呈現,讀者面對的是一段沒有結構的長文——實測 49 個 step 的 `narration` 中位數 273 字、最長 438 字,而其中最該被一眼認出的東西(`.codewalk/`、`postMessage`、`resolvePassThreshold` 這類識別字)跟中文黏成一片,沒有任何視覺區隔。CodeWalk 的敘述天生塞滿識別字,這是本產品特有的可讀性痛點,不是一般文件都有的問題。

作者已經在用 markdown 的寫法,只是沒有被渲染:最新一份導讀的 `narration` 裡已經寫著 `1.` / `2.` / `3.` 的有序清單,靠 `white-space: pre-line` 勉強顯示成純文字清單。也就是說格式需求已經自然長出來了,播放器沒跟上。

## What Changes

- 敘述欄位支援一個**封閉的 markdown 子集**,共 6 種語法:行內程式碼(`` ` ``)、粗體(`**`)、連結(`[文字](網址)`)、無序清單(`-`)、有序清單(`1.`)、單級小標(`##`)
- **欄位依語法分級**:
  - **長文欄位**吃全部 6 種——`narration`、`term.explanation`、`tip.text`、`todo.text`、`pitfall.misconception`、`pitfall.reality`、`quiz.optionExplanations[]`
  - **短欄位**只吃行內三種(程式碼、粗體、連結)——`quiz.question`、`quiz.options[]`、`item.label`、`term.term`、`walk.title`、`step.title`。清單與小標這類區塊語法在按鈕與摺疊標題裡會破壞版面,不予支援
- **認不得或不合法的語法一律原樣輸出為純文字**,永不影響整份導讀的可播放性。`#`、`###` 以下的標題、表格、圖片、引用區塊、原始 HTML、程式碼區塊(```)全部歸此類
- **內嵌連結沿用既有的外部連結路徑**:只放行 http/https,渲染為可點擊元素而非 `<a href>`,點擊後經 postMessage 交由 extension host 以外部瀏覽器開啟;非 http/https 的連結(如 `command:`、`javascript:`)不渲染,原樣輸出為純文字
- **單一換行維持斷行語意**(等同 `breaks: true`),偏離標準 CommonMark 的「單換行不分段」。現行 `.codewalk-narration` 已是 `white-space: pre-line`,49 則裡有 11 則在用換行,不能讓作者已經打下的換行失效
- `shared/schema.ts` 各敘述欄位補上 JSDoc,寫明支援語法、長文/短欄位的分級、以及原樣輸出的降級規則——這是開放格式合約的一部分,任何產生器都要讀得到
- 更新 `.claude/skills/explain-change/SKILL.md` 的輸出指引,讓產生器開始寫行內程式碼與小標
- 重生 `.codewalk/2026-08-03-codebase-tour.codewalk.json` 作為 dogfooding 驗收
- **非 BREAKING**:實測既有 6 份導讀檔的 270 則敘述字串,`*` 0 則、行首 `-` 0 則、`>` 0 則、反引號 0 則;8 處單一換行的下一行全部是清單項,markdown 本來就會正確處理,無一處會被摺疊。既有導讀檔零遷移成本

## Capabilities

### New Capabilities

- `markdown-rendering`: 敘述欄位的 markdown 子集解析與呈現——支援語法清單、長文/短欄位的分級規則、無法解析時原樣輸出為純文字的降級行為、內嵌連結的安全邊界與開啟方式、單一換行的斷行語意

### Modified Capabilities

(無)

`walk-player` 現有 21 條 requirement 中,沒有任何一條規範敘述文字「以純文字呈現」——「可收合術語註解」只說「展開顯示該術語的解釋內容」,「步驟導覽」只說「顯示第 N+1 步」。因此本次不推翻任何既有 requirement,渲染規則完整住在新 capability。兩處交界處理方式:

- **視覺跟隨編輯器主題**:該 requirement 現有文字已泛用涵蓋(「webview SHALL 讀取 VS Code 目前主題的 CSS 變數渲染介面,不使用自帶的固定配色」),新元素遵守即可,不需改動條文
- **外部連結參考**:該條專講 `kind: 'reference'` 項目;內嵌連結住在敘述字串裡,是不同觸發位置,由新 capability 自行定義並交叉引用該條的開啟行為

## Impact

- **新增** `ui/markdown.ts`:子集解析(對外合約是「輸入字串 → 結構化 token」,不是 HTML 字串——詳見 Open Questions 第 1 點)
- `ui/render.ts`:各敘述欄位改走解析後渲染;目前全檔以 `textContent` 建 DOM、零 `innerHTML`,這條紀律是否維持見 Open Questions
- `ui/theme.css`:行內程式碼、小標、清單的樣式,一律取 VS Code 主題變數
- `shared/schema.ts`:敘述欄位的 JSDoc 合約說明,以及把既有的 `isHttpUrl()` 加上 `export` 供渲染層共用(**不新增欄位、不改型別、不改驗證規則**)
- `shared/protocol.ts`:**不需改動**——內嵌連結複用既有的 `openReference` 訊息
- `src/`(extension host):**不需改動**——`vscode.env.openExternal` 與 `isHttpUrl()` 的既有路徑已足夠
- 測試:`ui/markdown.test.ts` 新增;語法子集與降級行為是純函式,適合 Vitest 覆蓋
- `.claude/skills/explain-change/SKILL.md`:產生器輸出指引
- `.codewalk/2026-08-03-codebase-tour.codewalk.json`:重生
- `README.md`、`docs/glossary.md`:格式文件同步;glossary 需新增「敘述欄位(長文欄位/短欄位)」與「降級為純文字」兩則定義
- **相依套件**:可能新增一個 markdown parser(見 Open Questions 第 2 點)。體積不是決策因素——marked 約 40 KB,對照已定案不動的 2.6 MB `dist/webview.js` 僅佔 1.5%

## 已定案決策

以下八點在提案前的需求訪談已與使用者確認,不重新討論:

1. **動機是讀者端可讀性**,不是相容既有內容——既有檔案幾乎沒有 markdown 語法,沒有相容包袱要背
2. **支援清單封閉**,而非引入完整 CommonMark——理由不是安全也不是體積(CSP `default-src 'none'` + `script-src 'nonce-…'` 已擋掉 `<script>`、inline event handler 與外部資源;體積佔比 1.5%),而是**規格表面積**:每多一種語法就要回答「表格在 340px 側邊面板怎麼排」「圖片在 CSP 下從哪載入」「blockquote 用哪個主題變數」,而這些一項都沒被需要
3. **標題只認 `##` 一級**——面板已有「導讀標題 → 步驟標題 → 內文」三層階層,鎖成一級就只剩「`##` 明顯小於 `step.title`」一個決定,不必設計六級階層與越級問題
4. **粗體維持純行內語意**,不做「整行只有粗體就升級為小標」的上下文判定——`**定位**:CodeWalk 是…` 這種粗體在行首但同行有內文的中文常見寫法會讓判定規則充滿邊界情況,作者猜不到何時變小標;要小標就明寫 `##`
5. **短欄位吃行內語法**,而非完全不吃——quiz 題目寫「下列哪個描述 `resolvePassThreshold` 的行為?」、選項本身就是識別字名,是 codebase quiz 的常態,擋掉它等於讓痛點在 quiz 上原封不動重演
6. **內嵌連結不進 `validateCodewalk`**,在渲染層降級——`validateCodewalk` 目前只花 0.005 ms(見 `openspec/decisions.md`),要它 parse 全部敘述會讓成本跳一個量級,換到的只是早一點報錯;而且一個壞連結讓整份導讀從列表消失,與 `reference.url` 壞掉的情況比例失衡(後者壞了那個 item 就完全沒意義,前者其餘 400 字仍有價值)
7. **降級為純文字是統一原則**,不是逐語法的特例——一條規則涵蓋所有失敗情況,scenario 數量不隨支援語法數線性增長
8. **本次翻案 `2026-08-01-quiz-option-explanations` 的一項決定**。該 change 的 Out of Scope 明寫「**不做**解釋內容的 markdown 或連結渲染——維持純文字,與 `narration`、`term.explanation` 的處理一致」。翻案理由:當時的立論是「與其他敘述欄位保持一致」,而本次正是把所有敘述欄位一起改,一致性不但沒被破壞,反而是本 change 的核心約束。該決定是 change 層級的範圍宣告,不是 spec requirement,翻案不影響任何已封存的行為合約

## Out of Scope / Non-goals

- **不支援**表格、圖片、引用區塊、原始 HTML、程式碼區塊(```)、`#` 與 `###` 以下的標題,以及上述 6 種以外的一切 CommonMark 語法
- **不做**行內程式碼的語法高亮——單一識別字判斷不出語言,接 Shiki 只會猜錯
- **不重生**既有另外 5 份導讀檔——`openspec/decisions.md` 的衍生快照紀律是「不維護、過期即刪」,回頭重寫舊導讀直接違背它,而且沒有讀者在等這些舊檔
- **不新增**任何 `.codewalk.json` 欄位、不改型別、不改 validator——本 change 只改「既有字串怎麼呈現」
- **不動** extension host(`src/`)與 postMessage 協定
- **不做**產生按鈕相關的任何事(MVP 期紀律)

## Open Questions

1. **DOM 建構方式(架構決策,design 階段須定案)**——`ui/render.ts:184` 立有明確紀律:「用 `textContent`(非 `innerHTML`)逐一附加 token,不需要跳脫 HTML」,全檔零 `innerHTML`。而 markdown parser 慣例輸出 HTML 字串。要走「parser 只吐 token、由渲染層手動建 DOM」以守住紀律,還是接受受控的 `innerHTML`?建議 design 階段用 architecture-advisor 處理
2. **parser 選型**——自寫封閉子集 parser(語法只有 6 種,可控但要自己處理跳脫與邊界),或引 marked / markdown-it 再關掉多餘功能(成熟但要對付「關不乾淨」)。與第 1 點連動
3. **巢狀清單**——無序/有序清單裡再縮排一層支不支援?訪談未觸及
4. **行內程式碼內的反引號怎麼跳脫**——CommonMark 用多重反引號圍籬,封閉子集要不要跟進
5. **行內程式碼的主題變數**——`--vscode-textCodeBlock-background` 曾在 `2026-08-03-switch-to-shiki-highlighter` 被否決(用在 snippet 大塊上會與編輯器底色不同),但它本來就是為「小塊行內程式碼」設計的,在這裡反而可能是正確選擇
6. **`##` 的具體字級**與 `step.title` 的關係——只確定「明顯小於」,實際數值待樣式階段決定
