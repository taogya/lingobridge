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
 *     split by structural lines (headings/quotes/lists/table rows) and
 *     blank-line-separated paragraphs. Structural lines are further split
 *     into literal markup parts and translatable text parts so the
 *     translator never sees raw markdown markers — this preserves the
 *     document structure even when the underlying model strips characters
 *     like `#`, `>`, `|` (Issue #7).
 *   - Plain text: split by blank lines (paragraphs).
 *
 * See TASK-00005-incremental-translation.md and Issue #7.
 */

export interface IncrementalStats {
  translated: number;
  reused: number;
  total: number;
  outputText: string;
}

interface SidecarV2 {
  version: 2;
  from: LanguageCode;
  to: LanguageCode;
  blocks: { hash: string; output: string }[];
}

const SIDECAR_VERSION = 2;

/** A literal/translatable sub-part of a structural block. */
interface BlockPart {
  /** Raw text of this part. */
  text: string;
  /** When true, the translator is invoked on `text`. */
  translatable: boolean;
}

interface BlockSpan {
  /**
   * Text used for cache hashing. For paragraph blocks this equals the
   * normalised raw block; for structural blocks it equals the joined
   * translatable parts so superficial markup edits don't invalidate cache.
   */
  text: string;
  /** Original raw segment used for translation or passthrough output. */
  raw: string;
  /** True when the segment is structural whitespace that should pass through. */
  passthrough: boolean;
  /**
   * When present, the block is rendered by translating each translatable
   * part and joining all parts in order. When absent, the block's `raw`
   * text is sent to the translator as-is.
   */
  parts?: BlockPart[];
}

interface MarkdownFence {
  marker: '`' | '~';
  length: number;
}

/**
 * Heuristically detect Markdown content even when `languageId` is unknown.
 *
 * Issue #7 (v0.3.5): the Translate webview panel cannot read the source
 * document's `languageId` reliably — `vscode.window.activeTextEditor`
 * returns `undefined` whenever the panel itself has focus (sidebar view).
 * Without sniffing, structural splitting was bypassed and whole paragraphs
 * (including `#` / `|` / `-` markers) were pushed through destructive
 * translators, producing output that differed from `Ctrl+Alt+E`.
 *
 * The sniffer fires when ANY of the following Markdown signals appears:
 *   - a fenced code block (``` … ```),
 *   - a heading line (`#` … `######` followed by space),
 *   - a blockquote line (`> `),
 *   - a bulleted/numbered list item (`-`/`*`/`+`/`N.` followed by space),
 *   - a table row (`| … |`).
 */
export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  if (/```/.test(text)) return true;
  return /^[ \t]{0,3}(?:#{1,6}[ \t]+|>[ \t]?|(?:[-*+]|\d{1,3}\.)[ \t]+|\|.*\|[ \t]*$)/m.test(text);
}

/** Split source into translatable blocks plus inter-block separators. */
export function splitBlocks(text: string, languageId?: string): BlockSpan[] {
  const explicitMarkdown =
    languageId === 'markdown' ||
    /\.(md|markdown)$/i.test(languageId ?? '');
  const isMarkdown = explicitMarkdown || (!languageId && looksLikeMarkdown(text));
  const lines = tokenizeLines(text);
  const blocks: BlockSpan[] = [];
  let paragraph: string[] = [];
  let separator = '';
  let fence: MarkdownFence | undefined;
  let fenceLines: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    const raw = paragraph.join('\n');
    blocks.push({
      text: normalize(raw),
      raw,
      passthrough: false
    });
    paragraph = [];
  };

  const flushSeparator = (): void => {
    if (!separator) return;
    blocks.push({
      text: '',
      raw: separator,
      passthrough: true
    });
    separator = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];

    if (fence) {
      fenceLines.push(line.text + line.newline);
      if (isMarkdownFenceCloser(line.text, fence)) {
        blocks.push({
          text: '',
          raw: fenceLines.join(''),
          passthrough: true
        });
        fence = undefined;
        fenceLines = [];
      }
      continue;
    }

    const fenceOpener = isMarkdown ? parseMarkdownFenceOpener(line.text) : undefined;
    const blank = line.text.trim() === '';
    const structural = isMarkdown && isMarkdownStructuralLine(line.text);
    const nextContinuesParagraph =
      next !== undefined &&
      next.text.trim() !== '' &&
      !(isMarkdown && (isMarkdownStructuralLine(next.text) || parseMarkdownFenceOpener(next.text)));

    if (blank) {
      flushParagraph();
      separator += line.newline;
      continue;
    }

    if (fenceOpener) {
      flushParagraph();
      flushSeparator();
      fence = fenceOpener;
      fenceLines = [line.text + line.newline];
      continue;
    }

    if (structural) {
      flushParagraph();
      flushSeparator();
      const parts = splitMarkdownStructuralLine(line.text);
      blocks.push({
        text: joinTranslatable(parts),
        raw: line.text,
        passthrough: false,
        parts
      });
      separator += line.newline;
      continue;
    }

    if (paragraph.length === 0) {
      flushSeparator();
    }
    paragraph.push(line.text);

    if (!nextContinuesParagraph) {
      flushParagraph();
      separator += line.newline;
    }
  }

  flushParagraph();
  if (fence && fenceLines.length > 0) {
    blocks.push({
      text: '',
      raw: fenceLines.join(''),
      passthrough: true
    });
  }
  flushSeparator();
  return blocks;
}

interface TokenizedLine {
  text: string;
  newline: string;
}

function tokenizeLines(text: string): TokenizedLine[] {
  if (!text) return [];
  const lines: TokenizedLine[] = [];
  let start = 0;
  while (start < text.length) {
    const end = text.indexOf('\n', start);
    if (end === -1) {
      lines.push({ text: text.slice(start), newline: '' });
      break;
    }
    lines.push({ text: text.slice(start, end), newline: '\n' });
    start = end + 1;
  }
  return lines;
}

function parseMarkdownFenceOpener(line: string): MarkdownFence | undefined {
  const match = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return undefined;
  return {
    marker: match[1][0] as '`' | '~',
    length: match[1].length
  };
}

