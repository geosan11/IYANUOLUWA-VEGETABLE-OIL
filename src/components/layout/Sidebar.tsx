import React from 'react';
import { useStore } from '../../services/store';
import { getVisibleNavItems } from '../../constants/nav';
import {
  Warning,
  CaretRight,
  Sun,
  Moon
} from '@phosphor-icons/react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const DAILY_WORK_IDS = ['order', 'intake', 'pumps', 'kegs', 'customers'];
const BILLING_IDS = ['ledger', 'inventory', 'expenses', 'dashboard', 'ai-advisor', 'settings'];

const LABEL_OVERRIDES: Record<string, string> = {
  order: 'New Sale',
  intake: 'Truck Intake',
  pumps: 'Pumps',
  kegs: 'Kegs Ledger',
  customers: 'Customers & Debt',
  ledger: 'Transaction ledger',
  inventory: 'Products & pricing',
  expenses: 'Expenses & float',
  dashboard: 'Dashboard',
  'ai-advisor': 'AI Advisor',
  settings: 'Settings'
};

/**
 * Hover-to-expand: always rendered narrow (icons only); hovering the panel
 * grows it over the content via CSS (`group-hover`), no click toggle needed.
 */
export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { settings, userRole, activeAlerts, theme, toggleTheme, currentUser, activeHub } = useStore();

  const overdueCount = activeAlerts.overdueCredit.length;

  const accessibleNavItems = getVisibleNavItems(userRole, currentUser.allowed_screens)
    .map(item => ({
      ...item,
      label: LABEL_OVERRIDES[item.id] || item.label,
      badge: item.id === 'customers' && overdueCount > 0 ? overdueCount : null
    }));

  const dailyWorkItems = accessibleNavItems.filter(item => DAILY_WORK_IDS.includes(item.id));
  const billingItems = accessibleNavItems.filter(item => BILLING_IDS.includes(item.id));

  const hubDisplay = activeHub
    ? `${activeHub.name} · ${activeHub.state || 'LOS'}`
    : 'Alaba Central · LOS';

  const renderNavItem = (item: typeof accessibleNavItems[0]) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.id)}
        title={item.label}
        className={`w-full flex items-center justify-center group-hover:justify-between rounded-2xl transition-all duration-150 text-[13.5px] py-3 px-2 group-hover:px-3.5 group-hover:py-2.5 group/btn ${
          isActive
            ? 'bg-[#382f1d] text-[#f59e0b] font-semibold border border-amber-500/25 shadow-sm'
            : 'text-stone-300 hover:text-white hover:bg-stone-800/50 border border-transparent font-medium'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon
            className={`w-[22px] h-[22px] flex-shrink-0 transition-transform group-hover/btn:scale-110 ${
              isActive ? 'text-amber-400' : 'text-stone-400 group-hover/btn:text-stone-200'
            }`}
            weight={isActive ? 'bold' : 'regular'}
          />
          <span className="truncate whitespace-nowrap hidden group-hover:inline">
            {item.label}
          </span>
        </div>

        {item.badge !== null && item.badge > 0 && (
          <span className="hidden group-hover:inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="hidden split:block relative flex-shrink-0 z-40 select-none">
      {/* Spacer so the main content reserves the narrow, resting width */}
      <div className="w-[104px]" />

      {/* Floating sidebar panel — expands over content on hover */}
      <aside className="absolute top-0 left-0 h-screen p-3 z-50 flex flex-col w-[104px] hover:w-[280px] hover:shadow-2xl transition-all duration-300 ease-in-out group">
        <div className="h-full w-full bg-[#1c1b18] text-stone-200 rounded-[28px] border border-stone-800/90 shadow-2xl flex flex-col justify-between overflow-hidden p-3 backdrop-blur-md">
          {/* Top Brand Card */}
          <div className="p-2.5 rounded-2xl bg-[#25231f] border border-stone-800/80 mb-2 flex-shrink-0 overflow-hidden transition-all duration-200">
            <div className="flex items-center justify-center group-hover:justify-start gap-3">
              {/* Circular Avatar */}
              <div className="w-9 h-9 rounded-full bg-amber-400 text-stone-950 font-black text-sm flex items-center justify-center flex-shrink-0 shadow-md">
                IO
              </div>

              {/* Title & Subtitle */}
              <div className="min-w-0 flex-1 hidden group-hover:block transition-opacity duration-200">
                <div className="font-bold text-sm tracking-tight text-white truncate">
                  {settings.company_name || 'Iyanuoluwa Oil'}
                </div>
                <div className="text-[11px] text-stone-400 truncate">
                  Vegetable Oil Depot
                </div>
              </div>
            </div>

            {/* Divider & Hub Location */}
            <div className="mt-2.5 pt-2 border-t border-stone-700/50 hidden group-hover:block transition-opacity duration-200">
              <div className="text-xs text-stone-300 flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
                <span className="truncate">{hubDisplay}</span>
              </div>
            </div>
          </div>

          {/* Nav List */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 py-1 no-scrollbar">
            {/* Daily work section */}
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-stone-400 uppercase hidden group-hover:block transition-opacity duration-200">
                Daily work
              </div>
              <div className="space-y-1 mt-1">
                {dailyWorkItems.map(item => renderNavItem(item))}
              </div>
            </div>

            {/* Billing section */}
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-stone-400 uppercase hidden group-hover:block transition-opacity duration-200">
                Billing
              </div>
              <div className="space-y-1 mt-1">
                {billingItems.map(item => renderNavItem(item))}
              </div>
            </div>

            {/* Depot Alerts summary if active */}
            {activeAlerts.totalAlertCount > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onTabChange('dashboard')}
                  className="w-full rounded-2xl bg-rose-950/40 border border-rose-800/50 hover:bg-rose-950/60 transition-colors text-xs text-rose-300 font-semibold p-2.5 flex items-center justify-center group-hover:justify-between"
                  title={`${activeAlerts.totalAlertCount} Depot Alerts`}
                >
                  <div className="flex items-center gap-2">
                    <Warning className="w-4 h-4 text-rose-400 animate-pulse flex-shrink-0" weight="bold" />
                    <span className="hidden group-hover:inline">
                      {activeAlerts.totalAlertCount} Depot Alerts
                    </span>
                  </div>
                  <CaretRight className="hidden group-hover:inline w-3.5 h-3.5 text-rose-400" />
                </button>
              </div>
            )}
          </nav>

          {/* Bottom Controls */}
          <div className="pt-2 border-t border-stone-800/80 space-y-2 flex-shrink-0">
            {/* Quick user status & theme toggle */}
            <div className="items-center justify-between px-3 py-0.5 text-xs text-stone-400 hidden group-hover:flex">
              <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="truncate text-[11px] text-stone-300 font-medium">
                  {currentUser.full_name.split(' ')[0]} ({currentUser.role.replace('_', ' ')})
                </span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800/70 transition-colors flex-shrink-0"
                title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" weight="bold" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-stone-300" weight="bold" />
                )}
              </button>
            </div>

            {/* Version Pill */}
            <div className="rounded-2xl bg-[#25231f] border border-stone-800/70 px-2 group-hover:px-3.5 py-2.5 flex items-center justify-center group-hover:justify-between text-xs">
              <span className="text-stone-400 font-medium hidden group-hover:inline">
                Version
              </span>
              <span className="text-amber-400 font-mono font-semibold text-[11px]">
                1.1.0
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
