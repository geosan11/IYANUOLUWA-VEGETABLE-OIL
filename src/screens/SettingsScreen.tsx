import React, { useState } from 'react';
import { useStore } from '../services/store';
import { useToast } from '../services/toast';
import { usePermissions } from '../services/permissions';
import { Modal } from '../components/common/Modal';
import { uploadDepotLogo, isSupabaseConfigured } from '../services/supabase';
import { formatNaira } from '../services/businessLogic';
import {
  Gear as Settings,
  Upload,
  Trash as Trash2,
  CheckCircle as CheckCircle2,
  Building,
  Shield,
  ArrowCounterClockwise as RotateCcw,
  Image as ImageIcon,
  Package,
  Sliders,
  CurrencyDollar as DollarSign,
  Warning as AlertTriangle,
  FloppyDisk as Save,
  CaretRight as ChevronRight,
  Plus,
  Warehouse,
  Buildings as Building2,
  Tag,
  PencilSimple as Edit2,
  X,
  Users,
  MapPin,
  GasPump,
  Info,
  Clock
} from '@phosphor-icons/react';
import { UserRole, SupplyModel, ProductVariety, Hub, UserProfile, Pump } from '../types';

type SettingsSectionId = 'company' | 'kegs' | 'pricing' | 'infrastructure' | 'thresholds' | 'system' | 'hubs' | 'users';

// Single source of truth for every configuration section's icon + color, so
// the desktop nav, mobile nav, and each tab's content-pane header can never
// drift out of sync with one another. Eight distinct Tailwind hue families —
// none repeated, none aliasing another (in particular, `company` uses real
// `emerald` rather than the `brand` class, since `brand-600` in
// tailwind.config.js is byte-identical to stock `emerald-600`).
const SECTION_THEME: Record<SettingsSectionId, { icon: React.ComponentType<any>; textCls: string; bgCls: string; borderCls: string }> = {
  company: { icon: Building, textCls: 'text-emerald-600 dark:text-emerald-400', bgCls: 'bg-emerald-50 dark:bg-emerald-500/15', borderCls: 'border-emerald-200 dark:border-emerald-500/30' },
  kegs: { icon: Package, textCls: 'text-amber-600 dark:text-amber-400', bgCls: 'bg-amber-50 dark:bg-amber-500/15', borderCls: 'border-amber-200 dark:border-amber-500/30' },
  pricing: { icon: DollarSign, textCls: 'text-violet-600 dark:text-violet-400', bgCls: 'bg-violet-50 dark:bg-violet-500/15', borderCls: 'border-violet-200 dark:border-violet-500/30' },
  infrastructure: { icon: GasPump, textCls: 'text-sky-600 dark:text-sky-400', bgCls: 'bg-sky-50 dark:bg-sky-500/15', borderCls: 'border-sky-200 dark:border-sky-500/30' },
  thresholds: { icon: AlertTriangle, textCls: 'text-rose-600 dark:text-rose-400', bgCls: 'bg-rose-50 dark:bg-rose-500/15', borderCls: 'border-rose-200 dark:border-rose-500/30' },
  system: { icon: Clock, textCls: 'text-orange-600 dark:text-orange-400', bgCls: 'bg-orange-50 dark:bg-orange-500/15', borderCls: 'border-orange-200 dark:border-orange-500/30' },
  hubs: { icon: Building2, textCls: 'text-indigo-600 dark:text-indigo-400', bgCls: 'bg-indigo-50 dark:bg-indigo-500/15', borderCls: 'border-indigo-200 dark:border-indigo-500/30' },
  users: { icon: Users, textCls: 'text-cyan-600 dark:text-cyan-400', bgCls: 'bg-cyan-50 dark:bg-cyan-500/15', borderCls: 'border-cyan-200 dark:border-cyan-500/30' }
};

