# resources/

拡張機能のアセット置き場です。

## icon.png

VS Code Marketplace と拡張一覧に表示されるアイコン (128×128 PNG)。
デフォルトは「LB」を白抜きにした青の角丸アイコンを同梱しています。

差し替える手順:

1. 任意のロゴを `128×128` (推奨) または `256×256` の PNG で用意します。
2. このフォルダの `icon.png` を上書きします。
3. `npx @vscode/vsce package --allow-missing-repository` で VSIX を再生成します。

`package.json` の `"icon"` フィールドからこのファイルを参照しているため、
ファイル名を変える場合は `package.json` も合わせて更新してください。
