#!/usr/bin/env bash
#
# 錄製 CodeWalk 示範影片(README 的 demo.gif 與手機用 MP4 都從這支的輸出轉檔)。
#
# 做法:用一個暫時的 VS Code profile(--user-data-dir + --extensions-dir 指到
# 暫存資料夾)開一個乾淨的視窗、從 Marketplace 裝 CodeWalk,再用 URI 開示範導讀、
# 用 osascript 送方向鍵往下走,screencapture 只錄視窗範圍。
# 字體放大、隱藏側欄等設定只寫進暫時 profile,**完全不碰你自己的 settings.json**;
# 結束(含中途失敗或 Ctrl-C)時關掉該視窗並刪除暫存資料夾。
#
# 用法:
#   scripts/record-demo.sh             正式錄影,輸出 ~/Desktop/codewalk-demo.mov
#   scripts/record-demo.sh --dry-run   不錄影,每一步截圖到 $SHOT_DIR 供檢查
#
# 可用環境變數覆寫:WALK、OUT、SHOT_DIR、WIN_X/WIN_Y/WIN_W/WIN_H、
# TERM_X/TERM_Y(要點開的名詞解釋)、QUIZ_X/QUIZ_Y(Start quiz 按鈕)——
# 座標都是相對於視窗左上角的 point,換了導讀內容或視窗大小就要重新量。
#
# 前提:macOS;執行這支腳本的終端機需要「輔助使用」與「螢幕錄製」權限;
# 錄影前請開「專注模式」擋掉系統通知。

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WALK="${WALK:-.codewalk/2026-11-11-how-codewalk-works-en.codewalk.json}"
OUT="${OUT:-$HOME/Desktop/codewalk-demo.mov}"
SHOT_DIR="${SHOT_DIR:-$HOME/Desktop/codewalk-demo-shots}"
EXT_ID="properworkstudio.codewalk-reader"

WIN_X="${WIN_X:-144}"
WIN_Y="${WIN_Y:-100}"
WIN_W="${WIN_W:-1440}"
WIN_H="${WIN_H:-900}"
SASH_FROM="${SASH_FROM:-360}" # 側欄右緣(預設寬度)
SASH_TO="${SASH_TO:-600}"     # 拖寬後的側欄右緣
PANEL_SCROLL_X="${PANEL_SCROLL_X:-300}"
TERM_SCROLL="${TERM_SCROLL:-0}" # 第 5 步點名詞解釋前,面板往下捲幾格
QUIZ_SCROLL="${QUIZ_SCROLL:-0}" # 第 6 步點 Start quiz 前,面板往下捲幾格
TERM_X="${TERM_X:-216}"
TERM_Y="${TERM_Y:-670}"
QUIZ_X="${QUIZ_X:-89}"
QUIZ_Y="${QUIZ_Y:-824}"

STEP_PAUSE=2.5 # 每一步停留秒數
FIRST_PAUSE=3  # 第一步多停一下,讓觀眾看清楚畫面配置

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

PROFILE="$(mktemp -d -t codewalk-demo)"
CODE_ARGS=(--user-data-dir "$PROFILE/data" --extensions-dir "$PROFILE/ext")
CODE_PID=""
REC_PID=""

cleanup() {
  if [[ -n "$REC_PID" ]] && kill -0 "$REC_PID" 2>/dev/null; then
    kill -INT "$REC_PID" 2>/dev/null || true
    wait "$REC_PID" 2>/dev/null || true
  fi
  if [[ -n "$CODE_PID" ]] && kill -0 "$CODE_PID" 2>/dev/null; then
    kill "$CODE_PID" 2>/dev/null || true
    sleep 1
  fi
  rm -rf "$PROFILE"
}
trap cleanup EXIT

log() { printf '[record-demo] %s\n' "$*"; }

# ---- 暫時 profile 的設定:只存在 $PROFILE,結束即刪 ----
mkdir -p "$PROFILE/data/User" "$PROFILE/ext"
cat >"$PROFILE/data/User/settings.json" <<'JSON'
{
  "window.zoomLevel": 2,
  "window.restoreWindows": "none",
  "window.commandCenter": false,
  "window.title": "CodeWalk",
  "workbench.colorTheme": "Default Dark Modern",
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "workbench.statusBar.visible": false,
  "workbench.activityBar.location": "hidden",
  "workbench.layoutControl.enabled": false,
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  "workbench.editor.empty.hint": "hidden",
  "workbench.editor.showTabs": "single",
  "editor.minimap.enabled": false,
  "editor.stickyScroll.enabled": false,
  "editor.hover.enabled": false,
  "editor.cursorBlinking": "solid",
  "editor.renderWhitespace": "none",
  "editor.wordWrap": "on",
  "breadcrumbs.enabled": false,
  "chat.disableAIFeatures": true,
  "security.workspace.trust.enabled": false,
  "extensions.ignoreRecommendations": true,
  "extensions.autoCheckUpdates": false,
  "git.openRepositoryInParentFolders": "never",
  "update.mode": "none",
  "telemetry.telemetryLevel": "off"
}
JSON

