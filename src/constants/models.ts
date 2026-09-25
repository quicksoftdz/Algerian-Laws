import { ModelOption } from '../types/chat';

export const DEFAULT_LMKIT_MODEL: ModelOption = {
  id: 'lmkit/local-model',
  name: 'lmkit/local-model',
  provider: 'LM-Kit One',
  description: 'Private on-premise model served by LM-Kit One on port 5189 with OpenAI dialect compatibility.',
  contextWindow: '128k tokens',
  speed: 'Ultra-fast',
  isPopular: true,
  isCustom: true,
  customConfig: {
    baseUrl: 'http://localhost:5189/v1',
    modelId: 'default',
    dialect: 'openai',
    port: 5189,
  },
};

export const AVAILABLE_MODELS: ModelOption[] = [
  DEFAULT_LMKIT_MODEL,
  {
    id: 'openai/gpt-4o-mini',
    name: 'openai/gpt-4o-mini',
    provider: 'OpenAI',
    description: 'Fast, cost-efficient, and lightweight reasoning model for general tasks.',
    contextWindow: '128k tokens',
    speed: 'Ultra-fast',
    isPopular: true,
  },
  {
    id: 'openai/gpt-4o',
    name: 'openai/gpt-4o',
    provider: 'OpenAI',
    description: 'Flagship multimodal intelligence for high-accuracy coding and synthesis.',
    contextWindow: '128k tokens',
    speed: 'Fast',
    isPopular: true,
  },
  {
    id: 'anthropic/claude-3-7-sonnet',
    name: 'anthropic/claude-3-7-sonnet',
    provider: 'Anthropic',
    description: 'Hybrid reasoning and leading-edge coding precision with thought reflection.',
    contextWindow: '200k tokens',
    speed: 'Balanced',
    isPopular: true,
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'google/gemini-2.5-flash',
    provider: 'Google',
    description: 'Next-generation low-latency reasoning and million-token analysis.',
    contextWindow: '1M tokens',
    speed: 'Ultra-fast',
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'google/gemini-2.5-pro',
    provider: 'Google',
    description: 'State-of-the-art complex problem solving and exhaustive code verification.',
    contextWindow: '2M tokens',
    speed: 'Deep Reasoning',
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'deepseek/deepseek-r1',
    provider: 'DeepSeek',
    description: 'Open-weights reasoning model with mathematical logic and chain-of-thought.',
    contextWindow: '64k tokens',
    speed: 'Deep Reasoning',
  },
  {
    id: 'meta/llama-3.3-70b',
    name: 'meta/llama-3.3-70b-instruct',
    provider: 'Meta',
    description: 'High capability open-weights instruction model for technical domain mastery.',
    contextWindow: '128k tokens',
    speed: 'Fast',
  },
];

export interface ActionStarter {
  id: string;
  label: string;
  iconName: 'cloud' | 'wrench' | 'target' | 'lightbulb';
  placeholderTemplate: string;
  quickPrompts: { title: string; prompt: string }[];
}

export const ACTION_STARTERS: ActionStarter[] = [
  {
    id: 'decide',
    label: 'Decide',
    iconName: 'cloud',
    placeholderTemplate: 'Compare [Option A] vs [Option B] across performance, developer experience, and scalability:',
    quickPrompts: [
      {
        title: 'Vite SPA vs Next.js App Router',
        prompt: 'Compare building a customer portal using Vite SPA vs Next.js App Router in 2026. Break down bundle size, SEO relevance, deployment simplicity, and team ergonomics.',
      },
      {
        title: 'PostgreSQL vs DynamoDB/Firestore',
        prompt: 'Help me choose between a relational PostgreSQL database and a serverless document store (like Firestore or DynamoDB) for an enterprise inventory tracking tool.',
      },
      {
        title: 'Tailwind CSS vs CSS Modules',
        prompt: 'Evaluate Tailwind CSS vs scoped CSS modules for a large design system with 50+ contributors. Detail maintainability, bundle efficiency, and onboarding friction.',
      },
    ],
  },
  {
    id: 'troubleshoot',
    label: 'Troubleshoot',
    iconName: 'wrench',
    placeholderTemplate: 'Here is the bug/stack trace and relevant code. Help me find the root cause and provide a fix:\n\n```ts\n\n```',
    quickPrompts: [
      {
        title: 'React Hydration Mismatch',
        prompt: 'I am getting "Error: Hydration failed because the server-rendered HTML didn\'t match the client". Walk through the top 4 causes and how to definitively resolve them with clean code.',
      },
      {
        title: 'TypeScript Type Exhaustiveness',
        prompt: 'How do I enforce compile-time exhaustiveness checking in TypeScript switch statements with a never type helper?',
      },
      {
        title: 'Memory Leak in useEffect Hook',
        prompt: 'Analyze why this WebSocket subscription or event listener inside a React useEffect causes runaway memory growth, and show the clean teardown pattern.',
      },
    ],
  },
  {
    id: 'how-to',
    label: 'How-to',
    iconName: 'target',
    placeholderTemplate: 'Provide a clean, step-by-step production implementation with TypeScript code for:',
    quickPrompts: [
      {
        title: 'Debounced Search with AbortController',
        prompt: 'Provide a production-ready custom React hook `useDebouncedSearch` that handles cancellation with `AbortController`, race conditions, and loading states.',
      },
      {
        title: 'Zero-Downtime Database Migration',
        prompt: 'Outline a zero-downtime database schema migration strategy for renaming an active column in a high-traffic production PostgreSQL database.',
      },
      {
        title: 'Web Audio API Realtime Visualizer',
        prompt: 'How to build a clean 60fps audio waveform visualizer in HTML Canvas using the Web Audio API AnalyserNode?',
      },
    ],
  },
  {
    id: 'understand',
    label: 'Understand',
    iconName: 'lightbulb',
    placeholderTemplate: 'Explain the internal architecture, mental model, and tradeoffs of:',
    quickPrompts: [
      {
        title: 'Event Loop & Microtasks in Node.js',
        prompt: 'Explain the Node.js event loop: timers, I/O polling, check phase, and how process.nextTick vs Promise microtasks are executed.',
      },
      {
        title: 'Transformer Attention Mechanism',
        prompt: 'Give an intuitive yet technically precise explanation of Scaled Dot-Product Attention: Query, Key, Value matrices, and why scaling by sqrt(d_k) matters.',
      },
      {
        title: 'CRDTs for Collaborative Editing',
        prompt: 'Explain how Conflict-free Replicated Data Types (CRDTs) achieve eventual consistency in real-time collaborative text editors without a central lock.',
      },
    ],
  },
];
