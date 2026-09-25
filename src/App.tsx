import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RobotMascot } from './components/RobotMascot';
import { TopBar } from './components/TopBar';
import { ChatInput } from './components/ChatInput';
import { ChatMessageList } from './components/ChatMessageList';
import { ModelSelectorModal } from './components/ModelSelectorModal';
import { SettingsModal } from './components/SettingsModal';
import { FeedbackModal } from './components/FeedbackModal';
import { Sidebar } from './components/Sidebar';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { CreateAccountModal } from './components/CreateAccountModal';
import { AdminSignInModal } from './components/AdminSignInModal';
import { AuthRequiredModal } from './components/AuthRequiredModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { ShareModal } from './components/ShareModal';
import { SharedChatView } from './components/SharedChatView';
import { AVAILABLE_MODELS } from './constants/models';
import { ModelOption, Message, ChatSession, AppSettings, Attachment } from './types/chat';
import { generateResponse, generateChatTitle } from './services/aiSimulator';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { Server, ChevronDown, ChevronUp, Search, Copy, Check, Trash2, FileDown, X, Loader2, Info, AlertCircle, Scale, FileText, BookOpen, Building2 } from 'lucide-react';
import { exportChatToPDF, exportSelectedResponsesToPDF } from './services/pdfExport';
import { formatTimeHHMM } from './components/ChatMessageList';
import { countMatchesInMessages } from './lib/highlightText';
import {
  subscribeToUserSessions,
  saveSessionToFirestore,
  deleteSessionFromFirestore,
  clearAllSessionsFromFirestore,
  saveUserSettingsToFirestore,
  getUserSettingsFromFirestore,
  saveSystemAIConfigToFirestore,
  subscribeToSystemAIConfig,
  logAdminEvent,
} from './lib/firebase';
import { assertAdmin } from './utils/permissions';
import { SystemAIConfig } from './types/chat';

const LANDING_QUICK_STARTERS = [
  {
    id: 'draft-legal-brief',
    icon: FileText,
    label: 'Draft a legal brief',
    prompt: 'Draft a comprehensive legal brief analyzing contractual breach, liability, and remedies under the Algerian Civil Code.',
  },
  {
    id: 'algerian-civil-code',
    icon: Scale,
    label: 'Explain Algerian Civil Code',
    prompt: 'Explain the core principles of contractual obligations, civil liability (Articles 124+), and contract formation under the Algerian Civil Code.',
  },
  {
    id: 'property-law',
    icon: Building2,
    label: 'Research property law',
    prompt: 'Research property ownership rights, cadastral registration procedures (Le livret foncier), and real estate transfer regulations in Algeria.',
  },
  {
    id: 'commercial-law',
    icon: BookOpen,
    label: 'Commercial law & litigation',
    prompt: 'Outline commercial litigation procedures, corporate bylaws, and debt recovery mechanisms under Algerian Commercial Code.',
  },
];

const AUTO_SCROLL_THRESHOLD = 120;

