/**
 * Minimal protection layer: replace fragile fragments with placeholders before
 * translation, then restore them after. MVP scope:
 *   - Markdown fenced code blocks (``` ... ```)
 *   - Inline code (` ... `)
 *   - URLs (http(s)://...)
 *
 * Placeholder format: `⟦LB_<index>⟧` (rare unicode brackets to avoid collision).
 */

const PLACEHOLDER_PREFIX = '⟦LB_';
const PLACEHOLDER_SUFFIX = '⟧';

export interface ProtectionResult {
  protectedText: string;
  restore: (translated: string) => string;
}

interface Pattern {
  name: string;
  regex: RegExp;
}

const PATTERNS: Pattern[] = [
  // Fenced code blocks first (greedy multi-line).
  { name: 'fenced', regex: /```[\s\S]*?```/g },
  // Inline code.
  { name: 'inline', regex: /`[^`\n]+`/g },
  // URLs (simple).
  { name: 'url', regex: /https?:\/\/[^\s)<>"]+/g }
];

export function protect(text: string): ProtectionResult {
  const stash: string[] = [];

  let working = text;
  for (const p of PATTERNS) {
    working = working.replace(p.regex, (match) => {
      const idx = stash.length;
      stash.push(match);
      return `${PLACEHOLDER_PREFIX}${idx}${PLACEHOLDER_SUFFIX}`;
    });
  }

  const restore = (translated: string): string => {
    let out = translated;
    // Replace longest indices first (defensive though not strictly necessary).
    for (let i = stash.length - 1; i >= 0; i--) {
      const ph = `${PLACEHOLDER_PREFIX}${i}${PLACEHOLDER_SUFFIX}`;
      // Replace all occurrences (translation engines may keep them intact).
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
