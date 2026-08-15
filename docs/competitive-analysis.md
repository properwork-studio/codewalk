# CodeWalk 競品分析

> 調查日期:2026-08-09(同日補查 DeepWiki 私有 repo 支援,結論見 D 組)|方法:VS Code Marketplace 查詢 API + 下載 14 份 VSIX 拆包檢視實作
>
> 目的:驗證「AI 原生的導讀閱讀器」這個差異化假設是否已被佔位,並決定 `docs/future-work.md` 的排序是否需要修正。

---

## 一句話結論

**這個品類是一座墓園,旁邊剛冒出一片新生兒。** 需求被驗證過(CodeTour 46 萬安裝),但所有中量體的產品都已停滯或轉向;2026 年新出現的全是個位數安裝的 AI 版本,而它們證明了三件我原本以為還沒人做的事 —— **agent 橋接已經有三種成熟做法,而我原本提議的剪貼簿方案是其中最弱的一種。**

唯一確認沒有人做的,是 **quiz**。

---

## 一、全景:誰還活著

依安裝數排序,更新日期是關鍵欄位。

| 對象 | 安裝 | 評分 | 最後更新 | 狀態 |
|---|---:|---:|---|---|
| CodeTour `vsls-contrib.codetour` | 461,818 | 5.0 (21) | 2025-08-07 | ⚠️ **一年未更新** |
| New Relic CodeStream | 400,360 | 4.02 (88) | 2025-10-30 | ❌ **已轉向 telemetry** |
| CodeViz | 86,506 | 4.0 (14) | 2025-12-04 | ✅ 活躍(YC 投資) |
| Stepsize | 28,630 | 4.61 (36) | 2024-04-19 | ❌ 停滯兩年 |
| Code Review `d-koppenhagen` | 26,600 | 4.33 (6) | 2026-06-07 | ✅ 活躍 |
| Swimm | 20,054 | 5.0 (5) | 2026-05-25 | ⚠️ **已轉向 mainframe** |
| Code Annotation `tkcandrade` | 11,405 | 4.86 (7) | 2023-07-08 | ❌ 停滯三年 |
| CodeSee Review Maps | 11,240 | **1.0 (2)** | 2023-02-22 | ❌ 已死 |
| Tour de Code AI | 244 | — | 2026-01-13 | ✅ 新(CodeTour fork) |
| Code Review for Claude Code | 20 | — | 2026-03-29 | ✅ 新 |
| CodeWalk AI | 19 | 5.0 (2) | 2026-05-21 | ✅ 新 |
| CodeTour Watcher | 9 | — | 2021-02-19 | ❌ 已死 |
| CodeWalker `Taogya` | 4 | — | 2026-05-10 | ✅ 新 |
| Onboarding Handoff | 2 | — | 2026-06-06 | ✅ 新 |
| **CodeWalk Reader(我們)** | **4** | — | **2026-08-09** | ✅ 剛上架 |

### 從這張表讀出三件事

**1. 需求是真的,商業模式不是。** CodeTour 46 萬安裝、5.0 分、21 則評價 —— 使用者要這個東西。但它一年沒更新;做到 40 萬安裝的 CodeStream 把 code discussion 整個拿掉換成 New Relic telemetry;Swimm 拿了創投的錢,最後往上游跑去做 COBOL/PL/I/CICS 的 mainframe 現代化;CodeSee 掛了,兩則評價給 1 分。

**這個品類留不住人。** 導讀是「寫的人痛、讀的人爽」的東西,寫的動機不足,工具再好都推不動。這是我們要正面回答的問題,不是可以繞過的問題。

**2. 2026 年這一批全部是 AI 驅動的。** Tour de Code AI(1 月)、Code Review for Claude Code(3 月)、CodeWalk AI(5 月)、Taogya CodeWalker(5 月)、Handoff(6 月)、我們(8 月)。**同一個時間窗、同一個判斷:agent 出現後這件事值得重做一次。** 這個判斷我們不孤單,但也不獨特。

**3. 名字撞得很厲害。** `codewalk-ai`、`taogya-codewalker`、我們的 `codewalk-reader` 全在 2026 年出現,搜尋「codewalk」三個都在第一頁。安裝數 19 / 4 / 4,誰都還沒贏。

---

## 二、七個問題的橫向答案

