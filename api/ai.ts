/**
 * Vercel Serverless Function: /api/ai
 *
 * Secure serverless endpoint for Iyanuoluwa Depot AI Operations Intelligence.
 * Keeps GEMINI_API_KEY and ANTHROPIC_API_KEY securely on the Vercel server.
 * Never exposes secrets to the browser.
 *
 * SECURITY MODEL
 * -------------
 * 1. PRIMARY AUTH - shared-secret bearer token. The caller must send
 *    `Authorization: Bearer <token>` where the token equals
 *    process.env.AI_PROXY_TOKEN. Compared in constant time. Missing / wrong
 *    token => 401. This is the real gate on who can spend the API budget.
 * 2. SECONDARY GATE - the legacy `x-user-role` header / `body.userRole` must
 *    still be `owner`. Defence-in-depth only; it is trivially spoofable and is
 *    NOT sufficient by itself.
 * 3. CORS - locked to an allowlist from process.env.AI_ALLOWED_ORIGINS
 *    (comma-separated). The request Origin is echoed back only when it is on
 *    the list. `Access-Control-Allow-Credentials` is intentionally NOT sent
 *    (the client uses a bearer token, not cookies).
 * 4. RATE LIMIT - in-memory per-IP token bucket (20 requests / 10 min, keyed on
 *    x-forwarded-for). NOTE: this is per serverless *instance* only. Vercel can
 *    run many concurrent instances and recycles them on cold start, so this
 *    slows a naive loop but does not hard-cap spend. A durable limiter backed
 *    by Upstash Redis / Vercel KV is the real fix; deliberately not added here
 *    to avoid a new dependency.
 *
 * DATA DISCLOSURE - CONSCIOUS, DOCUMENTED CHOICE
 * ---------------------------------------------
 * Every audit/chat request forwards a full depot snapshot - including customer
 * names, phone numbers, outstanding debit balances and cash figures - to the
 * configured third-party LLM provider (Anthropic Claude).
 * This is accepted for the operational value delivered, under each provider's
 * standard API terms (API traffic is not used for model training). If this ever
 * becomes unacceptable, redact PII in src/services/ai/dataExtractor.ts before
 * the snapshot reaches this proxy.
 */

import { timingSafeEqual } from 'node:crypto';
import { runDeterministicOperationsAudit, answerCopilotQuestionDeterministic } from '../src/services/ai/deterministicEngine';
import { AIRequestPayload, AIResponsePayload, AIAnalysisReport } from '../src/services/ai/types';

// ---------------------------------------------------------------------------
// Lightweight in-memory rate limiter (per-instance only - see security note).
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 20;                     // max requests ...
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;   // ... per 10 minutes, per IP
const RATE_LIMIT_REFILL_PER_MS = RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS;

interface TokenBucket {
  tokens: number;
  updatedAt: number;
}
const rateBuckets = new Map<string, TokenBucket>();

function rateLimitOk(ip: string): boolean {
  const now = Date.now();

  // Opportunistic cleanup so the map cannot grow without bound on a warm instance.
  if (rateBuckets.size > 5000) {
    for (const [key, b] of rateBuckets) {
      if (now - b.updatedAt > RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key);
    }
  }

  const bucket = rateBuckets.get(ip) ?? { tokens: RATE_LIMIT_MAX, updatedAt: now };
  bucket.tokens = Math.min(
    RATE_LIMIT_MAX,
    bucket.tokens + (now - bucket.updatedAt) * RATE_LIMIT_REFILL_PER_MS
  );
  bucket.updatedAt = now;
  rateBuckets.set(ip, bucket);

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

function clientIp(req: any): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : typeof xff === 'string' ? xff : '';
  return (raw.split(',')[0] || '').trim() || req.socket?.remoteAddress || 'unknown';
}

