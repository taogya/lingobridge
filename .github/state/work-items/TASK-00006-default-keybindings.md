# TASK-00006-default-keybindings

- Version: v0.2.0
- Status: done
- Owner: lingobridge

## Goal

主要コマンドに既定キーバインドを割り当て、エディタタイトルバー以外からも素早く翻訳できるようにした。

## Acceptance

- [x] `package.json` の `contributes.keybindings` に以下を追加:

  | コマンド | mac | win/linux | when |
  | --- | --- | --- | --- |
  | `lingobridge.translateDocument` (Picker) | `cmd+alt+l` | `ctrl+alt+l` | `editorTextFocus` |
  | `lingobridge.translateDocumentToEnglish` | `cmd+alt+e` | `ctrl+alt+e` | `editorTextFocus` |
  | `lingobridge.translateDocumentToJapanese` | `cmd+alt+j` | `ctrl+alt+j` | `editorTextFocus` |
  | `lingobridge.estimateSelectionTokens` | `cmd+alt+t` | `ctrl+alt+t` | `editorHasSelection` |
  | `lingobridge.focusTranslateView` | `cmd+alt+shift+l` | `ctrl+alt+shift+l` | (none) |

- [x] インタラクティブに「キーバインドは Keybindings UI で差替可」を README に明記。
- [x] 翻訳パネルにフォーカスを当てるコマンド (`lingobridge.focusTranslateView`) を新設しバインドに使用。
- [x] settings からの無効化スイッチは設けず、Keybindings UI で差替してもらう。

## Notes

- `cmd+alt+t` は Terminal 系拡張と衝突しがちなため README に差替手順を明記。
- 公開後に衝突報告が来たら代替キーを検討。


## Goal

主要コマンドに既定キーバインドを割り当て、エディタタイトルバー以外からも素早く翻訳できるようにする。OS ごとに衝突しない安全なバインドを選定する。

## Acceptance

- [ ] `package.json` の `contributes.keybindings` に以下を追加 (案):

  | コマンド | mac | win/linux | when |
  | --- | --- | --- | --- |
  | `lingobridge.translateDocumentToEnglish` | `cmd+alt+e` | `ctrl+alt+e` | `editorTextFocus` |
  | `lingobridge.translateDocumentToJapanese` | `cmd+alt+j` | `ctrl+alt+j` | `editorTextFocus` |
  | `lingobridge.estimateSelectionTokens` | `cmd+alt+t` | `ctrl+alt+t` | `editorHasSelection` |
  | (View focus) | `cmd+alt+l` | `ctrl+alt+l` | `!editorTextFocus` または `view.lingobridge.translatePanel.focus` |

- [ ] 衝突調査: VS Code 既定および主要拡張 (Copilot Chat / GitHub PR) と当たらないこと。
- [ ] 各バインドはあくまで既定であり、ユーザーが Keybindings UI から差替できることを README に明記。
- [ ] 翻訳パネルにフォーカスを当てるコマンド (`lingobridge.focusTranslateView`) を新設しバインドに使用。
- [ ] settings からの無効化スイッチは設けない (キーバインド差替で対応)。

## Notes

- `cmd+alt+t` は Terminal 系拡張と衝突しがち。最終的なバインドは試験後に確定。
- Marketplace 公開後に「キーバインドが当たる」報告が来た場合の差替案も README に書く。
