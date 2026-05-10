# 変更履歴

主要な変更点をここに記録します。

## 0.2.0 — 2026-05-10

- 多言語対応 (TASK-00003): タイトルバーを `$(globe)` 1 ボタン + QuickPick に一本化し、
  `lingobridge.languagePairs` (array) で任意の言語ペアを宣言可能に。
  `buildOutputFileName` も ISO 639-1 一般コードを認識。既存 JA/EN コマンドは后方互換で残存。
- 翻訳履歴 (TASK-00002): 直近の翻訳 (既定 50 件) を `globalState` に保持。翻訳パネル下部に
  「履歴」セクションと一括削除コマンド (`lingobridge.clearHistory`) を追加。設定 `lingobridge.history.enabled` /
  `lingobridge.history.maxEntries` (0～500)。
- 既定キーバインド (TASK-00006): `Cmd/Ctrl+Alt+L` (Picker) / `+E` (JA→EN) /
  `+J` (EN→JA) / `+T` (選択トークン推定) / `+Shift+L` (ビューにフォーカス) を追加。
- i18n (TASK-00008): `package.nls.json` (en 既定) / `package.nls.ja.json` を追加し、
  `l10n/bundle.l10n.json` / `bundle.l10n.ja.json` + `vscode.l10n.t()` でランタイム文言を多言語化。
  Webview も拡張から post された文字列を描画。

## 0.1.0 — 2026-05-10

初回リリース。

- アクティブなドキュメントを日本語 → 英語 / 英語 → 日本語 に翻訳。
  コマンドパレット、エディタタイトルバー (`→ EN` / `→ JA`)、
  コンテキストメニューから実行可能。
- 「Estimate Tokens of Selection」コマンドで選択範囲のトークン数を推定
  (言語認識型ヒューリスティック)。
- アクティビティバー `lingobridge` ビュー: リアルタイムで入力トークン数を
  表示する翻訳パネル、実行ボタン、結果トークン表示、コピー、新規タブで開く。
- ステータスバーにトークン数インジケータ (`📊 1.2k tok`、選択範囲対応)。
- 翻訳プロバイダ:
  - `atrans` (macOS)。
  - `libretranslate` (クロスプラットフォーム、ローカル Python サーバが必要)。
- 翻訳前にコードブロック / インラインコード / URL を退避し、翻訳後に復元する
  保護機能 (任意で ON/OFF 可)。
- 設定: プロバイダ、保護機能、atrans のパス/タイムアウト、
  LibreTranslate のエンドポイント/API キー/タイムアウト、出力動作、
  ステータスバー表示、Enter で翻訳トグル、
  トークン推定エンジン (`heuristic` | `tiktoken`) の 10 項目。
- GPT-3.5 / 4 系モデルと整合する正確なトークン数のための任意バックエンドとして
  `js-tiktoken` (cl100k_base) を同梱。
- プロバイダ別セットアップガイドを `docs/setup/providers/` に同梱。
