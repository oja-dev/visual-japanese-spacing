/** A nonempty UTF-16 range for the character immediately before a boundary. */
export interface CharacterRange {
  start: number;
  end: number;
}

// Script properties include supplementary Han. Common Japanese iteration/prolongation
// marks have Common/Inherited scripts and must be included explicitly.
const JAPANESE_CHARACTER =
  /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆〇〻ゝゞヽヾーｰ]$/u;
const GRAPHEME_CONTINUATION = /^[\p{Mark}\uFF9E\uFF9F]$/u;
const ASCII_LETTER = /^[A-Za-z]$/;
const ASCII_NUMBER = /^[0-9]$/;

export function findSpacingRanges(text: string, includeNumbers = true): CharacterRange[] {
  const result: CharacterRange[] = [];
  let offset = 0;
  let previousStart = 0;
  let previousJapanese = false;
  let previousAscii = false;
  for (const character of text) {
    // Combining marks and variation selectors belong to the preceding base.
    // Never place an attachment between a base and one of its marks.
    if (GRAPHEME_CONTINUATION.test(character)) {
      offset += character.length;
      continue;
    }
    const currentJapanese = JAPANESE_CHARACTER.test(character);
    const currentAscii =
      ASCII_LETTER.test(character) || (includeNumbers && ASCII_NUMBER.test(character));
    if ((previousJapanese && currentAscii) || (previousAscii && currentJapanese)) {
      result.push({ start: previousStart, end: offset });
    }
    previousStart = offset;
    offset += character.length;
    previousJapanese = currentJapanese;
    previousAscii = currentAscii;
  }
  return result;
}
