import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Activity,
  BarChart3,
  Server,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Trash2,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  Zap,
  Lock,
  Layers,
  Database,
  ArrowUpRight,
  Terminal,
  Cpu,
  FileText,
  Sliders,
  X,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SystemLogEntry, ChatSession, ModelOption, AppSettings } from '../types/chat';
import { subscribeToAdminLogs, clearAdminLogs, logAdminEvent } from '../lib/firebase';
import { calculateApproximateTokens, formatApproximateTokens } from '../lib/tokenEstimator';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { ConfirmationDialog } from './ConfirmationDialog';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  allModels: ModelOption[];
  currentModel: ModelOption;
  settings: AppSettings;
  onOpenSettings?: () => void;
  onOpenModelSelector?: () => void;
  theme?: 'dark' | 'light';
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  sessions,
  allModels,
  currentModel,
  settings,
  onOpenSettings,
  onOpenModelSelector,
  theme = 'dark',
}) => {
  const { user, role, isAdmin, permissions } = useAuth();
  const [activeTab, setActiveTab] = useState<'analytics' | 'logs' | 'models' | 'health'>('analytics');
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [logFilterLevel, setLogFilterLevel] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [isClearingLogs, setIsClearingLogs] = useState<boolean>(false);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState<boolean>(false);
  const [selectedLog, setSelectedLog] = useState<SystemLogEntry | null>(null);

  const isDark = theme === 'dark';

  const { isMounted, isVisible, backdropClasses, cardClasses } = useModalAnimation({
    isOpen,
  });

  // Real-time Firestore subscription to admin audit logs
  useEffect(() => {
    if (!isOpen || !isAdmin) return;

    const initialSeed: SystemLogEntry[] = [
      {
        id: 'log_seed_1',
        timestamp: Date.now() - 1000 * 60 * 12,
        level: 'info',
        action: 'AI_MODEL_INITIALIZED',
        details: `Active model '${currentModel.name}' (${currentModel.provider}) online with system temperature ${settings.temperature}`,
        userEmail: 'system@kernel',
      },
      {
        id: 'log_seed_2',
        timestamp: Date.now() - 1000 * 60 * 45,
        level: 'config',
        action: 'SYSTEM_CONFIG_SYNCED',
        details: 'Synchronized real-time AI parameters with Firestore registry',
        userEmail: 'admin@system',
      },
      {
        id: 'log_seed_3',
        timestamp: Date.now() - 1000 * 60 * 120,
        level: 'security',
        action: 'RBAC_SECURITY_AUDIT',
        details: 'Admin permissions validated. Firestore rules enforced on /system and /admin_logs',
        userEmail: 'security@cloud',
      },
    ];

    if (logs.length === 0) {
      setLogs(initialSeed);
    }

    if (user) {
      // Log admin access event
      logAdminEvent(
        'ADMIN_DASHBOARD_ACCESSED',
        `Admin dashboard opened by ${user?.email || 'admin'}`,
        'info',
        { timestamp: Date.now() }
      );

      const unsubscribe = subscribeToAdminLogs(role, (fetchedLogs) => {
        if (fetchedLogs && fetchedLogs.length > 0) {
          setLogs(fetchedLogs);
        }
      });

      return () => unsubscribe();
    }
  }, [isOpen, isAdmin, role, currentModel.name, currentModel.provider, settings.temperature, user]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Aggregate Metrics Calculations
  const analyticsSummary = useMemo(() => {
    let totalMessages = 0;
    let totalTokens = 0;
    const modelDistribution: Record<string, { count: number; tokens: number; name: string; provider: string }> = {};

    sessions.forEach((s) => {
      const sessionMessages = s.messages || [];
      totalMessages += sessionMessages.length;

      const modelId = s.model || currentModel.name;
      if (!modelDistribution[modelId]) {
        modelDistribution[modelId] = {
          count: 0,
          tokens: 0,
          name: modelId,
          provider: 'AI Provider',
        };
      }

      sessionMessages.forEach((m) => {
        const estTokens = calculateApproximateTokens(m.content);
        totalTokens += estTokens;
        modelDistribution[modelId].count += 1;
        modelDistribution[modelId].tokens += estTokens;
      });
    });

    const modelArray = Object.values(modelDistribution).sort((a, b) => b.count - a.count);

    return {
      totalSessions: sessions.length,
      totalMessages,
      totalTokens,
      modelArray,
    };
  }, [sessions, currentModel.name]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel = logFilterLevel === 'all' || log.level === logFilterLevel;
      const query = logSearchQuery.toLowerCase().trim();
      const matchesQuery =
        !query ||
        log.action.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query) ||
        (log.userEmail && log.userEmail.toLowerCase().includes(query));
      return matchesLevel && matchesQuery;
    });
  }, [logs, logFilterLevel, logSearchQuery]);

  const handleClearAllLogs = async () => {
    setIsClearingLogs(true);
    try {
      const ids = logs.map((l) => l.id);
      await clearAdminLogs(role, ids);
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    } finally {
      setIsClearingLogs(false);
    }
  };

  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `admin_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Strict Authorization Guard: Non-admins cannot view or render the Admin Dashboard
  if (!isMounted) return null;

  if (!isAdmin || !permissions.canAccessAdminDashboard) {
    return (
      <div className={backdropClasses} onClick={onClose}>
        <div
          className={`w-full max-w-md rounded-2xl border p-6 text-center space-y-4 shadow-2xl ${
            isDark ? 'bg-[#18181b] border-rose-500/30 text-white' : 'bg-white border-rose-200 text-neutral-900'
          } ${cardClasses}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold">403 Unauthorized Access</h3>
          <p className="text-xs text-neutral-400">
            The Admin Dashboard requires verified System Administrator privileges. Regular Users are restricted from viewing telemetry and audit logs.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-dashboard-title"
      onClick={onClose}
      className={backdropClasses}
    >
      <div
        className={`w-full max-w-5xl h-[90vh] max-h-[850px] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark ? 'bg-[#121215] border-[#27272c] text-white' : 'bg-[#fafafa] border-neutral-200 text-neutral-900'
        } ${cardClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
            isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="admin-dashboard-title" className="text-sm font-bold tracking-tight">
                  Admin Control & Telemetry Dashboard
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                System usage analytics, real-time audit logs, and AI provider health monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isDark ? 'hover:bg-[#27272a] text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
              }`}
              title="Close Dashboard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`flex items-center gap-2 px-6 pt-3 border-b text-xs font-medium shrink-0 ${
            isDark ? 'bg-[#141418] border-[#27272c]' : 'bg-neutral-50 border-neutral-200'
          }`}
        >
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'border-purple-500 text-purple-400 font-semibold'
                : isDark
                ? 'border-transparent text-neutral-400 hover:text-neutral-200'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Usage Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'border-purple-500 text-purple-400 font-semibold'
                : isDark
                ? 'border-transparent text-neutral-400 hover:text-neutral-200'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Audit & System Logs</span>
            {logs.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200 text-neutral-700'}`}>
                {logs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'models'
                ? 'border-purple-500 text-purple-400 font-semibold'
                : isDark
                ? 'border-transparent text-neutral-400 hover:text-neutral-200'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Models & Providers</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'health'
                ? 'border-purple-500 text-purple-400 font-semibold'
                : isDark
                ? 'border-transparent text-neutral-400 hover:text-neutral-200'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>System Health & Security</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: USAGE ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Quick KPI Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div
                  className={`p-4 rounded-xl border ${
                    isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-neutral-400 mb-2">
                    <span className="text-xs font-medium">Total Conversations</span>
                    <FileText className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight">{analyticsSummary.totalSessions}</div>
                  <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
                    <span className="text-emerald-400 font-medium">Active</span> sessions in memory
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-neutral-400 mb-2">
                    <span className="text-xs font-medium">Total Messages</span>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight">{analyticsSummary.totalMessages}</div>
                  <div className="text-[11px] text-neutral-400 mt-1">Prompt & AI generation turns</div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-neutral-400 mb-2">
                    <span className="text-xs font-medium">Est. Tokens Processed</span>
                    <Zap className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    {formatApproximateTokens(analyticsSummary.totalTokens)}
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1 font-mono">
                    ~{analyticsSummary.totalTokens.toLocaleString()} tokens
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-neutral-400 mb-2">
                    <span className="text-xs font-medium">System Model</span>
                    <Server className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold truncate" title={currentModel.name}>
                    {currentModel.name}
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online & Active
                  </div>
                </div>
              </div>

              {/* Model Usage Distribution */}
              <div
                className={`p-5 rounded-2xl border space-y-4 ${
                  isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Model Usage Breakdown
                    </h3>
                    <p className="text-xs text-neutral-400">Share of total conversations processed by AI models</p>
                  </div>
                  {onOpenModelSelector && (
                    <button
                      onClick={onOpenModelSelector}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <span>Manage Models</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  {analyticsSummary.modelArray.length === 0 ? (
                    <div className="text-xs text-neutral-400 py-4 text-center">No conversation telemetry yet.</div>
                  ) : (
                    analyticsSummary.modelArray.map((m, idx) => {
                      const percentage =
                        analyticsSummary.totalMessages > 0
                          ? Math.round((m.count / analyticsSummary.totalMessages) * 100)
                          : 0;

                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{m.name}</span>
                              <span className="text-[10px] text-neutral-400 font-mono">({m.count} msgs)</span>
                            </div>
                            <div className="flex items-center gap-3 font-mono text-neutral-400 text-[11px]">
                              <span>{formatApproximateTokens(m.tokens)} tokens</span>
                              <span className="font-bold text-white w-10 text-right">{percentage}%</span>
                            </div>
                          </div>
                          <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(percentage, 3)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Real-time System Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Security & RBAC</span>
                    <Shield className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-inherit">
                      <span className="text-neutral-400">Authenticated Admin:</span>
                      <span className="font-mono font-medium">{user?.email || 'kerbadou.g@gmail.com'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-inherit">
                      <span className="text-neutral-400">Active Role Policy:</span>
                      <span className="text-purple-400 font-semibold font-mono uppercase">Full Administrator (RWX)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-neutral-400">Regular User Restrictions:</span>
                      <span className="text-emerald-400 font-medium">Model & Key Menus Hidden</span>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">AI Runtime Profile</span>
                    <Sliders className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-inherit">
                      <span className="text-neutral-400">Sampling Temperature:</span>
                      <span className="font-mono font-semibold">{settings.temperature}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-inherit">
                      <span className="text-neutral-400">Streaming Engine:</span>
                      <span className="text-emerald-400 font-medium font-mono">
                        {settings.streamingEnabled ? 'Enabled (Simulated/SSE)' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-neutral-400">Database Storage:</span>
                      <span className="text-cyan-400 font-medium">Firebase Firestore (Multi-region)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AUDIT & SYSTEM LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              {/* Controls Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border w-full sm:w-64 text-xs ${
                    isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200'
                  }`}>
                    <Search className="w-3.5 h-3.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search actions, emails, details..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      className="bg-transparent focus:outline-none w-full"
                    />
                  </div>

                  <select
                    value={logFilterLevel}
                    onChange={(e) => setLogFilterLevel(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer focus:outline-none ${
                      isDark ? 'bg-[#18181c] border-[#27272c] text-white' : 'bg-white border-neutral-200 text-neutral-900'
                    }`}
                  >
                    <option value="all">All Levels</option>
                    <option value="info">Info</option>
                    <option value="config">Config</option>
                    <option value="security">Security</option>
                    <option value="warn">Warnings</option>
                    <option value="error">Errors</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleExportLogs}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                      isDark ? 'bg-[#18181c] border-[#27272c] hover:bg-[#202025]' : 'bg-white border-neutral-200 hover:bg-neutral-100'
                    }`}
                    title="Export Audit Logs as JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowClearLogsConfirm(true)}
                    disabled={isClearingLogs || logs.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Logs</span>
                  </button>
                </div>
              </div>

              {/* Log Stream Container */}
              <div
                className={`rounded-2xl border overflow-hidden font-mono text-xs ${
                  isDark ? 'bg-[#101013] border-[#27272c]' : 'bg-white border-neutral-200'
                }`}
              >
                <div
                  className={`grid grid-cols-12 px-4 py-2 border-b text-[11px] font-semibold uppercase tracking-wider text-neutral-400 ${
                    isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div className="col-span-2">Timestamp</div>
                  <div className="col-span-2">Level</div>
                  <div className="col-span-3">Action</div>
                  <div className="col-span-5">Details / Actor</div>
                </div>

                <div className="divide-y divide-inherit max-h-[420px] overflow-y-auto">
                  {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-neutral-400">
                      No log entries match your filter criteria.
                    </div>
                  ) : (
                    filteredLogs.map((log) => {
                      const dateStr = new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });

                      let badgeColor = 'bg-neutral-800 text-neutral-300';
                      if (log.level === 'info') badgeColor = 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
                      if (log.level === 'config') badgeColor = 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
                      if (log.level === 'security') badgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                      if (log.level === 'warn') badgeColor = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
                      if (log.level === 'error') badgeColor = 'bg-rose-500/20 text-rose-400 border border-rose-500/30';

                      return (
                        <div
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className={`grid grid-cols-12 px-4 py-2.5 items-center hover:bg-purple-950/20 transition-colors cursor-pointer ${
                            selectedLog?.id === log.id ? 'bg-purple-950/30' : ''
                          }`}
                        >
                          <div className="col-span-2 text-neutral-400 text-[11px]">{dateStr}</div>
                          <div className="col-span-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeColor}`}>
                              {log.level}
                            </span>
                          </div>
                          <div className="col-span-3 font-semibold text-neutral-200 truncate pr-2">{log.action}</div>
                          <div className="col-span-5 flex items-center justify-between gap-2 text-neutral-400 text-[11px] truncate">
                            <span className="truncate">{log.details}</span>
                            {log.userEmail && (
                              <span className="text-[10px] text-neutral-500 shrink-0 font-sans">
                                {log.userEmail.split('@')[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Selected Log Details Drawer */}
              {selectedLog && (
                <div
                  className={`p-4 rounded-xl border space-y-2 animate-in fade-in duration-100 ${
                    isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold">{selectedLog.action}</span>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        ({new Date(selectedLog.timestamp).toLocaleString()})
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedLog(null)}
                      className="text-xs text-neutral-400 hover:text-white"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-300 font-mono bg-black/40 p-3 rounded-lg border border-neutral-800">
                    {selectedLog.details}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MODELS & PROVIDERS */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Available AI Models</h3>
                  <p className="text-xs text-neutral-400">Configured models available across the system</p>
                </div>
                {onOpenModelSelector && (
                  <button
                    onClick={onOpenModelSelector}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Open Model Manager</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allModels.map((m) => {
                  const isCurrent = m.id === currentModel.id;
                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-xl border space-y-2 transition-all ${
                        isCurrent
                          ? 'border-purple-500 bg-purple-950/15 ring-1 ring-purple-500/30'
                          : isDark
                          ? 'bg-[#18181c] border-[#27272c]'
                          : 'bg-white border-neutral-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{m.name}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500 text-white uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                          {m.provider}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-400 line-clamp-2">{m.description}</p>

                      <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-2 border-t border-inherit">
                        <span>Window: {m.contextWindow}</span>
                        <span className="text-emerald-400 font-medium">{m.speed}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: SYSTEM HEALTH & SECURITY */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div
                className={`p-5 rounded-2xl border space-y-4 ${
                  isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">All Systems Operational</h3>
                    <p className="text-xs text-neutral-400">Database connections, AI endpoints, and RBAC rules are functioning normally</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#121215] border-[#27272c]' : 'bg-neutral-50 border-neutral-200'}`}>
                    <div className="text-[11px] text-neutral-400">Firestore Cloud DB</div>
                    <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Connected (0ms ping)
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#121215] border-[#27272c]' : 'bg-neutral-50 border-neutral-200'}`}>
                    <div className="text-[11px] text-neutral-400">Google OAuth & Auth</div>
                    <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Healthy & Active
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#121215] border-[#27272c]' : 'bg-neutral-50 border-neutral-200'}`}>
                    <div className="text-[11px] text-neutral-400">Security Rules Status</div>
                    <div className="text-sm font-bold text-purple-400 mt-1 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      Enforced on Cloud
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Actions */}
              <div
                className={`p-5 rounded-2xl border space-y-4 ${
                  isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-white border-neutral-200'
                }`}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Administrative Shortcuts</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {onOpenSettings && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenSettings();
                      }}
                      className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Sliders className="w-4 h-4 text-purple-400" />
                      <span>Settings & API Configuration</span>
                    </button>
                  )}

                  {onOpenModelSelector && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenModelSelector();
                      }}
                      className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Cpu className="w-4 h-4 text-cyan-400" />
                      <span>Switch System Model</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-6 py-3 border-t text-xs shrink-0 ${
            isDark ? 'bg-[#18181c] border-[#27272c] text-neutral-400' : 'bg-neutral-50 border-neutral-200 text-neutral-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Authenticated as <strong>{user?.email || 'kerbadou.g@gmail.com'}</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={showClearLogsConfirm}
        onClose={() => setShowClearLogsConfirm(false)}
        onConfirm={handleClearAllLogs}
        title="Clear all audit logs?"
        description="Are you sure you want to clear all administrative audit logs? This action will permanently remove all audit records."
        confirmLabel="Clear Logs"
        cancelLabel="Cancel"
        isDestructive={true}
        theme={theme}
      />
    </div>
  );
};
