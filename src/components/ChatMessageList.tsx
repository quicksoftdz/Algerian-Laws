import React, { useState, useEffect, useRef } from 'react';
import {
  Copy,
  Check,
  CheckCheck,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Sparkles,
  Bot,
  User,
  Quote,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  CheckSquare,
  Pin,
  Trash2,
  ArrowUpRight,
  AlertCircle,
  Loader2,
  Clock,
  Volume2,
  VolumeX,
  Share2,
} from 'lucide-react';
import { Message, Attachment } from '../types/chat';
import { RobotMascot } from './RobotMascot';
import { FileAttachmentBadge, ImageAttachmentThumbnail } from './FileAttachmentBadge';
import { ImageLightboxModal } from './ImageLightboxModal';
import { calculateApproximateTokens, formatApproximateTokens } from '../lib/tokenEstimator';
import {
  renderHighlightedText,
  countMatchesInMessages,
  detectTextDirection,
  getMessageTypography,
} from '../lib/highlightText';
import { CodeRenderer } from './CodeRenderer';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useAuth } from '../context/AuthContext';

/**
 * Format timestamp strictly as HH:MM AM/PM
 */
export function formatTimeHHMM(timestamp?: number): string {
  if (!timestamp || isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

interface ChatMessageListProps {
  messages: Message[];
  isThinking: boolean;
  onRegenerate: () => void;
  onRetryMessage?: (messageId: string) => void;
  onToggleLike: (messageId: string, liked: boolean) => void;
  onQuote: (text: string) => void;
  onTogglePin?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  theme?: 'dark' | 'light';
  searchQuery?: string;
  currentMatchIndex?: number;
  onMatchIndexChange?: (index: number) => void;
  onClearSearch?: () => void;
  isSelectMode?: boolean;
  selectedMessageIds?: Set<string>;
  onToggleSelectMessage?: (messageId: string) => void;
  onStartSelectWithMessage?: (messageId: string) => void;
  enableTTS?: boolean;
  onShareMessage?: (message: Message) => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isThinking,
  onRegenerate,
  onRetryMessage,
  onToggleLike,
  onQuote,
  onTogglePin,
  onDeleteMessage,
  theme = 'dark',
  searchQuery = '',
  currentMatchIndex: propMatchIndex,
  onMatchIndexChange,
  onClearSearch,
  isSelectMode = false,
  selectedMessageIds,
  onToggleSelectMessage,
  onStartSelectWithMessage,
  enableTTS = true,
  onShareMessage,
}) => {
  const { user, userProfile } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedSelection, setCopiedSelection] = useState(false);
  const [lightboxAttachment, setLightboxAttachment] = useState<Attachment | null>(null);
  const { speak, stop, speakingId, isSupported: isTtsSupported } = useTextToSpeech();

  // Search match navigation state (supports controlled or local state)
  const [internalMatchIndex, setInternalMatchIndex] = useState(0);
  const currentMatchIndex = propMatchIndex !== undefined ? propMatchIndex : internalMatchIndex;
  const setCurrentMatchIndex = (val: number | ((prev: number) => number)) => {
    if (typeof val === 'function') {
      const next = val(currentMatchIndex);
      if (onMatchIndexChange) onMatchIndexChange(next);
      else setInternalMatchIndex(next);
    } else {
      if (onMatchIndexChange) onMatchIndexChange(val);
      else setInternalMatchIndex(val);
    }
  };

  const activeSearchQuery = searchQuery?.trim() || '';
  const totalMatches = countMatchesInMessages(messages, activeSearchQuery);

  // Reset match navigation when search query or messages change
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [activeSearchQuery, messages.length]);

  // Floating selection popover state
  const [selectionPopover, setSelectionPopover] = useState<{
    top: number;
    left: number;
    text: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  // Keyboard navigation state for moving between messages and triggering hotkeys
  const [focusedMessageIndex, setFocusedMessageIndex] = useState<number | null>(null);
  const messageItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Listen for custom event to focus the last message (e.g. from ChatInput ArrowUp)
  useEffect(() => {
    const handleFocusLast = () => {
      if (messages.length > 0) {
        setFocusedMessageIndex(messages.length - 1);
      }
    };
    window.addEventListener('focus-last-message', handleFocusLast);
    return () => window.removeEventListener('focus-last-message', handleFocusLast);
  }, [messages.length]);

  // Keep focusedMessageIndex within range if messages change
  useEffect(() => {
    if (focusedMessageIndex !== null) {
      if (messages.length === 0) {
        setFocusedMessageIndex(null);
      } else if (focusedMessageIndex >= messages.length) {
        setFocusedMessageIndex(messages.length - 1);
      }
    }
  }, [messages.length, focusedMessageIndex]);

  // Smoothly scroll focused message into view
  useEffect(() => {
    if (focusedMessageIndex !== null && messageItemRefs.current[focusedMessageIndex]) {
      messageItemRefs.current[focusedMessageIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [focusedMessageIndex]);

  // Global keyboard shortcuts for message navigation and actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack keystrokes if typing inside an input, textarea, or contenteditable
      const activeEl = document.activeElement;
      const isEditable =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable);

      if (isEditable) return;

      // Don't hijack keystrokes if a modal or dialog is open
      const isModalOpen = document.querySelector('[role="dialog"]') !== null;
      if (isModalOpen) return;

      if (messages.length === 0) return;

      // ArrowUp / k: Move to previous message
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setFocusedMessageIndex((prev) => {
          if (prev === null) {
            return messages.length - 1;
          }
          return Math.max(0, prev - 1);
        });
        return;
      }

      // ArrowDown / j: Move to next message
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setFocusedMessageIndex((prev) => {
          if (prev === null) {
            return 0;
          }
          if (prev >= messages.length - 1) {
            // Reached the end: focus the chat input composer
            window.dispatchEvent(new CustomEvent('focus-chat-input'));
            return null;
          }
          return prev + 1;
        });
        return;
      }

      // Home: Jump to first message
      if (e.key === 'Home') {
        e.preventDefault();
        setFocusedMessageIndex(0);
        return;
      }

      // End: Jump to last message
      if (e.key === 'End') {
        e.preventDefault();
        setFocusedMessageIndex(messages.length - 1);
        return;
      }

      // Escape: Dismiss active message focus
      if (e.key === 'Escape') {
        if (focusedMessageIndex !== null) {
          e.preventDefault();
          setFocusedMessageIndex(null);
        }
        return;
      }

      // Action hotkeys when a message is selected
      if (focusedMessageIndex !== null && messages[focusedMessageIndex]) {
        const msg = messages[focusedMessageIndex];

        // 'c' or 'C': Copy message content
        if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleCopyText(msg.id, msg.content);
          return;
        }

        // 'q' or 'Q': Quote message content in prompt
        if ((e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          onQuote(msg.content);
          window.dispatchEvent(new CustomEvent('focus-chat-input'));
          return;
        }

        // 'r' or 'R': Regenerate response
        if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (msg.role === 'assistant') {
            e.preventDefault();
            onRegenerate();
          }
          return;
        }

        // 'l' or 'L': Like / helpful
        if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (msg.role === 'assistant') {
            e.preventDefault();
            onToggleLike(msg.id, true);
          }
          return;
        }

        // 'd' or 'D': Dislike / unhelpful
        if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (msg.role === 'assistant') {
            e.preventDefault();
            onToggleLike(msg.id, false);
          }
          return;
        }

        // 's' or 'S' or 'x' or 'X': Select message
        if ((e.key === 's' || e.key === 'S' || e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          if (isSelectMode) {
            onToggleSelectMessage?.(msg.id);
          } else {
            onStartSelectWithMessage?.(msg.id);
          }
          return;
        }

        // 'Enter' or 'i' or '/': Focus chat input
        if (e.key === 'Enter' || e.key === 'i' || e.key === '/') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('focus-chat-input'));
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    messages,
    focusedMessageIndex,
    isSelectMode,
    onQuote,
    onRegenerate,
    onToggleLike,
    onToggleSelectMessage,
    onStartSelectWithMessage,
  ]);

  // Highlight and scroll to active match element when navigating matches
  useEffect(() => {
    if (!activeSearchQuery) return;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const elements = containerRef.current.querySelectorAll<HTMLElement>('[data-search-highlight="true"]');
      if (elements.length === 0) return;

      const clampedIndex = Math.min(Math.max(0, currentMatchIndex), elements.length - 1);

      elements.forEach((el, index) => {
        if (index === clampedIndex) {
          el.classList.add(
            'ring-2',
            isDark ? 'ring-purple-400' : 'ring-purple-600',
            'ring-offset-1',
            isDark ? 'ring-offset-[#1b1b1f]' : 'ring-offset-white'
          );
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          el.classList.remove(
            'ring-2',
            'ring-purple-400',
            'ring-purple-600',
            'ring-offset-1',
            'ring-offset-[#1b1b1f]',
            'ring-offset-white'
          );
        }
      });
    }, 60);

    return () => clearTimeout(timer);
  }, [activeSearchQuery, currentMatchIndex, isDark, messages]);

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyCode = (codeKey: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(codeKey);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleQuoteCode = (code: string, language?: string) => {
    const lang = language && language !== 'code' ? language : '';
    const formatted = `\`\`\`${lang}\n${code}\n\`\`\``;
    onQuote(formatted);
  };

  // Detect text selection inside the message list to show floating Quote/Copy toolbar
  const handleMouseUp = () => {
    // Short delay to let the browser settle selection
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionPopover(null);
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText) {
        setSelectionPopover(null);
        return;
      }

      // Check if selection is within our container
      if (
        containerRef.current &&
        containerRef.current.contains(selection.anchorNode) &&
        containerRef.current.contains(selection.focusNode)
      ) {
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setSelectionPopover({
              top: rect.top - 44,
              left: rect.left + rect.width / 2,
              text: selectedText,
            });
            return;
          }
        } catch {
          // ignore
        }
      }
      setSelectionPopover(null);
    }, 20);
  };

  // Close selection popover on scroll or window resize
  useEffect(() => {
    const handleDismiss = () => {
      setSelectionPopover(null);
    };

    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);

    return () => {
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, []);

  // Helper to parse markdown blocks including ```lang code ```, tables, and formatted lines
  const renderFormattedContent = (content: string, messageId: string, isUserMessage = false) => {
    const msgTypo = getMessageTypography(content);
    const messageDir = msgTypo.dir;
    const isMessageRTL = msgTypo.isRTL;
    const fontClass = msgTypo.className;
    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
      <div
        dir={messageDir}
        className={`${fontClass} ${isMessageRTL ? 'text-right' : 'text-left'}`}
        style={{ fontFamily: msgTypo.fontFamily, fontSize: msgTypo.fontSize }}
      >
        {parts.map((part, idx) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const lines = part.slice(3, -3).trim().split('\n');
            const firstLine = lines[0].trim();
            const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
            const language = hasLang ? firstLine : 'code';
            const codeText = hasLang ? lines.slice(1).join('\n') : lines.join('\n');
            const codeKey = `${messageId}-code-${idx}`;

            return (
              <div
                key={codeKey}
                dir="ltr"
                className={`my-3 rounded-xl overflow-hidden border shadow-xs group/code w-full max-w-full min-w-0 text-left ${
                  isDark ? 'border-[#27272c] bg-[#101012]' : 'border-[#E2E5DF] bg-[#F8F9F7]'
                }`}
              >
                {/* Code Block Header with icon-only buttons (Always LTR) */}
                <div className={`flex items-center justify-between px-3 py-1.5 border-b text-neutral-400 ${
                  isDark ? 'bg-[#18181b] border-[#27272c]' : 'bg-[#EEF1EC] border-[#E2E5DF]'
                }`}>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                    {language}
                  </span>

                  {/* Icon-only action buttons: Quote code block & Copy code to clipboard */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleQuoteCode(codeText, language)}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-purple-400 hover:bg-[#27272a] transition-colors cursor-pointer"
                      title="Quote code block in prompt"
                      aria-label="Quote code block in prompt"
                    >
                      <Quote className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyCode(codeKey, codeText)}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer"
                      title={copiedCodeId === codeKey ? 'Copied code' : 'Copy code to clipboard'}
                      aria-label="Copy code to clipboard"
                    >
                      {copiedCodeId === codeKey ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <pre className={`code-block-pre p-4 overflow-x-auto selection:bg-purple-900/60 selection:text-white w-full max-w-full text-left ${
                  isDark ? 'text-[#e2e8f0] bg-[#101012]' : 'text-neutral-900 bg-[#F8F9F7]'
                }`} dir="ltr">
                  <code>
                    <CodeRenderer
                      code={codeText}
                      language={language}
                      isDark={isDark}
                      searchQuery={activeSearchQuery}
                    />
                  </code>
                </pre>
              </div>
            );
          }

          // Paragraph / line formatting with tables, bolding, blockquotes, and lists
          const rawLines = part.split('\n');

          // Parse contiguous markdown table rows
          type LineOrTable =
            | { type: 'table'; headers: string[]; rows: string[][]; tableKey: string }
            | { type: 'line'; line: string; lIdx: number };

          const parsedItems: LineOrTable[] = [];
          let linePtr = 0;
          while (linePtr < rawLines.length) {
            const cur = rawLines[linePtr].trim();
            if (
              cur.startsWith('|') &&
              cur.endsWith('|') &&
              linePtr + 1 < rawLines.length &&
              rawLines[linePtr + 1].trim().startsWith('|') &&
              /^\|(?:\s*:?-+:?\s*\|)+$/.test(rawLines[linePtr + 1].trim())
            ) {
              const headers = cur
                .slice(1, -1)
                .split('|')
                .map((h) => h.trim());
              linePtr += 2; // skip header and delimiter line
              const tableRows: string[][] = [];
              while (
                linePtr < rawLines.length &&
                rawLines[linePtr].trim().startsWith('|') &&
                rawLines[linePtr].trim().endsWith('|')
              ) {
                const cells = rawLines[linePtr]
                  .trim()
                  .slice(1, -1)
                  .split('|')
                  .map((c) => c.trim());
                tableRows.push(cells);
                linePtr++;
              }
              parsedItems.push({
                type: 'table',
                headers,
                rows: tableRows,
                tableKey: `tbl-${idx}-${linePtr}`,
              });
            } else {
              parsedItems.push({
                type: 'line',
                line: rawLines[linePtr],
                lIdx: linePtr,
              });
              linePtr++;
            }
          }

          return (
            <div key={idx} className="space-y-2">
              {parsedItems.map((item, itemIdx) => {
                if (item.type === 'table') {
                  return (
                    <div
                      key={item.tableKey || itemIdx}
                      dir={isMessageRTL ? 'rtl' : 'ltr'}
                      className="my-3 overflow-x-auto rounded-xl border border-[#E5E8E2] dark:border-[#27272c] shadow-xs"
                    >
                      <table className={`w-full ${isMessageRTL ? 'text-right' : 'text-left'} border-collapse text-[16px] leading-normal`}>
                        <thead>
                          <tr className="bg-[#F8F9F7] dark:bg-[#18181b] border-b border-[#E5E8E2] dark:border-[#27272c]">
                            {item.headers.map((h, hIdx) => (
                              <th
                                key={hIdx}
                                className={`px-4 py-2.5 font-semibold text-[16px] text-neutral-800 dark:text-neutral-200 ${
                                  isMessageRTL ? 'text-right' : 'text-left'
                                }`}
                              >
                                {renderInlineStyles(h, isMessageRTL)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E8E2] dark:divide-[#27272c]">
                          {item.rows.map((r, rIdx) => (
                            <tr
                              key={rIdx}
                              className="bg-white dark:bg-[#121214]/60 hover:bg-[#F8F9F7]/80 dark:hover:bg-[#18181c]/80 transition-colors"
                            >
                              {r.map((c, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`px-4 py-2.5 text-[16px] text-neutral-700 dark:text-neutral-300 ${
                                    isMessageRTL ? 'text-right' : 'text-left'
                                  }`}
                                >
                                  {renderInlineStyles(c, isMessageRTL)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                const line = item.line;
                const lIdx = item.lIdx;
                const trimmed = line.trim();
                if (!trimmed) return <div key={lIdx} className="h-1.5" />;

                // Blockquotes (> quote)
                if (trimmed.startsWith('>')) {
                  const quoteContent = trimmed.replace(/^>\s*/, '');
                  return (
                    <div
                      key={lIdx}
                      dir={isMessageRTL ? 'rtl' : 'ltr'}
                      style={{ fontFamily: isUserMessage ? undefined : msgTypo.fontFamily }}
                      className={`${
                        isMessageRTL
                          ? 'border-r-2 pr-3.5 pl-2 rounded-l-md text-right'
                          : 'border-l-2 pl-3.5 pr-2 rounded-r-md text-left'
                      } py-2 my-2.5 group/block relative flex items-start justify-between gap-2.5 ${
                        isDark
                          ? 'border-purple-500/70 bg-purple-950/15 text-neutral-300'
                          : 'border-purple-500 bg-purple-50/60 text-neutral-800'
                      }`}
                    >
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-[10px] text-purple-400 font-mono select-none">
                          <Quote className="w-2.5 h-2.5" />
                          <span>Quote</span>
                        </div>
                        <div className="text-[16px] italic leading-[1.625]">
                          {renderInlineStyles(quoteContent, isMessageRTL)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onQuote(quoteContent)}
                        className="opacity-0 group-hover/block:opacity-100 p-1 rounded text-neutral-400 hover:text-purple-400 hover:bg-[#202024] transition-all cursor-pointer shrink-0"
                        title="Quote this text block"
                        aria-label="Quote this text block"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                // Headings
                if (trimmed.startsWith('### ')) {
                  const headingText = trimmed.replace('### ', '');
                  return (
                    <div key={lIdx} className="group/block relative flex items-start justify-between gap-2 mt-3.5 mb-1.5">
                      <h3
                        dir={isMessageRTL ? 'rtl' : 'ltr'}
                        style={{ fontFamily: isUserMessage ? undefined : msgTypo.fontFamily }}
                        className={`text-[18px] font-semibold leading-snug flex-1 ${
                          isMessageRTL ? 'text-right' : 'text-left'
                        } ${
                          isDark ? 'text-white' : 'text-neutral-900'
                        }`}
                      >
                        {renderHighlightedText(headingText, activeSearchQuery, isDark, { isHeading: true })}
                      </h3>
                      <button
                        type="button"
                        onClick={() => onQuote(headingText)}
                        className="opacity-0 group-hover/block:opacity-100 p-1 rounded text-neutral-400 hover:text-purple-400 hover:bg-[#202024] transition-all cursor-pointer shrink-0"
                        title="Quote this heading"
                        aria-label="Quote this heading"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                if (trimmed.startsWith('## ')) {
                  const headingText = trimmed.replace('## ', '');
                  return (
                    <div key={lIdx} className="group/block relative flex items-start justify-between gap-2 mt-4.5 mb-2">
                      <h2
                        dir={isMessageRTL ? 'rtl' : 'ltr'}
                        style={{ fontFamily: isUserMessage ? undefined : msgTypo.fontFamily }}
                        className={`text-[20px] font-semibold leading-snug flex-1 ${
                          isMessageRTL ? 'text-right' : 'text-left'
                        } ${
                          isDark ? 'text-white' : 'text-neutral-900'
                        }`}
                      >
                        {renderHighlightedText(headingText, activeSearchQuery, isDark, { isHeading: true })}
                      </h2>
                      <button
                        type="button"
                        onClick={() => onQuote(headingText)}
                        className="opacity-0 group-hover/block:opacity-100 p-1 rounded text-neutral-400 hover:text-purple-400 hover:bg-[#202024] transition-all cursor-pointer shrink-0"
                        title="Quote this heading"
                        aria-label="Quote this heading"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                if (trimmed.startsWith('# ')) {
                  const headingText = trimmed.replace('# ', '');
                  return (
                    <div key={lIdx} className="group/block relative flex items-start justify-between gap-2 mt-5 mb-2.5">
                      <h1
                        dir={isMessageRTL ? 'rtl' : 'ltr'}
                        style={{ fontFamily: isUserMessage ? undefined : msgTypo.fontFamily }}
                        className={`text-[24px] font-bold leading-tight flex-1 ${
                          isMessageRTL ? 'text-right' : 'text-left'
                        } ${
                          isDark ? 'text-white' : 'text-neutral-900'
                        }`}
                      >
                        {renderHighlightedText(headingText, activeSearchQuery, isDark, { isHeading: true })}
                      </h1>
                      <button
                        type="button"
                        onClick={() => onQuote(headingText)}
                        className="opacity-0 group-hover/block:opacity-100 p-1 rounded text-neutral-400 hover:text-purple-400 hover:bg-[#202024] transition-all cursor-pointer shrink-0"
                        title="Quote this heading"
                        aria-label="Quote this heading"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                // Bullet points
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                  const bulletText = trimmed.slice(2);
                  return (
                    <div
                      key={lIdx}
                      dir={isMessageRTL ? 'rtl' : 'ltr'}
                      style={{ fontFamily: isUserMessage ? undefined : msgTypo.fontFamily }}
                      className={`group/block relative flex items-start justify-between gap-2 text-[16px] leading-[1.625] ${
                        isMessageRTL ? 'pr-2 pl-0 text-right' : 'pl-2 pr-0 text-left'
                      } ${
                        isDark ? 'text-neutral-200' : 'text-neutral-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className="text-neutral-400 mt-1 select-none shrink-0 text-[16px] leading-none">•</span>
                        <span className="flex-1 min-w-0">{renderInlineStyles(bulletText, isMessageRTL)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onQuote(bulletText)}
                        className="opacity-0 group-hover/block:opacity-100 p-1 rounded text-neutral-400 hover:text-purple-400 hover:bg-[#202024] transition-all cursor-pointer shrink-0"
                        title="Quote this bullet point"
                        aria-label="Quote this bullet point"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                // Numbered items
                if (/^\d+\.\s/.test(trimmed)) {
                  const numMatch = trimmed.match(/^(\d+\.)\s(.*)$/);
                  const numText = numMatch ? numMatch[2] : trimmed;
                  return (
                    <div
                      key={lIdx}
                      dir={isMessageRTL ? 'rtl' : 'ltr'}
                      style={{ fontFamily: isUserMessage ? undefined : msgTypo.fontFamily }}
                      className={`group/block relative flex items-start justify-between gap-2 text-[16px] leading-[1.625] ${
                        isMessageRTL ? 'pr-2 pl-0 text-right' : 'pl-2 pr-0 text-left'
                      } ${
                        isDark ? 'text-neutral-200' : 'text-neutral-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className="font-medium text-neutral-400 select-none text-[16px] shrink-0">
                          <bdi>{numMatch ? numMatch[1] : '•'}</bdi>
                        </span>
                        <span className="flex-1 min-w-0">{renderInlineStyles(numText, isMessageRTL)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onQuote(numText)}
                        className="opacity-0 group-hover/block:opacity-100 p-1 rounded text-neutral-400 hover:text-purple-400 hover:bg-[#202024] transition-all cursor-pointer shrink-0"
                        title="Quote this item"
                        aria-label="Quote this item"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                // Standard paragraph block with hover quote icon
                return (
                  <div
                    key={lIdx}
                    className="group/block relative flex items-start justify-between gap-2"
                  >
                    <p
                      dir={isMessageRTL ? 'rtl' : 'ltr'}
                      style={{ fontFamily: isUserMessage ? undefined : msgTypo.fontFamily }}
                      className={`text-[16px] leading-[1.625] flex-1 ${
                        isMessageRTL ? 'text-right' : 'text-left'
                      } ${
                        isUserMessage
                          ? 'text-inherit'
                          : isDark
                          ? 'text-neutral-200'
                          : 'text-neutral-800'
                      }`}
                    >
                      {renderInlineStyles(line, isMessageRTL)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onQuote(line)}
                      className="opacity-0 group-hover/block:opacity-100 p-1 rounded text-neutral-400 hover:text-purple-400 hover:bg-[#202024] transition-all cursor-pointer shrink-0"
                      title="Quote this paragraph"
                      aria-label="Quote this paragraph"
                    >
                      <Quote className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const renderInlineStyles = (text: string, _isMessageRTL = false) => {
    // Process markdown images, `inline code`, **bold**, *italic*, [markdown link](url), or raw URLs
    const tokenRegex = /(!\[[^\]]*\]\(https?:\/\/[^\)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\)]+\)|https?:\/\/[^\s<]+|www\.[^\s<]+)/g;
    const parts = text.split(tokenRegex);

    return parts.map((seg, i) => {
      if (!seg) return null;

      // Markdown image ![alt](url)
      const mdImgMatch = seg.match(/^!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)$/);
      if (mdImgMatch) {
        const alt = mdImgMatch[1];
        const src = mdImgMatch[2];
        return (
          <span key={i} className="block my-2 max-w-full">
            <img
              src={src}
              alt={alt || 'Image'}
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 max-h-96 object-contain shadow-xs"
              loading="lazy"
            />
          </span>
        );
      }

      // Inline code
      if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
        const codeText = seg.slice(1, -1);
        return (
          <code
            key={i}
            dir="ltr"
            className={`chat-inline-code px-1.5 py-0.5 rounded text-[11px] font-mono border inline-block [unicode-bidi:isolate] align-baseline mx-0.5 ${
              isDark
                ? 'bg-[#1e1e23] border-[#2e2e34] text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <bdi>{renderHighlightedText(codeText, activeSearchQuery, isDark, { isCode: true })}</bdi>
          </code>
        );
      }

      // Bold text
      if (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) {
        return (
          <strong key={i} className={`font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            {renderHighlightedText(seg.slice(2, -2), activeSearchQuery, isDark)}
          </strong>
        );
      }

      // Italic text
      if (seg.startsWith('*') && seg.endsWith('*') && seg.length >= 2 && !seg.startsWith('**')) {
        return (
          <em key={i} className="italic">
            {renderHighlightedText(seg.slice(1, -1), activeSearchQuery, isDark)}
          </em>
        );
      }

      // Markdown links [text](url)
      const mdLinkMatch = seg.match(/^\[([^\]]+)\]\((https?:\/\/[^\)]+)\)$/);
      if (mdLinkMatch) {
        const linkText = mdLinkMatch[1];
        const linkUrl = mdLinkMatch[2];
        return (
          <a
            key={i}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="inline-block [unicode-bidi:isolate] text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors mx-0.5 font-medium"
          >
            <bdi>{renderHighlightedText(linkText, activeSearchQuery, isDark)}</bdi>
          </a>
        );
      }

      // Raw URLs
      if (/^(https?:\/\/|www\.)[^\s<]+$/.test(seg)) {
        const href = seg.startsWith('www.') ? `https://${seg}` : seg;
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="inline-block [unicode-bidi:isolate] text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors mx-0.5 font-mono text-[11px]"
          >
            <bdi>{renderHighlightedText(seg, activeSearchQuery, isDark)}</bdi>
          </a>
        );
      }

      return <React.Fragment key={i}>{renderHighlightedText(seg, activeSearchQuery, isDark)}</React.Fragment>;
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="w-full max-w-3xl mx-auto space-y-6 px-4 py-6 relative"
    >
      {/* Floating Search Matches Navigation Banner */}
      {activeSearchQuery && (
        <div
          className={`sticky top-2 z-20 mb-4 mx-auto w-fit flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-md backdrop-blur-md text-xs animate-in fade-in slide-in-from-top-2 duration-150 ${
            isDark
              ? 'bg-[#18181b]/95 border-[#2e2e36] text-neutral-200 shadow-black/50'
              : 'bg-white/95 border-neutral-300 text-neutral-800 shadow-neutral-200'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] truncate max-w-[140px] sm:max-w-[200px]">
            Highlighting <strong className="font-semibold text-amber-400">"{activeSearchQuery}"</strong>
          </span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              isDark
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            {totalMatches > 0 ? `${currentMatchIndex + 1}/${totalMatches}` : '0 in this chat'}
          </span>

          {totalMatches > 1 && (
            <div className={`flex items-center gap-0.5 pl-0.5 border-l ${isDark ? 'border-neutral-700/60' : 'border-neutral-300'}`}>
              <button
                type="button"
                onClick={() => setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches)}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
                }`}
                title="Previous match"
                aria-label="Previous match"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentMatchIndex((prev) => (prev + 1) % totalMatches)}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
                }`}
                title="Next match"
                aria-label="Next match"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className={`p-1 rounded cursor-pointer transition-colors ml-0.5 ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
              }`}
              title="Clear search highlight"
              aria-label="Clear search highlight"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {/* Floating Selection Toolbar (Only Icon Buttons) */}
      {selectionPopover && (
        <div
          style={{
            position: 'fixed',
            top: `${Math.max(12, selectionPopover.top)}px`,
            left: `${selectionPopover.left}px`,
            transform: 'translateX(-50%)',
          }}
          className={`z-50 flex items-center gap-0.5 p-1 rounded-xl border shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
            isDark
              ? 'bg-[#1b1b1f]/95 border-[#34343d] text-neutral-300 shadow-black/60'
              : 'bg-white/95 border-neutral-300 text-neutral-700 shadow-neutral-300'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Quote selection icon-only button */}
          <button
            type="button"
            onClick={() => {
              onQuote(selectionPopover.text);
              setSelectionPopover(null);
              window.getSelection()?.removeAllRanges();
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'hover:text-purple-400 hover:bg-neutral-800'
                : 'hover:text-purple-600 hover:bg-neutral-100'
            }`}
            title="Quote selection in prompt"
            aria-label="Quote selection in prompt"
          >
            <Quote className="w-3.5 h-3.5 text-purple-400" />
          </button>

          <div
            className={`w-[1px] h-3.5 mx-0.5 ${
              isDark ? 'bg-neutral-700' : 'bg-neutral-200'
            }`}
          />

          {/* Copy selection icon-only button */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(selectionPopover.text);
              setCopiedSelection(true);
              setTimeout(() => {
                setCopiedSelection(false);
                setSelectionPopover(null);
              }, 1200);
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'hover:text-white hover:bg-neutral-800'
                : 'hover:text-black hover:bg-neutral-100'
            }`}
            title={copiedSelection ? 'Copied to clipboard' : 'Copy selection'}
            aria-label="Copy selection"
          >
            {copiedSelection ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}

      {messages.map((message, idx) => {
        const isUser = message.role === 'user';
        const isSelected = selectedMessageIds?.has(message.id);
        const isFocused = focusedMessageIndex === idx;
        const msgTypo = getMessageTypography(message.content);
        const msgDir = msgTypo.dir;
        const isRtlMsg = msgTypo.isRTL;
        const fontClass = msgTypo.className;

        return (
          <div
            key={message.id}
            data-message-id={message.id}
            data-role={message.role}
            ref={(el) => {
              messageItemRefs.current[idx] = el;
            }}
            tabIndex={0}
            role="article"
            aria-selected={isFocused}
            onClick={() => setFocusedMessageIndex(idx)}
            className={`flex items-start gap-3 group animate-message-fade-in w-full min-w-0 rounded-2xl p-1.5 transition-all outline-none ${
              isUser ? 'justify-end' : 'justify-start'
            } ${
              isFocused
                ? isDark
                  ? 'ring-2 ring-purple-500/70 bg-purple-500/[0.04]'
                  : 'ring-2 ring-purple-500/60 bg-purple-500/[0.03]'
                : ''
            }`}
          >
            {/* Checkbox for Assistant message in Select Mode */}
            {isSelectMode && !isUser && (
              <button
                type="button"
                data-export-ignore="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelectMessage?.(message.id);
                }}
                className="shrink-0 mt-2 p-0.5 rounded-lg cursor-pointer transition-transform active:scale-95"
                aria-label={isSelected ? 'Deselect message' : 'Select message'}
                title={isSelected ? 'Deselect message' : 'Select message'}
              >
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-purple-600 border-purple-500 text-white shadow-xs'
                      : isDark
                      ? 'border-neutral-600 bg-neutral-800/90 hover:border-purple-400'
                      : 'border-neutral-300 bg-white hover:border-purple-400 shadow-xs'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>
            )}

            {/* Assistant avatar on left */}
            {!isUser && (
              <div data-export-ignore="true" className="shrink-0 mt-0.5">
                <RobotMascot size={32} />
              </div>
            )}

            {/* Content container */}
            <div className={`${isUser ? 'max-w-[85%] items-end ml-auto' : 'max-w-[92%] sm:max-w-[85%] items-start w-full'} min-w-0 space-y-2`}>
              {/* Attachments if present on user message */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 justify-end items-end">
                  {message.attachments.map((att) => {
                    if (att.type === 'image') {
                      return (
                        <ImageAttachmentThumbnail
                          key={att.id}
                          attachment={att}
                          theme={theme}
                          variant="message"
                          onClick={() => setLightboxAttachment(att)}
                        />
                      );
                    }
                    return (
                      <FileAttachmentBadge
                        key={att.id}
                        attachment={att}
                        theme={theme}
                        size="sm"
                      />
                    );
                  })}
                </div>
              )}

              {/* Message Bubble or Error Card */}
              {!isUser && (message.status === 'error' || message.status === 'failed') ? (
                <div
                  className={`p-4 sm:p-5 rounded-2xl border text-xs space-y-3 shadow-xs max-w-full w-full ${
                    isDark
                      ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                      : 'bg-[#FFFFFF] border-rose-300 text-rose-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-rose-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-xs text-rose-400">Response generation failed</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                      Failed
                    </span>
                  </div>

                  <p className="text-[16px] leading-relaxed opacity-90">
                    {message.errorMessage || message.content || 'An error occurred while generating the response. Please check your model or API settings.'}
                  </p>

                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onRetryMessage) {
                          onRetryMessage(message.id);
                        } else {
                          onRegenerate();
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                      title="Retry generating response"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry response</span>
                    </button>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400/80 ml-auto">
                      {message.model && <span>{message.model}</span>}
                      <span>•</span>
                      <span>{formatTimeHHMM(message.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  dir={msgDir}
                  data-response-card={message.id}
                  data-role={message.role}
                  style={{
                    fontFamily: isUser ? undefined : msgTypo.fontFamily,
                    fontSize: isUser ? undefined : msgTypo.fontSize,
                  }}
                  onClick={isSelectMode ? () => onToggleSelectMessage?.(message.id) : undefined}
                  className={`rounded-2xl min-w-0 max-w-full transition-all duration-150 ${fontClass} ${
                    isRtlMsg ? 'text-right' : 'text-left'
                  } ${
                    isSelectMode ? 'cursor-pointer select-none' : ''
                  } ${
                    isSelected
                      ? isDark
                        ? 'p-3.5 sm:p-4 bg-purple-950/30 text-white border-2 border-purple-500 ring-2 ring-purple-500/25 shadow-md ml-auto'
                        : 'p-3.5 sm:p-4 bg-purple-50/90 text-neutral-900 border-2 border-purple-500 ring-2 ring-purple-500/25 shadow-md ml-auto'
                      : isUser
                      ? message.status === 'failed' || message.status === 'error'
                        ? isDark
                          ? 'p-3.5 sm:p-4 bg-[#27272a] text-white border-2 border-rose-500/80 shadow-sm ml-auto'
                          : 'p-3.5 sm:p-4 bg-white text-neutral-900 border-2 border-rose-400 shadow-xs ml-auto'
                        : isDark
                        ? 'p-3.5 sm:p-4 bg-[#27272a] text-white border border-[#333338] shadow-sm ml-auto'
                        : 'p-3.5 sm:p-4 bg-white text-neutral-900 border border-[#E2E5DF] shadow-xs ml-auto'
                      : isDark
                      ? 'p-3.5 sm:p-4 bg-transparent text-white'
                      : 'p-4 sm:p-5 bg-[#FFFFFF] text-neutral-900 border border-[#E8ECE6] shadow-[0_1px_3px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02)] w-full'
                  }`}
                >
                  <div className="chat-message-text min-w-0 max-w-full overflow-hidden text-[16px] leading-[1.625]">{renderFormattedContent(message.content, message.id, isUser)}</div>

                  {/* Error message banner if user message send failed */}
                  {isUser && (message.status === 'failed' || message.status === 'error') && message.errorMessage && (
                    <div className="mt-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2 text-left">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] leading-relaxed text-rose-300/95 font-sans">{message.errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Delivery status, token count, and timestamp on user messages */}
                  {isUser && (
                    <div className="flex justify-end items-center gap-2 mt-2 -mb-0.5 select-none flex-wrap">
                      {/* Delivery Status Indicator: Sending, Sent, or Failed */}
                      {message.status === 'sending' ? (
                        <span
                          role="status"
                          aria-label="Message status: Sending"
                          className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded-md border border-purple-500/30 animate-pulse select-none"
                        >
                          <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                          <span>Sending</span>
                        </span>
                      ) : message.status === 'failed' || message.status === 'error' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            role="status"
                            aria-label="Message status: Failed"
                            className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-md border border-rose-500/30 select-none"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Failed</span>
                          </span>
                          {onRetryMessage && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRetryMessage(message.id);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-lg shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                              title="Retry sending message"
                              aria-label="Retry sending message"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Retry</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span
                          role="status"
                          aria-label="Message status: Sent"
                          className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-medium select-none ${
                            isDark ? 'text-emerald-400/90' : 'text-emerald-600'
                          }`}
                          title="Delivered"
                        >
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                          <span>Sent</span>
                        </span>
                      )}

                      <span className={`text-[8px] ${isDark ? 'text-neutral-600' : 'text-neutral-300'}`}>•</span>
                      <span
                        className={`text-[10px] font-mono tracking-tight ${
                          isDark ? 'text-neutral-400/80 hover:text-neutral-300' : 'text-neutral-500/80 hover:text-neutral-700'
                        }`}
                        title={`Approximate token count: ~${calculateApproximateTokens(message.content)}`}
                      >
                        ~{formatApproximateTokens(calculateApproximateTokens(message.content))}
                      </span>
                      <span className={`text-[8px] ${isDark ? 'text-neutral-600' : 'text-neutral-300'}`}>•</span>
                      <span
                        className={`text-[10px] font-mono tracking-tight ${
                          isDark ? 'text-neutral-400' : 'text-neutral-500'
                        }`}
                      >
                        {formatTimeHHMM(message.timestamp)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons & timestamp for assistant messages (Icon-only buttons) */}
              {!isUser ? (
                <div data-export-ignore="true" className="flex items-center justify-between text-neutral-400 pt-1 pl-1">
                  <div className="flex items-center gap-1">
                    {/* Quote message icon button */}
                    <button
                      type="button"
                      onClick={() => {
                        const selection = window.getSelection()?.toString().trim();
                        onQuote(selection || message.content);
                      }}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isDark
                          ? 'hover:text-purple-400 hover:bg-[#202024]'
                          : 'hover:text-purple-600 hover:bg-neutral-100'
                      }`}
                      title="Quote message in prompt"
                      aria-label="Quote message"
                    >
                      <Quote className="w-3.5 h-3.5" />
                    </button>

                    {/* Copy message icon button */}
                    <button
                      type="button"
                      onClick={() => handleCopyText(message.id, message.content)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isDark
                          ? 'hover:text-white hover:bg-[#202024]'
                          : 'hover:text-black hover:bg-neutral-100'
                      }`}
                      title={copiedId === message.id ? 'Copied' : 'Copy message'}
                      aria-label="Copy message"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Quick Select button */}
                    {onStartSelectWithMessage && !isSelectMode && (
                      <button
                        type="button"
                        onClick={() => onStartSelectWithMessage(message.id)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isDark
                            ? 'hover:text-purple-400 hover:bg-[#202024]'
                            : 'hover:text-purple-600 hover:bg-neutral-100'
                        }`}
                        title="Select message"
                        aria-label="Select message"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onToggleLike(message.id, true)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        message.liked === true
                          ? 'text-emerald-500'
                          : isDark
                          ? 'hover:text-white hover:bg-[#202024]'
                          : 'hover:text-black hover:bg-neutral-100'
                      }`}
                      title="Helpful"
                      aria-label="Helpful"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleLike(message.id, false)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        message.liked === false
                          ? 'text-rose-500'
                          : isDark
                          ? 'hover:text-white hover:bg-[#202024]'
                          : 'hover:text-black hover:bg-neutral-100'
                      }`}
                      title="Unhelpful"
                      aria-label="Unhelpful"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={onRegenerate}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isDark
                          ? 'hover:text-white hover:bg-[#202024]'
                          : 'hover:text-black hover:bg-neutral-100'
                      }`}
                      title="Regenerate response"
                      aria-label="Regenerate response"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {/* Text-to-Speech Button */}
                    {enableTTS !== false && isTtsSupported && (
                      <button
                        type="button"
                        onClick={() => speak(message.id, message.content)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                          speakingId === message.id
                            ? 'bg-purple-600 text-white animate-pulse'
                            : isDark
                            ? 'hover:text-purple-300 hover:bg-[#202024]'
                            : 'hover:text-purple-600 hover:bg-neutral-100'
                        }`}
                        title={speakingId === message.id ? 'Stop reading aloud' : 'Read aloud with Web Speech API'}
                        aria-label={speakingId === message.id ? 'Stop reading aloud' : 'Read aloud with Web Speech API'}
                      >
                        {speakingId === message.id ? (
                          <VolumeX className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {/* Small Share Button */}
                    {onShareMessage && (
                      <button
                        type="button"
                        onClick={() => onShareMessage(message)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                          isDark
                            ? 'hover:text-purple-300 hover:bg-[#202024]'
                            : 'hover:text-purple-600 hover:bg-neutral-100'
                        }`}
                        title="Share this response"
                        aria-label="Share this response"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Subtle timestamp and approximate token count display in bottom corner of assistant message */}
                  <div className="flex items-center gap-1.5 select-none pr-1 ml-auto">
                    <span
                      className={`text-[10px] font-mono tracking-tight ${
                        isDark ? 'text-neutral-400/80 hover:text-neutral-300' : 'text-neutral-500/80 hover:text-neutral-700'
                      }`}
                      title={`Approximate token count: ~${calculateApproximateTokens(message.content)}`}
                    >
                      ~{formatApproximateTokens(calculateApproximateTokens(message.content))}
                    </span>
                    <span className={`text-[8px] ${isDark ? 'text-neutral-600' : 'text-neutral-300'}`}>•</span>
                    <span
                      className={`text-[10px] font-mono tracking-tight ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      {formatTimeHHMM(message.timestamp)}
                    </span>
                  </div>
                </div>
              ) : (
                /* Action buttons for user messages (Icon-only buttons) */
                <div
                  className={`flex items-center gap-1 text-neutral-400 transition-opacity justify-end pr-1 ${
                    message.status === 'failed' || message.status === 'error'
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                  }`}
                >
                  {/* Retry action button if failed */}
                  {onRetryMessage && (message.status === 'failed' || message.status === 'error') && (
                    <button
                      type="button"
                      onClick={() => onRetryMessage(message.id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors cursor-pointer"
                      title="Retry sending message"
                      aria-label="Retry sending message"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Retry</span>
                    </button>
                  )}

                  {/* Select message icon button */}
                  {onStartSelectWithMessage && !isSelectMode && (
                    <button
                      type="button"
                      onClick={() => onStartSelectWithMessage(message.id)}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        isDark
                          ? 'hover:text-purple-400 hover:bg-[#202024]'
                          : 'hover:text-purple-600 hover:bg-neutral-100'
                      }`}
                      title="Select message"
                      aria-label="Select message"
                    >
                      <CheckSquare className="w-3 h-3" />
                    </button>
                  )}

                  {/* Quote user message icon button */}
                  <button
                    type="button"
                    onClick={() => {
                      const selection = window.getSelection()?.toString().trim();
                      onQuote(selection || message.content);
                    }}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isDark
                        ? 'hover:text-purple-400 hover:bg-[#202024]'
                        : 'hover:text-purple-600 hover:bg-neutral-100'
                    }`}
                    title="Quote in prompt"
                    aria-label="Quote in prompt"
                  >
                    <Quote className="w-3 h-3" />
                  </button>

                  {/* Copy user message icon button */}
                  <button
                    type="button"
                    onClick={() => handleCopyText(message.id, message.content)}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isDark
                        ? 'hover:text-white hover:bg-[#202024]'
                        : 'hover:text-black hover:bg-neutral-100'
                    }`}
                    title={copiedId === message.id ? 'Copied' : 'Copy text'}
                    aria-label="Copy text"
                  >
                    {copiedId === message.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}

              {/* Keyboard Navigation Hotkey Hints Pill */}
              {isFocused && (
                <div
                  className={`flex items-center gap-1.5 sm:gap-2 mt-1 px-2.5 py-1 rounded-full text-[10px] font-mono select-none w-fit transition-all animate-in fade-in duration-150 ${
                    isDark
                      ? 'bg-[#18181c] border border-purple-500/40 text-neutral-300 shadow-md shadow-purple-950/20'
                      : 'bg-white border border-purple-300 text-neutral-700 shadow-sm'
                  } ${isUser ? 'ml-auto' : ''}`}
                >
                  <span className="flex items-center gap-1 font-semibold text-purple-400">
                    <kbd
                      className={`px-1 py-0.2 rounded font-sans text-[9px] ${
                        isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      ↑↓
                    </kbd>
                    <span>nav</span>
                  </span>
                  <span className="opacity-30">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyText(message.id, message.content);
                    }}
                    className="flex items-center gap-1 hover:text-purple-400 cursor-pointer"
                    title="Press C to copy message"
                  >
                    <kbd
                      className={`px-1 py-0.2 rounded font-sans text-[9px] font-semibold ${
                        copiedId === message.id
                          ? 'bg-emerald-500 text-white'
                          : isDark
                          ? 'bg-neutral-800 text-purple-300'
                          : 'bg-neutral-100 text-purple-700'
                      }`}
                    >
                      C
                    </kbd>
                    <span>{copiedId === message.id ? 'copied!' : 'copy'}</span>
                  </button>
                  <span className="opacity-30">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuote(message.content);
                      window.dispatchEvent(new CustomEvent('focus-chat-input'));
                    }}
                    className="flex items-center gap-1 hover:text-purple-400 cursor-pointer"
                    title="Press Q to quote message in prompt"
                  >
                    <kbd
                      className={`px-1 py-0.2 rounded font-sans text-[9px] font-semibold ${
                        isDark ? 'bg-neutral-800 text-purple-300' : 'bg-neutral-100 text-purple-700'
                      }`}
                    >
                      Q
                    </kbd>
                    <span>quote</span>
                  </button>
                  {!isUser && (
                    <>
                      <span className="opacity-30">•</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRegenerate();
                        }}
                        className="flex items-center gap-1 hover:text-purple-400 cursor-pointer"
                        title="Press R to retry generation"
                      >
                        <kbd
                          className={`px-1 py-0.2 rounded font-sans text-[9px] font-semibold ${
                            isDark ? 'bg-neutral-800 text-purple-300' : 'bg-neutral-100 text-purple-700'
                          }`}
                        >
                          R
                        </kbd>
                        <span>retry</span>
                      </button>
                    </>
                  )}
                  <span className="opacity-30">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('focus-chat-input'));
                    }}
                    className="flex items-center gap-1 hover:text-purple-400 cursor-pointer"
                    title="Press Enter to reply"
                  >
                    <kbd
                      className={`px-1 py-0.2 rounded font-sans text-[9px] font-semibold ${
                        isDark ? 'bg-neutral-800 text-purple-300' : 'bg-neutral-100 text-purple-700'
                      }`}
                    >
                      ↵
                    </kbd>
                    <span>reply</span>
                  </button>
                  <span className="opacity-30">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFocusedMessageIndex(null);
                    }}
                    className="flex items-center gap-1 hover:text-neutral-200 cursor-pointer opacity-70"
                    title="Press Esc to unfocus"
                  >
                    <kbd
                      className={`px-1 py-0.2 rounded font-sans text-[9px] font-semibold ${
                        isDark ? 'bg-neutral-800' : 'bg-neutral-100'
                      }`}
                    >
                      Esc
                    </kbd>
                  </button>
                </div>
              )}
            </div>

            {/* Checkbox for User message in Select Mode */}
            {isSelectMode && isUser && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelectMessage?.(message.id);
                }}
                className="shrink-0 mt-2 p-0.5 rounded-lg cursor-pointer transition-transform active:scale-95"
                aria-label={isSelected ? 'Deselect message' : 'Select message'}
                title={isSelected ? 'Deselect message' : 'Select message'}
              >
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-purple-600 border-purple-500 text-white shadow-xs'
                      : isDark
                      ? 'border-neutral-600 bg-neutral-800/90 hover:border-purple-400'
                      : 'border-neutral-300 bg-white hover:border-purple-400 shadow-xs'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>
            )}

            {/* User avatar on right (hidden in select mode to keep interface clean) */}
            {isUser && !isSelectMode && (
              <div
                className={`w-7 h-7 rounded-full border overflow-hidden flex items-center justify-center shrink-0 mt-0.5 select-none ${
                  isDark
                    ? 'bg-[#27272a] border-[#38383e] text-neutral-300'
                    : 'bg-white border-neutral-200 text-neutral-700 shadow-xs'
                }`}
              >
                {user?.photoURL || userProfile?.photoURL ? (
                  <img
                    src={user?.photoURL || userProfile?.photoURL || ''}
                    alt={user?.displayName || userProfile?.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                    }}
                  />
                ) : user?.displayName || user?.email || userProfile?.displayName ? (
                  <span className="text-[11px] font-bold font-mono text-purple-400">
                    {(user?.displayName || userProfile?.displayName || user?.email || 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                ) : (
                  <User className="w-3.5 h-3.5" />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Thinking / Streaming Indicator */}
      {isThinking && (
        <div className="flex items-start gap-3.5 animate-message-fade-in">
          <div className="shrink-0 mt-0.5">
            <RobotMascot size={32} isThinking={true} />
          </div>
        </div>
      )}
      {/* Image Lightbox Modal for enlarged preview */}
      <ImageLightboxModal
        attachment={lightboxAttachment}
        isOpen={!!lightboxAttachment}
        onClose={() => setLightboxAttachment(null)}
        theme={theme}
      />
    </div>
  );
};
