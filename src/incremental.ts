import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageCode, TranslateResult, TranslationDirection } from './providers/translationProvider';
import { translateText } from './translationService';

/**
 * Incremental (block-diff) translation. Splits the source document into
 * blocks, hashes each, and reuses prior translations for blocks whose hash
 * is unchanged. The cache is stored alongside the output file as a sidecar
 * JSON (`<basename>.<lang>.lb.json`).
 *
 * Block strategy:
 *   - Markdown documents (languageId === 'markdown' OR `.md`/`.markdown`):
 *     split by headings (lines starting with `#`) and blank-line groups
 *     within each section.
 *   - Plain text: split by blank lines (paragraphs).
 *
 * See TASK-00005-incremental-translation.md.
 */

export interface IncrementalStats {
  translated: number;
  reused: number;
  total: number;
  outputText: string;
}

interface SidecarV1 {
  version: 1;
  from: LanguageCode;
  to: LanguageCode;
  blocks: { hash: string; output: string }[];
}

const SIDECAR_VERSION = 1;

interface BlockSpan {
  /** Translatable text content of the block (normalized for hashing). */
  text: string;
  /** Original raw text (preserves internal whitespace) used when reusing. */
  raw: string;
  /** Separator that follows this block in the output (usually `\n\n`). */
  separator: string;
  /** True when the block is purely whitespace and should be passed through. */
  passthrough: boolean;
}

/** Split source into translatable blocks plus inter-block separators. */
export function splitBlocks(text: string, languageId?: string): BlockSpan[] {
  const isMarkdown =
    languageId === 'markdown' ||
    /\.(md|markdown)$/i.test(languageId ?? '');
  const lines = text.split(/\r?\n/);
  const blocks: BlockSpan[] = [];
  let buf: string[] = [];

  const flush = (): void => {
    if (buf.length === 0) return;
    const raw = buf.join('\n');
    const trimmed = raw.trim();
    blocks.push({
      text: normalize(trimmed),
      raw,
      separator: '\n\n',
      passthrough: trimmed.length === 0
    });
    buf = [];
  };

  for (const line of lines) {
    const isHeading = isMarkdown && /^#{1,6}[ \t]+/.test(line);
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (isHeading) {
      flush();
      blocks.push({
        text: normalize(line),
        raw: line,
        separator: '\n\n',
        passthrough: false
      });
      continue;
    }
    buf.push(line);
  }
  flush();
  return blocks;
}

function normalize(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

export function hashBlock(text: string): string {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex');
}

export function sidecarPathFor(outputFsPath: string): string {
  const dir = path.dirname(outputFsPath);
  const base = path.basename(outputFsPath);
  return path.join(dir, `.${base}.lb.json`);
}

export function readSidecar(filePath: string): SidecarV1 | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SidecarV1;
    if (data?.version !== SIDECAR_VERSION) return undefined;
    if (!Array.isArray(data.blocks)) return undefined;
    return data;
  } catch {
    return undefined;
  }
}

export function writeSidecar(filePath: string, data: SidecarV1): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export interface IncrementalOptions {
  direction: TranslationDirection;
  /** Existing sidecar cache (block hash → translation), if any. */
  cache?: SidecarV1;
  /** Source text + languageId for block splitting. */
  source: string;
  languageId?: string;
  /**
   * Optional translator override. Defaults to {@link translateText}. Useful
   * for tests so we don't need to spin up a real provider.
   */
  translator?: (text: string, direction: TranslationDirection) => Promise<TranslateResult>;
}

/**
 * Translate only blocks whose hash differs from the cache. Returns the
 * merged output and statistics for status-bar display.
 */
export async function translateIncremental(
  options: IncrementalOptions
): Promise<{ stats: IncrementalStats; sidecar: SidecarV1 }> {
  const blocks = splitBlocks(options.source, options.languageId);
  const cacheMap = new Map<string, string>();
  if (options.cache && options.cache.from === options.direction.from && options.cache.to === options.direction.to) {
    for (const b of options.cache.blocks) cacheMap.set(b.hash, b.output);
  }

  let translated = 0;
  let reused = 0;
  const outputs: string[] = [];
  const sidecarBlocks: { hash: string; output: string }[] = [];

  for (const block of blocks) {
    if (block.passthrough) {
      outputs.push(block.raw);
      continue;
    }
    const h = hashBlock(block.text);
    const cached = cacheMap.get(h);
    if (cached !== undefined) {
      outputs.push(cached);
      sidecarBlocks.push({ hash: h, output: cached });
      reused++;
      continue;
    }
    const result = await (options.translator ?? translateText)(block.raw, options.direction);
    if (result.status !== 'ok' || result.translatedText === undefined) {
      const err = new Error(result.errorMessage ?? 'translation failed');
      throw err;
    }
    const out = result.translatedText;
    outputs.push(out);
    sidecarBlocks.push({ hash: h, output: out });
    translated++;
  }

  const text = outputs.join('\n\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  const sidecar: SidecarV1 = {
    version: SIDECAR_VERSION,
    from: options.direction.from,
    to: options.direction.to,
    blocks: sidecarBlocks
  };
  return {
    stats: {
      translated,
      reused,
      total: sidecarBlocks.length,
      outputText: text
    },
    sidecar
  };
}

/** Convenience: read a sidecar that lives next to a target output file. */
export function loadSidecarFor(outputFsPath: string): SidecarV1 | undefined {
  return readSidecar(sidecarPathFor(outputFsPath));
}

export function isIncrementalEnabled(): boolean {
  return vscode.workspace
    .getConfiguration('lingobridge')
    .get<boolean>('incremental.enabled', true);
}
