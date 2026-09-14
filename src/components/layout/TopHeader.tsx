import React, { useState, useEffect } from 'react';
import { useStore } from '../../services/store';
import { PlusCircle, Drop, Package, List, Sun, Moon, CaretDown, Buildings, Check } from '@phosphor-icons/react';
import { NAV_ITEMS } from '../../constants/nav';

interface TopHeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onMobileMenuOpen?: () => void;
  /** Counter-staff mode: show a screen-switcher dropdown in place of the sidebar. */
  showScreenSwitcher?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  onTabChange,
  onMobileMenuOpen,
  showScreenSwitcher = false
}) => {
  const {
    tanks,
    kegInventory,
    settings,
    theme,
    toggleTheme,
    activeShift,
    userRole,
    hubs,
    users,
    currentUser,
    setCurrentUser,
    activeHubId,
    setActiveHubId,
    activeHub
  } = useStore();
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [hubMenuOpen, setHubMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime(
        now.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalDepotLitres = tanks.reduce((sum, t) => sum + t.remaining_litres, 0);


  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md px-3 sm:px-5 lg:px-7 flex items-center justify-between gap-3 z-20 flex-shrink-0 select-none transition-colors duration-200">
      {/* Left: Mobile menu trigger / Screen switcher / Desktop Breadcrumbs */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-shrink-0">
        {/* Mobile menu button when sidebar is enabled on desktop */}
        {!showScreenSwitcher && (
          <button
            type="button"
            onClick={onMobileMenuOpen}
            className="split:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 flex-shrink-0"
            aria-label="Open menu"
          >
            <List className="w-5 h-5" />
          </button>
        )}

        {/* Counter-staff screen switcher (used in place of the sidebar) */}
        {showScreenSwitcher ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSwitcherOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={switcherOpen}
              className="flex items-center gap-2 sm:gap-2.5 h-10 bg-slate-900 dark:bg-slate-900 text-white pl-2 pr-3 rounded-xl text-xs font-bold tracking-wide shadow-sm border border-slate-800 dark:border-slate-800 hover:border-brand-500/50 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 flex-shrink-0"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-500 text-slate-950 font-extrabold text-xs shadow-sm flex-shrink-0">
                IO
              </span>
              <div className="text-left leading-tight min-w-0">
                <span className="block text-[9px] text-brand-400 uppercase font-black tracking-wider">
                  Iyanuoluwa Depot
                </span>
                <span className="block text-white text-xs font-bold truncate max-w-[120px] sm:max-w-[160px]">
                  {NAV_ITEMS.find(n => n.id === currentTab)?.label || currentTab}
                </span>
              </div>
              <CaretDown className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${switcherOpen ? 'rotate-180' : ''}`} />
            </button>

            {switcherOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} aria-hidden="true" />
                <div role="menu" className="absolute left-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1.5">Switch Screen</p>
                  {NAV_ITEMS.filter(item => !item.adminOnly || userRole === 'owner').map(item => {
                    const Icon = item.icon;
                    const active = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => { onTabChange(item.id); setSwitcherOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                          active
                            ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-4 h-4" weight={active ? 'bold' : 'thin'} />
                        <span>{item.label}</span>
                        {active && <span className="ml-auto text-[9px] bg-brand-500 text-slate-950 font-black px-1.5 py-0.5 rounded">ACTIVE</span>}
                      </button>
                    );
                  })}
                  {activeShift?.cashier_name && (
                    <p className="text-[10px] text-slate-400 px-3 pt-2 border-t border-slate-100 dark:border-slate-800 mt-1">
                      Shift Cashier: <span className="font-bold text-slate-700 dark:text-slate-200">{activeShift.cashier_name}</span>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* Sidebar Mode: Clean Breadcrumb & Title */
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile Logo Brand */}
            <div className="split:hidden flex items-center gap-2">
              {settings.company_logo_url ? (
                <img
                  src={settings.company_logo_url}
                  alt="Logo"
                  className="w-8 h-8 object-contain rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 p-0.5"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-slate-950 font-black text-xs">
                  IO
                </div>
              )}
              <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-tight">
                Iyanuoluwa
              </span>
            </div>

            {/* Desktop Single-Line Breadcrumb */}
            <div className="hidden split:flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
              <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                {activeHub?.name ? activeHub.name.replace(' Central Depot', '').replace(' Regional Depot', '').replace(' Industrial Hub', '') : 'Depot'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="font-heading font-bold text-[15px] text-slate-900 dark:text-white tracking-tight">
                {NAV_ITEMS.find(n => n.id === currentTab)?.label || 'Depot'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Center flex spacer */}
      <div className="flex-1 min-w-0" />

      {/* Right: Quick Stats, Hub Selector, User Profile, Theme, and Action Button */}
      <div className="flex items-center gap-2 sm:gap-2.5 lg:gap-3 flex-shrink-0">
        {/* Depot Oil Volume Pill (Single line, hidden on smaller screens) */}
        <div
          className="hidden xl:flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums whitespace-nowrap flex-shrink-0"
          title={`Total Depot Bulk Oil In Tanks: ${totalDepotLitres.toLocaleString()} Litres`}
        >
          <Drop className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" weight="fill" />
          <span className="text-slate-400 font-sans text-[11px]">Stock:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {totalDepotLitres.toLocaleString('en-US', { maximumFractionDigits: 0 })} L
          </span>
        </div>

        {/* Depot Kegs Pill (Single line, hidden on intermediate screens) */}
        <div
          className={`hidden 2xl:flex items-center gap-2 h-9 px-3 rounded-xl border text-xs font-mono tabular-nums whitespace-nowrap flex-shrink-0 ${
            kegInventory.isDepotStockCritical
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 animate-pulse'
              : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
          title={`Total Kegs In Yard Stock: ${kegInventory.kegsAtDepot}`}
        >
          <Package className={`w-3.5 h-3.5 flex-shrink-0 ${kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-blue-500'}`} weight="fill" />
          <span className="text-slate-400 font-sans text-[11px]">Kegs:</span>
          <span className={`font-bold ${kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
            {kegInventory.kegsAtDepot}
          </span>
        </div>

        {/* Hub Selector (Owner Switcher / Staff Badge) */}
        <div className="relative flex-shrink-0">
          {userRole === 'owner' ? (
            <div>
              <button
                type="button"
                onClick={() => setHubMenuOpen(o => !o)}
                className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold transition-all shadow-sm focus:outline-none whitespace-nowrap flex-shrink-0"
                title="Switch active depot or view all depots consolidated"
              >
                <Buildings className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" weight="bold" />
                <span className="max-w-[100px] sm:max-w-[160px] truncate">
                  {activeHubId === 'all'
                    ? '🌐 All Hubs'
                    : `${activeHub?.name.replace(' Central Depot', '').replace(' Regional Depot', '').replace(' Industrial Hub', '') || 'Hub'} (${activeHub?.state || 'Hub'})`}
                </span>
                <CaretDown className={`w-3 h-3 text-amber-600 dark:text-amber-400 transition-transform flex-shrink-0 ${hubMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {hubMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setHubMenuOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Depot Hub Selector (Owner)</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Filter tanks, shifts, pumps & sales per hub</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setActiveHubId('all'); setHubMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                        activeHubId === 'all'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🌐</span>
                        <div>
                          <div>All Hubs (Consolidated)</div>
                          <div className={`text-[10px] ${activeHubId === 'all' ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>Total company-wide records</div>
                        </div>
                      </div>
                      {activeHubId === 'all' && <Check className="w-4 h-4 font-bold" weight="bold" />}
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                    <div className="space-y-1">
                      {hubs.map(hub => {
                        const isSelected = activeHubId === hub.id;
                        return (
                          <button
                            key={hub.id}
                            type="button"
                            onClick={() => { setActiveHubId(hub.id); setHubMenuOpen(false); }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-brand-500 text-slate-950 shadow-sm'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate">{hub.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-extrabold ${isSelected ? 'bg-slate-950 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                                  {hub.code}
                                </span>
                              </div>
                              <div className={`text-[10px] font-normal truncate ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                                {hub.state} State · Mgr: {hub.manager_name}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 font-bold flex-shrink-0" weight="bold" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold whitespace-nowrap flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="font-bold text-slate-900 dark:text-white max-w-[90px] sm:max-w-[150px] truncate">
                {activeHub?.name || 'Local Depot'}
              </span>
              <span className="hidden sm:inline text-[10px] text-slate-400 font-mono">({activeHub?.state || 'Hub'})</span>
            </div>
          )}
        </div>

        {/* User Account Quick Switcher Pill */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setUserMenuOpen(o => !o)}
            className="flex items-center gap-2 h-9 p-1 sm:px-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0"
            title="Switch demo user profile"
          >
            <div className="w-6 h-6 rounded-lg bg-brand-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0">
              {currentUser.full_name.charAt(0)}
            </div>
            <div className="hidden lg:block text-left leading-tight min-w-0">
              <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[80px]">
                {currentUser.full_name.split(' ')[0]}
              </div>
              <div className="text-[8px] text-brand-600 dark:text-brand-400 uppercase font-black tracking-wider">
                {currentUser.role.replace('_', ' ')}
              </div>
            </div>
            <CaretDown className={`hidden sm:block w-3 h-3 text-slate-400 transition-transform flex-shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Switch User Account</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Test role & hub permissions across depots</p>
                </div>

                <div className="space-y-1">
                  {users.map(u => {
                    const isCurrent = currentUser.id === u.id;
                    const assignedHub = hubs.find(h => h.id === u.hub_id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setCurrentUser(u); setUserMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                          isCurrent
                            ? 'bg-brand-500 text-slate-950 shadow-sm'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{u.full_name}</span>
                          </div>
                          <div className={`text-[10px] font-normal truncate ${isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>
                            <span className="font-semibold uppercase text-[9px] mr-1">{u.role.replace('_', ' ')}</span>
                            {assignedHub ? `· 📍 ${assignedHub.name} (${assignedHub.state})` : '· 🌐 All Hubs'}
                          </div>
                        </div>
                        {isCurrent && <Check className="w-4 h-4 font-bold flex-shrink-0" weight="bold" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Live Date / Time Clock (Wide Desktop only) */}
        <div className="hidden 2xl:block text-right whitespace-nowrap flex-shrink-0">
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">{currentDateTime}</div>
        </div>

        {/* Theme Switcher Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors flex-shrink-0"
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" weight="bold" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" weight="bold" />
          )}
        </button>

        {/* Quick Action Button: Show "+ New sale" only when NOT on order screen */}
        {currentTab !== 'order' ? (
          <button
            onClick={() => onTabChange('order')}
            className="flex items-center gap-1.5 h-9 px-3 sm:px-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 active:scale-95 text-slate-950 font-sans font-bold text-xs shadow-sm shadow-brand-500/20 transition-all whitespace-nowrap flex-shrink-0"
            title="Start new sale transaction"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" weight="bold" />
            <span className="hidden xs:inline sm:inline">New sale</span>
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold whitespace-nowrap flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span>Counter Active</span>
          </div>
        )}
      </div>
    </header>
  );
};
