/**
 * Utility to calculate approximate token count for chat messages.
 * Based on LLM Byte-Pair Encoding (BPE) heuristics:
 * - In English text, 1 token is roughly 4 characters or ~0.75 words.
 * - Code snippets, symbols, numbers, and JSON have higher token density (~2.5 - 3.5 chars per token).
 */

export function calculateApproximateTokens(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;

  // Split into words by whitespace
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  // Character count
  const charCount = trimmed.length;

  // Count code blocks, symbols, and punctuation which split into additional sub-tokens
  const symbols = (trimmed.match(/[{}[\]()<>=;:.,!@#$%^&*~`|\\/?+-]/g) || []).length;
  
  // Blended heuristic formula:
  // Base tokens from characters and word count
  const baseFromChars = charCount / 3.8;
  const baseFromWords = words * 1.3;
  const baseTokens = (baseFromChars + baseFromWords) / 2;
  const symbolBonus = symbols * 0.12;

  const estimated = Math.round(baseTokens + symbolBonus);
  return Math.max(1, estimated);
}

export function formatApproximateTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k tokens`;
  }
  return `${tokens.toLocaleString()} tokens`;
}
