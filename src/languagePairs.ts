import * as vscode from 'vscode';
import { LanguageCode } from './providers/translationProvider';

/**
 * Declarative language pair entry stored under
 * `lingobridge.languagePairs` in settings.
 */
export interface LanguagePair {
  /** Source ISO 639-1 language code (e.g. `ja`). */
  from: LanguageCode;
  /** Target ISO 639-1 language code (e.g. `en`). */
  to: LanguageCode;
  /** Optional display label (e.g. `→ EN`). Auto-generated when omitted. */
  label?: string;
}

const DEFAULT_PAIRS: LanguagePair[] = [
  { from: 'ja', to: 'en', label: '→ EN' },
  { from: 'en', to: 'ja', label: '→ JA' }
];

const ISO_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{1,8})?$/;

/** Read configured language pairs from settings, with sensible fallbacks. */
export function getLanguagePairs(): LanguagePair[] {
  const cfg = vscode.workspace.getConfiguration('lingobridge');
  const raw = cfg.get<unknown>('languagePairs');
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_PAIRS];
  }
  const pairs: LanguagePair[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const from = typeof o.from === 'string' ? o.from.trim() : '';
    const to = typeof o.to === 'string' ? o.to.trim() : '';
    if (!ISO_RE.test(from) || !ISO_RE.test(to) || from === to) continue;
    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : defaultLabel(to);
    pairs.push({ from, to, label });
  }
  return pairs.length > 0 ? pairs : [...DEFAULT_PAIRS];
}

/** Build a default label like `→ EN` from a target lang code. */
export function defaultLabel(to: LanguageCode): string {
  return `→ ${to.toUpperCase()}`;
}

/** Build the `lingobridge.translateDocument` QuickPick item label. */
export function pairPickLabel(p: LanguagePair): string {
  const tag = `${p.from.toUpperCase()} → ${p.to.toUpperCase()}`;
  return p.label && p.label !== defaultLabel(p.to) ? `${tag}  ${p.label}` : tag;
}
