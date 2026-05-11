# 変更履歴

主要な変更点をここに記録します。

## 0.2.1 — 2026-05-12

- Fix #1 (TASK-00009): 英語環境で UI ラベルが `ui.provider` などの生キーのまま
  表示される不具合を修正。`src/i18n.ts` に `tr()` ラッパーを追加し、
  `vscode.l10n.t` がキーをそのまま返した場合は `l10n/bundle.l10n.json` から
  英語にフォールバックするようにした。
- Fix #2 (TASK-00010): 翻訳パネルの「履歴をクリア」ボタンが反応しない不具合を修正。
  Webview の `window.confirm()` 依存を撤廃し、確認モーダルは拡張ホスト側
  (`vscode.window.showWarningMessage(..., {modal:true}, ...)`) で行うように変更。
- Fix #3 (TASK-00011): LibreTranslate プロバイダで keep-alive ソケットが
  サーバ側に閉じられた直後の再利用で `socket hang up` / `ECONNRESET` 系エラーが
  発生していた問題を修正。`Connection: close` ヘッダ付与に加え、transient な
  ソケットエラー検出時に 1 回だけ自動リトライ。
- Fix #4 (TASK-00012): `Estimate Tokens` 通知に推定エンジン名 (`heuristic` /
  `tiktoken`) を併記し、設定切替が効いていることを判別できるようにした。
- Walkthrough (TASK-00007): VS Code の Get Started 機構に
  `lingobridge.gettingStarted` を追加。プロバイダ選択 → セットアップ →
  初回翻訳までを `media/walkthrough/*.md` で誘導。
- Translate Selection (TASK-00013): エディタの選択範囲を右クリックメニュー
  (`lingobridge: Translate Selection`) または同名コマンドから
  翻訳パネルへ転送し、自動で翻訳を実行する B1 フローを追加。
- Fix (Linux 互換性): ファイル名に非 ASCII (日本語など) を含む
  ドキュメントを Linux 上で翻訳した際に新規タブを開けない不具合を修正。
  `untitled:` URI に絶対パスを埋め込まず、ファイル名のみを保持する
  よう `openTranslationInNewTab()` を見直した (LANG=C / NFC・NFD
  ミスマッチ両方を回避)。タブ名 = `<元名>.<lang>.<拡張子>` は維持。

### 予告 (Roadmap)

- v0.3.0: LibreTranslate のサーバ起動を不要にする
  プロバイダ (transformers.js ベースの in-process 動作) を予定。
  詳細は `tmp/TASK-libretranslate-no-server-investigation.md` 参照。

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
