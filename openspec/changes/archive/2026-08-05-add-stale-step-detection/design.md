## Context

現行的漂移處理只有兩個函式:`src/refDrift.ts` 的 `getWorkspaceHead()`(跑 `git rev-parse HEAD`)與 `isRefDrifted()`(字串比對),結果是 `walkLoaded` 訊息上的單一布林 `refDrifted`,由 `ui/render.ts:377` 渲染成一行 `.codewalk-warning`。整份導讀共用一個訊號,讀者無法分辨哪一步還準確。

同時 `src/snippetPreview.ts:27` 依 JSON 裡的行號從**現行檔案**切行送給 webview,漂移後貼出的是不相干但外觀正常的程式碼——這是本變更最主要要消除的錯誤。

約束:

- `shared/schema.ts` 是 `.codewalk.json` 對外格式的單一定義處,只能新增可選欄位
- `shared/protocol.ts` 是 host ⇄ webview 訊息型別的單一定義處,`ui/` 禁碰 vscode API
- MVP 期 extension 不得含任何產生邏輯
- 全份驗證已實測 0.37 ms(命中)/ 0.70 ms(最壞),不需快取

## Goals / Non-Goals

**Goals:**

- 以錨(產出當下的程式碼原文)判定每個 step 與 snippet 是否仍與現行程式碼相符
- 原文逐字相同但位置改變時,自動跟隨新行號
- 失準時顯示錨定原文而非現行檔案內容,並讓讀者能自行開啟現行檔案
- 導讀出現失準步驟時提供重生引導,extension 本身不執行產生
- 無錨導讀行為完全不變

**Non-Goals:**

- 用 `git diff` 推算行位移(proposal 已明確否決)
- 單步重生、per-step `ref`
- 修補或改寫 `.codewalk.json` 檔案內容——驗證結果只存在於執行期,不回寫
- 對 `kind: 'diff'` 項目做錨定驗證

## Decisions

### 決策 1:錨就近掛在既有物件上,不另立集中區塊

`CodewalkStep` 與 `kind: 'snippet'` 各新增可選欄位 `anchor: string`,存該行段的完整原文。

```jsonc
{
  "title": "載入導讀檔",
  "file": "src/walkLoader.ts",
  "startLine": 12,
  "endLine": 18,
  "anchor": "export async function loadCodewalkFile(path: string) {\n  const raw = await readFile(path, 'utf8');\n  ...",
  "narration": "..."
}
```

**替代方案**:頂層集中的 `anchors` 陣列,以檔案路徑加行號索引。**否決理由**:`CodewalkStep` 沒有 id,集中區塊得憑空發明索引鍵;而錨與 `file`/`startLine`/`endLine` 是同一組事實,拆開存反而讓兩處可能不同步。抽象門檻(rule of three)也未達。

`kind: 'diff'` 不加 `anchor` —— 它已有 `diffText`,且描述的舊碼注定不存在。

**驗證規則**(`validateCodewalk`):`anchor` 若存在必須是字串;**允許空白內容但去除空白後為空者視同無錨**(見決策 6 的空錨風險)。

### 決策 2:驗證邏輯獨立成 `src/anchorCheck.ts`,不併入 `refDrift.ts`

`refDrift.ts` 是 git 概念(HEAD 與 ref 的比對),錨驗證是檔案內容概念,兩者無共用邏輯。`refDrift.ts` 維持原樣不動。

新模組匯出純函式,便於 Vitest 直接測(比照 `src/fileJump.ts` 把可獨立驗證的分支抽出的既有作法):

```ts
type AnchorStatus =
  | { kind: 'unanchored' }
  | { kind: 'matched' }
  | { kind: 'shifted'; startLine: number; endLine: number }
  | { kind: 'stale'; reason: 'notFound' | 'ambiguous' | 'fileMissing' };
```

判定順序:

1. 無 `anchor`(或去空白後為空)→ `unanchored`
2. 檔案不存在 → `stale / fileMissing`(沿用 `snippetPreview.ts:22`、`fileJump.ts:21` 既有的 `existsSync` 判定)
3. 現行 `startLine`–`endLine` 的內容 === 錨 → `matched`
4. 錨在整份檔案中出現**恰好一次** → `shifted`,回傳新行號
5. 出現 0 次 → `stale / notFound`;出現 2 次以上 → `stale / ambiguous`

**換行正規化**:比對前一律把 CRLF 轉為 LF。**不做 trim**——縮排與尾隨空白的變動是真實的程式碼改動,吞掉它等於謊報相符。

### 決策 3:protocol 新增逐步狀態,保留 `refDrifted` 作為退路

`walkLoaded` 一次送出全份驗證結果(載入時全驗,見 Context 的實測數字),`stepChanged` 不重驗:

```jsonc
{
  "type": "walkLoaded",
  "walk": { "...": "..." },
  "stepIndex": 0,
  "refDrifted": true,
  "anchorReport": {
    "anyStale": true,
    "staleCount": 3,
    "steps": [
      {
        "step": { "kind": "matched" },
        "items": [{ "itemIndex": 1, "status": { "kind": "shifted", "startLine": 42, "endLine": 51 } }]
      },
      {
        "step": { "kind": "stale", "reason": "notFound" },
        "items": []
      }
    ]
  }
}
```

`refDrifted` **不移除**:整份都是 `unanchored` 時(舊導讀、或產生器尚未更新),`ui/render.ts:377` 的現行警告原樣保留。只要有任一目標有錨,面板就改用逐步呈現。

### 決策 4:失準時由 host 改送錨定原文,webview 資料來源不變

