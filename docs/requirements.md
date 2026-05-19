# lingobridge 要件定義 v0.3.4

VS Code 拡張 `lingobridge` の正本要件です。
v0.2.0 で多言語ペア対応・翻訳履歴・既定キーバインド・i18n を、v0.3.0 で transformers プロバイダ・差分翻訳・保護細粒度化・オンボーディングを、v0.3.2/0.3.3 で Markdown 構造保護強化とサイドカー互換性を、v0.3.4 で Issue #7 対策としてインライン Markdown・数式・HTML・タスクリストの保護を追加しました。
実装との対応関係は `Status` 列に示します。

## 1. プロダクト概要

- 目的: VS Code 上のドキュメントを **任意の言語ペア** (既定: 日本語 ⇔ 英語) へ素早く翻訳し、トークン量を可視化する。
- 対象ユーザー: 日本語/多言語環境で AI コーディング支援を使う開発者。
- スコープ: ドキュメント全体の翻訳、選択範囲のトークン見積もり、Activity Bar 翻訳パネル、ステータスバー表示、翻訳履歴、UI の英語/日本語ローカライズ。
- 非スコープ: Token Dashboard、Prompt Composer、Language Model Tools (Agent mode 連携)、複雑な分類表示、JA/EN 別ラベル付きトークン表示。

## 2. 機能要件

| ID | 要件 | 受入条件 | Status |
| --- | --- | --- | --- |
| FUN-01 | コマンドからドキュメント全体を翻訳できる (方向選択) | `lingobridge: Translate Document…` で QuickPick から `lingobridge.languagePairs` に登録した方向を選び、結果を `<元名>.<to>.<ext>` で新規タブに開く | done |
| FUN-02 | 既定方向 (JA→EN / EN→JA) を直接呼ぶショートカットコマンドを提供 | `Translate Document JA → EN` / `EN → JA` をコマンドパレット・キーバインド・コンテキストメニューから実行可能 | done |
| FUN-03 | 選択範囲のトークン数を見積もる (言語非依存) | `lingobridge: Estimate Tokens of Selection` で通知表示、選択がなければドキュメント全体 | done |
| FUN-04 | エディタタイトルバーにワンクリック翻訳ボタン | `$(globe)` 1 ボタンを表示し、クリックで方向 QuickPick を開く | done |
| FUN-05 | エディタコンテキストメニューに翻訳項目を追加 | 右クリックで `lingobridge` サブメニュー内に方向選択 / JA→EN / EN→JA / 選択範囲トークン推定 | done |
| FUN-06 | Activity Bar に専用ビュー (アイコン: `$(globe)`) | アイコン 1 つ。クリックで翻訳パネル | done |
| FUN-07 | Activity Bar 翻訳パネル UI | 方向ボタン群 (`languagePairs` から動的生成) / 入力欄 (リアルタイム tok) / 実行ボタン / 結果欄 (実行後 tok) / コピー / 新規タブで開く / 履歴一覧 (復元・削除・全消去) | done |
| FUN-08 | プロバイダ表示と設定アクセス | パネルにプロバイダ名と利用可否バッジ、view/title の ⚙ から settings へジャンプ | done |
| FUN-09 | Status Bar に現在ドキュメントのトークン数 | `📊 1.2k tok` 形式 (言語ラベルなし)、選択時は `sel` プレフィックス | done |
| FUN-10 | 翻訳プロバイダの抽象化 | `TranslationProvider` インターフェース。`atrans` と `libretranslate` を実装。`ProviderAvailability.supportedPairs` で対応ペアを公開 | done |
| FUN-11 | 翻訳前の保護機能 | `lingobridge.protection.targets` による多層防御。既定 ON は 11 キー（コード・リンク・数式・HTML・タスクリスト系）。詳細は FUN-20 参照 | done (v0.3.4) |
| FUN-12 | 入力欄 Enter で翻訳実行 | `lingobridge.input.translateOnEnter` (default `true`)。Shift+Enter は改行、IME 変換中は誤発火しない | done |
| FUN-13 | 出力ファイル命名規則 | `README.md` → `README.en.md` / 既存の `.<lang>.` セグメントは置換 / 拡張子なしは `<name>.<lang>` | done |
| FUN-14 | 翻訳履歴の保存と再利用 | 翻訳成功時に `globalState` に保存、Webview の履歴一覧から復元 / 個別削除 / 全消去。`history.enabled` / `history.maxEntries` (0–500) で制御 | done |
| FUN-15 | 多言語ペアのユーザー定義 | `lingobridge.languagePairs` で `{from,to,label?}` 配列を定義。タイトルバー QuickPick とパネル方向ボタンに反映 | done |
| FUN-16 | 既定キーバインドを提供 | `Translate Document…` / JA→EN / EN→JA / Selection Tokens / Focus Translate View にショートカットを割り当て | done |
| FUN-17 | UI の i18n (英語既定 / 日本語フォールバック) | `vscode.env.language` が `ja*` のとき日本語、その他は英語。`package.nls(.ja).json` と `l10n/bundle.l10n(.ja).json` に集約 | done |
| FUN-18 | transformers.js (server-less) プロバイダ | `@huggingface/transformers` を遅延 require。未導入時は `lingobridge: Install transformers.js Backend (server-less)…` コマンドで拡張ディレクトリへ `npm install`。`Xenova/opus-mt-*` ONNX モデルを拡張プロセス内で実行 | done |
| FUN-19 | 差分翻訳 (ブロック単位) | `Translate Document (changed blocks only)` でブロック分割。Markdown は見出し+空行に加えて構造行 (見出し `#` / 引用 `>` / テーブル `|` / リスト `-`) をマーカー保持しながらテキスト部分だけ翻訳。それ以外は段落。SHA-1 をサイドカー JSON `<basename>.<lang>.lb.json` (version 2) に保存し、未変更ブロックはプロバイダを呼ばず再利用 | done (v0.3.2/0.3.3) |
| FUN-20 | 保護対象の細粒度化 | `lingobridge.protection.targets` で 19 キーを個別 ON/OFF。**既定 ON (11)**: `fencedCode` / `inlineCode` / `mathBlock` / `mathInline` / `htmlInline` / `autoLink` / `url` / `inlineEmphasis` / `markdownLink` / `referenceLink` / `taskList`。**既定 OFF (8)**: `markdownHeading` / `markdownTable` / `markdownList` / `shellCommand` / `filePath` / `logLine` / `diffMarker` / `identifier` | done (v0.3.4) |
| FUN-21 | オンボーディング自動オープン | 初回起動時に Walkthrough `lingobridge.gettingStarted` を1.5s 後に自動表示。`globalState` キーで 1 回だけ。`Open Getting Started` で手動再オープン可能 | done |