### Q1. 格式與可攜性

| 對象 | 格式 | 可 commit | 開放合約 |
|---|---|---|---|
| CodeTour | `.tour` JSON + JSON Schema | ✅ | ✅ 有正式 schema |
| Tour de Code AI | `.tour`(**沿用 CodeTour**) | ✅ | ✅ 繼承 |
| Taogya CodeWalker | `.code-walker/walks-{manual,auto}/` | ✅ | ⚠️ 未文件化 |
| Handoff | `.handoff/output/index.json` + 每節一份 md | ✅ | ⚠️ 綁自家產生器 |
| Swimm | `.sw.md`(markdown 變體)+ `.swm/swimm.json` | ✅ | ⚠️ 綁自家平台 |
| CodeWalk AI | 無持久格式(即時生成) | ❌ | ❌ |
| **CodeWalk(我們)** | `.codewalk.json` + `shared/schema.ts` | ✅ | ✅ 明文對外合約 |

**「格式住在 repo 裡、可 commit、有明文 schema」不是我們的獨創** —— CodeTour 五年前就這樣做了,而且有正式的 JSON Schema 與 `jsonValidation` 綁定。Handoff 的 `.handoff/output/` 跟我們的 `.codewalk/` 設計哲學一模一樣,連「pure reader,永不寫入」都寫在 README 第一段。

真正少見的是**把格式當成對外合約來承諾**(欄位改名視同破壞性變更、走 change 流程)。多數競品的格式是實作細節,不是承諾。

### Q2. 產生方式

| 對象 | 手動錄製 | AI 生成 | AI 怎麼接 |
|---|:-:|:-:|---|
| CodeTour | ✅ 完整 | ❌ | — |
| Tour de Code AI | ✅ 繼承 | ✅ | 自填 API key(`llm.apiKey` / `apiUrl` / `provider`)+ Repomix + tree-sitter |
| CodeWalk AI | ❌ | ✅ | **三層 fallback:`claude -p` CLI → VS Code LM API → 自帶 key** |
| Taogya CodeWalker | ✅ | ✅ | **註冊 Language Model Tools,由 Copilot Agent Mode 呼叫** |
| Swimm | ✅ | ✅ | 自家雲端平台 |
| Handoff | ❌(外部 toolkit 產) | ✅ | 外部 |
| **CodeWalk(我們)** | ❌ | ✅ | **外部 prompt,extension 完全不碰** |

### Q3. agent 橋接 —— 本次最重要的發現

**三種做法都已經被實作出來,而我原本提議的剪貼簿是第四種、也是最弱的一種。**

**做法 A:extension 主動呼叫 agent(CodeWalk AI)**

拆包後在 `out/extension.js` 找到實際的 CLI 呼叫:

```
Running smoke test: "claude -p --model ${alias}"
```

它有完整的三層 fallback:先解析 `claude` CLI 路徑,失敗就退回 `vscode.lm.selectChatModels({vendor:"anthropic"})`(走 Copilot 訂閱、免 key),再失敗才用使用者自填的 API key。設定項 `codewalk.aiProvider` 的 enum 是 `auto / claudecode / copilot / anthropic / openai / custom`。

行銷語言直接寫在 marketplace 標題上:**"uses your existing GitHub Copilot or Claude Code subscription, no extra API key needed"**。

> 這正是我們 `openspec/decisions.md` 裡列為「二期、出場條件:MVP 自用滿意後」的 shell out `claude -p`。**已經有人做完了,而且驗證可行。**

**做法 B:把自己註冊成 agent 的工具(Taogya CodeWalker)**

它在 `package.json` 宣告六個 `languageModelTools`,讓 Copilot Agent Mode 直接呼叫:

| 工具 | 做什麼 |
|---|---|
| `code_walker_analyze` | 透過 language server 找 symbol,回傳原始碼與結構化 metadata |
| `code_walker_find_symbol` | 跨檔案解析 symbol 定義 |
| `code_walker_list_symbols` | 列出檔案/資料夾的所有 symbol,產生待處理清單 |
| `code_walker_highlight` | 在編輯器畫出色塊、CodeLens 標籤、行末註解 |
| `code_walker_export` | 把走讀結果存成 JSON / Markdown |
| **`code_walker_drilldown`** | **跳出 QuickPick 讓使用者輸入問題,或按 ESC 結束** |

