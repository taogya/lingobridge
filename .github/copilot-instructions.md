# lingobridge Copilot ガイドライン

## プロジェクト文脈

- lingobridge は、VS Code 上のドキュメントを日本語⇔英語へ素早く翻訳し、トークン量を可視化する拡張です。
- 旧 PromptBridge (リポジトリ `old/`) を踏襲しつつ、責務を「翻訳」と「トークン表示」に絞ってシンプルに作り直しました。
- 設計と要件は本ドキュメントと [.github/state/active-work.md](state/active-work.md) を正本とします。

## アーキテクチャ方針

- 翻訳プロバイダは `TranslationProvider` インターフェースで抽象化し、現状は `atrans` のみ。次期で `libretranslate` (Python サーバ) を追加予定。
- トークン推定は言語非依存の簡易式 (`設定値 charsPerToken` で割る)。表示は `1.2k tok` 形式で言語ラベルなし。
- 翻訳結果は新規タブ (`<元名>.<lang>.<ext>`) で開くのを既定とする。
- 保護機能は settings の `lingobridge.protection.enabled` で ON/OFF。MVP では URL とコードブロックのみ最小実装。

## 実装の既定方針

- VS Code 公開 API のみを利用。Copilot Chat への DOM 介入や本体フォーク前提にしない。
- 翻訳前の機密 (text) を引数に出さず、stdin 経由で渡す (atrans)。
- マルチセッションにまたがる作業は [state/active-work.md](state/active-work.md) に短く現状を残し、`work-items/` で個別タスクを管理する。

## ワークフロー

- タスク駆動。`state/work-items/TASK-XXXX-<slug>.md` を 1 件ずつ消化。
- 完了時は active-work の Current Focus / Latest Handoff / Verification を更新。
- 大量の `progress/` ツリーは作らない。
