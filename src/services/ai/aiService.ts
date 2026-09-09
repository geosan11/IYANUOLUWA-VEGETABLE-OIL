import {
  AIProviderType,
  SystemSnapshot,
  AIAnalysisReport,
  AIRequestPayload,
  AIResponsePayload
} from './types';
import {
  runDeterministicOperationsAudit,
  answerCopilotQuestionDeterministic
} from './deterministicEngine';

const STORAGE_KEYS = {
  CACHED_REPORT: 'iyanuoluwa_ai_last_report',
  PROVIDER_PREF: 'iyanuoluwa_ai_provider_pref',
  GEMINI_MODEL_PREF: 'iyanuoluwa_ai_gemini_model',
  CLAUDE_MODEL_PREF: 'iyanuoluwa_ai_claude_model'
};

/**
 * Shared-secret bearer token for the /api/ai serverless proxy. Must match
 * process.env.AI_PROXY_TOKEN on Vercel. If unset the client refuses to call
 * the proxy (see assertAiProxyConfigured) instead of firing an un-authorised
 * request that would just 401.
 */
const AI_PROXY_TOKEN = import.meta.env.VITE_AI_PROXY_TOKEN as string | undefined;

export class AIProxyNotConfiguredError extends Error {
  constructor() {
    super('AI proxy not configured: set VITE_AI_PROXY_TOKEN so the app can authenticate to /api/ai.');
    this.name = 'AIProxyNotConfiguredError';
  }
}

function assertAiProxyConfigured(): void {
  if (!AI_PROXY_TOKEN) {
    throw new AIProxyNotConfiguredError();
  }
}

function aiProxyHeaders(userRole: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    // Primary auth. The x-user-role header below is only a secondary gate.
    Authorization: `Bearer ${AI_PROXY_TOKEN}`,
    'x-user-role': userRole
  };
}

export function getCachedReport(): AIAnalysisReport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CACHED_REPORT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCachedReport(report: AIAnalysisReport): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CACHED_REPORT, JSON.stringify(report));
  } catch (err) {
    console.warn('Could not cache AI report:', err);
  }
}

export function getProviderPreference(): {
  provider: AIProviderType;
  geminiModel: string;
  claudeModel: string;
} {
  try {
    const provider = (localStorage.getItem(STORAGE_KEYS.PROVIDER_PREF) as AIProviderType) || 'gemini';
    const geminiModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL_PREF) || 'gemini-1.5-flash';
    const claudeModel = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL_PREF) || 'claude-3-5-sonnet-20241022';
    return { provider, geminiModel, claudeModel };
  } catch {
    return {
      provider: 'gemini',
      geminiModel: 'gemini-1.5-flash',
      claudeModel: 'claude-3-5-sonnet-20241022'
    };
  }
}

export function saveProviderPreference(
  provider: AIProviderType,
  geminiModel?: string,
  claudeModel?: string
): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROVIDER_PREF, provider);
    if (geminiModel) localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL_PREF, geminiModel);
    if (claudeModel) localStorage.setItem(STORAGE_KEYS.CLAUDE_MODEL_PREF, claudeModel);
  } catch (err) {
    console.warn('Could not save provider preferences:', err);
  }
}

export async function requestOperationsAudit(
  snapshot: SystemSnapshot,
  options?: {
    provider?: AIProviderType;
    geminiModel?: string;
    claudeModel?: string;
    userRole?: string;
  }
): Promise<AIAnalysisReport> {
  const prefs = getProviderPreference();
  const provider = options?.provider || prefs.provider;
  const geminiModel = options?.geminiModel || prefs.geminiModel;
  const claudeModel = options?.claudeModel || prefs.claudeModel;
  const userRole = options?.userRole || 'owner';

  const payload: AIRequestPayload = {
    action: 'audit',
    provider,
    geminiModel,
    claudeModel,
    snapshot
  };

  // Refuse to call the proxy without a bearer token - surface a clear error.
  assertAiProxyConfigured();

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: aiProxyHeaders(userRole),
      body: JSON.stringify({ ...payload, userRole })
    });

    if (response.ok) {
      const data: AIResponsePayload = await response.json();
      if (data.report) {
        saveCachedReport(data.report);
        return data.report;
      }
    }
  } catch (networkError) {
    console.warn('Network call to /api/ai failed or serverless offline, using local deterministic engine:', networkError);
  }

  // Fallback to deterministic audit engine
  const fallbackReport = runDeterministicOperationsAudit(snapshot, provider);
  saveCachedReport(fallbackReport);
  return fallbackReport;
}

export async function askOperationsQuestion(
  question: string,
  snapshot: SystemSnapshot,
  options?: {
    provider?: AIProviderType;
    geminiModel?: string;
    claudeModel?: string;
    userRole?: string;
  }
): Promise<string> {
  const prefs = getProviderPreference();
  const provider = options?.provider || prefs.provider;
  const geminiModel = options?.geminiModel || prefs.geminiModel;
  const claudeModel = options?.claudeModel || prefs.claudeModel;
  const userRole = options?.userRole || 'owner';

  const payload: AIRequestPayload = {
    action: 'chat',
    provider,
    geminiModel,
    claudeModel,
    snapshot,
    chatMessage: question
  };

  // Refuse to call the proxy without a bearer token - surface a clear error.
  assertAiProxyConfigured();

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: aiProxyHeaders(userRole),
      body: JSON.stringify({ ...payload, userRole })
    });

    if (response.ok) {
      const data: AIResponsePayload = await response.json();
      if (data.chatReply) {
        return data.chatReply;
      }
    }
  } catch (networkError) {
    console.warn('Call to /api/ai failed, using local deterministic answer:', networkError);
  }

  return answerCopilotQuestionDeterministic(question, snapshot);
}
