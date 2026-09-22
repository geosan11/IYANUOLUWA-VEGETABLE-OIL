import React, { useState, useEffect } from 'react';
import { useStore } from '../../services/store';
import { useAuth } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { formatDepotTime } from '../../services/businessLogic';
import { PlusCircle, Drop, Package, List, Sun, Moon, CaretDown, Buildings, Check, Bell, Warning, SignOut, Envelope, GasPump, Clock } from '@phosphor-icons/react';
import { NAV_ITEMS, getVisibleNavItems } from '../../constants/nav';

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
    currentUser,
    activeHubId,
    setActiveHubId,
    activeHub,
    activeAlerts,
    requestEndShift
  } = useStore();
  const { user, signOut } = useAuth();
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [hubMenuOpen, setHubMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [alertMenuOpen, setAlertMenuOpen] = useState(false);

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
            className="split:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 flex-shrink-0 cursor-pointer"
            aria-label="Open menu"
          >
            <List className="w-5 h-5" />
          </button>
        )}

        {/* Counter-staff screen switcher (used in place of the sidebar) */}
        {showScreenSwitcher ? (
          <div
            className="relative"
            onMouseEnter={() => setSwitcherOpen(true)}
            onMouseLeave={() => setSwitcherOpen(false)}
          >
            <button
              type="button"
              onClick={() => setSwitcherOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={switcherOpen}
              className="flex items-center gap-2 sm:gap-2.5 h-10 bg-slate-900 dark:bg-slate-900 text-white pl-2 pr-3 rounded-xl text-xs font-bold tracking-wide shadow-sm border border-slate-800 dark:border-slate-800 hover:border-brand-500/50 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 flex-shrink-0 cursor-pointer"
            >
              {settings.company_logo_url ? (
                <img
                  src={settings.company_logo_url}
                  alt="Logo"
                  className="w-7 h-7 rounded-lg object-contain bg-white shadow-sm flex-shrink-0 p-0.5"
                />
              ) : (
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-500 text-slate-950 font-extrabold text-xs shadow-sm flex-shrink-0">
                  IO
                </span>
              )}
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

            {/* No click-away backdrop here: a fixed full-viewport backdrop
                would paint above the rest of the header (it needs z-40 to
                clear the panel's own content) and swallow hover on the other
                pills, defeating hover-to-switch between dropdowns. Hovering
                out already closes this one, and the trigger's onClick still
                toggles it for touch. */}
            {/* pt- (not mt-) so the gap above the panel is still part of this
                hoverable box — otherwise the pointer "leaves" mid-gap and the
                menu closes before it ever reaches the panel. */}
            <div
              className={`absolute left-0 top-full pt-1.5 z-50 origin-top-left transition-all duration-150 ease-out ${
                switcherOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
              }`}
            >
              <div role="menu" className="w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1.5">Switch Screen</p>
                {getVisibleNavItems(userRole, currentUser.allowed_screens).map(item => {
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
                      } cursor-pointer`}
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
            </div>
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

        {/* Live Shift Status Pill — deliberately inverted: a dark chip in light
            mode (so it reads clearly against the light header) and a light
            chip in dark mode, rather than following the usual light/dark split. */}
        {activeShift && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white border border-slate-800 dark:border-slate-200 shadow-sm whitespace-nowrap flex-shrink-0">
            <GasPump className="w-4 h-4 text-emerald-400 dark:text-emerald-600 flex-shrink-0" weight="bold" />
            <div className="leading-tight">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white dark:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-500 animate-pulse flex-shrink-0" />
                <span>Live Shift</span>
                <span className="hidden xl:inline font-normal text-slate-400 dark:text-slate-500 truncate max-w-[100px]">
                  · {activeShift.cashier_name || 'Staff'}
                </span>
              </div>
              <div className="hidden xl:flex items-center gap-1.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                <span>Started at {formatDepotTime(activeShift.start_time)}</span>
                <span>·</span>
                <Clock className="w-3 h-3 flex-shrink-0" weight="bold" />
                <span className="font-bold text-slate-200 dark:text-slate-700">
                  Hours: {settings.shift_start_time || '07:00'} – {settings.shift_end_time || '18:00'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                requestEndShift();
                if (currentTab !== 'order') onTabChange('order');
              }}
              className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 dark:text-rose-600 hover:text-rose-200 dark:hover:text-rose-700 text-xs font-sans font-bold transition-all active:scale-95 flex-shrink-0 cursor-pointer"
            >
              <SignOut className="w-3.5 h-3.5" weight="bold" />
              <span>End Shift</span>
            </button>
          </div>
        )}

        {/* Hub Selector (Owner Switcher / Staff Badge) */}
        <div className="relative flex-shrink-0">
          {userRole === 'owner' ? (
            <div
              onMouseEnter={() => setHubMenuOpen(true)}
              onMouseLeave={() => setHubMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setHubMenuOpen(o => !o)}
                className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold transition-all shadow-sm focus:outline-none whitespace-nowrap flex-shrink-0 cursor-pointer"
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

              <div
                className={`absolute right-0 top-full pt-2 z-50 origin-top-right transition-all duration-150 ease-out ${
                  hubMenuOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                }`}
              >
                <div className="w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2">
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
                    } cursor-pointer`}
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
                          } cursor-pointer`}
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
              </div>
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
        <div
          className="relative flex-shrink-0"
          onMouseEnter={() => setUserMenuOpen(true)}
          onMouseLeave={() => setUserMenuOpen(false)}
        >
          <button
            type="button"
            onClick={() => setUserMenuOpen(o => !o)}
            className="flex items-center gap-2 h-9 p-1 sm:px-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 cursor-pointer"
            title="Account"
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

          <div
            className={`absolute right-0 top-full pt-2 z-50 origin-top-right transition-all duration-150 ease-out ${
              userMenuOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
            }`}
          >
            <div className="w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2">
              {isSupabaseConfigured ? (
                <>
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Signed in</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                      {currentUser.full_name}
                    </p>
                    {user?.email && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                        <Envelope className="w-3 h-3 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </p>
                    )}
                    <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400">
                      {currentUser.role.replace('_', ' ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); signOut(); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <SignOut className="w-4 h-4" weight="bold" />
                    <span>Sign out</span>
                  </button>
                </>
              ) : (
                <div className="px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Local / Offline Mode</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                    {currentUser.full_name}
                  </p>
                  <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400">
                    {currentUser.role.replace('_', ' ')}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    Connect Supabase to enable real accounts and sign-in.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Date / Time Clock (Wide Desktop only) */}
        <div className="hidden 2xl:block text-right whitespace-nowrap flex-shrink-0">
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">{currentDateTime}</div>
        </div>

        {/* Alert Icon Dropdown Button */}
        <div
          className="relative flex-shrink-0"
          onMouseEnter={() => setAlertMenuOpen(true)}
          onMouseLeave={() => setAlertMenuOpen(false)}
        >
          <button
            type="button"
            onClick={() => setAlertMenuOpen(o => !o)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all relative ${
              activeAlerts.totalAlertCount > 0
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            } cursor-pointer`}
            title={activeAlerts.totalAlertCount > 0 ? `${activeAlerts.totalAlertCount} Depot Alerts` : 'No Active Alerts'}
            aria-label="Depot Alerts"
          >
            <Bell className="w-4 h-4" weight={activeAlerts.totalAlertCount > 0 ? 'fill' : 'bold'} />
            {activeAlerts.totalAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white rounded-full text-[10px] font-mono font-bold flex items-center justify-center shadow-sm animate-pulse">
                {activeAlerts.totalAlertCount}
              </span>
            )}
          </button>

          <div
            className={`absolute right-0 top-full pt-2 z-50 origin-top-right transition-all duration-150 ease-out ${
              alertMenuOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
            }`}
          >
            <div className="w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-heading font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Warning className="w-4 h-4 text-amber-500" weight="bold" />
                    Depot Alerts
                  </span>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {activeAlerts.totalAlertCount} Active
                  </span>
                </div>

                <div className="py-2 space-y-2 max-h-72 overflow-y-auto pr-1">
                  {activeAlerts.totalAlertCount === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center gap-1">
                      <Check className="w-6 h-6 text-emerald-500" weight="bold" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">All Operations Normal</span>
                      <span className="text-[11px]">No overdue debts, pump variances, or shortfalls.</span>
                    </div>
                  ) : (
                    <>
                      {activeAlerts.overdueCredit.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { onTabChange('customers'); setAlertMenuOpen(false); }}
                          className="w-full text-left p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-rose-800 dark:text-rose-300">
                              {activeAlerts.overdueCredit.length} Overdue Debt Account(s)
                            </div>
                            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                              Exceeded debt terms
                            </div>
                          </div>
                          <CaretDown className="w-3.5 h-3.5 text-rose-600 -rotate-90 flex-shrink-0" />
                        </button>
                      )}

                      {activeAlerts.overLimit.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { onTabChange('customers'); setAlertMenuOpen(false); }}
                          className="w-full text-left p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-amber-800 dark:text-amber-300">
                              {activeAlerts.overLimit.length} Debt Cap Breach(es)
                            </div>
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                              Balances exceeding limit
                            </div>
                          </div>
                          <CaretDown className="w-3.5 h-3.5 text-amber-600 -rotate-90 flex-shrink-0" />
                        </button>
                      )}

                      {activeAlerts.deliveryShortfall.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { onTabChange('intake'); setAlertMenuOpen(false); }}
                          className="w-full text-left p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-rose-800 dark:text-rose-300">
                              {activeAlerts.deliveryShortfall.length} Tank Intake Shortfall(s)
                            </div>
                            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                              Supplier volume discrepancy
                            </div>
                          </div>
                          <CaretDown className="w-3.5 h-3.5 text-rose-600 -rotate-90 flex-shrink-0" />
                        </button>
                      )}

                      {activeAlerts.pumpVariance && activeAlerts.pumpVariance.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { onTabChange('pumps'); setAlertMenuOpen(false); }}
                          className="w-full text-left p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-rose-800 dark:text-rose-300">
                              {activeAlerts.pumpVariance.length} Pump Meter Variance(s)
                            </div>
                            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                              Meter vs counter mismatch
                            </div>
                          </div>
                          <CaretDown className="w-3.5 h-3.5 text-rose-600 -rotate-90 flex-shrink-0" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { onTabChange('dashboard'); setAlertMenuOpen(false); }}
                    className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold text-center transition-colors cursor-pointer"
                  >
                    View Operations Dashboard →
                  </button>
                </div>
            </div>
          </div>
        </div>

        {/* Theme Switcher Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors flex-shrink-0 cursor-pointer"
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
        {currentTab !== 'order' && (
          <button
            onClick={() => onTabChange('order')}
            className="flex items-center gap-1.5 h-9 px-3 sm:px-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 active:scale-95 text-slate-950 font-sans font-bold text-xs shadow-sm shadow-brand-500/20 transition-all whitespace-nowrap flex-shrink-0 cursor-pointer"
            title="Start new sale transaction"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" weight="bold" />
            <span className="hidden xs:inline sm:inline">New sale</span>
          </button>
        )}
      </div>
    </header>
  );
};
