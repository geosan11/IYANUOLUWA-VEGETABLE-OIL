/**
 * Vercel Serverless Function: /api/ai
 * 
 * Secure serverless endpoint for Iyanuoluwa Depot AI Operations Intelligence.
 * Keeps GEMINI_API_KEY and ANTHROPIC_API_KEY securely on the Vercel server.
 * Never exposes secrets to the browser.
 */

import { runDeterministicOperationsAudit, answerCopilotQuestionDeterministic } from '../src/services/ai/deterministicEngine';
import { AIRequestPayload, AIResponsePayload, AIAnalysisReport } from '../src/services/ai/types';

export default async function handler(req: any, res: any) {
  // 1. CORS & Preflight handling
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-User-Role'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. POST required.' });
  }

  // 2. Strict Security: Verify Admin / Owner role
  const userRole = req.headers['x-user-role'] || req.body?.userRole;
  if (userRole !== 'owner') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: AI Operations Intelligence is restricted to the Managing Director / Owner role.',
      source: 'vercel_serverless'
    });
  }

  const payload: AIRequestPayload = req.body;
  const { action, provider = 'gemini', geminiModel = 'gemini-1.5-flash', claudeModel = 'claude-3-5-sonnet-20241022', snapshot, chatMessage } = payload;

  if (!snapshot) {
    return res.status(400).json({ success: false, error: 'Missing system snapshot payload.' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const claudeApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  try {
    // -------------------------------------------------------------------------
    // ACTION: CHAT / COPILOT QUESTION
    // -------------------------------------------------------------------------
    if (action === 'chat') {
      const question = chatMessage || 'Give me an operations overview';

      // 1. Attempt Gemini if requested
      if ((provider === 'gemini' || provider === 'both') && geminiApiKey) {
        try {
          const geminiResponse = await callGeminiChat(geminiApiKey, geminiModel, question, snapshot);
          if (geminiResponse) {
            return res.status(200).json({
              success: true,
              providerUsed: 'gemini',
              modelName: geminiModel,
              chatReply: geminiResponse,
              source: 'vercel_serverless'
            } as AIResponsePayload);
          }
        } catch (err) {
          console.warn('Gemini chat failed, falling back to deterministic:', err);
        }
      }

      // 2. Attempt Claude if requested
      if ((provider === 'claude' || provider === 'both') && claudeApiKey) {
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
        providerUsed: provider,
        modelName: `${provider} (Offline/Simulated Engine)`,
        chatReply: fallbackReply,
        source: 'local_deterministic'
      } as AIResponsePayload);
    }

    // -------------------------------------------------------------------------
    // ACTION: AUDIT / STRATEGIC REPORT
    // -------------------------------------------------------------------------
    if (action === 'audit') {
      // If live Gemini key is present and provider is gemini or both
      if ((provider === 'gemini' || provider === 'both') && geminiApiKey) {
        try {
          const liveReport = await callGeminiAudit(geminiApiKey, geminiModel, snapshot);
          if (liveReport) {
            return res.status(200).json({
              success: true,
              providerUsed: 'gemini',
              modelName: geminiModel,
              report: liveReport,
              source: 'vercel_serverless'
            } as AIResponsePayload);
          }
        } catch (err) {
          console.warn('Gemini live audit failed, using deterministic audit engine:', err);
        }
      }

      // If live Claude key is present and provider is claude
      if ((provider === 'claude' || provider === 'both') && claudeApiKey) {
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
      const report = runDeterministicOperationsAudit(snapshot, provider);
      return res.status(200).json({
        success: true,
        providerUsed: provider,
        modelName: report.modelName,
        report,
        source: 'local_deterministic'
      } as AIResponsePayload);
    }

    return res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
  } catch (error: any) {
    console.error('API Error in /api/ai:', error);
    const fallbackReport = runDeterministicOperationsAudit(snapshot, provider);
    return res.status(200).json({
      success: true,
      providerUsed: provider,
      modelName: `${provider} (Fallback Engine)`,
      report: fallbackReport,
      source: 'local_deterministic',
      error: error.message || 'Internal AI service error'
    } as AIResponsePayload);
  }
}

// ---------------------------------------------------------------------------
// External API Callers (Google Gemini & Anthropic Claude)
// ---------------------------------------------------------------------------

async function callGeminiAudit(apiKey: string, model: string, snapshot: any): Promise<AIAnalysisReport | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstruction = `You are an elite Operations & Supply Chain Director and Forensic Accountant auditing Iyanuoluwa Vegetable & Palm Oil Depot in Lagos, Nigeria.
Analyze the provided snapshot of tanks, customer debts, keg fleets, pump variances, and deliveries.
Respond ONLY with a valid JSON object strictly matching this schema:
{
  "id": "audit-gemini",
  "timestamp": "${new Date().toISOString()}",
  "providerUsed": "gemini",
  "modelName": "${model}",
  "depotHealthScore": <number 0-100>,
  "healthVerdict": <"critical" | "attention_needed" | "good" | "optimal">,
  "executiveSummary": <string summary for Managing Director>,
  "keyFindings": [
    { "title": <string>, "detail": <string>, "severity": <"critical"|"warning"|"info"|"positive">, "metric": <optional string> }
  ],
  "actionableDecisions": [
    { "id": <string>, "category": <"inventory"|"pricing"|"credit"|"loss_prevention"|"operations">, "priority": <"P1 - Immediate"|"P2 - This Week"|"P3 - Strategic">, "action": <string>, "rationale": <string>, "expectedFinancialImpactNaira": <number>, "impactDescription": <string>, "ownerActionRole": <"Managing Director"|"Depot Cashier"|"Driver / Yardman"> }
  ],
  "inventoryForecasts": [
    { "productName": <string>, "currentStockL": <number>, "burnRatePerDayL": <number>, "estimatedDaysLeft": <number>, "reorderRecommendation": <string>, "criticalWarning": <boolean> }
  ],
  "lossPreventionItems": [
    { "source": <"pumps"|"intake"|"cash_drawer">, "description": <string>, "lossAmount": <string>, "urgency": <"high"|"medium"|"low"> }
  ]
}`;

  const prompt = `Here is the current depot operational data snapshot:\n${JSON.stringify(snapshot, null, 2)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\n${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  return JSON.parse(text);
}

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

async function callGeminiChat(apiKey: string, model: string, question: string, snapshot: any): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are the executive AI Operations Copilot for the Managing Director of Iyanuoluwa Vegetable & Palm Oil Depot in Lagos, Nigeria.
Depot Snapshot:
${JSON.stringify(snapshot, null, 2)}

Question from Managing Director:
"${question}"

Provide a concise, direct, professional answer citing actual numbers, names, and concrete business decisions. Use Nigerian Naira (₦).`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 }
    })
  });

  if (!res.ok) throw new Error(`Gemini Chat HTTP ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
      system: 'You are the executive AI Operations Copilot for the Managing Director of Iyanuoluwa Vegetable & Palm Oil Depot in Lagos. Answer concisely with real numbers and actionable advice in Naira.',
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
