# CLAUDE.md — CodeWalk(VS Code extension)

> 紀律:本檔 ≤120 行。指路,不藏內容——行為合約在 `openspec/specs/`,系統全貌在 `docs/modules/`,操作手冊在 skills。

## 專案

- **一句話**:互動式 codebase 導讀播放器——讀 `.codewalk/` 的 JSON,在 VS Code 側邊帶讀者逐步走 code(檔案跳轉、可收合術語註解、quiz 自測)
- **定位**:獨立產品,不綁 harness——extension 只認 `.codewalk.json` 開放格式;harness 的 explain-change 是產生器之一,任何 AI 或人手寫皆可產
- **階段**:MVP(純播放器)——「產生」按鈕(shell out `claude -p`)是二期;**MVP 期禁止把產生邏輯寫進 extension**

## 技術棧

| 項目 | 選型 |
|---|---|
| 語言 | TypeScript(strict) |
| 平台 | VS Code Extension API + webview |
| 打包 | esbuild({design 階段確認}) |
| 測試 | Vitest(單元);整合 {design 階段定:@vscode/test-electron 或手動驗證 checklist} |
| webview UI | {design 階段定:vanilla TS / Preact} |
| 套件 | pnpm |

**版本陷阱**(只列會踩的):

- webview 有 CSP:inline script 需 nonce,資源引用要走 `asWebviewUri`
- `vscode` API 只存在 extension host——webview 靠 postMessage 協定溝通,不能 import vscode
- {專案特有陷阱}

## 常用指令

```bash
pnpm watch        # 編譯監看
# F5 → Extension Development Host 除錯
pnpm test         # Vitest
pnpm package      # vsce 打包 VSIX({起手後補})
```

## 開發流程

**變更分級**:

- **重大**(新功能/行為變更/跨模組):`/opsx:new` → clarify → `/opsx:ff` → 人工審查 → apply → verify → archive → **`/sync-module-docs`**
- **小改**(不動任何 spec scenario):直接改,commit 記錄
- 判斷:「需要更新 spec 的 scenario 嗎?」需要=重大
- 開工起手用 `/kickoff`:自動找工項、載脈絡、組 grill-me 簡報(免問清單:`openspec/decisions.md`)
- 需求大或模糊:先跑 grill-me 壓實需求再 `/opsx:new`;修 bug 遵循 systematic-debugging(先根因後修復)

**tasks.md 開頭必標「建議開發方式」**(依 design 的元件類型):extension host 指令 / webview UI / 協定與 schema,對應可用的 skill 或直接實作。

**文件分工**:

| 問題 | 去處 |
|---|---|
| 這個功能的精確行為? | `openspec/specs/{capability}/spec.md` |
| 系統有哪些模組、功能全貌? | `docs/modules/README.md` |
| 為什麼當初這樣決定? | `openspec/changes/archive/` |
| 已定案的產品/技術規則(不再重問的前提)? | `openspec/decisions.md` |
| 格式與領域名詞的定義? | `docs/glossary.md` |
| 重複性操作怎麼做? | `.claude/skills/` |

## 設計原則

- 播放體驗優先:讀者的手不離方向鍵——上一步/下一步/跳 code 都要有快捷鍵
- webview 視覺跟隨編輯器主題(讀 VS Code CSS 變數),不自帶突兀配色
- {其餘 design 階段補}

## 架構慣例

- **分層(硬規則)**:extension host(`src/`:啟動、指令、檔案與編輯器操作)⇄ postMessage 協定(`shared/protocol.ts`,**訊息型別單一定義處**)⇄ webview(`ui/`:純前端,禁碰 vscode API)
- **`.codewalk.json` 格式=對外合約**:schema 住 `shared/schema.ts` 單點;欄位改名/刪除視同破壞性變更,必走 change
- 抽象門檻:rule of three——重複第三次才抽共用;單一實作不建 interface
- 架構決策(L3)用 architecture-advisor,結論寫進 design.md;結構健檢用 architecture-reviewer

## Git

- 遵循全域紀律:不主動 commit、絕不 push
- scope 慣例:host / ui / protocol / schema / docs
