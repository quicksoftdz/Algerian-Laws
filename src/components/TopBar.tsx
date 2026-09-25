import React, { useState, useEffect, useRef } from 'react';
import {
  PanelLeft,
  CodeXml,
  ChevronDown,
  MessageSquare,
  Sun,
  Moon,
  Plus,
  SquarePen,
  Server,
  MoreVertical,
  FileDown,
  Download,
  Trash2,
  CheckSquare,
  Search,
  BarChart3,
  Shield,
  UserPlus,
  Share2,
} from 'lucide-react';
import { ModelOption } from '../types/chat';
import { UserAuthMenu } from './UserAuthMenu';
import { useAuth } from '../context/AuthContext';

interface TopBarProps {
  currentModel: ModelOption;
  onOpenModelSelector: () => void;
  onToggleSidebar: () => void;
  onOpenFeedback: () => void;
  onOpenSettings: () => void;
  onOpenAdminDashboard?: () => void;
  onOpenCreateAccount?: () => void;
  onOpenAdminSignIn?: () => void;
  isSidebarOpen: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  hasActiveMessages?: boolean;
  onNewChat?: () => void;
  onShareChat?: () => void;
  onExportPDF?: () => void;
  onExportJSON?: () => void;
  onClearChat?: () => void;
  isSelectMode?: boolean;
  onToggleSelectMode?: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentModel,
  onOpenModelSelector,
  onToggleSidebar,
  onOpenFeedback,
  onOpenSettings,
  onOpenAdminDashboard,
  onOpenCreateAccount,
  onOpenAdminSignIn,
  isSidebarOpen,
  theme,
  onToggleTheme,
  hasActiveMessages = false,
  onNewChat,
  onShareChat,
  onExportPDF,
  onExportJSON,
  onClearChat,
  isSelectMode = false,
  onToggleSelectMode,
  isSearchOpen = false,
  onToggleSearch,
}) => {
  const { user, permissions } = useAuth();
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  // Close options menu on click outside or Escape key
  useEffect(() => {
    if (!isOptionsMenuOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOptionsMenuOpen(false);
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
  }, [isOptionsMenuOpen]);

  return (
    <header
      className={`h-14 w-full shrink-0 px-4 flex items-center justify-between border-b backdrop-blur-md sticky top-0 z-30 select-none transition-colors duration-200 shadow-xs ${
        isDark
          ? 'border-[#1f1f23] bg-[#121214]/90 text-white'
          : 'border-[#e4e4e7] bg-white/90 text-neutral-900 shadow-xs'
      }`}
    >
      {/* Left zone: Sidebar toggle + Model Selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          data-sidebar-toggle="true"
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title="Toggle sidebar"
          className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 ${
            isDark
              ? 'text-neutral-400 hover:text-white hover:bg-[#27272a] focus-visible:ring-neutral-400 ' +
                (isSidebarOpen ? 'bg-[#1f1f24] text-white' : '')
              : 'text-neutral-600 hover:text-black hover:bg-neutral-100 focus-visible:ring-neutral-500 ' +
                (isSidebarOpen ? 'bg-neutral-200 text-black' : '')
          }`}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Model selector dropdown pill (Admin only, hidden from regular users) */}
        {permissions.canSelectModel && (
          <button
            onClick={onOpenModelSelector}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer group shadow-xs focus-visible:outline-none focus-visible:ring-1 ${
              isDark
                ? 'bg-[#1a1a1e] hover:bg-[#242429] border-[#2b2b31] text-neutral-200 hover:text-white focus-visible:ring-neutral-400'
                : 'bg-neutral-50 hover:bg-neutral-100 border-[#e4e4e7] text-neutral-800 hover:text-black focus-visible:ring-neutral-500'
            }`}
            title="Switch AI Model (Admin)"
          >
            {currentModel.provider === 'LM-Kit One' ? (
              <Server className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <CodeXml
                className={`w-3.5 h-3.5 transition-colors ${
                  isDark ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-black'
                }`}
              />
            )}
            <span className="font-medium tracking-tight truncate max-w-[140px] sm:max-w-[200px]">
              {currentModel.name}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                isDark ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-black'
              }`}
            />
          </button>
        )}

        {/* If in active chat, show "New Chat" button styled like Dashboard button */}
        {hasActiveMessages && onNewChat && (
          <button
            onClick={onNewChat}
            aria-label="New Chat"
            title="Start new conversation"
            className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 cursor-pointer flex items-center gap-1.5 ${
              isDark
                ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 border border-purple-500/20 focus-visible:ring-purple-400'
                : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50 border border-purple-200 focus-visible:ring-purple-500'
            }`}
          >
            <Plus className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold">New Chat</span>
          </button>
        )}
      </div>

      {/* Right zone: Chat Options Menu + Feedback + Theme toggle + User Profile / Google Sign-in */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* In-chat Search toggle button */}
        {hasActiveMessages && onToggleSearch && (
          <button
            type="button"
            onClick={onToggleSearch}
            aria-label="Search conversation"
            title="Search in conversation (⌘F / Ctrl+F)"
            className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 cursor-pointer ${
              isSearchOpen
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : isDark
                ? 'text-neutral-400 hover:text-white hover:bg-[#27272a] focus-visible:ring-neutral-400'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100 focus-visible:ring-neutral-500'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        {/* Select Mode toggle indicator or button */}
        {hasActiveMessages && onToggleSelectMode && (
          isSelectMode ? (
            <button
              type="button"
              onClick={onToggleSelectMode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 border border-purple-500/50 text-purple-300 hover:bg-purple-500/30 transition-colors cursor-pointer"
              title="Exit Select Mode"
            >
              <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
              <span>Done</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleSelectMode}
              aria-label="Select messages"
              title="Select messages"
              className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 cursor-pointer ${
                isDark
                  ? 'text-neutral-400 hover:text-white hover:bg-[#27272a] focus-visible:ring-neutral-400'
                  : 'text-neutral-600 hover:text-black hover:bg-neutral-100 focus-visible:ring-neutral-500'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          )
        )}

        {/* Chat Options Menu Dropdown */}
        <div className="relative" ref={optionsMenuRef}>
          <button
            onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
            aria-label="Chat options menu"
            title="Chat options"
            className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 cursor-pointer ${
              isDark
                ? 'text-neutral-400 hover:text-white hover:bg-[#27272a] focus-visible:ring-neutral-400 ' +
                  (isOptionsMenuOpen ? 'bg-[#27272a] text-white' : '')
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100 focus-visible:ring-neutral-500 ' +
                  (isOptionsMenuOpen ? 'bg-neutral-200 text-black' : '')
            }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Chat options dropdown popup */}
          {isOptionsMenuOpen && (
            <div
              className={`absolute right-0 top-10 z-50 w-56 rounded-xl border shadow-xl p-1.5 space-y-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
                isDark
                  ? 'bg-[#18181b]/95 border-[#2e2e34] text-white shadow-black/60'
                  : 'bg-white/95 border-[#e4e4e7] text-neutral-900 shadow-neutral-200'
              }`}
            >
              <div className="px-2.5 py-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Chat Options
              </div>

              {/* Select mode in dropdown */}
              {onToggleSelectMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsMenuOpen(false);
                    onToggleSelectMode();
                  }}
                  disabled={!hasActiveMessages}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    !hasActiveMessages
                      ? 'opacity-40 cursor-not-allowed'
                      : isDark
                      ? 'hover:bg-[#27272a] text-neutral-200 hover:text-white'
                      : 'hover:bg-neutral-100 text-neutral-800 hover:text-black'
                  }`}
                  title={isSelectMode ? 'Exit select mode' : 'Select multiple messages'}
                >
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="font-medium">{isSelectMode ? 'Exit Select Mode' : 'Select Messages'}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    isSelectMode
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  }`}>
                    {isSelectMode ? 'Active' : 'Select'}
                  </span>
                </button>
              )}

              {/* Export to PDF Button using jsPDF */}
              <button
                type="button"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  onExportPDF?.();
                }}
                disabled={!hasActiveMessages}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                  !hasActiveMessages
                    ? 'opacity-40 cursor-not-allowed'
                    : isDark
                    ? 'hover:bg-[#27272a] text-neutral-200 hover:text-white'
                    : 'hover:bg-neutral-100 text-neutral-800 hover:text-black'
                }`}
                title="Export current conversation to PDF with jsPDF"
              >
                <div className="flex items-center gap-2">
                  <FileDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="font-medium">Export to PDF</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  PDF
                </span>
              </button>

              {/* Export to JSON */}
              {onExportJSON && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsMenuOpen(false);
                    onExportJSON();
                  }}
                  disabled={!hasActiveMessages}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    !hasActiveMessages
                      ? 'opacity-40 cursor-not-allowed'
                      : isDark
                      ? 'hover:bg-[#27272a] text-neutral-200 hover:text-white'
                      : 'hover:bg-neutral-100 text-neutral-800 hover:text-black'
                  }`}
                  title="Export current conversation as JSON"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Export to JSON</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    JSON
                  </span>
                </button>
              )}

              {/* Share public link */}
              {hasActiveMessages && onShareChat && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsMenuOpen(false);
                    onShareChat();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    isDark
                      ? 'hover:bg-[#27272a] text-neutral-200 hover:text-white'
                      : 'hover:bg-neutral-100 text-neutral-800 hover:text-black'
                  }`}
                  title="Generate temporary public read-only link"
                >
                  <div className="flex items-center gap-2">
                    <Share2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Share link</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Link
                  </span>
                </button>
              )}

              {/* Clear conversation if active messages */}
              {hasActiveMessages && onClearChat && (
                <>
                  <div
                    className={`h-[1px] my-1 ${
                      isDark ? 'bg-[#27272a]' : 'bg-neutral-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsOptionsMenuOpen(false);
                      onClearChat();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer text-left`}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Clear chat messages</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Share Button in Navigation Bar Header */}
        {hasActiveMessages && onShareChat && (
          <button
            type="button"
            onClick={onShareChat}
            aria-label="Share conversation"
            title="Share conversation (Generate temporary public link)"
            className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 cursor-pointer flex items-center gap-1.5 ${
              isDark
                ? 'text-neutral-400 hover:text-purple-300 hover:bg-[#27272a] focus-visible:ring-neutral-400'
                : 'text-neutral-600 hover:text-purple-700 hover:bg-neutral-100 focus-visible:ring-neutral-500'
            }`}
          >
            <Share2 className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold hidden lg:inline">Share</span>
          </button>
        )}

        {/* Admin Only: Quick Access to Admin Control & Telemetry Dashboard */}
        {permissions.canAccessAdminDashboard && onOpenAdminDashboard && (
          <button
            onClick={onOpenAdminDashboard}
            aria-label="Admin Dashboard"
            title="Admin Dashboard (Usage Analytics & Audit Logs)"
            className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 cursor-pointer flex items-center gap-1.5 ${
              isDark
                ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 border border-purple-500/20 focus-visible:ring-purple-400'
                : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50 border border-purple-200 focus-visible:ring-purple-500'
            }`}
          >
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold hidden md:inline">Dashboard</span>
          </button>
        )}

        {/* Feedback Button (Visible only when user is logged in) */}
        {user && (
          <button
            onClick={onOpenFeedback}
            aria-label="Send feedback"
            title="Provide feedback"
            className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 ${
              isDark
                ? 'text-neutral-400 hover:text-white hover:bg-[#27272a] focus-visible:ring-neutral-400'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100 focus-visible:ring-neutral-500'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        )}

        {/* Real Light / Dark theme toggle */}
        <button
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
          title={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
          className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 cursor-pointer ${
            isDark
              ? 'text-neutral-400 hover:text-white hover:bg-[#27272a] focus-visible:ring-neutral-400'
              : 'text-neutral-600 hover:text-black hover:bg-neutral-100 focus-visible:ring-neutral-500'
          }`}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-300 hover:rotate-12 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-neutral-800 hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Create Account Button (Visible ONLY when NOT authenticated / logged in) */}
        {!user && onOpenCreateAccount && (
          <button
            onClick={onOpenCreateAccount}
            aria-label="Create Account"
            title="Create a new account"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isDark
                ? 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/30 shadow-purple-950/20'
                : 'bg-purple-600 hover:bg-purple-700 text-white border border-purple-600 shadow-purple-100'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Create Account</span>
          </button>
        )}

        {/* User Auth Menu (Firebase Auth & Account Management) */}
        <UserAuthMenu
          onOpenSettings={onOpenSettings}
          onOpenAdminDashboard={onOpenAdminDashboard}
          onOpenCreateAccount={onOpenCreateAccount}
          onOpenAdminSignIn={onOpenAdminSignIn}
          theme={theme}
        />
      </div>
    </header>
  );
};
