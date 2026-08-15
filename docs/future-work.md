# 後續功能評估

> **狀態:探索中,不是承諾。** 這份文件記錄評估過的方向與判斷依據,任何一項要動工都得先走 OpenSpec change 流程。
>
> 建立於 2026-08-07。**2026-08-09 大幅改寫**:v0.1.1 上架後重新排序,並納入產生器側與 PR Review 方向。改寫理由見「排序為什麼變了」。
>
> **2026-08-13 更新**:第 1 項競品分析已完成(見 [`competitive-analysis.md`](./competitive-analysis.md)),外部工具的關係另見 [`external-tools-positioning.md`](./external-tools-positioning.md)。第 2、3、4 項依調查結果調整手段,順位不變。

## 排序為什麼變了

初版的排序(gutter 標記第一)是在**假設供給沒問題**下排的。上架後回頭看,這個假設不成立:

CodeWalk 的價值 = **導讀數量 × 導讀品質 × 播放體驗**。前兩項現在都趨近於零 —— 使用者數是 0,產生一份導讀還要手動開對話、貼 prompt、等它跑完。**在這個狀態下加播放器功能,是在乘一個等於零的因子。**

所以評估改用三把尺:

1. **供給側** —— 有沒有降低「產出一份導讀」的摩擦
2. **不可逆性** —— 是不是現在不做、以後做很痛(格式合約這類)
3. **差異化** —— 是不是 CodeTour 那類既有工具結構上做不到的事

## 摘要

| 方向 | 工作量 | 價值 | 動格式合約 | 順位 |
|---|---|---|---|---|
| ~~競品分析~~ | 半天 | 槓桿型 | 否 | **✅ 已完成(2026-08-09)** |
| agent 橋接(產生→播放、播放→追問) | 小~中 | 高 | design 時盤點 | **2** |
| 產生器的行號與 anchor 正確性 | 小~中 | 高 | 否 | 3 |
| PR Review 註記 | 中 | 中(方案已改) | 可能 | 4 |
| 程式碼上的導讀標記 | 小 | 中(需導讀密度) | 否 | 5 |
| 個人筆記 | 小 | 待驗證 | 否 | 押後 |
| 錄製實作 | 中 | 中 | 很可能要 | 押後 |
| JetBrains 支援 | **極大** | 長期 | 否 | 明確押後 |

---

## 1. 競品分析 ✅ 已完成(2026-08-09)

完整報告見 [`competitive-analysis.md`](./competitive-analysis.md)(掃 13 組關鍵字、拆解 14 份 VSIX),外部工具的關係見 [`external-tools-positioning.md`](./external-tools-positioning.md)。

### 影響後續排序的五個結論

1. **這個品類是一座墓園,旁邊剛冒出一片新生兒** —— CodeTour(46 萬安裝)一年未更新、CodeStream 轉 telemetry、Swimm 轉 mainframe、CodeSee 已死;2026 年新出的六個全是 AI 驅動、全是個位數到百位數安裝。需求是真的,商業模式不是。
2. **agent 橋接已有三種成熟做法** —— extension 主動呼叫(CodeWalk AI 直接 shell out `claude -p`)、註冊 Language Model Tools(Taogya)、MCP channel 雙向(Code Review for Claude Code)。**原本設想的剪貼簿方案是四種裡最弱的。**
3. **URI handler 不是差異化,是補課** —— CodeTour 五年前就有 `vscode://vsls-contrib.codetour/startDefaultTour?tour=X&step=N`。
4. **quiz 無人佔位** —— 14 個對象、零個有自測機制。
5. **匯出模式有明確邊界** —— `d-koppenhagen.vscode-code-review` 靠匯出活了六年,但它的定位是「交給客戶的審查報告」;CodeStream 做到 40 萬安裝的 IDE 內 PR 討論則被整個移除。**匯出適合交付報告,不適合 PR 往返討論。**

### 已釐清的假設

- **CodeTour 沒有讀者註記** —— 它的 Tour Markers 是 gutter 標記,屬作者端錄製工具。第 4 項的前提成立。
- **CodeTour 的失準對策是綁 ref + CI 檢查**,粒度是整份導讀;我們的 `anchor` 逐字比對是逐步粒度,細緻度屬前段但非唯一(Taogya 有 stale queue + repair,Swimm 有 autosync)。

---

## 2. agent 橋接

### 是什麼

兩個方向,同一套機制,**必須合併設計**:

