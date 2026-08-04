# tasks — 導讀失準偵測與重生引導

**建議開發方式**(元件類型 → 執行方式):

| 元件類型 | 涉及路徑 | 執行方式 |
|---|---|---|
| 協定與 schema | `shared/schema.ts`、`shared/protocol.ts` | `tdd` skill(純函式、Vitest 可完整覆蓋) |
| extension host | `src/anchorCheck.ts`、`src/snippetPreview.ts`、`src/fileJump.ts`、`src/viewProvider.ts` | `tdd` skill;涉及 vscode API 的成功路徑比照 `src/fileJump.ts` 既有作法走手動驗證 checklist |
| webview UI | `ui/render.ts`、`ui/theme.css` | 直接實作 + Extension Development Host 目視驗證 |
| 產生器 | `.claude/skills/explain-change/`、harness 母本 | 直接實作,產出後人工驗收文案 |

標記:**AFK** = agent 可獨立完成;**HITL** = 需人工介入。

## 1. 格式合約(`.codewalk.json` 對外欄位)

- [x] 1.1 **AFK** 在 `shared/schema.ts` 為 `CodewalkStep` 與 `kind: 'snippet'` 加入可選 `anchor: string`,並實作驗證(型別檢查、去空白後為空視同未提供),使 `stale-step-detection` 的「省略 anchor 仍為合法格式」「anchor 型別不合法」「anchor 內容僅有空白」三個 scenario 可通過
- [x] 1.2 **AFK** 在 `shared/schema.ts` 為 `CodewalkFile` 加入頂層可選 `regenerateHint: string`(非空字串、允許多行)及其驗證,使「regenerateHint 格式不合法」scenario 可通過

## 2. 錨驗證與失準呈現(端到端切片)

- [x] 2.1 **AFK** 新增 `src/anchorCheck.ts`,實作四態判定(未錨定／相符／位移／失準)含判定順序、CRLF 正規化、不 trim,使「載入時的錨驗證與失準判定」的五個 scenario 可通過
- [x] 2.2 **AFK** 在 `shared/protocol.ts` 定義 `anchorReport`(含 `anyStale`、`staleCount`、逐 step 與逐 item 狀態)並掛上 `walkLoaded`;`src/viewProvider.ts` 於載入時對全份執行驗證並送出,`stepChanged` 不重驗
- [x] 2.3 **AFK** 擴充 `SnippetPreviewResult` 的 `source: 'current' | 'anchor'`,`src/snippetPreview.ts` 於失準時改送 `anchor` 內容,使「失準時不顯示現行檔案內容」scenario 可通過
- [x] 2.4 **AFK** `ui/render.ts` 渲染失準標記(重用 `.codewalk-warning` 與 `icon('warning')`)與 `anchor` 原文區塊(重用 `.codewalk-snippet` 系列,新增 `.codewalk-snippet--stale` 修飾子),明確標示為產出當時版本,使「失準 step 顯示產出當時的程式碼」scenario 可通過
- [x] 2.5 **AFK** 確認失準不阻擋導覽與 quiz 作答,使「失準不阻擋導覽與作答」scenario 可通過(nextStep/prevStep/quiz 流程未讀取 anchorReport,無新增阻擋路徑)

## 3. 位移跟隨

- [x] 3.1 **AFK** 讓程式碼預覽與面板行號顯示(`codewalk-snippet-file-ref`)在判定為位移時採用新行號、且不顯示任何調整標記,使「上游插入程式碼造成整段下移」「位移的 snippet 以新行號預覽」scenario 可通過
- [x] 3.2 **AFK** 讓 step 與 snippet 的跳轉在判定為位移時以新行號範圍捲動並高亮,使「位移後點擊 snippet 跳轉」「位移的 step 以新行號跳轉」scenario 可通過

## 4. 失準時的跳轉與開檔

- [x] 4.1 **AFK** 為 `src/fileJump.ts` 加入「只開檔、不設 selection、不 revealRange」模式,並讓失準的 step 走此模式,使「失準的 step 不落在錯誤位置」scenario 可通過
- [x] 4.2 **AFK** 在 `ui/render.ts` 為失準目標加上「開啟現行檔案」動作(比照 `.codewalk-snippet-header` 按鈕慣例)。實作時發現不需要新的 webview→host 訊息:重用既有的 `jumpToSnippet`(snippet 項目)與 `jumpToStep`(主 step)訊息即可——host 端已依錨驗證狀態決定跳轉模式,新訊息只會是重複的路徑。使「開啟現行檔案不落在錯誤位置」scenario 可通過
- [x] 4.3 **AFK** 目標檔案不存在時改顯示「找不到檔案」提示與 `anchor` 內容、不提供開檔動作,使「目標檔案不存在時的開啟動作」scenario 可通過

