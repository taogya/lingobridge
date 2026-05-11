/**
 * Pluggable protection layer. Each rule replaces fragile fragments with
 * placeholders before translation, then restores them after.
 *
 * Targets and their settings keys (under `lingobridge.protection.targets`):
 *   - fencedCode      ``` ... ``` blocks
 *   - inlineCode      ` ... ` runs
 *   - url             http(s)://... URLs
 *   - markdownHeading `# / ## / ### ...` (leading marker only)
 *   - markdownTable   `| --- | :--- |` separator rows
 *   - markdownList    `- / * / + / 1.` line markers
 *   - shellCommand    lines starting with `$ `
 *   - filePath        `/abs/path` or `./rel/path` segments (no spaces)
 *   - logLine         `[INFO]` / `[2024-01-01 ...]` log prefixes
 *   - diffMarker      `+` / `-` line prefixes (single char + space)
 *   - identifier      snake_case / CamelCase / kebab-case identifiers
 *
 * Default: only fencedCode/inlineCode/url enabled (backward-compat).
 *
 * Placeholder format: `⟦LB_<index>⟧` (rare unicode brackets to avoid collision).
 */

const PLACEHOLDER_PREFIX = '⟦LB_';
const PLACEHOLDER_SUFFIX = '⟧';

export type ProtectionTargetKey =
  | 'fencedCode'
  | 'inlineCode'
  | 'url'
  | 'markdownHeading'
  | 'markdownTable'
  | 'markdownList'
  | 'shellCommand'
  | 'filePath'
  | 'logLine'
  | 'diffMarker'
  | 'identifier';

export type ProtectionTargets = Partial<Record<ProtectionTargetKey, boolean>>;

export const DEFAULT_PROTECTION_TARGETS: Record<ProtectionTargetKey, boolean> = {
  fencedCode: true,
  inlineCode: true,
  url: true,
  markdownHeading: false,
  markdownTable: false,
  markdownList: false,
  shellCommand: false,
  filePath: false,
  logLine: false,
  diffMarker: false,
  identifier: false
};

export interface ProtectionResult {
  protectedText: string;
  restore: (translated: string) => string;
}

interface Rule {
  key: ProtectionTargetKey;
  /**
   * Match callback: returns an array of `{ start, end, replace }` items
   * representing fragments to stash. Multiline rules can use regex.exec.
   */
  apply: (text: string, stash: (s: string) => string) => string;
}

function regexRule(key: ProtectionTargetKey, regex: RegExp): Rule {
  return {
    key,
    apply: (text, stash) => text.replace(regex, (match) => stash(match))
  };
}

/**
 * Line-prefix rule. Stashes the leading marker only (so the rest of the line
 * is still translated). Useful for headings/lists/diff markers/log prefixes.
 */
function linePrefixRule(key: ProtectionTargetKey, regex: RegExp): Rule {
  return {
    key,
    apply: (text, stash) =>
      text.replace(regex, (_match, prefix: string) => stash(prefix))
  };
}

const RULES: Rule[] = [
  // Fenced code blocks first (greedy multi-line).
  regexRule('fencedCode', /```[\s\S]*?```/g),
  // Inline code.
  regexRule('inlineCode', /`[^`\n]+`/g),
  // URLs (simple).
  regexRule('url', /https?:\/\/[^\s)<>"]+/g),
  // Markdown heading marker (1-6 # followed by a space).
  linePrefixRule('markdownHeading', /^(#{1,6}[ \t]+)/gm),
  // Markdown table separator rows: e.g. | --- | :---: |
  regexRule('markdownTable', /^\|(?:\s*:?-{2,}:?\s*\|)+\s*$/gm),
  // Markdown list item markers (- * + or `N.` followed by space).
  linePrefixRule('markdownList', /^([ \t]*(?:[-*+]|\d{1,3}\.)[ \t]+)/gm),
  // Shell command lines (opt-in): `$ command ...` (the whole line).
  regexRule('shellCommand', /^[ \t]*\$[ \t][^\n]*$/gm),
  // File paths (absolute or relative). Avoid trailing punctuation.
  regexRule('filePath', /(?:\.{1,2}\/|\/)[A-Za-z0-9_./-]+[A-Za-z0-9_/]/g),
  // Log line prefix: [INFO] / [2024-01-01T00:00:00] etc.
  linePrefixRule('logLine', /^(\[[^\]\n]{1,40}\][ \t]+)/gm),
  // Diff markers: leading + or - followed by a space (single char, line start).
  linePrefixRule('diffMarker', /^([+\-][ \t])/gm),
  // Identifier-like tokens: snake_case / CamelCase / kebab-case (>= 2 segments).
  regexRule(
    'identifier',
    /\b(?:[a-z][a-z0-9]*(?:_[a-z0-9]+)+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+|[a-z][a-z0-9]+(?:-[a-z0-9]+)+)\b/g
  )
];

export function protect(text: string, targets?: ProtectionTargets): ProtectionResult {
  const enabled = mergeTargets(targets);
  const stash: string[] = [];
  const stasher = (s: string): string => {
    const idx = stash.length;
    stash.push(s);
    return `${PLACEHOLDER_PREFIX}${idx}${PLACEHOLDER_SUFFIX}`;
  };

  let working = text;
  for (const rule of RULES) {
    if (!enabled[rule.key]) continue;
    working = rule.apply(working, stasher);
  }

  const restore = (translated: string): string => {
    let out = translated;
    // Replace from highest index downwards so earlier indices don't break the
    // tokens of later, longer indices (defensive).
    for (let i = stash.length - 1; i >= 0; i--) {
      const ph = `${PLACEHOLDER_PREFIX}${i}${PLACEHOLDER_SUFFIX}`;
      out = out.split(ph).join(stash[i]);
    }
    return out;
  };

  return { protectedText: working, restore };
}

/** Pass-through for when protection is disabled. */
export function noProtect(text: string): ProtectionResult {
  return { protectedText: text, restore: (t) => t };
}

function mergeTargets(t?: ProtectionTargets): Record<ProtectionTargetKey, boolean> {
  return { ...DEFAULT_PROTECTION_TARGETS, ...(t ?? {}) };
}