- **agent → 面板**:AI 產完 `.codewalk.json` 後,直接把面板開起來並載入那份導讀
- **面板 → agent**:讀者卡在第 N 步,一鍵把該步的脈絡組成 prompt 丟給自己的 agent 追問

### 為什麼排在功能類之前

**它補的是產品最大的結構性缺口:導讀目前是單向的。** 讀者卡住只能關掉面板、自己重述脈絡去問 AI。而這正是 CodeTour 那個世代的工具結構上做不到的事 —— 它誕生在沒有 agent 的年代。

gutter 標記是追平競品;這一項是差異化。

### 技術路徑

**agent → 面板**:extension 註冊 `window.registerUriHandler`(目前 `src/` 完全沒有),skill/prompt 產完後執行:

```bash
code --open-url "vscode://properworkstudio.codewalk-reader/open?walk=<相對路徑>"
```

Cursor 同一套機制(認自己的 scheme,`--open-url` 一樣可用)。

**面板 → agent**:把 walk title、step narration、`file`+行號、`anchor` 原文組成結構化脈絡送給 agent。

> **2026-08-13 修正**:原本寫「建議從剪貼簿開始」。競品分析後確認**那是四種做法裡最弱的一種**,三種更好的做法都已有現成實作可參考。

| 做法 | 參考實作 | 特性 |
|---|---|---|
| 剪貼簿 | —— | 使用者要自己貼、自己切視窗,脈絡靠純文字傳遞 |
| **MCP channel** | Code Review for Claude Code(VSIX 內附一個 MCP server + HTTP 埠,用 `notifications/claude/channel` 推給 session) | 雙向、**跨 agent**、註記綁在程式碼行上 |
| **Language Model Tools** | Taogya CodeWalker(註冊六個 `code_walker_*` 工具,含讓 agent 停下來問使用者的 `drilldown`) | 整合最深,但綁 VS Code / Copilot Agent Mode |
| 直接 shell out | CodeWalk AI(`claude -p` → `vscode.lm` → 自帶 key 三層 fallback) | 最直接,但 extension 要自己管 CLI 路徑與 fallback |

**選 MCP channel 還是 LM Tools 仍待決定。** 一個附帶考量:CodeGraph 與 DeepWiki 都走 MCP,選 MCP channel 能讓三者在同一層對話(見 [`external-tools-positioning.md`](./external-tools-positioning.md) 整合方案 C)。

無論選哪個,`regenerateHint` 的設計哲學不變 —— 把結構化脈絡準備好交出去,extension 自己不呼叫 AI。

### 跟 decisions.md 的關係

`decisions.md` 寫著「MVP 期禁止把產生邏輯寫進 extension」。

**準備 prompt 不是產生導讀** —— 產生是 AI 讀 diff 自動寫出整份導讀,這裡只是把讀者已經在看的東西組成一段文字。而且 repo 裡已經有先例:`regenerateHint` 就是「給未來讀者、可直接貼進終端機的指令」,只是從「整份重生」細化到「單步追問」。

不牴觸,但值得在 design 裡寫明,免得日後看不懂邊界在哪。

### design 階段必辦:格式合約的一次性盤點

**這件事取代了初版文件裡「錄製的 design」那一項。**

初版的論證是對的(格式是對外合約、使用者 0 的現在改沒成本),但範圍太窄 —— 只為錄製盤點一次太浪費。已知會想加欄位的需求至少有四處:

| 來源 | 可能需要的欄位 |
|---|---|
| agent 橋接 | step 級的追問提示?(還是純靠既有欄位組 prompt 就夠) |
| 產生器 | generator metadata(哪個工具、哪個版本產的) |
| PR Review 註記 | 註記存哪、算不算導讀的一部分 |
| 錄製 | 草稿狀態、編輯時間、步驟暫時 id |

**一次攤開來看,決定哪些現在加、哪些明確不加。** 反正 design 都要寫,邊際成本接近零。

**窗口不是今天關閉,是「有人開始寫導讀」時關閉。** 現在沒有使用者,但這個狀態不保證持續。

---

## 3. 產生器的行號與 anchor 正確性

> **2026-08-13 手段調整**:原本寫的是「產完跑 `pnpm relocate-anchors` 自檢」。發現 CodeGraph 之後,更好的做法是**在產生的當下就拿到正確的行號與逐字原文**,而不是產完再驗。

### 問題在哪

