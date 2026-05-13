# settings.json サンプル

各プロバイダの推奨設定例です。VS Code のユーザー / ワークスペース
`settings.json` にマージしてください。プロバイダ以外の設定は既定値のままで動作します。

| プロバイダ | ファイル |
| --- | --- |
| atrans (macOS) | [atrans.settings.jsonc](atrans.settings.jsonc) |
| LibreTranslate (マルチOS) | [libretranslate.settings.jsonc](libretranslate.settings.jsonc) |
| transformers (マルチOS) | [transformers.settings.jsonc](transformers.settings.jsonc) |

> `.jsonc` 形式 (コメント付き JSON) です。コピー時はコメント行を取り除いて
> `settings.json` に貼り付けてください (VS Code の `settings.json` は JSONC 対応)。

導入手順は [docs/setup/providers/](../../docs/setup/providers/README.md) を参照。
