# 產生導讀的指引

[English](./authoring-walks.md) | 繁體中文

CodeWalk 只是播放器，不會幫你產生導讀。這份文件提供一段可以直接交給 AI 的
prompt，讓你不必手寫 `.codewalk.json`。

內容不綁任何特定工具。只要那個助手讀得到你的 repo、寫得出檔案就能用。

> **想自己寫？** 格式很小，完整定義在 [`shared/schema.ts`](../shared/schema.ts)。
> 這份文件是捷徑，不是合約本身。

## 選一個範圍

下面的 prompt 涵蓋三種範圍。改掉 `SCOPE:` 那一行就好，其餘不用動。

| 範圍 | 什麼時候用 | 大概步數 |
| --- | --- | --- |
| `whole-codebase` | 新人的第一天——帶他走一條穿過專案的路 | 15–25 步 |
| `git-diff` | 讓 reviewer 在審查前先看懂一份大改動 | 5–12 步 |
| `area: <什麼>` | 你指定的某個模組、功能或流程 | 8–15 步 |

## Prompt

複製整個區塊，改掉 `SCOPE` 那一行，連同開著的 repo 一起交給你的 AI 助手。

````text
請為這個 repo 產生一份 CodeWalk 導讀，寫到
`.codewalk/<YYYY-MM-DD>-<簡短主題>.codewalk.json`。

SCOPE: whole-codebase
  把上面那一行換成以下其中一個：
    whole-codebase          — 穿過這個專案的一條第一天路徑
    git-diff                — 目前的改動（未提交的，或 `git diff main...HEAD`）
    area: <要涵蓋的範圍>     — 例如「area: 認證流程」

動手之前先跑 `git rev-parse HEAD`，用那個完整 SHA 當作 `ref`。

導讀內容請用繁體中文撰寫（若要英文版，改用英文版指引的 prompt）。

## 你手上可能有的工具

開始之前先確認有哪些可用。這些都不是必要的——沒有它們這份 prompt 一樣能用——
但它們能消除最常搞壞導讀的兩個失敗模式：行號錯、anchor 被重打。

- **CodeGraph MCP**（`codegraph_explore`）——每一步都用它。查詢那個 symbol，把它
  回傳的**帶行號的原始碼**拿來填 `startLine`/`endLine`，把**逐字原文**拿來填
  `anchor`。**絕對不要自己數行號。** 它的 call path 告訴你哪段程式碼會走到哪段；
  那是你排序的輸入，不是排序本身——執行順序跟教學順序是兩回事。`git-diff` 範圍
  時，它的 blast-radius 摘要能顯示這次改動還波及了什麼。
- **DeepWiki MCP**——如果這個 repo 已被索引，先讀它建立架構層級的認識，再決定
  要走其中哪一條主線。
- **兩個都沒有**——直接讀檔案，anchor 用複製的不要重打，最後拿收工清單逐項核對。

## 導讀是什麼

一連串的步驟。每一步指向真實檔案裡真實的行號範圍，並解釋它。讀者按方向鍵，
編輯器就跟著跳轉、highlight。最後用 quiz 檢查他是不是真的看懂了。

寫給「有能力但從沒看過這份程式碼」的人。解釋**為什麼**，不要解釋是什麼——
程式碼就在你的文字旁邊。「這個函式驗證 token」毫無價值；「驗證放在這裡而不是
middleware，因為 middleware 跑在 tenant 解析之前」才是重點。

## 各範圍的指引

- **whole-codebase** — 這是**第一天的路徑，不是完整文件**。步驟順序要讓理解逐步
  累積：先進入點，再把主流程從頭走到尾，最後才是那些「要先懂主流程才看得懂」的
  部分。**不要按檔名字母序或目錄結構走**。讀者自己推得出來的東西就跳過（設定檔
  樣板、re-export 的 barrel 檔）。**完整覆蓋不是目標，追求它只會讓導讀變差**——
  想「查某個東西」的讀者有別的工具可用；他在別處拿不到的，是一個經過取捨的順序。

- **git-diff** — 主題是這次的改動，不是整個 codebase。先講它解決什麼問題，再
  依「怎樣講才好懂」的順序走過改動。要帶上足夠的周邊未改程式碼，讓改動有脈絡。
  實際的修改用 `diff` 元件呈現。

- **area: <什麼>** — 待在指定的範圍內。範圍外的東西有影響時，解釋邊界上的契約
  就好，不要走進去。

## 必要格式

```json
{
  "title": "簡短具體——讀完之後讀者會懂什麼",
  "ref": "<git rev-parse HEAD 得到的完整 SHA>",
  "steps": [
    {
      "title": "這一步的簡短標題",
      "file": "src/server.ts",
      "startLine": 12,
      "endLine": 20,
      "narration": "這段程式碼為什麼長這樣。",
      "anchor": "<第 12 到 20 行的逐字原文>",
      "terms": [{ "term": "middleware", "explanation": "..." }],
      "items": []
    }
  ],
  "quiz": [
    {
      "question": "...",
      "options": ["...", "..."],
      "correctIndex": 0,
      "optionExplanations": ["為什麼這個對", "為什麼這個錯"]
    }
  ],
  "regenerateHint": "<重新產生這份導讀的白話指令>"
}
```

以下規則依「最常被弄壞」的順序排列：

1. **`anchor` 必須是 `startLine` 到 `endLine` 的逐字原文**——每一個字元都要一樣，
   包含縮排與註解。**用複製的，絕對不要重打或重排版。** 這是 CodeWalk 分辨
   「程式碼只是位移」與「程式碼真的改了」的依據。沒有 anchor 的導讀仍然可以播放，
   但完全失去失準偵測。
