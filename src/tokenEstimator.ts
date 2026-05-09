/**
 * Language-aware lightweight token estimator (ported from old PromptBridge).
 *
 * Heuristic per character:
 *   - ASCII word char (A-Z a-z 0-9 _ $ -): accumulate into a run, then
 *     run contributes ceil(runLength / 4) tokens (≈ 4 chars per token).
 *   - Whitespace: 0 tokens.
 *   - CJK ideographs / hiragana / katakana / CJK compat: 1 token per char.
 *   - Other (symbols, punctuation, etc.): 0.5 tokens.
 *
 * Result is rounded up and clamped to >= 1 for non-empty input.
 * This is an estimate only; do NOT present as a billing-confirmed value.
 */
export function estimateTokens(text: string): number {
  return estimateTokensWith('heuristic', text);
}

export type TokenEngine = 'heuristic' | 'tiktoken';

/**
 * Estimate tokens with the given engine. `tiktoken` lazy-loads the
 * `js-tiktoken` package (cl100k_base, GPT-3.5/4 family) and falls back
 * to the heuristic if the package cannot be loaded.
 */
export function estimateTokensWith(engine: TokenEngine, text: string): number {
  if (!text) return 0;
  if (engine === 'tiktoken') {
    const n = tryTiktoken(text);
    if (n !== undefined) return n;
    // Fall through to heuristic if tiktoken unavailable.
  }
  return heuristicEstimate(text);
}

function heuristicEstimate(text: string): number {
  const normalized = text.replace(/\r\n/g, '\n');
  let tokens = 0;
  let asciiRunLength = 0;

  for (const char of normalized) {
    if (/^[A-Za-z0-9_$-]$/.test(char)) {
      asciiRunLength += 1;
      continue;
    }
    tokens += countAsciiRun(asciiRunLength);
    asciiRunLength = 0;

    if (/\s/.test(char)) continue;
    if (isCjkOrKana(char)) {
      tokens += 1;
      continue;
    }
    tokens += 0.5;
  }
  tokens += countAsciiRun(asciiRunLength);

  return Math.max(1, Math.ceil(tokens));
}

let cachedEncoder: { encode(text: string): unknown[] } | null | undefined;
function tryTiktoken(text: string): number | undefined {
  if (cachedEncoder === null) return undefined;
  try {
    if (cachedEncoder === undefined) {
      // Use the lite entry + only the cl100k_base rank file so we
      // don't ship every BPE vocabulary inside the VSIX.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const lite = require('js-tiktoken/lite') as {
        Tiktoken: new (rank: unknown) => { encode(text: string): unknown[] };
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rank = require('js-tiktoken/ranks/cl100k_base').default ??
        require('js-tiktoken/ranks/cl100k_base');
      cachedEncoder = new lite.Tiktoken(rank);
    }
    return cachedEncoder.encode(text).length;
  } catch {
    cachedEncoder = null;
    return undefined;
  }
}

function countAsciiRun(length: number): number {
  return length === 0 ? 0 : Math.ceil(length / 4);
}

function isCjkOrKana(char: string): boolean {
  const cp = char.codePointAt(0);
  if (cp === undefined) return false;
  return (
    (cp >= 0x3040 && cp <= 0x30ff) || // Hiragana, Katakana
    (cp >= 0x3400 && cp <= 0x9fff) || // CJK Unified Ideographs (incl. Ext A)
    (cp >= 0xf900 && cp <= 0xfaff)    // CJK Compatibility Ideographs
  );
}

/** Format like `1.2k tok` / `123 tok`. */
export function formatTokens(n: number): string {
  if (n < 1000) return `${n} tok`;
  const k = n / 1000;
  return `${k.toFixed(k >= 10 ? 0 : 1)}k tok`;
}