`drilldown` 那一項值得單獨拿出來看。它的 model description 是:

> Show an interactive QuickPick input for the user to ask a question or finish the walk-through. Returns `{ finished: true }` when the user presses ESC, or `{ question: '...' }` with the user's question text.

**這就是「讀到一半可以追問」,但方向跟我想的相反** —— 不是 extension 把 prompt 丟給 agent,而是 **agent 在走讀過程中主動停下來問使用者「有沒有問題」**,使用者答了,agent 接著解釋。主導權在 agent 手上,extension 只是它的眼睛和手。

**做法 C:MCP channel 雙向通道(Code Review for Claude Code)**

這一個拆開來最有啟發。VSIX 裡直接內附一個 MCP server(`channel/server.js`),它同時是兩種伺服器:

```js
const mcp = new Server(
  { name: 'code-review', version: '0.1.0' },
  {
    capabilities: { experimental: { 'claude/channel': {} } },
    instructions: [
      'Code review feedback from VS Code arrives as <channel source="code-review">.',
      'Each review contains line-level comments grouped by file, with code context.',
      'Address each comment: fix the issue, explain why you disagree, or ask for clarification.',
      'After addressing all comments, summarize what you changed.',
    ].join(' '),
  },
)
await mcp.connect(new StdioServerTransport())
// 同時起一個 HTTP server,從 port 47123 開始找可用埠
```

- extension 端用 **VS Code 原生 comment API**(`createCommentController('code-review', 'Code Review')`)收集註記 —— 註記直接顯示在程式碼行旁邊,不是另一個面板
- 註記透過 HTTP POST `/review` 送到 channel server
- server 用 MCP 的 `notifications/claude/channel` 推給 Claude Code session
- session 註冊表寫在 `/tmp/code-review-sessions.json`,支援多個 session 並存
- 附一個 slash command `commands/connect-review.md` 讓使用者指定目標 session

**全程不碰 GitHub API、不需要 OAuth,而註記從頭到尾綁在程式碼行上。**

### Q4. 失準偵測

| 對象 | 機制 | 粒度 |
|---|---|---|
| CodeTour | 綁 git ref(None / branch / commit / tag),不在該 ref 就唯讀播放 + CI 檢查(CodeTour Watch GitHub Action) | 整份導讀 |
| Taogya CodeWalker | hash 比對 + stale queue + **repair 流程**(側邊欄有「stale 佇列」view) | 逐個 block |
| Swimm | autosync(程式碼原始碼出現 130 次)+ Smart Token + outdated 標記 | 逐個 snippet |
| Handoff | **不存快照**,每次 live 讀工作區原始碼;範圍失效時顯示非致命訊息 | 逐個引用 |
| **CodeWalk(我們)** | `anchor` 逐字快照比對,分類為 `shifted` / `stale` | 逐步 + 逐 snippet |

**我們在這一項的細緻度屬於前段,但不是唯一。** Taogya 的 stale + repair 比我們多一個「修復」動作(我們有 `pnpm relocate-anchors`,但那是 CLI,不在 UI 裡);Swimm 的 autosync 更進一步會自動更新。

值得注意 Handoff 走了完全相反的路:**不存快照,永遠讀最新的程式碼**。它用這招換掉整個失準問題 —— 代價是導讀的敘述可能跟你看到的程式碼對不上,而它選擇接受。

### Q5. 註記與 review 迴路

| 對象 | 註記在哪 | 意見怎麼傳出去 |
|---|---|---|
| Code Review `d-koppenhagen` | 自家面板 + CSV 檔 | **匯出**:HTML / Markdown / GitLab CSV / GitHub CSV / JIRA CSV / JSON,可套 Handlebars 樣板 |
| Code Annotation | 自家樹狀檢視 | 複製 |
| Stepsize | 程式碼上標記 issue | 同步 Jira / Linear / Asana |
| CodeStream(當年) | IDE 內討論串 | 同步 GitHub / Slack —— **已整個移除** |
| Code Review for Claude Code | **VS Code 原生 comment thread** | **MCP 推給 Claude Code** |
| CodeSee | 視覺化 review map | 自家雲端 —— 已死 |

