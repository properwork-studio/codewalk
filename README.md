# CodeWalk

> **Note:** The extension UI is currently in Traditional Chinese only. An English UI is planned for a future release.

要讓別人讀懂一份程式碼,通常得有人坐在旁邊邊指邊講。CodeWalk 把那個過程搬進 VS Code 側邊欄。

它讀 repo 裡的導讀檔,一步一步帶著走:自動跳到對應的行號並高亮、附上敘述和術語解釋,走完還能用 quiz 檢查自己有沒有真的看懂。

新人上手、接手不熟的模組、送審前讓 reviewer 先摸清一份大 diff——這些場合都用得上。

![CodeWalk 面板停在第 3 步,左側顯示步驟敘述、術語與程式碼片段,右側編輯器同步跳到 shared/schema.ts 並選取對應的行號範圍](docs/images/panel-walking.png)

## 快速開始

**1. 安裝**

在 VS Code 的 Extensions 面板搜尋 `CodeWalk`。裝完左側活動列會多一個腳印圖示。

**2. 準備一份導讀**

在 repo 根目錄開一個 `.codewalk/` 目錄,放進 `*.codewalk.json`(格式見下方)。

> CodeWalk 目前只播放,**不會幫你產生導讀**。檔案要自己來:手寫、請 AI 寫、用任何工具產都行,格式是開放的。

**3. 開始走**

點活動列的腳印圖示,或執行指令 `CodeWalk: 開啟導讀`,選一份就開始了。

| 按鍵 | 動作 |
|---|---|
| `→` / `↓` | 下一步 |
| `←` / `↑` | 上一步 |
| `Home` | 回到這一步的程式碼位置 |
| `Esc` | 回導讀列表 |

快捷鍵要面板有焦點才會生效,點一下面板任何地方就有了。

## 功能

- **逐步走讀**——每一步自動開檔、選取、捲到對應的行號範圍。焦點會留在面板上,所以你的手不用離開方向鍵
- **術語卡**——作者可以幫每一步標註術語,點一下展開解釋,不佔版面
- **六種說明元件**——提示、常見誤解、待辦、外部連結、程式碼片段、差異比對
- **語法高亮跟著你的主題走**——用 Shiki,配色直接取自你當下的 VS Code 主題,不是寫死的色票。支援 23 種語言
- **Quiz 自測**——走完可以作答。每個選項都寫了為什麼對、為什麼錯,沒過會建議你重走一遍
- **失準偵測**——導讀寫的是某個時間點的程式碼,遲早會對不上。CodeWalk 會逐步核對:程式碼只是位移就自動跟上新行號,內容真的改了才標示失準,並且可以附上重新產生的指令
- **記住讀到哪**——關掉 VS Code 再開,列表上還能接續上次的進度

## `.codewalk.json` 格式

型別定義在 [`shared/schema.ts`](shared/schema.ts)。最小範例:

```json
{
  "title": "範例導讀",
  "ref": "<釘住的 commit sha>",
  "steps": [
    {
      "title": "入口檔案",
      "file": "src/index.ts",
      "startLine": 1,
      "endLine": 1,
      "narration": "這是程式的入口點。",
      "terms": [{ "term": "entry point", "explanation": "程式開始執行的地方" }]
    }
  ],
  "quiz": [
    {
      "question": "...",
      "options": ["A", "B"],
      "correctIndex": 0,
      "optionExplanations": ["為什麼 A 錯", "為什麼 B 對"]
    }
  ]
}
```

### 主要欄位

| 欄位 | 說明 |
|---|---|
| `ref` | 產出這份導讀時的 commit sha |
| `steps[].anchor` | 選填,但**很建議填**:產出當下那幾行的程式碼原文。有它才做得了失準偵測,沒有就只能靠 `ref` 粗略比對 |
| `quiz` | 至少 1 題。每題可以填 `optionExplanations`,長度要跟 `options` 一樣 |
| `passThreshold` | 過關題數,不填就是題數的簡單多數(5 題預設 3 題) |
| `regenerateHint` | 重新產生這份導讀的方式。偵測到失準時,面板會給一個複製按鈕 |

