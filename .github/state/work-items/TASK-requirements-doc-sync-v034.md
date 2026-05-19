# TASK: requirements.md を v0.3.4 実装と再同期

`docs/requirements.md` のヘッダは依然 `v0.3.0` 表記で、v0.3.1〜v0.3.4 の
変更が要件側に反映されていない。実装と要件の乖離はレビュー時に判断を
誤らせる原因になるため、リリースごとに同期する。

## 修正対象 (具体)

1. **ヘッダ**: `v0.3.0` → `v0.3.4`。「v0.3.x で追加された…」の段落を更新
   (markdown 構造保護 v0.3.2 / inline markdown 保護 v0.3.4 / checkProviders
   コマンド v0.3.2)。
2. **FUN-11**: 「最小実装」「コードブロック / インラインコード / URL を退避し復元」
   を撤去し、現状の **13 種のルールを `protection.targets` で個別 ON/OFF** に統合。
   FUN-20 へ完全に役割を委譲し、FUN-11 は「保護機能の総括 (保護→翻訳→復元の
   往復を保証)」のみ記す。
3. **FUN-20**: 「11 キー」「既定は v0.2.x 互換 (3 種のみ ON)」を更新。
   - キー数: **13** (`inlineEmphasis` / `markdownLink` を追加)
   - 既定 ON: `fencedCode` / `inlineCode` / `url` / `inlineEmphasis` /
     `markdownLink` の **5 種**
   - 既定 OFF: `markdownHeading` / `markdownTable` / `markdownList` /
     `shellCommand` / `filePath` / `logLine` / `diffMarker` / `identifier` の 8 種
4. **§4 設定表 `protection.targets` 行**: 既定値の例示と `(11 キー)` を
   更新。
5. **FUN-19**: 「Markdown は見出し+空行で分割」を v0.3.2 の現実装に合わせ
   「見出し/引用/リスト/表行をリテラル markup と翻訳対象テキストに分解。
   表 separator 行 (`| --- |`) は翻訳器に渡さず温存」へ。サイドカー JSON
   `version: 2` を脚注で明記。
6. **コマンド表 (新設)**: §5 の前に「主要コマンド一覧」表を追加し、
   `lingobridge.checkProviders` を含む 12 コマンド + ショートカット
   未割り当てコマンドを並べる。要件と実装の対応が一目で分かるようにする。
7. **プロバイダ選択ガイド (§7 の先頭)**: 短い表を追加。
   | 状況 | 推奨 | 理由 |
   | --- | --- | --- |
   | macOS で手軽に高品質 | `atrans` | Apple Translation。記号保持◎・低レイテンシ |
   | 自前サーバを立てたい / Linux/Windows | `libretranslate` | Python 単独。任意言語ペア |
   | サーバ無し・オフライン重視 | `transformers` | server-less。初回モデル DL あり |

## 受入条件

- requirements.md のヘッダ・FUN-11・FUN-19・FUN-20・§4 設定表・§7 が
  v0.3.4 の実装と矛盾しない。
- コマンド一覧表が `package.json` の `contributes.commands` と件数一致。
- 「保護のデフォルト」の説明が CHANGELOG v0.3.4 / package.nls* の記述と
  一致する。

## 推奨タイミング

- v0.3.4 と**同じコミット**に混ぜるのが理想 (release notes と整合)。
- 別途切る場合は v0.3.4 を release した直後の "docs only" コミットで対応。

## Priority / Size

- Priority: **High** (実装と要件の乖離は信頼性を損なう)
- Size: **S** (1 ファイル、構造変更なし)
