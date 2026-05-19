# TASK: 追加 Markdown 保護ルール (v0.3.5 想定)

v0.3.4 で `inlineEmphasis` / `markdownLink` を追加したが、未対応の
Markdown 記法が残る。実利用での影響度と false positive リスクを天秤に
かけ、以下の順で段階導入する。

## 提案ルール

### Phase 1 (既定 ON 候補・低リスク)

| キー | 対象 | 既定 | 備考 |
| --- | --- | --- | --- |
| `autoLink` | `<https://…>` `<scheme://…>` `<email@…>` | ON | `<>` の角括弧ごと stash |
| `referenceLink` | `[text][ref]` と `[ref]: url` 定義行 | ON | 定義行は行ごと stash |
| `taskList` | リスト先頭の `[ ]` / `[x]` (リスト記号の直後) | ON | `markdownList` と独立して動く必要あり |
| `mathInline` | `$…$` (前後が単語境界) | ON | LaTeX 数式 |
| `mathBlock` | `$$…$$` (改行可) | ON | LaTeX ブロック数式 |
| `htmlInline` | `<br>` `<kbd>` `<sub>` `<sup>` `<code>` `<span>` 等の限定タグ | ON | ホワイトリスト方式 |

### Phase 2 (既定 OFF / オプトイン)

| キー | 対象 | 既定 | 備考 |
| --- | --- | --- | --- |
| `italicSingle` | `*x*` / `_x_` (1 文字囲み) | OFF | snake_case や強調なしの記号と紛らわしい。誤マッチ抑止のため境界条件を厳しく |
| `horizontalRule` | `---` `***` `___` 単独行 | OFF | 現状 splitter で大半通るため明示化は限定的 |
| `htmlBlock` | `<details>...</details>` などのブロック HTML | OFF | パース順序の問題で fencedCode より外側で扱う必要あり |

## 影響範囲

- `src/protection.ts`: ルール追加 + `ProtectionTargetKey` 拡張。
- `package.json`: schema に 8 キー追加 (Phase 1 は default true, Phase 2 は false)。
- `package.nls(.ja).json`: `config.protection.targets.description` 更新。
- `src/translationService.ts`: `readProtectionTargets()` 互換 defaults。
- `test/suite/issuesV034.test.ts` 拡張 / 新規 `test/suite/issuesV035.test.ts`:
  - autoLink / referenceLink / taskList / math / htmlInline の破壊スタブ
    回帰テスト各 1〜2 件。
- `test/suite/configuration.test.ts` / `protection.test.ts` の既定値検証を更新。
- `test/suite/liveProviders.test.ts` の transformers gated に
  「数式 + タスクリスト + HTML タグ」スイートを 1 件追加。

## 受入条件

- Phase 1 の 6 ルールが既定 ON で、破壊的スタブを通しても元の記号が残る。
- 既存 107 テスト (+ 新規) すべてグリーン。
- 実モデル (transformers Helsinki-NLP) で数式 `$E=mc^2$` がそのまま出力される。
- `italicSingle` ON 時の false positive (例: `set_value` のような snake_case
  内の `_` を強調と誤認しない) を `protection.test.ts` で固定。

## 推奨タイミング

- v0.3.4 とは**別リリース** (v0.3.5) を強く推奨。
  - 理由: v0.3.4 の `inlineEmphasis` / `markdownLink` 追加直後に
    更にルールを増やすと、もし回帰が出た場合に原因切り分けが難しい。
  - v0.3.4 を 1〜2 週間 community で回し、issue #7 の追加報告が無い
    ことを確認してから着手するのが安全。

## Priority / Size

- Priority: **Mid** (致命度は v0.3.4 ほどではないが、技術ドキュメント
  ユーザーにとって数式・タスクリストは頻出)
- Size: **M** (Phase 1 のみで `protection.ts` +約 80 行、テスト 8〜10 件、
  i18n 3 ファイル更新)

## リスク

- ルール追加でプレースホルダ数が増え、relaxed regex / bracket fallback の
  耐性試験を再度回す必要がある。
- `htmlInline` のタグ閉じ忘れ (例: `<br>` だけ) に注意。自閉タグと
  ペアタグの両方を扱う実装にする。
- `mathBlock` は複数行に渡るため `fencedCode` 同様に `m` フラグでの
  グローバル処理が必要。
