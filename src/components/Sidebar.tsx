import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Settings,
  Sparkles,
  X,
  Database,
  CloudCheck,
  Shield,
  UserPlus,
} from 'lucide-react';
import { ChatSession } from '../types/chat';
import { useAuth } from '../context/AuthContext';
import { renderHighlightedText } from '../lib/highlightText';
import { ConfirmationDialog } from './ConfirmationDialog';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onClearAllHistory?: () => void;
  onOpenSettings: () => void;
  onOpenAdminDashboard?: () => void;
  onOpenCreateAccount?: () => void;
  onLoadSampleChat: (topic: string) => void;
  theme: 'dark' | 'light';
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearAllHistory,
  onOpenSettings,
  onOpenAdminDashboard,
  onOpenCreateAccount,
  onLoadSampleChat,
  theme,
  searchQuery: externalSearchQuery,
  onSearchChange,
}) => {
  const { user, permissions } = useAuth();
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = (newQuery: string) => {
    if (onSearchChange) {
      onSearchChange(newQuery);
    } else {
      setInternalSearchQuery(newQuery);
    }
  };

  // Collapse sidebar on Escape key or clicking outside on mobile
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-sidebar-toggle]')) return;
      if (target.closest('[role="dialog"]')) return;
      if (window.innerWidth < 768 && sidebarRef.current && !sidebarRef.current.contains(target)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sessionToDelete) {
          setSessionToDelete(null);
          return;
        }
        if (showClearAllConfirm) {
          setShowClearAllConfirm(false);
          return;
        }
        if (searchQuery) {
          setSearchQuery('');
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, searchQuery, sessionToDelete, showClearAllConfirm]);

  const isDark = theme === 'dark';

  // Filter past chat sessions by title OR message content
  const query = searchQuery.trim().toLowerCase();

  const filteredSessions = sessions
    .map((session) => {
      if (!query) {
        return {
          session,
          matchedInTitle: true,
          contentSnippet: undefined,
          matchCount: 0,
        };
      }

      const titleLower = (session.title || '').toLowerCase();
      const matchedInTitle = titleLower.includes(query);

      let contentSnippet: string | undefined = undefined;
      let matchCount = 0;

      if (session.messages && Array.isArray(session.messages)) {
        for (const msg of session.messages) {
          if (!msg.content) continue;
          const msgLower = msg.content.toLowerCase();
          const matchIndex = msgLower.indexOf(query);
          if (matchIndex !== -1) {
            matchCount++;
            if (!contentSnippet) {
              const start = Math.max(0, matchIndex - 24);
              const end = Math.min(msg.content.length, matchIndex + query.length + 36);
              let snippet = msg.content.slice(start, end).replace(/\r?\n|\r/g, ' ');
              if (start > 0) snippet = '…' + snippet;
              if (end < msg.content.length) snippet = snippet + '…';
              contentSnippet = snippet;
            }
          }
        }
      }

      if (matchedInTitle || matchCount > 0) {
        return {
          session,
          matchedInTitle,
          contentSnippet,
          matchCount,
        };
      }

      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <>
      {/* Mobile backdrop overlay with smooth fade animation */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity duration-250 ease-out motion-reduce:transition-none ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Sidebar container:
          - Desktop: Smooth width transition (w-72 <-> w-0) with ease-in-out, content clipped cleanly
          - Mobile: Fixed drawer with smooth translate-x sliding (-translate-x-full <-> translate-x-0)
      */}
      <aside
        ref={sidebarRef}
        tabIndex={isOpen ? 0 : -1}
        aria-hidden={!isOpen}
        aria-label="Chat sidebar"
        className={`fixed md:relative inset-y-0 left-0 z-50 md:z-auto h-full flex flex-col select-none outline-none overflow-hidden shrink-0 transition-all duration-250 ease-in-out motion-reduce:transition-none ${
          isOpen
            ? 'w-72 translate-x-0 opacity-100 shadow-2xl md:shadow-none border-r pointer-events-auto'
            : 'w-72 md:w-0 -translate-x-full md:translate-x-0 opacity-0 md:opacity-100 md:border-r-0 pointer-events-none'
        } ${
          isDark
            ? 'bg-[#151518] border-[#1f1f23] text-white'
            : 'bg-[#f4f4f5] border-[#e4e4e7] text-neutral-900'
        }`}
      >
        <div className="w-72 h-full flex flex-col shrink-0 min-h-0">
          {/* Top Header & Search Bar */}
          <div
            className={`p-3 border-b space-y-2.5 ${
              isDark ? 'border-[#1f1f23]' : 'border-[#e4e4e7]'
            }`}
          >
            {/* Top row: Search input & mobile close */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title or content..."
                  className={`w-full pl-8 pr-7 py-1.5 rounded-lg text-xs placeholder-neutral-400 border focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-[#1a1a1e] border-[#27272c] text-neutral-200 focus:border-neutral-500'
                      : 'bg-white border-[#e4e4e7] text-neutral-800 focus:border-neutral-400 shadow-xs'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors cursor-pointer ${
                      isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-black'
                    }`}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                onClick={onClose}
                className={`md:hidden p-1.5 rounded-lg cursor-pointer ${
                  isDark ? 'text-neutral-400 hover:text-white hover:bg-[#27272a]' : 'text-neutral-600 hover:text-black hover:bg-neutral-200'
                }`}
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Chat Button */}
            <button
              onClick={onNewChat}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all group cursor-pointer ${
                isDark
                  ? 'bg-[#202025] hover:bg-[#28282e] border-[#2c2c32] text-white'
                  : 'bg-white hover:bg-neutral-100 border-[#e4e4e7] text-neutral-900 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus
                  className={`w-4 h-4 transition-colors ${
                    isDark ? 'text-neutral-300 group-hover:text-white' : 'text-neutral-600 group-hover:text-black'
                  }`}
                />
                <span>New chat</span>
              </div>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  isDark
                    ? 'text-neutral-500 bg-[#161619] border-[#27272a]'
                    : 'text-neutral-500 bg-neutral-100 border-neutral-200'
                }`}
              >
                ⌘K
              </span>
            </button>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-medium text-neutral-400">
            {query ? (
              <span className="flex items-center gap-1.5 font-semibold text-neutral-300">
                <span>Search results</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                    isDark ? 'bg-[#1a1a1e] border-[#27272c] text-neutral-300' : 'bg-neutral-200 border-neutral-300 text-neutral-700'
                  }`}
                >
                  {filteredSessions.length}
                </span>
              </span>
            ) : (
              <span>Recent Conversations</span>
            )}

            {user && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-mono" title="Synced to Firebase Firestore">
                <Database className="w-3 h-3" />
                Cloud
              </span>
            )}
          </div>

          {filteredSessions.map(({ session, contentSnippet, matchedInTitle }) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group flex items-start justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                  isActive
                    ? isDark
                      ? 'bg-[#222227] text-white font-medium border border-[#2f2f36]'
                      : 'bg-white text-black font-semibold border border-[#d4d4d8] shadow-xs'
                    : isDark
                    ? 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1b20]'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1 pr-1">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate ${isActive ? 'font-semibold' : ''}`}>
                      {renderHighlightedText(session.title, searchQuery, isDark)}
                    </p>
                    {contentSnippet && query && (
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5 font-normal opacity-80 flex items-center gap-1">
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-mono shrink-0 ${
                            isDark ? 'bg-[#24242c] text-neutral-300' : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          content
                        </span>
                        <span className="truncate italic">
                          "{renderHighlightedText(contentSnippet, searchQuery, isDark)}"
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessionToDelete(session);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity shrink-0 ml-1 cursor-pointer"
                  title="Delete chat"
                  aria-label={`Delete ${session.title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {filteredSessions.length === 0 && query && (
            <div className="py-8 px-3 text-center text-xs text-neutral-400 space-y-2">
              <p className="font-medium text-neutral-300">No matching chats</p>
              <p className="text-[11px] text-neutral-500 max-w-[200px] mx-auto">
                No chats found with "{query}" in title or message content.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`mt-2 px-3 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                  isDark
                    ? 'border-[#27272c] hover:bg-[#202025] text-neutral-300'
                    : 'border-neutral-300 hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                Clear search
              </button>
            </div>
          )}

          {filteredSessions.length === 0 && !query && (
            <div className="py-6 px-3 text-center text-xs text-neutral-400 space-y-3">
              <p>No conversations found</p>
              <div
                className={`text-left space-y-1 pt-2 border-t ${
                  isDark ? 'border-[#1f1f23]' : 'border-neutral-200'
                }`}
              >
                <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
                  Sample Topics
                </span>
                <button
                  onClick={() => onLoadSampleChat('architecture')}
                  className={`w-full text-left p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1f1f23]' : 'text-neutral-600 hover:text-black hover:bg-neutral-200'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">Distributed Cache Invalidations</span>
                </button>
                <button
                  onClick={() => onLoadSampleChat('debug')}
                  className={`w-full text-left p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1f1f23]' : 'text-neutral-600 hover:text-black hover:bg-neutral-200'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">Node.js Memory Leak Diagnostic</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div
          className={`p-3 border-t space-y-1 ${
            isDark ? 'border-[#1f1f23]' : 'border-[#e4e4e7]'
          }`}
        >
          {sessions.length > 0 && onClearAllHistory && (
            <button
              type="button"
              onClick={() => setShowClearAllConfirm(true)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10`}
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Clear chat history</span>
            </button>
          )}

          {/* Create Account Button for unauthenticated sidebar users */}
          {!user && onOpenCreateAccount && (
            <button
              onClick={onOpenCreateAccount}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isDark
                  ? 'text-purple-300 hover:text-white bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30'
                  : 'text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <UserPlus className="w-4 h-4 text-purple-400" />
              <span>Create Account</span>
            </button>
          )}

          {permissions.canAccessAdminDashboard && onOpenAdminDashboard && (
            <button
              onClick={onOpenAdminDashboard}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-950/30 border border-purple-500/20'
                  : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Admin Dashboard</span>
            </button>
          )}

          {permissions.canAccessSettings && (
            <button
              onClick={onOpenSettings}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                isDark
                  ? 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1b1b20]'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings & Configuration</span>
            </button>
          )}
        </div>
      </div>
    </aside>

      {/* Confirmation Dialog: Delete Single Chat Session */}
      <ConfirmationDialog
        isOpen={Boolean(sessionToDelete)}
        onClose={() => setSessionToDelete(null)}
        onConfirm={() => {
          if (sessionToDelete) {
            onDeleteSession(sessionToDelete.id);
            setSessionToDelete(null);
          }
        }}
        title="Delete conversation?"
        description={
          sessionToDelete ? (
            <>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-neutral-200 dark:text-neutral-100 truncate inline-block max-w-[200px] align-bottom">
                "{sessionToDelete.title}"
              </span>
              ? This action cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive={true}
        theme={theme}
        ariaLabelledBy="delete-session-title"
      />

      {/* Confirmation Dialog: Clear All Chat History */}
      <ConfirmationDialog
        isOpen={showClearAllConfirm}
        onClose={() => setShowClearAllConfirm(false)}
        onConfirm={() => {
          onClearAllHistory?.();
          setShowClearAllConfirm(false);
        }}
        title="Clear all chat history?"
        description={`This will permanently delete all ${sessions.length} conversations and their message history. This action cannot be undone.`}
        confirmLabel="Clear all history"
        cancelLabel="Cancel"
        isDestructive={true}
        theme={theme}
        ariaLabelledBy="clear-all-title"
      />
    </>
  );
};
