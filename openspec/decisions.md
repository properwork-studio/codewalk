# decisions.md — 已定案(kickoff 組簡報的免問清單)

> 用途:`/kickoff` 組 grill-me 簡報時的「免問清單」來源——這裡的規則當前提,不重新拷問。

## 產品

- **播放器與產生器分離**:extension 只認 `.codewalk.json` 開放格式,產生邏輯住 harness 的 explain-change(或任何來源)——理由:產生需要 AI+repo 脈絡,播放需要 UI 自由度,混在一起兩頭壞
- **quiz 互動住 extension**:文件版做不到的互動正是本產品的存在理由之一
  - **但現階段不升為產品核心主張**(2026-08-15,取代「要不要升」的懸而未決)——quiz 確實是唯一無人佔位的差異化點(競品分析掃了 14 個對象,零個有自測機制),但**個人使用情境下它不該有強制性**,而沒有強制性的東西撐不起「第一句話」。**出場條件:團隊版本**——屆時通過率與分數可以當成驗收 KPI(誰讀過、讀懂沒有),quiz 才從「功能」變成「主張」。在那之前定位不變:**對送審的作者是紀律,對 reviewer 是選配**(見 `docs/future-work.md` 第 4 項),README 第一句維持現狀不動
- MVP 只做播放;「產生」按鈕(shell out `claude -p`)是二期,出場條件:MVP 自用滿意後
  - **注意「錄製」不等於「產生」**:產生是 AI 讀 diff 自動寫出導讀,錄製是人手動選一段程式碼寫敘述、不涉及 AI。上面那條禁的是產生;錄製是另一個決策,評估見 `docs/future-work.md`(含格式合約的時機問題——若要做錄製,`.codewalk.json` 很可能得加欄位,而使用者數是 0 的現在改它沒有成本)
- **發佈已定案**(2026-08-07,取代原本「等實際使用需求出現再說」):走 Marketplace 公開發佈,上架欄位已備齊
  - **publisher `properworkstudio`**,extension 完整識別碼 `properworkstudio.codewalk-reader`——**註冊後永久不可改**,它會出現在安裝指令與所有外部連結裡
  - **MIT 授權**:VS Code extension 生態的預設(含 VS Code 本身);Apache 2.0 的主要優勢是明文專利授權與報復條款,本專案沒有專利也不打算申請,用不上那份長度
  - **repo public**:`.codewalk.json` 定位為開放格式,要讓別人寫產生器就得有參考實作;附帶條件是 marketplace 頁面的圖片由 vsce 轉成 GitHub raw URL,**repo 沒推上去或不是 public,README 的圖就會破**
  - **Cursor 走 Open VSX**(open-vsx.org):Cursor 不能用微軟 Marketplace(ToS 只授權自家產品),需另外註冊 Eclipse 帳號並簽 Publisher Agreement,同一份 VSIX 可雙推
  - **介面語言:雙語 l10n,隨 VS Code 顯示語言切換**(2026-08-08,`add-interface-localization` change 定案,取代原本「繁中優先、英文版後補」)——理由不變:評分會累積,補了英文介面也不會消失;現在使用者數是 0、repo 還沒推,改的成本是現在最低的時候,不留到「有人要之後」。機制:`shared/i18n.ts` 的 `t()`/`setLocale()`/`resolveLocale()` 供 host 與 webview 共用(兩份獨立 bundle,各自呼叫 `setLocale()`),manifest 文案另走 VS Code 強制的 `package.nls.json`(英文預設)+ `package.nls.zh-tw.json`(繁中覆蓋)。判定規則:`vscode.env.language` 前綴為 `zh` 一律繁中,其餘英文。`.codewalk.json` 的導讀內容(`narration`/`title`/quiz 等)不受影響,語言由作者決定——見 `docs/glossary.md`「介面語言」與「導讀內容語言」的區分

## 技術

