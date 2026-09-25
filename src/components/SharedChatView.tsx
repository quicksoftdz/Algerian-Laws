import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  FileDown,
  ArrowLeft,
  Sparkles,
  Clock,
  Shield,
  Volume2,
  VolumeX,
  Bot,
  User as UserIcon,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Loader2,
  PlusCircle,
} from 'lucide-react';
import { SharedChatSession, Message, ChatSession } from '../types/chat';
import { getSharedChatSession } from '../lib/firebase';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { exportChatToPDF } from '../services/pdfExport';
import { formatTimeHHMM } from './ChatMessageList';
import { getMessageTypography } from '../utils/textDirection';

interface SharedChatViewProps {
  shareId: string;
  theme: 'dark' | 'light';
  onExitSharedView: () => void;
  onForkConversation: (session: SharedChatSession) => void;
}

export const SharedChatView: React.FC<SharedChatViewProps> = ({
  shareId,
  theme,
  onExitSharedView,
  onForkConversation,
}) => {
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [sharedSession, setSharedSession] = useState<SharedChatSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const { speak, stop, speakingId, isSupported } = useTextToSpeech();

  useEffect(() => {
    let isSubscribed = true;
    setLoading(true);
    setError(null);

    getSharedChatSession(shareId)
      .then((data) => {
        if (!isSubscribed) return;
        if (!data) {
          setError('This shared conversation link does not exist or has expired.');
          setLoading(false);
          return;
        }

        // Check if expired
        if (data.expiresAt && Date.now() > data.expiresAt) {
          setError('This shared conversation link has expired (past 7-day retention period).');
          setLoading(false);
          return;
        }

        setSharedSession(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        console.error('Error fetching shared chat:', err);
        setError('Failed to load shared conversation. Please check network connection.');
        setLoading(false);
      });

    return () => {
      isSubscribed = false;
      stop();
    };
  }, [shareId, stop]);

  const handleCopyShareLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error('Failed to copy share link:', e);
    }
  };

  const handleCopyMessage = async (msgId: string, content: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      }
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (e) {
      console.error('Failed to copy message:', e);
    }
  };

  const handleExportPDF = () => {
    if (!sharedSession) return;
    const sessionObj: ChatSession = {
      id: sharedSession.id,
      title: sharedSession.title,
      createdAt: sharedSession.createdAt,
      updatedAt: sharedSession.createdAt,
      model: sharedSession.model,
      messages: sharedSession.messages,
    };
    exportChatToPDF(sessionObj, sharedSession.messages, sharedSession.model);
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 ${
          isDark ? 'bg-[#0f0f11] text-white' : 'bg-neutral-50 text-neutral-900'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-sm font-medium text-neutral-400">Loading shared conversation...</p>
        </div>
      </div>
    );
  }

  if (error || !sharedSession) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 ${
          isDark ? 'bg-[#0f0f11] text-white' : 'bg-neutral-50 text-neutral-900'
        }`}
      >
        <div
          className={`max-w-md w-full p-6 rounded-2xl border text-center space-y-4 shadow-xl ${
            isDark ? 'bg-[#18181c] border-[#2e2e34]' : 'bg-white border-neutral-200'
          }`}
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold">Shared Chat Not Found</h2>
            <p className="text-xs text-neutral-400 mt-1">{error || 'This conversation is no longer available.'}</p>
          </div>
          <button
            type="button"
            onClick={onExitSharedView}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all cursor-pointer shadow-sm"
          >
            Go to Main AI Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isDark ? 'bg-[#0f0f11] text-white' : 'bg-neutral-50 text-neutral-900'
      }`}
    >
      {/* Top Banner: Read-Only Public Indicator */}
      <div
        className={`sticky top-0 z-30 px-4 py-2.5 border-b backdrop-blur-md flex flex-wrap items-center justify-between gap-3 ${
          isDark
            ? 'bg-[#141418]/90 border-[#27272c] text-neutral-200'
            : 'bg-white/90 border-neutral-200 text-neutral-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExitSharedView}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              isDark ? 'hover:bg-[#202025] text-neutral-300' : 'hover:bg-neutral-100 text-neutral-700'
            }`}
            title="Return to Main Chat"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to App</span>
          </button>

          <div className="h-4 w-px bg-neutral-500/30" />

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/30">
              Read-Only Public Snapshot
            </span>
            <span className="text-xs font-semibold truncate max-w-[200px] sm:max-w-md hidden md:inline">
              {sharedSession.title}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyShareLink}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              isDark
                ? 'border-[#2e2e34] bg-[#1a1a1f] hover:bg-[#22222a] text-neutral-300'
                : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
            }`}
            title="Copy Public Link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              isDark
                ? 'border-[#2e2e34] bg-[#1a1a1f] hover:bg-[#22222a] text-neutral-300'
                : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
            }`}
            title="Export as PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onForkConversation(sharedSession)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all cursor-pointer shadow-xs shadow-purple-950/30"
            title="Clone conversation into your own workspace and continue chatting"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Continue in My Chat</span>
          </button>
        </div>
      </div>

      {/* Main Conversation Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Header Metadata Info Card */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
            isDark ? 'bg-[#141418] border-[#27272c]' : 'bg-white border-neutral-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-purple-400 font-semibold uppercase tracking-wider">
                Shared Conversation
              </span>
              <h1 className="text-base sm:text-lg font-bold tracking-tight">{sharedSession.title}</h1>
            </div>
            <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-medium shrink-0 bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
              {sharedSession.messages.length} messages
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-inherit text-xs text-neutral-400">
            <span className="flex items-center gap-1 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              {sharedSession.model}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Temporary Public Link
            </span>
            <span>•</span>
            <span>Created {new Date(sharedSession.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Message Stream */}
        <div className="space-y-4 pb-20">
          {sharedSession.messages.map((msg, index) => {
            const isAssistant = msg.role === 'assistant';
            const isSpeakingThis = speakingId === msg.id;
            const msgTypo = getMessageTypography(msg.content);

            return (
              <div
                key={msg.id || index}
                dir={msgTypo.dir}
                style={{ fontFamily: msgTypo.fontFamily }}
                className={`p-4 sm:p-5 rounded-2xl border space-y-2 transition-all ${msgTypo.className} ${
                  isAssistant
                    ? isDark
                      ? 'bg-[#18181c] border-[#27272c] text-white'
                      : 'bg-white border-neutral-200 text-neutral-900'
                    : isDark
                    ? 'bg-[#1f1a29] border-purple-500/20 text-neutral-100'
                    : 'bg-purple-50 border-purple-200 text-neutral-900'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isAssistant ? (
                      <div className="p-1 rounded-lg bg-purple-500/10 text-purple-400">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="p-1 rounded-lg bg-neutral-500/10 text-neutral-400">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <span className="text-xs font-bold font-mono">
                      {isAssistant ? msg.model || sharedSession.model : 'User'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* TTS Button for Assistant messages */}
                    {isAssistant && isSupported && (
                      <button
                        type="button"
                        onClick={() => speak(msg.id, msg.content)}
                        className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                          isSpeakingThis
                            ? 'bg-purple-600 text-white animate-pulse'
                            : isDark
                            ? 'hover:bg-[#27272c] text-neutral-400 hover:text-white'
                            : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
                        }`}
                        title={isSpeakingThis ? 'Stop speaking' : 'Read aloud with Web Speech API'}
                      >
                        {isSpeakingThis ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-white" />
                            <span className="text-[10px] font-mono">Speaking...</span>
                          </>
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {/* Copy message */}
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isDark
                          ? 'hover:bg-[#27272c] text-neutral-400 hover:text-white'
                          : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
                      }`}
                      title={copiedMessageId === msg.id ? 'Copied' : 'Copy message text'}
                    >
                      {copiedMessageId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span className="text-[10px] font-mono text-neutral-500">
                      {formatTimeHHMM(msg.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Message Body */}
                <div
                  dir={msgTypo.dir}
                  style={{ fontFamily: msgTypo.fontFamily }}
                  className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words pt-1 ${
                    msgTypo.isRTL ? 'text-right' : 'text-left'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Bottom Prompt / Fork Callout */}
      <div
        className={`fixed bottom-0 inset-x-0 p-4 border-t backdrop-blur-md z-20 flex items-center justify-center ${
          isDark ? 'bg-[#141418]/90 border-[#27272c]' : 'bg-white/90 border-neutral-200'
        }`}
      >
        <div className="max-w-xl w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border shadow-lg bg-purple-950/20 border-purple-500/30">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-purple-300 block">Want to ask follow-up questions?</span>
            <span className="text-[11px] text-neutral-400 block">
              Clone this conversation into your interactive workspace.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onForkConversation(sharedSession)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all cursor-pointer shadow-md shrink-0"
          >
            Continue Chat
          </button>
        </div>
      </div>
    </div>
  );
};
