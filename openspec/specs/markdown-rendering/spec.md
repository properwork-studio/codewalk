# markdown-rendering

## Purpose

導讀內容中 Markdown 語法的呈現行為合約——哪些欄位支援哪些語法、不支援語法的降級方式、內嵌連結的開啟方式與安全邊界、換行與行內程式碼的呈現規則。讓內容作者可在敘述欄位使用常見 Markdown 語法排版,同時確保未支援或格式錯誤的語法不會中斷導讀播放。

## Requirements

### Requirement: 長文敘述欄位的 Markdown 呈現

系統 SHALL 將長文敘述欄位的內容依下列六種 markdown 語法呈現:行內程式碼(`` ` ``)、粗體(`**`)、連結(`[文字](網址)`)、無序清單(`-`)、有序清單(`1.`)、二級小標(`##`)。長文敘述欄位為:`narration`、`term.explanation`、`tip.text`、`todo.text`、`pitfall.misconception`、`pitfall.reality`、`quiz.optionExplanations[]`。清單 SHALL 支援巢狀縮排,巢狀項目以可辨識的層級呈現。

#### Scenario: 呈現行內程式碼與粗體

- **GIVEN** 某 step 的 `narration` 內容為「這份格式是 `` `.codewalk.json` `` 的 **對外合約**」
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將 `.codewalk.json` 以行內程式碼樣式呈現、將「對外合約」以粗體呈現,且兩者的標記符號(反引號、星號)本身不顯示在畫面上

#### Scenario: 呈現無序與有序清單

- **GIVEN** 某 step 的 `narration` 含一段以 `-` 開頭的連續三行,以及一段以 `1.`、`2.`、`3.` 開頭的連續三行
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將前者呈現為無序清單、後者呈現為有序清單,各項目有一致的縮排與項目標記,且來源的 `-`、`1.` 等標記字元本身不重複顯示為內文

#### Scenario: 呈現巢狀清單

- **GIVEN** 某 step 的 `narration` 含一個清單,其中某一項底下有縮排的子項目
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將子項目呈現為巢狀層級,與其父項目在視覺上可分辨層級關係

#### Scenario: 呈現二級小標

- **GIVEN** 某 step 的 `narration` 含一行以 `## ` 開頭的文字
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將該行呈現為小標樣式,字級明顯小於步驟標題,`##` 標記字元本身不顯示

#### Scenario: 其他長文欄位一致適用

- **GIVEN** 某 step 的 `term.explanation` 與某 `tip.text` 各含行內程式碼與清單
- **WHEN** 讀者展開該術語註解並瀏覽該提示
- **THEN** 兩者的 markdown 語法皆比照 `narration` 呈現,不因欄位不同而有差異

### Requirement: 短欄位僅呈現行內語法

系統 SHALL 在短欄位僅呈現行內語法(行內程式碼、粗體、連結),清單與小標這類區塊語法在短欄位 SHALL 原樣顯示為純文字。短欄位為:`quiz.question`、`quiz.options[]`、`item.label`、`term.term`、`walk.title`、`step.title`。

#### Scenario: quiz 題目呈現行內程式碼

- **GIVEN** 某題 quiz 的 `question` 為「下列哪個描述 `` `resolvePassThreshold` `` 的行為?」
- **WHEN** 讀者進入 quiz 畫面
- **THEN** 系統將 `resolvePassThreshold` 以行內程式碼樣式呈現,反引號本身不顯示

#### Scenario: 短欄位中的區塊語法不生效

- **GIVEN** 某 `item.label` 的內容為「- 項目」,某 `step.title` 的內容為「## 標題」
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將兩者原樣顯示為包含 `- ` 與 `## ` 字元的純文字,不呈現為清單或小標,版面不因此破壞

### Requirement: 不支援的語法原樣呈現為純文字

系統 SHALL 將不屬於支援清單的一切 markdown 語法原樣顯示為純文字,SHALL NOT 因此中止載入、跳過該欄位、或影響同一欄位其餘內容與同一份導讀其他部分的呈現。此規則涵蓋表格、圖片、引用區塊、程式碼區塊(```)、刪除線、斜體(`_` 與 `*` 單星號)、`#` 與 `###` 以下階層的標題、原始 HTML,以及本系統未支援的任何其他語法。

#### Scenario: 表格與引用區塊原樣顯示

- **GIVEN** 某 step 的 `narration` 含一段 markdown 表格語法與一行以 `>` 開頭的引用語法
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將兩者的原始字元原樣顯示為純文字,不呈現為表格或引用區塊,該 step 其餘內容正常呈現

#### Scenario: 原始 HTML 不被當作標記解讀

- **GIVEN** 某 step 的 `narration` 含 `<img src=x onerror=alert(1)>` 這段文字
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將該段字元原樣顯示為可見的純文字,SHALL NOT 將其解讀為 HTML 元素、SHALL NOT 載入任何外部資源、SHALL NOT 執行其中的任何程式碼

#### Scenario: 不支援的標題階層與支援的階層並存

- **GIVEN** 某 step 的 `narration` 同時含一行 `# 一級標題` 與一行 `## 二級標題`
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將 `## 二級標題` 呈現為小標,並將 `# 一級標題` 原樣顯示為包含 `# ` 字元的純文字

#### Scenario: 格式錯誤不影響導讀可播放性

- **GIVEN** 某 step 的 `narration` 含一段未閉合的粗體標記或格式殘缺的連結語法
- **WHEN** 讀者載入並瀏覽該導讀
- **THEN** 系統正常載入該導讀、顯示該 step,將無法解析的部分原樣顯示為純文字,不顯示錯誤訊息、不中止播放

### Requirement: 內嵌連結的開啟方式與安全邊界

系統 SHALL 讓敘述欄位中網址為 http 或 https 的內嵌連結顯示為可點擊元素(顯示文字為連結語法中的文字部分);讀者點擊後系統 SHALL 以作業系統預設瀏覽器開啟該網址,CodeWalk 面板本身 SHALL NOT 導航離開目前畫面——行為與 `walk-player` capability 的「外部連結參考」requirement 一致。網址不是 http 或 https 的內嵌連結,系統 SHALL NOT 顯示為可點擊元素,而是將整段連結語法原樣顯示為純文字。

#### Scenario: 點擊內嵌連結開啟外部瀏覽器

- **GIVEN** 某 step 的 `narration` 含 `[VS Code 文件](https://code.visualstudio.com)`
- **WHEN** 讀者點擊該連結
- **THEN** 系統以外部瀏覽器開啟該網址,CodeWalk 面板維持在目前 step,不導航離開

#### Scenario: 非 http/https 的內嵌連結不可點擊

- **GIVEN** 某 step 的 `narration` 含 `[點我](command:workbench.action.terminal.new)` 或 `[點我](javascript:alert(1))`
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將整段連結語法原樣顯示為純文字,該處 SHALL NOT 可點擊,SHALL NOT 觸發任何指令或導航行為

### Requirement: 段落內換行維持斷行呈現

系統 SHALL 讓敘述欄位中同一段落內的單一換行維持為斷行呈現,SHALL NOT 將前後兩行合併為同一行。空行 SHALL 作為區塊之間的分隔。

#### Scenario: 單一換行斷行

- **GIVEN** 某 step 的 `narration` 含連續兩行文字,兩行之間只有一個換行、沒有空行
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將兩行分別顯示在不同行,不合併為同一行

#### Scenario: 空行作為區塊分隔

- **GIVEN** 某 step 的 `narration` 含兩段文字,中間以一個空行分隔
- **WHEN** 讀者瀏覽該 step
- **THEN** 系統將兩段呈現為分離的區塊,段落之間有一致的間距,且該間距不隨來源中連續空行的數量增加而累加

### Requirement: 行內程式碼與周圍敘述的視覺區隔

系統 SHALL 讓行內程式碼以與周圍敘述文字可辨識區隔的樣式呈現,至少包含等寬字體與底色。該樣式 SHALL 取自編輯器目前主題,不使用與主題無關的固定色票;主題切換時 SHALL 一併更新,不需重新載入面板。

#### Scenario: 行內程式碼與周圍文字可分辨

- **GIVEN** 某 step 的 `narration` 為中文敘述句中夾帶一段行內程式碼
- **WHEN** 讀者瀏覽該 step
- **THEN** 該段程式碼以等寬字體與底色呈現,與周圍中文敘述在視覺上可分辨

#### Scenario: 隨主題切換更新

- **GIVEN** CodeWalk 面板已開啟並顯示含行內程式碼的 step
- **WHEN** 讀者在 VS Code 切換淺色/深色主題
- **THEN** 行內程式碼的底色與文字色一併更新為新主題的配色,不需重新載入面板
