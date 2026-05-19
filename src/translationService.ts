import * as path from 'path';
import * as vscode from 'vscode';
import {
  DEFAULT_PROTECTION_TARGETS,
  noProtect,
  protect,
  ProtectionTargetKey,
  ProtectionTargets
} from './protection';
import { getActiveProvider, getActiveTimeoutMs } from './providers/providerRegistry';
import {
  LanguageCode,
  TranslateResult,
  TranslationDirection
} from './providers/translationProvider';

export async function translateText(
  text: string,
  direction: TranslationDirection
): Promise<TranslateResult> {
  if (!text.trim()) {
    return { status: 'ok', translatedText: '' };
  }
  const cfg = vscode.workspace.getConfiguration('lingobridge');
  const protectionEnabled = cfg.get<boolean>('protection.enabled', true);
  const targets = readProtectionTargets(cfg);

  const { protectedText, restore } = protectionEnabled
    ? protect(text, targets)
    : noProtect(text);
  const provider = getActiveProvider();
  const result = await provider.translate(protectedText, {
    direction,
    timeoutMs: getActiveTimeoutMs()
  });
  if (result.status === 'ok' && result.translatedText !== undefined) {
    return { ...result, translatedText: restore(result.translatedText) };
  }
  return result;
}

/**
 * Read `lingobridge.protection.targets` and merge with backward-compat
 * defaults (fencedCode/inlineCode/url plus the v0.3.4 inline-markdown
 * additions enabled when the setting is absent or empty). Returns a fully
 * populated record.
 */
export function readProtectionTargets(
  cfg: vscode.WorkspaceConfiguration
): ProtectionTargets {
  const compatDefaults: Record<ProtectionTargetKey, boolean> = {
    ...DEFAULT_PROTECTION_TARGETS,
    fencedCode: true,
    inlineCode: true,
    url: true,
    // Issue #7 (v0.3.4): preserve inline markdown markup by default.
    inlineEmphasis: true,
    markdownLink: true,
    // v0.3.4 Phase 1 extras: additional Markdown notations preserved by default.
    mathBlock: true,
    mathInline: true,
    htmlInline: true,
    autoLink: true,
    referenceLink: true,
    taskList: true
  };
  const raw = cfg.get<Record<string, unknown>>('protection.targets', {}) || {};
  const merged: Record<string, boolean> = { ...compatDefaults };
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'boolean') merged[k] = v;
  }
  return merged as ProtectionTargets;
}

/**
 * Build the output file name for a translated document.
 *  README.md     + en  -> README.en.md
 *  README.ja.md  + en  -> README.en.md (replace existing lang segment)
 *  notes         + ja  -> notes.ja
 *  README.zh.md  + en  -> README.en.md
 *
 * Recognises ISO 639-1 (2-letter) language codes optionally followed by
 * `-XX` region (e.g. `zh-CN`).
 */
export function buildOutputFileName(originalFileName: string, targetLang: LanguageCode): string {
  const base = path.basename(originalFileName);
  const ext = path.extname(base); // includes leading "."
  const stem = ext ? base.slice(0, -ext.length) : base;

  const langSuffixRegex = /\.[a-z]{2,3}(-[A-Za-z0-9]{1,8})?$/i;
  const cleanStem = langSuffixRegex.test(stem) ? stem.replace(langSuffixRegex, '') : stem;

  const newStem = `${cleanStem}.${targetLang.toLowerCase()}`;
  return ext ? `${newStem}${ext}` : newStem;
}

/** Open the translated text in a new untitled editor with the suggested file name. */
export async function openTranslationInNewTab(
  originalDoc: vscode.TextDocument,
  targetLang: LanguageCode,
  translatedText: string
): Promise<void> {
  const originalName = originalDoc.isUntitled
    ? 'untitled'
    : path.basename(originalDoc.fileName);
  const newName = buildOutputFileName(originalName, targetLang);

  // Issue: Linux + non-ASCII (e.g. Japanese) file names failed because the
  // previous implementation embedded the absolute parent path into the
  // `untitled:` URI. VS Code then validated the parent directory through
  // glibc, which fails with EILSEQ when the runtime locale is `C` or when
  // NFC/NFD normalization differs from the file system. We now build the
  // untitled URI with the file name only — VS Code still uses it as the tab
  // title and the suggested save name, but no directory check happens.
  const untitledUri = vscode.Uri.parse(
    `untitled:${encodeURIComponent(newName)}`
  );

  const doc = await vscode.workspace.openTextDocument(untitledUri);
  const edit = new vscode.WorkspaceEdit();
  // Replace any existing content (untitled is empty for new URIs).
  if (doc.getText().length > 0) {
    edit.replace(doc.uri, new vscode.Range(0, 0, doc.lineCount, 0), translatedText);
  } else {
    edit.insert(doc.uri, new vscode.Position(0, 0), translatedText);
  }
  await vscode.workspace.applyEdit(edit);
  await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });
}
