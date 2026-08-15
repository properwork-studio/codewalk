# 外部 codebase 理解工具與 CodeWalk 的關係

> 建立 2026-08-10|承接 `docs/competitive-analysis.md`
>
> 處理三件事:(一)DeepWiki 與 CodeGraph 各自是什麼、跟我們是什麼關係;(二)由此重新界定 CodeWalk 的守備範圍;(三)三層整合方案。

---

## 先看清楚:誰是競爭者,誰是供應商

DeepWiki 與 CodeGraph 表面上都在做「幫忙理解 codebase」,但**在我們的產品裡扮演的角色正好相反**。

分辨的標準只有一條:**它的產出是給人讀的,還是給 agent 用的。**

| | DeepWiki | CodeGraph |
|---|---|---|
| 產出給誰 | **人**讀(附帶 MCP) | **agent** 用(附帶 CLI) |
| 對我們是 | **競爭者** —— 搶同一批讀者 | **供應商** —— 讓我們的產出更好 |
| 該怎麼辦 | 劃清界線 | 盡快用上 |

搞混這兩者會導致完全錯誤的決策:把 CodeGraph 當威脅會錯過一個免費的加速器,把 DeepWiki 當工具會讓定位模糊掉。

---

## 第一部分:DeepWiki(競爭者)

### 存取條件:證據互相矛盾

