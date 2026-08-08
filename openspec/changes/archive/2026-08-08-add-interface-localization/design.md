## Context

CodeWalk 目前所有面向使用者的文案都是硬編碼的繁體中文字面值,散在三個層:`ui/` 45 條、`shared/schema.ts` 42 條(全部是格式驗證錯誤)、`src/` 6 條,外加 `package.json` 的 `description` 與 4 個 command title。專案沒有任何 l10n 機制。

三個既有的結構限制決定了這份設計的形狀:

1. **`ui/` 禁碰 `vscode` API**(CLAUDE.md 硬規則)。`vscode.l10n` 只存在於 extension host,而文案主體(45/93)在 webview——官方機制到不了要翻的地方
2. **`src/` 與 `ui/` 是兩份獨立 bundle**(`esbuild.js` 的 `buildExtension` 與 `buildWebview`),各自 bundle `shared/`。兩邊拿到的是同一份原始碼的**兩個模組實例**
3. **`package.json` 的 contributes 只能走 VS Code 的 nls 機制**,這是 manifest 在 extension 啟動前就要被讀取的部分,繞不過

現況細節:`src/viewProvider.ts:316` 的 `getHtml()` 把 `<html lang>` 寫死為 `zh-Hant`;`shared/protocol.ts` 有 3 個訊息型別帶 `message: string`(`loadError`、`stepJumpError`、`SnippetPreviewResult`),內容由 host 產生、webview 顯示。

## Goals / Non-Goals

**Goals:**

- 一份翻譯表、一個 `t()`,host 與 webview 共用,不因分層而寫兩套
- 漏翻在 `pnpm typecheck` 就失敗,不留到執行期才發現
- 既有 28 個比對中文字串的測試斷言**不需改寫**
- 不新增任何 postMessage 欄位——`shared/protocol.ts` 零變更

**Non-Goals:**

- 不引入第三方 i18n 套件(`i18next`、`@formatjs` 等)。51 條字串、2 種語言,套件的成本高於自寫
- 不做 ICU plural rules、不處理 RTL、不做日期在地化格式
- 不為第三種語言預先抽象。加簡中時只是多一份表加改一行判定,rule of three 未達
- 不做語言手動切換設定項——一律跟隨 VS Code

## Decisions

### 1. 翻譯表以 zh-TW 為型別來源,en 由型別反推

```ts
// shared/i18n.ts
const zhTW = {
  'fileList.title': '選擇導讀',
  'walking.stepProgress': '第 {current} / {total} 步',
  'time.minutesAgo': '{n} 分鐘前',
  // …
} as const;

export type TranslationKey = keyof typeof zhTW;

const en: Record<TranslationKey, string> = {
  'fileList.title': 'Choose a walk',
  'walking.stepProgress': 'Step {current} of {total}',
  'time.minutesAgo': '{n} minutes ago',
  // …
};
```

**為什麼 zh-TW 當來源**:它是既有文案的所在,抽 key 時直接搬。`Record<TranslationKey, string>` 讓英文表少一條就 typecheck 失敗、多一條也失敗——**漏翻是編譯錯誤而非執行期的空字串**。這是 TypeScript strict 在這裡付得出的最實際的一筆利息。

**替代方案**:兩份表都用 `as const` 再交叉比對型別。捨棄——寫法更繞,而且沒有「哪份是來源」的明確答案,新增 key 時兩邊都可能被當成參照。

### 2. `t()` 的簽名:模組層 locale + 具名參數

```ts
export type Locale = 'zh-tw' | 'en';

export function setLocale(next: Locale): void;
export function t(key: TranslationKey, params?: Record<string, string | number>): string;
```

插值以 `{name}` 佔位,`t()` 逐一替換。

**為什麼 locale 是模組層狀態而不是 `t(locale, key)` 的參數**:呼叫點有 51 處,每處都多傳一個 locale 是純噪音,而且會逼每個 render 函式的簽名都多帶一個參數往下傳。locale 在一次 webview 生命週期內是常數(切語言強制重啟視窗),不需要每次求值時協商。

**代價與處理**:模組層可變狀態對測試不友善。`setLocale()` 是 export 的,測試在 `beforeEach` 明確設定即可——這正好解掉測試策略(見決策 3)。

**兩個 bundle 兩個實例**:`src/` 與 `ui/` 各自持有一份模組狀態,**兩邊都必須各自呼叫 `setLocale()`**。這不是缺陷而是分層的必然結果,寫進註解避免日後誤判為 bug。

### 3. 測試斷言維持比對顯示字串,以 `setLocale('zh-tw')` 固定

