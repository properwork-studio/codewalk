## Why

讀者在 quiz 結果頁只看得到「哪幾題錯了」與「正確答案是哪一個」,看不到**為什麼**——答錯的人不知道自己的誤解在哪,答對的人也無法確認自己是真懂還是猜中。這讓 quiz 停留在「計分」,沒有發揮「驗證理解」的作用,而驗證理解正是 CodeWalk 相對於靜態文件的存在理由。

導讀產生端(harness 的 explain-change skill)本來就要求「每個選項附為什麼對/為什麼錯的解釋」,但 `.codewalk.json` 格式沒有欄位可以承載這段內容,產生器只能把它丟掉。這是格式層面的缺口,現在補上。

## What Changes

- `CodewalkQuizQuestion` 新增**選填**欄位 `optionExplanations?: string[]`,索引對齊 `options`——第 i 個字串解釋第 i 個選項為什麼對或為什麼錯
- validator 新增規則:若有此欄位,必須是字串陣列、長度與 `options` 完全相同、每個元素非空字串;不符即載入失敗並回報錯誤
- quiz 結果頁在每題的作答結果底下,列出**所有**選項的解釋(不只讀者選的那一個),並標示出哪一個是正確選項
- 未提供 `optionExplanations` 的導讀,結果頁維持現狀(顯示你的答案、答錯時顯示正確答案),不出現任何空區塊
- 更新 `README.md` 的格式說明與 `docs/glossary.md` 的欄位定義
- 非 BREAKING:新欄位為選填,既有 `.codewalk.json` 不需修改即可繼續播放

## Capabilities

### New Capabilities

(無)

### Modified Capabilities

- `walk-player`:「Quiz 自測與回饋」requirement 擴充——結果頁除既有的分數、正確答案、重走建議之外,當導讀提供 `optionExplanations` 時 SHALL 顯示每個選項的解釋;新增載入階段對該欄位的格式驗證行為

## Impact

- `shared/schema.ts`:`CodewalkQuizQuestion` 型別 + `validateQuizQuestion()` 驗證邏輯(對外合約變更,新增選填欄位)
- `ui/render.ts`:`createQuizBreakdown()` 渲染每題的選項解釋
- `ui/theme.css`:解釋區塊的樣式(需與既有的正確/錯誤色系一致,且不與 pitfall/系統警告混淆)
- `shared/schema.test.ts`:新欄位的驗證測試
- `README.md`、`docs/glossary.md`:格式文件同步
- 不影響:extension host 端(`src/`)完全不需改動——這個欄位從 JSON 讀進來後原封不動隨 `walkLoaded` 送到 webview,host 不需要理解它

## 已定案決策

以下兩點在提案前已與使用者確認,不重新討論:

1. **欄位形狀用平行陣列**(`optionExplanations?: string[]`)而非把 `options` 改成物件聯集——加法式變更、舊 JSON 完全不受影響、validator 與 render 都不需要 normalize 層;索引錯位的風險由「長度必須相符」的驗證規則承擔
2. **結果頁顯示全部選項的解釋**,而非只顯示讀者選的那一個——答對的讀者也能從「為什麼其他選項錯」排除潛在誤解,符合 explain-change 的原始規範

## Out of Scope / Non-goals

- **不做**作答當下的即時回饋(選了就立刻顯示對錯與理由)——會讓 quiz 變成邊做邊學,失去一次作答完再驗收的自測意義
- **不做**每題的整體解釋欄位(`explanation`)——與選項解釋功能重疊,兩個都留會讓格式作者不知道該用哪一個
- **不做**解釋內容的 markdown 或連結渲染——維持純文字,與 `narration`、`term.explanation` 的處理一致
- **不改**既有的計分、過關門檻、重走建議等行為

## Open Questions

(無)
