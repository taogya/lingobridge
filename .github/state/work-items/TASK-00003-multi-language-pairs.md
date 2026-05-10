# TASK-00003-multi-language-pairs

- Version: v0.2.0
- Status: done
- Owner: lingobridge

## Goal

JA/EN 固定の現状を、`settings.json` で言語ペアを宣言できるよう一般化した。コマンドや UI も settings 駆動で動的生成。

## Acceptance

- [x] 設定 `lingobridge.languagePairs` (array) を新設。
- [x] 既定値は `[ja→en, en→ja]` (現行互換)。
- [x] エディタタイトルの 2 ボタンを「$(globe) ドキュメントを翻訳…」の 1 ボタン → QuickPick に変更し、設定値から動的生成。
- [x] Activity Bar 翻訳パネルの方向ボタン群を設定値から動的生成 (設定変更で即反映)。
- [x] 出力ファイル命名: `<name>.<to>.<ext>` (例: `README.zh.md`)。`buildOutputFileName` を一般化 (ISO 639-1 下 2/3 文字 + region)。
- [x] `LibreTranslateProvider.checkAvailability()` を一般化し、`/languages` から `supportedPairs` を返すよう拡張。
- [x] 既存コマンド `translateDocumentToEnglish` / `translateDocumentToJapanese` は后方互換のため残存。
- [ ] プロバイダ側の `supportedLanguages()` メソッド追加と UI のグレーアウト … 未対応 (グレーアウトは TASK 追加で検討)。

## Notes

- ISO 639-1 を基本とし、設定読み込み時に `^[a-z]{2,3}(-[A-Za-z0-9]+)?$` で sanitize。
- atrans の対応言語静的保持は将来課題 (現状は実行時エラーでフィードバック)。
- 動的コマンド生成は今回不採用 (QuickPick で十分)。
