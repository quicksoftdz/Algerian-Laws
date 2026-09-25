/**
 * Unicode-aware text direction detection and bidirectional utilities.
 * Accurately determines dominant script direction (RTL vs LTR)
 * and isolates code, URLs, numbers, filenames, and mixed text.
 */

// Comprehensive Arabic Unicode ranges:
// Standard Arabic (0600-06FF), Arabic Supplement (0750-077F), Arabic Extended-A/B (08A0-08FF)
// Arabic Presentation Forms-A & B (FB50-FDFF, FE70-FEFC)
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/g;

// Latin Unicode ranges (English, French, etc.):
const LATIN_REGEX = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g;

/**
 * Strips fenced code blocks, inline code, and URLs so code syntax
 * does not distort the natural language content direction.
 */
export function extractDirectionalText(text: string): string {
  if (!text) return '';

  return text
    // Remove fenced code blocks ``` ... ```
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code ` ... `
    .replace(/`[^`]*`/g, '')
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/www\.[^\s]+/g, '')
    // Remove markdown link syntax [text](url) -> keep text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .trim();
}

/**
 * Detects the text direction of a given string ('rtl' or 'ltr').
 *
 * Rules:
 * - Substantial Arabic-script content -> 'rtl' (Roboto Condensed)
 * - Primarily Latin (English, French) -> 'ltr' (Tahoma)
 * - Single isolated Arabic word in large English/French text does not flip entire message to RTL.
 * - Mixed Arabic text with Latin technical terms (e.g. Delphi, MariaDB, REST API) remains RTL.
 */
export function detectTextDirection(text: string): 'rtl' | 'ltr' {
  if (!text || !text.trim()) return 'ltr';

  const cleaned = extractDirectionalText(text);
  const targetText = cleaned.length > 0 ? cleaned : text;

  const arabicMatches = targetText.match(ARABIC_REGEX) || [];
  const latinMatches = targetText.match(LATIN_REGEX) || [];

  const arabicCount = arabicMatches.length;
  const latinCount = latinMatches.length;
  const totalLetters = arabicCount + latinCount;

  if (totalLetters > 0) {
    if (arabicCount > latinCount) return 'rtl';
    // Mixed Arabic + Latin where Arabic is substantial (>= 25% of letters and >= 6 Arabic chars)
    if (arabicCount >= 6 && arabicCount / totalLetters >= 0.25) return 'rtl';
    if (latinCount > arabicCount) return 'ltr';
  }

  // Fallback: check first directional character
  for (let i = 0; i < targetText.length; i++) {
    const char = targetText[i];
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/.test(char)) return 'rtl';
    if (/[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/.test(char)) return 'ltr';
  }

  return 'ltr';
}

/**
 * Convenience helper that returns true if text direction is 'rtl'.
 */
export function isRTL(text: string): boolean {
  return detectTextDirection(text) === 'rtl';
}

export interface MessageTypography {
  dir: 'rtl' | 'ltr';
  isRTL: boolean;
  fontFamily: string;
  fontSize: string;
  className: string;
}

/**
 * Returns complete typography configuration for an assistant response:
 * - Arabic: Tahoma, 15px, rtl, text-right
 * - Latin / Non-Arabic: Roboto Condensed, 15px, ltr, text-left
 */
export function getMessageTypography(text: string): MessageTypography {
  const dir = detectTextDirection(text);
  const isRTL = dir === 'rtl';
  return {
    dir,
    isRTL,
    fontFamily: isRTL ? 'Tahoma, Arial, sans-serif' : '"Roboto Condensed", sans-serif',
    fontSize: '15px',
    className: isRTL ? 'assistant-message rtl chat-response-rtl' : 'assistant-message ltr chat-response-ltr',
  };
}
