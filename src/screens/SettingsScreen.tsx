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
  Fuel
} from 'lucide-react';
import { UserRole } from '../types';

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
  };

  // 5. Save Daily Operations Float
  const handleSaveDailyFloat = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(0, parseFloat(defaultDailyFloat) || 150000);
    updateSettings({
      default_daily_float: val
    });
    showNotification('Default opening petty cash float updated!');
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
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>Depot Configuration & Settings Control</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Single source of truth for depot brand identity, products & pricing matrix, keg parameters, and alert thresholds.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="font-semibold">{statusMsg}</span>
        </div>
      )}

      {/* 1. COMPANY PROFILE */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>1. Company Profile & Official Branding</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
                <span className="text-[10px] block">No logo</span>
              </div>
            )}
          </div>

          <div className="space-y-2.5 w-full">
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-sm active:scale-95">
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
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/60 hover:text-rose-700 dark:hover:text-rose-300 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  <span>Remove Logo</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Directly synced with Supabase Storage bucket (<code className="font-mono text-brand-600 dark:text-brand-400">depot_assets</code>). Supports PNG, JPG, SVG.
            </p>
          </div>
        </div>

        {/* Contact Fields */}
        <form onSubmit={handleSaveCompanyInfo} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Registered Business Name</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs focus:outline-none focus:border-brand-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Depot Telephone</label>
              <input
                type="text"
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Physical Depot Address</label>
              <input
                type="text"
                value={companyAddress}
                onChange={e => setCompanyAddress(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-brand-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
            >
              <Save className="w-4 h-4" />
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>2. Keg Configuration & Fleet Standards</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Single source of truth for container volume conversions, physical fleet size, and depot minimum safety reserve.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">Litres per Standard Keg</label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="1"
                value={litresPerKeg}
                onChange={e => setLitresPerKeg(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">L/keg</span>
            </div>
            <p className="text-[10px] text-slate-500">Standard Lagos depot 30-litre yellow jerrycan volume conversion.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">Total Company Fleet Owned</label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={totalCompanyKegs}
                onChange={e => setTotalCompanyKegs(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">Kegs</span>
            </div>
            <p className="text-[10px] text-slate-500">Total physical fleet asset cap (read-only on Kegs screen).</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">Depot Low Stock Alert Threshold</label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={kegsAtDepotLowThreshold}
                onChange={e => setKegsAtDepotLowThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">Kegs</span>
            </div>
            <p className="text-[10px] text-slate-500">Flags critical warning when depot yard stock drops below this.</p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Save className="w-4 h-4" />
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
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>3. Products & Dynamic Rate Card Grid</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live owner pricing management: adjust conversion tonnages and per-litre rate cards across customer tiers.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-300 font-bold self-start sm:self-auto">
            Live Counter Pricing
          </span>
        </div>

        {/* Product Conversion Tonnages */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Product Density Conversion (Litres per Metric Ton)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map(p => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">{p.name}</div>
                  <div className="text-[10px] text-slate-500">Truck Intake density multiplier</div>
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
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:border-brand-500"
                    required
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">L/Ton</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Rate Card Matrix Table */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>Rate Card Matrix (Product × Customer Tier)</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Customer Tier</th>
                  <th className="px-4 py-3">Rate per Litre (₦/L)</th>
                  <th className="px-4 py-3 text-right">Effective 30L Keg Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono">
                {products.map(p =>
                  (['retail', 'agent', 'corporate'] as const).map(tier => {
                    const key = `${p.id}_${tier}`;
                    const currentRate = parseFloat(rateCardRates[key]) || 0;
                    const effectiveKegPrice = currentRate * (parseFloat(litresPerKeg) || 30);

                    return (
                      <tr key={key} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3 font-sans font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: p.id === 'veg' ? '#F59E0B' : '#EF4444' }}
                            />
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
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
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</span>
                            <input
                              type="number"
                              step="50"
                              min="100"
                              value={rateCardRates[key] || ''}
                              onChange={e =>
                                setRateCardRates({ ...rateCardRates, [key]: e.target.value })
                              }
                              className="w-full pl-6 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:border-brand-500"
                              required
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
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
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Save className="w-4 h-4" />
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>4. Operational Alert & Variance Thresholds</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Set real-time triggers for depot oil shrinkage, truck offload shortages, and pump meter audit alerts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">Low Depot Tank Stock Alert</label>
            <div className="relative">
              <input
                type="number"
                step="50"
                min="0"
                value={lowStockThreshold}
                onChange={e => setLowStockThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">Litres</span>
            </div>
            <p className="text-[10px] text-slate-500">Flags low storage warning when remaining tank stock drops below this.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">Truck Intake Shortfall Flag</label>
            <div className="relative">
              <input
                type="number"
                step="5"
                min="0"
                value={truckShortfallThreshold}
                onChange={e => setTruckShortfallThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">Litres</span>
            </div>
            <p className="text-[10px] text-slate-500">Flags red warning if delivery offload shortfall exceeds this limit.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">Pump Meter Variance Flag</label>
            <div className="relative">
              <input
                type="number"
                step="5"
                min="0"
                value={pumpVarianceThreshold}
                onChange={e => setPumpVarianceThreshold(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">Litres</span>
            </div>
            <p className="text-[10px] text-slate-500">Flags 4th Dashboard alert if unlogged pump sales discrepancy exceeds this.</p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Alert Thresholds</span>
          </button>
        </div>
      </form>

      {/* 5. DAILY OPERATIONS & SYSTEM TOOLS */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>5. Daily Operations, Role Simulation & System Tools</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Default daily cash float, operational role tiers, and database utilities.
          </p>
        </div>

        {/* Default Daily Float Form */}
        <form onSubmit={handleSaveDailyFloat} className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
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
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-xs focus:outline-none focus:border-brand-500"
                required
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs shadow-sm transition-all active:scale-95"
            >
              Save Default Float
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Automatically pre-fills the counter's opening petty cash float every morning on the Expenses screen.
          </p>
        </form>

        {/* Operational Role Simulation */}
        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
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
                <div className="font-bold text-xs text-slate-900 dark:text-white capitalize">{r.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Factory Reset Seed Data */}
        <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>Factory Reset Demo Seed Data</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Restores initial seed customers (Mr Samson, Arena, Iya Aige, Lekki Agent), tanks, pumps, and sample invoices.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetData}
            className="px-4 py-2 rounded-xl bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80 text-xs font-bold transition-all active:scale-95 flex-shrink-0"
          >
            Reset Database
          </button>
        </div>
      </div>
    </div>
  );
};