AI 產導讀最容易錯的就是**行號與 `anchor` 逐字內容** —— 而且錯了要到播放時才發現(面板顯示「這一步可能不可信」)。

### 三層手段,由好到差

| 手段 | 做法 | 狀態 |
|---|---|---|
| **1. 產生時就正確** | 有 CodeGraph MCP 時,用 `codegraph_explore` 回傳的 line-numbered source 填行號、verbatim source 填 `anchor` —— 模型完全不需要自己數行 | **✅ 已寫進兩份 `authoring-walks`**(2026-08-13) |
| **2. 產完自檢** | 產生流程跑一次 `pnpm relocate-anchors` 再交件 | 待做,是沒有 CodeGraph 時的退路 |
| **3. 播放時偵測** | `anchor` 逐字比對,標成 `shifted` / `stale` | 已存在(stale-step-detection capability) |

`relocate-anchors` 從「主要手段」退為「第 2 層退路」,不是不做,是順序變了。

CodeGraph 的細節與風險見 [`external-tools-positioning.md`](./external-tools-positioning.md) 第二部分。

### 「擴充成生成 agent」的三種解讀,只有這塊值得先做

| 拆解 | 成本 | 判斷 |
|---|---|---|
| 把 explain-change skill 從本機搬進 repo 公開 | 極小 | 邊際收益小 —— `docs/authoring-walks.md` 已覆蓋基本盤,且刻意寫成不綁 Claude |
| 做成可安裝的 plugin / skill | 中 | 等有人問再說 |
| **提高行號與 anchor 的正確率** | 小~中 | **真正的品質點,先做這塊**(第 1 層已完成,成本只是改 prompt) |

---

## 4. PR Review 註記

### 這個方向要拆三層

初版文件只拆了兩極,漏掉中間這層:

| 層 | 內容 | 判斷 |
|---|---|---|
| L1 | 導讀 commit 進 PR 分支,reviewer checkout 後照著走 | **現在就能做**,零功能,只差寫進文件 |
| **L2** | **reviewer 邊走邊在某一步留註記** | **值得做,不需碰 GitHub API** |
| L3 | 面板內留 GitHub comment、approve | **不做** —— OAuth、同步 comment 狀態、跟官方 PR extension 正面競爭,投入產出比不成立 |

**L3 的否定不影響 L2。** 初版寫的「PR Review 拆解後多半不需要新功能」下得太快。

### L1 的具體流程(要寫進兩份 README)

現在 README 只有開頭一句 "getting a reviewer up to speed on a large diff",沒告訴人怎麼做:

1. 作者開 PR 前,對這個分支的 diff 產一份導讀
2. 把 `.codewalk/YYYY-MM-DD-<主題>.codewalk.json` 一起 commit 進 PR 分支
3. PR 描述寫一句「先用 CodeWalk 走一遍」
4. reviewer checkout 分支,開面板,按方向鍵讓作者帶著走完變更

### quiz 的對象是作者,不是 reviewer

`explain-change` skill 原本就寫著「重大 change 請對方審查前,自己先作答 quiz —— 過不了,代表這個 change 還不該送審」。

**AI 開發下這更重要:作者很可能沒真的寫那些程式碼,quiz 是他「有資格送審」的門檻。**

reviewer 端不是不需要,而是**不該強制** —— review 的訴求是更快,強制作答跟目標打架。結論:**對作者是紀律,對 reviewer 是選配**。

### L2 的關鍵矛盾:「只給自己」在這裡失效

初版文件建議註記「先做只給自己的版本觀察使用情況」。**如果註記的主場景是 PR Review,這個建議是壞的** —— review 意見的存在意義就是要傳回作者。存 `workspaceState` 然後沒人看得到,等於做了一個沒有出口的功能。

**~~出路是匯出成 markdown 貼進 PR comment 或 Slack~~** —— **2026-08-13 否決。** 這個方案為了迴避 API 成本,犧牲了核心體驗:review 意見離開程式碼旁邊、散落到別的地方,被 review 的人要去另一處讀一大篇沒有程式碼脈絡的文字。**本末倒置。**

**競品分析驗證了這個判斷,而且劃出了邊界:**

- `d-koppenhagen.vscode-code-review` 幾乎全靠匯出(20 個 command 有 12 個是 export),而且活了六年、26,600 安裝 —— 但它的定位是 **"create a code review file you can hand over to a customer"**,顧問給客戶的**交付報告**
- **匯出適合交付一份報告,不適合 PR 上的往返討論。** 這兩件事被同一個詞蓋住,但不是同一種東西

