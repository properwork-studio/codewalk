## Why

新人或審查者理解陌生 codebase,目前只能自己啃 diff 或聽別人口頭講解——步驟無法重複執行、術語解釋留不下來、也沒有自測機制確認真的看懂。CodeWalk 要提供一個讀取 `.codewalk/` 導讀 JSON 的 VS Code 側邊播放器,把「帶讀 code」變成可重複執行、可互動自測的產品體驗。

## What Changes

- 新增 VS Code extension:讀取 `.codewalk/*.codewalk.json`,在側邊面板逐步導覽——步驟導覽、檔案行號跳轉、可收合術語註解
- 新增互動 quiz:每個 walk 結束可自測,答對 <3/5 時顯示「建議重走或選更詳細版本」提示
- 新增 ref 漂移偵測:`.codewalk.json` 的 `ref` 釘住產出當下 commit,播放時偵測目前 HEAD ≠ ref 就顯示「行號可能漂移」警告
- 新增 `.codewalk.json` 開放格式 schema,單點定義於 `shared/schema.ts`,作為對外合約(欄位改名/刪除視同破壞性變更)
- 視覺與操作:webview 視覺跟隨編輯器主題色(讀 VS Code CSS 變數);導覽操作以快捷鍵為主,讀者手不離方向鍵
- 發佈:MVP 僅產出 VSIX 供本地安裝,不上 Marketplace

**Out of Scope(MVP)**
- 產生功能(shell out `claude -p` 產生 `.codewalk.json`)——二期功能,MVP 期禁止把產生邏輯寫進 extension
- VS Code Marketplace 上架、多語系、JetBrains 支援
- tour 錄製 UI(屬於產生器,不是播放器)
- 編輯既有 tour 的 UI(改 JSON 檔即可,不做圖形化編輯)

## Capabilities

### New Capabilities
- `walk-player`:側邊面板播放 `.codewalk/` 導讀 JSON 的核心互動能力——步驟導覽、檔案行號跳轉、可收合術語註解、互動 quiz、ref 漂移警告

### Modified Capabilities
（無——全新產品,尚無既有 capability)

## Impact

- 全新專案,新增三層架構:`src/`(extension host:啟動、指令、檔案與編輯器操作)、`ui/`(webview,禁碰 vscode API)、`shared/`(postMessage 協定 + `.codewalk.json` schema 單點定義)
- 新增打包流程:esbuild 編譯 + vsce 打包 VSIX
- 不影響任何既有系統(獨立新產品,不綁 harness)

## Open Questions

以下未決事項留待 `clarify.md` 處理,不在本提案中預先假設答案:
- webview UI 技術:vanilla TS 或 Preact?(傾向 vanilla,理由是 MVP 元件少)
- schema 細節:step 錨定用單行 `line` 還是範圍 `selection`?術語註解是 step 內嵌還是全域字典?熟悉度層級要不要進格式?
- 要不要做 CodeTour `.tour` 匯入相容?(生態借力 vs 範圍蔓延)
- 整合測試策略:`@vscode/test-electron` 的成本值不值,或 MVP 用手動驗證 checklist?
- 圖解資產(直覺章節的圖)怎麼帶:相對路徑進 `.codewalk/assets/`?
