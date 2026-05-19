/**
 * Pluggable protection layer. Each rule replaces fragile fragments with
 * placeholders before translation, then restores them after.
 *
 * Targets and their settings keys (under `lingobridge.protection.targets`):
 *   - fencedCode      ``` ... ``` blocks
 *   - inlineCode      ` ... ` runs
 *   - mathBlock       `$$ ... $$` (LaTeX block math, multi-line)
 *   - mathInline      `$ ... $` (LaTeX inline math, avoids currency)
 *   - htmlInline      whitelisted inline HTML tags (`<br>` `<kbd>` `<sub>` …)
 *   - autoLink        `<https://…>` / `<mailto:…>` / `<user@host>`
 *   - url             http(s)://... URLs
 *   - inlineEmphasis  `**bold**` / `__bold__` / `~~strike~~` markers (text translated)
 *   - markdownLink    `[text](url)` / `![alt](src)` markup (text/alt translated)
 *   - referenceLink   `[text][ref]` references + `[ref]: url` definition lines
 *   - taskList        `- [ ]` / `- [x]` checkbox markers
 *   - markdownHeading `# / ## / ### ...` (leading marker only)
 *   - markdownTable   `| --- | :--- |` separator rows
 *   - markdownList    `- / * / + / 1.` line markers
 *   - shellCommand    lines starting with `$ `
 *   - filePath        `/abs/path` or `./rel/path` segments (no spaces)
 *   - logLine         `[INFO]` / `[2024-01-01 ...]` log prefixes
 *   - diffMarker      `+` / `-` line prefixes (single char + space)
 *   - identifier      snake_case / CamelCase / kebab-case identifiers
 *
 * Default: fencedCode / inlineCode / url / inlineEmphasis / markdownLink
 * plus mathBlock / mathInline / htmlInline / autoLink / referenceLink /
 * taskList are enabled. The remaining rules stay opt-in.
 *
 * Placeholder format: `⟦LB_<index>⟧` (rare unicode brackets to avoid collision).
 */

const PLACEHOLDER_PREFIX = '⟦LB_';
const PLACEHOLDER_SUFFIX = '⟧';
// Relaxed regex to match `LB_<index>` with tolerance for mutations like:
// - PLACEHOLDER_0_END (some MT models wrap it with alphanumeric prefix/suffix)
// - (LB_0) - parentheses
// - LB_0 - plain
// - [LB 0] - brackets with space
// - LB-0-END - dashes
// Core: match LB followed by optional separators and 1-6 digits
// Surrounding: optional non-word chars before, optional alphanumeric suffix before word boundary
const RELAXED_PLACEHOLDER_REGEX = /(?:\w*[_\s-]*)?LB[_\s-]*(\d{1,6})(?:[_\-\w]*)?(?=\s|$|[^\w_-])/gi;