- 格式檔存目標 repo 的 `.codewalk/` 目錄,檔名帶日期(`YYYY-MM-DD-<主題>.codewalk.json`)
- **衍生快照紀律**:`ref` 釘產出當下 commit;播放時偵測 HEAD ≠ ref 顯示「行號可能漂移」警告;不維護、過期即刪
- 分層:extension host ⇄ postMessage 協定(單一定義)⇄ webview(禁碰 vscode API)
- **agent 橋接走 MCP,不走 Language Model Tools**(2026-08-15)——決定性理由是 **Cursor**:它原生支援 MCP,但很可能不吃 VS Code 的 `languageModelTools` 貢獻點(它用自己的 agent,沒有實作 chat participant 生態),而 Cursor 是已經雙推 Open VSX 明確支援的目標。次要理由:MCP 同時涵蓋終端機 agent、CodeGraph/DeepWiki 在同一層對話、PR Review 註記(`docs/future-work.md` 第 4 項)可共用同一條管線
  - **但「從面板框選一段去問 AI」不靠 MCP,靠 `workbench.action.chat.open`**——這是最容易搞混的地方。MCP 決定的是 *agent 能拉到什麼*,不是 *面板怎麼開口*。開口一律是 VS Code 命令(Cursor 2.3+ 才有,且只填入不自動送出,故一律 `isPartialQuery: true` 讓兩邊行為一致;命令不存在時退回剪貼簿)
  - **MCP push 是加分不是前提**:`notifications/claude/channel` 是 Claude 專屬的實驗性能力。設計上把 **pull 當基本盤**(agent 呼叫 `codewalk_current_step` 是標準 MCP,永遠可用),push 只省掉讀者一次提問——這樣 channel 若消失是退化不是壞掉
- schema 單點住 `shared/schema.ts`;格式變更視同破壞性 API 變更走 change
- **檔案組織已查過,結論如下**(2026-08-07,依賴圖與變更頻率實測)——依賴方向乾淨(`shared/` 只依賴自己、`src/` 與 `ui/` 各自依賴 `shared/`,**無 src↔ui 互依、無循環**),三層架構守住了,所以「檔案看起來散亂」是視覺問題不是結構病,兩者處方不同:
  - **測試維持 co-located**(`foo.ts` 與 `foo.test.ts` 並排),不移到 `tests/` 鏡像目錄——改 A 檔時測試就在旁邊、重新命名時跟著走,是 Vitest/Jest 生態主流;移走要改 19 個測試的 import 成 `../../src/foo`,換來的只有「原始碼目錄看起來乾淨」。`explorer.fileNesting` **實測過但不採用**(2026-08-07,不合偏好已回復)——co-located 的決定不因此動搖:視覺整潔不值得拿結構去換,也不必再繞回去試一次。例外:不對應任何原始檔的測試住 `tests/`(如 `repoWalks.test.ts` 驗的是 `.codewalk/` 資料而非某支程式),搬動時**記得 `tsconfig.json` 的 include 要同步**——`vitest` 走 esbuild 轉譯不做型別檢查,漏掉 include 會讓該目錄安靜地脫離 `pnpm typecheck`
  - **不依功能分組**(`walk/`、`anchor/`、`storage/` 這類子目錄)——**出場條件:單一目錄超過 20 個原始檔**(`src/` 現為 13,future-work 的三個功能做完估 18-20,接近但未超過)。理由不只是規模:`viewProvider.ts` import 了 11 個模組,walk/anchor/storage/editor/theme 它全碰,**放哪一組都不對**,因為它就是 orchestrator。分組邊界會吵這件事已經驗證過,不必重推
  - **`ui/render.ts` 依畫面拆分**(916 行,是第二名 `main.ts` 447 行的 2 倍;變更頻率全 repo 最高 9 次;單一 change 內曾增加 378 行)——高頻變更 × 超大檔案是最痛的組合。拆成 `ui/render/{dom,fileList,items,walking,quiz}.ts` 加 `index.ts` re-export(呼叫端 import 不用改),分界對應 `ui/state.ts` 的四個畫面狀態,命名有現成語彙。`ui/main.ts` 447 行**不拆**:職責單一(訊息路由+render 迴圈+事件監聽),且碰 DOM 全域、拆了也不好測
- **導讀列表載入不是效能問題,不再重開**(2026-08-04 實測,`Promise.all` 並行版):5 份 0.37 ms、50 份 2.4 ms、100 份 4.8 ms、500 份 25 ms——100 份仍低於一個 60fps 影格,讀者感知不到。衍生三條:
  - **不做部分解析**:`validateCodewalk` 只花 0.005 ms(是 `JSON.parse` 0.027 ms 的 1/5),且 title/ref 本來就得 parse 才拿得到。完全跳過驗證的理論上限是省 6%(50 份省 0.15 ms)——不值得動搖 spec 「列出符合 schema 的檔案」的判定時機
  - **不做列表快取**:會憑空生出「改了檔案後列表多久更新」這個新的可觀察行為,換取本來就不存在的收益
  - **真要查開面板變慢,先看 `dist/webview.js`**(2.6 MB,Shiki 帶 30+ 語言),它比 `listWalkFiles` 高一到兩個數量級——已查,見下條

