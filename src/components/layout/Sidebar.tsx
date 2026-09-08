import React from 'react';
import { useStore } from '../../services/store';
import { UserRole } from '../../types';
import {
  LayoutDashboard,
  Truck,
  PlusCircle,
  Users,
  Package,
  ReceiptText,
  Settings,
  AlertTriangle,
  User,
  ShieldCheck,
  ChevronRight,
  Droplets
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { settings, userRole, setUserRole, activeAlerts } = useStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'intake', label: 'Truck Intake', icon: Truck, badge: null },
    { id: 'order', label: 'New Order', icon: PlusCircle, badge: null },
    { id: 'customers', label: 'Customers', icon: Users, badge: activeAlerts.overdueCredit.length > 0 ? activeAlerts.overdueCredit.length : null },
    { id: 'kegs', label: 'Kegs Ledger', icon: Package, badge: null },
    { id: 'expenses', label: 'Expenses', icon: ReceiptText, badge: null },
    { id: 'settings', label: 'Settings', icon: Settings, badge: null },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-slate-950 border-r border-slate-800/80 h-screen select-none flex-shrink-0 z-30">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80 flex items-center gap-3.5">
        {settings.company_logo_url ? (
          <img
            src={settings.company_logo_url}
            alt="Logo"
            className="w-10 h-10 object-contain rounded-xl bg-slate-900 border border-slate-700/80 p-1"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-brand-500/20">
            <Droplets className="w-5 h-5 text-slate-950 fill-current" />
          </div>
        )}
        <div className="flex flex-col">
          <span className="font-black text-sm tracking-tight text-white uppercase">
            IYANUOLUWA
          </span>
          <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Digital Operations
          </span>
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Core Operations
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 ${
                isActive
                  ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-brand-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && item.badge > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Operational Alert Summary Banner in Sidebar */}
        {activeAlerts.totalAlertCount > 0 && (
          <div className="pt-4 px-1">
            <div
              onClick={() => onTabChange('dashboard')}
              className="cursor-pointer p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 hover:bg-rose-950/60 transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                  <span>Depot Alerts ({activeAlerts.totalAlertCount})</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-rose-200/80">
                {activeAlerts.overdueCredit.length > 0 && (
                  <div className="flex justify-between">
                    <span>Overdue Invoices:</span>
                    <span className="font-mono font-bold text-rose-300">
                      {activeAlerts.overdueCredit.length}
                    </span>
                  </div>
                )}
                {activeAlerts.overLimit.length > 0 && (
                  <div className="flex justify-between">
                    <span>Credit Breaches:</span>
                    <span className="font-mono font-bold text-amber-300">
                      {activeAlerts.overLimit.length}
                    </span>
                  </div>
                )}
                {activeAlerts.deliveryShortfall.length > 0 && (
                  <div className="flex justify-between">
                    <span>Tank Shortfalls:</span>
                    <span className="font-mono font-bold text-rose-300">
                      {activeAlerts.deliveryShortfall.length}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* User Card & Role Switcher */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/50">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400">
                <User className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">
                  {userRole === 'owner' ? 'Alhaja / Owner' : userRole === 'staff' ? 'Counter Staff' : 'Driver / Operator'}
                </div>
                <div className="text-[10px] text-slate-400 capitalize flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-brand-400" />
                  <span>{userRole} Access</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Role Switcher */}
          <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-medium">
            {(['owner', 'staff', 'driver'] as UserRole[]).map(role => (
              <button
                key={role}
                onClick={() => setUserRole(role)}
                className={`py-1 rounded-md capitalize text-center transition-all ${
                  userRole === role
                    ? 'bg-brand-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