/**
 * Natural cubic ease-out curve for ChatGPT-grade smooth scrolling.
 * Starts with steady smooth acceleration and decelerates naturally near the destination.
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  provider: 'OpenAI',
  selectedModel: 'openai/gpt-4o-mini',
  temperature: 0.7,
  systemPrompt:
    'You are a helpful, concise, and highly skilled software architect and problem solver. You provide clear explanations with production-grade code examples when appropriate.',
  streamingEnabled: true,
  soundEffects: false,
  theme: 'dark',
  autoScrollToBottom: true,
};

export default function App() {
  const { user, role, permissions } = useAuth();
  const { theme, toggleTheme, setTheme } = useTheme();

  // Custom LM-Kit / User-defined models stored in localStorage
  const [customModels, setCustomModels] = useState<ModelOption[]>(() => {
    try {
      const saved = localStorage.getItem('lmkit_custom_models');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const allModels = useMemo(() => {
    const customIds = new Set(customModels.map((m) => m.id));
    const base = AVAILABLE_MODELS.filter((m) => !customIds.has(m.id));
    return [...customModels, ...base];
  }, [customModels]);

  const [selectedModel, setSelectedModel] = useState<ModelOption>(() => {
    try {
      const savedSettings = localStorage.getItem('minimal_chat_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.selectedModel) {
          const customSaved = localStorage.getItem('lmkit_custom_models');
          const customList: ModelOption[] = customSaved ? JSON.parse(customSaved) : [];
          const combined = [...customList, ...AVAILABLE_MODELS];
          const matched = combined.find((m) => m.id === parsed.selectedModel);
          if (matched) return matched;
        }
      }
    } catch {
      // ignore
    }
    return AVAILABLE_MODELS[0];
  });

  const [quotedInsert, setQuotedInsert] = useState<{ text: string; id: number } | null>(null);

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('minimal_chat_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('minimal_chat_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const pendingSystemModelIdRef = useRef<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isAdminSignInOpen, setIsAdminSignInOpen] = useState(false);
  const [isAuthRequiredModalOpen, setIsAuthRequiredModalOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{ content: string; attachments?: Attachment[] } | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTargetMessage, setShareTargetMessage] = useState<Message | null>(null);
  const [sharedViewId, setSharedViewId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('share') || null;
    }
    return null;
  });
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [copiedSelected, setCopiedSelected] = useState(false);
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: 'info' | 'success' | 'error';
  } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastNotification({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToastNotification(null);
    }, 3200);
  };

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Floating jump-to-bottom and back-to-top indicators & progress
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  // Track whether automatic follow-to-bottom is currently active
  const isNearBottomRef = useRef<boolean>(true);
  const shouldAutoFollowRef = useRef<boolean>(true);
  const scrollRafIdRef = useRef<number | null>(null);
  const prevIsThinkingRef = useRef<boolean>(false);

  // Smooth scroll animation controller ref
  const smoothScrollAnimRef = useRef<{
    rafId: number | null;
    startTime: number;
    duration: number;
    startTop: number;
    targetTop: number;
  }>({
    rafId: null,
    startTime: 0,
    duration: 0,
    startTop: 0,
    targetTop: 0,
  });

  const stopSmoothScroll = useCallback(() => {
    if (smoothScrollAnimRef.current.rafId !== null) {
      cancelAnimationFrame(smoothScrollAnimRef.current.rafId);
      smoothScrollAnimRef.current.rafId = null;
    }
  }, []);

  /**
   * Smoothly animates the chatContainerRef to targetScrollTop with an elegant ease-out deceleration curve.
   * If an animation is already in progress, seamlessly retargets toward the growing height without stutter or jump.
   */
  const smoothScrollTo = useCallback(
    (targetScrollTop: number, customDuration?: number) => {
      const container = chatContainerRef.current;
      if (!container) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        stopSmoothScroll();
        container.scrollTop = targetScrollTop;
        setScrollProgress(100);
        return;
      }

      const startTop = container.scrollTop;
      const distance = Math.abs(targetScrollTop - startTop);

      if (distance < 2) {
        container.scrollTop = targetScrollTop;
        return;
      }

      // If animation is actively running, dynamically retarget to newest height without resetting progress
      if (smoothScrollAnimRef.current.rafId !== null) {
        smoothScrollAnimRef.current.targetTop = targetScrollTop;
        return;
      }

      // Controlled, natural duration based on travel distance (240ms - 460ms)
      const duration =
        customDuration ?? Math.min(460, Math.max(240, Math.round(Math.sqrt(distance) * 14)));

      const startTime = performance.now();
      smoothScrollAnimRef.current = {
        rafId: null,
        startTime,
        duration,
        startTop,
        targetTop: targetScrollTop,
      };

      const step = (currentTime: number) => {
        if (!chatContainerRef.current) return;
        const target = chatContainerRef.current;
        const currentMaxScroll = target.scrollHeight - target.clientHeight;
        const desiredTarget = Math.min(smoothScrollAnimRef.current.targetTop, currentMaxScroll);

        const elapsed = currentTime - smoothScrollAnimRef.current.startTime;
        const progress = Math.min(1, elapsed / smoothScrollAnimRef.current.duration);
        const eased = easeOutCubic(progress);

        target.scrollTop =
          smoothScrollAnimRef.current.startTop +
          (desiredTarget - smoothScrollAnimRef.current.startTop) * eased;

        if (progress < 1) {
          smoothScrollAnimRef.current.rafId = requestAnimationFrame(step);
        } else {
          target.scrollTop = desiredTarget;
          smoothScrollAnimRef.current.rafId = null;
        }
      };

      smoothScrollAnimRef.current.rafId = requestAnimationFrame(step);
    },
    [stopSmoothScroll]
  );

  /**
   * Re-activates automatic scrolling and smoothly glides to the true bottom of the conversation.
   */
  const scrollToBottom = useCallback(
    (customDuration?: number) => {
      shouldAutoFollowRef.current = true;
      isNearBottomRef.current = true;
      if (chatContainerRef.current) {
        const container = chatContainerRef.current;
        const targetTop = container.scrollHeight - container.clientHeight;
        smoothScrollTo(targetTop, customDuration);
        setShowScrollBottom(false);
      }
    },
    [smoothScrollTo]
  );

  // Interrupt active smooth animation immediately if user manually touches/scrolls
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleUserInterrupt = () => {
      stopSmoothScroll();
    };

    container.addEventListener('wheel', handleUserInterrupt, { passive: true });
    container.addEventListener('touchmove', handleUserInterrupt, { passive: true });
    container.addEventListener('pointerdown', handleUserInterrupt, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleUserInterrupt);
      container.removeEventListener('touchmove', handleUserInterrupt);
      container.removeEventListener('pointerdown', handleUserInterrupt);
      stopSmoothScroll();
    };
  }, [stopSmoothScroll]);

  // Reset in-chat search and maintain scroll on session switch
  useEffect(() => {
    setChatSearchQuery('');
    setIsSearchOpen(false);
    setCurrentMatchIndex(0);
    isNearBottomRef.current = true;
    shouldAutoFollowRef.current = true;
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        setScrollProgress(100);
      } else {
        setScrollProgress(0);
      }
    });
  }, [activeSessionId]);

  // Subscribe to real-time System AI Configuration (Admin managed model and parameters)
  useEffect(() => {
    const unsubscribe = subscribeToSystemAIConfig((remoteConfig) => {
      if (remoteConfig) {
        if (remoteConfig.selectedModel) {
          // Ignore an older snapshot that can arrive while our confirmed save is
          // still propagating. The next snapshot with the requested ID clears it.
          if (pendingSystemModelIdRef.current && remoteConfig.selectedModel !== pendingSystemModelIdRef.current) {
            return;
          }
          if (remoteConfig.selectedModel === pendingSystemModelIdRef.current) {
            pendingSystemModelIdRef.current = null;
          }
          const customSaved = localStorage.getItem('lmkit_custom_models');
          const customList: ModelOption[] = customSaved ? JSON.parse(customSaved) : [];
          const combined = [...customList, ...AVAILABLE_MODELS];
          const matched = combined.find((m) => m.id === remoteConfig.selectedModel);
          if (matched) {
            setSelectedModel(matched);
          }
        }
        setSettings((prev) => ({
          ...prev,
          selectedModel: remoteConfig.selectedModel || prev.selectedModel,
          provider: remoteConfig.provider || prev.provider,
          temperature: remoteConfig.temperature ?? prev.temperature,
          systemPrompt: remoteConfig.systemPrompt || prev.systemPrompt,
          streamingEnabled: remoteConfig.streamingEnabled ?? prev.streamingEnabled,
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync personal client settings with Firestore when user logs in
  useEffect(() => {
    if (!user) return;

    getUserSettingsFromFirestore(user.uid).then((remoteSettings) => {
      if (remoteSettings) {
        setSettings((prev) => ({ ...prev, ...remoteSettings }));

        // Keep the model object in sync with the persisted model id so the
        // selector opens with the value that was actually saved.
        if (remoteSettings.selectedModel) {
          const customSaved = localStorage.getItem('lmkit_custom_models');
          const customList: ModelOption[] = customSaved ? JSON.parse(customSaved) : [];
          const matched = [...customList, ...AVAILABLE_MODELS].find(
            (model) => model.id === remoteSettings.selectedModel
          );
          if (matched) {
            setSelectedModel(matched);
          }
        }

        if (remoteSettings.theme) {
          setTheme(remoteSettings.theme);
        }
      }
    });
  }, [user]);

  // Subscribe to real-time user sessions from Firestore when logged in
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserSessions(user.uid, (remoteSessions) => {
      if (remoteSessions && remoteSessions.length > 0) {
        setSessions(remoteSessions);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Save settings to localStorage and Firestore
  useEffect(() => {
    try {
      localStorage.setItem('minimal_chat_settings', JSON.stringify(settings));
    } catch (e) {
      // ignore
    }

    if (user) {
      saveUserSettingsToFirestore(user.uid, settings).catch((err) =>
        console.error('Failed to save settings to Firestore:', err)
      );
    }
  }, [settings, user]);

  // Save sessions to localStorage as cache
  useEffect(() => {
    try {
      localStorage.setItem('minimal_chat_sessions', JSON.stringify(sessions));
    } catch (e) {
      // ignore
    }
  }, [sessions]);

  // Active session and messages
  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const messages: Message[] = activeSession ? activeSession.messages : [];
  const totalMatches = countMatchesInMessages(messages, chatSearchQuery);

  // Keyboard shortcuts: Cmd+K for new chat, Cmd+F for in-chat search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        if (messages.length > 0) {
          e.preventDefault();
          setIsSearchOpen(true);
          setTimeout(() => chatSearchInputRef.current?.focus(), 50);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        if (permissions.canAccessSettings) {
          e.preventDefault();
          setIsSettingsOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messages.length]);

  // Robust ChatGPT-Style Auto-Scroll:
  // 1. On Send/Action: Viewport immediately smoothly moves toward the newest message.
  // 2. During streaming / thinking: Follows incoming tokens/content with throttled ease-out animation.
  // 3. Dynamic content (Markdown, code blocks, tables, images, math): ResizeObserver guarantees height changes smoothly follow bottom.
  // 4. On AI generation finish: Performs a graceful final ease-out smooth scroll to the exact bottom of the complete response.
  // 5. User scroll override: If user manually scrolls up past 120px (AUTO_SCROLL_THRESHOLD), pauses auto-follow until user sends again or scrolls down.
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    let resizeThrottleTimer: number | null = null;

    // ResizeObserver watches inner height expansions (markdown rendering, streaming tokens, code highlights, images)
    const resizeObserver = new ResizeObserver(() => {
      if (settings.autoScrollToBottom === false) return;
      if (!shouldAutoFollowRef.current) return;

      if (resizeThrottleTimer === null) {
        resizeThrottleTimer = window.requestAnimationFrame(() => {
          resizeThrottleTimer = null;
          if (!chatContainerRef.current || !shouldAutoFollowRef.current) return;
          const target = chatContainerRef.current;
          const targetTop = target.scrollHeight - target.clientHeight;
          smoothScrollTo(targetTop, isThinking ? 220 : 320);
        });
      }
    });

    if (container.firstElementChild) {
      resizeObserver.observe(container.firstElementChild);
    }

    return () => {
      if (resizeThrottleTimer !== null) {
        cancelAnimationFrame(resizeThrottleTimer);
      }
      resizeObserver.disconnect();
    };
  }, [isThinking, settings.autoScrollToBottom, activeSessionId, smoothScrollTo]);

  // Generation finish transition effect: performs final smooth ease-out scroll
  useEffect(() => {
    const wasThinking = prevIsThinkingRef.current;
    prevIsThinkingRef.current = isThinking;

    if (settings.autoScrollToBottom === false) return;

    // Detect exact moment generation finishes
    const generationJustFinished = wasThinking && !isThinking;

    if (generationJustFinished && shouldAutoFollowRef.current) {
      if (scrollRafIdRef.current) {
        cancelAnimationFrame(scrollRafIdRef.current);
        scrollRafIdRef.current = null;
      }

      // Wait for layout to settle (Markdown, syntax highlighting, DOM paint)
      scrollRafIdRef.current = requestAnimationFrame(() => {
        scrollRafIdRef.current = requestAnimationFrame(() => {
          if (!chatContainerRef.current || !shouldAutoFollowRef.current) return;
          scrollToBottom(360);
          setScrollProgress(100);
          setShowScrollBottom(false);
        });
      });
    }

    return () => {
      if (scrollRafIdRef.current) {
        cancelAnimationFrame(scrollRafIdRef.current);
      }
    };
  }, [isThinking, settings.autoScrollToBottom, messages, scrollToBottom]);

  const handleSelectModel = async (model: ModelOption) => {
    assertAdmin(role, 'Selecting AI model');

    // Capture the argument directly; React state may still contain the previous model.
    const modelSettings = {
      selectedModel: model.id,
      provider: model.provider,
    };
    pendingSystemModelIdRef.current = model.id;

    // Persist the exact confirmed model before the modal is allowed to close.
    await saveSystemAIConfigToFirestore(modelSettings, role);
    if (user) {
      await saveUserSettingsToFirestore(user.uid, modelSettings);
    }

    setSelectedModel(model);
    setSettings((prev) => ({ ...prev, ...modelSettings }));

    if (activeSessionId) {
      const updated = sessions.map((s) => (s.id === activeSessionId ? { ...s, model: model.name } : s));
      setSessions(updated);
      const target = updated.find((s) => s.id === activeSessionId);
      if (target && user) {
        saveSessionToFirestore(user.uid, target);
      }
    }
  };

  const handleAddCustomModel = (newModel: ModelOption) => {
    assertAdmin(role, 'Adding custom model');
    setCustomModels((prev) => {
      const updated = [newModel, ...prev.filter((m) => m.id !== newModel.id)];
      try {
        localStorage.setItem('lmkit_custom_models', JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
      return updated;
    });
  };

  const handleDeleteCustomModel = (modelId: string) => {
    assertAdmin(role, 'Deleting custom model');
    setCustomModels((prev) => {
      const updated = prev.filter((m) => m.id !== modelId);
      try {
        localStorage.setItem('lmkit_custom_models', JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
      return updated;
    });

    if (selectedModel.id === modelId) {
      setSelectedModel(AVAILABLE_MODELS[0]);
    }
  };

  const handleQuote = (rawText: string) => {
    const clean = rawText.trim();
    if (!clean) return;

    // Convert into markdown blockquote (prepend '>' to lines)
    const lines = clean.split('\n');
    const quoted = lines.map((l) => (l.length > 0 ? `> ${l}` : '>')).join('\n') + '\n\n';

    setQuotedInsert({ text: quoted, id: Date.now() });

    // Ensure bottom prompt edit box is in view
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 40);
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    assertAdmin(role, 'Updating system settings');
    setSettings((prev) => ({ ...prev, ...newSettings }));

    // Persist system AI configuration to Firestore
    const systemPayload: Partial<SystemAIConfig> = {};
    if (newSettings.selectedModel) systemPayload.selectedModel = newSettings.selectedModel;
    if (newSettings.provider) systemPayload.provider = newSettings.provider;
    if (newSettings.temperature !== undefined) systemPayload.temperature = newSettings.temperature;
    if (newSettings.systemPrompt !== undefined) systemPayload.systemPrompt = newSettings.systemPrompt;
    if (newSettings.streamingEnabled !== undefined) systemPayload.streamingEnabled = newSettings.streamingEnabled;
    if (newSettings.apiKey !== undefined) systemPayload.apiKey = newSettings.apiKey;

    if (Object.keys(systemPayload).length > 0) {
      saveSystemAIConfigToFirestore(systemPayload, role).catch((err) =>
        console.warn('Failed to update system config in Firestore:', err)
      );
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setIsSelectMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
    if (user) {
      deleteSessionFromFirestore(user.uid, id).catch((err) =>
        console.error('Failed to delete session from Firestore:', err)
      );
    }
  };

  const handleClearAllHistory = () => {
    const sessionIds = sessions.map((s) => s.id);
    setSessions([]);
    setActiveSessionId(null);
    if (user && sessionIds.length > 0) {
      clearAllSessionsFromFirestore(user.uid, sessionIds).catch((err) =>
        console.error('Failed to clear sessions from Firestore:', err)
      );
    }
  };

  const handleExportHistory = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sessions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ai-chat-export-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportSelected = async () => {
    if (selectedMessageIds.size === 0) {
      showToast('Please select at least one response to export.', 'info');
      return;
    }
    if (isExportingPDF) return;

    const selectedMsgs = messages.filter((m) => selectedMessageIds.has(m.id));
    if (selectedMsgs.length === 0) {
      showToast('Please select at least one response to export.', 'info');
      return;
    }

    setIsExportingPDF(true);
    showToast(
      selectedMsgs.length === 1
        ? 'Generating PDF for selected response...'
        : `Generating PDF for ${selectedMsgs.length} selected responses...`,
      'info'
    );

    try {
      const success = await exportSelectedResponsesToPDF(
        selectedMsgs,
        activeSession,
        selectedModel.name,
        messages
      );
      if (success) {
        showToast('PDF exported successfully!', 'success');
      } else {
        showToast('Failed to generate PDF. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Export selected to PDF error:', err);
      showToast('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportPDF = async () => {
    // When one or more responses are selected, export ONLY those selected response cards!
    if (selectedMessageIds.size > 0) {
      await handleExportSelected();
      return;
    }

    // If user is in select mode but has not selected any response yet:
    if (isSelectMode && selectedMessageIds.size === 0) {
      showToast('Please select at least one response to export.', 'info');
      return;
    }

    if (!messages || messages.length === 0) {
      showToast('No messages available to export.', 'info');
      return;
    }

    if (isExportingPDF) return;

    setIsExportingPDF(true);
    showToast('Generating conversation PDF...', 'info');
    try {
      const success = await exportChatToPDF(activeSession, messages, selectedModel.name);
      if (success) {
        showToast('PDF exported successfully!', 'success');
      } else {
        showToast('Failed to generate PDF. Please try again.', 'error');
      }
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Failed to export PDF. Please try again.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleClearCurrentChat = () => {
    if (!activeSessionId) return;
    const updated = sessions.map((s) => (s.id === activeSessionId ? { ...s, messages: [] } : s));
    setSessions(updated);
    const target = updated.find((s) => s.id === activeSessionId);
    if (target && user) {
      saveSessionToFirestore(user.uid, target).catch((err) =>
        console.warn('Failed to clear current chat in Firestore:', err)
      );
    }
  };

  const handleToggleLike = (messageId: string, liked: boolean) => {
    if (!activeSessionId) return;
    const updated = sessions.map((s) => {
      if (s.id !== activeSessionId) return s;
      return {
        ...s,
        messages: s.messages.map((m) => {
          if (m.id !== messageId) return m;
          return { ...m, liked: m.liked === liked ? null : liked };
        }),
      };
    });
    setSessions(updated);
    const target = updated.find((s) => s.id === activeSessionId);
    if (target && user) {
      saveSessionToFirestore(user.uid, target);
    }
  };

  // Automatically resume and send pending message once user authenticates (via login or account creation)
  useEffect(() => {
    if (user && pendingMessage) {
      const { content, attachments } = pendingMessage;
      setPendingMessage(null);
      setIsAuthRequiredModalOpen(false);
      // Dispatch clear event so ChatInput empties the composer after successful send
      window.dispatchEvent(new CustomEvent('chat-input-clear'));
      handleSendMessage(content, attachments);
    }
  }, [user, pendingMessage]);

  const handleSendMessage = async (content: string, attachments?: Attachment[]) => {
    // Main requirement: Block unauthenticated users from sending to AI and show auth dialog
    if (!user) {
      setPendingMessage({ content, attachments });
      setIsAuthRequiredModalOpen(true);
      return;
    }

    const userMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };

    let targetSessionId = activeSessionId;
    let currentSession: ChatSession;
    let isNewSession = false;

    if (!targetSessionId) {
      isNewSession = true;
      // Temporary title based on first words while AI creates concise 3-5 word title
      const initialWords = content.trim().split(/\s+/).slice(0, 4).join(' ');
      const title = initialWords ? `${initialWords}...` : 'New conversation';
      currentSession = {
        id: `sess-${Date.now()}`,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: selectedModel.name,
        messages: [userMsg],
      };
      targetSessionId = currentSession.id;
      setSessions((prev) => [currentSession, ...prev]);
      setActiveSessionId(currentSession.id);

      if (user) {
        saveSessionToFirestore(user.uid, currentSession);
      }
    } else {
      // Append to active session
      const existing = sessions.find((s) => s.id === targetSessionId)!;
      // If this session has no prior user messages or still has the placeholder title, generate title
      const prevUserMsgs = existing?.messages.filter((m) => m.role === 'user') || [];
      if (prevUserMsgs.length === 0 || existing?.title === 'New conversation') {
        isNewSession = true;
      }
      currentSession = {
        ...existing,
        updatedAt: Date.now(),
        messages: [...existing.messages, userMsg],
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === targetSessionId ? currentSession : s))
      );

      if (user) {
        saveSessionToFirestore(user.uid, currentSession);
      }
    }

    // Automatically generate a concise 3-5 word title for new chat sessions using the AI
    // based on the first user message, and update the session list immediately.
    if (isNewSession) {
      const capturedSessionId = targetSessionId;
      generateChatTitle(content, selectedModel, settings.apiKey)
        .then((aiTitle) => {
          if (aiTitle) {
            setSessions((prev) => {
              const updated = prev.map((s) =>
                s.id === capturedSessionId ? { ...s, title: aiTitle } : s
              );
              const target = updated.find((s) => s.id === capturedSessionId);
              if (target && user) {
                saveSessionToFirestore(user.uid, target).catch((err) =>
                  console.warn('Failed to update title in Firestore:', err)
                );
              }
              return updated;
            });
          }
        })
        .catch((err) => {
          console.warn('Auto-title generation error:', err);
        });
    }

    // Immediately follow the new user message to the bottom even if previously scrolled to the top
    shouldAutoFollowRef.current = true;
    isNearBottomRef.current = true;
    requestAnimationFrame(() => {
      scrollToBottom();
    });

    // Trigger AI response
    setIsThinking(true);

    try {
      const responseText = await generateResponse(
        content,
        selectedModel,
        settings.systemPrompt,
        settings.apiKey,
        attachments
      );

      const assistantMsg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        model: selectedModel.name,
        status: 'complete',
      };

      setSessions((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== targetSessionId) return s;
          // Mark the user message as sent and append the completed assistant message
          const updatedMessages = s.messages.map((m) =>
            m.id === userMsg.id ? { ...m, status: 'sent' as const } : m
          );
          return {
            ...s,
            updatedAt: Date.now(),
            messages: [...updatedMessages, assistantMsg],
          };
        });
        const target = updated.find((s) => s.id === targetSessionId);
        if (target && user) {
          saveSessionToFirestore(user.uid, target);
        }
        return updated;
      });
    } catch (err: any) {
      const errorDetail =
        err instanceof Error ? err.message : 'An error occurred while generating the response.';
      const errorMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: errorDetail,
        errorMessage: errorDetail,
        timestamp: Date.now(),
        status: 'error',
        model: selectedModel.name,
      };
      setSessions((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== targetSessionId) return s;
          const updatedMessages = s.messages.map((m) =>
            m.id === userMsg.id
              ? { ...m, status: 'failed' as const, errorMessage: errorDetail }
              : m
          );
          return { ...s, messages: [...updatedMessages, errorMsg] };
        });
        const target = updated.find((s) => s.id === targetSessionId);
        if (target && user) {
          saveSessionToFirestore(user.uid, target);
        }
        return updated;
      });
    } finally {
      setIsThinking(false);
    }
  };

  /**
   * Retry generating a response for a specific message (failed AI response or failed user send)
   */
  const handleRetryMessage = async (messageId: string) => {
    if (!activeSession) return;

    const targetIndex = activeSession.messages.findIndex((m) => m.id === messageId);
    if (targetIndex === -1) return;

    const targetMsg = activeSession.messages[targetIndex];

    // If target message is an assistant message (e.g. error card), find the preceding user message prompt
    let userPromptMsg: Message | undefined;
    if (targetMsg.role === 'assistant') {
      for (let i = targetIndex - 1; i >= 0; i--) {
        if (activeSession.messages[i].role === 'user') {
          userPromptMsg = activeSession.messages[i];
          break;
        }
      }
    } else {
      userPromptMsg = targetMsg;
    }

    if (!userPromptMsg) return;

    // Immediately follow to the bottom
    shouldAutoFollowRef.current = true;
    isNearBottomRef.current = true;
    requestAnimationFrame(() => {
      scrollToBottom();
    });

    setIsThinking(true);

    // Set user message to 'sending' status while retrying
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === userPromptMsg!.id ? { ...m, status: 'sending' as const } : m
              ),
            }
          : s
      )
    );

    // Remove the failed assistant message if retrying from an error card
    let baseMessages = activeSession.messages;
    if (targetMsg.role === 'assistant' && (targetMsg.status === 'error' || targetMsg.status === 'failed')) {
      baseMessages = activeSession.messages.filter((m) => m.id !== messageId);
    }

    try {
      const responseText = await generateResponse(
        userPromptMsg.content,
        selectedModel,
        settings.systemPrompt,
        settings.apiKey,
        userPromptMsg.attachments
      );

      const assistantMsg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        model: selectedModel.name,
        status: 'complete',
      };

      const updatedSession: ChatSession = {
        ...activeSession,
        updatedAt: Date.now(),
        messages: [
          ...baseMessages.map((m) =>
            m.id === userPromptMsg!.id ? { ...m, status: 'sent' as const } : m
          ),
          assistantMsg,
        ],
      };

      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? updatedSession : s))
      );

      if (user) {
        saveSessionToFirestore(user.uid, updatedSession);
      }
    } catch (err: any) {
      const errorDetail =
        err instanceof Error ? err.message : 'An error occurred while generating the response.';
      const newErrorMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: errorDetail,
        errorMessage: errorDetail,
        timestamp: Date.now(),
        status: 'error',
        model: selectedModel.name,
      };

      const updatedSession: ChatSession = {
        ...activeSession,
        updatedAt: Date.now(),
        messages: [
          ...baseMessages.map((m) =>
            m.id === userPromptMsg!.id
              ? { ...m, status: 'failed' as const, errorMessage: errorDetail }
              : m
          ),
          newErrorMsg,
        ],
      };

      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? updatedSession : s))
      );
    } finally {
      setIsThinking(false);
    }
  };

  const handleRegenerate = async () => {
    if (!activeSession || activeSession.messages.length === 0) return;

    // Find last user message
    const lastUserMsg = [...activeSession.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    // Immediately follow to the bottom
    shouldAutoFollowRef.current = true;
    isNearBottomRef.current = true;
    requestAnimationFrame(() => {
      scrollToBottom();
    });

    setIsThinking(true);
    try {
      const responseText = await generateResponse(
        lastUserMsg.content,
        selectedModel,
        settings.systemPrompt,
        settings.apiKey,
        lastUserMsg.attachments
      );

      const assistantMsg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        model: selectedModel.name,
        status: 'complete',
      };

      const updatedSession: ChatSession = {
        ...activeSession,
        updatedAt: Date.now(),
        messages: [...activeSession.messages, assistantMsg],
      };

      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? updatedSession : s))
      );

      if (user) {
        saveSessionToFirestore(user.uid, updatedSession);
      }
    } finally {
      setIsThinking(false);
    }
  };

  const handleToggleSelectMode = () => {
    setIsSelectMode((prev) => {
      if (prev) {
        setSelectedMessageIds(new Set());
      }
      return !prev;
    });
  };

  const handleToggleSelectMessage = (messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleStartSelectWithMessage = (messageId: string) => {
    setIsSelectMode(true);
    setSelectedMessageIds(new Set([messageId]));
  };

  const handleToggleSelectAll = () => {
    if (selectedMessageIds.size === messages.length && messages.length > 0) {
      setSelectedMessageIds(new Set());
    } else {
      setSelectedMessageIds(new Set(messages.map((m) => m.id)));
    }
  };

  const handleCopySelected = async () => {
    const selectedMsgs = messages.filter((m) => selectedMessageIds.has(m.id));
    if (selectedMsgs.length === 0) return;
    const formatted = selectedMsgs
      .map((m) => {
        const sender = m.role === 'user' ? 'User' : `Assistant (${m.model || selectedModel.name})`;
        const time = formatTimeHHMM(m.timestamp);
        return `[${sender}${time ? ` • ${time}` : ''}]:\n${m.content}`;
      })
      .join('\n\n---\n\n');
    await navigator.clipboard.writeText(formatted);
    setCopiedSelected(true);
    setTimeout(() => setCopiedSelected(false), 2000);
  };

  const handleDeleteSelected = () => {
    if (!activeSession || selectedMessageIds.size === 0) return;
    const remaining = messages.filter((m) => !selectedMessageIds.has(m.id));
    const updatedSession: ChatSession = {
      ...activeSession,
      messages: remaining,
      updatedAt: Date.now(),
    };
    setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? updatedSession : s)));
    if (user) {
      saveSessionToFirestore(user.uid, updatedSession);
    }
    setSelectedMessageIds(new Set());
    if (remaining.length === 0) {
      setIsSelectMode(false);
    }
  };

  const handleLoadSampleChat = (topic: string) => {
    if (topic === 'architecture') {
      const sampleSession: ChatSession = {
        id: `sample-arch-${Date.now()}`,
        title: 'Distributed Cache Invalidations',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: selectedModel.name,
        messages: [
          {
            id: 'sample-1',
            role: 'user',
            content: 'What is the most reliable pattern for cache invalidation across distributed microservices?',
            timestamp: Date.now() - 60000,
          },
          {
            id: 'sample-2',
            role: 'assistant',
            content: `### Distributed Cache Invalidation: Event-Driven CDC Pattern

The two hard problems in computer science are cache invalidation and naming things. In a modern distributed architecture, the most dependable pattern is **Change Data Capture (CDC) with transactional outboxes**:

1. **Transactional Outbox Pattern**:
   - Write your database update and an outbox event in the **same atomic database transaction**.
   - A CDC pipeline (e.g. Debezium, DynamoDB Streams) reads the commit log and emits invalidation events to a Kafka or Redis Pub/Sub topic.

2. **Cache Eviction vs Cache Mutation**:
   - **Always Evict (Delete)**, never rewrite the new value directly into cache on invalidation.
   - Eviction is naturally idempotent. Concurrent out-of-order writes cannot overwrite newer values with stale state.

\`\`\`typescript
// Idempotent Redis Cache Invalidation
export async function invalidateUserCache(userId: string): Promise<void> {
  const cacheKey = \`user:session:\${userId}\`;
  // Atomic unlink does not block the redis event loop
  await redis.unlink(cacheKey);
}
\`\`\`

3. **TTL Jitter**:
   - Always append pseudo-random jitter (\`TTL = 3600 + Math.random() * 300\`) to eliminate catastrophic cache stampedes when hot keys expire simultaneously.`,
            timestamp: Date.now() - 30000,
            model: selectedModel.name,
          },
        ],
      };
      setSessions((prev) => [sampleSession, ...prev]);
      setActiveSessionId(sampleSession.id);
      setIsSidebarOpen(false);
      if (user) {
        saveSessionToFirestore(user.uid, sampleSession);
      }
    } else {
      const sampleSession: ChatSession = {
        id: `sample-debug-${Date.now()}`,
        title: 'Node.js Memory Leak Diagnostic',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: selectedModel.name,
        messages: [
          {
            id: 'sample-3',
            role: 'user',
            content: 'Help troubleshoot a runaway heap memory leak in our Express Node.js service.',
            timestamp: Date.now() - 60000,
          },
          {
            id: 'sample-4',
            role: 'assistant',
            content: `### Node.js Heap Profiling & Leak Diagnostic Protocol

Here is the deterministic 3-step triage to identify and eliminate the leak:

1. **Capture Heap Snapshots under Load**:
   - Run \`node --inspect server.js\`
   - Open Chrome DevTools at \`chrome://inspect\`
   - Take **Snapshot 1** at baseline idle.
   - Run a load test of 5,000 requests.
   - Take **Snapshot 2** and use the **Comparison View** in DevTools.

2. **Common Culprits**:
   - **Global Event Listeners**: \`emitter.on('data')\` inside request handlers without \`emitter.off()\` in \`res.on('finish')\`.
   - **Unbounded In-Memory Caches**: JavaScript \`Map\` or \`Set\` growing indefinitely without an LRU eviction cap.
   - **Closures Retaining Parent Scope**: Storing callbacks that hold references to large request bodies.`,
            timestamp: Date.now() - 30000,
            model: selectedModel.name,
          },
        ],
      };
      setSessions((prev) => [sampleSession, ...prev]);
      setActiveSessionId(sampleSession.id);
      setIsSidebarOpen(false);
      if (user) {
        saveSessionToFirestore(user.uid, sampleSession);
      }
    }
  };

  const handleShareMessage = (message: Message) => {
    setShareTargetMessage(message);
    setIsShareModalOpen(true);
  };

  // Listen for browser navigation / query param changes for share URLs
  useEffect(() => {
    const handleUrlCheck = () => {
      const params = new URLSearchParams(window.location.search);
      const share = params.get('share');
      setSharedViewId(share || null);
    };
    window.addEventListener('popstate', handleUrlCheck);
    return () => window.removeEventListener('popstate', handleUrlCheck);
  }, []);

  const isDark = theme === 'dark';
  const hasMessages = messages.length > 0;

  // Render Public Read-Only Shared Chat view when ?share=ID is in URL
  if (sharedViewId) {
    return (
      <SharedChatView
        shareId={sharedViewId}
        theme={theme}
        onExitSharedView={() => {
          setSharedViewId(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('share');
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
        }}
        onForkConversation={(shared) => {
          const newSessionId = `session_${Date.now()}`;
          const forkedSession: ChatSession = {
            id: newSessionId,
            title: `Fork: ${shared.title}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            model: shared.model || selectedModel.name,
            messages: (shared.messages || []).map((m) => ({
              ...m,
              id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            })),
          };

          setSessions((prev) => [forkedSession, ...prev]);
          setActiveSessionId(newSessionId);
          setSharedViewId(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('share');
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));

          if (user) {
            saveSessionToFirestore(user.uid, forkedSession).catch(console.error);
          }

          showToast('Shared conversation cloned into your active chat!', 'success');
        }}
      />
    );
  }

  return (
    <div
      className={`h-screen h-dvh w-full flex flex-col antialiased selection:bg-neutral-700 selection:text-white relative overflow-hidden transition-colors duration-200 ${
        isDark ? 'bg-[#121214] text-[#ffffff]' : 'bg-[#F8F9F7] text-[#09090b]'
      }`}
    >
      {/* Top Bar with real Theme Toggle & Firebase Auth & Floating Header */}
      <TopBar
        currentModel={selectedModel}
        onOpenModelSelector={() => setIsModelSelectorOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAdminDashboard={() => {
          assertAdmin(role, 'Opening Admin Dashboard');
          setIsAdminDashboardOpen(true);
        }}
        onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
        onOpenAdminSignIn={() => setIsAdminSignInOpen(true)}
        isSidebarOpen={isSidebarOpen}
        theme={theme}
        onToggleTheme={toggleTheme}
        hasActiveMessages={hasMessages}
        onNewChat={handleNewChat}
        onShareChat={() => setIsShareModalOpen(true)}
        onExportPDF={handleExportPDF}
        onExportJSON={handleExportHistory}
        onClearChat={handleClearCurrentChat}
        isSelectMode={isSelectMode}
        onToggleSelectMode={handleToggleSelectMode}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => {
          setIsSearchOpen((prev) => {
            const next = !prev;
            if (next) {
              setTimeout(() => chatSearchInputRef.current?.focus(), 50);
            } else {
              setChatSearchQuery('');
            }
            return next;
          });
        }}
      />

      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Collapsible Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => {
            setActiveSessionId(id);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          onClearAllHistory={handleClearAllHistory}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAdminDashboard={() => {
            assertAdmin(role, 'Opening Admin Dashboard');
            setIsAdminDashboardOpen(true);
          }}
          onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
          onLoadSampleChat={handleLoadSampleChat}
          theme={theme}
          searchQuery={sidebarSearchQuery}
          onSearchChange={setSidebarSearchQuery}
        />

        {/* Main View Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {!hasMessages ? (
            /* =========================================================
               EMPTY / LANDING STATE (FAITHFUL TO SCREENSHOT)
               ========================================================= */
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-4xl mx-auto w-full select-none">
              {/* Vertical center cluster */}
              <div className="flex flex-col items-center text-center space-y-3 mb-6 w-full">
                {/* Robot Mascot matching the screenshot */}
                <div className="mb-1">
                  <RobotMascot size={76} />
                </div>

                {/* H1 Prominent Heading */}
                <h1
                  className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                    isDark ? 'text-white' : 'text-[#09090b]'
                  }`}
                >
                  How can I help you?
                </h1>

                {/* Row of Quick Action Starters below H1 */}
                <div className="w-full max-w-2xl pt-1 px-1">
                  <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-2.5">
                    {LANDING_QUICK_STARTERS.map((starter) => {
                      const IconComponent = starter.icon;
                      return (
                        <button
                          key={starter.id}
                          type="button"
                          onClick={() => handleSendMessage(starter.prompt, [])}
                          className={`group flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium border transition-all duration-150 cursor-pointer shadow-xs active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                            isDark
                              ? 'bg-[#18181c]/90 hover:bg-[#222228] border-[#2e2e36] hover:border-purple-500/50 text-neutral-200 hover:text-white hover:shadow-purple-950/20'
                              : 'bg-white hover:bg-neutral-50 border-neutral-200 hover:border-purple-400 text-neutral-800 hover:text-purple-900 hover:shadow-purple-100'
                          }`}
                          title={`Click to ask: "${starter.prompt}"`}
                          aria-label={starter.label}
                        >
                          <span
                            className={`p-1 rounded-lg transition-colors ${
                              isDark
                                ? 'bg-[#25252c] group-hover:bg-purple-950/60 text-purple-400'
                                : 'bg-purple-50 group-hover:bg-purple-100 text-purple-600'
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                          </span>
                          <span className="font-semibold text-xs">{starter.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Centered Input & Action Pills */}
              <div className="w-full max-w-2xl px-2">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={isThinking}
                  isTyping={isThinking}
                  placeholder="Ask anything..."
                  isCenteringLayout={true}
                  theme={theme}
                  quotedText={quotedInsert}
                />
              </div>
            </div>
          ) : (
            /* =========================================================
               ACTIVE CHAT STATE
               ========================================================= */
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
              {/* Subtle Scroll Progress Bar at very top of chat area */}
              <div
                className="absolute top-0 inset-x-0 h-[2.5px] z-30 pointer-events-none overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(scrollProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Conversation scroll progress"
              >
                {/* Subtle hairline track */}
                <div
                  className={`w-full h-full ${
                    isDark ? 'bg-white/5' : 'bg-black/5'
                  }`}
                />
                {/* Dynamic progress fill */}
                <div
                  className={`absolute top-0 left-0 h-full transition-[width] duration-150 ease-out ${
                    isDark
                      ? 'bg-gradient-to-r from-purple-500 via-purple-400 to-indigo-400 shadow-[0_0_8px_rgba(168,85,247,0.7)]'
                      : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 shadow-[0_0_6px_rgba(147,51,234,0.4)]'
                  }`}
                  style={{ width: `${scrollProgress}%` }}
                />
              </div>

              {/* In-Chat Search Bar */}
              {isSearchOpen && (
                <div
                  className={`shrink-0 px-3 sm:px-4 py-2 border-b flex items-center justify-between gap-2 sm:gap-3 z-30 backdrop-blur-md transition-all animate-in slide-in-from-top-2 duration-150 ${
                    isDark
                      ? 'bg-[#18181c]/95 border-[#27272c] text-white shadow-md'
                      : 'bg-white/95 border-neutral-200 text-neutral-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 max-w-xl">
                    <Search
                      className={`w-4 h-4 shrink-0 ${
                        isDark ? 'text-purple-400' : 'text-purple-600'
                      }`}
                    />
                    <input
                      ref={chatSearchInputRef}
                      type="text"
                      value={chatSearchQuery}
                      onChange={(e) => {
                        setChatSearchQuery(e.target.value);
                        setCurrentMatchIndex(0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (totalMatches > 0) {
                            if (e.shiftKey) {
                              setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
                            } else {
                              setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
                            }
                          }
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setIsSearchOpen(false);
                          setChatSearchQuery('');
                        }
                      }}
                      placeholder="Search in conversation (Enter: next, Shift+Enter: prev)..."
                      className="w-full bg-transparent text-xs sm:text-sm focus:outline-none placeholder-neutral-400"
                    />
                    {chatSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setChatSearchQuery('');
                          setCurrentMatchIndex(0);
                          chatSearchInputRef.current?.focus();
                        }}
                        className={`p-1 rounded cursor-pointer transition-colors ${
                          isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-black'
                        }`}
                        title="Clear search text"
                        aria-label="Clear search text"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* Match count badge */}
                    {chatSearchQuery.trim() && (
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                          totalMatches > 0
                            ? isDark
                              ? 'bg-purple-950/50 text-purple-300 border-purple-500/30'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                            : isDark
                            ? 'bg-rose-950/30 text-rose-300 border-rose-500/30'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {totalMatches > 0 ? `${currentMatchIndex + 1} of ${totalMatches}` : '0 matches'}
                      </span>
                    )}

                    {/* Up / Down navigation buttons */}
                    <div
                      className={`flex items-center border rounded-lg overflow-hidden ${
                        isDark ? 'border-[#303038] bg-[#1f1f25]' : 'border-neutral-200 bg-neutral-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (totalMatches > 0) {
                            setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
                          }
                        }}
                        disabled={totalMatches === 0}
                        className={`p-1.5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                          isDark
                            ? 'hover:bg-neutral-700 text-neutral-300 hover:text-white'
                            : 'hover:bg-neutral-200 text-neutral-600 hover:text-black'
                        }`}
                        title="Previous match (Shift+Enter)"
                        aria-label="Previous match"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <div className={`w-[1px] h-4 ${isDark ? 'bg-[#303038]' : 'bg-neutral-200'}`} />
                      <button
                        type="button"
                        onClick={() => {
                          if (totalMatches > 0) {
                            setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
                          }
                        }}
                        disabled={totalMatches === 0}
                        className={`p-1.5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                          isDark
                            ? 'hover:bg-neutral-700 text-neutral-300 hover:text-white'
                            : 'hover:bg-neutral-200 text-neutral-600 hover:text-black'
                        }`}
                        title="Next match (Enter)"
                        aria-label="Next match"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Close search button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        setChatSearchQuery('');
                      }}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isDark
                          ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                          : 'text-neutral-500 hover:text-black hover:bg-neutral-100'
                      }`}
                      title="Close search (Esc)"
                      aria-label="Close search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Message scroll area */}
              <div
                ref={chatContainerRef}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const scrollTop = target.scrollTop;
                  const maxScroll = target.scrollHeight - target.clientHeight;
                  if (maxScroll > 0) {
                    const progress = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
                    setScrollProgress(progress);
                  } else {
                    setScrollProgress(100);
                  }

                  // Precise distance from the bottom of the actual chat scroll container
                  const distanceFromBottom =
                    target.scrollHeight - target.scrollTop - target.clientHeight;
                  const isNearBottom = distanceFromBottom <= AUTO_SCROLL_THRESHOLD;

                  isNearBottomRef.current = isNearBottom;
                  setShowScrollBottom(distanceFromBottom > 180);
                  setShowScrollTop(scrollTop > 200);

                  // Manual user scroll detection: if user scrolls upward > 120px, turn off auto-follow
                  if (!isNearBottom) {
                    shouldAutoFollowRef.current = false;
                  } else {
                    shouldAutoFollowRef.current = true;
                  }
                }}
                className="flex-1 overflow-y-auto pb-44"
              >
                <ChatMessageList
                  messages={messages}
                  isThinking={isThinking}
                  onRegenerate={handleRegenerate}
                  onRetryMessage={handleRetryMessage}
                  onToggleLike={handleToggleLike}
                  onQuote={handleQuote}
                  theme={theme}
                  searchQuery={chatSearchQuery}
                  currentMatchIndex={currentMatchIndex}
                  onMatchIndexChange={setCurrentMatchIndex}
                  onClearSearch={() => {
                    setChatSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  isSelectMode={isSelectMode}
                  selectedMessageIds={selectedMessageIds}
                  onToggleSelectMessage={handleToggleSelectMessage}
                  onStartSelectWithMessage={handleStartSelectWithMessage}
                  enableTTS={settings.enableTTS !== false}
                  onShareMessage={handleShareMessage}
                />
                {/* Bottom sentinel anchor for layout measurements & precise following */}
                <div ref={messagesEndRef} className="h-[1px] w-full shrink-0 pointer-events-none" />
              </div>

              {/* Floating Back to top button (appears when scrolled past first message) */}
              {showScrollTop && (
                <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
                  <button
                    type="button"
                    onClick={() => {
                      if (chatContainerRef.current) {
                        chatContainerRef.current.scrollTo({
                          top: 0,
                          behavior: 'smooth',
                        });
                      }
                    }}
                    className={`px-3.5 py-1.5 rounded-full border shadow-lg flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 group backdrop-blur-md ${
                      isDark
                        ? 'bg-[#18181c]/90 hover:bg-[#24242c] border-[#383844] text-neutral-200 hover:text-white shadow-black/60 hover:border-purple-400/80'
                        : 'bg-white/95 hover:bg-neutral-50 border-neutral-300 text-neutral-700 hover:text-purple-700 shadow-neutral-300/80 hover:border-purple-400'
                    }`}
                    title="Back to top (Return to start of conversation)"
                    aria-label="Back to top of conversation"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-purple-400 transition-transform duration-150 group-hover:-translate-y-0.5" />
                    <span>Back to top</span>
                  </button>
                </div>
              )}

              {/* Jump to latest message button (floating bottom center, icon-only) */}
              {showScrollBottom && (
                <div className="absolute bottom-[114px] sm:bottom-[120px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => scrollToBottom()}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 group animate-in fade-in zoom-in-95 ${
                      isDark
                        ? 'bg-[#1e1e24] hover:bg-[#282832] border-[#383844] text-neutral-200 hover:text-white shadow-black/50 hover:border-neutral-500'
                        : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-700 hover:text-black shadow-neutral-300/80 hover:border-neutral-400'
                    }`}
                    title="Jump to latest message"
                    aria-label="Jump to latest message"
                  >
                    <ChevronDown className="w-5 h-5 transition-transform duration-150 group-hover:translate-y-0.5" />
                  </button>
                </div>
              )}

              {/* Docked bottom input container / Select Mode Action Bar */}
              <div
                className={`absolute bottom-0 inset-x-0 pt-8 pb-5 px-4 z-20 ${
                  isDark
                    ? 'bg-gradient-to-t from-[#121214] via-[#121214]/95 to-transparent'
                    : 'bg-gradient-to-t from-[#F8F9F7] via-[#F8F9F7]/95 to-transparent'
                }`}
              >
                <div className="max-w-2xl mx-auto w-full">
                  {isSelectMode ? (
                    <div
                      className={`p-2.5 sm:p-3 rounded-2xl border shadow-xl flex items-center justify-between gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
                        isDark
                          ? 'bg-[#18181c]/95 border-[#2e2e36] text-white shadow-black/50 backdrop-blur-md'
                          : 'bg-white/95 border-neutral-300 text-neutral-900 shadow-neutral-200 backdrop-blur-md'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                            selectedMessageIds.size === messages.length && messages.length > 0
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : isDark
                              ? 'bg-[#222227] border-[#34343d] text-neutral-300 hover:text-white hover:bg-[#2a2a32]'
                              : 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:text-black hover:bg-neutral-200'
                          }`}
                        >
                          {selectedMessageIds.size === messages.length && messages.length > 0
                            ? 'Deselect all'
                            : 'Select all'}
                        </button>
                        <span className="text-xs font-mono text-neutral-400 select-none">
                          <strong
                            className={`font-semibold ${
                              selectedMessageIds.size > 0
                                ? isDark
                                  ? 'text-purple-300'
                                  : 'text-purple-600'
                                : ''
                            }`}
                          >
                            {selectedMessageIds.size}
                          </strong>{' '}
                          selected
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Copy Selected */}
                        <button
                          type="button"
                          onClick={handleCopySelected}
                          disabled={selectedMessageIds.size === 0}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            selectedMessageIds.size === 0
                              ? 'opacity-40 cursor-not-allowed text-neutral-400 border border-transparent'
                              : isDark
                              ? 'bg-[#222227] hover:bg-[#2c2c34] text-neutral-200 hover:text-white border border-[#34343d]'
                              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 hover:text-black border border-neutral-300'
                          }`}
                          title="Copy selected messages to clipboard"
                        >
                          {copiedSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-neutral-400" />
                              <span className="hidden sm:inline">Copy Selected</span>
                              <span className="sm:hidden">Copy</span>
                            </>
                          )}
                        </button>

                        {/* Export Selected */}
                        <button
                          type="button"
                          onClick={handleExportSelected}
                          disabled={selectedMessageIds.size === 0 || isExportingPDF}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            selectedMessageIds.size === 0 || isExportingPDF
                              ? 'opacity-40 cursor-not-allowed text-neutral-400 border border-transparent'
                              : isDark
                              ? 'bg-[#222227] hover:bg-[#2c2c34] text-neutral-200 hover:text-white border border-[#34343d]'
                              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 hover:text-black border border-neutral-300'
                          }`}
                          title="Export selected AI response(s) to PDF"
                        >
                          {isExportingPDF ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                              <span className="hidden sm:inline">Exporting...</span>
                              <span className="sm:hidden">...</span>
                            </>
                          ) : (
                            <>
                              <FileDown className="w-3.5 h-3.5 text-rose-400" />
                              <span className="hidden sm:inline">Export to PDF</span>
                              <span className="sm:hidden">PDF</span>
                            </>
                          )}
                        </button>

                        {/* Delete Selected */}
                        <button
                          type="button"
                          onClick={() => setShowDeleteSelectedConfirm(true)}
                          disabled={selectedMessageIds.size === 0}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            selectedMessageIds.size === 0
                              ? 'opacity-40 cursor-not-allowed text-neutral-400'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                          title="Delete selected messages"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span className="hidden sm:inline">Delete Selected</span>
                          <span className="sm:hidden">Delete</span>
                        </button>

                        {/* Exit Select Mode */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsSelectMode(false);
                            setSelectedMessageIds(new Set());
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ml-0.5 ${
                            isDark
                              ? 'hover:bg-[#27272c] text-neutral-400 hover:text-white'
                              : 'hover:bg-neutral-200 text-neutral-600 hover:text-black'
                          }`}
                          title="Exit Select Mode"
                          aria-label="Exit Select Mode"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <ChatInput
                        onSendMessage={handleSendMessage}
                        disabled={isThinking}
                        isTyping={isThinking}
                        placeholder="Ask anything..."
                        isCenteringLayout={false}
                        theme={theme}
                        quotedText={quotedInsert}
                      />
                      <div className="text-center mt-2">
                        <span className="text-[11px] text-neutral-400 font-mono inline-flex items-center justify-center gap-1.5 flex-wrap">
                          {selectedModel.provider === 'LM-Kit One' ? (
                            <span className="inline-flex items-center gap-1 text-purple-400">
                              <Server className="w-3 h-3 text-purple-400" />
                              <span>LM-Kit One: {selectedModel.name}</span>
                              <span className="opacity-75 text-[10px]">
                                ({selectedModel.customConfig?.baseUrl ? selectedModel.customConfig.baseUrl.replace(/^https?:\/\//, '') : 'localhost:5189'})
                              </span>
                            </span>
                          ) : (
                            <span>Running on {selectedModel.name}</span>
                          )}
                          <span>· Enter sends, Shift+Enter for new line · ↑/↓ navigate messages</span>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals & Dialogs */}
      <ModelSelectorModal
        isOpen={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        allModels={allModels}
        customModels={customModels}
        onAddCustomModel={handleAddCustomModel}
        onDeleteCustomModel={handleDeleteCustomModel}
        theme={theme}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClearAllHistory={handleClearAllHistory}
        onExportHistory={handleExportHistory}
        onExportPDF={handleExportPDF}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <AdminDashboardModal
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
        sessions={sessions}
        allModels={allModels}
        currentModel={selectedModel}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenModelSelector={() => setIsModelSelectorOpen(true)}
        theme={theme}
      />

      <CreateAccountModal
        isOpen={isCreateAccountOpen}
        onClose={() => setIsCreateAccountOpen(false)}
        theme={theme}
      />

      <AdminSignInModal
        isOpen={isAdminSignInOpen}
        onClose={() => setIsAdminSignInOpen(false)}
        theme={theme}
      />

      <AuthRequiredModal
        isOpen={isAuthRequiredModalOpen}
        onClose={() => setIsAuthRequiredModalOpen(false)}
        onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
        theme={theme}
      />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        theme={theme}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setShareTargetMessage(null);
        }}
        session={activeSession}
        targetMessage={shareTargetMessage}
        theme={theme}
        authorName={user?.displayName || 'User'}
      />

      <ConfirmationDialog
        isOpen={showDeleteSelectedConfirm}
        onClose={() => setShowDeleteSelectedConfirm(false)}
        onConfirm={handleDeleteSelected}
        title="Delete selected messages?"
        description={`Are you sure you want to permanently delete ${selectedMessageIds.size} selected message${selectedMessageIds.size === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive={true}
        theme={theme}
      />

      {/* Floating Toast Notification Banner */}
      {toastNotification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none max-w-sm sm:max-w-md w-full px-4"
        >
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-xl border text-xs sm:text-sm font-medium backdrop-blur-md mx-auto w-fit ${
              toastNotification.type === 'error'
                ? isDark
                  ? 'bg-rose-950/90 border-rose-500/40 text-rose-200 shadow-rose-950/40'
                  : 'bg-rose-50/95 border-rose-300 text-rose-900 shadow-rose-200/50'
                : toastNotification.type === 'success'
                ? isDark
                  ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/40'
                  : 'bg-emerald-50/95 border-emerald-300 text-emerald-900 shadow-emerald-200/50'
                : isDark
                ? 'bg-[#222227]/95 border-[#34343d] text-neutral-200 shadow-black/40'
                : 'bg-white/95 border-neutral-300 text-neutral-800 shadow-neutral-200/60'
            }`}
          >
            {toastNotification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : toastNotification.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-purple-400 shrink-0" />
            )}
            <span>{toastNotification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
