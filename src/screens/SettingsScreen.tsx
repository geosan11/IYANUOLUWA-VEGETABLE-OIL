import React, { useState } from 'react';
import { useStore } from '../services/store';
import { uploadDepotLogo } from '../services/supabase';
import { formatNaira } from '../services/businessLogic';
import {
  Settings,
  Upload,
  Trash2,
  CheckCircle2,
  Building,
  Shield,
  RotateCcw,
  Image as ImageIcon,
  Package,
  Sliders,
  DollarSign,
  AlertTriangle,
  Layers,
  Save,
  ChevronRight
} from 'lucide-react';
import { UserRole } from '../types';
import { BottomSheet } from '../components/common/BottomSheet';

export const SettingsScreen: React.FC = () => {
  const {
    products,
    rateCards,
    settings,
    userRole,
    setUserRole,
    updateProduct,
    updateRateCard,
    updateSettings,
    resetToSeedData
  } = useStore();

  // Mobile BottomSheet Navigation
  const [activeMobileSheet, setActiveMobileSheet] = useState<'company' | 'kegs' | 'pricing' | 'thresholds' | 'system' | null>(null);

  // 1. Company Profile Local State
  const [companyName, setCompanyName] = useState(settings.company_name);
  const [companyPhone, setCompanyPhone] = useState(settings.company_phone);
  const [companyAddress, setCompanyAddress] = useState(settings.company_address);
  const [isUploading, setIsUploading] = useState(false);

  // 2. Keg Configuration Local State
  const [litresPerKeg, setLitresPerKeg] = useState(settings.litres_per_keg.toString());
  const [totalCompanyKegs, setTotalCompanyKegs] = useState(settings.total_company_kegs.toString());
  const [kegsAtDepotLowThreshold, setKegsAtDepotLowThreshold] = useState(settings.kegs_at_depot_low_threshold.toString());

  // 3. Products & Pricing Local State
  const [productTonnages, setProductTonnages] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    products.forEach(p => {
      map[p.id] = p.litres_per_ton.toString();
    });
    return map;
  });

  const [rateCardRates, setRateCardRates] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    rateCards.forEach(r => {
      map[`${r.product_id}_${r.tier}`] = r.rate_per_litre.toString();
    });
    return map;
  });

  // 4. Alert Thresholds Local State
  const [lowStockThreshold, setLowStockThreshold] = useState(settings.low_stock_litres_threshold.toString());
  const [truckShortfallThreshold, setTruckShortfallThreshold] = useState(settings.truck_shortfall_threshold.toString());
  const [pumpVarianceThreshold, setPumpVarianceThreshold] = useState(settings.pump_variance_threshold.toString());

  // 5. Daily Operations Local State
  const [defaultDailyFloat, setDefaultDailyFloat] = useState(settings.default_daily_float.toString());

  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  // Logo handlers
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const result = await uploadDepotLogo(file);
    setIsUploading(false);

    if (result.url) {
      updateSettings({ company_logo_url: result.url });
      showNotification('Company logo uploaded and saved to depot branding successfully!');
    } else {
      showNotification(`Upload error: ${result.error || 'Failed to upload'}`);
    }
  };

  const handleRemoveLogo = () => {
    updateSettings({ company_logo_url: null });
    showNotification('Company logo removed.');
  };

  // 1. Save Company Profile
  const handleSaveCompanyInfo = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      company_name: companyName.trim(),
      company_phone: companyPhone.trim(),
      company_address: companyAddress.trim()
    });
    showNotification('Company profile updated successfully!');
    setActiveMobileSheet(null);
  };

  // 2. Save Keg Configuration
  const handleSaveKegConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      litres_per_keg: Math.max(1, parseFloat(litresPerKeg) || 30),
      total_company_kegs: Math.max(0, parseInt(totalCompanyKegs, 10) || 500),
      kegs_at_depot_low_threshold: Math.max(0, parseInt(kegsAtDepotLowThreshold, 10) || 20)
    });
    showNotification('Keg inventory parameters saved as global depot defaults!');
    setActiveMobileSheet(null);
  };

  // 3. Save Products & Pricing Rate Cards
  const handleSaveProductsAndPricing = (e: React.FormEvent) => {
    e.preventDefault();
    // Update products
    products.forEach(p => {
      const val = parseFloat(productTonnages[p.id]);
      if (!isNaN(val) && val > 0) {
        updateProduct(p.id, { litres_per_ton: val });
      }
    });

    // Update rate cards
    products.forEach(p => {
      (['retail', 'agent', 'corporate'] as const).forEach(tier => {
        const key = `${p.id}_${tier}`;
        const rate = parseFloat(rateCardRates[key]);
        if (!isNaN(rate) && rate > 0) {
          updateRateCard(p.id, tier, rate);
        }
      });
    });

    showNotification('Products volumetric density and rate card matrix updated successfully!');
    setActiveMobileSheet(null);
  };

  // 4. Save Alert Thresholds
  const handleSaveAlertThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      low_stock_litres_threshold: Math.max(0, parseFloat(lowStockThreshold) || 500),
      truck_shortfall_threshold: Math.max(0, parseFloat(truckShortfallThreshold) || 50),
      pump_variance_threshold: Math.max(0, parseFloat(pumpVarianceThreshold) || 20)
    });
    showNotification('Operational alert thresholds updated!');
    setActiveMobileSheet(null);
  };

  // 5. Save Daily Operations Float
  const handleSaveDailyFloat = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(0, parseFloat(defaultDailyFloat) || 150000);
    updateSettings({
      default_daily_float: val
    });
    showNotification('Default opening petty cash float updated!');
    setActiveMobileSheet(null);
  };

  const handleResetData = () => {
    if (window.confirm('Reset all demo data (tanks, orders, kegs, pumps, expenses, pricing) to default factory seed values?')) {
      resetToSeedData();
      showNotification('Database reset to default factory seed data.');
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-[24px] font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>Depot Configuration & Settings Control</span>
          </h2>
          <p className="text-[14px] font-sans text-slate-500 dark:text-slate-400 mt-1">
            Single source of truth for depot brand identity, products & pricing matrix, keg parameters, and alert thresholds.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-[12px] font-sans font-semibold flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* MOBILE: iOS-Style Grouped Menu (sm:hidden) */}
      <div className="sm:hidden space-y-4">
        <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-slate-400 px-1">
          Configuration Categories
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {/* Row 1: Company Profile */}
          <button
            type="button"
            onClick={() => setActiveMobileSheet('company')}
            className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-500/30 flex items-center justify-center flex-shrink-0">
              <Building className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Company & Branding
              </div>
              <div className="text-[12px] font-sans text-slate-500 truncate mt-0.5">
                {companyName || 'Iyanuoluwa Oil'} · {companyPhone || 'No phone'}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </button>

          {/* Row 2: Keg Configuration */}
          <button
            type="button"
            onClick={() => setActiveMobileSheet('kegs')}
            className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Keg Fleet & Container Standards
              </div>
              <div className="text-[12px] font-mono tabular-nums text-slate-500 truncate mt-0.5">
                {litresPerKeg}L/keg · {totalCompanyKegs} total kegs · {kegsAtDepotLowThreshold} min reserve
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </button>

          {/* Row 3: Products & Pricing */}
          <button
            type="button"
            onClick={() => setActiveMobileSheet('pricing')}
            className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Products & Rate Card Matrix
              </div>
              <div className="text-[12px] font-sans text-slate-500 truncate mt-0.5">
                {products.length} products · Retail, Agent & Corporate tiers
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </button>

          {/* Row 4: Operational Alert Thresholds */}
          <button
            type="button"
            onClick={() => setActiveMobileSheet('thresholds')}
            className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Safety & Variance Thresholds
              </div>
              <div className="text-[12px] font-mono tabular-nums text-slate-500 truncate mt-0.5">
                Low tank: {lowStockThreshold}L · Shortfall: {truckShortfallThreshold}L · Pump: {pumpVarianceThreshold}L
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </button>

          {/* Row 5: Daily Float & System Controls */}
          <button
            type="button"
            onClick={() => setActiveMobileSheet('system')}
            className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Daily Float & System Controls
              </div>
              <div className="text-[12px] font-mono tabular-nums text-slate-500 truncate mt-0.5">
                Float: {formatNaira(parseFloat(defaultDailyFloat) || 0)} · Role: {userRole}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* DESKTOP: Full 5-Section Layout (hidden sm:block) */}
      <div className="hidden sm:block space-y-6">
      {/* 1. COMPANY PROFILE */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>1. Company Profile & Official Branding</span>
          </h3>
          <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
            Official logo and contact details appearing on app navigation and printed Official Receipts.
          </p>
        </div>

        {/* Logo Upload Box */}
        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <div className="w-28 h-28 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center p-2 overflow-hidden flex-shrink-0 shadow-sm">
            {settings.company_logo_url ? (
              <img
                src={settings.company_logo_url}
                alt="Depot Logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-slate-400">
                <ImageIcon className="w-7 h-7 mx-auto mb-1 opacity-50" />
                <span className="text-[11px] font-sans block">No logo</span>
              </div>
            )}
          </div>

          <div className="space-y-2.5 w-full">
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] flex items-center gap-2 transition-all shadow-sm active:scale-95">
                <Upload className="w-4 h-4" />
                <span>{isUploading ? 'Uploading to Storage...' : 'Upload Official Logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>

              {settings.company_logo_url && (
                <button
                  onClick={handleRemoveLogo}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/60 hover:text-rose-700 dark:hover:text-rose-300 text-slate-700 dark:text-slate-300 text-[13px] font-sans font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  <span>Remove Logo</span>
                </button>
              )}
            </div>
            <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
              Directly synced with Supabase Storage bucket (<code className="font-mono text-brand-600 dark:text-brand-400">depot_assets</code>). Supports PNG, JPG, SVG.
            </p>
          </div>
        </div>

        {/* Contact Fields */}
        <form onSubmit={handleSaveCompanyInfo} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Registered Business Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-sans font-medium text-[14px] focus:outline-none focus:border-brand-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Depot Telephone
              </label>
              <input
                type="text"
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Physical Depot Address
              </label>
              <input
                type="text"
                value={companyAddress}
                onChange={e => setCompanyAddress(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-sans font-medium focus:outline-none focus:border-brand-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-md transition-all flex items-center gap-2 active:scale-95"
            >
              <Save className="w-[18px] h-[18px]" />
              <span>Save Company Profile</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. KEG CONFIGURATION */}
      <form
        onSubmit={handleSaveKegConfig}
        className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm"
      >
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>2. Keg Configuration & Fleet Standards</span>
          </h3>
          <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
            Single source of truth for container volume conversions, physical fleet size, and depot minimum safety reserve.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Litres per Standard Keg
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="1"
                value={litresPerKeg}
                onChange={e => setLitresPerKeg(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">L/keg</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Standard Lagos depot 30-litre yellow jerrycan volume conversion.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Total Company Fleet Owned
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={totalCompanyKegs}
                onChange={e => setTotalCompanyKegs(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Kegs</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Total physical fleet asset cap (read-only on Kegs screen).</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Depot Low Stock Alert Threshold
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={kegsAtDepotLowThreshold}
                onChange={e => setKegsAtDepotLowThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Kegs</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Flags critical warning when depot yard stock drops below this.</p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Save className="w-[18px] h-[18px]" />
            <span>Save Keg Parameters</span>
          </button>
        </div>
      </form>

      {/* 3. PRODUCTS & PRICING (DYNAMIC RATE CARD GRID) */}
      <form
        onSubmit={handleSaveProductsAndPricing}
        className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm"
      >
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span>3. Products & Dynamic Rate Card Grid</span>
            </h3>
            <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
              Live owner pricing management: adjust conversion tonnages and per-litre rate cards across customer tiers.
            </p>
          </div>
          <span className="text-[11px] font-mono tabular-nums px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-300 font-bold self-start sm:self-auto">
            Live Counter Pricing
          </span>
        </div>

        {/* Product Conversion Tonnages */}
        <div className="space-y-3">
          <div className="text-[16px] font-sans font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-400" />
            <span>Product Density Conversion (Litres per Metric Ton)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map(p => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="font-heading font-semibold text-[14px] text-slate-900 dark:text-white">{p.name}</div>
                  <div className="text-[11px] font-sans text-slate-500">Truck Intake density multiplier</div>
                </div>

                <div className="relative w-36">
                  <input
                    type="number"
                    step="0.1"
                    min="100"
                    value={productTonnages[p.id] || ''}
                    onChange={e =>
                      setProductTonnages({ ...productTonnages, [p.id]: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                    required
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">L/Ton</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Rate Card Matrix Table */}
        <div className="space-y-3">
          <div className="text-[16px] font-sans font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-slate-400" />
            <span>Rate Card Matrix (Product × Customer Tier)</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-sans">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Customer Tier</th>
                  <th className="px-4 py-3">Rate per Litre (₦/L)</th>
                  <th className="px-4 py-3 text-right">Effective 30L Keg Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono tabular-nums">
                {products.map(p =>
                  (['retail', 'agent', 'corporate'] as const).map(tier => {
                    const key = `${p.id}_${tier}`;
                    const currentRate = parseFloat(rateCardRates[key]) || 0;
                    const effectiveKegPrice = currentRate * (parseFloat(litresPerKeg) || 30);

                    return (
                      <tr key={key} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3 font-sans font-semibold text-slate-800 dark:text-slate-200 text-[14px]">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: p.id === 'veg' ? '#F59E0B' : '#EF4444' }}
                            />
                            <span className="font-heading">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-sans font-bold uppercase ${
                            tier === 'corporate'
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                              : tier === 'agent'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}>
                            {tier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative w-36">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[14px]">₦</span>
                            <input
                              type="number"
                              step="50"
                              min="100"
                              value={rateCardRates[key] || ''}
                              onChange={e =>
                                setRateCardRates({ ...rateCardRates, [key]: e.target.value })
                              }
                              className="w-full pl-6 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                              required
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-[14px]">
                          {formatNaira(effectiveKegPrice)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Save className="w-[18px] h-[18px]" />
            <span>Save Products & Rate Cards</span>
          </button>
        </div>
      </form>

      {/* 4. ALERT THRESHOLDS */}
      <form
        onSubmit={handleSaveAlertThresholds}
        className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm"
      >
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <span>4. Operational Alert & Variance Thresholds</span>
          </h3>
          <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
            Set real-time triggers for depot oil shrinkage, truck offload shortages, and pump meter audit alerts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Low Depot Tank Stock Alert
            </label>
            <div className="relative">
              <input
                type="number"
                step="50"
                min="0"
                value={lowStockThreshold}
                onChange={e => setLowStockThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Litres</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Flags low storage warning when remaining tank stock drops below this.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Truck Intake Shortfall Flag
            </label>
            <div className="relative">
              <input
                type="number"
                step="5"
                min="0"
                value={truckShortfallThreshold}
                onChange={e => setTruckShortfallThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Litres</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Flags red warning if delivery offload shortfall exceeds this limit.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Pump Meter Variance Flag
            </label>
            <div className="relative">
              <input
                type="number"
                step="5"
                min="0"
                value={pumpVarianceThreshold}
                onChange={e => setPumpVarianceThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Litres</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Flags 4th Dashboard alert if unlogged pump sales discrepancy exceeds this.</p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Save className="w-[18px] h-[18px]" />
            <span>Save Alert Thresholds</span>
          </button>
        </div>
      </form>

      {/* 5. DAILY OPERATIONS & SYSTEM TOOLS */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>5. Daily Operations, Role Simulation & System Tools</span>
          </h3>
          <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
            Default daily cash float, operational role tiers, and database utilities.
          </p>
        </div>

        {/* Default Daily Float Form */}
        <form onSubmit={handleSaveDailyFloat} className="space-y-3">
          <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Default Opening Daily Petty Cash Float (₦)
          </label>
          <div className="flex items-center gap-3">
            <div className="relative w-full max-w-xs">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
              <input
                type="number"
                step="1000"
                min="0"
                value={defaultDailyFloat}
                onChange={e => setDefaultDailyFloat(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-sm transition-all active:scale-95"
            >
              Save Default Float
            </button>
          </div>
          <p className="text-[11px] font-sans text-slate-500">
            Automatically pre-fills the counter's opening petty cash float every morning on the Expenses screen.
          </p>
        </form>

        {/* Operational Role Simulation */}
        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Simulate Active Operational Role
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'owner', label: 'Owner (Full Access)', desc: 'Managing Director, price overrides, credit authorizations.' },
              { id: 'staff', label: 'Counter Staff', desc: 'Day-to-day dispensing, receiving payments, customer lookup.' },
              { id: 'driver', label: 'Driver / Logistics', desc: 'Intake logging and transport delivery audits.' }
            ].map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setUserRole(r.id as UserRole)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  userRole === r.id
                    ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-500 text-brand-900 dark:text-brand-300 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                <div className="font-heading font-semibold text-[14px] text-slate-900 dark:text-white capitalize">{r.label}</div>
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400 mt-1">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Factory Reset Seed Data */}
        <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-[14px] font-sans font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>Factory Reset Demo Seed Data</span>
            </h4>
            <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
              Restores initial seed customers (Mr Samson, Arena, Iya Aige, Lekki Agent), tanks, pumps, and sample invoices.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetData}
            className="px-4 py-2 rounded-xl bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80 text-[13px] font-sans font-bold transition-all active:scale-95 flex-shrink-0"
          >
            Reset Database
          </button>
        </div>
      </div>
      </div>

      {/* MOBILE BOTTOM SHEETS */}
      {/* 1. Company Profile Sheet */}
      <BottomSheet
        isOpen={activeMobileSheet === 'company'}
        onClose={() => setActiveMobileSheet(null)}
        title="Company & Official Branding"
      >
        <div className="space-y-5">
          {/* Logo Upload Box */}
          <div className="flex flex-col items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center p-2 overflow-hidden flex-shrink-0 shadow-sm">
              {settings.company_logo_url ? (
                <img
                  src={settings.company_logo_url}
                  alt="Depot Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-400">
                  <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <span className="text-[11px] font-sans block">No logo</span>
                </div>
              )}
            </div>

            <div className="space-y-2 w-full">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                <label className="cursor-pointer w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading...' : 'Upload Official Logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>

                {settings.company_logo_url && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[13px] font-sans font-semibold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                    <span>Remove Logo</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] font-sans text-slate-500">
                Synced with Supabase Storage (<code className="font-mono text-brand-600 dark:text-brand-400">depot_assets</code>).
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveCompanyInfo} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Registered Business Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-sans font-medium text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Depot Telephone
              </label>
              <input
                type="text"
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Physical Depot Address
              </label>
              <input
                type="text"
                value={companyAddress}
                onChange={e => setCompanyAddress(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-sans font-medium focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Company Profile</span>
            </button>
          </form>
        </div>
      </BottomSheet>

      {/* 2. Keg Configuration Sheet */}
      <BottomSheet
        isOpen={activeMobileSheet === 'kegs'}
        onClose={() => setActiveMobileSheet(null)}
        title="Keg Fleet & Container Standards"
      >
        <form onSubmit={handleSaveKegConfig} className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Litres per Standard Keg
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="1"
                value={litresPerKeg}
                onChange={e => setLitresPerKeg(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">L/keg</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Standard Lagos depot 30-litre yellow jerrycan volume conversion.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Total Company Fleet Owned
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={totalCompanyKegs}
                onChange={e => setTotalCompanyKegs(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Kegs</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Total physical fleet asset cap (read-only on Kegs screen).</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Depot Low Stock Alert Threshold
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={kegsAtDepotLowThreshold}
                onChange={e => setKegsAtDepotLowThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Kegs</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Flags critical warning when depot yard stock drops below this.</p>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Keg Parameters</span>
          </button>
        </form>
      </BottomSheet>

      {/* 3. Products & Pricing Sheet */}
      <BottomSheet
        isOpen={activeMobileSheet === 'pricing'}
        onClose={() => setActiveMobileSheet(null)}
        title="Products & Rate Card Matrix"
      >
        <form onSubmit={handleSaveProductsAndPricing} className="space-y-5">
          <div className="space-y-4">
            {products.map(p => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-heading font-bold text-[15px] text-slate-900 dark:text-white">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: p.id === 'veg' ? '#F59E0B' : '#EF4444' }}
                    />
                    <span>{p.name}</span>
                  </div>
                  <div className="relative w-32">
                    <input
                      type="number"
                      step="0.1"
                      min="100"
                      value={productTonnages[p.id] || ''}
                      onChange={e =>
                        setProductTonnages({ ...productTonnages, [p.id]: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[13px] focus:outline-none focus:border-brand-500"
                      required
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">L/Ton</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-slate-400">
                    Tier Rates & Keg Prices
                  </div>
                  {(['retail', 'agent', 'corporate'] as const).map(tier => {
                    const key = `${p.id}_${tier}`;
                    const currentRate = parseFloat(rateCardRates[key]) || 0;
                    const effectiveKegPrice = currentRate * (parseFloat(litresPerKeg) || 30);

                    return (
                      <div
                        key={key}
                        className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <span className={`px-2 py-0.5 rounded text-[11px] font-sans font-bold uppercase ${
                          tier === 'corporate'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : tier === 'agent'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {tier}
                        </span>

                        <div className="flex items-center gap-2">
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[12px]">₦</span>
                            <input
                              type="number"
                              step="50"
                              min="100"
                              value={rateCardRates[key] || ''}
                              onChange={e =>
                                setRateCardRates({ ...rateCardRates, [key]: e.target.value })
                              }
                              className="w-full pl-5 pr-2 py-1 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[13px] focus:outline-none focus:border-brand-500"
                              required
                            />
                          </div>
                          <span className="text-[12px] font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 w-24 text-right">
                            {formatNaira(effectiveKegPrice)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Products & Rate Cards</span>
          </button>
        </form>
      </BottomSheet>

      {/* 4. Operational Alert Thresholds Sheet */}
      <BottomSheet
        isOpen={activeMobileSheet === 'thresholds'}
        onClose={() => setActiveMobileSheet(null)}
        title="Safety & Variance Thresholds"
      >
        <form onSubmit={handleSaveAlertThresholds} className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Low Depot Tank Stock Alert
            </label>
            <div className="relative">
              <input
                type="number"
                step="50"
                min="0"
                value={lowStockThreshold}
                onChange={e => setLowStockThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Litres</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Flags low storage warning when remaining tank stock drops below this.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Truck Intake Shortfall Flag
            </label>
            <div className="relative">
              <input
                type="number"
                step="5"
                min="0"
                value={truckShortfallThreshold}
                onChange={e => setTruckShortfallThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Litres</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Flags red warning if delivery offload shortfall exceeds this limit.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Pump Meter Variance Flag
            </label>
            <div className="relative">
              <input
                type="number"
                step="5"
                min="0"
                value={pumpVarianceThreshold}
                onChange={e => setPumpVarianceThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Litres</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500">Flags 4th Dashboard alert if unlogged pump sales discrepancy exceeds this.</p>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Alert Thresholds</span>
          </button>
        </form>
      </BottomSheet>

      {/* 5. Daily Float & System Tools Sheet */}
      <BottomSheet
        isOpen={activeMobileSheet === 'system'}
        onClose={() => setActiveMobileSheet(null)}
        title="Daily Float & System Controls"
      >
        <div className="space-y-6">
          {/* Default Daily Float Form */}
          <form onSubmit={handleSaveDailyFloat} className="space-y-3">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Default Opening Daily Petty Cash Float (₦)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
              <input
                type="number"
                step="1000"
                min="0"
                value={defaultDailyFloat}
                onChange={e => setDefaultDailyFloat(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
            </div>
            <p className="text-[11px] font-sans text-slate-500">
              Pre-fills the counter's opening petty cash float every morning on the Expenses screen.
            </p>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-sm transition-all active:scale-95"
            >
              Save Default Float
            </button>
          </form>

          {/* Operational Role Simulation */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Simulate Active Operational Role
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { id: 'owner', label: 'Owner (Full Access)', desc: 'Managing Director, price overrides, credit authorizations.' },
                { id: 'staff', label: 'Counter Staff', desc: 'Day-to-day dispensing, receiving payments, customer lookup.' },
                { id: 'driver', label: 'Driver / Logistics', desc: 'Intake logging and transport delivery audits.' }
              ].map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setUserRole(r.id as UserRole);
                    showNotification(`Active role switched to ${r.label}`);
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    userRole === r.id
                      ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-500 text-brand-900 dark:text-brand-300 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-heading font-semibold text-[14px] text-slate-900 dark:text-white capitalize">{r.label}</div>
                  <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Factory Reset Demo Seed Data */}
          <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 space-y-3">
            <div>
              <h4 className="text-[13px] font-sans font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Factory Reset Demo Seed Data</span>
              </h4>
              <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                Restores initial seed customers, tanks, pumps, and sample records.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                handleResetData();
                setActiveMobileSheet(null);
              }}
              className="w-full py-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80 text-[13px] font-sans font-bold transition-all active:scale-95"
            >
              Reset Database
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
