> Status: completed (v0.3.0 — 2026-05-12)

# TASK-00014-onboarding-ux-redesign

- Version: v0.3.0
- Status: completed
- Owner: -

## Goal

Get Started / Walkthrough の初回導線を、狭い横幅でも意味が通り、日本語 UI でも違和感なく使える形に再設計する。
現状の VS Code walkthrough は 2 カラム固定 UI に依存しており、右側の markdown が狭幅では見えにくい。
また v0.2.1 時点では自動表示されず、再度開く入口も弱い。

## Acceptance

- [x] v0.3.0 の onboarding 方針を決定する。
  - A. VS Code walkthrough を継続し、各 step の description を主導線として短文化する。 ← 採用
  - B. 専用 Webview / Welcome 画面を追加し、walkthrough は薄いランチャとして残す。
- [x] 初回インストール後または初回有効化時に 1 回だけ onboarding を自動表示する。
  `globalState` (`lingobridge.onboarding.shown.v0.3.0`) で既読フラグを保持し、毎回は出さない。
- [x] コマンドパレットから再度開ける明示的な入口を追加する。
  `lingobridge: Open Getting Started` を提供。
- [x] エディタ 1 カラム相当の標準的な幅でも、主要ステップ
  (プロバイダ選択 / セットアップ / 初回翻訳) が右ペイン依存なしで理解できる。
- [x] walkthrough を継続する場合、`package.nls.json` / `package.nls.ja.json` と
  markdown 本文の言語切替方針を整理する。
  locale 別 markdown が必要なら TASK-00009 と整合させる。
- [ ] 手動確認: 日本語 UI / 英語 UI の両方で onboarding の見え方と導線を確認する。 (リリース前 QA で実施)

## Notes

- v0.2.1 の Get Started は横幅が広いと markdown が見えるが、狭幅では価値が大きく落ちる。
- `workbench.action.openWalkthrough` により programmatic open は可能。
- walkthrough に固執する必要はない。VS Code 標準 UI 制約が強い場合は専用 onboarding へ切り替える。