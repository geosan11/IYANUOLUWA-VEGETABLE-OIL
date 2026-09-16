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
  CLAUDE_MODEL_PREF: 'iyanuoluwa_ai_claude_model'
};

/**
 * Shared-secret bearer token for the /api/ai serverless proxy. Must match
 * process.env.AI_PROXY_TOKEN on Vercel. If unset, callers skip the proxy
 * entirely and use the local deterministic engine instead of 401ing.
 */
const AI_PROXY_TOKEN = import.meta.env.VITE_AI_PROXY_TOKEN as string | undefined;

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
  claudeModel: string;
} {
  try {
    const claudeModel = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL_PREF) || 'claude-3-5-sonnet-20241022';
    return { provider: 'claude', claudeModel };
  } catch {
    return {
      provider: 'claude',
      claudeModel: 'claude-3-5-sonnet-20241022'
    };
  }
}

export function saveProviderPreference(
  _provider?: AIProviderType,
  claudeModel?: string
): void {
  try {
    if (claudeModel) localStorage.setItem(STORAGE_KEYS.CLAUDE_MODEL_PREF, claudeModel);
  } catch (err) {
    console.warn('Could not save provider preferences:', err);
  }
}

export async function requestOperationsAudit(
  snapshot: SystemSnapshot,
  options?: {
    claudeModel?: string;
    userRole?: string;
  }
): Promise<AIAnalysisReport> {
  const prefs = getProviderPreference();
  const claudeModel = options?.claudeModel || prefs.claudeModel;
  const userRole = options?.userRole || 'owner';

  const payload: AIRequestPayload = {
    action: 'audit',
    provider: 'claude',
    claudeModel,
    snapshot
  };

  // Only attempt the proxy if a bearer token is configured; otherwise go
  // straight to the deterministic engine instead of throwing.
  if (AI_PROXY_TOKEN) {
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
  }

  // Fallback to deterministic audit engine
  const fallbackReport = runDeterministicOperationsAudit(snapshot, 'claude');
  saveCachedReport(fallbackReport);
  return fallbackReport;
}

export async function askOperationsQuestion(
  question: string,
  snapshot: SystemSnapshot,
  options?: {
    claudeModel?: string;
    userRole?: string;
  }
): Promise<string> {
  const prefs = getProviderPreference();
  const claudeModel = options?.claudeModel || prefs.claudeModel;
  const userRole = options?.userRole || 'owner';

  const payload: AIRequestPayload = {
    action: 'chat',
    provider: 'claude',
    claudeModel,
    snapshot,
    chatMessage: question
  };

  // Only attempt the proxy if a bearer token is configured; otherwise go
  // straight to the deterministic answer engine instead of throwing.
  if (AI_PROXY_TOKEN) {
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
  }

  return answerCopilotQuestionDeterministic(question, snapshot);
}