既有 28 個斷言(`expect(...).toBe('剛剛')` 這類)**原封不動**,只在對應測試檔加 `beforeEach(() => setLocale('zh-tw'))`。

**為什麼不改成比對 key**:斷言 key 等於只驗證「有呼叫 `t()`」,對「顯示出什麼」完全失去覆蓋——一份 key 拼錯或參數沒帶到的翻譯表,測試照樣全綠。字串斷言的維護成本在本專案是可接受的(文案改動頻率低),換來的是真正的顯示行為覆蓋。

**新增測試**:英文 locale 下 `formatRelativeTime` 六個級距的產出、`resolveLocale()` 的判定規則、以及 `t()` 的參數插值。翻譯表的 key 對齊由型別保證,不需要執行期測試。

### 4. locale 判定是純函式,兩邊共用同一個

```ts
export function resolveLocale(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith('zh') ? 'zh-tw' : 'en';
}
```

住 `shared/i18n.ts`,吃字串不碰 `vscode`,因此可直接單元測試。

- **host**:`resolveLocale(vscode.env.language)`
- **webview**:`resolveLocale(document.documentElement.lang)`

`getHtml()` 寫進 `<html lang>` 的是**語意正確的 HTML 語言標籤**(`zh-Hant` / `en`),不是內部 locale 代碼。兩者不同但不需要映射表——`zh-Hant` 以 `zh` 開頭,同一個 `resolveLocale()` 直接命中。這是判定規則採「前綴比對」而非「完整字串比對」附帶換來的好處。

### 5. 初始化時機:兩邊都在最早的同步點

- **host**:`src/extension.ts` 的 `activate()` 第一行。必須早於任何 `viewProvider` 建構,因為 `getHtml()` 要用到判定結果
- **webview**:`ui/main.ts` 模組頂層、`import` 之後立刻執行。所有 `render*()` 都是事件觸發時才呼叫,模組頂層設定必定早於第一次繪製

`ui/main.ts` 目前在頂層就有 `acquireVsCodeApi()` 與 `let current = createFileListState([])`,新增一行 `setLocale(...)` 與既有寫法一致。

### 6. `package.json`:只 nls 該 nls 的

```jsonc
{
  "displayName": "CodeWalk",              // 不 nls——專有名詞,兩種語言相同
  "description": "%extension.description%",
  "contributes": {
    "commands": [{ "command": "codewalk.openWalk", "title": "%command.openWalk.title%" }]
  }
}
```

`package.nls.json`(英文,VS Code 強制的預設)與 `package.nls.zh-tw.json`(繁中覆蓋)。

**`displayName` 刻意不進 nls**:「CodeWalk」在兩種語言下完全相同,包進去只是多一組 key 與兩份維護點。

**`category` 欄位同理不動**——目前值為 `"CodeWalk"`。

### 7. `shared/schema.ts` 的 42 條驗證錯誤直接改英文字面,不經 `t()`

```ts
errors.push(`${path}.startLine must be a positive integer`);
```

理由已在 proposal:這些是 `.codewalk.json` 格式合約的診斷輸出,受眾是寫產生器或手寫 JSON 的人,會被貼進 issue、寫進 CI log。

**風險是日後有人「順手」把它接進 `t()`**。處置:在 `schema.ts` 檔頭寫一段註解說明這是刻意的例外與理由,並在 `interface-localization` spec 立成 requirement——讓它是合約而不只是慣例。

### 8. `relativeTime` 的英文單複數:只加兩條 key,不做 plural 機制

英文在這裡繞不過去:`1 minute ago` 與 `2 minutes ago`。Non-Goals 說不做 ICU plural rules,但那指的是機制,不是放任語法錯誤。

作法是在需要的三個級距各加一條單數 key:

```ts
'time.minuteAgo': '{n} 分鐘前',    // 繁中兩條內容相同
'time.minutesAgo': '{n} 分鐘前',
```

呼叫端 `n === 1 ? t('time.minuteAgo', { n }) : t('time.minutesAgo', { n })`。

**替代方案**:英文改用 `1 min ago` / `5 min ago` 這類縮寫規避單複數。捨棄——為了省兩條 key 而讓英文文案讀起來像儀表板,不划算。

**繁中兩條內容相同看似冗餘**,但這是型別對齊的必然:兩份表 key 集合必須一致。

### 9. 絕對日期維持 ISO,不隨語言

`formatAbsoluteDate`(`YYYY-MM-DD`)與 `formatAbsoluteDateTime`(`YYYY-MM-DD HH:mm`)兩個函式**完全不動**,不進翻譯表。

