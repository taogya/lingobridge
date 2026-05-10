# lingobridge 設計メモ

## アーキテクチャ概観

```
extension.ts                — エントリ。コマンド登録、StatusBar/View 起動
├── statusBar.ts            — StatusBarItem。エディタ/選択変更で再描画
├── translateView.ts        — Activity Bar Webview。入力→翻訳→結果UI
├── translationService.ts   — 翻訳の orchestrate (保護→provider→復元) と新規タブ命名
├── tokenEstimator.ts       — 言語認識型トークン推定 + js-tiktoken オプトイン
├── protection.ts           — コードブロック/インラインコード/URL の placeholder 化
└── providers/
    ├── translationProvider.ts     — TranslationProvider インターフェース
    ├── atransProvider.ts          — atrans CLI 実装
    ├── libreTranslateProvider.ts  — LibreTranslate HTTP 実装
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

### 翻訳結果の出力先

`translationService.buildOutputFileName()` で `<stem>.<lang>.<ext>` を生成し、`untitled:` URI で `vscode.workspace.openTextDocument` する。元ファイルが存在する場合は同ディレクトリの untitled、それ以外は workspace ルートか名前のみ。

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

## テスト

- ユニット相当: `tokenEstimator.test.ts`, `protection.test.ts`, `translationService.test.ts`
- VS Code テストランナー (`@vscode/test-cli`) で実行。

## 未実装/Backlog

- 保護機能の細粒度 (JSON / YAML / shell command / file path / log / diff / identifier)。
- VS Code Language Model `countTokens` API の利用 (モデル正確値)。
- 翻訳履歴。
