# TASK-00013-translate-selection

- Version: v0.2.1
- Status: done
- Owner: -

## Goal

エディタで選択中のテキストをコンテキストメニューまたはコマンドから一発で翻訳パネルに送り、自動で翻訳を実行する (B1)。

## UX

1. エディタで範囲選択する。
2. 右クリックメニュー (`editor/context` の `1_translate@0`) または既存ショートカットから `lingobridge: Translate Selection` を実行。
3. 左ペインの翻訳ビューが開き、入力欄に選択文字列が転記される。
4. 即時に翻訳が実行され、結果がパネルに表示される。

## Acceptance

- [x] `package.json` にコマンド `lingobridge.translateSelection` と `editor/context` メニューを追加。
- [x] `extension.ts` で選択範囲を取得し、`TranslateViewProvider.prefill(text, {autoRun:true})` を呼ぶ。
- [x] `TranslateViewProvider.prefill()` を実装。ビュー未生成時は最大 1 秒間ポーリングで待機し、必要に応じて `view.show(true)` で前面化。
- [x] Webview 側で `prefill` メッセージを処理し、入力欄をセット → `runTranslate()` を実行。
- [x] 選択が空の場合は `tr('msg.noSelection')` で警告。
- [x] `contributions.test.ts` の `expectedCommands` を 8 件に更新。テスト GREEN。

## Notes

- ステータスバー / コマンドパレットの一覧にも自動的に出る。
- `keybindings` は今回追加せず (将来 TASK で割当検討)。
