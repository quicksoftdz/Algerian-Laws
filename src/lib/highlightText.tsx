import React from 'react';
import { Message } from '../types/chat';

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
 * - Substantial Arabic-script content -> 'rtl' (Tahoma, 15px, right-aligned)
 * - Primarily Latin (English, French) -> 'ltr' (Roboto Condensed, 15px, left-aligned)
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
 * Returns typography configuration for an assistant response:
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

/**
 * Escapes characters with special meaning in RegExp
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses search query into unique search tokens, ordered by length descending
 * so longer multi-word phrases match before individual sub-words.
 */
export function getSearchTokens(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Extract individual words and full phrase
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  const set = new Set<string>([trimmed, ...words]);

  return Array.from(set).sort((a, b) => b.length - a.length);
}

/**
 * Constructs a global case-insensitive RegExp matching any token in the search query.
 */
export function createSearchRegex(query: string): RegExp | null {
  const tokens = getSearchTokens(query);
  if (tokens.length === 0) return null;

  const pattern = tokens.map(escapeRegExp).join('|');
  try {
    return new RegExp(`(${pattern})`, 'gi');
  } catch {
    return null;
  }
}

/**
 * Counts total keyword occurrences in a list of chat messages.
 */
export function countMatchesInMessages(messages: Message[], query: string): number {
  if (!query || !query.trim() || messages.length === 0) return 0;
  const regex = createSearchRegex(query);
  if (!regex) return 0;

  let count = 0;
  for (const msg of messages) {
    if (!msg.content) continue;
    const matches = msg.content.match(regex);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

export interface HighlightOptions {
  isCode?: boolean;
  isHeading?: boolean;
}

/**
 * Highlights matches of search query inside a text string, preserving exact casing
 * and formatting. Returns React nodes.
 */
export function renderHighlightedText(
  text: string,
  query?: string,
  isDark = true,
  options?: HighlightOptions
): React.ReactNode {
  if (!query || !query.trim() || !text) {
    return text;
  }

  const regex = createSearchRegex(query);
  if (!regex) return text;

  // Split on regex capture groups: odd indexes will be matched tokens
  const parts = text.split(regex);
  if (parts.length === 1) return text;

  const lowerTokens = getSearchTokens(query).map((t) => t.toLowerCase());
  const { isCode, isHeading } = options || {};

  return parts.map((part, index) => {
    const isMatch = lowerTokens.includes(part.toLowerCase());
    if (!isMatch) {
      return part;
    }

    let highlightClass = '';
    if (isCode) {
      highlightClass = isDark
        ? 'bg-amber-400/40 text-amber-100 font-semibold px-1 py-0.5 rounded-xs ring-1 ring-amber-400/70'
        : 'bg-amber-300 text-amber-950 font-semibold px-1 py-0.5 rounded-xs ring-1 ring-amber-500/60';
    } else if (isHeading) {
      highlightClass = isDark
        ? 'bg-amber-400/35 text-amber-100 font-bold px-1.5 py-0.5 rounded-xs border-b-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
        : 'bg-amber-200 text-amber-950 font-bold px-1.5 py-0.5 rounded-xs border-b-2 border-amber-500 shadow-xs';
    } else {
      highlightClass = isDark
        ? 'bg-amber-400/30 text-amber-100 font-medium px-1 py-0.5 rounded-xs border-b border-amber-400/80 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
        : 'bg-amber-200/90 text-amber-950 font-medium px-1 py-0.5 rounded-xs border-b border-amber-500/80 shadow-xs';
    }

    return (
      <mark
        key={index}
        data-search-highlight="true"
        data-search-term={part.toLowerCase()}
        className={`inline-block transition-all duration-200 select-text ${highlightClass}`}
      >
        {part}
      </mark>
    );
  });
}
