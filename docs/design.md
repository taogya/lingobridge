# lingobridge 設計メモ

## アーキテクチャ概観

```
extension.ts                — エントリ。コマンド/メニュー/HistoryStore/Webview/StatusBar 起動
├── statusBar.ts            — StatusBarItem。エディタ/選択/設定変更で再描画
├── translateView.ts        — Activity Bar Webview。方向選択→翻訳→結果UI、履歴一覧
├── translationService.ts   — 翻訳の orchestrate (保護→provider→復元) と新規タブ命名
├── tokenEstimator.ts       — 言語認識型トークン推定 + js-tiktoken オプトイン
├── protection.ts           — コードブロック/インラインコード/URL の placeholder 化
├── languagePairs.ts        — settings から languagePairs を解決し、QuickPick / 方向ボタンのラベルを生成
├── history.ts              — 翻訳履歴 (globalState 永続、change イベント発火)
└── providers/
    ├── translationProvider.ts     — TranslationProvider インターフェース / LanguageCode 型
    ├── atransProvider.ts          — atrans CLI 実装 (stdin 経由)
    ├── libreTranslateProvider.ts  — LibreTranslate HTTP 実装 (/languages で supportedPairs を返す)
    └── providerRegistry.ts        — settings から active provider を解決
```

## 設計判断

### トークン推定アルゴリズム

文字種ベースの軽量近似。

```
ASCII 単語連続 (A-Z a-z 0-9 _ $ -):  ceil(runLen / 4) tokens
CJK / かな / カタカナ / CJK Compat:  1 token / 字
空白:                                  0 tokens
その他記号:                            0.5 tokens
最後に Math.max(1, Math.ceil(total))
```

設定で係数調整する案 (`tokenEstimator.charsPerToken`) は、言語ごとに最適値が変わってしまい意図と逆効果になるため不採用。
代わりに `lingobridge.tokenEstimator.engine = "tiktoken"` で `js-tiktoken` (cl100k_base) に切り替えるオプトインを備える。VS Code Language Model `countTokens` API への切替えは将来課題。

### 多言語ペアとタイトルバー UI

- v0.1.0 はタイトルバーに `→ EN` / `→ JA` の 2 ボタンを並べていたが、多言語化に伴い `$(globe)` 1 ボタン + QuickPick へ集約 (FUN-04)。
- `languagePairs.getLanguagePairs()` が `lingobridge.languagePairs` を読み、未設定や不正値の場合はデフォルト (`ja↔en`) にフォールバック。
- `pairPickLabel()` / `defaultLabel()` で QuickPick とパネルボタンのラベルを統一生成 (`label` 未指定時は `→ EN` 形式)。
- パネル方向ボタンは Webview 側で `pairs` 配列から動的生成し、設定変更時に再構築。

### 翻訳履歴

- `HistoryStore` が `globalState` の `lingobridge.history.v1` キーで永続化。
- `add()` は newest-first に積み、`maxEntries` でクランプ (0–500)。
- `enabled=false` または `maxEntries=0` の場合は保存しない。
- 変更時に `onDidChange` イベントを発火し、Webview がリアルタイムで反映。
- Webview からは復元 / 個別削除 / 全消去 (`ui.confirmClearAll` で確認) が可能。

### 翻訳結果の出力先

`translationService.buildOutputFileName()` で `<stem>.<lang>.<ext>` を生成し、`untitled:` URI で `vscode.workspace.openTextDocument` する。元ファイルが存在する場合は同ディレクトリの untitled、それ以外は workspace ルートか名前のみ。
言語コードは `languagePairs` で指定された任意の ISO 639-1 (`/^[a-z]{2,3}(-[A-Za-z0-9]{1,8})?$/`) を許容。

### 保護機能

正規表現で `fenced` → `inline` → `url` の順に置換し、`⟦LB_<index>⟧` 形式の placeholder へ退避。翻訳プロバイダが placeholder を保ったまま返すことを期待し、復元時に逆引きで戻す。失敗 (placeholder が壊された) 場合の回復策は将来課題。

### Webview セキュリティ

CSP は `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-<nonce>';`。
inline `style` 属性は使わずクラスベース。32 char の nonce を生成。

### Enter で翻訳

`keydown` で `Enter` かつ `!shiftKey && !isComposing` のときに preventDefault → translate。
- `isComposing`: IME 変換中の Enter (確定) は翻訳しない。
- `Shift+Enter`: 改行を維持。
- 設定 `lingobridge.input.translateOnEnter` で無効化可能。

### キーバインド

`contributes.keybindings` で 5 つのデフォルトを宣言 (要件の §5 参照)。`editorTextFocus` / `editorHasSelection` で when 句を制限し、Webview フォーカス時には翻訳系ショートカットを発火させない。`focusTranslateView` のみ when 制約なしで Activity Bar を即座に開ける。

### i18n

- 静的: `package.json` 内の `%key%` プレースホルダを `package.nls.json` (英) / `package.nls.ja.json` (日) で解決。VS Code が `vscode.env.language` に従って自動選択 (`ja*` で日本語)。
- 動的: `vscode.l10n.t('namespace.key')` で `l10n/bundle.l10n.json` / `bundle.l10n.ja.json` を解決。`package.json` の `"l10n": "./l10n"` で配置を指示。
- 名前空間: `msg.*` (通知/UI 状態), `ui.*` (Webview), `provider.atrans.*` / `provider.libre.*` (プロバイダエラー)。
- 新規メッセージ追加時は **両方の bundle に同じキーを追加**する。`provider.*` はテストで両言語ともキー存在を確認。

## テスト

- 既定は安全な環境で全テスト実行可能 (49 passing, 2 pending)。
- ライブプロバイダ通信が必要なテストは環境変数で gating:
  - `LINGOBRIDGE_TEST_ATRANS=1` で atrans CLI ライブテストを有効化。
  - `LINGOBRIDGE_TEST_LIBRE_ENDPOINT=<url>` で LibreTranslate ライブテストを有効化。
- 要件 ID とテストの対応は [test/README.md](../test/README.md) を参照。
- 主なテスト:
  - `tokenEstimator.test.ts`, `protection.test.ts`, `translationService.test.ts` — コアロジック
  - `languagePairs.test.ts`, `history.test.ts` — v0.2.0 機能
  - `contributions.test.ts`, `configuration.test.ts` — `package.json` 宣言と既定値
  - `view.test.ts`, `statusBar.test.ts` — UI 文字列 / 表示制御
  - `libreTranslateProvider.test.ts`, `liveProviders.test.ts` — プロバイダ (live は gated)

## 未実装/Backlog

[tmp/README.md](../tmp/README.md) の優先度・対応バージョン表を正本とする。

主な候補:
- TASK-00004 保護機能の細粒度 (JSON / YAML / shell command / file path / log / diff / identifier)。
- TASK-00005 差分翻訳 (変更ブロックのみ翻訳)。
- TASK-00007 Walkthrough。
- VS Code Language Model `countTokens` API の利用 (モデル正確値)。
- ローカル LLM (Ollama) / Copilot Language Model API プロバイダ。