**真正的出路是第三條路**(參考實作:Code Review for Claude Code):

1. 註記用 **VS Code 原生 comment API**(`createCommentController`)—— 顯示在程式碼行旁邊,不是另一個面板
2. 透過**本地 MCP channel** 推給讀者自己的 agent
3. agent 拿到的是綁定 `file:line` 的結構化意見,可以直接改、可以回答、也可以由它去發 PR comment

**全程不碰 GitHub API、不需要 OAuth,而註記從頭到尾沒有離開程式碼。**

這跟第 2 項共用同一套機制 —— 若 agent 橋接選了 MCP channel,這一項幾乎是同一條管線的第二個用途。

### 前置依賴(不能跳過)

**reviewer 能走導讀的前提是作者願意為每個 PR 產一份。** 如果產導讀還要手動開對話、貼 prompt、等它跑完,大部分人第二次就不做了。

**所以第 2、3 項必須排在這一項前面。** 供給側沒解決,PR Review 場景撐不起來。

### 待決議題

- 註記存哪:`workspaceState`(照抄 `ProgressStore` / `AttemptStore`)還是寫檔?PR 場景下一次性居多,傾向前者
- 註記的存續期:PR 合併後該不該自動失效?綁 `ref` 還是綁分支名
- 匯出格式要不要對齊 GitHub 的 suggestion 語法

---

## 5. 程式碼上的導讀標記

### 是什麼

在編輯器 gutter 標示「這幾行有導讀講過」,點擊跳進對應的那一步。CodeTour 有同類功能,叫 Tour Markers。

### 為什麼從第一名降到第五

方向仍然對 —— 目前只有「打開導讀 → 跳到程式碼」一個方向,加了標記多一個反向入口:**讀 code 時發現這段有人講過 → 點進導讀**。後者才是日常更常發生的情境。

**但它的價值有個前提沒成立:repo 裡要有夠多導讀。** 現在一個 repo 大概只有 1-2 份,gutter 幾乎永遠是空的。**它是導讀密度起來之後的功能。**

技術上仍然幾乎免費:`anchor` 讓標記在程式碼改動後仍定位準確,失準的就不畫 —— 這是 stale-step-detection 已解決的問題,直接復用。

### 技術路徑

- `vscode.window.createTextEditorDecorationType()` 建 gutter icon 的 decoration type
- 掃 `.codewalk/` 建立 `file → [{walkPath, stepIndex, lineRange}]` 的索引
- 監聽 `onDidChangeVisibleTextEditors`,對可見的編輯器套用 decoration
- 位置用 `buildAnchorReport()` 的結果修正(`shifted` 跟隨新行號,`stale` 不畫)

### 待決議題

- 一份檔案被多個導讀引用時,gutter 只有一格空間 —— 顯示數量?還是只標示「有」然後點擊時給選單?
- 索引什麼時候重建?每次開檔掃一次太頻繁,檔案監看又是額外複雜度
- 導讀很多時 gutter 會不會太吵?需不需要開關

---

## 6. 個人筆記

### 跟 PR Review 註記的關係(初版的合併建議要鬆綁)

初版說註記跟 gutter 標記該合併設計,理由是兩者都是「讀者留下的痕跡」。**這個理由在 PR 註記出現後變弱了:**

| | PR Review 註記 | 個人筆記 |
|---|---|---|
| 存續期 | 一次性,跟著 PR 生命週期 | 長期累積 |
| 可見範圍 | 要傳回作者 | 只給自己 |
| 匯出需求 | 核心功能 | 沒有 |

**可能是兩個功能而不是一個。** design 階段要確認,不要為了共用 decoration 機制硬把兩者塞在一起。

### 技術上很簡單

存 `workspaceState` 就好,repo 裡有兩個同構的現成範例:`ProgressStore` 和 `AttemptStore`。照抄結構,連 `ref` 失效判斷的模式都一樣。

### 真正的問題還是產品面

價值取決於**導讀會不會被反覆讀**。如果導讀主要用在一次性上手,讀完就不再回去,筆記幾乎不會被翻出來。

使用者數 0 時無從驗證 —— **押後,等有實際使用行為可觀察。**

---

## 7. 錄製

### 是什麼

在 VS Code 裡直接建立導讀:選一段程式碼、寫敘述、存成一個 step。

