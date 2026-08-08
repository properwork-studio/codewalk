# 介面語言雙語化

## Why

英文使用者從 Marketplace 裝上 CodeWalk 後,看到的是滿版中文的側邊面板——按鈕、提示、錯誤訊息無一例外。他不知道「返回列表」是什麼、不知道紅色的「複製重生指令」該不該按,最可能的反應是解除安裝,順手留一則負評。

這件事的時機是單向的:extension 識別碼與評分一旦發布就永久累積,補了英文介面也不會讓舊評分消失。而目前 GitHub repo 還沒推、Marketplace 還沒上架、使用者數是 0——**現在改零對外成本,發布後改就是拿最早一批使用者(通常也是最會留評的那批)去換**。

同時,繁中讀者是這個產品既有的使用情境(workshop、台灣團隊接手 codebase),不能為了英文使用者把介面單向改成英文。因此做雙語,不做英文單語。

## What Changes

- 新增 `shared/i18n.ts`:一份翻譯表、一個 `t()`,**extension host 與 webview 共用**。不引入任何第三方 i18n 套件
- locale 由 `vscode.env.language` 判定:**`zh-*` → 繁體中文,其餘一律英文**。未知語言(`ja`、`de`…)落英文
- webview 取得 locale 的路徑:`viewProvider.getHtml()` 把判定結果寫進 `<html lang>`,webview 開機時讀 `document.documentElement.lang`。**不新增任何 postMessage 欄位**——`shared/protocol.ts` 完全不動
  - 順帶修正:`src/viewProvider.ts:316` 目前把 `lang` 寫死為 `zh-Hant`,英文介面下這對螢幕閱讀器是錯的
- `package.json` 的 `displayName`、`description` 與 4 個 command title 改走 VS Code 的 nls 機制(`%key%` + `package.nls.json` + `package.nls.zh-tw.json`)。此機制強制**預設值必須是英文**,繁中靠覆蓋檔提供
- `ui/` 的 45 條與 `src/` 的 6 條面向使用者字串抽成翻譯 key
- `shared/schema.ts` 的 42 條格式驗證錯誤**直接改寫為英文,不進翻譯表**——這些是 `.codewalk.json` 格式合約的診斷輸出,不是介面文案:它們最可能被貼進 issue、寫進 CI log、被非華語的產生器作者看到,固定英文比隨介面語言浮動更有用
- 「作答時間的相對顯示」產出隨介面語言變化:英文介面下為 `just now` / `3 hours ago` / `yesterday` / `5 days ago`
- **本次變更是 0.1.0 首發的前置**——首發即雙語,不留到 0.2.0 補

### 連帶修訂(非程式碼)

- `README.md` 開頭那句「介面語言:繁中」的英文提示會過期,需改寫
- `openspec/decisions.md` 「介面語言:繁中優先,英文版後補」該條需以本次結論取代
- 既有 spec 的 scenario 大量以中文引號指涉 UI 元素(「返回列表」「找不到檔案」)。需在 `decisions.md` 立一條書寫慣例:**引號內文案指涉繁中介面的對應元素,英文介面為其譯文**。此慣例不寫進任何 spec——spec 是行為合約,不規範自身的書寫方式

## Capabilities

### New Capabilities

- `interface-localization`: 介面語言隨 VS Code 顯示語言切換的完整行為——locale 判定規則與 fallback、繁中與英文兩份文案的涵蓋範圍、manifest 文案的雙語提供、以及格式驗證錯誤固定英文(不隨介面語言變動)這條例外

### Modified Capabilities

- `walk-player`: 「作答時間的相對顯示」requirement。該條是全部 spec 中唯一把**顯示字串本身**寫進 requirement 正文的規範(「剛剛」「N 分鐘前」「昨天」「N 天前」),7 個 scenario 的 THEN 皆為字面斷言。requirement 正文與全部 scenario 需重寫為語言中立的描述,並補上英文介面的對應行為

**已確認不受影響**(掃過全部 5 份 spec):

