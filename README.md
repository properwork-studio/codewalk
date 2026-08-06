# CodeWalk

互動式 codebase 導讀播放器——VS Code extension,讀取 `.codewalk/` 目錄下的 `*.codewalk.json` 導讀檔案,在側邊面板帶讀者逐步走過 code:步驟導覽、檔案行號跳轉、可收合術語註解、互動 quiz 自測。

> MVP 階段僅播放,不含產生功能。`.codewalk.json` 需另外準備(人工撰寫或用其他工具產生)。

## 開發

```bash
pnpm install
pnpm watch      # 編譯監看
```

在 VS Code 按 `F5` 啟動 Extension Development Host 除錯。

```bash
pnpm test       # Vitest 單元測試
pnpm typecheck  # tsc --noEmit
pnpm package    # 打包成 codewalk.vsix
```

## 安裝(VSIX 本地安裝)

```bash
pnpm package
code --install-extension codewalk.vsix
```

安裝後在 VS Code 左側活動列會出現 CodeWalk 圖示。

## 使用方式

1. 在你的 repo 根目錄建立 `.codewalk/` 目錄,放入符合格式的 `*.codewalk.json` 導讀檔案
2. 點擊活動列的 CodeWalk 圖示開啟側邊面板,或執行指令 `CodeWalk: 開啟導讀`
3. 面板會列出可用的導讀,選一個開始播放
4. 導覽操作:
   - `→` / `↓`:下一步
   - `←` / `↑`:上一步(需先讓 CodeWalk 面板取得焦點)
5. 每個步驟會自動跳轉並高亮對應的程式碼範圍,術語點擊可展開/收合說明
6. 走完最後一步後可進入 Quiz 自測;若答對題數低於過關門檻(預設為題數的簡單多數,也可在 `.codewalk.json` 用 `passThreshold` 指定),會建議重走本導讀或選擇更詳細版本
7. 若目前 workspace 的 HEAD 與導讀釘住的 commit 不同,面板會顯示「行號可能漂移」警告

## `.codewalk.json` 格式

型別定義見 `shared/schema.ts`。最小範例:

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

`quiz` 至少需要 1 題;可選填 `passThreshold`(答對題數門檻,省略時預設為題數的簡單多數,例如 5 題預設門檻是 3 題)。每題可選填 `optionExplanations`(字串陣列,索引需與 `options` 一一對應,長度必須相同),用來在結果頁列出每個選項為什麼對或為什麼錯;省略時結果頁維持只顯示你的答案與正確答案。圖解資產請放在 `.codewalk/assets/` 並以相對路徑參照。

### Markdown 支援

`narration` 等敘述欄位支援一個封閉的 markdown 子集(行內程式碼、粗體、連結、清單、二級小標 `##`),不支援的語法(表格、圖片、`#`/`###` 以下標題等)一律原樣顯示為純文字,不會中止載入。哪些欄位支援哪些語法、短欄位與長文欄位的差異,見 `shared/schema.ts` 各欄位的 JSDoc 註解。