# ---- 滑鼠小工具(macOS 沒有內建的點擊指令;用 CGEvent,免裝 cliclick)----
cat >"$PROFILE/mouse.swift" <<'SWIFT'
import CoreGraphics
import Foundation
let a = CommandLine.arguments
let p = CGPoint(x: Double(a[2])!, y: Double(a[3])!)
func post(_ t: CGEventType) {
  CGEvent(mouseEventSource: nil, mouseType: t, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
}
switch a[1] {
case "click":
  post(.mouseMoved); usleep(150_000); post(.leftMouseDown); usleep(80_000); post(.leftMouseUp)
case "scroll": // 在 p 位置往下捲 a[4] 次,每次 a[5] 行
  post(.mouseMoved)
  for _ in 0..<Int(a[4])! {
    CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 1, wheel1: -Int32(a[5])!, wheel2: 0, wheel3: 0)?.post(tap: .cghidEventTap)
    usleep(30_000)
  }
case "drag": // 從 p 拖到 (a[4], a[5])
  let q = CGPoint(x: Double(a[4])!, y: Double(a[5])!)
  post(.mouseMoved); usleep(100_000); post(.leftMouseDown); usleep(100_000)
  for i in 1...20 {
    let t = Double(i) / 20
    let m = CGPoint(x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t)
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: m, mouseButton: .left)?.post(tap: .cghidEventTap)
    usleep(15_000)
  }
  CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: q, mouseButton: .left)?.post(tap: .cghidEventTap)
default:
  post(.mouseMoved)
}
SWIFT
swiftc -O -o "$PROFILE/mouse" "$PROFILE/mouse.swift" 2>/dev/null
mouse() { "$PROFILE/mouse" "$1" "$(($WIN_X + $2))" "$(($WIN_Y + $3))" "${@:4}"; }
park_mouse() { "$PROFILE/mouse" move "$(($WIN_X + $WIN_W + 40))" "$(($WIN_Y + $WIN_H / 2))"; }
# 在面板內捲動:用滑鼠滾輪(方向鍵被面板拿去切步驟了)
scroll_panel() { mouse scroll "$PANEL_SCROLL_X" 450 "$1" 2; }

key() { osascript -e "tell application \"System Events\" to key code $1"; }
focus_code() {
  osascript -e "tell application \"System Events\" to set frontmost of (first process whose unix id is $CODE_PID) to true"
}
shot() { [[ $DRY_RUN == 1 ]] && screencapture -x -R "$WIN_X,$WIN_Y,$WIN_W,$WIN_H" "$SHOT_DIR/$1.png" || true; }
hold() { sleep "$1"; }

# ---- 開 VS Code ----
log "安裝 $EXT_ID 到暫時 profile…"
code "${CODE_ARGS[@]}" --install-extension "$EXT_ID" >/dev/null

log "開啟 VS Code…"
code "${CODE_ARGS[@]}" --new-window "$REPO"
for _ in $(seq 1 60); do
  CODE_PID="$(pgrep -f "MacOS/Code .*$PROFILE/data" | head -1 || true)"
  [[ -n "$CODE_PID" ]] && break
  sleep 0.5
done
[[ -n "$CODE_PID" ]] || { log "找不到 VS Code 程序"; exit 1; }

for _ in $(seq 1 60); do
  n="$(osascript -e "tell application \"System Events\" to count windows of (first process whose unix id is $CODE_PID)" 2>/dev/null || echo 0)"
  [[ "$n" -ge 1 ]] && break
  sleep 0.5
done

osascript <<OSA
tell application "System Events"
  set p to first process whose unix id is $CODE_PID
  set frontmost of p to true
  set position of window 1 of p to {$WIN_X, $WIN_Y}
  set size of window 1 of p to {$WIN_W, $WIN_H}
end tell
OSA
sleep 4 # 等 extension host 起來

log "開啟示範導讀 $WALK"
code "${CODE_ARGS[@]}" --open-url "vscode://$EXT_ID/open?walk=$WALK&step=0"
sleep 3
focus_code
sleep 0.5
# VS Code 對外部開啟的 URI 會先跳「Allow ... to open this URI?」確認框,預設按鈕是 Open;
# 在開始錄影前按 Enter 接受,影片裡就不會出現這個框
key 36 # Return
sleep 4
# 側欄拖寬,讓敘述、名詞解釋和按鈕放得下
mouse drag "$SASH_FROM" 500 "$(($WIN_X + $SASH_TO))" "$(($WIN_Y + 500))"
sleep 1
# 游標移出視窗範圍,避免停在畫面中間
park_mouse

# ---- 錄影 ----
if [[ $DRY_RUN == 1 ]]; then
  mkdir -p "$SHOT_DIR"
  log "試跑模式:截圖輸出到 $SHOT_DIR"
else
  rm -f "$OUT"
  screencapture -v -R "$WIN_X,$WIN_Y,$WIN_W,$WIN_H" "$OUT" &
  REC_PID=$!
  sleep 1
  log "錄影中…"
fi

shot step1
hold "$FIRST_PAUSE"
for i in 2 3 4 5 6; do
  key 124 # →
  hold 0.4
  shot "step$i"
  if [[ $i == 5 ]]; then
    hold 1.2
    scroll_panel "$TERM_SCROLL"
    hold 0.4
    shot step5-scrolled
    mouse click "$TERM_X" "$TERM_Y" # 點開 anchor 名詞解釋
    hold 0.3
    park_mouse # 點完就把游標移出畫面,別讓它停在面板上
    hold 0.1
    shot step5-term
  fi
  hold "$STEP_PAUSE"
done

scroll_panel "$QUIZ_SCROLL"
hold 0.4
shot step6-scrolled
mouse click "$QUIZ_X" "$QUIZ_Y" # Start quiz
hold 0.5
park_mouse
shot quiz
hold 3

if [[ -n "$REC_PID" ]]; then
  kill -INT "$REC_PID"
  wait "$REC_PID" || true
  REC_PID=""
  log "完成:$OUT"
fi
