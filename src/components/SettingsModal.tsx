import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Key,
  Sliders,
  Shield,
  Trash2,
  Download,
  Eye,
  EyeOff,
  Check,
  Terminal,
  Database,
  User as UserIcon,
  Sun,
  Moon,
  LogOut,
  Server,
  FileDown,
} from 'lucide-react';
import { AppSettings } from '../types/chat';
import { useAuth } from '../context/AuthContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { ConfirmationDialog } from './ConfirmationDialog';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClearAllHistory: () => void;
  onExportHistory: () => void;
  onExportPDF?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearAllHistory,
  onExportHistory,
  onExportPDF,
  theme,
  onToggleTheme,
}) => {
  const { user, permissions, loginWithGoogle, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'api' | 'parameters' | 'system' | 'account' | 'data'>('account');
  const [showKey, setShowKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(settings.apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { isMounted, isVisible, backdropClasses, cardClasses } = useModalAnimation({
    isOpen: Boolean(isOpen && permissions.canAccessSettings),
  });

  // Close dialog on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isMounted || !permissions.canAccessSettings) return null;

  const isDark = theme === 'dark';

  const handleSaveApiKey = () => {
    onUpdateSettings({ apiKey: tempApiKey });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const systemPresets = [
    {
      title: 'Full-Stack Software Architect',
      prompt:
        'You are an elite, highly concise principal software architect. You prioritize clean code, type safety, performance, and pragmatic simplicity. Avoid fluff and corporate jargon.',
    },
    {
      title: 'Senior Debugger & Troubleshooter',
      prompt:
        'You are an expert systems troubleshooter. When presented with code or logs, immediately identify the root cause, explain why it happened, and provide the exact fix.',
    },
    {
      title: 'Academic & Deep Thinker',
      prompt:
        'You are an insightful researcher. Explain internal mechanisms, trade-offs, and first-principles mental models with crystal clarity and technical rigor.',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={onClose}
      className={backdropClasses}
    >
      <div
        ref={dialogRef}
        className={`w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border transition-colors outline-none ${
          isDark
            ? 'bg-[#18181b] border-[#2e2e34] text-white'
            : 'bg-white border-[#e4e4e7] text-neutral-900 shadow-neutral-200'
        } ${cardClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? 'border-[#27272a]' : 'border-[#e4e4e7]'
          }`}
        >
          <div className="flex items-center gap-2">
            <h2 id="settings-modal-title" className="text-base font-semibold tracking-tight">
              Settings & Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-neutral-400 hover:text-white hover:bg-[#27272a]' : 'text-neutral-500 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab navigation */}
        <div
          className={`flex items-center border-b px-4 gap-1 text-xs overflow-x-auto ${
            isDark ? 'border-[#27272a]' : 'border-[#e4e4e7]'
          }`}
        >
          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'account'
                ? isDark
                  ? 'border-white text-white'
                  : 'border-black text-black font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            Auth & Cloud
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'api'
                ? isDark
                  ? 'border-white text-white'
                  : 'border-black text-black font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            API Keys
          </button>

          <button
            onClick={() => setActiveTab('parameters')}
            className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'parameters'
                ? isDark
                  ? 'border-white text-white'
                  : 'border-black text-black font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Parameters
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'system'
                ? isDark
                  ? 'border-white text-white'
                  : 'border-black text-black font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            System Prompt
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'data'
                ? isDark
                  ? 'border-white text-white'
                  : 'border-black text-black font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Data & Privacy
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
          {/* Account & Firebase Tab */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  isDark ? 'bg-[#202024] border-[#2e2e34]' : 'bg-neutral-50 border-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-400" />
                    Firebase Firestore & Authentication
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                    Connected
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Your chat logs and custom configurations sync in real time with Google Firebase Authentication and Cloud Firestore.
                </p>

                {user ? (
                  <div className="pt-2 border-t border-inherit flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'User'}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-emerald-500"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-xs">{user.displayName}</div>
                        <div className="text-[11px] text-neutral-400 font-mono">{user.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={logout}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 text-xs transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-inherit">
                    <button
                      onClick={loginWithGoogle}
                      className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl text-xs font-semibold bg-[#4285f4] hover:bg-[#3367d6] text-white transition-colors cursor-pointer shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Sign in with Google to sync data</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Theme Settings inside Settings */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  isDark ? 'bg-[#202024] border-[#2e2e34]' : 'bg-neutral-50 border-neutral-200'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs">Visual Appearance</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    Currently using {theme === 'dark' ? 'Dark Minimalist (#121214)' : 'Clean Light (#F8F9F7)'} theme
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-[#27272a] border-[#38383e] text-white hover:bg-[#323238]'
                      : 'bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-100 shadow-xs'
                  }`}
                >
                  {isDark ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-300" />
                      <span>Switch to Light</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5" />
                      <span>Switch to Dark</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  Provider API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="sk-proj-... or AIzaSy..."
                    className={`w-full pl-3 pr-10 py-2.5 rounded-xl font-mono text-xs focus:outline-none border ${
                      isDark
                        ? 'bg-[#202024] border-[#2e2e34] text-white focus:border-neutral-400'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-neutral-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1.5">
                  Keys are stored in your secure private storage and never logged externally.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-neutral-400">
                  {tempApiKey ? 'Custom key configured' : 'Using default built-in simulator engine'}
                </span>
                <button
                  onClick={handleSaveApiKey}
                  className={`flex items-center gap-1.5 px-4 py-2 font-semibold rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-neutral-800'
                  }`}
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Saved
                    </>
                  ) : (
                    'Save Key'
                  )}
                </button>
              </div>

              {/* Private LM-Kit One Tip */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 mt-2 ${
                  isDark
                    ? 'bg-purple-950/20 border-purple-900/40 text-purple-200'
                    : 'bg-purple-50 border-purple-200 text-purple-900'
                }`}
              >
                <Server className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px]">
                  <span className="font-semibold block">Need to run private local models?</span>
                  <p className="text-neutral-400 leading-relaxed">
                    You can connect an on-premise <strong>LM-Kit One</strong> server directly from the{' '}
                    <strong>Select Model</strong> dialog at <code>http://localhost:5189/v1</code> with zero cloud telemetry.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'parameters' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-medium">
                    Creativity Temperature: {settings.temperature}
                  </label>
                  <span className="text-neutral-400">
                    {settings.temperature < 0.3 ? 'Deterministic' : settings.temperature > 0.7 ? 'Creative' : 'Balanced'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                  <span>0.0 (Strict / Code)</span>
                  <span>0.7 (Standard)</span>
                  <span>1.0 (Brainstorming)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-inherit space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-medium block">Auto-scroll to bottom</span>
                    <span className="text-[11px] text-neutral-400">
                      Automatically scroll to newest messages as responses are generated
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoScrollToBottom !== false}
                    onChange={(e) => onUpdateSettings({ autoScrollToBottom: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-medium block">Stream token responses</span>
                    <span className="text-[11px] text-neutral-400">
                      Simulate natural real-time typewriter word-by-word streaming
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.streamingEnabled}
                    onChange={(e) => onUpdateSettings({ streamingEnabled: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-medium block">Text-to-Speech (Read Aloud)</span>
                    <span className="text-[11px] text-neutral-400">
                      Display an audio speech button on assistant messages to read responses aloud via the Web Speech API
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableTTS !== false}
                    onChange={(e) => onUpdateSettings({ enableTTS: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-3">
              <div>
                <label className="block font-medium mb-1.5">
                  Custom System Persona Instructions
                </label>
                <textarea
                  value={settings.systemPrompt}
                  onChange={(e) => onUpdateSettings({ systemPrompt: e.target.value })}
                  rows={4}
                  className={`w-full p-3 rounded-xl text-xs leading-relaxed focus:outline-none resize-none font-mono border ${
                    isDark
                      ? 'bg-[#202024] border-[#2e2e34] text-white focus:border-neutral-400'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-neutral-400'
                  }`}
                  placeholder="Enter system prompt instructions..."
                />
              </div>

              <div>
                <span className="text-[11px] font-medium text-neutral-400 block mb-2">
                  Quick Presets:
                </span>
                <div className="space-y-1.5">
                  {systemPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => onUpdateSettings({ systemPrompt: preset.prompt })}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-[#202024] hover:bg-[#27272b] border-[#2b2b31] text-neutral-200'
                          : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
                      }`}
                    >
                      <div className="font-medium">{preset.title}</div>
                      <div className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {preset.prompt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
              {/* Export to PDF row */}
              {onExportPDF && (
                <div
                  className={`p-3.5 border rounded-xl flex items-center justify-between ${
                    isDark ? 'bg-[#202024] border-[#2e2e34]' : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div>
                    <div className="font-medium flex items-center gap-1.5">
                      <span>Export Conversation to PDF</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        PDF
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400">Download formatted document with jsPDF</div>
                  </div>
                  <button
                    onClick={() => {
                      onExportPDF();
                      onClose();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#27272a] hover:bg-[#323238] border-[#3f3f46] text-white'
                        : 'bg-white hover:bg-neutral-100 border-neutral-200 text-black shadow-xs'
                    }`}
                  >
                    <FileDown className="w-3.5 h-3.5 text-rose-400" />
                    <span>Export PDF</span>
                  </button>
                </div>
              )}

              <div
                className={`p-3.5 border rounded-xl flex items-center justify-between ${
                  isDark ? 'bg-[#202024] border-[#2e2e34]' : 'bg-neutral-50 border-neutral-200'
                }`}
              >
                <div>
                  <div className="font-medium">Export Chat History</div>
                  <div className="text-[11px] text-neutral-400">Download current session logs as JSON</div>
                </div>
                <button
                  onClick={onExportHistory}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition-colors cursor-pointer ${
                    isDark ? 'bg-[#27272a] hover:bg-[#323238] border-[#3f3f46] text-white' : 'bg-white hover:bg-neutral-100 border-neutral-200 text-black shadow-xs'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>

              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-medium text-rose-500">Clear All Chat History</div>
                  <div className="text-[11px] text-rose-400">Permanently delete stored messages</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Data
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Footer with explicit Done button */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-end text-xs shrink-0 ${
            isDark ? 'border-[#27272a] bg-[#141416]' : 'border-[#e4e4e7] bg-neutral-50'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              isDark
                ? 'border-[#2e2e34] bg-[#222226] text-white hover:bg-[#2c2c32]'
                : 'border-neutral-300 bg-white text-black hover:bg-neutral-100 shadow-xs'
            }`}
          >
            Done
          </button>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          onClearAllHistory();
          onClose();
        }}
        title="Clear all chat history?"
        description="Are you sure you want to permanently delete all conversations and message history? This action cannot be undone."
        confirmLabel="Clear Data"
        cancelLabel="Cancel"
        isDestructive={true}
        theme={theme}
      />
    </div>
  );
};
