# 変更履歴

主要な変更点をここに記録します。

## 0.3.4 — 2026-05-20

- Fix #7 (再々対応): transformers / libretranslate などの破壊的モデルで
  ドキュメント翻訳 (Ctrl+Alt+E) を行うと、**段落内のインライン Markdown**
  (`**bold**` / `__strong__` / `~~strike~~` / `[text](url)` / `![alt](src)`)
  が消えてしまう不具合を修正。v0.3.1〜v0.3.3 の修正は行頭の構造マーカー
  (`#` / `>` / `|` / `-`) のみを対象としており、本文中のインライン修飾は
  保護されないまま翻訳器に渡されていた。
  - `src/protection.ts` に既定 ON の保護ルール `inlineEmphasis` と
    `markdownLink` を追加。修飾記号のみを stash し、内側の翻訳対象テキスト
    (太字の本文・リンクラベル・画像 alt) はそのまま翻訳器に渡る。
  - 同 `restore()` を再設計。プレースホルダの内側のみが書き換わる
    (`⟦LB_0⟧` → `⟦LB0⟧`) ような壊れ方を救済するブラケット内マッチを追加し、
    入れ子で stash された URL も含めて出力が安定するまで反復復元する。
- 設定値 `lingobridge.protection.targets` の既定値に `inlineEmphasis` と
  `markdownLink` を `true` で追加。`package.nls.json` / `package.nls.ja.json` /
  `package.json` schema を更新。
- v0.3.1〜v0.3.3 で再発を見逃した原因への対策: インライン Markdown を
  落とす破壊的スタブで再現する回帰テスト `test/suite/issuesV034.test.ts`
  (9 件) を追加。`bold` / `underscore` / `strikethrough` / `link` / `image` /
  構造行内のインライン / 表セル内のインライン / 保護層単体の往復 /
  記号を完全に削るモデル相当のラウンドトリップを網羅。
- 実プロバイダ回帰として `test/suite/liveProviders.test.ts` に
  `LINGOBRIDGE_TEST_TRANSFORMERS=1` ゲートの `transformers` スイートを追加。
  既定保護層を通したときに `**` / リンク URL / 画像 URL / 構造マーカーが
  残ることを実推論で確認する。前提条件と環境変数は `test/README.md` に追記。
- Phase 1 追加保護ルール (既定 ON): `mathBlock` (`$$…$$`) / `mathInline`
  (`$…$`; 通貨形式 `$10` は誤検出を回避) / `htmlInline` (`<br>` `<kbd>`
  `<sub>` `<sup>` ほかホワイトリスト) / `autoLink` (`<https://…>` /
  `<mailto:…>` / `<user@host>`) / `referenceLink` (`[text][ref]` および
  `[ref]: url` 定義行) / `taskList` (`- [ ]` / `- [x]`)。
  `test/suite/protectionExtraRules.test.ts` (11 件) で各ルールの破壊的
  ストリッパ耐性・無効化動作・往復同一性を検証。
- `docs/requirements.md` を v0.3.4 に同期: §5 にコマンド一覧テーブルを
  新設、§8 にプロバイダ選択ガイドを追加、FUN-11 / FUN-19 / FUN-20 と
  §4 設定表を最新の 19 保護キーへ更新。

## 0.3.3 — 2026-05-19

- Fix #7: Markdown 構造が翻訳中に破壊される問題を修正。
  - `protection.ts` のプレースホルダー復元ロジックを強化し、
    Markdown 記号の変形にも対応。
  - `incremental.ts` のブロック分割ロジックを改善し、
    Markdown 構造を保持したまま翻訳可能に。
- Fix #8: transformers.js のインストールがバージョン更新時に失われる問題を修正。
  - `transformersProvider.ts` にグローバルストレージを利用した
    インストールパス管理を実装。
- テストカバレッジを拡大。
  - Markdown 構造、プレースホルダーの復元、
    実際の翻訳シナリオを網羅するテストを追加。

## 0.3.2 — 2026-05-13

- Re-fix #7: 文書翻訳で **Markdown 構造が依然として壊れる** 不具合を修正。
  v0.3.1 ではブロック境界 (改行) のみ保持していたが、ブロック内の markdown
  マーカー (`#`, `>`, `|`, `-`, `*`, `1.`) はそのまま翻訳器に流していたため、
  transformers / libretranslate のように非テキスト記号を落としやすいモデルでは
  構造が壊れていた。`src/incremental.ts` の `splitBlocks()` を再設計し、
  見出し / 引用 / リスト / 表行をリテラル markup と翻訳対象テキストに分解し、
  翻訳器には**テキスト部分のみ**を送って結果を再縫合する方式に変更。表の
  separator 行 (`| --- |`) は翻訳器に渡さずそのまま温存する。これにより
  「`#` が消える」「表が 1 行に潰れる」事象が再発しない。サイドカー JSON は
  ハッシュ対象が変わるため `version: 2` に更新。
