import * as vscode from 'vscode';
import { findSpacingRanges } from './boundaries';

const INITIAL_CONTEXT_UNITS = 2;
const CONTEXT_EXTENSION_UNITS = 16;
const INSIDE_GRAPHEME = /^[\p{Mark}\uFF9E\uFF9F\uDC00-\uDFFF]/u;

/** Supply display-only hints in the range requested by VS Code's renderer. */
export function provideSpacingHints(
  document: vscode.TextDocument,
  requestedRange: vscode.Range,
  cancellation: vscode.CancellationToken,
): vscode.InlayHint[] {
  const config = vscode.workspace.getConfiguration('visualJapaneseSpacing', document);
  const languages = config.get<string[]>('languages', ['markdown', 'plaintext']);
  if (
    cancellation.isCancellationRequested ||
    !config.get<boolean>('enabled', true) ||
    !(languages.includes('*') || languages.includes(document.languageId))
  ) {
    return [];
  }

  const includeNumbers = config.get<boolean>('includeNumbers', true);
  const hints: vscode.InlayHint[] = [];
  for (let line = requestedRange.start.line; line <= requestedRange.end.line; line++) {
    if (cancellation.isCancellationRequested) {
      return [];
    }
    const start = line === requestedRange.start.line ? requestedRange.start.character : 0;
    const end =
      line === requestedRange.end.line ? requestedRange.end.character : Number.MAX_SAFE_INTEGER;
    const sliceEnd = Math.min(Number.MAX_SAFE_INTEGER, end + INITIAL_CONTEXT_UNITS);
    let sliceStart = Math.max(0, start - INITIAL_CONTEXT_UNITS);
    let text = document.getText(new vscode.Range(line, sliceStart, line, sliceEnd));

    // Extend a short lookbehind to the base when it cuts a surrogate pair or
    // marked grapheme. getText clamps the requested end to the logical line.
    while (sliceStart > 0 && INSIDE_GRAPHEME.test(text)) {
      sliceStart = Math.max(0, sliceStart - CONTEXT_EXTENSION_UNITS);
      text = document.getText(new vscode.Range(line, sliceStart, line, sliceEnd));
    }

    for (const boundary of findSpacingRanges(text, includeNumbers)) {
      const position = new vscode.Position(line, sliceStart + boundary.end);
      if (!requestedRange.contains(position)) {
        continue;
      }
      // A nonempty zero-width label satisfies the public API without a colored
      // text box. Native side padding participates in VS Code's wrap layout.
      const hint = new vscode.InlayHint(position, '\u200b');
      hint.paddingLeft = true;
      hint.paddingRight = true;
      hints.push(hint);
    }
  }
  return cancellation.isCancellationRequested ? [] : hints;
}