## 3. 非機能要件

| ID | 要件 | Status |
| --- | --- | --- |
| NFR-01 | settings.json で各種挙動を制御可能 | done (13 項目) |
| NFR-02 | 翻訳本文は引数ではなく stdin で渡す (機密情報の漏出抑止) | done (atrans) |
| NFR-03 | Webview は CSP + nonce で script-src を制限 | done |
| NFR-04 | 公開 VS Code API のみ使用、Copilot Chat の DOM 介入は行わない | done |
| NFR-05 | UI 文言はハードコードせず `vscode.l10n.t()` または `%key%` 経由で参照 | done |
| NFR-06 | 自動テストで要件カバレッジを確認可能 (live プロバイダ通信は環境変数で gating) | done ([test/README.md](../test/README.md) に対応表) |

## 4. 設定 (contributes.configuration)

| キー | 型 | 既定 | 用途 |
| --- | --- | --- | --- |
| `lingobridge.provider.active` | enum (`atrans` \| `libretranslate` \| `transformers`) | `atrans` | 使用プロバイダ |
| `lingobridge.languagePairs` | array<{from,to,label?}> | `[{from:"ja",to:"en",label:"→ EN"},{from:"en",to:"ja",label:"→ JA"}]` | タイトルバー QuickPick / パネル方向ボタンに表示する言語ペア |
| `lingobridge.protection.enabled` | boolean | `true` | 保護機能 ON/OFF |
| `lingobridge.protection.targets` | object<key,boolean> | `{fencedCode,inlineCode,mathBlock,mathInline,htmlInline,autoLink,url,inlineEmphasis,markdownLink,referenceLink,taskList:true; 他:false}` | 保護対象の個別 ON/OFF (19 キー) |
| `lingobridge.atrans.path` | string | `""` | atrans CLI 絶対パス (空で自動検出) |
| `lingobridge.atrans.timeoutMs` | number | `30000` | atrans タイムアウト |
| `lingobridge.libretranslate.endpoint` | string | `http://127.0.0.1:5000` | LibreTranslate サーバ URL |
| `lingobridge.libretranslate.apiKey` | string | `""` | LibreTranslate API キー (任意) |
| `lingobridge.libretranslate.timeoutMs` | number | `30000` | LibreTranslate タイムアウト |
| `lingobridge.transformers.modelMap` | object<string,string> | `{}` | `<from>-<to>` ごとにモデル ID を上書き (空なら組込み既定) |
| `lingobridge.transformers.cacheDir` | string | `""` | ONNX モデルキャッシュ先 |
| `lingobridge.transformers.timeoutMs` | number | `60000` | transformers.js 呼び出しタイムアウト |
| `lingobridge.incremental.enabled` | boolean | `true` | 差分翻訳を有効化 |
| `lingobridge.output.openInNewTab` | boolean | `true` | 翻訳結果を新規タブで開く |
| `lingobridge.statusBar.enabled` | boolean | `true` | Status Bar 表示 |
| `lingobridge.input.translateOnEnter` | boolean | `true` | 入力欄 Enter で翻訳実行 |
| `lingobridge.tokenEstimator.engine` | enum (`heuristic` \| `tiktoken`) | `heuristic` | トークン推定エンジン (`tiktoken` で js-tiktoken cl100k_base 使用) |
| `lingobridge.history.enabled` | boolean | `true` | 翻訳履歴の有効化 |
| `lingobridge.history.maxEntries` | number (0–500) | `50` | 翻訳履歴の最大保持件数 (0 で履歴を保持しない) |