**這一組直接回答你上一輪的質疑。** 你說「匯出成 markdown 貼到 PR comment 會讓 review 資訊散落、脫離程式碼」—— 資料支持你,但有一個重要的邊界:

- `d-koppenhagen.vscode-code-review` **活得很好**(26,600 安裝、2026-06 更新、4.33 分),而它幾乎全部的功能都是匯出(20 個 command 有 12 個是 export)。
- 但看它的定位:**"create a code review file you can hand over to a customer"** —— 顧問對客戶的**交付報告**,不是團隊內的 PR 對話。

**匯出模式適合「交付一份審查報告」,不適合「PR 上的往返討論」。** 這兩者被同一個詞「code review」蓋住了,但它們是不同的東西。你的直覺對,而我上一輪把兩者混在一起。

### Q6. 互動自測(quiz)

**14 個對象,零個有 quiz。**

CodeTour 有 34 個 command 涵蓋錄製、編輯、匯出、標記、notebook 檢視,沒有一個跟自我檢測有關。Swimm 有完整的文件平台,沒有。CodeWalk AI 主打語音朗讀,沒有。Taogya 有六個 LM tools,沒有。

**這是唯一確認無人佔位的功能。**

### Q7. 存活與商業模式

| 路線 | 代表 | 結果 |
|---|---|---|
| 免費開源、微軟背書 | CodeTour | 46 萬安裝,**一年未更新** |
| 創投 + SaaS 平台 | Swimm | 轉向 mainframe 現代化(離開開發者市場) |
| 創投 + 視覺化 | CodeSee | 死亡,評分 1.0 |
| 大公司收購後整合 | CodeStream → New Relic | 功能被替換成 telemetry |
| 技術債追蹤 SaaS | Stepsize | 停滯兩年 |
| 個人開源、定位窄 | `d-koppenhagen` code-review | **活著,持續更新六年** |
| YC + 視覺地圖 + AI | CodeViz | 活躍,8.6 萬安裝 |

**唯一長期存活的是定位最窄的那個。** `vscode-code-review` 只做一件事(產出交給客戶的審查報告),做了六年,沒有伺服器、沒有登入、沒有訂閱。

---

## 三、分組細看

### A 組:直接競品

**CodeTour** — 這個品類的定義者,也是我們的主要對照。

拆包後確認的能力:34 個 command、`.tour` JSON + 正式 JSON Schema、gutter Tour Markers、`registerUriHandler`(URI 格式 `vscode://vsls-contrib.codetour/startDefaultTour?tour=<名稱>&step=<n>`)、notebook 檢視、可套用 `commands` 欄位在步驟切換時執行任意 VS Code 指令、`pattern` 欄位(用 regex 而非行號定位)、匯出成 GitHub Gist。

它的 README 有 394 行、29 個章節。**光「Recording Tours」就有 15 個子節** —— 這是 `docs/future-work.md` 早就引用過的範圍失控證據,拆包後確認屬實。

值得學的兩點:
1. **`pattern` 欄位** —— 步驟可以用正則表示式而非行號定位。比行號穩,但比我們的 `anchor` 弱(要人自己寫 regex,而 anchor 是自動的逐字快照)。
2. **`commands` 欄位** —— 步驟切換時可執行任意 VS Code 指令 URI。這是強大的擴充點,也是安全風險面。

**Tour de Code AI** — CodeTour 的 fork,加了 AI 生成層。

拆包後 command 清單與 CodeTour **完全一致**(只把 prefix 從 `codetour` 換成 `tourdecode`),額外加了 `llm.apiKey` / `llm.apiUrl` / `llm.model` / `llm.provider` 四個設定,以及 `web-tree-sitter` + Repomix 的相依。

**這是「在既有播放器上加產生器」最省力的路徑** —— 直接 fork 一個成熟的播放器,只寫產生層。244 安裝、8 個月沒更新。

**CodeWalk AI** — 同名對手,定位差異最值得注意。

它是**即時問答 + 語音朗讀**:你按 `Cmd+Shift+W`,用自然語言問「explain the flow from login to dashboard」,它現場產生解說並用本地 TTS 唸出來,同時在編輯器高亮當前行。VSIX 194 MB,其中 350 MB 解壓後是 Piper 語音模型。

README 的四個使用情境裡,第一個是:

> 🤖 **"The AI just built this — what did it actually do?"**

