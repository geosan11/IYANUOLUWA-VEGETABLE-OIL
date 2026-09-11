import React from 'react';
import { useStore } from '../../services/store';
import { UserRole } from '../../types';
import { NAV_ITEMS } from '../../constants/nav';
import {
  Warning,
  User,
  ShieldCheck,
  CaretRight,
  Drop,
  Sun,
  Moon
} from '@phosphor-icons/react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { settings, userRole, setUserRole, activeAlerts, theme, toggleTheme } = useStore();

  const overdueCount = activeAlerts.overdueCredit.length;
  const navItems = NAV_ITEMS
    .filter(item => !item.adminOnly || userRole === 'owner')
    .map(item => ({
      ...item,
      badge: item.id === 'customers' && overdueCount > 0 ? overdueCount : null
    }));

  return (
    <aside className="hidden split:flex flex-col w-[72px] hover:w-72 group bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 h-screen select-none flex-shrink-0 z-40 transition-all duration-300 ease-in-out shadow-sm overflow-x-hidden overflow-y-auto">
      {/* Brand Header */}
      <div className="h-16 px-3.5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between overflow-hidden flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {settings.company_logo_url ? (
            <img
              src={settings.company_logo_url}
              alt="Logo"
              className="w-10 h-10 object-contain rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 p-1 shadow-sm flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-brand-500/20 flex-shrink-0">
              <Drop className="w-5 h-5 text-slate-950" weight="fill" />
            </div>
          )}
          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
            <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white uppercase">
              IYANUOLUWA
            </span>
            <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              Digital Operations
            </span>
          </div>
        </div>

        {/* Quick theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
          title={theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" weight="bold" /> : <Moon className="w-4 h-4 text-slate-600" weight="bold" />}
        </button>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
        <div className="px-2 pb-1.5 text-[11px] font-sans font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          Core Operations
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={item.label}
              className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded-xl font-sans text-[14px] transition-all duration-150 relative overflow-hidden group/btn ${
                isActive
                  ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300 font-bold border border-brand-500/30 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/80 font-medium'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <Icon
                    className={`w-6 h-6 transition-transform group-hover/btn:scale-105 ${
                      isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-400'
                    }`}
                    weight={isActive ? 'bold' : 'thin'}
                  />
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap font-medium">
                  {item.label}
                </span>
              </div>

              {/* Badge indicator */}
              {item.badge !== null && item.badge > 0 && (
                <>
                  {/* Expanded Badge */}
                  <span className="hidden group-hover:inline-flex px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30">
                    {item.badge}
                  </span>
                  {/* Collapsed Badge Dot */}
                  <span className="group-hover:hidden absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500" />
                </>
              )}
            </button>
          );
        })}

        {/* Operational Alert Summary Banner in Sidebar */}
        {activeAlerts.totalAlertCount > 0 && (
          <div className="pt-3">
            {/* Collapsed Alert Icon Pill */}
            <button
              type="button"
              onClick={() => onTabChange('dashboard')}
              className="group-hover:hidden w-full flex items-center justify-center p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 cursor-pointer shadow-sm relative"
              title={`Depot Alerts (${activeAlerts.totalAlertCount})`}
            >
              <Warning className="w-5 h-5 animate-pulse" weight="bold" />
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[11px] font-mono font-bold">
                {activeAlerts.totalAlertCount}
              </span>
            </button>

            {/* Expanded Alert Card */}
            <button
              type="button"
              onClick={() => onTabChange('dashboard')}
              className="hidden group-hover:block w-full text-left cursor-pointer p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100/80 dark:hover:bg-rose-950/60 transition-colors shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between text-[12px] font-sans font-semibold text-rose-800 dark:text-rose-300 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Warning className="w-4 h-4 text-rose-600 dark:text-rose-400 animate-pulse flex-shrink-0" weight="bold" />
                  <span>Depot Alerts ({activeAlerts.totalAlertCount})</span>
                </div>
                <CaretRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              </div>
              <div className="mt-2 space-y-1 text-[11px] font-sans text-rose-700/90 dark:text-rose-200/80">
                {activeAlerts.overdueCredit.length > 0 && (
                  <div className="flex justify-between">
                    <span>Overdue Invoices:</span>
                    <span className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                      {activeAlerts.overdueCredit.length}
                    </span>
                  </div>
                )}
                {activeAlerts.overLimit.length > 0 && (
                  <div className="flex justify-between">
                    <span>Credit Breaches:</span>
                    <span className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                      {activeAlerts.overLimit.length}
                    </span>
                  </div>
                )}
                {activeAlerts.deliveryShortfall.length > 0 && (
                  <div className="flex justify-between">
                    <span>Tank Shortfalls:</span>
                    <span className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                      {activeAlerts.deliveryShortfall.length}
                    </span>
                  </div>
                )}
                {activeAlerts.pumpVariance && activeAlerts.pumpVariance.length > 0 && (
                  <div className="flex justify-between">
                    <span>Pump Variance:</span>
                    <span className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                      {activeAlerts.pumpVariance.length}
                    </span>
                  </div>
                )}
              </div>
            </button>
          </div>
        )}
      </nav>

      {/* User Card & Role Switcher */}
      <div className="p-2.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 flex-shrink-0 overflow-hidden">
        {/* Collapsed Avatar Icon */}
        <div className="group-hover:hidden flex items-center justify-center p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-brand-600 dark:text-brand-400">
          <User className="w-5 h-5" />
        </div>

        {/* Expanded User Profile Box */}
        <div className="hidden group-hover:block p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-brand-600 dark:text-brand-400 flex-shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-sans font-bold text-slate-800 dark:text-slate-200 truncate">
                {userRole === 'owner' ? 'Alhaja / Owner' : userRole === 'staff' ? 'Counter Staff' : 'Driver / Operator'}
              </div>
              <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400 capitalize flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                <span className="truncate">{userRole} Access</span>
              </div>
            </div>
          </div>

          {/* Quick Role Switcher */}
          <div className="grid grid-cols-3 gap-1 pt-1 text-[11px] font-sans font-medium">
            {(['owner', 'staff', 'driver'] as UserRole[]).map(role => (
              <button
                key={role}
                onClick={() => setUserRole(role)}
                className={`py-1 rounded-md capitalize text-center transition-all ${
                  userRole === role
                    ? 'bg-brand-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
