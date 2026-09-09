import React from 'react';
import { useStore } from '../../services/store';
import {
  LayoutDashboard,
  Truck,
  PlusCircle,
  Users,
  Package,
  ReceiptText,
  Settings,
  X,
  Sun,
  Moon,
  Sparkles
} from 'lucide-react';

interface MobileNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isMenuOpen: boolean;
  onCloseMenu: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onTabChange,
  isMenuOpen,
  onCloseMenu
}) => {
  const { activeAlerts, userRole, setUserRole, theme, toggleTheme } = useStore();

  const primaryNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'intake', label: 'Intake', icon: Truck },
    { id: 'order', label: 'New Sale', icon: PlusCircle, isMain: true },
    { id: 'customers', label: 'Customers', icon: Users, badge: activeAlerts.overdueCredit.length },
    { id: 'kegs', label: 'Kegs', icon: Package }
  ];

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(userRole === 'owner' ? [{ id: 'ai-advisor', label: 'AI Operations Advisor', icon: Sparkles }] : []),
    { id: 'intake', label: 'Truck Intake', icon: Truck },
    { id: 'order', label: 'New Sale', icon: PlusCircle },
    { id: 'customers', label: 'Customers & Credit', icon: Users, badge: activeAlerts.overdueCredit.length },
    { id: 'kegs', label: 'Kegs Ledger', icon: Package },
    { id: 'expenses', label: 'Expenses & Float', icon: ReceiptText },
    { id: 'settings', label: 'Settings & Branding', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Drawer (When hamburger is clicked) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={onCloseMenu}
          />
          <div className="relative w-4/5 max-w-xs bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col h-full z-10 animate-in slide-in-from-left duration-200 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <span className="font-heading font-bold text-[16px] text-slate-900 dark:text-white uppercase tracking-wider">
                Menu & Modules
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
                </button>
                <button
                  onClick={onCloseMenu}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 py-4 space-y-1.5 overflow-y-auto">
              {allNavItems.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      onCloseMenu();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-sans text-[13px] ${
                      isActive
                        ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300 font-bold border border-brand-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Role switch in mobile drawer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[11px] uppercase font-sans font-bold text-slate-500 dark:text-slate-400 mb-2">
                Active User Role: <span className="text-brand-600 dark:text-brand-400 capitalize">{userRole}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                {(['owner', 'staff', 'driver'] as const).map(role => (
                  <button
                    key={role}
                    onClick={() => setUserRole(role)}
                    className={`py-1.5 rounded-lg capitalize font-sans font-medium ${
                      userRole === role
                        ? 'bg-brand-500 text-slate-950 font-bold'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800/80 px-2 flex items-center justify-around z-30 select-none shadow-lg">
        {primaryNavItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          if (item.isMain) {
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <div className="w-12 h-12 rounded-full bg-brand-500 text-slate-950 flex items-center justify-center shadow-lg shadow-brand-500/30 border-2 border-white dark:border-slate-950 active:scale-95 transition-transform">
                  <Icon className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-sans font-bold text-brand-600 dark:text-brand-400 mt-0.5">Dispense</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 relative ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {item.badge ? (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[11px] font-mono tabular-nums font-bold flex items-center justify-center min-w-[18px]">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[11px] font-sans mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};