function bearerMatches(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parseAllowedOrigins(): string[] {
  return (process.env.AI_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export default async function handler(req: any, res: any) {
  // 1. CORS - strict allowlist, no wildcard, no credentials.
  const allowedOrigins = parseAllowedOrigins();
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const originAllowed = origin !== '' && allowedOrigins.includes(origin);

  if (originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-User-Role');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') {
    // Preflight always answers 204; a disallowed caller is blocked by the
    // browser because the Access-Control-Allow-Origin header is absent.
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. POST required.' });
  }

  // 2. PRIMARY AUTH: shared-secret bearer token (constant-time compare).
  const expectedToken = process.env.AI_PROXY_TOKEN || '';
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const providedToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

  if (!expectedToken) {
    return res.status(500).json({
      success: false,
      error: 'AI proxy is not configured: AI_PROXY_TOKEN is unset on the server.',
      source: 'vercel_serverless'
    });
  }
  if (!bearerMatches(providedToken, expectedToken)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: missing or invalid proxy bearer token.',
      source: 'vercel_serverless'
    });
  }

  // 3. Rate limit (per-IP, in-memory, per-instance only).
  const ip = clientIp(req);
  if (!rateLimitOk(ip)) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Try again later.',
      source: 'vercel_serverless'
    });
  }

  // 4. SECONDARY GATE (defence in depth, not primary auth): owner role only.
  const userRole = req.headers['x-user-role'] || req.body?.userRole;
  if (userRole !== 'owner') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: AI Operations Intelligence is restricted to the Managing Director / Owner role.',
      source: 'vercel_serverless'
    });
  }

  const payload: AIRequestPayload = req.body;
  const { action, provider = 'claude', claudeModel = 'claude-3-5-sonnet-20241022', snapshot, chatMessage } = payload;

  if (!snapshot) {
    return res.status(400).json({ success: false, error: 'Missing system snapshot payload.' });
  }

  const claudeApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  try {
    // -------------------------------------------------------------------------
    // ACTION: CHAT / COPILOT QUESTION
    // -------------------------------------------------------------------------
    if (action === 'chat') {
      const question = chatMessage || 'Give me an operations overview';

      // Attempt Claude if API key is configured
      if (claudeApiKey) {
        try {
          const claudeResponse = await callClaudeChat(claudeApiKey, claudeModel, question, snapshot);
          if (claudeResponse) {
            return res.status(200).json({
              success: true,
              providerUsed: 'claude',
              modelName: claudeModel,
              chatReply: claudeResponse,
              source: 'vercel_serverless'
            } as AIResponsePayload);
          }
        } catch (err) {
          console.warn('Claude chat failed, falling back to deterministic:', err);
        }
      }

      // Fallback deterministic response
      const fallbackReply = answerCopilotQuestionDeterministic(question, snapshot);
      return res.status(200).json({
        success: true,
        providerUsed: 'claude',
        modelName: 'Claude 3.5 Sonnet (Offline/Simulated Engine)',
        chatReply: fallbackReply,
        source: 'local_deterministic'
      } as AIResponsePayload);
    }

    // -------------------------------------------------------------------------
    // ACTION: AUDIT / STRATEGIC REPORT
    // -------------------------------------------------------------------------
    if (action === 'audit') {
      // If live Claude key is present
      if (claudeApiKey) {
        try {
          const liveReport = await callClaudeAudit(claudeApiKey, claudeModel, snapshot);
          if (liveReport) {
            return res.status(200).json({
              success: true,
              providerUsed: 'claude',
              modelName: claudeModel,
              report: liveReport,
              source: 'vercel_serverless'
            } as AIResponsePayload);
          }
        } catch (err) {
          console.warn('Claude live audit failed, using deterministic audit engine:', err);
        }
      }

      // High-fidelity deterministic audit fallback
      const report = runDeterministicOperationsAudit(snapshot, 'claude');
      return res.status(200).json({
        success: true,
        providerUsed: 'claude',
        modelName: report.modelName,
        report,
        source: 'local_deterministic'
      } as AIResponsePayload);
    }

    return res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
  } catch (error: any) {
    console.error('API Error in /api/ai:', error);
    const fallbackReport = runDeterministicOperationsAudit(snapshot, 'claude');
    return res.status(200).json({
      success: true,
      providerUsed: 'claude',
      modelName: 'Claude 3.5 Sonnet (Fallback Engine)',
      report: fallbackReport,
      source: 'local_deterministic',
      error: error.message || 'Internal AI service error'
    } as AIResponsePayload);
  }
}

// ---------------------------------------------------------------------------
// External API Caller (Anthropic Claude)
// ---------------------------------------------------------------------------

async function callClaudeAudit(apiKey: string, model: string, snapshot: any): Promise<AIAnalysisReport | null> {
  const url = 'https://api.anthropic.com/v1/messages';

  const systemInstruction = `You are an elite Operations & Supply Chain Director auditing Iyanuoluwa Vegetable & Palm Oil Depot in Lagos, Nigeria.
Analyze the depot operational data. Respond ONLY with a valid JSON object matching the audit report structure with depotHealthScore, healthVerdict, executiveSummary, keyFindings, actionableDecisions, inventoryForecasts, and lossPreventionItems. Do not add markdown backticks.`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.2,
      system: systemInstruction,
      messages: [
        {
          role: 'user',
          content: `Here is the depot data snapshot:\n${JSON.stringify(snapshot, null, 2)}`
        }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`Claude HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) return null;

  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

async function callClaudeChat(apiKey: string, model: string, question: string, snapshot: any): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      temperature: 0.3,
      system: `You are the executive AI Operations & Market Intelligence Copilot for Alhaja / Managing Director of Iyanuoluwa Vegetable & Palm Oil Depot in Lagos, Nigeria.
You analyze internal depot telemetry (tanks, flowmeters, debit balances, cash reconciliations) and provide authoritative answers in Naira.
In addition, you serve as a live business research assistant for external market intelligence:
- Current wholesale vegetable & palm oil prices in Lagos (Mile 12, Daleko, Trade Fair, Bodija)
- Benchmark Crude Palm Oil (CPO) rates (Bursa Malaysia, domestic mill gate in Edo/Ondo/Delta)
- Diesel (AGO) fuel prices and haulage freight rates per metric ton
- ECOWAS trade tariffs (35% refined oil duty/levy), FX rates, and import factors.
Always use "debit" instead of "credit" for customer receivables. Provide structured, executive-level answers with bold numbers and bullet points.`,
      messages: [
        {
          role: 'user',
          content: `Depot Snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nQuestion: "${question}"`
        }
      ]
    })
  });

  if (!res.ok) throw new Error(`Claude Chat HTTP ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}
