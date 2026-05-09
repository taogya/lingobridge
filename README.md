# lingobridge

VS Code でドキュメントを **日本語 ⇔ 英語** に素早く翻訳し、トークン量を見える化する拡張です。
旧 PromptBridge をシンプル化リブートしました。

## できること (v0.1.0)

- **ワンクリック翻訳**: エディタタイトルバー右の `→ EN` / `→ JA` ボタンで現在のドキュメント全体を翻訳し、新規タブ (`<元名>.en.<ext>` / `<元名>.ja.<ext>`) で開きます。
- **コマンドパレット**: `Ctrl+Shift+P` から
  - `lingobridge: Translate Document JA → EN`
  - `lingobridge: Translate Document EN → JA`
  - `lingobridge: Estimate Tokens of Selection` (言語非依存)
- **右クリック (エディタ内)**: 同じ 3 操作にアクセス可能。
- **Activity Bar**: 🌐 アイコン (lingobridge) から翻訳パネルを起動。入力欄でリアルタイムにトークン更新、翻訳実行で結果と結果トークン表示、コピー / 新規タブで開く。
- **Status Bar**: `📊 1.2k tok` 形式 (選択時は選択分、未選択時はドキュメント全体)。言語ラベルなし。
- **保護機能 (任意)**: コードブロック・インラインコード・URL を翻訳前に退避し、翻訳後に復元。

## 設定 (settings.json)

| キー | 既定 | 説明 |
| --- | --- | --- |
| `lingobridge.provider.active` | `atrans` | 使用プロバイダ (`atrans` \| `libretranslate`) |
| `lingobridge.protection.enabled` | `true` | 保護機能 ON/OFF |
| `lingobridge.output.openInNewTab` | `true` | 翻訳結果を新規タブで開く |
| `lingobridge.statusBar.enabled` | `true` | Status Bar 表示 |
| `lingobridge.input.translateOnEnter` | `true` | 入力欄 Enter で翻訳実行 |
| `lingobridge.tokenEstimator.engine` | `heuristic` | `tiktoken` で `js-tiktoken` (cl100k_base) に切替 |

プロバイダ個別の設定と導入手順は [docs/setup/providers/](docs/setup/providers/README.md) を参照してください。
そのまま貼り付けられる `settings.json` サンプルは [examples/settings/](examples/settings/README.md) にあります。

## プロバイダ

使用するプロバイダを 1 つ以上セットアップしてください。導入手順は各ドキュメントを参照:

- [atrans (macOS)](docs/setup/providers/atrans.md) — 既定。Apple Translation framework。
- [LibreTranslate (マルチOS)](docs/setup/providers/libretranslate.md) — ローカル Python サーバ。

## 開発

```bash
cd lingobridge
npm install
npm run compile
# F5 で Extension Development Host を起動
npm test
```

## インストール

### ユーザー向け

VS Code Marketplace から `lingobridge` を検索してインストールしてください。

### 開発者向け (VSIX 手動インストール)

```bash
cd lingobridge
npm install
npm run package:vsix     # lingobridge-0.1.0.vsix を生成
code --install-extension lingobridge-0.1.0.vsix
# アンインストールは code --uninstall-extension taogya.lingobridge
```

## ライセンス

BSD-3-Clause (Copyright © 2026 Taogya). 詳細は [LICENSE](LICENSE)。