- `stale-step-detection`、`reading-progress`、`markdown-rendering`、`syntax-highlighting` 皆不需 delta。這些 spec 的中文引號都是**指涉元素**而非規範字串,requirement 的行為不因介面語言改變
- 驗證錯誤改英文不牴觸既有 spec:`walk-player` 與 `stale-step-detection` 對錯誤訊息的斷言是「必須指出哪一題 / 哪個 step 的位置」這類**資訊內容**要求,與語言無關
- `package.json` 的 manifest 文案不在任何 spec 的合約範圍內

## Impact

**新增**

- `shared/i18n.ts`(翻譯表與 `t()`)
- `package.nls.json`(英文,預設)、`package.nls.zh-tw.json`(繁中覆蓋)

**修改**

| 檔案 | 內容 |
|---|---|
| `ui/`(含 `render/` 四個畫面模組) | 45 條字串抽 key |
| `src/`(`viewProvider`、`fileJump`、`snippetPreview`) | 4 條文案抽 key、經 `t()`,host 側翻好再傳字串 |
| `src/walkLoader.ts`、`src/themeParsing.ts` | 各 1 條——分別是 JSON 解析失敗訊息與被靜默 catch 的內部診斷,實作時判定與 `shared/schema.ts` 的格式驗證錯誤同屬「診斷輸出」而非「介面文案」,改為固定英文字面、不經 `t()`(見 design.md 決策 7 的延伸適用) |
| `src/viewProvider.ts` | `getHtml()` 注入 locale 到 `<html lang>` |
| `shared/schema.ts` | 42 條驗證錯誤改寫為英文 |
| `ui/relativeTime.ts` | 六個時間級距的產出改為隨介面語言 |
| `package.json` | contributes 的文案改為 `%key%` 引用 |

**不受影響**

- `shared/protocol.ts`——訊息型別零變更
- `.codewalk.json` 格式與 `shared/schema.ts` 的**型別定義**——導讀內容本身不是介面文案,格式合約不動,**非破壞性變更**

**測試**

- 現有 28 個測試斷言直接比對中文字串,需一併處理(作法見 Open Questions)
- 兩份翻譯表都會打進 `dist/webview.js`。以 51 條字串估算約數 KB,相對現有 2.6 MB bundle 無感知影響

## Out of Scope

- **`.codewalk.json` 的導讀內容不翻譯**——`narration`、`title`、`term`、quiz 題目與選項皆為導讀作者撰寫的資料,語言由作者決定,不隨介面語言變動。這個區別是本次變更的核心邊界
- **簡體中文不做**——`zh-cn` 使用者拿到繁中介面。日後真要加只是多一份表加改一行判定
- **程式碼註解與 JSDoc 維持繁體中文**——依 `CLAUDE.md`,那是給開發者看的,不是介面文案
- **`docs/`、`CHANGELOG.md`、`openspec/` 不英文化**——README 只改那句會過期的語言提示,不整份英文化
- **不做語言手動切換設定**——介面語言一律跟隨 VS Code 顯示語言,不新增 extension 自己的語言設定項

## Non-goals

- 不追求「支援多語系」這個能力本身。本次只交付繁中與英文兩種,架構上不為了未來的第 N 種語言預先抽象(rule of three 未達)
- 不引入翻譯平台、翻譯檔匯出匯入流程或任何自動化翻譯工具鏈
- 不處理文字方向(RTL)、複數形變化、日期在地化格式這類完整 i18n 議題——繁中與英文都不需要

## Open Questions

1. **28 個測試斷言目前直接比對中文字串**,i18n 後要如何處理?兩個方向:(a) 測試環境固定 locale 為繁中,斷言原封不動;(b) 斷言改為比對翻譯 key。**取決於 `t()` 的最終簽名**,留到 design 階段定
2. **翻譯 key 的命名規則**——命名空間式(`walking.nextStep`)或扁平式?design 階段定
3. **51 條英文文案的品質把關方式**——是否需人工逐條審閱,或先產出後隨使用回饋修正?
4. **超過 30 天的絕對日期格式**(`YYYY-MM-DD`)與 hover 的完整時間,英文介面下是否維持 ISO?傾向維持——ISO 是格式而非語言,且沒有 `MM/DD` 與 `DD/MM` 的歧義風險。待 specs 階段確認後寫入 `walk-player` 的 delta