ISO 8601 是格式而非語言,且沒有 `MM/DD` 與 `DD/MM` 的歧義風險——這正是英文語境下唯一真正會誤讀的地方。此決策回答 proposal 的 Open Question 4。

## 新增與修改的元件

| 路徑 | 動作 | 內容 |
|---|---|---|
| `shared/i18n.ts` | 新增 | `TranslationKey`、`Locale`、`zhTW`/`en` 兩份表、`t()`、`setLocale()`、`resolveLocale()` |
| `shared/i18n.test.ts` | 新增 | 插值、`resolveLocale()` 判定規則 |
| `package.nls.json` | 新增 | 英文(預設) |
| `package.nls.zh-tw.json` | 新增 | 繁中覆蓋 |
| `package.json` | 修改 | `description` 與 4 個 command title 改為 `%key%` |
| `src/extension.ts` | 修改 | `activate()` 首行 `setLocale(resolveLocale(vscode.env.language))` |
| `src/viewProvider.ts` | 修改 | `getHtml()` 的 `<html lang>` 改為動態;3 條文案抽 key |
| `src/fileJump.ts`、`snippetPreview.ts` | 修改 | 共 3 條文案抽 key、經 `t()` |
| `src/walkLoader.ts`、`themeParsing.ts` | 修改 | 各 1 條改為固定英文字面,不經 `t()`——實作時判定與決策 7 的 schema 驗證錯誤同屬診斷輸出(`themeParsing.ts` 的訊息實際上被 `themeSource.ts` 靜默 catch,從未顯示給讀者,但仍統一固定英文以維持內部診斷訊息的一致性) |
| `ui/render/{fileList,walking,items,quiz}.ts`、`ui/main.ts`、`ui/state.ts`、`ui/highlight.ts` | 修改 | 45 條文案抽 key |
| `ui/relativeTime.ts` | 修改 | 六個級距改走 `t()`;絕對日期兩函式不動 |
| `shared/schema.ts` | 修改 | 42 條驗證錯誤改英文;檔頭補例外說明 |
| 既有 28 處測試斷言所在檔 | 修改 | 加 `beforeEach(() => setLocale('zh-tw'))` |
| `shared/protocol.ts` | **不動** | 零訊息型別變更 |

## Risks / Trade-offs

- **漏翻某條字串** → 型別保證:`Record<TranslationKey, string>` 讓英文表缺一條就 `pnpm typecheck` 失敗。**唯一躲得掉的是「忘記把某處硬編碼字串抽成 key」**,型別無法偵測。處置:實作完成後以 `grep` 掃 `ui/`、`src/` 的中文字串字面值,結果應只剩註解與 JSDoc

- **`setLocale()` 沒被呼叫或呼叫太晚** → 顯示預設的英文而非讀者語言,且不會報錯,是最容易靜默失敗的地方。處置:預設值刻意設為 `'en'`(與 `package.nls.json` 的預設一致),並在測試明確設定不依賴預設;webview 側加一個「未設定時繪製結果為英文」的測試把行為釘住

- **英文文案品質** → 51 條由 AI 產出,可能出現直譯腔或術語不一致(walk / tour / walkthrough 混用)。處置:先統一術語表(`walk` = 導讀、`step` = 步驟)再逐條寫;品質把關方式仍是 Open Question

- **兩份翻譯表都進兩個 bundle** → `dist/webview.js` 增加約數 KB。相對現有 2.6 MB(Shiki grammar 佔 92.2%)無感知影響,不需要按 locale 拆 bundle

- **文案改動的維護點從 1 處變 2 處** → 這是雙語的固有成本,無法消除。已在 grill 階段確認接受

## Migration Plan

本變更是 0.1.0 首發的前置,**沒有既有使用者、沒有版本間遷移問題、不需要 rollback 策略**。

發布順序上的硬性約束:本變更必須在 `docs/release-checklist.md` 的「建立 GitHub repo 並 push」之前完成——`package.json` 的 `description` 會出現在 Marketplace 頁面,而 extension 識別碼一旦發布永久不可改。

## Open Questions

1. **英文文案的品質把關方式**——51 條是否需人工逐條審閱,或先產出後隨使用回饋修正?此問題不阻塞實作,但影響 tasks 的驗收步驟
2. **翻譯 key 的分組粒度**——本設計採畫面前綴(`fileList.`、`walking.`、`quiz.`、`time.`),對齊 `ui/state.ts` 的四個畫面狀態與 `ui/render/` 的模組切分。`src/` 的 6 條該用什麼前綴(`host.` 或依功能)待實作時定,不影響架構
