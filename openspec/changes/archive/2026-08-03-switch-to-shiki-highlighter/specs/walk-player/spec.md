## MODIFIED Requirements

### Requirement: 視覺跟隨編輯器主題

webview SHALL 讀取 VS Code 目前主題的 CSS 變數渲染介面,不使用自帶的固定配色。此規範同時適用於**程式碼片段內部的 token 配色**——snippet 與 diff 的程式碼上色 SHALL 依當前主題的定義呈現,不使用與編輯器無關的固定色票。程式碼配色的完整行為(降級、主題切換重繪、語言判定)見 `syntax-highlighting` capability。

#### Scenario: 隨主題切換更新樣式

- **GIVEN** CodeWalk 面板已開啟並顯示中
- **WHEN** 讀者在 VS Code 切換淺色/深色主題
- **THEN** 面板樣式(背景、文字、強調色)隨之更新,不需重新載入面板

#### Scenario: 程式碼配色一併跟隨主題

- **GIVEN** CodeWalk 面板已開啟並顯示一個含 snippet 或 diff 的 step
- **WHEN** 讀者在 VS Code 切換佈景主題
- **THEN** 除面板介面樣式外,程式碼片段內的 token 配色一併更新為新主題的配色,不需重新載入面板