> 注: トークン推定の係数 (旧案 `tokenEstimator.charsPerToken`) は、言語認識型推定を採用したため不要となり、削除しました。

## 5. コマンド一覧 (Command Palette)

| コマンド ID | 表示名 (en / ja) | 用途 |
| --- | --- | --- |
| `lingobridge.translateDocument` | Translate Document… / ドキュメントを翻訳… | 方向 QuickPick → ドキュメント全体翻訳 |
| `lingobridge.translateDocumentToEnglish` | Translate Document JA → EN | 直接 JA→EN 翻訳 |
| `lingobridge.translateDocumentToJapanese` | Translate Document EN → JA | 直接 EN→JA 翻訳 |
| `lingobridge.translateDocumentIncremental` | Translate Document (changed blocks only) | サイドカー JSON を参照して未変更ブロックをスキップ |
| `lingobridge.estimateSelectionTokens` | Estimate Tokens of Selection | 選択範囲 (なければ全文) のトークン数を通知 |
| `lingobridge.focusTranslateView` | Focus Translate View | Activity Bar の翻訳パネルへフォーカス移動 |
| `lingobridge.openSettings` | Open lingobridge Settings | 拡張の設定画面を開く |
| `lingobridge.openGettingStarted` | Open Getting Started | Walkthrough を再表示 |
| `lingobridge.checkProviders` | Check Translation Providers | プロバイダ可用性と対応ペアを通知ログで確認 |
| `lingobridge.installTransformersBackend` | Install transformers.js Backend (server-less)… | `@huggingface/transformers` を拡張領域に `npm install` |

## 6. キーバインド (既定)

| コマンド | Win/Linux | macOS | when |
| --- | --- | --- | --- |
| `lingobridge.translateDocument` | `Ctrl+Alt+L` | `Cmd+Alt+L` | `editorTextFocus` |
| `lingobridge.translateDocumentToEnglish` | `Ctrl+Alt+E` | `Cmd+Alt+E` | `editorTextFocus` |
| `lingobridge.translateDocumentToJapanese` | `Ctrl+Alt+J` | `Cmd+Alt+J` | `editorTextFocus` |
| `lingobridge.translateDocumentIncremental` | `Ctrl+Alt+I` | `Cmd+Alt+I` | `editorTextFocus` |
| `lingobridge.estimateSelectionTokens` | `Ctrl+Alt+T` | `Cmd+Alt+T` | `editorHasSelection` |
| `lingobridge.focusTranslateView` | `Ctrl+Alt+Shift+L` | `Cmd+Alt+Shift+L` | — |

## 7. UI モックアップ

参考: [docs/ui-mockup/activity-bar-mockup.html](ui-mockup/activity-bar-mockup.html)
(v0.1.0 時点のもの。v0.2.0 で履歴セクションと方向ボタン動的生成を追加。)

## 8. プロバイダ

### 8.0 プロバイダ選択ガイド

用途・環境に合わせて以下から 1 つを選択してください (`lingobridge.provider.active`)。