**它跟我們解同一個問題,但答案完全不同:**

| | CodeWalk AI | CodeWalk(我們) |
|---|---|---|
| 導讀是什麼 | 問答的**副產品**,問完就沒了 | 可 commit、可審閱、可版控的**產物** |
| 誰決定內容 | AI 即時決定 | 作者事先決定,AI 只是產生器 |
| 主要感官 | 聽 | 讀 |
| 品質保證 | 無 | anchor 快照 + schema 驗證 |

**這個差異很重要:他們賣的是「省下閱讀」,我們賣的是「確認理解」。** 前者的天花板是娛樂化的資訊消費,後者的天花板是團隊的知識交付。

**Taogya CodeWalker** — 設計上跟我們最像,agent 整合走得最遠(見 Q3 做法 B)。

還有幾點值得記:
- 用 **language server 找 symbol**,不是靠行號 —— 從根本上迴避了行號漂移
- 側邊欄有四個 view:walkthrough explorer、**uncovered files**(還沒被導讀覆蓋的檔案)、**stale queue**、batch targets
- 日英雙語 l10n,跟我們一樣
- `.code-walker/walks-manual/` 與 `walks-auto/` 分開放 —— 人寫的跟 AI 產的分流

「uncovered files」這個 view 是我們沒想到的:**它把導讀當成有覆蓋率的東西**,像測試覆蓋率一樣顯示哪些檔案還沒被講過。

**Onboarding Handoff** — 設計哲學跟我們最接近的一個。

README 第一段就寫「It is a **pure reader** — it never writes to the handover output」。`.handoff/output/index.json` 的 manifest + 每節一份 markdown,`workspaceContains` 啟動,三欄式版面(側邊樹 + 文件 + 即時程式碼),用 shiki 上色(跟我們一樣),進度追蹤用 workspaceState(跟我們一樣),分層 core → supporting → peripheral。

**兩個安裝。** 這件事本身是訊息:設計哲學正確不保證有人用。

### B 組:code-coupled 文件

**Swimm** — 這個品類商業化走得最遠的,而它的軌跡是警訊。

技術上做對了很多:`.sw.md` 格式住在 repo、autosync 自動更新過期片段、Smart Token 讓文件裡的識別字跟著重新命名一起變、customEditor、`onUri` 啟動。

但 2026 年的 README 開頭是:

> Modernize mainframe and legacy applications... COBOL, PL/I, CICS, Assembler

**它從「幫團隊寫不會過期的文件」轉去做「幫銀行理解三十年前的 COBOL」。** 後者付得起錢,前者付不起。

### C 組:review 與註記

**Code Review for Claude Code** — 20 個安裝,但架構是本次最有價值的發現(見 Q3 做法 C)。

**New Relic CodeStream** — 決定性的反面證據。

它曾經是「IDE 內做 code review 與討論」最完整的實作:在編輯器裡選一段程式碼、開討論串、同步到 GitHub PR 與 Slack、綁 commit SHA 讓討論在程式碼變動後仍定位正確。40 萬安裝、88 則評價。

2026 年的 README 裡,這些**全部消失了**。剩下的九個 command 是 telemetry、NRQL 查詢、log 搜尋。

**一個做到 40 萬安裝的產品,被收購後選擇把 code discussion 整個換掉。** 這不能證明那條路必死,但它是我們在評估 PR Review 方向時繞不開的一筆。

**`d-koppenhagen.vscode-code-review`** — 見 Q5,匯出模式的邊界證據。

### D 組:AI codebase 理解

**DeepWiki**(Cognition/Devin)— 把 GitHub URL 的 `github.com` 換成 `deepwiki.com` 就得到一份互動 wiki,含架構圖、檔案連結摘要、基於 codebase 的對話介面。50,000 個熱門公開 repo 已預先索引,有 MCP server 可接進 IDE。

**它是這份分析裡對我們威脅最大的一個,而它甚至不是 extension。**

**私有 repo 也免費**(2026-08-09 查證):官方私有 repo 頁面寫「Free for your entire team — Unlimited team members, no payment required」,支援 GitHub / GitLab / Bitbucket / Azure DevOps。付費的是 Devin 執行工程任務(Pro $20/月、Max $200/月、Teams $80/月 + $40/席),不是 wiki 本身;Enterprise 可部署至自家 VPC。此外有第三方開源版 `AsyncFuncAI/deepwiki-open`,Docker 自架、支援本地路徑與自架 GitLab/GitHub Enterprise,接 Ollama 本地模型時程式碼完全不出機器。

