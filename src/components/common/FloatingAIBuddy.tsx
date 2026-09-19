import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../services/store';
import { useToast } from '../../services/toast';
import { extractSystemSnapshot } from '../../services/ai/dataExtractor';
import { askOperationsQuestion, requestOperationsAudit } from '../../services/ai/aiService';
import { AIChatMessage } from '../../services/ai/types';
import { ClaudeLogo } from './ClaudeLogo';
import {
  X,
  PaperPlaneTilt as Send,
  Globe,
  ArrowsClockwise as RefreshCw,
  TrendUp,
  Receipt,
  GasPump,
  Drop
} from '@phosphor-icons/react';

interface FloatingAIBuddyProps {
  onNavigate?: (tab: string) => void;
}

const QUICK_PROMPTS = [
  { label: 'Market Prices', icon: TrendUp, query: 'Search internet for current wholesale vegetable oil and palm oil prices in Lagos (Mile 12, Daleko)' },
  { label: 'Who owes money?', icon: Receipt, query: 'Who are our top debtors right now, how much do they owe, and who is overdue?' },
  { label: 'Pump Leaks?', icon: GasPump, query: 'Audit our pump meters: is there any pump leakage or unmetered oil dispensed today?' },
  { label: 'Oil Runway', icon: Drop, query: 'How many days of golden vegetable oil and palm oil stock do we have left before running dry?' },
  { label: 'Search Web: Logistics', icon: Globe, query: 'Search internet for current diesel price in Nigeria and its impact on oil tanker freight to Lagos' }
];