export type ProtectionTargetKey =
  | 'fencedCode'
  | 'inlineCode'
  | 'mathBlock'
  | 'mathInline'
  | 'htmlInline'
  | 'autoLink'
  | 'url'
  | 'inlineEmphasis'
  | 'markdownLink'
  | 'referenceLink'
  | 'taskList'
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
  // Issue #7 follow-up (v0.3.4) — additional Markdown notations frequently
  // used in technical docs are preserved by default so destructive
  // translators cannot mangle them.
  mathBlock: true,
  mathInline: true,
  htmlInline: true,
  autoLink: true,
  url: true,
  inlineEmphasis: true,
  markdownLink: true,
  referenceLink: true,
  taskList: true,
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
  // LaTeX block math `$$ ... $$` (multi-line). Must run BEFORE mathInline
  // so the surrounding `$$` is not captured as two single-`$` spans.
  regexRule('mathBlock', /\$\$[\s\S]+?\$\$/g),
  // LaTeX inline math `$ ... $`. Reject currency-like `$10` / `$ 10` and
  // require non-space immediately inside the delimiters.
  regexRule(
    'mathInline',
    /\$(?=\S)[^$\n]{1,200}?(?<=\S)\$(?!\d)/g
  ),
  // Inline HTML tags (whitelisted). Tags that frequently appear in
  // Markdown but get stripped by destructive translators.
  regexRule(
    'htmlInline',
    /<\/?(?:br|hr|kbd|sub|sup|code|span|em|strong|i|b|u|mark|small|del|ins|abbr|cite|dfn|var|samp|q)(?:\s[^<>\n]{0,200})?\/?>/gi
  ),
  // Markdown autolinks `<https://...>` / `<mailto:...>` / `<user@host>`.
  // Run BEFORE `url` so the surrounding `<>` is preserved as one token.
  regexRule(
    'autoLink',
    /<(?:https?:\/\/[^>\s]+|mailto:[^>\s]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>/g
  ),
  // URLs (simple). Run before markdownLink so the URL inside `[](...)` is
  // protected as its own placeholder.
  regexRule('url', /https?:\/\/[^\s)<>"]+/g),
  // Issue #7 — Inline emphasis markers (`**bold**`, `__bold__`, `~~strike~~`).
  // We stash only the markers so the inner text is still translated.
  {
    key: 'inlineEmphasis',
    apply: (text, stash) => {
      let s = text;
      s = s.replace(/\*\*([^*\n]+?)\*\*/g, (_m, inner: string) =>
        `${stash('**')}${inner}${stash('**')}`);
      s = s.replace(/__([^_\n]+?)__/g, (_m, inner: string) =>
        `${stash('__')}${inner}${stash('__')}`);
      s = s.replace(/~~([^~\n]+?)~~/g, (_m, inner: string) =>
        `${stash('~~')}${inner}${stash('~~')}`);
      return s;
    }
  },
  // Issue #7 — Markdown link / image syntax. Stash the bracketing markup so
  // destructive translators (transformers / libretranslate) cannot strip
  // it; the visible label/alt text remains translatable.
  {
    key: 'markdownLink',
    apply: (text, stash) => {
      let s = text;
      // Image first so its leading `!` is captured as part of the literal.
      s = s.replace(/!\[([^\]\n]*)\]\(([^)\n]+)\)/g, (_m, alt: string, src: string) =>
        `${stash('![')}${alt}${stash(`](${src})`)}`);
      s = s.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_m, label: string, url: string) =>
        `${stash('[')}${label}${stash(`](${url})`)}`);
      return s;
    }
  },
  // Reference-style links and definitions.
  //   - Inline reference:  `[text][ref]`  -> keep `text` translatable, stash `[`/`][ref]`.
  //   - Collapsed:         `[ref][]`      -> same form (label == ref).
  //   - Definition line:   `[ref]: url "title"` -> stash the whole line.
  {
    key: 'referenceLink',
    apply: (text, stash) => {
      let s = text;
      // Definition lines first (full line stash).
      s = s.replace(
        /^[ \t]{0,3}\[[^\]\n]+\]:[ \t]+\S[^\n]*$/gm,
        (m) => stash(m)
      );
      // Inline reference form `[text][ref]`. Avoid matching `[text](url)`.
      s = s.replace(
        /\[([^\]\n]+)\]\[([^\]\n]*)\]/g,
        (_m, label: string, ref: string) =>
          `${stash('[')}${label}${stash(`][${ref}]`)}`
      );
      return s;
    }
  },
  // GitHub-flavored task list markers `[ ]` / `[x]` after a list bullet.
  // We stash only the checkbox, leaving the surrounding bullet/text alone
  // so the regular list/heading splitters keep working.
  regexRule(
    'taskList',
    /(?<=^[ \t]{0,8}(?:[-*+]|\d{1,3}\.)[ \t]+)\[[ xX]\](?=[ \t])/gm
  ),
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
    // Iterate until the output stabilises. Stash values may themselves
    // contain placeholders (e.g. the markdownLink rule embeds the protected
    // URL token inside its `](...)` literal), so a single pass is not enough.
    for (let pass = 0; pass < 6; pass++) {
      const before = out;
      // Exact match first — fast path when the placeholder survived intact.
      for (let i = stash.length - 1; i >= 0; i--) {
        const ph = `${PLACEHOLDER_PREFIX}${i}${PLACEHOLDER_SUFFIX}`;
        if (out.includes(ph)) out = out.split(ph).join(stash[i]);
      }
      // Issue #7 (v0.3.4): some translators preserve the outer `⟦⟧`
      // brackets but strip the inner `_` (so `⟦LB_0⟧` arrives as `⟦LB0⟧`).
      // Recover the whole bracketed token in one shot so neither the
      // brackets nor the payload digits are left orphaned.
      out = out.replace(/⟦([^⟦⟧\n]{1,40})⟧/g, (m, inner: string) => {
        const hit = /LB[_\s\-]*(\d{1,6})/i.exec(inner);
        if (!hit) return m;
        const idx = Number(hit[1]);
        if (!Number.isInteger(idx) || idx < 0 || idx >= stash.length) return m;
        return stash[idx];
      });
      if (out === before) break;
    }

    // Some MT models rewrite uncommon glyphs and return variants like
    // "LB_0..." or "[LB 0]". Recover those forms as a best-effort fallback.
    out = out.replace(RELAXED_PLACEHOLDER_REGEX, (m, rawIndex: string) => {
      const idx = Number(rawIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= stash.length) return m;
      return stash[idx];
    });
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
