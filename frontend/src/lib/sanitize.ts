/**
 * Utility to sanitize user search inputs across the application.
 * Disallows and strips emoji characters, pictographs, symbols, zero-width joiners,
 * and regional indicator flags.
 */

export const EMOJI_REGEX = /[\uFE00-\uFE0F\u200D\u20E3]|\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/gu;

/**
 * Strips any emoji character or sequence from a search string.
 * Keeps standard text, numbers, punctuation, spaces, and international alphabets intact.
 */
export function sanitizeSearchInput(input: string): string {
  if (!input) return '';
  return input.replace(EMOJI_REGEX, '');
}
