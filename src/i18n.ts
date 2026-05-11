import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * `vscode.l10n.t(key)` returns the *first argument as-is* when no localized
 * bundle is loaded (e.g. running in an English VS Code, where the extension
 * does not ship a `bundle.l10n.en.json`). The result is that users on en
 * would see raw keys like `ui.provider`. To avoid that, we eagerly load
 * `l10n/bundle.l10n.json` (which already holds the canonical English source
 * for every key) and use it as a fallback whenever `vscode.l10n.t` returns
 * the key unchanged. Issue #1.
 */

let cached: Record<string, string> | null = null;

function loadEnglishBundle(): Record<string, string> {
  if (cached) return cached;
  const candidates = [
    // dist/i18n.js -> ../l10n/bundle.l10n.json (production layout in VSIX)
    path.join(__dirname, '..', 'l10n', 'bundle.l10n.json'),
    // out/src/i18n.js -> ../../l10n/bundle.l10n.json (test layout)
    path.join(__dirname, '..', '..', 'l10n', 'bundle.l10n.json')
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        cached = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, string>;
        return cached;
      }
    } catch {
      // try next
    }
  }
  cached = {};
  return cached;
}

export type L10nKey = string;

export function tr(key: L10nKey, ...args: (string | number)[]): string {
  const out = vscode.l10n.t(key, ...args);
  if (out !== key) return out;
  const en = loadEnglishBundle()[key];
  if (typeof en !== 'string') return key;
  return formatTemplate(en, args);
}

function formatTemplate(template: string, args: (string | number)[]): string {
  return template.replace(/\{(\d+)\}/g, (_, idx) => {
    const v = args[Number(idx)];
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Test-only: reset the cached English bundle. */
export function _resetCacheForTests(): void {
  cached = null;
}
