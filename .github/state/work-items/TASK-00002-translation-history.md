# TASK-00002-translation-history

- Version: v0.2.0
- Status: done
- Owner: lingobridge

## Goal

直近 N 件の翻訳結果をローカルに保存し、Activity Bar 翻訳パネルから一覧・再表示・コピー・削除できるようにする。

## Acceptance

- [x] `globalState` (`lingobridge.history.v1`) に最新 N 件 (既定 50) を保存。
- [x] 翻訳パネル下部に「履歴」セクションを追加し、`日時 / from→to / 入力先頭 60 文字 / トークン数` を一覧表示。
- [x] 行クリックで入力欄と結果欄を復元、個別削除ボタン付き。
- [x] 設定 `lingobridge.history.enabled` (boolean, default true) と `lingobridge.history.maxEntries` (number, default 50, 0～500)。
- [x] 個別削除 (Webview ボタン) と一括クリアコマンド (`lingobridge.clearHistory`) を提供。
- [x] 機密保護観点: globalState (ローカル)、Sync には載せない。

## Notes

- 「保存対象を 入力/出力/両方/メタのみ」選択は将来拡張 (代わりに history.enabled / maxEntries=0 で上手く逃げる想定)。
- ストレージは Webview で読みやすい `globalState`。ディスク負荷を避けるため `globalStorageUri/history.jsonl` は使わず、上限 500 で十分と判断。