export const SettingsScreen: React.FC = () => {
  const {
    products,
    physicalTanks,
    suppliers,
    settings,
    userRole,
    setUserRole,
    addProduct,
    updateProduct,
    deleteProduct,
    addPhysicalTank,
    updatePhysicalTank,
    deletePhysicalTank,
    addSupplier,
    deleteSupplier,
    updateSettings,
    resetToSeedData,
    hubs,
    users,
    currentUser,
    activeHubId,
    setCurrentUser,
    setActiveHubId,
    addHub,
    updateHub,
    deleteHub,
    addUser,
    updateUser,
    deleteUser,
    allTanks,
    allPumps,
    pumps,
    addPump,
    updatePump,
    deletePump
  } = useStore();

  // Only the owner can change pricing, products, thresholds, branding, or reset data.
  const { isOwner } = usePermissions();
  const denyIfNotOwner = () => {
    if (isOwner) return false;
    showNotification('Only the owner can change this. You are viewing as ' + userRole + '.', 'error');
    return true;
  };

  // Desktop Tab Navigation
  type SettingsTab = 'company' | 'kegs' | 'pricing' | 'infrastructure' | 'thresholds' | 'system' | 'hubs' | 'users';
  const [activeDesktopTab, setActiveDesktopTab] = useState<SettingsTab>('company');

  // Mobile BottomSheet Navigation
  const [activeMobileSheet, setActiveMobileSheet] = useState<SettingsTab | null>(null);

  // Hub Modal State
  const [isHubModalOpen, setIsHubModalOpen] = useState(false);
  const [editingHubId, setEditingHubId] = useState<string | null>(null);
  const [hubName, setHubName] = useState('');
  const [hubCode, setHubCode] = useState('');
  const [hubState, setHubState] = useState('Lagos');
  const [hubAddress, setHubAddress] = useState('');
  const [hubPhone, setHubPhone] = useState('');
  const [hubManagerName, setHubManagerName] = useState('');
  const [hubIsActive, setHubIsActive] = useState(true);

  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userRoleSelect, setUserRoleSelect] = useState<UserRole>('staff');
  const [userHubIdSelect, setUserHubIdSelect] = useState<string>(() => hubs[0]?.id || '');
  const [userIsActive, setUserIsActive] = useState(true);

  // Filters for user table
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userHubFilter, setUserHubFilter] = useState<string>('all');

  // 1. Company Profile Local State
  const [companyName, setCompanyName] = useState(settings.company_name);
  const [companyPhone, setCompanyPhone] = useState(settings.company_phone);
  const [companyAddress, setCompanyAddress] = useState(settings.company_address);
  const [isUploading, setIsUploading] = useState(false);

  // 2. Keg Configuration Local State
  const [litresPerKeg, setLitresPerKeg] = useState(settings.litres_per_keg.toString());
  const [totalCompanyKegs, setTotalCompanyKegs] = useState(settings.total_company_kegs.toString());
  const [kegsAtDepotLowThreshold, setKegsAtDepotLowThreshold] = useState(settings.kegs_at_depot_low_threshold.toString());

  // Per-product Litres per Keg (Company standard: 25L kegs)
  const [productLitresPerKeg, setProductLitresPerKeg] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    products.forEach(p => {
      map[p.id] = (p.litres_per_keg ?? 25).toString();
    });
    return map;
  });

  React.useEffect(() => {
    setProductLitresPerKeg(prev => {
      const next = { ...prev };
      products.forEach(p => {
        if (next[p.id] === undefined) {
          next[p.id] = (p.litres_per_keg ?? 25).toString();
        }
      });
      return next;
    });
  }, [products]);

  // Drives the Keg Fleet & Container Standards summary line (mobile row +
  // desktop sidebar) — built from whatever products actually exist instead
  // of hardcoded 'veg'/'red' lookups, so it stays correct as products are
  // added, renamed, or removed.
  const kegFleetSummaryText = products.length > 0
    ? products.map(p => `${p.name}: ${productLitresPerKeg[p.id] || (p.litres_per_keg ?? 25)}L`).join(' · ')
    : 'No products configured';


  // Add / Edit Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductModel, setNewProductModel] = useState<SupplyModel>('bulk_truck');
  const [newProductLitresPerKeg, setNewProductLitresPerKeg] = useState('30');
  const [newProductLitresPerTon, setNewProductLitresPerTon] = useState('1075');
  const [newProductKegSellPrice, setNewProductKegSellPrice] = useState('3500');
  const [newProductVarieties, setNewProductVarieties] = useState<{ id: string; name: string }[]>([]);

  // Add Physical Tank Form State
  const [newTankLabel, setNewTankLabel] = useState('');
  const [newTankProductId, setNewTankProductId] = useState(() => products[0]?.id || '');
  const [newTankCapacity, setNewTankCapacity] = useState('15000');
  const [newTankHubId, setNewTankHubId] = useState(() => activeHubId !== 'all' ? activeHubId : (hubs[0]?.id || ''));

  // Edit Physical Tank Modal State
  const [editingTankId, setEditingTankId] = useState<string | null>(null);
  const [editTankLabel, setEditTankLabel] = useState('');
  const [editTankProductId, setEditTankProductId] = useState('');
  const [editTankCapacity, setEditTankCapacity] = useState('');
  const [editTankHubId, setEditTankHubId] = useState('');

  // Add Supplier Form State
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  // Pump Management State (Scalable Counter Infrastructure)
  const [isPumpModalOpen, setIsPumpModalOpen] = useState(false);
  const [editingPumpId, setEditingPumpId] = useState<string | null>(null);
  const [pumpLabelInput, setPumpLabelInput] = useState('');
  const [pumpProductIdInput, setPumpProductIdInput] = useState(() => products[0]?.id || '');
  const [pumpTankIdInput, setPumpTankIdInput] = useState('');
  const [pumpReadingInput, setPumpReadingInput] = useState('0');
  const [pumpHubIdInput, setPumpHubIdInput] = useState(() => hubs[0]?.id || '');

  // 4. Alert Thresholds Local State
  const [lowStockThreshold, setLowStockThreshold] = useState(settings.low_stock_litres_threshold.toString());
  const [truckShortfallThreshold, setTruckShortfallThreshold] = useState(settings.truck_shortfall_threshold.toString());
  const [pumpVarianceThreshold, setPumpVarianceThreshold] = useState(settings.pump_variance_threshold.toString());

  // 5. Shift Schedule & Daily Operations Local State
  const [defaultDailyFloat, setDefaultDailyFloat] = useState(settings.default_daily_float.toString());
  const [shiftStartTime, setShiftStartTime] = useState(settings.shift_start_time || '07:00');
  const [shiftEndTime, setShiftEndTime] = useState(settings.shift_end_time || '18:00');
  const [requireStartPumpReadings, setRequireStartPumpReadings] = useState(settings.require_pump_readings_to_start_shift ?? true);
  const [requireClosePumpReadings, setRequireClosePumpReadings] = useState(settings.require_pump_readings_to_close_shift ?? true);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const { showToast } = useToast();

  const showNotification = (msg: string, kind: 'success' | 'error' = 'success') => {
    setStatusMsg(msg);
    showToast(kind, msg);
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
      showNotification(`Upload error: ${result.error || 'Failed to upload'}`, 'error');
    }
  };

  const handleRemoveLogo = () => {
    updateSettings({ company_logo_url: null });
    showNotification('Company logo removed.');
  };

  // 1. Save Company Profile
  const handleSaveCompanyInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (denyIfNotOwner()) return;
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
    if (denyIfNotOwner()) return;
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


  // Product Add / Edit Handler
  const handleSaveProductModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (denyIfNotOwner()) return;
    if (!newProductName.trim()) return;

    const kegSell = parseFloat(newProductKegSellPrice) || 3500;
    const lPerKeg = parseFloat(newProductLitresPerKeg) || 30;
    const lPerTon = newProductModel === 'bulk_truck' ? (parseFloat(newProductLitresPerTon) || 1075) : null;

    let varieties: ProductVariety[] = newProductVarieties
      .filter(v => v.name.trim())
      .map(v => ({ id: v.id, name: v.name.trim() }));
    if (varieties.length === 0) {
      varieties = [{ id: `var-${Date.now()}`, name: 'Standard' }];
    }

    if (editingProductId) {
      updateProduct(editingProductId, {
        name: newProductName.trim(),
        supply_model: newProductModel,
        litres_per_keg: lPerKeg,
        litres_per_ton: lPerTon,
        keg_sell_price: kegSell,
        varieties
      });
      showNotification(`Product ${newProductName.trim()} updated. Set its pack sizes and prices in Inventory.`);
    } else {
      addProduct({
        name: newProductName.trim(),
        supply_model: newProductModel,
        litres_per_keg: lPerKeg,
        litres_per_ton: lPerTon,
        keg_sell_price: kegSell,
        varieties,
        pack_config: [],
        color_light: newProductModel === 'bulk_truck' ? '#FEF3C7' : '#FEE2E2',
        color_dark: newProductModel === 'bulk_truck' ? '#78350F' : '#7F1D1D'
      });
      showNotification(`Product ${newProductName.trim()} added. Set its pack sizes and prices in Inventory.`);
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
    setNewProductVarieties((p.varieties || []).map(v => ({ id: v.id, name: v.name })));
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
      capacity_litres: parseFloat(newTankCapacity) || 15000,
      hub_id: newTankHubId || undefined
    });
    setNewTankLabel('');
    showNotification('Physical yard tank registered successfully.');
  };

  const handleOpenEditTank = (t: { id: string; label: string; product_id: string; capacity_litres: number; hub_id?: string }) => {
    setEditingTankId(t.id);
    setEditTankLabel(t.label);
    setEditTankProductId(t.product_id);
    setEditTankCapacity(t.capacity_litres.toString());
    setEditTankHubId(t.hub_id || '');
  };

  const handleSaveTankEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTankId || !editTankLabel.trim()) return;
    updatePhysicalTank(editingTankId, {
      label: editTankLabel.trim(),
      product_id: editTankProductId,
      capacity_litres: parseFloat(editTankCapacity) || 0,
      hub_id: editTankHubId || undefined
    });
    showNotification(`Tank "${editTankLabel.trim()}" updated successfully.`);
    setEditingTankId(null);
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
    if (denyIfNotOwner()) return;
    updateSettings({
      low_stock_litres_threshold: Math.max(0, parseFloat(lowStockThreshold) || 500),
      truck_shortfall_threshold: Math.max(0, parseFloat(truckShortfallThreshold) || 50),
      pump_variance_threshold: Math.max(0, parseFloat(pumpVarianceThreshold) || 20)
    });
    showNotification('Operational alert thresholds updated!');
    setActiveMobileSheet(null);
  };

  // 5. Save Shift Schedule & Daily Operations Float
  const handleSaveShiftSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (denyIfNotOwner()) return;
    const val = Math.max(0, parseFloat(defaultDailyFloat) || 150000);
    updateSettings({
      default_daily_float: val,
      shift_start_time: shiftStartTime || '07:00',
      shift_end_time: shiftEndTime || '18:00',
      require_pump_readings_to_start_shift: requireStartPumpReadings,
      require_pump_readings_to_close_shift: requireClosePumpReadings
    });
    showNotification('Shift schedule & operational controls updated successfully!');
    setActiveMobileSheet(null);
  };

  const handleResetData = () => {
    if (denyIfNotOwner()) return;
    if (window.confirm('Reset all demo data (tanks, orders, kegs, pumps, suppliers, physical tanks, expenses, pricing) to default factory seed values?')) {
      resetToSeedData();
      showNotification('Database reset to default factory seed data.');
    }
  };

  // Hub Management Handlers
  const handleOpenAddHub = () => {
    setEditingHubId(null);
    setHubName('');
    setHubCode('');
    setHubState('Lagos');
    setHubAddress('');
    setHubPhone('');
    setHubManagerName('');
    setHubIsActive(true);
    setIsHubModalOpen(true);
  };

  const handleOpenEditHub = (hub: Hub) => {
    setEditingHubId(hub.id);
    setHubName(hub.name);
    setHubCode(hub.code);
    setHubState(hub.state);
    setHubAddress(hub.address);
    setHubPhone(hub.phone || '');
    setHubManagerName(hub.manager_name || '');
    setHubIsActive(hub.is_active);
    setIsHubModalOpen(true);
  };

  const handleSaveHub = (e: React.FormEvent) => {
    e.preventDefault();
    if (denyIfNotOwner()) return;
    if (!hubName.trim() || !hubCode.trim() || !hubState.trim()) {
      showNotification('Please fill in required hub details.', 'error');
      return;
    }

    if (editingHubId) {
      updateHub(editingHubId, {
        name: hubName.trim(),
        code: hubCode.trim().toUpperCase(),
        state: hubState.trim(),
        address: hubAddress.trim(),
        phone: hubPhone.trim(),
        manager_name: hubManagerName.trim() || undefined,
        is_active: hubIsActive
      });
      showNotification(`Hub "${hubName.trim()}" updated successfully.`);
    } else {
      addHub({
        name: hubName.trim(),
        code: hubCode.trim().toUpperCase(),
        state: hubState.trim(),
        address: hubAddress.trim(),
        phone: hubPhone.trim(),
        manager_name: hubManagerName.trim() || undefined,
        is_active: hubIsActive
      });
      showNotification(`New hub "${hubName.trim()}" registered.`);
    }
    setIsHubModalOpen(false);
  };

  const handleDeleteHubAction = (hub: Hub) => {
    if (denyIfNotOwner()) return;
    if (!window.confirm(`Are you sure you want to delete "${hub.name}"?`)) return;
    const res = deleteHub(hub.id);
    if (!res.success) {
      showNotification(`Cannot delete hub: ${res.error}`, 'error');
    } else {
      showNotification(`Hub "${hub.name}" removed successfully.`);
    }
  };

  // User Management Handlers
  const handleOpenAddUser = () => {
    setEditingUserId(null);
    setUserFullName('');
    setUserEmail('');
    setUserPhone('');
    setUserRoleSelect('staff');
    setUserHubIdSelect(hubs[0]?.id || 'hub-los-alaba');
    setUserIsActive(true);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: UserProfile) => {
    setEditingUserId(u.id);
    setUserFullName(u.full_name);
    setUserEmail(u.email);
    setUserPhone(u.phone || '');
    setUserRoleSelect(u.role);
    setUserHubIdSelect(u.hub_id || 'all');
    setUserIsActive(u.active);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (denyIfNotOwner()) return;
    if (!userFullName.trim() || !userEmail.trim()) {
      showNotification('Full name and email are required.', 'error');
      return;
    }

    const assignedHubId: string | null = (userRoleSelect === 'owner' && userHubIdSelect === 'all')
      ? null
      : (userHubIdSelect === 'all' ? (hubs[0]?.id || null) : userHubIdSelect);

    if (editingUserId) {
      updateUser(editingUserId, {
        full_name: userFullName.trim(),
        email: userEmail.trim(),
        phone: userPhone.trim(),
        role: userRoleSelect,
        hub_id: assignedHubId,
        active: userIsActive
      });
      showNotification(`User "${userFullName.trim()}" updated.`);
    } else {
      addUser({
        full_name: userFullName.trim(),
        email: userEmail.trim(),
        phone: userPhone.trim(),
        role: userRoleSelect,
        hub_id: assignedHubId,
        active: userIsActive
      });
      showNotification(`New user "${userFullName.trim()}" added to ${userRoleSelect} role.`);
    }
    setIsUserModalOpen(false);
  };

  const handleDeleteUserAction = (u: UserProfile) => {
    if (denyIfNotOwner()) return;
    if (u.id === currentUser.id) {
      showNotification('Cannot delete your own active user account.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete user "${u.full_name}"?`)) return;
    const res = deleteUser(u.id);
    if (!res.success) {
      showNotification(`Cannot delete user: ${res.error}`, 'error');
    } else {
      showNotification(`User "${u.full_name}" removed.`);
    }
  };

  // Dispensing Pump Handlers
  const handleOpenAddPumpModal = () => {
    setEditingPumpId(null);
    setPumpLabelInput(`Pump ${pumps.length + 1} (${products[0]?.name || 'Bulk Oil'})`);
    setPumpProductIdInput(products[0]?.id || 'veg');
    setPumpTankIdInput(physicalTanks[0]?.id || '');
    setPumpReadingInput('0');
    setPumpHubIdInput(activeHubId === 'all' ? (hubs[0]?.id || 'hub-los-alaba') : activeHubId);
    setIsPumpModalOpen(true);
  };

  const handleOpenEditPumpModal = (pump: Pump) => {
    setEditingPumpId(pump.id);
    setPumpLabelInput(pump.label);
    setPumpProductIdInput(pump.product_id || products[0]?.id || 'veg');
    setPumpTankIdInput(pump.physical_tank_id || '');
    setPumpReadingInput(pump.last_meter_reading.toString());
    setPumpHubIdInput(pump.hub_id || hubs[0]?.id || 'hub-los-alaba');
    setIsPumpModalOpen(true);
  };

  const handleSavePump = (e: React.FormEvent) => {
    e.preventDefault();
    if (denyIfNotOwner()) return;

    if (!pumpLabelInput.trim()) {
      alert('Please enter a pump name or label.');
      return;
    }

    if (editingPumpId) {
      updatePump(editingPumpId, {
        label: pumpLabelInput.trim(),
        product_id: pumpProductIdInput || null,
        physical_tank_id: pumpTankIdInput || null,
        hub_id: pumpHubIdInput
      });
      showNotification(`Pump "${pumpLabelInput.trim()}" updated successfully.`);
    } else {
      addPump({
        label: pumpLabelInput.trim(),
        productId: pumpProductIdInput || undefined,
        physicalTankId: pumpTankIdInput || null,
        openingReading: parseFloat(pumpReadingInput) || 0,
        hubId: pumpHubIdInput
      });
      showNotification(`New pump "${pumpLabelInput.trim()}" registered and ready.`);
    }
    setIsPumpModalOpen(false);
  };

  const handleDeletePumpAction = (pump: Pump) => {
    if (denyIfNotOwner()) return;
    if (pumps.length <= 1) {
      alert('A depot must maintain at least one operational dispensing pump.');
      return;
    }
    if (window.confirm(`Are you sure you want to remove ${pump.label}?`)) {
      const res = deletePump(pump.id);
      if (!res.success) {
        alert(res.error || 'Could not delete this pump.');
      } else {
        showNotification(`Pump "${pump.label}" has been removed.`);
      }
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
        <div role="status" aria-live="polite" className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-[12px] font-sans font-semibold flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {!isOwner && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[13px] font-sans flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            You are viewing settings as <span className="font-bold capitalize">{userRole}</span>. Pricing, products,
            thresholds, branding, and data reset are read-only — only the owner can change them.
          </span>
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
            <div className={`w-10 h-10 rounded-xl ${SECTION_THEME.company.bgCls} border ${SECTION_THEME.company.borderCls} flex items-center justify-center flex-shrink-0`}>
              <Building className={`w-5 h-5 ${SECTION_THEME.company.textCls}`} weight="bold" />
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
            <div className={`w-10 h-10 rounded-xl ${SECTION_THEME.kegs.bgCls} border ${SECTION_THEME.kegs.borderCls} flex items-center justify-center flex-shrink-0`}>
              <Package className={`w-5 h-5 ${SECTION_THEME.kegs.textCls}`} weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Keg Fleet & Container Standards
              </div>
              <div className="text-[12px] font-mono tabular-nums text-slate-500 truncate mt-0.5">
                {kegFleetSummaryText} · {totalCompanyKegs} fleet
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
            <div className={`w-10 h-10 rounded-xl ${SECTION_THEME.pricing.bgCls} border ${SECTION_THEME.pricing.borderCls} flex items-center justify-center flex-shrink-0`}>
              <DollarSign className={`w-5 h-5 ${SECTION_THEME.pricing.textCls}`} weight="bold" />
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

          {/* Row 4: Physical Infrastructure & Dispensing Pumps */}
          <button
            type="button"
            onClick={() => setActiveMobileSheet('infrastructure')}
            className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100"
          >
            <div className={`w-10 h-10 rounded-xl ${SECTION_THEME.infrastructure.bgCls} border ${SECTION_THEME.infrastructure.borderCls} flex items-center justify-center flex-shrink-0`}>
              <GasPump className={`w-5 h-5 ${SECTION_THEME.infrastructure.textCls}`} weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Tanks, Dispensing Pumps & Suppliers
              </div>
              <div className="text-[12px] font-sans text-slate-500 truncate mt-0.5">
                {pumps.length} pumps · {physicalTanks.length} tanks · {suppliers.length} suppliers
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
            <div className={`w-10 h-10 rounded-xl ${SECTION_THEME.thresholds.bgCls} border ${SECTION_THEME.thresholds.borderCls} flex items-center justify-center flex-shrink-0`}>
              <AlertTriangle className={`w-5 h-5 ${SECTION_THEME.thresholds.textCls}`} weight="bold" />
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

          {/* Row 6: Shift Schedule & System Controls */}
          <button
            type="button"
            onClick={() => setActiveMobileSheet('system')}
            className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100"
          >
            <div className={`w-10 h-10 rounded-xl ${SECTION_THEME.system.bgCls} border ${SECTION_THEME.system.borderCls} flex items-center justify-center flex-shrink-0`}>
              <Clock className={`w-5 h-5 ${SECTION_THEME.system.textCls}`} weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Shift Schedule & Operations
              </div>
              <div className="text-[12px] font-mono tabular-nums text-slate-500 truncate mt-0.5">
                Hours: {shiftStartTime} – {shiftEndTime} · Float: {formatNaira(parseFloat(defaultDailyFloat) || 0)}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </button>

          {/* Row 7: Hubs & Depots */}
          <button
            type="button"
            onClick={() => setActiveMobileSheet('hubs')}
            className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100"
          >
            <div className={`w-10 h-10 rounded-xl ${SECTION_THEME.hubs.bgCls} border ${SECTION_THEME.hubs.borderCls} flex items-center justify-center flex-shrink-0`}>
              <Building2 className={`w-5 h-5 ${SECTION_THEME.hubs.textCls}`} weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Hubs & Depots Network
              </div>
              <div className="text-[12px] font-sans text-slate-500 truncate mt-0.5">
                {hubs.length} depots · Multi-hub isolation
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </button>

          {/* Row 8: Team & Access Control */}
          <button
            type="button"
            onClick={() => setActiveMobileSheet('users')}
            className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100"
          >
            <div className={`w-10 h-10 rounded-xl ${SECTION_THEME.users.bgCls} border ${SECTION_THEME.users.borderCls} flex items-center justify-center flex-shrink-0`}>
              <Users className={`w-5 h-5 ${SECTION_THEME.users.textCls}`} weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-slate-900 dark:text-white text-[14px] truncate">
                Team & Hub Access
              </div>
              <div className="text-[12px] font-sans text-slate-500 truncate mt-0.5">
                {users.length} members · Role & hub scoping
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
              subtitle: companyName || 'Iyanuoluwa Oil'
            },
            {
              id: 'kegs' as const,
              title: 'Keg Fleet Standards',
              subtitle: kegFleetSummaryText
            },
            {
              id: 'pricing' as const,
              title: 'Products & Rate Cards',
              subtitle: `${products.length} products · Catalog CRUD`
            },
            {
              id: 'infrastructure' as const,
              title: 'Tanks, Pumps & Suppliers',
              subtitle: `${pumps.length} pumps · ${physicalTanks.length} tanks · ${suppliers.length} suppliers`
            },
            {
              id: 'thresholds' as const,
              title: 'Safety & Thresholds',
              subtitle: `Low: ${lowStockThreshold}L · Pump: ${pumpVarianceThreshold}L`
            },
            {
              id: 'system' as const,
              title: 'Shift Schedule & Operations',
              subtitle: `Hours: ${shiftStartTime} – ${shiftEndTime} · Float: ${formatNaira(parseFloat(defaultDailyFloat) || 0)}`
            },
            {
              id: 'hubs' as const,
              title: 'Hubs & Depots',
              subtitle: `${hubs.length} depots · Multi-depot network`
            },
            {
              id: 'users' as const,
              title: 'Team & User Access',
              subtitle: `${users.length} members · Role & hub scoping`
            }
          ].map(item => {
            const theme = SECTION_THEME[item.id];
            const Icon = theme.icon;
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
                <div className={`w-9 h-9 rounded-lg ${theme.bgCls} border ${theme.borderCls} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${theme.textCls}`} weight="bold" />
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
                  <Building className={`w-5 h-5 ${SECTION_THEME.company.textCls}`} weight="bold" />
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
                  <label htmlFor="company-name" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Registered Business Name
                  </label>
                  <input
                    id="company-name"
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-sans font-medium text-[15px] focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="company-phone" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Depot Telephone
                    </label>
                    <input
                      id="company-phone"
                      type="text"
                      value={companyPhone}
                      onChange={e => setCompanyPhone(e.target.value)}
                      className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums text-[15px] focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="company-address" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Physical Depot Address
                    </label>
                    <input
                      id="company-address"
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
                    <Save className="w-[18px] h-[18px]" weight="bold" />
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
                  <Package className={`w-5 h-5 ${SECTION_THEME.kegs.textCls}`} weight="bold" />
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
                    const isPalm = p.supply_model === 'pre_kegged';
                    const currentL = productLitresPerKeg[p.id] ?? (p.litres_per_keg?.toString() || '25');
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
                            <span className={`w-3 h-3 rounded-full ${isPalm ? 'bg-palmoil-500' : 'bg-vegoil-500'}`} />
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
                          <label htmlFor={`product-litres-per-keg-${p.id}`} className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                            Capacity: Litres per Keg (L / keg)
                          </label>
                          <div className="relative">
                            <input
                              id={`product-litres-per-keg-${p.id}`}
                              type="number"
                              step="1"
                              min="0"
                              value={currentL}
                              onChange={e =>
                                setProductLitresPerKeg(prev => ({
                                  ...prev,
                                  [p.id]: e.target.value.replace(/[^0-9]/g, '')
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
                    <label htmlFor="default-fallback-litres-per-keg" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Default Fallback L/Keg
                    </label>
                    <div className="relative">
                      <input
                        id="default-fallback-litres-per-keg"
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
                    <label htmlFor="total-company-kegs" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Total Company Fleet Owned
                    </label>
                    <div className="relative">
                      <input
                        id="total-company-kegs"
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
                    <label htmlFor="kegs-depot-low-threshold" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Depot Low Stock Alert Threshold
                    </label>
                    <div className="relative">
                      <input
                        id="kegs-depot-low-threshold"
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
                  <Save className="w-[18px] h-[18px]" weight="bold" />
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
                    <DollarSign className={`w-5 h-5 ${SECTION_THEME.pricing.textCls}`} weight="bold" />
                    <span>3. Products & prices</span>
                  </h3>
                  <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure supply models (Bulk Truck vs Pre-Kegged), container sizes, outright keg purchase prices, and pricing tiers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddProduct}
                  disabled={!isOwner}
                  title={isOwner ? undefined : 'Only the owner can add products'}
                  className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-sm flex items-center gap-1.5 transition-all self-start sm:self-auto active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-500 disabled:active:scale-100"
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
                    return (
                      <div
                        key={p.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color_light }} />
                            <span className="font-heading font-bold text-[15px] text-slate-900 dark:text-white">
                              {p.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditProduct(p.id)}
                              disabled={!isOwner}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              title={isOwner ? 'Edit Product' : 'Only the owner can edit products'}
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
                                disabled={!isOwner}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                title={isOwner ? 'Delete Product' : 'Only the owner can delete products'}
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
                            <span className="text-[10px] font-sans uppercase text-slate-500 block">Fallback Container Price</span>
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
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pricing moved to the Inventory tab */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="p-4 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 flex items-start gap-3">
                  <Sliders className="w-4 h-4 text-brand-600 dark:text-brand-400 mt-0.5 shrink-0" />
                  <div className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    <span className="font-sans font-semibold text-slate-900 dark:text-white">
                      Prices are managed in the Inventory tab.
                    </span>{' '}
                    Set the price for every pack size, variety and customer tier there, plus which
                    sizes each product sells and its returnable-container rules.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeDesktopTab === 'infrastructure' && (
            /* 4. PHYSICAL YARD TANKS, DISPENSING PUMPS & SUPPLIERS */
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <GasPump className={`w-5 h-5 ${SECTION_THEME.infrastructure.textCls}`} weight="bold" />
                  <span>4. Yard Storage Tanks, Dispensing Pumps & Verified Suppliers</span>
                </h3>
                <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                  Permanent storage vessels, scalable counter flow meters for bulk oil, and approved road tanker supplier directory.
                </p>
              </div>

              {/* Dispensing Pumps Section (Scalable counter infrastructure) */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-[15px] font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <GasPump className={`w-4 h-4 ${SECTION_THEME.infrastructure.textCls}`} weight="bold" />
                      <span>Dispensing Pumps & Counter Flow Meters ({pumps.length} Active, Scalable)</span>
                    </h4>
                    <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                      Mechanical and digital counter totalizers that track bulk oil pumped into customer containers.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAddPumpModal}
                    className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" weight="bold" />
                    <span>+ Add Dispensing Pump</span>
                  </button>
                </div>

                {/* Comprehensible Info Banner */}
                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Why Pump Totalizers Matter for Daily Depot Operations</span>
                  </div>
                  <p className="leading-relaxed opacity-90">
                    Pumps only count upwards. Each morning before sales begin, staff must log opening meter readings. At the end of the day, the change in meter readings is audited against recorded sales to instantly detect any stolen or unmetered oil. You can add more pumps as you expand counter lanes.
                  </p>
                </div>

                {/* Pumps Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pumps.map(pump => {
                    const sourceTank = physicalTanks.find(t => t.id === pump.physical_tank_id);
                    const prod = products.find(p => p.id === pump.product_id);
                    const pumpHub = hubs.find(h => h.id === pump.hub_id);

                    return (
                      <div
                        key={pump.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between text-xs space-y-3 shadow-2xs"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-heading font-bold text-slate-900 dark:text-white text-[13px] flex items-center gap-1.5">
                              <GasPump className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{pump.label}</span>
                            </span>
                            <span className="badge-emerald inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Operational
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                            <div>
                              <span className="text-slate-400">Product:</span>{' '}
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{prod?.name || 'Bulk Oil'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Source:</span>{' '}
                              <span>{sourceTank ? sourceTank.label : 'Direct / Unassigned'}</span>
                            </div>
                            {pumpHub && (
                              <div>
                                <span className="text-slate-400">Hub:</span>{' '}
                                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{pumpHub.name}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Current Meter</div>
                            <div className="font-mono font-bold text-[13px] text-slate-900 dark:text-white">
                              {pump.last_meter_reading.toLocaleString()} L
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditPumpModal(pump)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/15 transition-colors"
                              title="Edit Pump Details"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePumpAction(pump)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Delete Pump"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Physical Tanks Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
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
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTank(t)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/15 transition-colors"
                            title="Edit Tank"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Remove physical tank "${t.label}"?`)) {
                                const res = deletePhysicalTank(t.id);
                                if (!res.success) {
                                  showNotification(`Cannot delete tank: ${res.error}`, 'error');
                                } else {
                                  showNotification(`Tank "${t.label}" removed.`);
                                }
                              }
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Delete Tank"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Physical Tank Form */}
                <form onSubmit={handleAddPhysicalTank} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-[13px] font-sans font-bold text-slate-800 dark:text-slate-200">
                    Register Permanent Yard Tank
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                    <select
                      value={newTankHubId}
                      onChange={e => setNewTankHubId(e.target.value)}
                      title="Assigned Depot Hub"
                      className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    >
                      {hubs.map(h => (
                        <option key={h.id} value={h.id}>[{h.code}] {h.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        required
                        placeholder="Capacity (L)"
                        value={newTankCapacity}
                        onChange={e => setNewTankCapacity(e.target.value.replace(/[^0-9]/g, ''))}
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
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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
                  <AlertTriangle className={`w-5 h-5 ${SECTION_THEME.thresholds.textCls}`} weight="bold" />
                  <span>5. Operational Alert & Variance Thresholds</span>
                </h3>
                <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                  Set real-time triggers for depot oil shrinkage, truck offload shortages, and pump meter audit alerts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <label htmlFor="low-stock-threshold" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Low Depot Tank Stock Alert
                  </label>
                  <div className="relative">
                    <input
                      id="low-stock-threshold"
                      type="number"
                      step="1"
                      min="0"
                      value={lowStockThreshold}
                      onChange={e => setLowStockThreshold(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-3.5 py-3 min-h-[48px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Litres</span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-500">Flags low storage warning when remaining tank stock drops below this.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <label htmlFor="truck-shortfall-threshold" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Truck Intake Shortfall Flag
                  </label>
                  <div className="relative">
                    <input
                      id="truck-shortfall-threshold"
                      type="number"
                      step="1"
                      min="0"
                      value={truckShortfallThreshold}
                      onChange={e => setTruckShortfallThreshold(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-3.5 py-3 min-h-[48px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono tabular-nums text-[11px]">Litres</span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-500">Flags red warning if delivery offload shortfall exceeds this limit.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <label htmlFor="pump-variance-threshold" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Pump Meter Variance Flag
                  </label>
                  <div className="relative">
                    <input
                      id="pump-variance-threshold"
                      type="number"
                      step="1"
                      min="0"
                      value={pumpVarianceThreshold}
                      onChange={e => setPumpVarianceThreshold(e.target.value.replace(/[^0-9]/g, ''))}
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
                  <Save className="w-[18px] h-[18px]" weight="bold" />
                  <span>Save Alert Thresholds</span>
                </button>
              </div>
            </form>
          )}

          {activeDesktopTab === 'system' && (
            /* 6. SHIFT SCHEDULE, DAILY OPERATIONS FLOAT & SYSTEM CONTROLS */
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${SECTION_THEME.system.textCls}`} weight="bold" />
                  <span>6. Shift Schedule, Daily Float & System Tools</span>
                </h3>
                <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure when shifts are scheduled to begin and end, meter reading policies, morning float, and role simulation.
                </p>
              </div>

              {/* Shift Schedule & Operational Policies Form */}
              <form onSubmit={handleSaveShiftSchedule} className="space-y-5">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800/70 pb-3">
                    <div>
                      <h4 className="text-[13px] font-heading font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        <span>Depot Shift Operating Hours</span>
                      </h4>
                      <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                        Define scheduled counter opening and closing times for dispensing and customer transactions.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-700 dark:text-brand-400 text-xs font-mono font-semibold">
                      <span>Window:</span>
                      <span className="font-bold">{shiftStartTime} – {shiftEndTime}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="shift-start-time" className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                        Shift Begin Time *
                      </label>
                      <div className="relative">
                        <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="shift-start-time"
                          type="time"
                          value={shiftStartTime}
                          onChange={e => setShiftStartTime(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-[14px] focus:outline-none focus:border-brand-500"
                          required
                        />
                      </div>
                      <p className="text-[11px] font-sans text-slate-500 mt-1">
                        Expected time cashier opens counter and takes opening 3-pump readings.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="shift-end-time" className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                        Shift End Time *
                      </label>
                      <div className="relative">
                        <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="shift-end-time"
                          type="time"
                          value={shiftEndTime}
                          onChange={e => setShiftEndTime(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-[14px] focus:outline-none focus:border-brand-500"
                          required
                        />
                      </div>
                      <p className="text-[11px] font-sans text-slate-500 mt-1">
                        Expected time counter closes, taking closing readings and reconciling cash.
                      </p>
                    </div>
                  </div>

                  {/* Operational Policy Toggles */}
                  <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2.5">
                    <label className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                      Enforcement Policies
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={requireStartPumpReadings}
                        onChange={e => setRequireStartPumpReadings(e.target.checked)}
                        className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          Mandatory 3-Pump Opening Meter Readings (Lock Sales Screen)
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          Cashiers cannot enter new sales until meter readings for Pump 1, Pump 2, and Pump 3 are entered and verified.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={requireClosePumpReadings}
                        onChange={e => setRequireClosePumpReadings(e.target.checked)}
                        className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          Mandatory 3-Pump Closing Meter Readings (Volume Reconciliation)
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          Cashiers must log closing pump readings to compute litres dispensed before the shift can be closed.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Default Daily Float Form */}
                <div className="space-y-3">
                  <label htmlFor="default-daily-float" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Default Opening Cash Float in Box each Morning (₦)
                  </label>
                  <div className="relative max-w-sm">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
                    <input
                      id="default-daily-float"
                      type="number"
                      step="1"
                      min="0"
                      value={defaultDailyFloat}
                      onChange={e => setDefaultDailyFloat(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full pl-8 pr-4 py-3 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                  <p className="text-[11px] font-sans text-slate-500">
                    Pre-fills the counter's opening petty cash float every morning on the Expenses screen and start-shift pop-up.
                  </p>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-sm transition-all active:scale-95 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Shift Schedule & Float</span>
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
                    { id: 'hub_manager', label: 'Hub Manager', desc: 'Depot Branch Manager, yard authority, credit approvals.' },
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
                  disabled={!isOwner}
                  title={isOwner ? undefined : 'Only the owner can reset the database'}
                  className="px-4 py-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80 text-[13px] font-sans font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  Reset Database
                </button>
              </div>
            </div>
          )}

          {activeDesktopTab === 'hubs' && (
            /* 7. HUBS & MULTI-DEPOT OPERATIONS */
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className={`w-5 h-5 ${SECTION_THEME.hubs.textCls}`} weight="bold" />
                    <span>7. Hubs & Multi-Depot Operations</span>
                  </h3>
                  <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure regional depots and distribution hubs. Hubs in the same state (e.g. Lagos Alaba & Ikeja) operate with strict independent tanks, pumps, shifts, and cash boxes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddHub}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-[13px] shadow-sm flex items-center gap-2 transition-all active:scale-95 shrink-0 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" weight="bold" />
                  <span>Register New Hub</span>
                </button>
              </div>

              {/* Active Hub Scope Indicator */}
              <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <MapPin className="w-5 h-5" weight="bold" />
                  </div>
                  <div>
                    <div className="text-xs text-indigo-700 dark:text-indigo-300 font-sans font-semibold uppercase tracking-wider">
                      Current Operational Scope
                    </div>
                    <div className="text-sm font-heading font-bold text-slate-900 dark:text-white">
                      {activeHubId === 'all'
                        ? '🌐 All Hubs Consolidated (Global Overview)'
                        : `📍 ${hubs.find(h => h.id === activeHubId)?.name || 'Selected Hub'} (${hubs.find(h => h.id === activeHubId)?.code})`}
                    </div>
                  </div>
                </div>

                {isOwner && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-sans text-slate-500">Quick Scope:</span>
                    <select
                      value={activeHubId}
                      onChange={e => {
                        setActiveHubId(e.target.value);
                        showNotification(`Operational scope switched to ${e.target.value === 'all' ? 'All Hubs' : hubs.find(h => h.id === e.target.value)?.name}`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      <option value="all">🌐 All Hubs Consolidated</option>
                      {hubs.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.state})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Hubs Grouped by State */}
              <div className="space-y-6">
                {Array.from(new Set(hubs.map(h => h.state))).map(stateName => {
                  const stateHubs = hubs.filter(h => h.state === stateName);
                  return (
                    <div key={stateName} className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{stateName} State</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                          {stateHubs.length} {stateHubs.length === 1 ? 'Depot' : 'Depots'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stateHubs.map(hub => {
                          const tankCount = allTanks.filter(t => t.hub_id === hub.id).length;
                          const pumpCount = allPumps.filter(p => p.hub_id === hub.id).length;
                          const staffCount = users.filter(u => u.hub_id === hub.id).length;
                          const isHubSelected = activeHubId === hub.id;

                          return (
                            <div
                              key={hub.id}
                              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                                isHubSelected
                                  ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-400 shadow-sm'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                              }`}
                            >
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-heading font-bold text-slate-900 dark:text-white text-[15px]">
                                        {hub.name}
                                      </h4>
                                      <span className="badge-indigo px-2 py-0.5 rounded-md font-mono text-[11px]">
                                        {hub.code}
                                      </span>
                                    </div>
                                    <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1">
                                      <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                                      <span>{hub.address}</span>
                                    </p>
                                  </div>

                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${
                                      hub.is_active
                                        ? 'badge-emerald'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold'
                                    }`}
                                  >
                                    {hub.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>

                                <div className="text-[12px] font-sans text-slate-600 dark:text-slate-300 space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400">Branch Manager:</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                      {hub.manager_name || 'Not assigned'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400">Contact Phone:</span>
                                    <span className="font-mono">{hub.phone}</span>
                                  </div>
                                </div>

                                {/* Operational Counters — clickable: jump straight to that
                                    hub's tanks/pumps/team, scoped to this hub, instead of a
                                    dead-end number you'd have to go hunt down elsewhere. */}
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveHubId(hub.id);
                                      setActiveDesktopTab('infrastructure');
                                      showNotification(`Viewing tanks for ${hub.name}`);
                                    }}
                                    title={`Edit ${hub.name}'s tanks`}
                                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                                  >
                                    <div className="text-base font-bold font-mono text-slate-900 dark:text-white">
                                      {tankCount}
                                    </div>
                                    <div className="text-[10px] uppercase font-sans text-slate-500">Tanks</div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveHubId(hub.id);
                                      setActiveDesktopTab('infrastructure');
                                      showNotification(`Viewing pumps for ${hub.name}`);
                                    }}
                                    title={`Edit ${hub.name}'s pumps`}
                                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                                  >
                                    <div className="text-base font-bold font-mono text-slate-900 dark:text-white">
                                      {pumpCount}
                                    </div>
                                    <div className="text-[10px] uppercase font-sans text-slate-500">Pumps</div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveHubId(hub.id);
                                      setUserHubFilter(hub.id);
                                      setActiveDesktopTab('users');
                                      showNotification(`Viewing team for ${hub.name}`);
                                    }}
                                    title={`Edit ${hub.name}'s team`}
                                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                                  >
                                    <div className="text-base font-bold font-mono text-slate-900 dark:text-white">
                                      {staffCount}
                                    </div>
                                    <div className="text-[10px] uppercase font-sans text-slate-500">Personnel</div>
                                  </button>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveHubId(hub.id);
                                    showNotification(`Switched operational view to ${hub.name}`);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    isHubSelected
                                      ? 'bg-indigo-600 text-white shadow-xs'
                                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {isHubSelected ? '✓ Active View' : 'Switch to Hub'}
                                </button>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditHub(hub)}
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/15 transition-colors"
                                    title="Edit Hub Details"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  {hubs.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteHubAction(hub)}
                                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                                      title="Delete Hub"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeDesktopTab === 'users' && (
          <div className="space-y-6">
            {/* TEAM & USER ACCESS CONTROL — local/offline-only roster.
                This has no Supabase account behind it (no login, no password),
                so it only makes sense to show when there's no real account
                system to manage instead — that now lives on its own
                owner-only Staff Management screen (see StaffManagementScreen). */}
            {!isSupabaseConfigured && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className={`w-5 h-5 ${SECTION_THEME.users.textCls}`} weight="bold" />
                    <span>8. Local Team Roster (Offline Mode)</span>
                  </h3>
                  <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                    No Supabase connection is configured for this deployment, so there are no real logins yet — this roster is a local, device-only stand-in with no password or account behind it. Connect Supabase to manage real team accounts instead.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddUser}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-sans font-bold text-[13px] shadow-sm flex items-center gap-2 transition-all active:scale-95 shrink-0 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" weight="bold" />
                  <span>Add Team Member</span>
                </button>
              </div>

              {/* Role and Hub Filters */}
              <div className="flex flex-wrap items-center gap-2 pt-1 pb-1 text-xs">
                <span className="text-slate-400 font-sans font-medium mr-1">Filter:</span>
                {[
                  { id: 'all', label: 'All Roles' },
                  { id: 'owner', label: 'Owners' },
                  { id: 'hub_manager', label: 'Hub Managers' },
                  { id: 'staff', label: 'Counter Staff' },
                  { id: 'driver', label: 'Drivers' }
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setUserRoleFilter(r.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      userRoleFilter === r.id
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-slate-400 font-sans">Hub:</span>
                  <select
                    value={userHubFilter}
                    onChange={e => setUserHubFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <option value="all">All Depots</option>
                    {hubs.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* User List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                {users
                  .filter(u => userRoleFilter === 'all' || u.role === userRoleFilter)
                  .filter(u => userHubFilter === 'all' || u.hub_id === userHubFilter)
                  .map(u => {
                    const assignedHub = hubs.find(h => h.id === u.hub_id);
                    const isCurrentUser = currentUser.id === u.id;

                    const roleBadge = {
                      owner: { label: 'Owner (Global)', bg: 'badge-amber' },
                      hub_manager: { label: 'Hub Manager', bg: 'badge-indigo' },
                      staff: { label: 'Counter Staff', bg: 'badge-emerald' },
                      driver: { label: 'Driver / Logistics', bg: 'badge-sky' }
                    }[u.role] || { label: u.role, bg: 'bg-slate-100 text-slate-800' };

                    return (
                      <div
                        key={u.id}
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                          isCurrentUser
                            ? 'bg-cyan-50/30 dark:bg-cyan-950/20'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 flex items-center justify-center font-bold text-sm shrink-0">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-heading font-bold text-[14px] text-slate-900 dark:text-white truncate">
                                {u.full_name}
                              </span>
                              {isCurrentUser && (
                                <span className="px-2 py-0.5 rounded-full bg-cyan-600 text-white font-sans text-[10px] font-bold">
                                  You
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${roleBadge.bg}`}>
                                {roleBadge.label}
                              </span>
                            </div>
                            <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>{u.email}</span>
                              <span>·</span>
                              <span className="font-mono">{u.phone}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {/* Hub Assignment Badge */}
                          <div className="text-left md:text-right">
                            <div className="text-[10px] font-sans uppercase font-bold text-slate-400">
                              Assigned Hub
                            </div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                              {assignedHub ? (
                                <>
                                  <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>{assignedHub.name} ({assignedHub.state})</span>
                                </>
                              ) : (
                                <span className="text-slate-400 italic">🌐 Global Access</span>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5 ml-auto md:ml-2">
                            {!isCurrentUser && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentUser(u);
                                  showNotification(`Switched active account to ${u.full_name} (${roleBadge.label})`);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-700 dark:hover:text-cyan-300 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all active:scale-95"
                              >
                                Switch Account
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/15 transition-colors"
                              title="Edit User"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {!isCurrentUser && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUserAction(u)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* PRODUCT ADD / EDIT MODAL */}
      {isProductModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsProductModalOpen(false)}
          title={
            <span className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span>{editingProductId ? 'Edit Managed Product' : 'Add New Depot Product'}</span>
            </span>
          }
        >
            <form onSubmit={handleSaveProductModal} className="space-y-4">
              <div>
                <label htmlFor="product-name" className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Product Name *
                </label>
                <input
                  id="product-name"
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
                  <label htmlFor="new-product-litres-per-keg" className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Litres per Keg (L/keg) *
                  </label>
                  <input
                    id="new-product-litres-per-keg"
                    type="number"
                    step="1"
                    min="0"
                    required
                    placeholder="e.g. 25 or 30"
                    value={newProductLitresPerKeg}
                    onChange={e => setNewProductLitresPerKeg(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                    Per-product physical container size
                  </span>
                </div>

                {newProductModel === 'bulk_truck' ? (
                  <div>
                    <label htmlFor="new-product-litres-per-ton" className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Litres per Metric Ton *
                    </label>
                    <input
                      id="new-product-litres-per-ton"
                      type="number"
                      step="1"
                      min="0"
                      required
                      placeholder="e.g. 1075"
                      value={newProductLitresPerTon}
                      onChange={e => setNewProductLitresPerTon(e.target.value.replace(/[^0-9]/g, ''))}
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
                <label htmlFor="new-product-keg-sell-price" className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Outright Keg Container Sell Price (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
                  <input
                    id="new-product-keg-sell-price"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 3500"
                    value={newProductKegSellPrice}
                    onChange={e => setNewProductKegSellPrice(e.target.value.replace(/[^0-9]/g, ''))}
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
                        { id: `var-${Date.now()}`, name: '' }
                      ])
                    }
                    className="text-[11px] font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add spec
                  </button>
                </div>

                {newProductVarieties.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">
                    No specs yet — a "Standard" spec is created automatically on save.
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
                        <button
                          type="button"
                          onClick={() => setNewProductVarieties(vs => vs.filter((_, xi) => xi !== i))}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40 shrink-0"
                          aria-label="Remove spec"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-500">
                      Each spec is a full SKU — set its per-pack prices in the Inventory tab. First spec is the counter default.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 pb-1 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
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
        </Modal>
      )}

      {/* HUB ADD / EDIT MODAL */}
      {isHubModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsHubModalOpen(false)}
          title={
            <span className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{editingHubId ? 'Edit Depot Hub' : 'Register New Depot Hub'}</span>
            </span>
          }
        >
          <form onSubmit={handleSaveHub} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Hub Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alaba Central Depot"
                  value={hubName}
                  onChange={e => setHubName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Hub Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ALABA-01"
                  value={hubCode}
                  onChange={e => setHubCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  State *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lagos"
                  value={hubState}
                  onChange={e => setHubState(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Multiple hubs can exist in the same state with independent records.
                </span>
              </div>

              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Contact Phone *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +234 803 111 2222"
                  value={hubPhone}
                  onChange={e => setHubPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                Physical Street Address *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Km 18 Badagry Expressway, Alaba International"
                value={hubAddress}
                onChange={e => setHubAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Branch Manager Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Babajide Sanwo"
                  value={hubManagerName}
                  onChange={e => setHubManagerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 self-end pb-2">
                <input
                  id="hub-is-active"
                  type="checkbox"
                  checked={hubIsActive}
                  onChange={e => setHubIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="hub-is-active" className="text-[13px] font-sans font-semibold text-slate-700 dark:text-slate-300">
                  Hub is currently operating & active
                </label>
              </div>
            </div>

            <div className="pt-3 pb-1 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsHubModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-xs shadow-sm"
              >
                Save Hub
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* USER ADD / EDIT MODAL */}
      {isUserModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsUserModalOpen(false)}
          title={
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <span>{editingUserId ? 'Edit Team Member' : 'Add New Team Member'}</span>
            </span>
          }
        >
          <form onSubmit={handleSaveUser} className="space-y-4">
            <div>
              <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                Full Legal Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Babajide Sanwo"
                value={userFullName}
                onChange={e => setUserFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. babajide@iyanuoluwa.ng"
                  value={userEmail}
                  onChange={e => setUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +234 803 111 2222"
                  value={userPhone}
                  onChange={e => setUserPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                Assigned Role *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'owner' as UserRole, label: 'Owner', desc: 'Global management across all hubs' },
                  { id: 'hub_manager' as UserRole, label: 'Hub Manager', desc: 'Branch authority & credit approvals' },
                  { id: 'staff' as UserRole, label: 'Counter Staff', desc: 'Dispensing & sales at assigned hub' },
                  { id: 'driver' as UserRole, label: 'Driver', desc: 'Truck intake & delivery transit' }
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setUserRoleSelect(r.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      userRoleSelect === r.id
                        ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 text-cyan-900 dark:text-cyan-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="text-[13px] font-bold">{r.label}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                Assigned Depot Hub *
              </label>
              {userRoleSelect === 'owner' ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                  Owners have global access to all hubs. You can switch between any depot dynamically.
                </div>
              ) : (
                <>
                  <select
                    value={userHubIdSelect}
                    onChange={e => setUserHubIdSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    required
                  >
                    {hubs.map(h => (
                      <option key={h.id} value={h.id}>
                        [{h.code}] {h.name} — {h.state} State ({h.address})
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    All transactions created by this user will be scoped exclusively to this hub.
                  </span>
                </>
              )}
            </div>

            <div className="pt-3 pb-1 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-sans font-bold text-xs shadow-sm"
              >
                Save Team Member
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* PUMP ADD / EDIT MODAL */}
      {isPumpModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsPumpModalOpen(false)}
          title={
            <span className="flex items-center gap-2">
              <GasPump className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{editingPumpId ? 'Edit Dispensing Pump' : 'Scale Infrastructure: Add Dispensing Pump'}</span>
            </span>
          }
          subtitle="Configure counter dispensing totalizer for bulk edible oil"
        >
          <form onSubmit={handleSavePump} className="space-y-4">
            <div>
              <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                Pump Name / Label *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Pump 4 (High-Speed Veg Dispenser)"
                value={pumpLabelInput}
                onChange={e => setPumpLabelInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Product Dispensed *
                </label>
                <select
                  value={pumpProductIdInput}
                  onChange={e => setPumpProductIdInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Connected Yard Storage Tank
                </label>
                <select
                  value={pumpTankIdInput}
                  onChange={e => setPumpTankIdInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">None / Direct Line</option>
                  {physicalTanks.map(t => (
                    <option key={t.id} value={t.id}>{t.label} ({t.capacity_litres.toLocaleString()} L)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!editingPumpId && (
                <div>
                  <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Initial Meter Reading (Litres) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="e.g. 0 or current mechanical reading"
                    value={pumpReadingInput}
                    onChange={e => setPumpReadingInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Starting reading on the totalizer</span>
                </div>
              )}

              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Assigned Depot Hub *
                </label>
                <select
                  value={pumpHubIdInput}
                  onChange={e => setPumpHubIdInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  {hubs.map(h => (
                    <option key={h.id} value={h.id}>[{h.code}] {h.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 pb-1 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPumpModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs shadow-sm"
              >
                {editingPumpId ? 'Save Changes' : 'Register Pump'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingTankId && (
        <Modal
          isOpen
          onClose={() => setEditingTankId(null)}
          title={
            <span className="flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <span>Edit Permanent Yard Tank</span>
            </span>
          }
          subtitle="Update label, product assignment, capacity, or depot hub for this tank"
        >
          <form onSubmit={handleSaveTankEdit} className="space-y-4">
            <div>
              <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                Tank Label *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tank 4 (Bulk Storage)"
                value={editTankLabel}
                onChange={e => setEditTankLabel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Product Stored
                </label>
                <select
                  value={editTankProductId}
                  onChange={e => setEditTankProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-semibold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Capacity (Litres) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={editTankCapacity}
                  onChange={e => setEditTankCapacity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                Assigned Depot Hub
              </label>
              <select
                value={editTankHubId}
                onChange={e => setEditTankHubId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">Unassigned / Shared</option>
                {hubs.map(h => (
                  <option key={h.id} value={h.id}>[{h.code}] {h.name}</option>
                ))}
              </select>
            </div>

            <div className="pt-3 pb-1 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTankId(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-sans font-bold text-xs shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MOBILE SHEET MODAL WRAPPER */}
      {activeMobileSheet && (
        <Modal
          isOpen
          onClose={() => setActiveMobileSheet(null)}
          title={
            <span className="font-heading font-bold text-base text-slate-900 dark:text-white">
              {activeMobileSheet === 'hubs' && 'Hubs & Depots Network'}
              {activeMobileSheet === 'users' && 'Team & User Access'}
              {activeMobileSheet === 'company' && 'Company & Branding'}
              {activeMobileSheet === 'kegs' && 'Keg Fleet Standards'}
              {activeMobileSheet === 'pricing' && 'Products & Rate Cards'}
              {activeMobileSheet === 'infrastructure' && 'Tanks, Dispensing Pumps & Suppliers'}
              {activeMobileSheet === 'thresholds' && 'Safety & Thresholds'}
              {activeMobileSheet === 'system' && 'Shift Schedule & Operations'}
            </span>
          }
        >
          <div className="pb-4">
            <p className="text-xs text-slate-500 mb-4">
              Switch to desktop view or select the tab to manage all details.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveDesktopTab(activeMobileSheet);
                setActiveMobileSheet(null);
                showNotification(`Active category set to ${activeMobileSheet}`);
              }}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-xs shadow-sm"
            >
              Open Category Content
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
