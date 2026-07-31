# decisions.md — 已定案(kickoff 組簡報的免問清單)

> 用途:`/kickoff` 組 grill-me 簡報時的「免問清單」來源——這裡的規則當前提,不重新拷問。

## 產品

- **播放器與產生器分離**:extension 只認 `.codewalk.json` 開放格式,產生邏輯住 harness 的 explain-change(或任何來源)——理由:產生需要 AI+repo 脈絡,播放需要 UI 自由度,混在一起兩頭壞
- **quiz 互動住 extension**:文件版做不到的互動正是本產品的存在理由之一
- MVP 只做播放;「產生」按鈕(shell out `claude -p`)是二期,出場條件:MVP 自用滿意後
- 發佈:先 VSIX 給自己人裝,Marketplace 上架等實際使用需求出現再說

## 技術

- 格式檔存目標 repo 的 `.codewalk/` 目錄,檔名帶日期(`YYYY-MM-DD-<主題>.codewalk.json`)
- **衍生快照紀律**:`ref` 釘產出當下 commit;播放時偵測 HEAD ≠ ref 顯示「行號可能漂移」警告;不維護、過期即刪
- 分層:extension host ⇄ postMessage 協定(單一定義)⇄ webview(禁碰 vscode API)
- schema 單點住 `shared/schema.ts`;格式變更視同破壞性 API 變更走 change
