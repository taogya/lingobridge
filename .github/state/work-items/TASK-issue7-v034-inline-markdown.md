# TASK-issue7-v034-inline-markdown

Issue #7 「transformers プロバイダで文書翻訳すると、翻訳結果が壊れる」
の **再々対応** (v0.3.4)。

## 背景 / 残存していた症状

- v0.3.1 〜 v0.3.3 で `incremental.ts` の `splitBlocks()` / `restore()`
	を強化し、**行頭の構造マーカー** (`#`, `>`, `|`, `-`, `*`, `1.`) は
	翻訳器に渡さず温存できるようになった。
- それでも v0.3.3 利用者から「Ctrl+Alt+E で transformers / libretranslate
	を使うと結果が壊れる」という報告が継続。再現を取った結果、**段落内に
	含まれるインライン Markdown** が依然として翻訳器へ素通しされていた:
	- `**bold**` / `__strong__` / `~~strike~~`
	- `[text](url)` / `![alt](src)`
- Helsinki-NLP MarianMT などは `*` `_` `~` `[` `]` `(` `)` `!` を確率的に
	除去するため、これらの修飾は出力で完全に消失する。

## 修正内容

1. `src/protection.ts`:
	 - 新規ルール `inlineEmphasis` と `markdownLink` を `RULES` に追加し、
		 `DEFAULT_PROTECTION_TARGETS` で **既定 ON**。
		 修飾記号 (`**` / `__` / `~~` / `[` / `](url)` / `![`) のみを stash し、
		 内側のテキスト (太字本文 / リンクラベル / 画像 alt) は翻訳対象として
		 残す。
	 - `restore()` を反復化。
		 1. プレースホルダの完全一致 (`⟦LB_n⟧` → stash[n])
		 2. `⟦...⟧` 内に `LB...digit` が残っているケースを救済
			(`⟦LB_0⟧` が `⟦LB0⟧` 等に変形しても外側 brackets ごと差し替え)
		 3. 既存の relaxed regex で `LB_0` / `[LB 0]` のような変形を最後に拾う
		 これを出力が安定するまで最大 6 パス反復。stash 値の中に他の
		 プレースホルダを含む (markdownLink が URL を内包する) ケースも
		 1 回の `restore()` で確実に解決する。
2. `package.json` の `lingobridge.protection.targets` schema 既定値に
	 `inlineEmphasis` / `markdownLink` を追加。`package.nls.json` /
	 `package.nls.ja.json` の説明文を更新。
3. `src/translationService.ts` の `readProtectionTargets()` 互換 defaults に
	 同 2 キーを追加 (設定欠落でも既定 ON)。
4. `test/suite/issuesV034.test.ts` を新規追加 (9 件、すべて修正前は失敗):
	 bold / underscore bold / strikethrough / link / image / 構造行内の
	 インライン / 表セル内のインライン / 保護層単体の往復 / 記号を完全に
	 削るモデル相当のラウンドトリップ。
5. `test/suite/protection.test.ts` / `test/suite/configuration.test.ts` の
	 既定値検証を新ルール込みに更新。
6. `test/suite/liveProviders.test.ts` に
	 `LINGOBRIDGE_TEST_TRANSFORMERS=1` ゲートの transformers スイートを追加。
	 既定保護層を通したときに実推論でも `**` / リンク URL / 画像 URL /
	 構造マーカーが残ることを確認する。
7. `test/README.md` に `LINGOBRIDGE_TEST_TRANSFORMERS` /
	 `LINGOBRIDGE_TEST_TRANSFORMERS_BACKEND_DIR` を追記。

## なぜ v0.3.1 〜 v0.3.3 では捕捉できなかったか

- 旧回帰テストは「行頭の構造マーカーが残るか」のみを検証していた。
	段落本文を `lower-case` だけにする破壊的スタブは存在したが、`*` や
	`[` を選択的に削るスタブが無かったため、インライン修飾の欠落は
	テストでは観測されなかった。
- 本タスクで `/[*_~\[\]()!]/g` を一括除去する破壊的スタブを追加し、
	**実モデルが行う変形に最も近い** 形で回帰テストを書き直した。

## 二次弊害 / ケース不足の見直し

- `restore()` を反復化したことで stash 値内のネストしたプレースホルダ
	(markdownLink が URL を内包) も解決できるようになった。最大反復は 6
	で打ち切るため無限ループの危険は無い。
- ブラケット内救済の正規表現 `⟦([^⟦⟧\n]{1,40})⟧` は内側 40 文字までに
	絞り、ユーザー本文に偶然 `⟦…⟧` が含まれていても誤マッチしないよう
	`LB...\d` を要件に課している。
- 既存 11 ルール (`fencedCode` / `inlineCode` / `url` / …) の挙動には
	非破壊。`npm test` で 107 passing / 3 pending を維持。

## 再発防止策

- インライン Markdown の追加ルールは **既定 ON** とし、利用者が個別
	settings で OFF にしない限り常に保護される。
- 破壊的スタブによる回帰テスト (`issuesV034.test.ts`) を残すことで、
	将来 `protection.ts` を変更した際もインライン Markdown 落ちを CI で
	検出できる。
- 実プロバイダ回帰として transformers の gated test を追加。手元で
	`LINGOBRIDGE_TEST_TRANSFORMERS=1` を有効化すれば実推論で確認できる。

## Verification

- `npx vscode-test --run out/test/suite/issuesV034.test.js
	--run out/test/suite/protection.test.js
	--run out/test/suite/incremental.test.js
	--run out/test/suite/configuration.test.js` → 52 passing。
- `npm test` → 107 passing / 3 pending (transformers gated を含む)。
- `npm run package:vsix` → `lingobridge-0.3.4.vsix` 生成、不要ディレクトリ
	非同梱を packaging log で確認。