`SnippetPreviewResult` 擴充一個 `source` 欄位,而不是讓 webview 自己從 `walk` 物件裡取 `anchor`:

```ts
| { itemIndex: number; ok: true; content: string; language: string; source: 'current' | 'anchor' }
```

`readSnippetPreviews()` 依狀態決定內容:`matched`/`shifted`/`unanchored` → 讀現行檔案(`shifted` 用新行號);`stale` → 直接回傳錨的內容並標 `source: 'anchor'`。

**替代方案**:webview 自行從已收到的 `walk` 取 `anchor`,省一份 payload。**否決理由**:會讓 snippet 內容變成兩個來源、兩條路徑,而目前「host 讀檔、webview 純渲染」的分工是既有慣例;省下的幾 KB 不值得換掉分層清晰度。

`kind: 'step'` 本身沒有預覽 UI,失準時在 narration 上方插入一個原文區塊,重用 `.codewalk-snippet` 系列樣式。

### 決策 5:位移成功不對讀者標示

`shifted` 時 snippet header 的檔案位置文字(`ui/render.ts:221` 的 `codewalk-snippet-file-ref`)顯示**更新後**的行號,不加任何「已調整」標記。

理由:只有內容逐字相同才會判 `shifted`,讀者看到的程式碼與作者當初寫敘述時看到的完全一致,沒有需要揭露的落差。加標記反而在面板上製造無效噪音。這解掉 proposal 的 Open Question 3。

### 決策 6:跳轉在失準時退化為只開檔

`jumpToStep()` 新增可選的「不選取」模式。`stale` 的 step 或 snippet:開啟文件、不設 `editor.selection`、不 `revealRange`。**不使用 JSON 裡的原行號**——那是已知錯誤的位置,把游標放上去等於假裝知道。

`shifted` 則用新行號正常跳轉並選取。

### 決策 7:重生指令由產生器自述,複製動作走 host

`CodewalkFile` 頂層新增可選欄位:

```jsonc
{ "title": "...", "ref": "...", "regenerateHint": "在專案根目錄執行 /explain-change,主題:walk-player 導覽", "steps": [] }
```

允許多行、不限長度,驗證僅要求「若存在則為非空字串」。播放器對其內容零解讀,只顯示與複製——`decisions.md`「播放器與產生器分離」的具體落實,也讓第三方產生器能接。這解掉 proposal 的 Open Question 5。

複製動作比照 `openReference` 的既有作法走 host(`WebviewToHostMessage` 新增 `copyRegenerateHint`,host 呼叫 `vscode.env.clipboard.writeText`),不在 webview 內用 `navigator.clipboard`——webview 有 CSP,且剪貼簿權限在 host 端行為較可預期。

無 `regenerateHint` 的導讀:只顯示文字提示,不顯示按鈕。

### 決策 8:UI 沿用既有系統層級警告樣式

- **失準標記與重生引導**:重用 `.codewalk-warning`(`ui/theme.css:110`,色彩 token `--vscode-editorWarning-foreground`)與 `icon('warning')`(`ui/render.ts:21`)。失準確實是系統層級訊息,`theme.css:810` 的既有註解已載明 `pitfall` 等內容型提示刻意不共用此樣式,本變更遵循同一區隔
- **錨定原文區塊**:重用 `.codewalk-snippet` / `-header` / `-code` / `-line-number` 系列,另加修飾子 `.codewalk-snippet--stale` 表達失準狀態
- **「開啟現行檔案」動作**:比照 `.codewalk-snippet-header` 的按鈕慣例

## Risks / Trade-offs

- **短或高度重複的錨容易 `ambiguous`**(例如只錨了一行 `}`)→ 判為失準,方向是保守的:寧可要求讀者自行確認,也不會指向錯的位置。若實際使用中誤判過多,再回頭考慮以前後文擴展錨範圍
- **空白或近乎空白的錨**(空行、純縮排)→ 幾乎必然 `ambiguous`,製造假失準。決策 1 的驗證規則已把「去空白後為空」歸為無錨擋掉
- **換行與編碼差異**→ 已正規化 CRLF;檔案編碼非 UTF-8 時沿用現行 `readFileSync(..., 'utf8')` 的既有限制,不在本變更擴大處理
- **JSON 體積 +50%**(實測該份導讀 50.5 KB → 約 76 KB)→ 對照 `decisions.md` 已記錄的載入實測不構成效能問題;代價是導讀進版控後 `git diff` 會同時出現敘述與程式碼兩種變動
- **產生器未同步更新則本功能等於未啟用**(全部 `unanchored`,退回現況)→ 產生器修改必須與本變更同批交付,列入 tasks
- **導讀檔自此含程式碼片段**→ 同 repo 內零額外暴露(git 無檔案層級權限),`diffText` 已存在同類內容;僅在人為單獨分享導讀時需比照原始碼判斷,本階段不設計機制

## Migration Plan

- `.codewalk.json` 只新增可選欄位,**無需遷移腳本**;既有 5 份導讀在新版下全部判為 `unanchored`,行為與現在完全一致
- 產生器(`.claude/skills/explain-change/` 與 harness 母本)更新後,重生的導讀自動獲得錨
- 回退:移除新欄位即回到現行行為,無資料相容性負擔

## Open Questions

- **重生引導的觸發門檻**:任一步失準即顯示,或需達一定比例?本設計採「任一步即顯示」(門檻是憑空發明的規則),但尚未實際走讀過失準導讀,`specs` 階段若有更好判準可調整。此為 proposal Open Question 2,其餘四點已於本文件決策 1、5、7 與 specs 分工中定案。