| 來源 | 性質 | 說法 |
|---|---|---|
| [Cognition 官方部落格](https://cognition.com/blog/deepwiki) | **第一手** | 「DeepWiki 是 Devin Wiki 與 Devin Search 的**免費公開版**」「Add any public repo for free」「**For private repos, sign up for a Devin account**」 |
| [deepwiki.com/private-repo](https://deepwiki.com/private-repo) | **第一手**(行銷落地頁) | 「**Free for your entire team**」「Unlimited team members, **no payment required**」;另註「Buy credits to use Devin for **software engineering tasks**」 |
| [Devin 定價頁](https://devin.ai/pricing) | 第一手 | Free $0 / Pro $20 / Max $200 / Teams $80+$40 每席 / Enterprise 客製。功能比較表**列有 DeepWiki,但未標示屬於哪些層級** |
| [codersera 開發者指南](https://codersera.com/blog/deepwiki-complete-developer-guide-2026/) | 二手 | 「**Public repos only on the free tier.** Private repositories require a Devin subscription or the self-hosted alternative」 |
| [repowise 比較頁](https://www.repowise.dev/compare/deepwiki-alternative) | 二手(**競品,有動機誇大**) | 「private repos require a **paid** Devin account, whether or not you use Devin itself」 |

**兩個第一手來源就打架了。** 官方部落格說「請註冊 Devin 帳號」但沒說要**付費**帳號,而 Devin 確實有 $0 的 Free 方案;落地頁則直接說整團隊免費、不限人數。

**最可能的實情**:

> 索引私有 repo 需要註冊 Devin 帳號並授權 Git 平台(GitHub / GitLab / Bitbucket / Azure DevOps);Wiki 與 Search 這兩項功能本身不另外收費;收費的是讓 Devin **執行工程任務**(credits / ACU)。
>
> 至於 $0 的 Free 方案能不能連私有 repo,**公開資料無法判定**。二手來源普遍認為不行,但可能是在複述方案改版前的狀態,也可能只是誤讀了「免費版 = 公開版」。

### 怎麼確定(15 分鐘,唯一可靠的方法)

1. 用不綁公司身分的帳號註冊 Devin **Free 方案**
2. 授權 GitHub,選一個**無關緊要的私有 repo**(不要用客戶的)
3. 看它直接索引,還是跳付費牆
4. **順便記錄它要求的 GitHub 權限範圍**(read-only?組織層級?)

第 4 點對外包場景比付不付費更關鍵 —— **如果它要組織層級的 repo 讀取權,很多客戶合約直接就過不了。**

### 一個必須修正的誤解

`AsyncFuncAI/deepwiki-open` **不是 Cognition 的官方自架版**,是社群獨立專案 —— 2025-04-30 發布(DeepWiki 公布後幾天),作者在 README 自述為「my own implementation attempt of DeepWiki」。

- 它**不保證**跟官方功能對等,也不保證跟進更新
- 但確實可完全本地部署(Docker),支援本地路徑與自架 GitLab / GitHub Enterprise,接 Ollama 本地模型時**程式碼完全不出機器**
- 代價是自負模型費用與維運

換句話說:「有免費自架版」成立,但**那不是 Cognition 給的**。官方只有 Enterprise 提供 VPC 部署。

### 兩種情境對我們的影響

| | 若 Free tier 就能索引私有 repo | 若私有 repo 需付費訂閱 |
|---|---|---|
| 威脅程度 | **高** —— 我們的目標場景(中小企業、外包)無門檻可言 | **中** —— 有真實的採用摩擦 |
| 該不該當成優勢 | 不能 | **仍然不能** —— 靠對手定價建立的優勢,對手降價就沒了 |
| 定位分界要不要改 | 不用 | 不用 |

**這就是為什麼這個答案不影響策略。** 它影響「威脅有多急」,不影響「我們該站在哪裡」。

---

## 第二部分:CodeGraph(供應商)

### 是什麼

[`colbymchenry/codegraph`](https://github.com/colbymchenry/codegraph) —— **2026-01-18 建立,七個月累積 65,703 stars、4,136 forks**,MIT 授權,2026-08-08 仍在更新(406 個 open issues)。

一個**預先建好、給 AI agent 用的程式碼知識圖譜**:

- **Rust kernel + tree-sitter** 解析 20 種語言(fallback 涵蓋 30+),抽出 nodes(function / class / method)與 edges(calls / imports / extends / implements)
- 存進**本地 SQLite + FTS5**,檔案一改就用 OS 原生事件(FSEvents / inotify / ReadDirectoryChangesW)增量同步
- 掛成 **MCP server**,只曝露**一個**工具 `codegraph_explore`(其餘七個預設隱藏 —— 他們實測發現「一個強工具比一排窄工具更能引導 agent,減少誤選並省 context」)
- **100% local**,程式碼不出機器
- 官方基準(七個 repo):**88% 更少 tool call、53% 更快、62% 更少 token、44% 更便宜**
- 跨檔案依賴覆蓋率逐語言實測公開(Python / PHP / Ruby / Svelte 100%,TypeScript 95.8%,Rust 86.7%,Liquid 73.8%)

### 跟 DeepWiki 的異同

**相同**:都把 codebase 預先索引、都提供 MCP 介面、都想解決「理解一個陌生 repo 很花時間」。

**不同**,而且差異是根本性的:

| | DeepWiki | CodeGraph |
|---|---|---|
| 產出形態 | 散文 wiki、架構圖、對話 | verbatim 原始碼 + call path + blast radius |
| 怎麼生成 | **LLM 生成敘述** | **確定性解析**(tree-sitter),不經生成 |
| 有沒有「解釋」 | 有 | **明確沒有** —— 只給結構,不給為什麼 |
| 資料在哪 | Cognition 伺服器 | 本地 SQLite |
| 私有 repo | 要 Devin 帳號(免費與否仍有爭議) | 無條件 —— 本地就是本地 |
| 成本 | 公開免費,私有待確認 | MIT 全免費(成本是索引的 CPU) |
| 更新方式 | 重新索引 | 檔案變動自動增量同步 |
| 錯誤模式 | 可能**寫錯**(LLM 幻覺) | 可能**漏掉**(靜態分析的邊界:反射、DI、動態派發) |

**最關鍵的是「有沒有解釋」那一欄。** CodeGraph 告訴你「A 呼叫 B、改 C 會炸到 D」,不告訴你「為什麼要這樣設計」。它是確定性的結構,不是理解。

### 對我們的三重意義

#### 1. 它是產生器最直接的工具 —— 三個痛點全中

`codegraph_explore` 的回傳內容,跟 `.codewalk.json` 需要的欄位幾乎一一對應:

| CodeGraph 給的 | 對應到 `.codewalk.json` |
|---|---|
| **line-numbered source**(README 原話:「the same shape the Read tool gives you」) | `startLine` / `endLine` |
| **verbatim source grouped by file** | **`anchor`**(逐字快照) |
| **call paths between symbols**(含 grep 追不到的動態派發) | step 的排序依據 |
| **blast-radius summary** | `git-diff` scope 的「這次改動波及誰」 |

`docs/future-work.md` 第 3 項原本寫「產生完跑 `pnpm relocate-anchors` 自檢」。**有 CodeGraph 的話比那更好:不是產完再驗,是產的當下行號與逐字原文就是對的。**

AI 產導讀最常錯的就是這兩個欄位,而它們正是 CodeGraph 免費送的東西。

#### 2. 它驗證了我們的假設,同時劃清了邊界

七個月 65.7k stars,證明「agent 需要結構化的 codebase 知識」是量級很大的真需求。

但 CodeGraph **刻意不做解釋**。它的 call path 是「A 呼叫 B」的**執行順序**,不是「先講 A 你才看得懂 B」的**教學順序**。前者機器算得出來,後者要人判斷。

**CodeGraph 越強,越襯托出「解釋與順序」是機器算不出來的部分。**

#### 3. 它直接打在我們判定的真瓶頸上

競品分析的結論是:**真正的勝負手不在播放器功能,在產生的摩擦有多低。**

CodeGraph 讓產一份導讀少 88% tool call、少 62% token —— 那正是供給側的摩擦。而且它 MIT、本地、掛 MCP,**我們不需要整合它**,只要在產生用的 prompt 裡加一句「如果有就用」。

### 風險

- **單人專案、七個月大、406 個 open issues** —— 爆紅但年輕,可能有品質起伏或維護風險
- **靜態分析有其邊界** —— 反射、DI 容器、框架約定的進入點抓不到(他們自己在「Measured cross-file coverage」誠實列出殘差)
- **但依賴風險可控**:我們不綁定它,只在 prompt 裡寫「如果環境裡有就用」,沒有就照舊。`docs/authoring-walks.md` 從一開始就刻意寫成不綁特定 AI 或工具,這條原則不改

---

## 第三部分:分界不在範圍大小,在存取方式

### 原本的切法是錯的

競品分析第一版建議按**範圍**切 —— 整個 codebase 讓給 DeepWiki,只守 diff 與單一模組。

這個切法錯了。真正的分界是**存取方式**:

| | DeepWiki | CodeWalk |
|---|---|---|
| 形態 | **wiki** —— 隨機存取 | **walk** —— 線性引導 |
| 回答的問題 | 「X 是什麼?」 | 「你該先看什麼,再看什麼」 |
| 有沒有順序 | 沒有,想查哪頁查哪頁 | 有,而且順序是刻意設計的 |
| 會不會檢查你懂了 | 不會 | quiz |
| 類比 | **百科全書** | **課程** |

### 「理解整個 codebase」要再拆一次

這個情境底下其實有兩件不同的事:

- **「我想查某個東西」** —— DeepWiki 完勝,不用比。全量索引、隨問隨答、零準備
- **「我第一天上工,帶我走一遍」** —— wiki 幫不上忙。**它沒有「從哪裡開始讀」這個概念。** 一份 50 頁的 wiki 丟給新人,他還是不知道該點哪一頁

而 `docs/authoring-walks.md` 裡 `whole-codebase` scope 寫的規則,正好是後者:

> order the steps so understanding compounds: entry point first, then the main flow end to end, then the pieces that only make sense once the flow is clear. Do not walk files alphabetically or by directory.

**這是課程設計,不是文件生成。** DeepWiki 沒做這件事,以它的產物形態(wiki)也做不了;CodeGraph 給得出呼叫關係,但那是執行順序不是教學順序。

### 所以 `whole-codebase` 不該放棄,該重新定義

不是「講完整個 codebase」,是**「新人第一天的路徑」**。

- 前者要求完整覆蓋 —— 打不贏,也不該打
- 後者要求**取捨與順序** —— 這是人的判斷,不是索引能力

文件裡把這件事寫明,反而讓定位更清楚:**要查東西請用 DeepWiki,要有人帶你走一遍請用 CodeWalk。** 大方承認前者,後者才站得住。

---

## 第四部分:三層整合方案

回答「要用好幾套工具是不是很不方便」。

關鍵認知:**工具數量的問題,只在使用者要親自操作它們時才存在。** 整合發生在哪一層,決定了使用者感受到幾個介面。

### A. 產生階段整合(成本近零,現在就能做)

在 `docs/authoring-walks.md` 與繁中版的 prompt 加一段條件式指引:

**若環境裡有 CodeGraph MCP**(優先,因為它管的是正確性):
- 用 `codegraph_explore` 取得**行號化的原始碼**填 `startLine` / `endLine`,取得 **verbatim source** 填 `anchor` —— 不要靠模型自己數行號
- 用 **call paths** 決定 step 的先後順序
- `git-diff` scope 時用 **blast radius** 找出「這次改動還波及哪裡」,決定要不要多加一步

**若這個 repo 已被 DeepWiki 索引,或環境裡有 DeepWiki MCP**(次要,它管的是敘事):
- 先查它建立架構層級的認識,再決定導讀要講哪條主線

**使用者完全無感** —— 他只是叫 AI 產一份導讀,不知道背後查了什麼。

成本是改幾行 prompt,收益是**行號與 anchor 的正確率**(產生器最大的失敗模式)與大型 repo 的路徑取捨品質。

> 兩者都寫成「如果有就用」,維持不綁定任何特定工具的原則。

### B. 閱讀階段的參照(零新功能,現在就能做)

`narration` 已支援 http/https 連結(`markdown-rendering` capability),`reference` item 也可放外部連結。

所以某一步可以寫:「這個模組的完整結構見 [DeepWiki](https://deepwiki.com/...)」。**深度查詢外包出去,導讀專心講路徑與理由。**

不需要任何開發 —— 只是產生器要知道可以這樣寫,一樣是改 prompt。

### C. 追問階段整合(要做 agent 橋接才有,但這層最漂亮)

若 agent 橋接走 MCP channel:讀者在第 5 步卡住 → 問題推給 agent → **agent 那端同時握有 CodeWalk 給的 step 脈絡(檔案、行號、`anchor` 原文、narration)、CodeGraph 的結構圖譜、DeepWiki 的架構敘述。**

關鍵在於:**整合發生在 agent 層,不在 extension 層。**

- CodeWalk 不需要認識 CodeGraph 或 DeepWiki
- 它們也不需要認識 CodeWalk
- 三者只是同一個 agent 手上的工具
- **使用者面對的只有一個介面 —— 他問一句話**

而且現實上:多數人不會為了 CodeWalk 特地去裝別的工具,但**很多人已經在用 agent**。把整合點放在 agent 這一層最省力。

### 不建議的做法

**在 extension 內直接串任何一方的 API。** 理由三個:

1. 依賴第三方服務的可用性與定價政策
2. 違反既有原則(播放器不碰外部服務)
3. 它們給的都是 **MCP**,那是給 agent 的介面,不是給 extension 的

---

## 待決事項

### 立刻可做(不需要決定,成本近零)

- [ ] **實測 DeepWiki Free 方案能否索引私有 repo**,並記錄它要求的 GitHub 權限範圍(15 分鐘)
      —— **需要你親自做**,要註冊帳號並授權 Git 平台,步驟見本文件第一部分
- [x] **整合方案 A**:兩份 `authoring-walks` 新增「你手上可能有的工具」一節,CodeGraph 排在 DeepWiki 前面(它管正確性,後者管敘事)(2026-08-13)
- [x] **整合方案 B**:兩份都補上「能連出去就不要複述」,放在 `items` 表格後(2026-08-13)
- [x] `whole-codebase` scope 的定位改寫成「新人第一天的路徑」,並在 guidance 明寫「完整覆蓋不是目標,追求它只會讓導讀變差」(2026-08-13)

### 需要決定(承接 `competitive-analysis.md` 第五節)

1. ~~**quiz 要不要從「功能之一」提升為產品核心主張?**~~
   —— **已回答(2026-08-15):現階段不升,等團隊版本。** 理由:quiz 確實是 14 個競品裡唯一無人做的,但個人使用情境下不該有強制性,而沒有強制性的東西撐不起產品第一句話。**支點在團隊版**——通過率與分數屆時可以當驗收 KPI,那才是它從「功能」變成「主張」的時機。已寫進 `openspec/decisions.md`;README 第一句不動。

2. ~~**agent 橋接走 MCP channel 還是 Language Model Tools?**~~
   —— **已回答(2026-08-15):走 MCP。** 決定性理由是 Cursor 吃 MCP、很可能不吃 `languageModelTools`。次要理由:終端機 agent 也涵蓋、CodeGraph/DeepWiki 同層、PR Review 註記共用管線(即整合方案 C)。
   —— **同時釐清了一個容易搞混的點**:「面板框選一段去問 AI」不是靠 MCP,是靠 `workbench.action.chat.open`。MCP 決定 agent 能拉到什麼,不決定面板怎麼開口。完整理由與限制寫在 `openspec/decisions.md` 技術段。

3. ~~要不要放棄 `whole-codebase`?~~ —— **已回答:不放棄,重新定義。** 分界不在範圍大小,在 wiki vs walk。

### 需要回頭修正的既有文件

- [x] `docs/future-work.md` 第 3 項改名為「產生器的行號與 anchor 正確性」,手段拆成三層(產生時就正確 / 產完自檢 / 播放時偵測),`relocate-anchors` 退為第 2 層退路(2026-08-13)
- [x] `docs/future-work.md` 第 2 項補上競品分析找到的四種橋接做法對照,標明剪貼簿最弱、選型待決(2026-08-13)
- [x] `docs/future-work.md` 第 4 項的匯出方案正式否決,改為原生 comment API + MCP channel(2026-08-13)

---

## 附錄:資料來源

**第一手**

- [DeepWiki: AI docs for any repo — Cognition](https://cognition.com/blog/deepwiki)
- [Private Repository Access — deepwiki.com](https://deepwiki.com/private-repo)
- [Plans and Pricing — Devin](https://devin.ai/pricing)
- [DeepWiki — Devin Docs](https://docs.devin.ai/work-with-devin/deepwiki)
- [colbymchenry/codegraph — GitHub](https://github.com/colbymchenry/codegraph)(repo 統計經 GitHub API 驗證,2026-08-10)
- [AsyncFuncAI/deepwiki-open — GitHub](https://github.com/AsyncFuncAI/deepwiki-open)(**社群專案,非官方**)

**二手**

- [DeepWiki Developer Guide 2026 — codersera](https://codersera.com/blog/deepwiki-complete-developer-guide-2026/)
- [DeepWiki alternative for private repos — repowise](https://www.repowise.dev/compare/deepwiki-alternative)(競品,判讀需打折)

**限制**

- DeepWiki 未實際註冊測試,私有 repo 的免費範圍以公開資料為準,而公開資料互相矛盾 —— 這正是把實測列為第一個待辦的原因
- CodeGraph 未實際安裝執行,效能數字為其官方基準,未獨立驗證
