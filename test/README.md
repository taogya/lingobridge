# lingobridge tests

`@vscode/test-cli` を使い、VS Code 拡張ホスト内で Mocha (TDD) を実行します。

```bash
npm install
npm run compile:test
npm test
```

テストはすべて [test/suite/](suite/) 配下に置きます。新規テストもここに追加してください。

## カバレッジ対応 (要件 ↔ テスト)

| 要件 ID | 内容 | テスト |
| --- | --- | --- |
| FUN-01 | JA→EN ドキュメント翻訳コマンド | [contributions](suite/contributions.test.ts) (登録) / [liveProviders](suite/liveProviders.test.ts) (実通信) |
| FUN-02 | EN→JA ドキュメント翻訳コマンド | 同上 |
| FUN-03 | 選択範囲のトークン数推定 | [contributions](suite/contributions.test.ts) / [tokenEstimator](suite/tokenEstimator.test.ts) |
| FUN-04 | エディタタイトルバーの統合翻訳ボタン | [contributions](suite/contributions.test.ts) (`editor/title` メニューが 1 件のみ) |
| FUN-05 | エディタコンテキストメニュー | (package.json 検証は contributions に統合) |
| FUN-06 | Activity Bar 専用ビュー | [view](suite/view.test.ts) |
| FUN-07 | 翻訳パネル UI (input / result / コピー / 履歴) | [history](suite/history.test.ts) (履歴 UI バック) / 手動: Webview の Enter / コピーは現状マニュアル |
| FUN-08 | プロバイダ表示 + ⚙ ジャンプ | [view](suite/view.test.ts) (`view/title` メニュー検証) |
| FUN-09 | Status Bar | [statusBar](suite/statusBar.test.ts) |
| FUN-10 | プロバイダ抽象化 | [libreTranslateProvider](suite/libreTranslateProvider.test.ts) (down) / [liveProviders](suite/liveProviders.test.ts) (up) |
| FUN-11 | 保護機能 (URL/コードブロック/インラインコード) | [protection](suite/protection.test.ts) |
| FUN-12 | 入力欄 Enter で翻訳 | 手動 (Webview keydown は実 DOM テスト未実装、C5 で予定) |
| FUN-13 | 出力ファイル命名規則 | [translationService](suite/translationService.test.ts) |
| NFR-01 | settings.json で挙動を制御 | [configuration](suite/configuration.test.ts) |
| NFR-02 | 翻訳本文は stdin 渡し | [liveProviders](suite/liveProviders.test.ts) (atrans が成功する≒stdin 経路で渡っている) |
| NFR-03 | Webview の CSP + nonce | 静的検証 (renderHtml 内のヘッダ。テスト化は C5 で予定) |
| NFR-04 | 公開 API のみ使用 | tsc / @types/vscode で型レベル担保 |
| TASK-00002 | 翻訳履歴 | [history](suite/history.test.ts) |
| TASK-00003 | 多言語対応 (`lingobridge.languagePairs`) | [languagePairs](suite/languagePairs.test.ts) / [configuration](suite/configuration.test.ts) |
| TASK-00006 | 既定キーバインド | [contributions](suite/contributions.test.ts) (5 件) |
| TASK-00008 | i18n (l10n bundles) | [configuration](suite/configuration.test.ts) (NLS キー解決済み defaults) |

> 「FUN-07 入力欄 Enter」「Webview のメッセージ往復」「CSP 文字列」など Webview に閉じた挙動の自動化は v1.0.0 前のテスト拡充タスクで扱う予定です ([.github/state/work-items/](../.github/state/work-items/) を参照)。

## 実プロバイダを使うテスト

ネット越し SaaS は契約必須なので扱いません。**ローカルで起動するプロバイダの実通信テストだけ**、環境変数で明示的に有効化したときに走らせます (CI ではスキップ)。

| 環境変数 | 値 | 影響するスイート | 事前準備 |
| --- | --- | --- | --- |
| `LINGOBRIDGE_TEST_LIBRE_ENDPOINT` | 例 `http://127.0.0.1:5000` | `live providers (gated) > LibreTranslate` | 別ターミナルで `pip install libretranslate && libretranslate --host 127.0.0.1 --port 5000 --load-only ja,en` を起動しておく |
| `LINGOBRIDGE_TEST_ATRANS` | `1` | `live providers (gated) > atrans` | macOS で `brew install taogya/atrans/atrans` を実行済みで PATH に通っている |

設定例:

```bash
# LibreTranslate のみ
LINGOBRIDGE_TEST_LIBRE_ENDPOINT=http://127.0.0.1:5000 npm test

# atrans のみ (macOS)
LINGOBRIDGE_TEST_ATRANS=1 npm test

# 両方
LINGOBRIDGE_TEST_LIBRE_ENDPOINT=http://127.0.0.1:5000 LINGOBRIDGE_TEST_ATRANS=1 npm test
```

未設定時は `skipped` として表示され、テスト合計件数には含まれません。