**所以「我們的目標客戶用私有 repo」不構成防線。** 對「新人上手整個 codebase」這個場景,零準備 + 免費 + 全量覆蓋,我們幾乎沒有勝算。

真正的分界在**產品形態**,DeepWiki 有三件結構性做不到的事:

1. **它索引狀態,不索引意圖** —— 它回答「這個 codebase 現在長什麼樣」,無法回答「這次 PR 改了什麼、為什麼、reviewer 該盯哪裡」。它沒有「這次變更」這個概念,也不能綁在某個 commit 上。
2. **它的產物不進版控** —— DeepWiki 是隨時可重新生成的**視圖**,不能 commit、不能 review、不能附在 PR 分支上要求 reviewer 走一遍、不能在半年後說「當時我們是這樣理解的」。`.codewalk.json` 是**可交付的產物**,綁 `ref`、進 git、跟著分支走。
3. **它讀不出不在程式碼裡的東西** —— 「這裡繞路是因為上游 API 有個 bug」「這個 workaround 三個月後可以拿掉」「這段看起來多餘但刪了會炸」。這些在人腦裡與 PR 討論裡,AI 讀 code 讀得再好也生不出來。

**合規門檻不該當成優勢。** 外包公司把客戶程式碼上傳第三方 AI 確實常有合約障礙,但自架版與 VPC 部署正在消除這道門檻;更重要的是,那是「別人進不去」而非「我們比較好」,靠對手的限制建立的優勢,對手改一次政策就沒了。

**反過來說,這件事對我們是好消息。** DeepWiki 免費覆蓋私有 repo,等於把「AI 讀得懂 codebase」變成基礎設施 —— 我們不必再說服任何人相信這件事,只需要說服人相信:**有些東西 AI 讀不出來,需要人寫下來,而且需要確認對方真的懂了。**

**CodeViz**(YC 投資,8.6 萬安裝)— 互動式視覺 codebase 地圖,自然語言查詢產生聚焦的圖。

拆包後看相依:`@google/gemini-cli-core`、`@google/genai`、`@ai-sdk/react` —— **它接 Gemini CLI**,又一個「用你既有的 CLI agent」的案例。另外整合 Jira(`jiraApiToken` 等五個設定)。

它證明了兩件事:視覺化路線在這個品類裡活得最好;以及「接使用者既有的 agent CLI」已經是 2026 年的常見做法,不是新招。

---

## 四、對 CodeWalk 的意涵

### 被推翻的判斷(我上一輪說錯的)

**1. 「agent 橋接是差異化,CodeTour 那個世代結構上做不到」—— 錯。**

三種做法都已被實作。URI handler 更是 CodeTour 五年前就有的東西(`vscode://vsls-contrib.codetour/startDefaultTour?tour=X&step=N`),那不是差異化,是**補課**。

**2. 「面板 → agent 建議從剪貼簿開始」—— 這是四種做法裡最弱的。**

- 剪貼簿:使用者要自己貼、自己切視窗,脈絡靠純文字傳遞
- LM Tools(Taogya):agent 直接呼叫,雙向,但綁 Copilot Agent Mode
- MCP channel(Code Review for Claude Code):雙向、跨 agent、註記綁在程式碼行上
- 直接 shell out(CodeWalk AI):最直接,但 extension 要自己管 CLI 路徑與 fallback

**建議改成:先做 MCP channel 或 LM Tools,不要做剪貼簿。** 成本差距沒有想像中大(Code Review for Claude Code 的整個 channel server 只有一個檔案),而體驗差一個量級。

**3. 「gutter 標記是追平 CodeTour」—— 對,但比想像中更該做。**

Taogya 的「uncovered files」view 提示了一個我們沒想過的角度:**導讀覆蓋率**。gutter 標記加上覆蓋率視圖,能回答「這個 repo 有多少比例被講過」,那是團隊層級的問題,不只是個人閱讀動線。

### 被確認的判斷

**1. quiz 確實無人佔位。** 14 個對象、零個有。而且它跟我們的定位一致 —— 別人賣「省下閱讀」,我們賣「確認理解」,quiz 是後者唯一的可驗證形式。