export const FloatingAIBuddy: React.FC<FloatingAIBuddyProps> = ({ onNavigate }) => {
  const store = useStore();
  const { userRole } = store;

  // Only visible to the owner / admin
  if (userRole !== 'owner') return null;

  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello Alhaja! I am your **Claude Operations Buddy**.\n\nI monitor your yard tanks, pump flowmeters, and debtor accounts — and I can also **search the internet** for current Nigerian market prices, diesel costs, and commodity trends.\n\nHow can I help you right now?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      provider: 'claude'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [searchWebActive, setSearchWebActive] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const getSnapshot = () => {
    return extractSystemSnapshot({
      tanks: store.tanks,
      products: store.products,
      suppliers: store.suppliers,
      orders: store.orders,
      customers: store.customers,
      customerStatsMap: store.customerStatsMap,
      kegInventory: store.kegInventory,
      todayStats: store.todayStats,
      activeAlerts: store.activeAlerts,
      pumpVarianceAudits: store.pumpVarianceAudits,
      shifts: store.shifts,
      settings: store.settings
    });
  };

  const handleSend = async (queryText?: string) => {
    const text = (queryText || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const snapshot = getSnapshot();
      const reply = await askOperationsQuestion(text, snapshot, {
        userRole: 'owner'
      });

      const botMessage: AIChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'claude'
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('Floating buddy error:', err);
      const errorMessage: AIChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: 'I encountered a brief connection error. However, your depot local data is safe. Please ask again or check your internet.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'claude'
      };
      setMessages(prev => [...prev, errorMessage]);
      showToast('error', 'AI Buddy hit a connection error. Please ask again or check your internet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunQuickAudit = async () => {
    setIsAuditing(true);
    const userMessage: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: 'Run a quick operational health check on our depot.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const snapshot = getSnapshot();
      const report = await requestOperationsAudit(snapshot, { userRole: 'owner' });

      const auditSummary = `**Depot Health Score: ${report.depotHealthScore}/100 (${report.healthVerdict.toUpperCase()})**\n\n` +
        `**Executive Summary:**\n${report.executiveSummary}\n\n` +
        `**Top Recommended Actions:**\n` +
        report.actionableDecisions.slice(0, 3).map((d, i) => `${i + 1}. **[${d.priority}]** ${d.action} (${d.impactDescription})`).join('\n') +
        `\n\n*Click "Open Advisor" for full financial forensics.*`;

      const botMessage: AIChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: auditSummary,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'claude'
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('Audit failed:', err);
      showToast('error', 'Depot health audit failed. Please try again.');
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <>
      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-5 sm:right-6 z-50 w-[350px] sm:w-[400px] h-[540px] max-h-[calc(100vh-7rem)] rounded-[28px] bg-white dark:bg-[#1a1916] text-slate-900 dark:text-stone-100 border border-slate-200 dark:border-stone-800 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200 select-none">
          {/* Header */}
          <div className="p-3.5 bg-slate-50/90 dark:bg-[#23211d] border-b border-slate-200 dark:border-stone-800/80 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#d97757]/15 border border-[#d97757]/30 text-[#d97757] flex items-center justify-center flex-shrink-0 shadow-sm">
                <ClaudeLogo size={18} color="#d97757" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-bold text-xs text-slate-900 dark:text-white truncate">
                    Claude AI Buddy
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Online
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-stone-400 flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Depot & Internet Market Intelligence</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleRunQuickAudit}
                disabled={isAuditing}
                className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                title="Run instant 10-second depot audit"
              >
                <RefreshCw className={`w-3 h-3 ${isAuditing ? 'animate-spin' : ''}`} />
                <span>Audit</span>
              </button>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => { onNavigate('ai-advisor'); setIsOpen(false); }}
                  className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-stone-800 hover:bg-slate-300 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-300 text-[10px] font-bold transition-all"
                  title="Open full AI Advisor screen"
                >
                  Full Hub
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-stone-800 border border-slate-200 dark:border-stone-700 text-slate-500 hover:text-slate-900 dark:text-stone-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-stone-700 transition-colors"
                title="Minimize chat buddy"
                aria-label="Minimize"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompts Strip */}
          <div className="px-3 py-2 bg-slate-100/70 dark:bg-[#1c1b18] border-b border-slate-200/80 dark:border-stone-800/60 overflow-x-auto flex items-center gap-1.5 flex-shrink-0 custom-scrollbar">
            {QUICK_PROMPTS.map((p, i) => {
              const Icon = p.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(p.query)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-full bg-white dark:bg-stone-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200 dark:border-stone-700 text-[10.5px] font-medium transition-all whitespace-nowrap flex items-center gap-1 flex-shrink-0 shadow-2xs"
                >
                  <Icon className="w-3 h-3 text-amber-500" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-sans text-xs custom-scrollbar">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-amber-500 text-slate-950 font-medium rounded-br-xs shadow-sm'
                      : 'bg-slate-100 dark:bg-[#25231f] text-slate-800 dark:text-stone-200 border border-slate-200 dark:border-stone-800/80 rounded-bl-xs leading-relaxed whitespace-pre-wrap'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-slate-400 dark:text-stone-500 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-stone-400 p-2 rounded-xl bg-slate-50 dark:bg-stone-900/50">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span className="animate-pulse">Claude is researching market and depot records...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <form
            onSubmit={e => { e.preventDefault(); handleSend(); }}
            className="p-3 bg-slate-50 dark:bg-[#23211d] border-t border-slate-200 dark:border-stone-800/80 flex flex-col gap-2 flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Ask about depot records or search market prices..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-[#181816] text-slate-900 dark:text-stone-100 border border-slate-300 dark:border-stone-700 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 transition-all disabled:opacity-40 shadow-sm flex-shrink-0"
                title="Send question"
              >
                <Send className="w-4 h-4" weight="bold" />
              </button>
            </div>

            {/* Status Footer */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-stone-500 px-1">
              <button
                type="button"
                onClick={() => setSearchWebActive(prev => !prev)}
                className="flex items-center gap-1 text-slate-500 dark:text-stone-400 hover:text-amber-500 transition-colors"
              >
                <Globe className={`w-3 h-3 ${searchWebActive ? 'text-amber-500' : ''}`} />
                <span>{searchWebActive ? 'Live Market Search: Active' : 'Offline Depot Only'}</span>
              </button>
              <span>Anthropic Claude 3.5</span>
            </div>
          </form>
        </div>
      )}

      {/* Floating Circular Trigger Button */}
      <div className="fixed bottom-5 right-5 z-50 select-none">
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={`relative group flex items-center justify-center rounded-full transition-all duration-300 shadow-2xl focus:outline-none ${
            isOpen
              ? 'w-12 h-12 bg-slate-900 dark:bg-stone-800 text-white ring-2 ring-slate-700'
              : 'w-14 h-14 bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 text-slate-950 hover:scale-105 active:scale-95 ring-4 ring-amber-500/25 shadow-amber-500/30'
          }`}
          title={isOpen ? 'Minimize Claude AI Buddy' : 'Open Claude AI Operations & Market Buddy'}
          aria-label="Claude AI Buddy"
        >
          {isOpen ? (
            <X className="w-5 h-5" weight="bold" />
          ) : (
            <>
              <ClaudeLogo size={28} color="#141413" className="group-hover:scale-110 transition-transform" />
              {/* Online pulsing indicator dot */}
              <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-stone-900" />
              </span>
            </>
          )}
        </button>
      </div>
    </>
  );
};
