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
  ChevronRight,
  Plus,
  Warehouse,
  Building2,
  Tag,
  Edit2,
  X
} from 'lucide-react';
import { UserRole, SupplyModel, ProductVariety } from '../types';
import { BottomSheet } from '../components/common/BottomSheet';

export const SettingsScreen: React.FC = () => {
  const {
    products,
    rateCards,
    physicalTanks,
    suppliers,
    settings,
    userRole,
    setUserRole,
    addProduct,
    updateProduct,
    deleteProduct,
    addPhysicalTank,
    deletePhysicalTank,
    addSupplier,
    deleteSupplier,
    updateRateCard,
    updateSettings,
    resetToSeedData
  } = useStore();

  // Desktop Tab Navigation
  const [activeDesktopTab, setActiveDesktopTab] = useState<'company' | 'kegs' | 'pricing' | 'infrastructure' | 'thresholds' | 'system'>('company');

  // Mobile BottomSheet Navigation
  const [activeMobileSheet, setActiveMobileSheet] = useState<'company' | 'kegs' | 'pricing' | 'infrastructure' | 'thresholds' | 'system' | null>(null);

  // 1. Company Profile Local State
  const [companyName, setCompanyName] = useState(settings.company_name);
  const [companyPhone, setCompanyPhone] = useState(settings.company_phone);
  const [companyAddress, setCompanyAddress] = useState(settings.company_address);
  const [isUploading, setIsUploading] = useState(false);

  // 2. Keg Configuration Local State
  const [litresPerKeg, setLitresPerKeg] = useState(settings.litres_per_keg.toString());
  const [totalCompanyKegs, setTotalCompanyKegs] = useState(settings.total_company_kegs.toString());
  const [kegsAtDepotLowThreshold, setKegsAtDepotLowThreshold] = useState(settings.kegs_at_depot_low_threshold.toString());

  // Per-product Litres per Keg (Palm Oil 25L vs Vegetable Oil 30L customizable by admin)
  const [productLitresPerKeg, setProductLitresPerKeg] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    products.forEach(p => {
      map[p.id] = (p.litres_per_keg ?? (p.id === 'red' ? 25 : 30)).toString();
    });
    return map;
  });

  React.useEffect(() => {
    setProductLitresPerKeg(prev => {
      const next = { ...prev };
      products.forEach(p => {
        if (next[p.id] === undefined) {
          next[p.id] = (p.litres_per_keg ?? (p.id === 'red' ? 25 : 30)).toString();
        }
      });
      return next;
    });
  }, [products]);

  // 3. Products & Pricing Local State
  const [productTonnages, setProductTonnages] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    products.forEach(p => {
      map[p.id] = (p.litres_per_ton ?? 1075).toString();
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

  // Add / Edit Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductModel, setNewProductModel] = useState<SupplyModel>('bulk_truck');
  const [newProductLitresPerKeg, setNewProductLitresPerKeg] = useState('30');
  const [newProductLitresPerTon, setNewProductLitresPerTon] = useState('1075');
  const [newProductKegSellPrice, setNewProductKegSellPrice] = useState('3500');
  const [newProductVarieties, setNewProductVarieties] = useState<{ id: string; name: string; delta: string }[]>([]);

  // Add Physical Tank Form State
  const [newTankLabel, setNewTankLabel] = useState('');
  const [newTankProductId, setNewTankProductId] = useState('veg');
  const [newTankCapacity, setNewTankCapacity] = useState('15000');

  // Add Supplier Form State
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

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
    const globalDefault = Math.max(1, parseFloat(litresPerKeg) || 30);
    updateSettings({
      litres_per_keg: globalDefault,
      total_company_kegs: Math.max(0, parseInt(totalCompanyKegs, 10) || 500),
      kegs_at_depot_low_threshold: Math.max(0, parseInt(kegsAtDepotLowThreshold, 10) || 20)
    });

    // Save customized litres per keg per product (e.g. Palm Oil 25L, Vegetable Oil 30L)
    products.forEach(p => {
      const val = parseFloat(productLitresPerKeg[p.id]);
      if (!isNaN(val) && val > 0) {
        updateProduct(p.id, { litres_per_keg: val });
      }
    });

    showNotification('Keg container sizes and fleet parameters saved successfully!');
    setActiveMobileSheet(null);
  };

  // 3. Save Products & Pricing Rate Cards
  const handleSaveProductsAndPricing = (e: React.FormEvent) => {
    e.preventDefault();
    products.forEach(p => {
      if (p.supply_model === 'bulk_truck') {
        const val = parseFloat(productTonnages[p.id]);
        if (!isNaN(val) && val > 0) {
          updateProduct(p.id, { litres_per_ton: val });
        }
      }
    });

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

  // Product Add / Edit Handler
  const handleSaveProductModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const kegSell = parseFloat(newProductKegSellPrice) || 3500;
    const lPerKeg = parseFloat(newProductLitresPerKeg) || 30;
    const lPerTon = newProductModel === 'bulk_truck' ? (parseFloat(newProductLitresPerTon) || 1075) : null;

    const varieties: ProductVariety[] = newProductVarieties
      .filter(v => v.name.trim())
      .map(v => ({
        id: v.id,
        name: v.name.trim(),
        rate_delta_per_litre: Math.round(parseFloat(v.delta) || 0)
      }));

    if (editingProductId) {
      updateProduct(editingProductId, {
        name: newProductName.trim(),
        supply_model: newProductModel,
        litres_per_keg: lPerKeg,
        litres_per_ton: lPerTon,
        keg_sell_price: kegSell,
        varieties: varieties.length ? varieties : undefined
      });
      showNotification(`Product ${newProductName.trim()} updated successfully.`);
    } else {
      addProduct({
        name: newProductName.trim(),
        supply_model: newProductModel,
        litres_per_keg: lPerKeg,
        litres_per_ton: lPerTon,
        keg_sell_price: kegSell,
        varieties: varieties.length ? varieties : undefined,
        color_light: newProductModel === 'bulk_truck' ? '#FEF3C7' : '#FEE2E2',
        color_dark: newProductModel === 'bulk_truck' ? '#78350F' : '#7F1D1D'
      });
      showNotification(`Product ${newProductName.trim()} added to depot catalog.`);
    }

    setIsProductModalOpen(false);
    setEditingProductId(null);
    setNewProductName('');
  };

  const handleOpenEditProduct = (prodId: string) => {
    const p = products.find(prod => prod.id === prodId);
    if (!p) return;
    setEditingProductId(p.id);
    setNewProductName(p.name);
    setNewProductModel(p.supply_model);
    setNewProductLitresPerKeg(p.litres_per_keg.toString());
    setNewProductLitresPerTon(p.litres_per_ton ? p.litres_per_ton.toString() : '1075');
    setNewProductKegSellPrice(p.keg_sell_price ? p.keg_sell_price.toString() : '3500');
    setNewProductVarieties(
      (p.varieties || []).map(v => ({ id: v.id, name: v.name, delta: v.rate_delta_per_litre.toString() }))
    );
    setIsProductModalOpen(true);
  };

  const handleOpenAddProduct = () => {
    setEditingProductId(null);
    setNewProductName('');
    setNewProductModel('bulk_truck');
    setNewProductLitresPerKeg('30');
    setNewProductLitresPerTon('1075');
    setNewProductKegSellPrice('3500');
    setNewProductVarieties([]);
    setIsProductModalOpen(true);
  };

  // Add Physical Tank
  const handleAddPhysicalTank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTankLabel.trim()) return;
    addPhysicalTank({
      label: newTankLabel.trim(),
      product_id: newTankProductId,
      capacity_litres: parseFloat(newTankCapacity) || 15000
    });
    setNewTankLabel('');
    showNotification('Physical yard tank registered successfully.');
  };

  // Add Supplier
  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    addSupplier({
      name: newSupplierName.trim(),
      phone: newSupplierPhone.trim() || '+234800000000'
    });
    setNewSupplierName('');
    setNewSupplierPhone('');
    showNotification('New depot supplier added.');
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
    if (window.confirm('Reset all demo data (tanks, orders, kegs, pumps, suppliers, physical tanks, expenses, pricing) to default factory seed values?')) {
      resetToSeedData();
      showNotification('Database reset to default factory seed data.');
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-[24px] font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>Depot Configuration & Master Settings</span>
          </h2>
          <p className="text-[14px] font-sans text-slate-500 dark:text-slate-400 mt-1">
            Single source of truth for depot brand identity, products & pricing catalog, permanent yard tanks, suppliers, and safety thresholds.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-[12px] font-sans font-semibold flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* MOBILE: iOS-Style Grouped Menu (split:hidden) */}
      <div className="split:hidden space-y-4">
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
                Palm: {productLitresPerKeg['red'] || '25'}L · Veg: {productLitresPerKeg['veg'] || '30'}L · {totalCompanyKegs} fleet
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
                Products & prices
              </div>
              <div className="text-[12px] font-sans text-slate-500 truncate mt-0.5">
                {products.length} managed products · 3 customer tiers
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </button>

          {/* Row 4: Physical Yard Tanks & Suppliers */}
          <button
            type="button"
            onClick={() => setActiveMobileSheet('infrastructure')}
            className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Warehouse className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Yard Tanks & Suppliers
              </div>
              <div className="text-[12px] font-sans text-slate-500 truncate mt-0.5">
                {physicalTanks.length} permanent tanks · {suppliers.length} suppliers
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </button>

          {/* Row 5: Operational Alert Thresholds */}
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
                Low tank: {lowStockThreshold}L · Shortfall: {truckShortfallThreshold}L
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </button>

          {/* Row 6: Daily Float & System Controls */}
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

      {/* DESKTOP (>=900px): SaaS Master-Detail Layout with Sub-Sidebar */}
      <div className="hidden split:grid split:grid-cols-12 gap-6 items-start">
        {/* Left Sub-Sidebar (split:col-span-4) */}
        <div className="split:col-span-4 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 shadow-sm sticky top-6">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-slate-400 px-3 py-2">
            Configuration Sections
          </div>

          {[
            {
              id: 'company' as const,
              title: 'Company & Branding',
              subtitle: companyName || 'Iyanuoluwa Oil',
              icon: Building,
              color: 'text-brand-600 dark:text-brand-400',
              bg: 'bg-brand-50 dark:bg-brand-500/15'
            },
            {
              id: 'kegs' as const,
              title: 'Keg Fleet Standards',
              subtitle: `Palm: ${productLitresPerKeg['red'] || '25'}L · Veg: ${productLitresPerKeg['veg'] || '30'}L`,
              icon: Package,
              color: 'text-amber-600 dark:text-amber-400',
              bg: 'bg-amber-50 dark:bg-amber-500/15'
            },
            {
              id: 'pricing' as const,
              title: 'Products & Rate Cards',
              subtitle: `${products.length} products · Catalog CRUD`,
              icon: DollarSign,
              color: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-emerald-50 dark:bg-emerald-500/15'
            },
            {
              id: 'infrastructure' as const,
              title: 'Yard Tanks & Suppliers',
              subtitle: `${physicalTanks.length} tanks · ${suppliers.length} suppliers`,
              icon: Warehouse,
              color: 'text-blue-600 dark:text-blue-400',
              bg: 'bg-blue-50 dark:bg-blue-500/15'
            },
            {
              id: 'thresholds' as const,
              title: 'Safety & Thresholds',
              subtitle: `Low: ${lowStockThreshold}L · Pump: ${pumpVarianceThreshold}L`,
              icon: AlertTriangle,
              color: 'text-rose-600 dark:text-rose-400',
              bg: 'bg-rose-50 dark:bg-rose-500/15'
            },
            {
              id: 'system' as const,
              title: 'Float & System Tools',
              subtitle: `Float: ${formatNaira(parseFloat(defaultDailyFloat) || 0)} · ${userRole}`,
              icon: Shield,
              color: 'text-purple-600 dark:text-purple-400',
              bg: 'bg-purple-50 dark:bg-purple-500/15'
            }
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeDesktopTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveDesktopTab(item.id)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all border ${
                  isActive
                    ? 'bg-brand-50/80 dark:bg-brand-950/40 border-brand-500 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-heading font-semibold text-[13px] truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] font-sans opacity-70 truncate">
                    {item.subtitle}
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${
                    isActive ? 'text-brand-600 dark:text-brand-400 translate-x-0.5' : 'text-slate-400 opacity-50'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right Content Pane (split:col-span-8) */}
        <div className="split:col-span-8 min-w-0">
          {activeDesktopTab === 'company' && (
            /* 1. COMPANY PROFILE */
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
                    className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-sans font-medium text-[15px] focus:outline-none focus:border-brand-500"
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
                      className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums text-[15px] focus:outline-none focus:border-brand-500"
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
                      className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[15px] font-sans font-medium focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-md transition-all flex items-center gap-2 active:scale-95"
                  >
                    <Save className="w-[18px] h-[18px]" />
                    <span>Save Company Profile</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeDesktopTab === 'kegs' && (
            /* 2. KEG CONFIGURATION */
            <form
              onSubmit={handleSaveKegConfig}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm"
            >
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  <span>2. Keg Configuration & Fleet Standards</span>
                </h3>
                <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                  Single source of truth for container volume conversions per product, physical fleet size, and depot safety reserve.
                </p>
              </div>

              {/* SECTION A: PER-PRODUCT PHYSICAL KEG VOLUMES (ADMIN CUSTOMIZABLE) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-[14px] font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <span>Physical Keg Volumes by Product (Customizable by Admin)</span>
                  </h4>
                  <span className="text-[11px] font-sans text-slate-500">
                    Controls litre and price calculation when selling in kegs or litres
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map(p => {
                    const isPalm = p.id === 'red' || p.supply_model === 'pre_kegged';
                    const currentL = productLitresPerKeg[p.id] ?? (p.litres_per_keg?.toString() || (isPalm ? '25' : '30'));
                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-xl border space-y-3 transition-all ${
                          isPalm
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                            : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: isPalm ? '#EF4444' : '#F59E0B' }}
                            />
                            <span className="font-heading font-bold text-[14px] text-slate-900 dark:text-white">
                              {p.name}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full uppercase ${
                              isPalm
                                ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {isPalm ? '📦 Pre-Kegged (No Pumps)' : '🚛 Bulk Truck (Pumps)'}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                            Capacity: Litres per Keg (L / keg)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.5"
                              min="1"
                              value={currentL}
                              onChange={e =>
                                setProductLitresPerKeg(prev => ({
                                  ...prev,
                                  [p.id]: e.target.value
                                }))
                              }
                              className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
                              required
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">
                              L / keg
                            </span>
                          </div>
                          <p className="text-[11px] font-sans text-slate-500 leading-snug">
                            {isPalm
                              ? 'Factory-supplied sealed jerrycan capacity. Cashiers sell in kegs or in litres; automatically converts based on this value without needing a dispensing pump.'
                              : 'Standard depot yellow jerrycan capacity filled at depot bulk dispensing pumps.'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION B: GLOBAL DEPOT FLEET ASSET CONTROLS */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-[14px] font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-slate-500" />
                  <span>Depot Fleet Asset &amp; Safety Controls</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Default Fallback L/Keg
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={litresPerKeg}
                        onChange={e => setLitresPerKeg(e.target.value)}
                        className="w-full px-3.5 py-3 min-h-[48px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">L/keg</span>
                    </div>
                    <p className="text-[11px] font-sans text-slate-500">Global fallback when no product-specific size is configured.</p>
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
                        className="w-full px-3.5 py-3 min-h-[48px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
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
                        className="w-full px-3.5 py-3 min-h-[48px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Kegs</span>
                    </div>
                    <p className="text-[11px] font-sans text-slate-500">Flags critical warning when depot yard stock drops below this.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-md transition-all flex items-center gap-2 active:scale-95"
                >
                  <Save className="w-[18px] h-[18px]" />
                  <span>Save Keg Parameters</span>
                </button>
              </div>
            </form>
          )}

          {activeDesktopTab === 'pricing' && (
            /* 3. PRODUCTS & MANAGED CATALOG WITH RATE CARD GRID */
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    <span>3. Products & prices</span>
                  </h3>
                  <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure supply models (Bulk Truck vs Pre-Kegged), container sizes, outright keg purchase prices, and pricing tiers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddProduct}
                  className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-sm flex items-center gap-1.5 transition-all self-start sm:self-auto active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Product</span>
                </button>
              </div>

              {/* Managed Product Catalog Cards */}
              <div className="space-y-3">
                <div className="text-[15px] font-sans font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <span>Active Products Catalog ({products.length})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map(p => {
                    const isVeg = p.id === 'veg';
                    return (
                      <div
                        key={p.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                            />
                            <span className="font-heading font-bold text-[15px] text-slate-900 dark:text-white">
                              {p.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditProduct(p.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                              title="Edit Product"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {products.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Delete product "${p.name}"?`)) {
                                    deleteProduct(p.id);
                                    showNotification(`Product "${p.name}" deleted.`);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Delete Product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[12px] font-mono tabular-nums">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-sans uppercase text-slate-500 block">Supply Model</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {p.supply_model === 'bulk_truck' ? 'By tanker truck' : 'Already in kegs'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-sans uppercase text-slate-500 block">Keg Container Size</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {p.litres_per_keg} Litres
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-sans uppercase text-slate-500 block">Density Multiplier</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {p.litres_per_ton ? `${p.litres_per_ton} L/Ton` : 'N/A (Pre-Kegged)'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-sans uppercase text-slate-500 block">Outright Keg Sell Price</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {formatNaira(p.keg_sell_price || 3500)}
                            </span>
                          </div>
                        </div>

                        {p.varieties && p.varieties.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.varieties.map(v => (
                              <span key={v.id} className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {v.name}
                                {v.rate_delta_per_litre ? ` (${v.rate_delta_per_litre > 0 ? '+' : ''}₦${v.rate_delta_per_litre})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Rate Card Matrix Table */}
              <form onSubmit={handleSaveProductsAndPricing} className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="text-[15px] font-sans font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-slate-400" />
                  <span>Prices by product and customer type</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-sans">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Customer Tier</th>
                        <th className="px-4 py-3">Rate per Litre (₦/L)</th>
                        <th className="px-4 py-3 text-right">Effective Keg Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono tabular-nums">
                      {products.map(p =>
                        (['retail', 'agent', 'corporate'] as const).map(tier => {
                          const key = `${p.id}_${tier}`;
                          const currentRate = parseFloat(rateCardRates[key]) || 0;
                          const effectiveKegPrice = currentRate * p.litres_per_keg;

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
                                    className="w-full pl-6 pr-3 py-2 min-h-[40px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                                    required
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-[14px]">
                                {formatNaira(effectiveKegPrice)}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">({p.litres_per_keg}L)</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-md transition-all flex items-center gap-2 active:scale-95"
                  >
                    <Save className="w-[18px] h-[18px]" />
                    <span>Save Rate Card Changes</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeDesktopTab === 'infrastructure' && (
            /* 4. PHYSICAL YARD TANKS & SUPPLIERS */
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>4. Yard Tanks & Supplier Registry</span>
                </h3>
                <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                  Permanent depot infrastructure tanks and approved supplier roster for offload provenance.
                </p>
              </div>

              {/* Physical Tanks Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[15px] font-sans font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Warehouse className="w-4 h-4 text-slate-400" />
                    <span>Permanent Yard Tanks ({physicalTanks.length})</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {physicalTanks.map(t => {
                    const prod = products.find(p => p.id === t.product_id);
                    return (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-sans font-bold text-slate-900 dark:text-white text-[13px]">
                            {t.label}
                          </div>
                          <div className="text-slate-500 font-mono mt-0.5">
                            Product: {prod?.name || 'Any'} · Capacity: {t.capacity_litres.toLocaleString()}L
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove physical tank "${t.label}"?`)) {
                              deletePhysicalTank(t.id);
                              showNotification(`Tank "${t.label}" removed.`);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add Physical Tank Form */}
                <form onSubmit={handleAddPhysicalTank} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-[13px] font-sans font-bold text-slate-800 dark:text-slate-200">
                    Register Permanent Yard Tank
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tank 4 (Bulk Storage)"
                      value={newTankLabel}
                      onChange={e => setNewTankLabel(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white"
                    />
                    <select
                      value={newTankProductId}
                      onChange={e => setNewTankProductId(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="500"
                        min="1000"
                        required
                        placeholder="Capacity (L)"
                        value={newTankCapacity}
                        onChange={e => setNewTankCapacity(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans font-bold text-xs shrink-0"
                      >
                        Add Tank
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Suppliers Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-[15px] font-sans font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>Approved Suppliers Roster ({suppliers.length})</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suppliers.map(s => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-sans font-bold text-slate-900 dark:text-white text-[13px]">
                          {s.name}
                        </div>
                        <div className="text-slate-500 font-mono mt-0.5">
                          Phone: {s.phone}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (suppliers.length <= 1) {
                            alert('At least one supplier must remain in the depot system.');
                            return;
                          }
                          if (window.confirm(`Delete supplier "${s.name}"?`)) {
                            deleteSupplier(s.id);
                            showNotification(`Supplier "${s.name}" removed.`);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Supplier Form */}
                <form onSubmit={handleAddSupplier} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-[13px] font-sans font-bold text-slate-800 dark:text-slate-200">
                    Register New Supplier
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Supplier Name (e.g. Presco Plc)"
                      value={newSupplierName}
                      onChange={e => setNewSupplierName(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Telephone / WhatsApp"
                      value={newSupplierPhone}
                      onChange={e => setNewSupplierPhone(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-xs"
                    >
                      Add Supplier
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeDesktopTab === 'thresholds' && (
            /* 5. ALERT THRESHOLDS */
            <form
              onSubmit={handleSaveAlertThresholds}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm"
            >
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  <span>5. Operational Alert & Variance Thresholds</span>
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
                      className="w-full px-3.5 py-3 min-h-[48px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
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
                      className="w-full px-3.5 py-3 min-h-[48px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
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
                      className="w-full px-3.5 py-3 min-h-[48px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Litres</span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-500">Flags Dashboard alert if unlogged pump sales discrepancy exceeds this.</p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-md transition-all flex items-center gap-2 active:scale-95"
                >
                  <Save className="w-[18px] h-[18px]" />
                  <span>Save Alert Thresholds</span>
                </button>
              </div>
            </form>
          )}

          {activeDesktopTab === 'system' && (
            /* 6. DAILY OPERATIONS FLOAT & SYSTEM CONTROLS */
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>6. Daily Float & System Tools</span>
                </h3>
                <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                  Daily petty cash float default, role simulation, and database reset tools.
                </p>
              </div>

              {/* Default Daily Float Form */}
              <form onSubmit={handleSaveDailyFloat} className="space-y-3">
                <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Default cash in the box each morning (₦)
                </label>
                <div className="relative max-w-sm">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={defaultDailyFloat}
                    onChange={e => setDefaultDailyFloat(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <p className="text-[11px] font-sans text-slate-500">
                  Pre-fills the counter's opening petty cash float every morning on the Expenses screen.
                </p>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-sm transition-all active:scale-95"
                >
                  Save Default Float
                </button>
              </form>

              {/* Operational Role Simulation */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Simulate Operational Access Role
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
                    Restores initial seed customers, tanks, pumps, suppliers, products, and sample records.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetData}
                  className="px-4 py-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80 text-[13px] font-sans font-bold transition-all active:scale-95"
                >
                  Reset Database
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PRODUCT ADD / EDIT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <h3 className="font-heading font-bold text-[16px] text-slate-900 dark:text-white">
                  {editingProductId ? 'Edit Managed Product' : 'Add New Depot Product'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductModal} className="p-5 space-y-4">
              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Refined Soya Oil"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Supply Model *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewProductModel('bulk_truck')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newProductModel === 'bulk_truck'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="text-[13px] font-bold">By tanker truck</div>
                    <div className="text-[11px] opacity-80 mt-0.5">Arrives in tons, offloaded to kegs</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewProductModel('pre_kegged')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newProductModel === 'pre_kegged'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="text-[13px] font-bold">Already in kegs</div>
                    <div className="text-[11px] opacity-80 mt-0.5">Arrives in sealed physical kegs</div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Litres per Keg (L/keg) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    placeholder="e.g. 25 or 30"
                    value={newProductLitresPerKeg}
                    onChange={e => setNewProductLitresPerKeg(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                    Per-product physical container size
                  </span>
                </div>

                {newProductModel === 'bulk_truck' ? (
                  <div>
                    <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Litres per Metric Ton *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="100"
                      required
                      placeholder="e.g. 1075"
                      value={newProductLitresPerTon}
                      onChange={e => setNewProductLitresPerTon(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                      Density conversion multiplier
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="text-[12px] font-sans font-bold uppercase text-slate-400 block mb-1">
                      Litres per Metric Ton
                    </label>
                    <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[12px] text-slate-500 italic">
                      N/A (Pre-kegged exact litres)
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Outright Keg Container Sell Price (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    placeholder="e.g. 3500"
                    value={newProductKegSellPrice}
                    onChange={e => setNewProductKegSellPrice(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-mono font-bold"
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                  Distinct price charged to customers purchasing the physical empty keg outright
                </span>
              </div>

              {/* Oil specs / varieties */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Oil Specs / Varieties
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewProductVarieties(vs => [
                        ...vs,
                        { id: `var-${Date.now()}`, name: '', delta: '0' }
                      ])
                    }
                    className="text-[11px] font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add spec
                  </button>
                </div>

                {newProductVarieties.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">
                    No specs — the counter sells this product at its plain tier rate.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {newProductVarieties.map((v, i) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={v.name}
                          onChange={e =>
                            setNewProductVarieties(vs => vs.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))
                          }
                          placeholder="e.g. Groundnut Blend"
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
                        />
                        <div className="relative w-28 shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]">₦</span>
                          <input
                            type="number"
                            step="50"
                            value={v.delta}
                            onChange={e =>
                              setNewProductVarieties(vs => vs.map((x, xi) => (xi === i ? { ...x, delta: e.target.value } : x)))
                            }
                            title="Rate change per litre vs the standard tier rate"
                            className="w-full pl-6 pr-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] font-mono font-bold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewProductVarieties(vs => vs.filter((_, xi) => xi !== i))}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                          aria-label="Remove spec"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-500">
                      The ₦ value adds to (or subtracts from) the customer's tier rate per litre. First spec is the counter default.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-xs"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
