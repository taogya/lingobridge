# Active Work State

軽量な引き継ぎ用。直近の判断、次アクション、検証状態だけを残します。

## Current Focus

- v0.1.0 リリース準備完了。`atrans` / `libretranslate` の 2 プロバイダ、Activity Bar Webview、Status Bar、保護機能、言語認識型トークン推定 + js-tiktoken オプトイン、Enter で翻訳、VSIX 生成、LICENSE を実装。テスト 14 passing。
- 次アクション: ユーザーが GitHub push + v0.1.0 タグ付与。Marketplace への公開は GUI で手動登録。

## Latest Handoff

- 2026-05-10: 旧 PromptBridge (`old/`) からシンプル化リブート。リポジトリ名を `lingobridge` に決定。
- 2026-05-10: UI モックアップ [docs/ui-mockup/activity-bar-mockup.html](../../docs/ui-mockup/activity-bar-mockup.html) でユーザー承認済み。
- 2026-05-10: settings 10 項目を定義 (`provider.active` / `protection.enabled` / `atrans.path` / `atrans.timeoutMs` / `libretranslate.endpoint` / `libretranslate.apiKey` / `libretranslate.timeoutMs` / `output.openInNewTab` / `statusBar.enabled` / `input.translateOnEnter` / `tokenEstimator.engine`)。

## Verification

- `npm test`: 14 passing。
- VSIX 生成: `lingobridge-0.1.0.vsix`。
- 実機 F5: ユーザー側で atrans / LibreTranslate の両方液逘確認可能。

## Backlog (次期候補)

- 保護機能の細かな制御 (JSON/YAML/shell command/file path/log/diff/identifier の個別 ON/OFF)。
- VS Code Language Model `countTokens` API の利用。
- 翻訳履歴ビュー。