- **webview bundle 已查過,結論如下(2026-08-04 實測)**——`dist/webview.js` 2.6 MB 的組成、成本與可行手段都已量過,不必重新調查;目前**決定不動**:
  - **組成**:Shiki 語言 grammar 佔 **92.2%**(2374 KB),Shiki 核心+regex 引擎 4.7%,自家 `ui/`+`shared/` 只有 21 KB(0.8%)。`ui/highlight.ts` 宣告 23 個語言,bundle 內實際有 **33 個** grammar(多出 `cpp-macro`、`glsl`、`jsx`、`tsx`、`graphql`、`haml`、`lua`、`regexp`、`shellscript`、`xml` 等傳遞相依)
  - **主因是 `ruby`**:`ruby.mjs` import `cpp.mjs`(489 KB),`cpp` 再拉 `cpp-macro`(278 KB)與 `glsl`——**一個 Ruby 帶進整包的 30%**。注意「只砍 cpp」或「砍 cpp+c」完全無效(bundle 仍 2553 KB),ruby 會把它拉回來
  - **各語言集實測**(bundle / `createHighlighterCore` / 到首次上色):23 全部 2553 KB / 78 ms / 173 ms;僅去 ruby 2122 KB / **31 ms** / 125 ms;去 ruby+cpp+c 1274 KB / 24 ms / 114 ms;13 常見 920 KB / 14 ms / 101 ms;8 核心 742 KB / 9 ms / 97 ms
  - **嚴重度低於帳面**:高亮**不擋首次繪製**——`ui/main.ts` 的 `onHighlightReady` 是就緒後補一次重繪,snippet 在那之前已以純文字顯示。症狀是「程式碼先無色、約 170 ms 後上色」的閃動,不是面板延遲出現
  - **約 71 ms 砍不掉**:首次 `codeToTokens` 要編譯 TypeScript grammar 的 regex,與註冊幾個語言無關(上列五組全是 71 ms 上下)。所以 173 ms 的最佳情況只到約 97 ms;穩定後每次 `codeToTokens` 僅 0.17 ms
  - **`@shikijs/langs-precompiled` + `createJavaScriptRawEngine` 已排除**:反而更糟——模組求值 25 ms → **208 ms**(巨大 precompiled regex 實字在求值時全部編譯),總計 336 ms vs 177 ms,bundle 還從 2553 KB 漲到 2775 KB
  - **未定**:要不要縮減支援語言清單。真正的分水嶺在 13 個常見語言,而 `dart`/`groovy`/`scala`/`kotlin`/`swift` 值不值得留是**產品決策**。且動 `shared/language.ts` 的副檔名對應會命中 syntax-highlighting spec 的「依檔案副檔名判定語言」requirement,是可觀察行為變更,**必須走 change,不是小改**

- **導讀檔視為含程式碼片段的文件**(2026-08-04,stale-step-detection change 定案):`anchor`(step/snippet 引用範圍的逐字原文)與既有的 `diffText` 都是原始碼的逐字複製,`.codewalk.json` 自此不再只是「敘述+行號」,而是連同一份程式碼快照。同一 repo 內零額外暴露(git 本來就無檔案層級權限,能 clone 就能讀到同樣內容);風險只在**人為單獨分享**這份檔案時成立(workshop、貼進 issue/Slack、獨立 docs repo 等),分享前應比照原始碼的敏感度判斷,**MVP 不為此設計脫敏或遮蔽機制**
- **spec 書寫慣例:scenario 引號內的文案指涉繁中介面的對應元素**(2026-08-08,`add-interface-localization` change 定案)——`openspec/specs/` 既有大量 scenario 以中文引號指涉 UI 元素(如「返回列表」「找不到檔案」),雙語化後這些引號**不代表該處只能顯示這個字串**,而是指「繁體中文介面下顯示這段文字的那個元素」,英文介面為其譯文。spec 本身不因此重寫——spec 是行為合約,不規範自己的書寫方式;只有規範**顯示字串本身**的 requirement(如 `walk-player` 的「作答時間的相對顯示」)才需要在正文明確拆出語言中立的判定與各語言的對應輸出
- **格式化紀律**(2026-08-04):專案已裝 Prettier(`.prettierrc.json`、singleQuote/printWidth 110/trailingComma all)並設定 VS Code format-on-save 使用同一套規則;AI 或人手改完 `.ts` 檔收工前務必跑 `pnpm format`,讓「已提交的排版」與「讀者存檔時觸發的排版」保持冪等——否則讀者一存檔,`git diff` 會混進大量無意義的排版變動,連帶讓 `anchor` 逐字比對誤判成內容改動(見 stale-step-detection capability)
