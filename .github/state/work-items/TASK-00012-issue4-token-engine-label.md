# TASK-00012-issue4-token-engine-label

- Version: v0.2.1
- Status: done
- Owner: -
- Issue: taogya/lingobridge#4

## Goal

`Estimate Tokens` 実行時の通知メッセージから、現在使われている推定エンジン (`heuristic` / `tiktoken`) を読み取れないため、
切替が効いているのか分からない問題を解消する。

## Acceptance

- [x] 再現テスト: `tr('msg.tokensOf', '120 tok','selection','300','tiktoken')` の戻り値に `tiktoken` が含まれることを assert。
- [x] `l10n/bundle.l10n.json` / `.ja.json` の `msg.tokensOf` に `engine: {3}` プレースホルダを追加。
- [x] `extension.ts` の `estimateSelection()` で第4引数として `engine` を渡す。
- [x] テスト全件 GREEN。