**2. 「格式是對外合約」的承諾少見。** 別人有格式,但當實作細節。我們把它當合約(欄位改名視同破壞性變更、走 change 流程),這在別人寫產生器時是有意義的差別。

**3. PR Review 的匯出模式確實有問題,但有邊界。** 見 Q5 —— 匯出適合交付報告,不適合 PR 對話。

### 真正的策略問題

**這個品類最大的風險不是競爭,是需求的不對稱。**

導讀是「寫的人痛、讀的人爽」。所有停滯的產品都卡在同一個地方:沒有人願意持續寫。CodeTour 給了完整的錄製工具,46 萬人裝了,然後沒人維護;Swimm 用 autosync 解決了維護成本,還是往企業市場跑。

**AI 是這個結構第一次有機會改變的地方** —— 產生從「一小時的手工」變成「三分鐘的一個指令」。2026 年這六個新產品都在賭這件事。

**所以真正的勝負手不在播放器功能,在產生的摩擦有多低。** 這強化了 `docs/future-work.md` 現有的排序方向(供給側優先),但要修正手段。

---

## 五、對 future-work 排序的修正建議

| 原順位 | 項目 | 修正 |
|---|---|---|
| 1 | 競品分析 | ✅ 完成(本文件) |
| 2 | agent 橋接 | **技術方案改變**:剪貼簿 → MCP channel / LM Tools;URI handler 從「差異化」降為「補課」 |
| 3 | 產生器 anchor 自檢 | **維持,並提高權重** —— 這是勝負手所在 |
| 4 | PR Review 註記 | **方案改變**:VS Code 原生 comment API + agent 通道,不做 markdown 匯出 |
| 5 | gutter 標記 | **微幅提升** —— 加上「導讀覆蓋率」的角度後價值變高 |
| — | **quiz 的定位** | **新增:應提升為主打差異化**,不只是既有功能 |

### 三個需要你決定的問題

**1. quiz 要不要從「功能之一」提升為「產品的核心主張」?**

它是唯一無人佔位的東西,而且跟「確認理解 vs 省下閱讀」的定位一致。如果要,README 的第一句話就該改。

**2. agent 橋接要走哪一條?**

MCP channel 跨 agent(Claude Code、Cursor、任何支援 MCP 的);LM Tools 綁 VS Code 生態但整合最深。兩者都比剪貼簿好。

**3. 面對 DeepWiki 這種零摩擦的競爭,我們的守備範圍是不是該明確收窄到「團隊自己寫的、帶決策脈絡的導讀」?**

**注意私有 repo 不是防線** —— DeepWiki 對私有 repo 免費且無人數限制,還有可完全本地部署的開源版(見 D 組)。所以「我們的客戶是中小企業與外包公司、repo 不公開」擋不住它。

如果收窄,那「產生整個 codebase 的導讀」這個用法(`docs/authoring-walks.md` 的 `whole-codebase` scope)是在跟 DeepWiki 正面對打,而那打不贏。相對地,`git-diff` 與 `area:` 兩個 scope 是它**結構上做不到**的 —— 它沒有「這次變更」的概念,產物也不進版控。

---

## 附錄:方法與限制

**方法**
- 用 VS Code Marketplace 的 `extensionquery` API 掃 13 組關鍵字,依相關性排序
- 對 14 個對象抓完整 metadata(版本、安裝數、評分、最後更新日、相依套件)
- 下載全部 14 份 VSIX 解包,檢視 `package.json` 的 contributes 宣告、bundle 內的關鍵字串、內附的伺服器與設定檔
- DeepWiki 因非 extension,以官方文件、定價頁與私有 repo 說明頁為準;開源自架版僅查公開資料,未實際部署

**限制**
- **未實際安裝試用** —— 所有結論來自 manifest、bundle 靜態分析與官方文件,不是使用體驗
- 安裝數與評分是 2026-08-09 當下的快照
- 未涵蓋 JetBrains 生態(依決定跳過)
- 未涵蓋非 extension 的網頁工具(除 DeepWiki 外)
- CodeTour 的 bundle 經過 minify,部分實作細節靠字串比對推斷

**已刪除**:本次下載的 14 份 VSIX 與解包內容已於分析完成後移除。