| プロバイダ | 動作環境 | セットアップコスト | 翻訳速度 | 品質 | Markdown 保護耐性 | おすすめ用途 |
| --- | --- | --- | --- | --- | --- | --- |
| `atrans` | macOS 14+ (Apple Translation framework) | 低 (`brew install` のみ) | ★★★ | ★★ | 高 (記号をほぼ保持) | macOS の既定。日常的な短文〜中文翻訳 |
| `libretranslate` | 任意 (Python サーバを `pip` でローカル起動) | 中 (Python + モデル DL) | ★★ | ★★ | 中 (一部記号を欠落させやすい) | Linux/Windows、オフライン環境、複数 OS で同等品質を求める場合 |
| `transformers` | 任意 (拡張プロセス内 Node.js) | 中 (バックエンドを 1 度だけ拡張領域へ `npm install`) | ★ (初回はモデル DL ~50–200MB) | ★★ | 中 (`**` `~~` などを欠落しやすい — 既定保護必須) | サーバ不要・完全オフライン。CI/サンドボックス用途 |

選択フロー:
1. **macOS で日本語⇔英語が中心** → `atrans`
2. **Linux / Windows でローカル完結したい** → `libretranslate`
3. **サーバを立てたくない / 完全オフライン** → `transformers`

プロバイダの可用性は `lingobridge.checkProviders` コマンドで確認できます。

### 8.1 atrans (既定)

- macOS の Apple Translation framework を呼ぶ CLI (`brew install taogya/atrans/atrans`)。
- 実装: [src/providers/atransProvider.ts](../src/providers/atransProvider.ts)
- 100 文字程度で 1 秒以内 (M1 環境) を想定。
- 対応言語ペアは Apple Translation の対応次第 (`supportedPairs` は未公開: 任意ペアを試行)。

### 8.2 LibreTranslate

- Python 単独で完結 (Docker 不要):
  ```bash
  pip install libretranslate
  libretranslate --host 127.0.0.1 --port 5000 --load-only ja,en
  ```
- 拡張は `POST {endpoint}/translate` を叩く。
- 実装: [src/providers/libreTranslateProvider.ts](../src/providers/libreTranslateProvider.ts)
- 設定: `lingobridge.libretranslate.endpoint`, `lingobridge.libretranslate.apiKey`, `lingobridge.libretranslate.timeoutMs`。
- `checkAvailability()` で `/languages` を叩き、サーバが提供する言語ペアを `ProviderAvailability.supportedPairs` として返す。

### 8.3 transformers.js (server-less)

- `@huggingface/transformers` (transformers.js v3+) を遅延 require し、`Xenova/opus-mt-*` ONNX MarianMT モデルを拡張プロセス内で実行。Python サーバも外部 API も不要。
- バックエンド本体 (~260MB の onnxruntime-node を含む) は VSIX に同梱せず、コマンド `lingobridge: Install transformers.js Backend (server-less)…` で拡張ディレクトリへ `npm install` するオンデマンド方式。
- 実装: [src/providers/transformersProvider.ts](../src/providers/transformersProvider.ts)
- 設定: `lingobridge.transformers.modelMap` / `cacheDir` / `timeoutMs`。
- 初回呼び出し時にモデル (~50–200MB) を HuggingFace から DL し、以降はキャッシュを使用。

### 8.4 検討の経緯と方針

- Bergamot Translator (Mozilla) は **日本語ペアの公式モデルが提供されておらず**、`firefox-translations-models` も 2025-12 にアーカイブ済みのため不採用。
- Ollama は速度・品質バランスは可だが「100 文字 1 秒以内」を保証しにくいため次々候補。
- 有償 SaaS (DeepL / Google / OpenAI / Azure OpenAI / Anthropic / Gemini など) は契約なしに自動テスト・検証が困難なため当面採用しない。
- ローカル LLM 系 (Ollama 等) と VS Code Copilot Language Model API は方針内 (将来検討)。

## 9. i18n

- 既定言語: 英語。
- 日本語: `vscode.env.language` が `ja*` の場合に自動切替。
- 静的文言 (`package.json` の `displayName` / `description` / コマンド / 設定説明 / ビュー名): `package.nls.json` (英語) / `package.nls.ja.json` (日本語) に集約。
- ランタイム文言 (通知 / Webview / プロバイダエラー): `vscode.l10n.t('msg.*' | 'ui.*' | 'provider.*')` 経由で `l10n/bundle.l10n.json` / `l10n/bundle.l10n.ja.json` から解決。
- ハードコード文言は禁止 (NFR-05)。

## 10. リポジトリ名

- `lingobridge` で確定。

## 11. .github 構成

- `copilot-instructions.md` と `state/active-work.md` + `state/work-items/` の最小構成のみ。
- マルチエージェント (`agents/`) は新プロジェクト規模に見合わないため不採用。