### 真正的價值

不是省打字,是**自動填 `anchor` 和行號**。

手寫 `.codewalk.json` 時這兩個欄位最容易出錯,而且錯了要到播放時才發現。錄製時它們是白送的 —— 選了哪幾行,`startLine` / `endLine` / `anchor` 就自動是那幾行。

**注意這跟第 3 項(產生器自檢)解的是同一個問題,而第 3 項成本低得多。** 先做第 3 項,錄製的急迫性會下降。

### 它會改變產品的性質

目前 extension 對檔案系統是唯讀的。錄製之後就變成編輯器:要處理編輯中的暫存狀態、要有「草稿 / 已存」的概念、要處理寫檔失敗、webview 要多一套編輯模式的狀態機。

### 最大的風險是範圍失控

證據在 CodeTour 的 README:光「Recording Tours」一節就有 15 個子節 —— Step Titles、Text Selection、Re-arranging、Deleting、Editing、Linking Tours、Primary Tours、Conditional Tours⋯⋯

錄製功能一旦開始做,需求會自己長出來。

**要做的話硬性限縮成三個動作:加一步、刪一步、調順序。** 其他一律不做,等有人真的抱怨再說。

### 跟 decisions.md 的關係

「MVP 期禁止把產生邏輯寫進 extension」禁的是**產生**(AI 讀 diff 自動寫),錄製是人手動建立、不涉及 AI,技術上不牴觸。

但那條規則的精神是「保持播放器單純」,做錄製等於放寬它。**需要在 `decisions.md` 明確重新定案,不是默默做掉。**

---

## 8. JetBrains 支援(IntelliJ / Android Studio)

### 要意識到這不是「一個項目」,是第二個產品

IntelliJ Platform SDK 是 Kotlin/Java,webview 要走 JCEF 重寫,`shared/` 的 TypeScript schema **一行都搬不過去**,只有格式定義本身(那份 JSON 的形狀)可共用。等於整套 UI + host 邏輯重來。

### 出場條件(寫死,不再重問)

**VS Code 版有實際使用者,且其中有人明確要求 JetBrains。** 現在兩個都不成立。

---

## 已否決

- **`/explain-change` skill 英文版**(2026-08-09)—— skill 住本機 `.claude/skills/`,不隨 repo 公開,讀者只有作者本人;對外的產生器入口是 `docs/authoring-walks.md`,那份本來就是英文且刻意寫成不綁 Claude。翻譯解決不了任何實際問題。
- **面板內留 GitHub comment / approve**(見第 4 項 L3)

---

## 建議順序

**先順手清掉(≤1 小時,不佔排序)**

- PR Review L1 的四步流程寫進兩份 README(見第 4 項)—— **仍未做**
- ~~JSDoc 紀律寫進 CLAUDE.md~~ —— 已完成(2026-08-09),harness 範本的多語言版本另案討論
- ~~產生用的 prompt 加上 CodeGraph / DeepWiki 條件式指引~~ —— 已完成(2026-08-13),兩份 `authoring-walks` 皆已更新
- ~~`whole-codebase` scope 重新定義為「第一天的路徑」~~ —— 已完成(2026-08-13)
- **實測 DeepWiki Free 方案能否索引私有 repo**,並記錄它要求的 GitHub 權限範圍 —— **需要你親自做**(要註冊帳號並授權,見 `external-tools-positioning.md`)

**一輪一輪來:**

1. ~~**競品分析**~~ —— ✅ 已完成(2026-08-09),見 [`competitive-analysis.md`](./competitive-analysis.md)
2. **agent 橋接** —— design 階段一併做格式合約盤點;**待決:MCP channel 還是 LM Tools**
3. **產生器的行號與 anchor 正確性** —— 第 1 層(CodeGraph)已完成,第 2 層(產完自檢)待做
4. **PR Review 註記**(L2)—— 依賴 2 的機制;方案已從匯出改為原生 comment + agent 通道
5. **程式碼上的導讀標記** —— 等導讀密度起來;可一併考慮 Taogya 的「未覆蓋檔案」視角(把導讀當成有覆蓋率的東西)
6. **個人筆記** / **錄製實作** —— 看實際使用行為與投入意願
7. **JetBrains** —— 等使用者要

**還沒決定的兩題**(見 [`external-tools-positioning.md`](./external-tools-positioning.md) 待決事項):quiz 要不要升為產品核心主張、agent 橋接走哪一條。
