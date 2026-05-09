# lingobridge 要件定義 v0.1.0

旧 PromptBridge をシンプル化リブートした VS Code 拡張 `lingobridge` の正本要件です。
本ドキュメントは前会話で確定した内容を網羅し、実装との対応関係を `Status` 列に示します。

## 1. プロダクト概要

- 目的: VS Code 上のドキュメントを **日本語 ⇔ 英語** に素早く翻訳し、トークン量を可視化する。
- 対象ユーザー: 日本語で AI コーディング支援を使う開発者。
- スコープ: ドキュメント全体の翻訳、選択範囲のトークン見積もり、Activity Bar 翻訳パネル、ステータスバー表示。
- 非スコープ (旧 PromptBridge から切り落とし): Token Dashboard、Prompt Composer、Language Model Tools (Agent mode 連携)、複雑な分類表示、JA/EN 別ラベル付きトークン表示。

## 2. 機能要件

| ID | 要件 | 受入条件 | Status |
| --- | --- | --- | --- |
| FUN-01 | コマンドパレットからドキュメント全体を JA→EN 翻訳できる | `lingobridge: Translate Document JA → EN` で実行、結果を `<元名>.en.<ext>` で新規タブに開く | done |
| FUN-02 | コマンドパレットからドキュメント全体を EN→JA 翻訳できる | `lingobridge: Translate Document EN → JA` で実行、結果を `<元名>.ja.<ext>` で新規タブに開く | done |
| FUN-03 | 選択範囲のトークン数を見積もる (言語非依存) | `lingobridge: Estimate Tokens of Selection` で通知表示、選択がなければドキュメント全体 | done |
| FUN-04 | エディタタイトルバーにワンクリック翻訳ボタン | `→ EN` / `→ JA` 2 アイコンを表示 | done |
| FUN-05 | エディタコンテキストメニューに翻訳項目を追加 | 右クリックで `lingobridge` サブメニュー内に 3 操作 | done |
| FUN-06 | Activity Bar に専用ビュー (アイコン: 🌐) | アイコン 1 つ。クリックで翻訳パネル | done |
| FUN-07 | Activity Bar 翻訳パネル UI | 方向選択 / 入力欄 (リアルタイム tok) / 実行ボタン / 結果欄 (実行後 tok) / コピー / 新規タブで開く | done |
| FUN-08 | プロバイダ表示と設定アクセス | パネルにプロバイダ名と利用可否バッジ、view/title の ⚙ から settings へジャンプ | done |
| FUN-09 | Status Bar に現在ドキュメントのトークン数 | `📊 1.2k tok` 形式 (言語ラベルなし)、選択時は `sel` プレフィックス | done |
| FUN-10 | 翻訳プロバイダの抽象化 | `TranslationProvider` インターフェース。`atrans` と `libretranslate` を実装 | done |
| FUN-11 | 翻訳前の保護機能 (最小実装) | コードブロック / インラインコード / URL を退避し復元。settings で ON/OFF | done |
| FUN-12 | 入力欄 Enter で翻訳実行 | `lingobridge.input.translateOnEnter` (default `true`)。Shift+Enter は改行、IME 変換中は誤発火しない | done |
| FUN-13 | 出力ファイル命名規則 | `README.md` → `README.en.md` / 既存の `.ja.` 等は置換 / 拡張子なしは `<name>.en` | done |

## 3. 非機能要件

| ID | 要件 | Status |
| --- | --- | --- |
| NFR-01 | settings.json で各種挙動を制御可能 | done (10 項目) |
| NFR-02 | 翻訳本文は引数ではなく stdin で渡す (機密情報の漏出抑止) | done (atrans) |
| NFR-03 | Webview は CSP + nonce で script-src を制限 | done |
| NFR-04 | 公開 VS Code API のみ使用、Copilot Chat の DOM 介入は行わない | done |

## 4. 設定 (contributes.configuration)

| キー | 型 | 既定 | 用途 |
| --- | --- | --- | --- |
| `lingobridge.provider.active` | enum (`atrans` \| `libretranslate`) | `atrans` | 使用プロバイダ |
| `lingobridge.protection.enabled` | boolean | `true` | 保護機能 ON/OFF |
| `lingobridge.atrans.path` | string | `""` | atrans CLI 絶対パス (空で自動検出) |
| `lingobridge.atrans.timeoutMs` | number | `30000` | atrans タイムアウト |
| `lingobridge.libretranslate.endpoint` | string | `http://127.0.0.1:5000` | LibreTranslate サーバURL |
| `lingobridge.libretranslate.apiKey` | string | `""` | LibreTranslate API キー (任意) |
| `lingobridge.libretranslate.timeoutMs` | number | `30000` | LibreTranslate タイムアウト |
| `lingobridge.output.openInNewTab` | boolean | `true` | 翻訳結果を新規タブで開く |
| `lingobridge.statusBar.enabled` | boolean | `true` | Status Bar 表示 |
| `lingobridge.input.translateOnEnter` | boolean | `true` | 入力欄 Enter で翻訳実行 |
| `lingobridge.tokenEstimator.engine` | enum (`heuristic` \| `tiktoken`) | `heuristic` | トークン推定エンジン (`tiktoken` で js-tiktoken cl100k_base 使用) |

> 注: トークン推定の係数 (旧案 `tokenEstimator.charsPerToken`) は、言語認識型推定 (旧 PromptBridge アルゴリズム移植) を採用したため不要となり、削除しました。

## 5. UI モックアップ

承認済み: [docs/ui-mockup/activity-bar-mockup.html](ui-mockup/activity-bar-mockup.html)

## 6. プロバイダ

### 6.1 atrans (既定)

- macOS の Apple Translation framework を呼ぶ CLI (`brew install taogya/atrans/atrans`)。
- 実装: [src/providers/atransProvider.ts](../src/providers/atransProvider.ts)
- 100 文字程度で 1 秒以内 (M1 環境) を想定。

### 6.2 LibreTranslate

- Python 単独で完結 (Docker 不要):
  ```bash
  pip install libretranslate
  libretranslate --host 127.0.0.1 --port 5000 --load-only ja,en
  ```
- 拡張は `POST http://127.0.0.1:5000/translate` を叩く。
- 実装: [src/providers/libreTranslateProvider.ts](../src/providers/libreTranslateProvider.ts)
- 設定: `lingobridge.libretranslate.endpoint`, `lingobridge.libretranslate.apiKey`, `lingobridge.libretranslate.timeoutMs`。
- `checkAvailability()` で `/languages` を叩き ja↔en モデルの読み込みを検知する。

### 6.3 検討の経緯

- Bergamot Translator (Mozilla) は **日本語ペアの公式モデルが提供されておらず**、`firefox-translations-models` も 2025-12 にアーカイブ済みのため不採用。
- Ollama は速度・品質バランスは可だが「100 文字 1 秒以内」を保証しにくいため次々候補。
- LibreTranslate は導入容易性とマルチプラットフォーム性で次期採用。

## 7. リポジトリ名

- `lingobridge` で確定。

## 8. 旧 PromptBridge との関係

- 旧コードは `old/` 配下に保管 (削除しない)。
- 旧拡張がインストールされている環境では Status Bar に `文書 JA 9.1k` 等が併記される場合がある。`PromptBridge` 拡張を **Disable** または **Uninstall** することで lingobridge の表示のみになる。

## 9. .github 構成

- `copilot-instructions.md` と `state/active-work.md` + `state/work-items/` の最小構成のみ移植。
- マルチエージェント (`agents/`) は新プロジェクト規模に見合わないため不採用。