## 5. 重生引導

- [x] 5.1 **AFK** 導讀含任一失準目標時於面板顯示重生提示,使「有失準步驟時顯示重生提示」「全部相符時不顯示重生提示」scenario 可通過
- [x] 5.2 **AFK** 提供 `regenerateHint` 時額外顯示「複製重生指令」動作,經 `shared/protocol.ts` 新增訊息由 host 以 `vscode.env.clipboard.writeText` 原樣複製(比照 `openReference` 走 host 的既有作法),使「複製重生指令」「未提供 regenerateHint」scenario 可通過

## 6. 向後相容

- [x] 6.1 **AFK** 確認完全無錨的導讀沿用既有 `refDrifted` 警告、預覽與跳轉行為完全不變,且部分錨定的導讀只對具備 `anchor` 的目標判定,使「舊版導讀行為不變」「部分錨定的導讀」與 `walk-player` 的「HEAD 與 ref 不符且導讀不含 anchor」「HEAD 與 ref 不符但導讀含 anchor」「HEAD 與 ref 不符但程式碼實際未變動」scenario 可通過

## 7. 產生器(與本變更同批交付)

- [x] 7.1 **AFK** 修改 `.claude/skills/explain-change/`,產出導讀時為每個 step 與 `kind: 'snippet'` 寫入 `anchor`(引用範圍的逐字原文,不含 `kind: 'diff'`),並寫入 `regenerateHint`。**範圍擴大**(經使用者確認):實作時發現這份 SKILL.md 的「IDE tour 版」段落還停留在產出 CodeTour `.tour` 格式,從未跟上 CodeWalk 的既有落差,已一併改寫成產出 `.codewalk.json`(段落更名「CodeWalk 版」),否則 anchor/regenerateHint 無處可加
- [x] 7.2 **HITL** 以修改後的產生器重新產出一份實際導讀,確認錨內容與 `startLine`/`endLine` 完全對齊、檔案體積在預期範圍(參考:21 步約 +50%)。實際產出 `.codewalk/2026-08-04-explain-add-stale-step-detection.codewalk.json`(11 步、涵蓋本次變更自身的程式碼),`anchor` 對齊已由 `buildAnchorReport` 斷言 `anyStale: false` 驗證,包含 Prettier 重排版後的重新驗證
- [x] 7.3 **HITL** 將 7.1 的修改同步回 harness 母本 repo(跨 repo 操作,需人工執行與 commit)

## 8. 文件

- [x] 8.1 **AFK** 於 `docs/glossary.md` 新增「錨(anchor)」「失準(stale)」「位移跟隨」,並與既有「漂移(drift)」明確區分
- [x] 8.2 **HITL** 於 `openspec/decisions.md` 補記「導讀檔自此含程式碼片段,分享前比照原始碼判斷」作為免問前提。同時補記格式化紀律一條(Prettier + format-on-save,理由見下方 Prettier 說明)

## 9. 驗證

- [x] 9.1 **HITL** 驗證通過:`pnpm test` 全綠(210/210),並於 Extension Development Host 完成手動驗證 checklist——(a) 無錨舊導讀行為與變更前一致;(b) 帶錨導讀在程式碼未動時無任何警告;(c) 手動於檔案上方插入數行後重載,該步以新行號正確跳轉且無失準標記;(d) 手動改寫某段程式碼後重載,該步顯示失準標記與產出當時的原文、跳轉只開檔不選行;(e) 刪除某引用檔案後重載,顯示找不到檔案且不提供開檔動作;(f) 重生提示出現、複製重生指令內容正確。使用者確認 (a)–(f) 全數通過。過程中額外發現並修正兩個既有小 bug(不在原始 scope,已記錄):`.codewalk-narration` 等文字欄位缺少 `white-space: pre-line` 導致多段落與清單擠成一段;專案未設定 Prettier 導致 format-on-save 與程式碼實際排版不一致、干擾錨定驗證測試,已補上 `.prettierrc.json` 並全專案格式化
