import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Shield,
  MessageSquare,
  Sparkles,
  Loader2,
  CheckCircle2,
  Bot,
  User as UserIcon,
  Layers,
  FileText,
} from 'lucide-react';
import { ChatSession, SharedChatSession, Message } from '../types/chat';
import { createSharedChatSession } from '../lib/firebase';
import { useModalAnimation } from '../hooks/useModalAnimation';

export type ShareScope = 'response_only' | 'prompt_and_response' | 'entire_chat';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ChatSession | null;
  targetMessage?: Message | null;
  theme: 'dark' | 'light';
  authorName?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  session,
  targetMessage,
  theme,
  authorName,
}) => {
  const isDark = theme === 'dark';
  const [shareScope, setShareScope] = useState<ShareScope>(() =>
    targetMessage ? 'response_only' : 'entire_chat'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [sharedData, setSharedData] = useState<SharedChatSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { isMounted, isVisible, backdropClasses, cardClasses } = useModalAnimation({
    isOpen: Boolean(isOpen && session),
  });

  // Reset or update shareScope whenever modal opens with targetMessage
  useEffect(() => {
    if (isOpen) {
      setShareScope(targetMessage ? 'response_only' : 'entire_chat');
      setCopied(false);
      setError(null);
    }
  }, [isOpen, targetMessage]);

  // Compute messages based on selected scope
  const { messagesToShare, computedTitle } = React.useMemo(() => {
    if (!session) return { messagesToShare: [], computedTitle: 'Shared Conversation' };

    const allMsgs = session.messages || [];

    if (shareScope === 'response_only' && targetMessage) {
      const excerpt =
        targetMessage.content.length > 50
          ? `${targetMessage.content.slice(0, 50)}...`
          : targetMessage.content || 'AI Response';
      return {
        messagesToShare: [targetMessage],
        computedTitle: `Response: "${excerpt}"`,
      };
    }

    if (shareScope === 'prompt_and_response' && targetMessage) {
      const msgIndex = allMsgs.findIndex((m) => m.id === targetMessage.id);
      let promptMsg: Message | null = null;
      if (msgIndex > 0) {
        for (let i = msgIndex - 1; i >= 0; i--) {
          if (allMsgs[i].role === 'user') {
            promptMsg = allMsgs[i];
            break;
          }
        }
      }
      const pair = promptMsg ? [promptMsg, targetMessage] : [targetMessage];
      const excerpt = promptMsg
        ? promptMsg.content.slice(0, 45) + (promptMsg.content.length > 45 ? '...' : '')
        : 'Conversation';
      return {
        messagesToShare: pair,
        computedTitle: `Q&A: "${excerpt}"`,
      };
    }

    // Default: Entire chat
    return {
      messagesToShare: allMsgs,
      computedTitle: session.title || 'Shared Conversation',
    };
  }, [session, targetMessage, shareScope]);

  // Generate public link whenever modal opens or scope changes
  useEffect(() => {
    if (!isOpen || !session || messagesToShare.length === 0) {
      setSharedData(null);
      return;
    }

    let isSubscribed = true;
    setIsGenerating(true);
    setError(null);

    createSharedChatSession(session, authorName, 7, messagesToShare, computedTitle)
      .then((data) => {
        if (isSubscribed) {
          setSharedData(data);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          console.error('Failed to create share link:', err);
          setError('Could not generate cloud link. Please check network connection.');
          setIsGenerating(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, session, shareScope, authorName, messagesToShare, computedTitle]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isMounted || !session) return null;

  const shareUrl = sharedData
    ? `${window.location.origin}${window.location.pathname}?share=${sharedData.id}`
    : '';

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy share link:', e);
    }
  };

  const handleOpenLink = () => {
    if (!shareUrl) return;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const responseSnippet = targetMessage
    ? targetMessage.content.slice(0, 160) + (targetMessage.content.length > 160 ? '...' : '')
    : messagesToShare[messagesToShare.length - 1]?.content.slice(0, 160) || '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs transition-opacity ${backdropClasses}`}
      onClick={(e) => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all transform ${
          isDark ? 'bg-[#18181c] border-[#2e2e34] text-white' : 'bg-white border-neutral-200 text-neutral-900'
        } ${cardClasses}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-inherit">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="share-modal-title" className="text-sm font-bold tracking-tight">
                {targetMessage ? 'Share Response' : 'Share Conversation'}
              </h2>
              <p className="text-[11px] text-neutral-400">
                Generate a temporary public read-only link to share via URL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'hover:bg-[#282830] text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-black'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Scope Selector Options */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Share Content Range
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-500/10 border border-inherit">
              {targetMessage && (
                <button
                  type="button"
                  onClick={() => setShareScope('response_only')}
                  className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    shareScope === 'response_only'
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : isDark
                      ? 'text-neutral-400 hover:text-white hover:bg-[#222228]'
                      : 'text-neutral-600 hover:text-black hover:bg-white'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5 mb-1" />
                  <span className="text-[11px] leading-tight">Response Only</span>
                </button>
              )}

              {targetMessage && (
                <button
                  type="button"
                  onClick={() => setShareScope('prompt_and_response')}
                  className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    shareScope === 'prompt_and_response'
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : isDark
                      ? 'text-neutral-400 hover:text-white hover:bg-[#222228]'
                      : 'text-neutral-600 hover:text-black hover:bg-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 mb-1" />
                  <span className="text-[11px] leading-tight">Prompt & Response</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShareScope('entire_chat')}
                className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  !targetMessage ? 'col-span-3' : ''
                } ${
                  shareScope === 'entire_chat'
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-[#222228]'
                    : 'text-neutral-600 hover:text-black hover:bg-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 mb-1" />
                <span className="text-[11px] leading-tight">Full Chat ({session.messages.length})</span>
              </button>
            </div>
          </div>

          {/* Conversation / Response Preview Card */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              isDark ? 'bg-[#141416] border-[#27272c]' : 'bg-neutral-50 border-neutral-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
                  {shareScope === 'response_only'
                    ? 'Single Response Card Snapshot'
                    : shareScope === 'prompt_and_response'
                    ? 'Q&A Card Snapshot'
                    : 'Full Chat Conversation'}
                </span>
                <h3 className="font-bold text-xs truncate" title={computedTitle}>
                  {computedTitle}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium shrink-0 bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                {messagesToShare.length} {messagesToShare.length === 1 ? 'card' : 'cards'}
              </span>
            </div>

            {responseSnippet && (
              <p className="text-[11px] text-neutral-400 italic line-clamp-2 pt-1 border-t border-inherit">
                "{responseSnippet}"
              </p>
            )}

            <div className="flex items-center gap-3 pt-1 text-[11px] text-neutral-400 border-t border-inherit">
              <span className="flex items-center gap-1 font-mono">
                <Sparkles className="w-3 h-3 text-purple-400" />
                {targetMessage?.model || session.model}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                7-day validity
              </span>
            </div>
          </div>

          {/* URL Generator Section */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-300">
              Unique Public Read-Only Link
            </label>

            {isGenerating ? (
              <div
                className={`flex items-center justify-center gap-2 p-4 rounded-xl border ${
                  isDark ? 'bg-[#141416] border-[#27272c]' : 'bg-neutral-50 border-neutral-200'
                }`}
              >
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-xs text-neutral-400">Generating unique public link...</span>
              </div>
            ) : error ? (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div
                  className={`flex items-center gap-2 p-2 rounded-xl border ${
                    isDark ? 'bg-[#141416] border-[#27272c]' : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full bg-transparent text-xs font-mono px-1 select-all focus:outline-none text-purple-300 truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-xs'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Anyone with the link can view in read-only mode
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenLink}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-neutral-400 hover:underline"
                  >
                    <span>Preview Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Safety & Read-Only Notice */}
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              isDark ? 'bg-purple-950/20 border-purple-900/30 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-900'
            }`}
          >
            <Shield className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11px] leading-relaxed">
              <span className="font-semibold block">Privacy & Security Guarantee</span>
              <p className="text-neutral-400">
                Shared links only expose the selected text snapshot. Your API keys, private account data, and other conversations remain strictly protected.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-inherit bg-inherit">
          <span className="text-[10px] text-neutral-500 font-mono">
            Unique ID: {sharedData?.id || '...'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                isDark ? 'border-[#2e2e34] hover:bg-[#222227] text-neutral-300' : 'border-neutral-300 hover:bg-neutral-100 text-neutral-700'
              }`}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
