import React, { useState, useEffect } from 'react';
import { useStore } from '../../services/store';
import { PlusCircle, Droplets, Package, Menu, Sun, Moon } from 'lucide-react';

interface TopHeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onMobileMenuOpen?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  onTabChange,
  onMobileMenuOpen
}) => {
  const { tanks, kegInventory, settings, theme, toggleTheme } = useStore();
  const [currentDateTime, setCurrentDateTime] = useState('');

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

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Depot Overview & Live Dashboard';
      case 'intake':
        return 'Truck Intake & Tank Logging';
      case 'order':
        return 'Counter Dispense & New Sale';
      case 'customers':
        return 'Customer Ledger & Credit Aging';
      case 'kegs':
        return 'Keg Inventory & Depot Gate Audit';
      case 'expenses':
        return 'Petty Cash Float & Expenses';
      case 'settings':
        return 'System Configuration & Logo';
      default:
        return 'Operations Portal';
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between z-20 flex-shrink-0 select-none transition-colors duration-200">
      {/* Left: Mobile menu trigger / Desktop Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuOpen}
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Logo Brand */}
        <div className="lg:hidden flex items-center gap-2">
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

        {/* Desktop Breadcrumbs & Title */}
        <div className="hidden lg:flex flex-col">
          <div className="flex items-center gap-2 text-[12px] font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Depot Counter</span>
            <span>/</span>
            <span className="text-brand-600 dark:text-brand-400 font-semibold capitalize">{currentTab}</span>
          </div>
          <h1 className="text-[16px] font-heading font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Right: Quick Stats, Live Clock, Theme Toggle, and "+ Quick Dispense" Shortcut */}
      <div className="flex items-center gap-2.5 lg:gap-4">
        {/* Depot Oil Volume Pill (Desktop) */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-[12px] font-mono tabular-nums">
          <Droplets className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="text-slate-500 dark:text-slate-400 font-sans">Total Stock:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {totalDepotLitres.toLocaleString('en-US', { maximumFractionDigits: 0 })} L
          </span>
        </div>

        {/* Depot Kegs Pill */}
        <div
          className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-mono tabular-nums ${
            kegInventory.isDepotStockCritical
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 animate-pulse'
              : 'bg-slate-100 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Package className={`w-4 h-4 ${kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`} />
          <span className="text-slate-500 dark:text-slate-400 font-sans">Depot Kegs:</span>
          <span className={`font-bold ${kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
            {kegInventory.kegsAtDepot}
          </span>
        </div>

        {/* Live Date / Time Clock */}
        <div className="hidden sm:block text-right">
          <div className="text-[12px] font-mono tabular-nums text-slate-600 dark:text-slate-400">{currentDateTime}</div>
          <div className="text-[11px] font-sans text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-end gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Lagos Depot Online
          </div>
        </div>

        {/* Theme Switcher Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* High-visibility "+ Quick Dispense" Button */}
        <button
          onClick={() => onTabChange('order')}
          className="flex items-center gap-2 px-3.5 lg:px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 active:scale-95 text-slate-950 font-sans font-bold text-[14px] shadow-lg shadow-brand-500/20 transition-all"
        >
          <PlusCircle className="w-[18px] h-[18px] text-slate-950" />
          <span className="whitespace-nowrap">Quick Dispense</span>
        </button>
      </div>
    </header>
  );
};