2. **行號是 1-based 且頭尾皆含**，而且必須與 anchor 完全對應。這裡差一行，
   每一步都會安靜地 highlight 錯位置。
3. **`file` 是相對於 repo 根目錄的路徑**，用正斜線，開頭不能有 `/`，中間不能有
   `..`。絕對路徑與上層目錄會被播放器拒絕。
4. **至少一個 step、至少一題 quiz**。
5. `optionExplanations` 若有提供，長度必須與 `options` 完全相同。

## 選用的步驟元件

每一步可以帶一個 `items` 陣列。節制使用——它們是調味，不是主菜。

| `kind` | 結構 | 用途 |
| --- | --- | --- |
| `tip` | `{ kind, text }` | 值得知道但不影響理解這一步的補充 |
| `pitfall` | `{ kind, misconception, reality }` | 讀者真的會有的錯誤認知 |
| `todo` | `{ kind, text }` | 被走讀的程式碼裡已知未完成的事 |
| `reference` | `{ kind, label, url }` | 外部文件。只接受 http/https，其他 scheme 驗證會失敗 |
| `snippet` | `{ kind, label, file, startLine, endLine, anchor }` | 引用別處這一步依賴的程式碼 |
| `diff` | `{ kind, label, file, startLine, endLine, oldStartLine, diffText }` | 改動的前後對照 |

`diff` 的 `diffText` 只放 hunk 本體——不要 `diff --git`、`---`/`+++` 或 `@@`
標頭。每行開頭加 `+`、`-` 或空白，且至少要有一行 `+` 或 `-`。`oldStartLine` 是
這段 hunk 在改動前檔案的起始行，`startLine` 是改動後的起始行。

**能連出去就不要複述。** 讀者若需要某個模組的完整結構，用 `reference` 元件連到
外部來源（自動產生的 wiki、專案自己的文件）比在 narration 裡試圖摘要它更有用。
導讀的職責是路徑與理由，不是完整覆蓋。

## 術語

`terms` 會變成步驟旁邊可收合的卡片。只在「懂這個語言、但沒看過這個專案的人不會
知道」時才加註解——領域術語、專案自己的命名、不直觀的函式庫概念。一般程式設計
詞彙不要註解。

每個術語**只解釋一次**，放在它第一次出現的那一步。兩三句白話，再加一句「它在
這裡為什麼重要」。

## Quiz

Quiz 不是裝飾——它是讀者確認自己到底有沒有看懂的方式，也是導讀之所以勝過文件的
主要原因。

- 完整導讀出 5 題，短的出 3 題。
- 每一題都必須**只有**看懂導讀的人才答得出來。能靠通用知識猜到的題目就是浪費。
- 不要陷阱題、不要「以下何者**不是**」、不要幾乎一樣的選項。
- 問「為什麼」與「拿掉會怎樣」，不要問「這在第幾行」。
- 每個選項都要寫進 `optionExplanations`，**包含正確的那個**。錯的選項為什麼錯，
  才是學習真正發生的地方。
- `passThreshold` 預設是簡單多數，想更嚴格才設定它。

## 文字欄位的 Markdown

一個封閉的子集。其他語法會顯示成純文字，不會讓導讀壞掉。

- **長欄位**（`narration`、`term.explanation`、`tip`/`todo.text`、
  `pitfall.misconception`/`reality`、`optionExplanations`）支援：行內
  `` `code` ``、`**粗體**`、`[連結](https://...)`、`- 項目符號`、
  `1. 編號清單`、`## 第二層小標`。
- **短欄位**（`title`、`term.term`、`question`、`options`、任何 `label`）只支援
  行內程式碼、粗體、連結。

導讀內容用什麼語言寫，由你決定。播放器本身的介面語言跟隨編輯器設定，兩者互不
影響。

## 收工前檢查

拿產出的檔案逐項對：

- [ ] 每個 `anchor` 與它宣稱的行號內容逐字相同
- [ ] 每組 `startLine`/`endLine` 與 anchor 的實際位置一致
- [ ] 每個 `file` 都存在、是 repo 相對路徑、且沒有 `..`
- [ ] `ref` 是目前 HEAD 的完整 SHA
- [ ] 步驟順序能讓理解累積
- [ ] 沒有任何 narration 只是把程式碼再唸一次
- [ ] 每一題 quiz 都需要讀過導讀才答得出來
- [ ] 每個選項都有解釋
````

## 產生之後

打開 CodeWalk 面板選那份導讀。如果檔案不符合 schema，面板會顯示確切的問題並附上
JSON 路徑（例如 `steps[2].narration must be a non-empty string`）——把那段貼回去
請 AI 修就好。

如果一產生就整片標成失準，代表 anchor 對不上檔案。這幾乎一定是 anchor 被重打過
而不是複製的，或是行號差一行。

## 讓導讀活下去

導讀描述的是某一個時間點的程式碼。專案繼續走，它就會失準。

程式碼只是**位移**時（文字相同、位置改變），CodeWalk 會自動跟上，不顯示警告也
不需要你做任何事。當文字本身**改變**了，那一步會被標為失準，面板會提供按鈕複製
這份導讀的 `regenerateHint`，讓你直接貼回給 AI。

把導讀當成用完即棄的東西。重新產生比手動修行號更便宜也更誠實——這正是
`regenerateHint` 值得填的原因。