- v0.3.1 で Issue #7 を捕捉できなかった原因の修正: 旧テストは翻訳器スタブが
  `[${text}]` で全文字をそのまま返していたため、markdown マーカー欠落を
  検知できなかった。v0.3.2 では markdown 記号を落とす **破壊的スタブ** を使う
  リプロデューサ (`Issue #7: structural markdown markers are preserved when
  the translator strips them`) を `test/suite/incremental.test.ts` と
  `test/suite/issuesV032.test.ts` に追加。
- Fix #5 (再対応): Onboarding ウォークスルーを再設計。
  - `pickProvider` ステップ: 共有セットアップへのリンクを冒頭に移動し、
    開発者向けの「重複管理」表現を削除して短文化。
  - 個別の `installAtrans` / `installLibre` / `installTransformers` ステップを
    削除 (手順は `docs/setup/providers/*` に一本化)。
  - 新ステップ `checkProviders` を追加。新コマンド
    `lingobridge.checkProviders` でプロバイダ 3 種のインストール状況を
    チェックリスト (`[x] atrans / [ ] libretranslate / [ ] transformers`) で
    表示する。
  - `firstTranslation` ステップに「翻訳パネルを開く」コマンドリンクを追加。
- 新コマンド: `lingobridge.checkProviders` (`Check Providers (availability)…`)。
- l10n: `cmd.checkProviders.title` / `walkthrough.step.checkProviders.*` /
  `msg.checkProviders` を追加。`walkthrough.step.installAtrans` などの旧キーを
  削除。
- `media/walkthrough/installAtrans.md` / `installLibre.md` /
  `installTransformers.md` を削除し、新規 `checkProviders.md` を追加。
- テスト: `issuesV031.test.ts` の install-pages 検証を撤去。`issuesV032.test.ts`
  / `incremental.test.ts` で v0.3.2 の挙動を固定。`contributions.test.ts` を
  コマンド数 11 → 12 に更新。

## 0.3.1 — 2026-05-13

- Fix #5: Onboarding のプロバイダ導線を整理。`media/walkthrough/pickProvider.md`
  で 3 プロバイダ (`atrans` / `libretranslate` / `transformers`) を明示し、
  共有セットアップ入口 `docs/setup/providers/README.md` へ誘導するよう変更。
- Fix #6: 翻訳パネルの provider availability が stale になる不具合を修正。
  `TranslateViewProvider` が View 再表示時 (`onDidChangeVisibility`) に
  `checkAvailability()` を再実行するようにした。
- Fix #7: 文書翻訳が Markdown 構造を壊すケースを修正。通常の文書翻訳も
  ブロック単位の構造保持ロジックを使うように変更し、見出し・表行・引用・
  リスト行の境界と改行を保持したまま翻訳する。差分翻訳も同じ分割ロジックを
  共有し、Markdown table row の改行を温存する。
- テスト: `issuesV031.test.ts` を追加し、Issue #5 / #6 の回帰を固定。

## 0.3.0 — 2026-05-12

- **新プロバイダ: `transformers`** (TASK-libretranslate-no-server-investigation)。
  `@huggingface/transformers` (transformers.js v3+) を遅延 require する
  `TransformersProvider` を追加。MarianMT (`Xenova/opus-mt-*`) ONNX モデルを
  拡張プロセス内で動かすため、Python サーバも外部 API も不要。
  バックエンド本体 (~260MB) は VSIX に同梱せず、コマンド
  `lingobridge: Install transformers.js Backend (server-less)` から
  npm install して導入する方式。
- **差分翻訳 (incremental)** (TASK-00005)。新コマンド
  `lingobridge.translateDocumentIncremental` (`cmd+alt+i` / `ctrl+alt+i`) と
  `src/incremental.ts` を追加。Markdown は見出し + 空行で、それ以外は段落で
  ブロック分割し、SHA-1 ハッシュをサイドカー JSON
  (`<basename>.<lang>.lb.json`) で保持。変更ブロックだけプロバイダに送る。
  既定 ON (`lingobridge.incremental.enabled`)。
- **保護機能の細粒度化** (TASK-00004)。`src/protection.ts` をルールテーブル方式に
  リファクタし、`fencedCode` / `inlineCode` / `url` に加え `markdownHeading` /
  `markdownTable` / `markdownList` / `shellCommand` / `filePath` / `logLine` /
  `diffMarker` / `identifier` を追加。`lingobridge.protection.targets` で
  個別に ON/OFF できる。既定値は v0.2.x 互換 (3 種のみ ON)。
- **Onboarding 再設計** (TASK-00014)。初回起動時に Walkthrough
  `lingobridge.gettingStarted` を自動オープン (1.5s ディレイ)。再オープン用に
  `lingobridge.openGettingStarted` コマンドを追加。`transformers` 用ステップ
  (`installTransformers`) と `media/walkthrough/installTransformers.md` を新設。
- 設定追加: `transformers.modelMap` / `transformers.cacheDir` /
  `transformers.timeoutMs` / `incremental.enabled` / `protection.targets`。
- l10n: `provider.transformers.*` / `msg.incrementalStats` を ja/en 両 bundle へ追加。
- テスト: `incremental.test.ts` / `transformersProvider.test.ts` 追加。
  `contributions.test.ts` のコマンド数を 8 → 11 / キーバインド 5 → 6 に更新。
  61 passing / 2 pending。

