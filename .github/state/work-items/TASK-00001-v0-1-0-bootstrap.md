# TASK-00001-v0-1-0-bootstrap

- Version: v0.1.0
- Status: in-progress
- Owner: lingobridge

## Goal

旧 PromptBridge のシンプル化リブート。lingobridge の最小機能 (atrans 翻訳・コマンド・エディタタイトルバー・コンテキストメニュー・Status Bar・Activity Bar Webview・保護 ON/OFF・トークン推定) を実装する。

## Acceptance

- [x] package.json に `contributes.configuration` を定義
- [x] Activity Bar に専用ビュー
- [x] エディタタイトルバーに `→EN` `→JA` ボタン
- [x] エディタコンテキストメニューに翻訳サブメニュー
- [x] `lingobridge.translateDocumentToEnglish` / `...ToJapanese` / `estimateSelectionTokens` コマンド
- [x] `TranslationProvider` インターフェース + atrans 実装
- [x] 翻訳結果を `<元名>.<lang>.<ext>` で新規タブに開く
- [x] Status Bar に `📊 1.2k tok` 表示
- [x] Webview パネル (方向選択 / 入力 (リアルタイム tok) / 実行 / 結果 (tok) / コピー / 新規タブで開く)
- [x] 保護機能の最小実装 (URL / コードブロック)
- [ ] `npm install && npm run compile` 通過
- [ ] F5 実機確認

## Notes

- LibreTranslate は次期 (TASK-00002 想定)。
- 保護機能の細粒度制御は将来拡張用に enabled フラグだけ用意。