function isMarkdownFenceCloser(line: string, fence: MarkdownFence): boolean {
  const trimmed = line.replace(/^[ \t]{0,3}/, '');
  const match = /^(`{3,}|~{3,})[ \t]*$/.exec(trimmed);
  return !!match && match[1][0] === fence.marker && match[1].length >= fence.length;
}

function isMarkdownStructuralLine(line: string): boolean {
  return (
    /^#{1,6}[ \t]+/.test(line) ||
    /^[ \t]*>[ \t]?/.test(line) ||
    /^[ \t]*(?:[-*+]|\d+\.)[ \t]+/.test(line) ||
    /^[ \t]*\|.*\|[ \t]*$/.test(line)
  );
}

/**
 * Issue #7 — Decompose a markdown structural line into alternating literal
 * markup parts and translatable text parts. The translator is invoked only
 * on the translatable parts, so models that strip `#` / `>` / `|` markers
 * cannot break the document structure.
 */
export function splitMarkdownStructuralLine(line: string): BlockPart[] {
  // Heading: optional indent + 1-6 `#` + space + content.
  const heading = /^([ \t]*#{1,6}[ \t]+)(.*)$/.exec(line);
  if (heading) {
    return literalThenText(heading[1], heading[2]);
  }

  // Block quote: `>` (possibly nested) + optional space + content.
  const quote = /^([ \t]*(?:>[ \t]?)+)(.*)$/.exec(line);
  if (quote) {
    return literalThenText(quote[1], quote[2]);
  }

  // List item: indent + (- | * | + | N.) + space + content.
  const list = /^([ \t]*(?:[-*+]|\d{1,3}\.)[ \t]+)(.*)$/.exec(line);
  if (list) {
    return literalThenText(list[1], list[2]);
  }

  // Markdown table row: `|` separated cells. Separator rows (only `-`/`:`)
  // pass through verbatim; data rows split each cell into a translatable
  // segment with literal pipe/whitespace boundaries preserved.
  if (/^[ \t]*\|.*\|[ \t]*$/.test(line)) {
    return splitMarkdownTableRow(line);
  }

  // Fallback: whole line is translatable.
  return [{ text: line, translatable: true }];
}

function literalThenText(prefix: string, rest: string): BlockPart[] {
  const parts: BlockPart[] = [{ text: prefix, translatable: false }];
  if (rest.length > 0) {
    parts.push({ text: rest, translatable: true });
  }
  return parts;
}

function splitMarkdownTableRow(line: string): BlockPart[] {
  // Capture leading indent.
  const indentMatch = /^[ \t]*/.exec(line);
  const indent = indentMatch ? indentMatch[0] : '';
  const body = line.slice(indent.length);

  // Determine if this is a separator row (cells contain only `-`, `:`, spaces).
  const cells = splitTableCells(body);
  const isSeparator = cells.every((c) => /^[ \t]*:?-{2,}:?[ \t]*$/.test(c.content));
  if (isSeparator) {
    return [{ text: line, translatable: false }];
  }

  const parts: BlockPart[] = [];
  if (indent) parts.push({ text: indent, translatable: false });
  for (const cell of cells) {
    parts.push({ text: cell.boundary, translatable: false });
    if (cell.content.length > 0) {
      // Preserve any leading/trailing spaces as literal so cell padding
      // survives translation.
      const m = /^([ \t]*)(.*?)([ \t]*)$/.exec(cell.content);
      if (m) {
        if (m[1]) parts.push({ text: m[1], translatable: false });
        if (m[2]) parts.push({ text: m[2], translatable: true });
        if (m[3]) parts.push({ text: m[3], translatable: false });
      } else {
        parts.push({ text: cell.content, translatable: true });
      }
    }
  }
  parts.push({ text: '|', translatable: false });
  return parts;
}

interface TableCell {
  boundary: string; // the leading `|` (plus any escaped pipe context)
  content: string;
}

function splitTableCells(body: string): TableCell[] {
  // Walk the body manually so we can honour escaped pipes (`\|`) inside
  // cell content.
  const cells: TableCell[] = [];
  let i = 0;
  // The row must start with `|`.
  if (body[0] !== '|') return [{ boundary: '', content: body }];
  // Skip past the trailing `|` we'll re-emit ourselves.
  // Find boundary positions of `|` that aren't escaped.
  const pipePositions: number[] = [];
  for (let k = 0; k < body.length; k++) {
    if (body[k] === '|' && (k === 0 || body[k - 1] !== '\\')) {
      pipePositions.push(k);
    }
  }
  // Need at least 2 pipes (open and close).
  if (pipePositions.length < 2) {
    return [{ boundary: '', content: body }];
  }
  for (let p = 0; p < pipePositions.length - 1; p++) {
    const start = pipePositions[p];
    const end = pipePositions[p + 1];
    cells.push({
      boundary: '|',
      content: body.slice(start + 1, end)
    });
    i = end;
  }
  return cells;
}

function joinTranslatable(parts: BlockPart[]): string {
  return parts.filter((p) => p.translatable).map((p) => p.text).join('\n');
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

export function readSidecar(filePath: string): SidecarV2 | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SidecarV2;
    if (data?.version !== SIDECAR_VERSION) return undefined;
    if (!Array.isArray(data.blocks)) return undefined;
    return data;
  } catch {
    return undefined;
  }
}

export function writeSidecar(filePath: string, data: SidecarV2): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export interface IncrementalOptions {
  direction: TranslationDirection;
  /** Existing sidecar cache (block hash → translation), if any. */
  cache?: SidecarV2;
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
): Promise<{ stats: IncrementalStats; sidecar: SidecarV2 }> {
  const blocks = splitBlocks(options.source, options.languageId);
  const cacheMap = new Map<string, string>();
  if (options.cache && options.cache.from === options.direction.from && options.cache.to === options.direction.to) {
    for (const b of options.cache.blocks) cacheMap.set(b.hash, b.output);
  }

  const translator = options.translator ?? translateText;
  let translated = 0;
  let reused = 0;
  const outputs: string[] = [];
  const sidecarBlocks: { hash: string; output: string }[] = [];

  const callTranslator = async (input: string): Promise<string> => {
    const result = await translator(input, options.direction);
    if (result.status !== 'ok' || result.translatedText === undefined) {
      throw new Error(result.errorMessage ?? 'translation failed');
    }
    return result.translatedText;
  };

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
    let out: string;
    if (block.parts) {
      const segments: string[] = [];
      for (const part of block.parts) {
        if (!part.translatable || part.text.trim() === '') {
          segments.push(part.text);
        } else {
          segments.push(await callTranslator(part.text));
        }
      }
      out = segments.join('');
    } else {
      out = await callTranslator(block.raw);
    }
    outputs.push(out);
    sidecarBlocks.push({ hash: h, output: out });
    translated++;
  }

  const text = outputs.join('');
  const sidecar: SidecarV2 = {
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
export function loadSidecarFor(outputFsPath: string): SidecarV2 | undefined {
  return readSidecar(sidecarPathFor(outputFsPath));
}

export function isIncrementalEnabled(): boolean {
  return vscode.workspace
    .getConfiguration('lingobridge')
    .get<boolean>('incremental.enabled', true);
}
