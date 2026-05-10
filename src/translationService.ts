import * as path from 'path';
import * as vscode from 'vscode';
import { noProtect, protect } from './protection';
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
  const protectionEnabled = vscode.workspace
    .getConfiguration('lingobridge')
    .get<boolean>('protection.enabled', true);

  const { protectedText, restore } = protectionEnabled ? protect(text) : noProtect(text);
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

  // Determine target directory: same as original if file-backed, else workspace root.
  let targetDir: string | undefined;
  if (!originalDoc.isUntitled && originalDoc.uri.scheme === 'file') {
    targetDir = path.dirname(originalDoc.uri.fsPath);
  } else {
    targetDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  // Build an untitled URI with a path so VS Code picks it up as the suggested name.
  const untitledUri = targetDir
    ? vscode.Uri.file(path.join(targetDir, newName)).with({ scheme: 'untitled' })
    : vscode.Uri.parse(`untitled:${newName}`);

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