## 0.2.1 — 2026-05-12

- Fix #1 (TASK-00009): 英語環境で UI ラベルが `ui.provider` などの生キーのまま
  表示される不具合を修正。`src/i18n.ts` に `tr()` ラッパーを追加し、
  `vscode.l10n.t` がキーをそのまま返した場合は `l10n/bundle.l10n.json` から
  英語にフォールバックするようにした。
- Fix #2 (TASK-00010): 翻訳パネルの「履歴をクリア」ボタンが反応しない不具合を修正。
  Webview の `window.confirm()` 依存を撤廃し、確認モーダルは拡張ホスト側
  (`vscode.window.showWarningMessage(..., {modal:true}, ...)`) で行うように変更。
- Fix #3 (TASK-00011): LibreTranslate プロバイダで keep-alive ソケットが
  サーバ側に閉じられた直後の再利用で `socket hang up` / `ECONNRESET` 系エラーが
  発生していた問題を修正。`Connection: close` ヘッダ付与に加え、transient な
  ソケットエラー検出時に 1 回だけ自動リトライ。
- Fix #4 (TASK-00012): `Estimate Tokens` 通知に推定エンジン名 (`heuristic` /
  `tiktoken`) を併記し、設定切替が効いていることを判別できるようにした。
- Walkthrough (TASK-00007): VS Code の Get Started 機構に
  `lingobridge.gettingStarted` を追加。プロバイダ選択 → セットアップ →
  初回翻訳までを `media/walkthrough/*.md` で誘導。
- Translate Selection (TASK-00013): エディタの選択範囲を右クリックメニュー
  (`lingobridge: Translate Selection`) または同名コマンドから
  翻訳パネルへ転送し、自動で翻訳を実行する B1 フローを追加。
- Fix (Linux 互換性): ファイル名に非 ASCII (日本語など) を含む
  ドキュメントを Linux 上で翻訳した際に新規タブを開けない不具合を修正。
  `untitled:` URI に絶対パスを埋め込まず、ファイル名のみを保持する
  よう `openTranslationInNewTab()` を見直した (LANG=C / NFC・NFD
  ミスマッチ両方を回避)。タブ名 = `<元名>.<lang>.<拡張子>` は維持。

## 0.2.0 — 2026-05-10

- 多言語対応 (TASK-00003): タイトルバーを `$(globe)` 1 ボタン + QuickPick に一本化し、
  `lingobridge.languagePairs` (array) で任意の言語ペアを宣言可能に。
  `buildOutputFileName` も ISO 639-1 一般コードを認識。既存 JA/EN コマンドは后方互換で残存。
- 翻訳履歴 (TASK-00002): 直近の翻訳 (既定 50 件) を `globalState` に保持。翻訳パネル下部に
  「履歴」セクションと一括削除コマンド (`lingobridge.clearHistory`) を追加。設定 `lingobridge.history.enabled` /
  `lingobridge.history.maxEntries` (0～500)。
- 既定キーバインド (TASK-00006): `Cmd/Ctrl+Alt+L` (Picker) / `+E` (JA→EN) /
  `+J` (EN→JA) / `+T` (選択トークン推定) / `+Shift+L` (ビューにフォーカス) を追加。
- i18n (TASK-00008): `package.nls.json` (en 既定) / `package.nls.ja.json` を追加し、
  `l10n/bundle.l10n.json` / `bundle.l10n.ja.json` + `vscode.l10n.t()` でランタイム文言を多言語化。
  Webview も拡張から post された文字列を描画。

## 0.1.0 — 2026-05-10

初回リリース。

- アクティブなドキュメントを日本語 → 英語 / 英語 → 日本語 に翻訳。
  コマンドパレット、エディタタイトルバー (`→ EN` / `→ JA`)、
  コンテキストメニューから実行可能。
- 「Estimate Tokens of Selection」コマンドで選択範囲のトークン数を推定
  (言語認識型ヒューリスティック)。
- アクティビティバー `lingobridge` ビュー: リアルタイムで入力トークン数を
  表示する翻訳パネル、実行ボタン、結果トークン表示、コピー、新規タブで開く。
- ステータスバーにトークン数インジケータ (`📊 1.2k tok`、選択範囲対応)。
- 翻訳プロバイダ:
  - `atrans` (macOS)。
  - `libretranslate` (クロスプラットフォーム、ローカル Python サーバが必要)。
- 翻訳前にコードブロック / インラインコード / URL を退避し、翻訳後に復元する
  保護機能 (任意で ON/OFF 可)。
- 設定: プロバイダ、保護機能、atrans のパス/タイムアウト、
  LibreTranslate のエンドポイント/API キー/タイムアウト、出力動作、
  ステータスバー表示、Enter で翻訳トグル、
  トークン推定エンジン (`heuristic` | `tiktoken`) の 10 項目。
- GPT-3.5 / 4 系モデルと整合する正確なトークン数のための任意バックエンドとして
  `js-tiktoken` (cl100k_base) を同梱。
- プロバイダ別セットアップガイドを `docs/setup/providers/` に同梱。
