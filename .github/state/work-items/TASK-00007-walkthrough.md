# TASK-00007-walkthrough

- Version: v0.2.1
- Status: done
- Owner: -

## Goal

VS Code の Get Started (Walkthrough) 機構を使い、初回インストール時にプロバイダ選択 → セットアップ → 動作確認までを誘導する。

## Acceptance

- [x] `package.json` の `contributes.walkthroughs` を追加。ID: `lingobridge.gettingStarted`。
- [x] ステップ: welcome / pickProvider / installAtrans (macOSのみ) / installLibre / firstTranslation。
- [x] `media/walkthrough/*.md` でコンテンツを提供。
- [x] `completionEvents` を適切に設定 (`onCommand:lingobridge.focusTranslateView`, `onSettingChanged:lingobridge.provider.active`, 翻訳コマンド実行)。

## Notes

- v0.2.1 で取り込み。画像は将来応謝。