圖片放 `.codewalk/assets/`,用相對路徑引用。

### Markdown 支援

`narration` 這類敘述欄位吃一組**封閉的 markdown 子集**:行內程式碼、粗體、連結、無序/有序清單、二級小標 `##`。

其他語法(表格、圖片、程式碼區塊、`#` 和 `###` 以下的標題等等)一律**原樣顯示成純文字**,不會讓整份導讀讀不出來。標題、選項、術語名這類短欄位只吃行內三種。

哪個欄位屬於哪一級,[`shared/schema.ts`](shared/schema.ts) 各欄位的 JSDoc 有寫。

## 指令與快捷鍵

面板裡的方向鍵、`Home`、`Esc` 是 webview 自己監聽的,**不是 VS Code 的 keybinding**,所以在 `keybindings.json` 裡找不到,也不需要設定 when 條件——只要面板有焦點就會生效。

下面這四個是真正的 VS Code 指令,可以在指令面板搜尋,也可以自己綁快捷鍵:

| 指令 ID | 顯示名稱 | 用途 |
|---|---|---|
| `codewalk.openWalk` | CodeWalk: 開啟導讀 | 開啟(或聚焦)側邊面板 |
| `codewalk.nextStep` | CodeWalk: 下一步 | 前進一步,面板沒有焦點時也有效 |
| `codewalk.prevStep` | CodeWalk: 上一步 | 後退一步,面板沒有焦點時也有效 |
| `codewalk.revealCurrentStep` | CodeWalk: 回到本步專案位置 | 重新跳到目前這一步的程式碼 |

`nextStep` / `prevStep` 存在的理由是:你在編輯器裡改東西改到一半,想往下走一步又不想把手移回面板。綁個快捷鍵就能直接走。

在 `keybindings.json` 裡這樣綁:

```json
{ "key": "ctrl+alt+right", "command": "codewalk.nextStep" },
{ "key": "ctrl+alt+left",  "command": "codewalk.prevStep" }
```

CodeWalk 目前沒有任何設定項(`contributes.configuration` 是空的)——配色跟著你的編輯器主題走,其餘行為都由導讀檔本身決定。

## 常見問題

**面板說「找不到導讀檔案」**
確認 workspace 根目錄有 `.codewalk/`,而且裡面的檔案是 `.codewalk.json` 結尾。

**跳出「行號可能漂移」的警告**
你的 HEAD 跟導讀釘住的 `ref` 不一樣。如果導讀有填 `anchor`,CodeWalk 會改用逐步核對這種比較準的方式,這個警告就不會出現了。

**某一步標示「已與現行程式碼不符」**
那段程式碼是真的改了。面板會把產出當時的內容秀出來讓你對照,旁邊有按鈕可以開現行檔案。遇到這種情況建議重新產生導讀,不要手動去修行號——導讀本來就是可拋棄的東西。

**snippet 沒有顏色**
這個檔案的副檔名不在支援的 23 種語言裡。CodeWalk 寧可不上色也不猜——猜錯顏色比沒顏色更容易誤導人。

## 開發

```bash
pnpm install
pnpm watch        # 編譯監看
pnpm test         # Vitest 單元測試
pnpm typecheck    # tsc --noEmit
pnpm format       # Prettier 全專案格式化
pnpm package      # 打包成 codewalk.vsix
```

在 VS Code 按 `F5` 啟動 Extension Development Host 除錯。

本機安裝 VSIX:

```bash
pnpm package
code --install-extension codewalk.vsix
```

## 關於這個專案

CodeWalk 由個人維護,不是商業產品。

**回報問題** — 歡迎開 issue。我會盡量處理,但沒辦法保證回應時間。

**貢獻程式碼** — 送 PR 之前請先開 issue 討論方向。這個 repo 用 OpenSpec 管理行為規格,沒討論過的實作很可能跟既有規格衝突,難以合併。

## 授權

[MIT](LICENSE)
