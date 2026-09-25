export type Role = 'user' | 'assistant' | 'system';
export type UserRole = 'admin' | 'user';

export interface UserPermissions {
  canManageAIConfiguration: boolean;
  canSelectModel: boolean;
  canManageApiKeys: boolean;
  canAccessSettings: boolean;
  canModifySystemPrompt: boolean;
  canAccessAdminDashboard: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size?: string;
  type: 'image' | 'pdf' | 'doc' | 'txt' | 'file' | 'code';
  fileExtension?: string;
  previewUrl?: string;
  content?: string;
}

export type MessageStatus = 'sending' | 'sent' | 'failed' | 'complete' | 'streaming' | 'error';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  model?: string;
  attachments?: Attachment[];
  status?: MessageStatus;
  liked?: boolean | null;
  isPinned?: boolean;
  errorMessage?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  messages: Message[];
}

export type ProviderType = 'OpenAI' | 'Anthropic' | 'Google' | 'DeepSeek' | 'Meta' | 'LM-Kit One' | 'Custom';

export interface UserProfile {
  uid: string;
  displayName: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  email: string;
  profession: string;
  photoURL?: string;
  role: UserRole;
  createdAt: number;
  lastLoginAt: number;
}

export interface CreateAccountInput {
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  email: string;
  profession: string;
}

export interface LMKitCustomConfig {
  baseUrl: string;
  apiKey?: string;
  modelId: string;
  dialect?: 'openai' | 'anthropic' | 'ollama' | 'native';
  port?: number | string;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: ProviderType | string;
  description: string;
  contextWindow: string;
  speed: 'Ultra-fast' | 'Fast' | 'Balanced' | 'Deep Reasoning';
  isPopular?: boolean;
  isCustom?: boolean;
  customConfig?: LMKitCustomConfig;
}

export interface AppSettings {
  apiKey: string;
  provider: string;
  selectedModel: string;
  temperature: number;
  systemPrompt: string;
  streamingEnabled: boolean;
  soundEffects: boolean;
  theme: 'dark' | 'light';
  autoScrollToBottom?: boolean;
  enableTTS?: boolean;
}

export interface SharedChatSession {
  id: string;
  title: string;
  createdAt: number;
  expiresAt: number;
  model: string;
  messages: Message[];
  authorName?: string;
  isPublic: boolean;
}

export interface SystemAIConfig {
  selectedModel: string;
  provider: string;
  temperature: number;
  systemPrompt: string;
  streamingEnabled: boolean;
  apiKey?: string;
  updatedAt: number;
  updatedBy?: string;
}

export interface SystemLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'security' | 'config';
  action: string;
  details: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, any>;
}

export interface ModelUsageStat {
  modelId: string;
  modelName: string;
  provider: string;
  messageCount: number;
  tokenCount: number;
}
