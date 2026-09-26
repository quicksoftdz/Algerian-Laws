import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Check,
  Zap,
  Sparkles,
  Server,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Cpu,
} from 'lucide-react';
import { ModelOption } from '../types/chat';
import { testLMKitConnection, LMKitTestResult } from '../services/lmkitService';
import { useAuth } from '../context/AuthContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { ConfirmationDialog } from './ConfirmationDialog';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  customModels?: ModelOption[];
  onAddCustomModel?: (model: ModelOption) => void;
  onDeleteCustomModel?: (modelId: string) => void;
  allModels: ModelOption[];
  theme?: 'dark' | 'light';
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedModel,
  onSelectModel,
  onAddCustomModel,
  onDeleteCustomModel,
  allModels,
  theme = 'dark',
}) => {
  const { permissions } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Custom LM-Kit Form State
  const [customName, setCustomName] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('http://localhost:5189/v1');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customDialect, setCustomDialect] = useState<
    'openai' | 'anthropic' | 'ollama' | 'native'
  >('openai');
  const [customContextWindow, setCustomContextWindow] = useState('128k tokens');
  const [customSpeed, setCustomSpeed] = useState<
    'Ultra-fast' | 'Fast' | 'Balanced' | 'Deep Reasoning'
  >('Ultra-fast');
  const [customDescription, setCustomDescription] = useState('');

  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<LMKitTestResult | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<ModelOption | null>(null);

  const { isMounted, isVisible, backdropClasses, cardClasses } = useModalAnimation({
    isOpen: Boolean(isOpen && permissions.canSelectModel),
  });

  // Close on Escape
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

  if (!isMounted || !permissions.canSelectModel) return null;

  const isDark = theme === 'dark';
  const providers = ['all', 'LM-Kit One', 'OpenAI', 'Google', 'Anthropic', 'DeepSeek', 'Meta'];

  const filteredModels = allModels.filter((model) => {
    const matchesSearch =
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (model.customConfig?.baseUrl &&
        model.customConfig.baseUrl.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesProvider =
      selectedProvider === 'all' ||
      model.provider.toLowerCase() === selectedProvider.toLowerCase();

    return matchesSearch && matchesProvider;
  });

  const handleTestConnection = async () => {
    if (!customBaseUrl.trim()) return;

    setIsTesting(true);
    setTestResult(null);

    const result = await testLMKitConnection(customBaseUrl, customApiKey, customDialect);

    setIsTesting(false);
    setTestResult(result);

    // If models were discovered and none selected yet,
    // populate the modelId with the first discovered model.
    if (result.detectedModels && result.detectedModels.length > 0 && !customModelId) {
      setCustomModelId(result.detectedModels[0]);

      if (!customName) {
        setCustomName(`LM-Kit / ${result.detectedModels[0]}`);
      }
    }
  };

  const handleSaveCustomModel = (e: React.FormEvent) => {
    e.preventDefault();

    const finalModelId = customModelId.trim() || 'default';
    const finalName = customName.trim() || `LM-Kit / ${finalModelId}`;
    const cleanBaseUrl = customBaseUrl.trim() || 'http://localhost:5189/v1';

    const newModel: ModelOption = {
      id: `lmkit-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: finalName,
      provider: 'LM-Kit One',
      description:
        customDescription.trim() ||
        `Private on-premise model served by LM-Kit One on ${cleanBaseUrl}`,
      contextWindow: customContextWindow,
      speed: customSpeed,
      isCustom: true,
      customConfig: {
        baseUrl: cleanBaseUrl,
        apiKey: customApiKey.trim() || undefined,
        modelId: finalModelId,
        dialect: customDialect,
        port: 5189,
      },
    };

    if (onAddCustomModel) {
      onAddCustomModel(newModel);
    }

    // Select the newly created model.
    // IMPORTANT: Do not close the modal here.
    onSelectModel(newModel);

    // Return to the model list and keep the modal open.
    setIsAddingCustom(false);
    setSelectedProvider('LM-Kit One');

    // Reset the form for a possible next model.
    setCustomName('');
    setCustomModelId('');
    setCustomApiKey('');
    setCustomDescription('');
    setCustomBaseUrl('http://localhost:5189/v1');
    setCustomDialect('openai');
    setCustomContextWindow('128k tokens');
    setCustomSpeed('Ultra-fast');
    setTestResult(null);
    setShowAdvancedSettings(false);
  };

  const applyPreset = (presetType: 'local' | 'localIp' | 'native') => {
    if (presetType === 'local') {
      setCustomBaseUrl('http://localhost:5189/v1');
      setCustomDialect('openai');
    } else if (presetType === 'localIp') {
      setCustomBaseUrl('http://127.0.0.1:5189/v1');
      setCustomDialect('openai');
    } else if (presetType === 'native') {
      setCustomBaseUrl('http://localhost:5189/lmkit/v1');
      setCustomDialect('native');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-modal-title"
      onClick={onClose}
      className={backdropClasses}
    >
      <div
        ref={dialogRef}
        className={`w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] border transition-colors outline-none ${
          isDark
            ? 'bg-[#18181b] border-[#2e2e34] text-white'
            : 'bg-white border-[#e4e4e7] text-neutral-900 shadow-neutral-200'
        } ${cardClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? 'border-[#27272a]' : 'border-[#e4e4e7]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isDark
                  ? 'bg-[#27272a] text-purple-400'
                  : 'bg-purple-50 text-purple-600'
              }`}
            >
              <Cpu className="w-5 h-5" />
            </div>

            <div>
              <h2
                id="model-modal-title"
                className="text-base font-semibold tracking-tight"
              >
                Select Model
              </h2>

              <p className="text-xs text-neutral-400 mt-0.5">
                Choose cloud intelligence or add private models from LM-Kit One
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAddingCustom && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingCustom(true);
                  setSelectedProvider('LM-Kit One');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
                  isDark
                    ? 'bg-purple-950/40 text-purple-300 border-purple-800/60 hover:bg-purple-900/50'
                    : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Add LM-Kit Model
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-neutral-400 hover:text-white hover:bg-[#27272a]'
                  : 'text-neutral-500 hover:text-black hover:bg-neutral-100'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* LM-Kit Custom Add/Configure View */}
        {isAddingCustom ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div
              className={`p-4 rounded-xl border flex flex-col gap-2 ${
                isDark
                  ? 'bg-purple-950/20 border-purple-900/40 text-purple-200'
                  : 'bg-purple-50/70 border-purple-200 text-purple-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 font-medium text-xs">
                  <Server className="w-4 h-4 text-purple-400" />
                  <span>LM-Kit One Private AI Server</span>
                </div>

                <a
                  href="https://docs.lm-kit.com/lm-kit-one/api/index.html"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] underline opacity-80 hover:opacity-100 text-purple-400"
                >
                  <span>API Documentation</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Connect your private on-premise LM-Kit One server. LM-Kit One
                serves models locally (default port{' '}
                <code className="px-1 py-0.5 rounded bg-black/30 font-mono text-purple-300">
                  5189
                </code>
                ) with full OpenAI, Anthropic, Ollama, and native REST dialect
                compatibility.
              </p>
            </div>

            <form onSubmit={handleSaveCustomModel} className="space-y-4">
              {/* Quick Presets */}
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1.5">
                  Server Presets
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset('local')}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors cursor-pointer ${
                      customBaseUrl.includes('localhost:5189')
                        ? 'bg-purple-600/20 text-purple-400 border-purple-500/40 font-semibold'
                        : isDark
                        ? 'bg-[#202024] border-[#2e2e34] text-neutral-300 hover:bg-[#27272a]'
                        : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    localhost:5189/v1 (Default)
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('localIp')}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors cursor-pointer ${
                      customBaseUrl.includes('127.0.0.1:5189')
                        ? 'bg-purple-600/20 text-purple-400 border-purple-500/40 font-semibold'
                        : isDark
                        ? 'bg-[#202024] border-[#2e2e34] text-neutral-300 hover:bg-[#27272a]'
                        : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    127.0.0.1:5189/v1
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('native')}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors cursor-pointer ${
                      customDialect === 'native'
                        ? 'bg-purple-600/20 text-purple-400 border-purple-500/40 font-semibold'
                        : isDark
                        ? 'bg-[#202024] border-[#2e2e34] text-neutral-300 hover:bg-[#27272a]'
                        : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    Native REST
                  </button>
                </div>
              </div>

              {/* Server Base URL */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  LM-Kit One Base URL <span className="text-red-400">*</span>
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="http://localhost:5189/v1"
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-mono border focus:outline-none transition-colors ${
                      isDark
                        ? 'bg-[#202024] border-[#2e2e34] text-white placeholder-neutral-500 focus:border-purple-500'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:border-purple-500'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !customBaseUrl.trim()}
                    className={`px-3 py-2 rounded-xl text-xs font-medium shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors border ${
                      isDark
                        ? 'bg-[#27272a] hover:bg-[#323238] text-white border-[#3f3f46]'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border-neutral-300'
                    } disabled:opacity-50`}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Server className="w-3.5 h-3.5 text-purple-400" />
                        <span>Test & Discover</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-neutral-400 mt-1">
                  Default port is 5189. Point to your local LM-Kit One instance
                  or internal gateway.
                </p>
              </div>

              {/* Connection Test Status Output */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-2 ${
                    testResult.ok
                      ? isDark
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : isDark
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}

                    <span>{testResult.message}</span>
                  </div>

                  {testResult.detectedModels &&
                    testResult.detectedModels.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[11px] opacity-80 block mb-1">
                          Detected served models (click to select):
                        </span>

                        <div className="flex flex-wrap gap-1.5">
                          {testResult.detectedModels.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setCustomModelId(m);

                                if (!customName) {
                                  setCustomName(`LM-Kit / ${m}`);
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors border ${
                                customModelId === m
                                  ? 'bg-emerald-600 text-white border-emerald-700'
                                  : isDark
                                  ? 'bg-[#202024] text-neutral-200 border-[#323238] hover:border-emerald-500'
                                  : 'bg-white text-neutral-800 border-neutral-200 hover:border-emerald-500'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* Model ID and Friendly Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Model Identifier <span className="text-red-400">*</span>
                  </label>

                  <input
                    type="text"
                    required
                    value={customModelId}
                    onChange={(e) => setCustomModelId(e.target.value)}
                    placeholder="e.g. llama-3.3-70b-instruct"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border focus:outline-none transition-colors ${
                      isDark
                        ? 'bg-[#202024] border-[#2e2e34] text-white placeholder-neutral-500 focus:border-purple-500'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:border-purple-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Display Name
                  </label>

                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. LM-Kit / Llama 3.3 70B"
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none transition-colors ${
                      isDark
                        ? 'bg-[#202024] border-[#2e2e34] text-white placeholder-neutral-500 focus:border-purple-500'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:border-purple-500'
                    }`}
                  />
                </div>
              </div>

              {/* Dialect and Optional Auth Token */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    API Dialect
                  </label>

                  <select
                    value={customDialect}
                    onChange={(e: any) => setCustomDialect(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#202024] border-[#2e2e34] text-white'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-900'
                    }`}
                  >
                    <option value="openai">
                      OpenAI Dialect (/v1/chat/completions)
                    </option>
                    <option value="anthropic">
                      Anthropic Dialect (/v1/messages)
                    </option>
                    <option value="ollama">Ollama Dialect (/api/chat)</option>
                    <option value="native">LM-Kit Native REST</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Bearer Token / Key{' '}
                    <span className="text-neutral-400">(optional)</span>
                  </label>

                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Enter LM-Kit server token if required"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border focus:outline-none transition-colors ${
                      isDark
                        ? 'bg-[#202024] border-[#2e2e34] text-white placeholder-neutral-500 focus:border-purple-500'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:border-purple-500'
                    }`}
                  />
                </div>
              </div>

              {/* Advanced Settings Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setShowAdvancedSettings((prev) => !prev)
                  }
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer transition-colors"
                >
                  {showAdvancedSettings ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}

                  <span>
                    Advanced Parameters (Context, Speed, Description)
                  </span>
                </button>

                {showAdvancedSettings && (
                  <div
                    className={`mt-2 p-3 rounded-xl border space-y-3 ${
                      isDark
                        ? 'bg-[#202024]/50 border-[#2e2e34]'
                        : 'bg-neutral-50 border-neutral-200'
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                          Context Window
                        </label>

                        <select
                          value={customContextWindow}
                          onChange={(e) =>
                            setCustomContextWindow(e.target.value)
                          }
                          className={`w-full px-2.5 py-1.5 rounded-lg text-xs border ${
                            isDark
                              ? 'bg-[#18181b] border-[#2e2e34] text-white'
                              : 'bg-white border-neutral-300 text-neutral-900'
                          }`}
                        >
                          <option value="32k tokens">32k tokens</option>
                          <option value="64k tokens">64k tokens</option>
                          <option value="128k tokens">128k tokens</option>
                          <option value="256k tokens">256k tokens</option>
                          <option value="1M tokens">1M tokens</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                          Execution Speed
                        </label>

                        <select
                          value={customSpeed}
                          onChange={(e: any) =>
                            setCustomSpeed(e.target.value)
                          }
                          className={`w-full px-2.5 py-1.5 rounded-lg text-xs border ${
                            isDark
                              ? 'bg-[#18181b] border-[#2e2e34] text-white'
                              : 'bg-white border-neutral-300 text-neutral-900'
                          }`}
                        >
                          <option value="Ultra-fast">Ultra-fast</option>
                          <option value="Fast">Fast</option>
                          <option value="Balanced">Balanced</option>
                          <option value="Deep Reasoning">
                            Deep Reasoning
                          </option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                        Model Description
                      </label>

                      <input
                        type="text"
                        value={customDescription}
                        onChange={(e) =>
                          setCustomDescription(e.target.value)
                        }
                        placeholder="e.g. Private local model running with zero cloud latency"
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs border ${
                          isDark
                            ? 'bg-[#18181b] border-[#2e2e34] text-white placeholder-neutral-500'
                            : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'text-neutral-400 hover:text-white hover:bg-[#27272a]'
                      : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                  }`}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save & Select Model
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Search & Provider Filters */}
            <div
              className={`p-4 border-b space-y-3 ${
                isDark ? 'border-[#27272a]' : 'border-[#e4e4e7]'
              }`}
            >
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models by name, provider, or localhost..."
                  className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none transition-colors font-mono border ${
                    isDark
                      ? 'bg-[#202024] border-[#2e2e34] text-white placeholder-neutral-500 focus:border-neutral-400'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:border-neutral-400'
                  }`}
                />
              </div>

              {/* Provider filter buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {providers.map((p) => {
                  const isLMKit = p === 'LM-Kit One';
                  const isActive = selectedProvider === p;

                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedProvider(p)}
                      className={`px-2.5 py-1 rounded-lg capitalize whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? isLMKit
                            ? 'bg-purple-600 text-white font-medium shadow-xs'
                            : isDark
                            ? 'bg-[#27272a] text-white font-medium border border-[#3f3f46]'
                            : 'bg-neutral-900 text-white font-medium border border-neutral-900'
                          : isLMKit
                          ? isDark
                            ? 'text-purple-300 hover:text-white bg-purple-950/30 border border-purple-800/40'
                            : 'text-purple-700 hover:bg-purple-100 bg-purple-50 border border-purple-200'
                          : isDark
                          ? 'text-neutral-400 hover:text-neutral-200 hover:bg-[#202024]'
                          : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                      }`}
                    >
                      {isLMKit && (
                        <Server className="w-3 h-3 text-purple-400" />
                      )}
                      <span>{p}</span>
                    </button>
                  );
                })}
              </div>

              {/* LM-Kit One Info Banner */}
              {selectedProvider === 'LM-Kit One' && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isDark
                      ? 'bg-purple-950/20 border-purple-900/40 text-purple-200'
                      : 'bg-purple-50 border-purple-200 text-purple-800'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-purple-400" />
                      LM-Kit One Private AI
                    </span>

                    <p className="text-[11px] opacity-80">
                      Models served via LM-Kit One on port 5189 with OpenAI
                      compatibility
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddingCustom(true)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer shrink-0"
                  >
                    + Add New
                  </button>
                </div>
              )}
            </div>

            {/* Model items list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredModels.map((model) => {
                const isSelected = model.id === selectedModel.id;
                const isLMKit = model.provider === 'LM-Kit One';

                return (
                  <div
                    key={model.id}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer group ${
                      isSelected
                        ? isDark
                          ? 'bg-[#242429] border-purple-400 ring-1 ring-purple-400/50'
                          : 'bg-purple-50/60 border-purple-600 ring-1 ring-purple-600/50 shadow-xs'
                        : isDark
                        ? 'bg-[#1e1e22] border-[#2b2b31] hover:border-neutral-600 hover:bg-[#222227]'
                        : 'bg-white border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 shadow-xs'
                    }`}
                    onClick={() => {
                      // Select the model but KEEP the modal open.
                      // The user closes it explicitly with X or Done.
                      onSelectModel(model);
                    }}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold tracking-tight truncate">
                          {model.name}
                        </span>

                        {isLMKit && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <Server className="w-2.5 h-2.5" />
                            {model.customConfig?.baseUrl
                              ? model.customConfig.baseUrl.replace(
                                  /^https?:\/\//,
                                  ''
                                )
                              : 'localhost:5189'}
                          </span>
                        )}

                        {model.isPopular && !isLMKit && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Sparkles className="w-2.5 h-2.5" />
                            Popular
                          </span>
                        )}

                        {model.isCustom && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Custom API
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-neutral-400 line-clamp-2">
                        {model.description}
                      </p>

                      <div className="flex items-center gap-3 pt-1 text-[11px] text-neutral-400">
                        <span className="font-medium text-neutral-300">
                          {model.provider}
                        </span>

                        <span>·</span>

                        <span>Context: {model.contextWindow}</span>

                        <span>·</span>

                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-neutral-400" />
                          {model.speed}
                        </span>
                      </div>
                    </div>

                    <div className="pt-0.5 shrink-0 flex items-center gap-2">
                      {/* Delete button for custom user-added models */}
                      {model.isCustom && onDeleteCustomModel && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModelToDelete(model);
                          }}
                          aria-label="Delete custom model"
                          title="Delete custom model"
                          className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                            isDark
                              ? 'text-neutral-400 hover:text-red-400 hover:bg-red-950/30'
                              : 'text-neutral-500 hover:text-red-600 hover:bg-red-50'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isSelected ? (
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            isDark
                              ? 'bg-purple-500 text-white'
                              : 'bg-purple-600 text-white'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-neutral-500" />
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredModels.length === 0 && (
                <div className="py-12 text-center text-xs text-neutral-400 space-y-2">
                  <p>No models match your search or filter.</p>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustom(true);
                      setSelectedProvider('LM-Kit One');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 hover:text-purple-300 underline cursor-pointer"
                  >
                    + Add a new LM-Kit One model
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Footer with explicit Done button */}
            <div
              className={`px-5 py-3 border-t flex items-center justify-between text-xs shrink-0 ${
                isDark
                  ? 'border-[#27272a] bg-[#141416]'
                  : 'border-[#e4e4e7] bg-neutral-50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-neutral-400">
                <span>Selected:</span>

                <span
                  className={`font-semibold ${
                    isDark ? 'text-white' : 'text-black'
                  }`}
                >
                  {selectedModel.name}
                </span>
              </div>

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
          </>
        )}
      </div>

      <ConfirmationDialog
        isOpen={Boolean(modelToDelete)}
        onClose={() => setModelToDelete(null)}
        onConfirm={() => {
          if (modelToDelete && onDeleteCustomModel) {
            onDeleteCustomModel(modelToDelete.id);
            setModelToDelete(null);
          }
        }}
        title="Remove custom model?"
        description={
          modelToDelete ? (
            <>
              Are you sure you want to remove the custom model{' '}
              <span className="font-semibold text-neutral-200 dark:text-neutral-100">
                "{modelToDelete.name}"
              </span>
              ?
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        isDestructive={true}
        theme={theme}
      />
    </div>
  );
};