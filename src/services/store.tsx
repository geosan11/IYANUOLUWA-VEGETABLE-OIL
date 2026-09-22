import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { listAllProfiles } from './auth';
import { useToast } from './toast';
import {
  Product,
  ProductVariety,
  ProductPackConfig,
  PackPrice,
  Customer,
  CustomerType,
  Tank,
  Sale,
  Order,
  KegReturn,
  Payment,
  AuditEntry,
  Expense,
  AppSettings,
  UserRole,
  CustomerCalculatedStats,
  KegInventorySummary,
  ReceiptData,
  ContainerMode,
  PaymentMethod,
  SinglePaymentMethod,
  PaymentSplit,
  Pump,
  PumpReading,
  PumpVarianceAudit,
  Transfer,
  CustomerCredit,
  Shift,
  Supplier,
  PhysicalTank,
  Hub,
  UserProfile
} from '../types';
import {
  DEFAULT_PRODUCTS,
  DEFAULT_PACK_PRICES,
  DEFAULT_CUSTOMERS,
  ONE_TIME_CUSTOMER_ID,
  ONE_TIME_CUSTOMER,
  DEFAULT_SETTINGS,
  DEFAULT_PUMPS,
  DEFAULT_SUPPLIERS,
  DEFAULT_PHYSICAL_TANKS,
  DEFAULT_HUBS,
  FALLBACK_OWNER_IDENTITY,
  SEED_PUMP_READINGS,
  SEED_TANKS,
  SEED_SALES,
  SEED_ORDERS,
  SEED_KEG_RETURNS,
  SEED_PAYMENTS,
  SEED_AUDIT_LOG,
  SEED_EXPENSES,
  SEED_TRANSFERS,
  SEED_SHIFTS,
  packLabel as packLabelFor
} from '../constants/config';
import {
  calculateCustomerStats,
  calculateKegInventory,
  executeFifoTankDraw,
  applyFifoPayment,
  calculateIntakeMetrics,
  calculatePreKeggedIntakeMetrics,
  checkShiftOpeningMetersGate,
  ShiftOpeningGateStatus,
  calculatePumpMeterVariance,
  validateNewPumpReading,
  calculateShiftSummary,
  computeShiftCash,
  getDepotToday,
  depotDateKey
} from './businessLogic';
import { priceSaleLine } from './pricing';
import { scanAndTriggerAutonomousAlerts, getAlertSettings, requestPushNotificationPermission } from './alertService';

interface StoreContextType {
  products: Product[];
  packPrices: PackPrice[];
  customers: Customer[];
  suppliers: Supplier[];
  physicalTanks: PhysicalTank[];
  tanks: Tank[];
  sales: Sale[];
  orders: Order[];
  payments: Payment[];
  auditLog: AuditEntry[];
  kegReturns: KegReturn[];
  expenses: Expense[];
  settings: AppSettings;
  pumps: Pump[];
  pumpReadings: PumpReading[];
  transfers: Transfer[];
  customerCredits: CustomerCredit[];
  shifts: Shift[];
  activeShift: Shift | null;
  shiftGateStatus: ShiftOpeningGateStatus;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  
  // Computed values
  customerStatsMap: Record<string, CustomerCalculatedStats>;
  kegInventory: KegInventorySummary;
  tankStockByProduct: Record<string, { totalLitres: number; tanks: Tank[] }>;
  /** Read-only per-product snapshot for the Inventory tab. */
  stockView: Record<string, { tankLitres: number; kegsOut: number }>;
  pumpVarianceAudits: PumpVarianceAudit[];
  activeAlerts: {
    overdueCredit: { customer: Customer; overdueDays: number; amount: number }[];
    overLimit: { customer: Customer; balance: number; limit: number; excess: number }[];
    deliveryShortfall: { tank: Tank; shortfallLitres: number }[];
    pumpVariance: PumpVarianceAudit[];
    shiftDiscrepancy: Shift[];
    lowTankStock: { product: Product; litres: number; threshold: number }[];
    totalAlertCount: number;
  };
  todayStats: {
    cashTransferSales: number;
    cashSalesToday: number;
    transferSalesToday: number;
    posSalesToday: number;
    creditOutstanding: number;
    companyKegsOut: number;
    kegsAtDepot: number;
    kegsSoldToday: number;
    purchasedKegsToday: number;
    customerKegsFilledToday: number;
    expensesToday: number;
    grossSalesToday: number;
  };

  // Actions
  logTruckIntake: (data: {
    supplierId: string;
    productId: string;
    truckLabel: string;
    tons: number;
    actualKegs: number;
    leftoverLitres: number;
    physicalTankId?: string;
    spaceNote?: string;
    date?: string;
  }) => { success: boolean; tank?: Tank; error?: string };

  logPreKeggedIntake: (data: {
    supplierId: string;
    productId: string;
    kegsReceived: number;
    truckLabel?: string;
    physicalTankId?: string;
    spaceNote?: string;
    date?: string;
  }) => { success: boolean; tank?: Tank; error?: string };
  
  createSale: (data: {
    customerId: string;
    paymentMethod: PaymentMethod;
    paymentSplits?: PaymentSplit[];
    amountTendered?: number | null;
    note?: string;
    pricingTier?: CustomerType;
    creditTermDays?: number;
    dueDate?: string;
    /** Back-date the sale (defaults to now). */
    date?: string;
    lines: {
      productId: string;
      varietyId: string;
      packSizeId: string;
      qty: number;
      containerMode: ContainerMode;
      overrideUnitPrice?: number | null;
      priceAdjustReason?: string;
      /** Selling the empty keg itself — no oil. See `priceSaleLine`'s `kegOnly`. */
      kegOnly?: boolean;
      /** Pump this line was dispensed from — bulk products only. */
      pumpId?: string | null;
    }[];
  }) => { success: boolean; sale?: Sale; lines?: Order[]; receipt?: ReceiptData; error?: string };

  recordCustomerPayment: (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    date?: string
  ) => { success: boolean; receipt?: ReceiptData; error?: string };

  redeemCustomerCredit: (
    customerId: string,
    amount: number
  ) => { success: boolean; receipt?: ReceiptData; error?: string };

  /** Void a whole sale — its lines drop out of every balance, tank litres are restored, audited. */
  voidSale: (saleId: string, reason: string) => { success: boolean; error?: string };
  /** Void a recorded payment — reverses paid_amount on its lines and any overpayment credit, audited. */
  voidPayment: (paymentId: string, reason: string) => { success: boolean; error?: string };
  updatePaymentDate: (paymentId: string, date: string, reason: string) => { success: boolean; error?: string };
  /** Edit one sale line (qty / unit price / container / date). Recomputes money and the tank draw. */
  updateOrderLine: (
    lineId: string,
    patch: { qty?: number; unitPrice?: number; containerMode?: ContainerMode; date?: string },
    reason: string
  ) => { success: boolean; error?: string };
  updateExpense: (
    expenseId: string,
    patch: { category?: string; amount?: number; note?: string; date?: string },
    reason: string
  ) => { success: boolean; error?: string };
  voidExpense: (expenseId: string, reason: string) => { success: boolean; error?: string };
  updateTankIntake: (
    tankId: string,
    patch: { date?: string; truck_label?: string; supplier_id?: string | null; space_note?: string },
    reason: string
  ) => { success: boolean; error?: string };

  logKegReturn: (
    customerId: string,
    qty: number,
    productId: string,
    packSizeId: string,
    note?: string
  ) => { success: boolean; kegReturn?: KegReturn; error?: string };

  logTransfer: (data: {
    fromCustomerId: string;
    toCustomerId: string;
    itemType: 'keg';
    qty: number;
    productId?: string | null;
    packSizeId?: string | null;
    notes?: string;
  }) => { success: boolean; transfer?: Transfer; error?: string };

  startShift: (data: {
    cashierName: string;
    openingFloat: number;
    notes?: string;
    openingReadings?: Record<string, number>;
  }) => { success: boolean; shift?: Shift; error?: string };

  closeShift: (data: {
    shiftId: string;
    cashCounted: number;
    notes?: string;
    closingReadings?: Record<string, number>;
  }) => { success: boolean; shift?: Shift; error?: string };

  recordShiftOpeningReadings: (
    readings: Record<string, number>
  ) => { success: boolean; error?: string };

  recordPumpReading: (
    pumpId: string,
    reading: number,
    note?: string,
    confirmed?: boolean
  ) => { success: boolean; pumpReading?: PumpReading; error?: string; warning?: string };

  resetPumpMeter: (
    pumpId: string,
    oldFinalReading: number,
    newReading: number,
    reason: string
  ) => { success: boolean; pumpReading?: PumpReading; error?: string };

  addPump: (data: { label: string; productId?: string; openingReading?: number; physicalTankId?: string | null; hubId?: string }) => Pump;
  updatePump: (pumpId: string, updates: { label?: string; product_id?: string | null; physical_tank_id?: string | null; hub_id?: string }) => void;
  deletePump: (pumpId: string) => { success: boolean; error?: string };

  addExpense: (
    category: string,
    amount: number,
    note?: string,
    date?: string,
    options?: {
      recordedBy?: string;
      chargeToCustomerId?: string;
      debtReason?: string;
    }
  ) => { success: boolean; expense?: Expense; error?: string };

  addProduct: (productData: Omit<Product, 'id'>) => Product;
  updateProduct: (productId: string, updates: Partial<Product>) => void;
  deleteProduct: (productId: string) => { success: boolean; error?: string };
  setPackPrice: (
    productId: string,
    varietyId: string,
    packSizeId: string,
    tier: CustomerType,
    price: number
  ) => void;
  bulkSetPackPrices: (rows: PackPrice[]) => void;
  updateProductPackConfig: (productId: string, config: ProductPackConfig[]) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  addCustomer: (customerData: Omit<Customer, 'id'>) => Customer;
  updateCustomer: (id: string, customerData: Partial<Customer>) => void;

  addSupplier: (supplierData: Omit<Supplier, 'id'>) => Supplier;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  addPhysicalTank: (tankData: Omit<PhysicalTank, 'id'>) => PhysicalTank;
  updatePhysicalTank: (id: string, updates: Partial<PhysicalTank>) => void;
  deletePhysicalTank: (id: string) => { success: boolean; error?: string };

  // Multi-Hub Architecture & Current User
  hubs: Hub[];
  currentUser: UserProfile;
  activeHubId: string;
  activeHub: Hub | null;
  setCurrentUser: (user: UserProfile) => void;
  setActiveHubId: (hubId: string) => void;
  addHub: (hub: Omit<Hub, 'id' | 'created_at'>) => Hub;
  updateHub: (id: string, updates: Partial<Hub>) => void;
  deleteHub: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Global unpartitioned lists (available for cross-hub aggregation)
  allTanks: Tank[];
  allSales: Sale[];
  allOrders: Order[];
  allShifts: Shift[];
  allExpenses: Expense[];
  allPumps: Pump[];

  // Receipt Modal State
  activeReceipt: ReceiptData | null;
  setActiveReceipt: (receipt: ReceiptData | null) => void;

  // Reset demo data
  resetToSeedData: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

const STORAGE_KEYS = {
  PRODUCTS: 'iyanu_products_v3',
  PACK_PRICES: 'iyanu_pack_prices_v3',
  CUSTOMERS: 'iyanu_customers_v3',
  SUPPLIERS: 'iyanu_suppliers_v3',
  PHYSICAL_TANKS: 'iyanu_physical_tanks_v3',
  TANKS: 'iyanu_tanks_v3',
  SALES: 'iyanu_sales_v3',
  ORDERS: 'iyanu_orders_v3',
  PAYMENTS: 'iyanu_payments_v3',
  AUDIT_LOG: 'iyanu_audit_log_v3',
  KEG_RETURNS: 'iyanu_keg_returns_v3',
  EXPENSES: 'iyanu_expenses_v3',
  SETTINGS: 'iyanu_settings_v3',
  PUMPS: 'iyanu_pumps_v3',
  PUMP_READINGS: 'iyanu_pump_readings_v3',
  TRANSFERS: 'iyanu_transfers_v3',
  CUSTOMER_CREDITS: 'iyanu_customer_credits_v3',
  SHIFTS: 'iyanu_shifts_v3',
  USER_ROLE: 'iyanu_user_role_v3',
  THEME: 'iyanu_theme_v3',
  HUBS: 'iyanu_hubs_v3',
  CURRENT_USER: 'iyanu_current_user_v3',
  ACTIVE_HUB_ID: 'iyanu_active_hub_id_v3'
};

/**
 * Read + JSON-parse a persisted value, tolerating missing or corrupt data.
 * On any failure it warns and returns the caller's fallback so a bad
 * localStorage entry can never crash app start-up.
 */
function loadPersisted<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved == null) return fallback;
    return JSON.parse(saved) as T;
  } catch (err) {
    console.warn(`[store] Could not parse persisted "${key}" — using fallback.`, err);
    return fallback;
  }
}

/**
 * Maps the app's AppSettings shape to the `app_settings` table's single row
 * (id=1). `outright_keg_price`/`keg_deposit_price` are Inventory-screen-only
 * fields with no matching column. `dipstick_variance_threshold` is a NOT NULL
 * column left over from the tank-dipstick feature (fully removed from the
 * app — see MOSCOW.md); sent as a fixed, unused 0 since nothing here ever
 * reads it back. `default_daily_float`/`daily_float` are the same story: the
 * depot doesn't start the day with any cash in the box, so the "opening cash
 * float" feature was removed from Settings/Expenses/Start Shift entirely —
 * these two NOT NULL columns are sent as a fixed 0.
 */
function toAppSettingsRow(s: AppSettings) {
  return {
    id: 1,
    company_name: s.company_name,
    company_phone: s.company_phone,
    company_address: s.company_address,
    company_logo_url: s.company_logo_url,
    litres_per_keg: s.litres_per_keg,
    default_litres_per_ton: s.default_litres_per_ton,
    total_company_kegs: s.total_company_kegs,
    kegs_at_depot_low_threshold: s.kegs_at_depot_low_threshold,
    low_stock_litres_threshold: s.low_stock_litres_threshold,
    truck_shortfall_threshold: s.truck_shortfall_threshold,
    pump_variance_threshold: s.pump_variance_threshold,
    dipstick_variance_threshold: 0,
    default_daily_float: 0,
    daily_float: 0,
    shift_start_time: s.shift_start_time,
    shift_end_time: s.shift_end_time,
    require_pump_readings_to_start_shift: s.require_pump_readings_to_start_shift ?? true,
    require_pump_readings_to_close_shift: s.require_pump_readings_to_close_shift ?? true
  };
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();

  // Theme state: defaults to 'light'
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Multi-hub state + the single signed-in identity (real team accounts are
  // Supabase-backed `profiles`, not a local list — see FALLBACK_OWNER_IDENTITY).
  const [hubs, setHubs] = useState<Hub[]>(() => loadPersisted(STORAGE_KEYS.HUBS, DEFAULT_HUBS));
  const [currentUser, setCurrentUserState] = useState<UserProfile>(() => {
    const saved = loadPersisted<UserProfile | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (saved && saved.id) return saved;
    return FALLBACK_OWNER_IDENTITY;
  });
  const [activeHubId, setActiveHubIdState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_HUB_ID);
    if (saved) return saved;
    return 'all';
  });

  // Load state from LocalStorage or seed defaults. `litres_per_keg` is
  // per-product and owner-customizable in Settings (e.g. Palm Oil 25L,
  // Vegetable Oil 30L) — persisted as-is, no override here.
  //
  // Browsers with data persisted before the catalog grew from 2 to 9 sizes
  // have `pack_config`/`packPrices` frozen at whatever shipped back then —
  // `DEFAULT_PRODUCTS`/`DEFAULT_PACK_PRICES` are only consulted when storage
  // is empty, so a catalog expansion never reaches an existing install on
  // its own. Backfill any pack size present in the current defaults but
  // missing from what's persisted, without touching sizes/prices the owner
  // already customized.
  const [products, setProducts] = useState<Product[]>(() => {
    const loaded = loadPersisted(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    return loaded.map(p => {
      const defaults = DEFAULT_PRODUCTS.find(dp => dp.id === p.id);
      const missingConfig = defaults
        ? defaults.pack_config.filter(dc => !p.pack_config.some(c => c.pack_size_id === dc.pack_size_id))
        : [];
      return {
        ...p,
        pack_config: missingConfig.length ? [...p.pack_config, ...missingConfig] : p.pack_config
      };
    });
  });

  const [packPrices, setPackPrices] = useState<PackPrice[]>(() => {
    const loaded = loadPersisted(STORAGE_KEYS.PACK_PRICES, DEFAULT_PACK_PRICES);
    const missing = DEFAULT_PACK_PRICES.filter(
      dp =>
        !loaded.some(
          p =>
            p.product_id === dp.product_id &&
            p.variety_id === dp.variety_id &&
            p.pack_size_id === dp.pack_size_id &&
            p.tier === dp.tier
        )
    );
    return missing.length ? [...loaded, ...missing] : loaded;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const loaded = loadPersisted(STORAGE_KEYS.CUSTOMERS, DEFAULT_CUSTOMERS);
    if (!loaded.some(c => c.id === ONE_TIME_CUSTOMER_ID)) {
      return [ONE_TIME_CUSTOMER, ...loaded];
    }
    return loaded;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadPersisted(STORAGE_KEYS.SUPPLIERS, DEFAULT_SUPPLIERS));

  const [allPhysicalTanks, setPhysicalTanks] = useState<PhysicalTank[]>(() => loadPersisted(STORAGE_KEYS.PHYSICAL_TANKS, DEFAULT_PHYSICAL_TANKS));

  const [allTanks, setTanks] = useState<Tank[]>(() => loadPersisted(STORAGE_KEYS.TANKS, SEED_TANKS));

  const [allSales, setSales] = useState<Sale[]>(() => loadPersisted(STORAGE_KEYS.SALES, SEED_SALES));

  const [allOrders, setOrders] = useState<Order[]>(() => loadPersisted(STORAGE_KEYS.ORDERS, SEED_ORDERS));

  const [allPayments, setPayments] = useState<Payment[]>(() => loadPersisted(STORAGE_KEYS.PAYMENTS, SEED_PAYMENTS));

  const [allAuditLog, setAuditLog] = useState<AuditEntry[]>(() => loadPersisted(STORAGE_KEYS.AUDIT_LOG, SEED_AUDIT_LOG));

  const [allKegReturns, setKegReturns] = useState<KegReturn[]>(() => loadPersisted(STORAGE_KEYS.KEG_RETURNS, SEED_KEG_RETURNS));

  const [allExpenses, setExpenses] = useState<Expense[]>(() => loadPersisted(STORAGE_KEYS.EXPENSES, SEED_EXPENSES));

  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadPersisted<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {})
  }));

  const [allPumps, setPumps] = useState<Pump[]>(() => loadPersisted<Pump[]>(STORAGE_KEYS.PUMPS, DEFAULT_PUMPS));

  const [allPumpReadings, setPumpReadings] = useState<PumpReading[]>(() => loadPersisted(STORAGE_KEYS.PUMP_READINGS, SEED_PUMP_READINGS));

  const [allTransfers, setTransfers] = useState<Transfer[]>(() => loadPersisted(STORAGE_KEYS.TRANSFERS, SEED_TRANSFERS));

  const [allCustomerCredits, setCustomerCredits] = useState<CustomerCredit[]>(() => loadPersisted<CustomerCredit[]>(STORAGE_KEYS.CUSTOMER_CREDITS, []));

  const [allShifts, setShifts] = useState<Shift[]>(() => loadPersisted(STORAGE_KEYS.SHIFTS, SEED_SHIFTS));

  const [userRole, setUserRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
    return (saved as UserRole) || currentUser.role || 'owner';
  });

  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  // Sync to LocalStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HUBS, JSON.stringify(hubs));
  }, [hubs]);

  // Hubs are the one piece of business data actually persisted to Supabase
  // today (everything else is still localStorage-only). Without this, a hub
  // created in one browser was invisible on every other device, and looked
  // "wiped" the moment a redeploy forced a hard reload of a browser that
  // never had it cached. On mount: pull the real rows down, and push up any
  // hub this browser created locally before it ever synced (so nothing a
  // browser already has gets silently dropped by moving to Supabase).
  const hubsSyncedRef = useRef(false);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || hubsSyncedRef.current) return;
    hubsSyncedRef.current = true;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase!
        .from('hubs')
        .select('id, name, code, state, address, phone, manager_name, is_active, created_at')
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[store] Failed to load hubs from database:', error.message);
        return;
      }
      const remoteHubs = (data as Hub[]) ?? [];
      const remoteIds = new Set(remoteHubs.map(h => h.id));
      setHubs(prevLocal => {
        const localOnly = prevLocal.filter(h => !remoteIds.has(h.id));
        if (localOnly.length > 0) {
          supabase!
            .from('hubs')
            .insert(localOnly.map(h => ({
              id: h.id,
              name: h.name,
              code: h.code,
              state: h.state,
              address: h.address,
              phone: h.phone || null,
              manager_name: h.manager_name || null,
              is_active: h.is_active,
              created_at: h.created_at || new Date().toISOString()
            })))
            .then(({ error: insertError }) => {
              if (insertError) console.error('[store] Failed to sync local hubs to database:', insertError.message);
            });
        }
        return [...remoteHubs, ...localOnly];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // app_settings is a single row (id=1). Pull it down once; if it doesn't
  // exist yet, push this browser's current settings up as the first row.
  const settingsSyncedRef = useRef(false);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || settingsSyncedRef.current) return;
    settingsSyncedRef.current = true;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase!.from('app_settings').select('*').eq('id', 1).maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[store] Failed to load settings from database:', error.message);
        return;
      }
      if (data) {
        setSettings(prev => ({ ...prev, ...(data as Partial<AppSettings>) }));
      } else {
        setSettings(current => {
          supabase!
            .from('app_settings')
            .insert(toAppSettingsRow(current))
            .then(({ error: insertError }) => {
              if (insertError) console.error('[store] Failed to seed settings in database:', insertError.message);
            });
          return current;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Suppliers — same pull-down + push-up-local-only pattern as hubs above.
  const suppliersSyncedRef = useRef(false);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || suppliersSyncedRef.current) return;
    suppliersSyncedRef.current = true;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase!.from('suppliers').select('id, name, phone').order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[store] Failed to load suppliers from database:', error.message);
        return;
      }
      const remote = (data as Supplier[]) ?? [];
      const remoteIds = new Set(remote.map(s => s.id));
      setSuppliers(prevLocal => {
        const localOnly = prevLocal.filter(s => !remoteIds.has(s.id));
        if (localOnly.length > 0) {
          supabase!
            .from('suppliers')
            .insert(localOnly.map(s => ({ id: s.id, name: s.name, phone: s.phone || null })))
            .then(({ error: insertError }) => {
              if (insertError) console.error('[store] Failed to sync local suppliers to database:', insertError.message);
            });
        }
        return [...remote, ...localOnly];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Physical (yard) tanks — hub-scoped; RLS already returns only the rows
  // this user can see (owner: all, everyone else: their own hub + unscoped).
  const physicalTanksSyncedRef = useRef(false);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || physicalTanksSyncedRef.current) return;
    physicalTanksSyncedRef.current = true;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase!
        .from('physical_tanks')
        .select('id, label, product_id, capacity_litres, notes, hub_id')
        .order('label', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[store] Failed to load physical tanks from database:', error.message);
        return;
      }
      const remote = (data as PhysicalTank[]) ?? [];
      const remoteIds = new Set(remote.map(t => t.id));
      setPhysicalTanks(prevLocal => {
        const localOnly = prevLocal.filter(t => !remoteIds.has(t.id));
        if (localOnly.length > 0) {
          supabase!
            .from('physical_tanks')
            .insert(localOnly.map(t => ({
              id: t.id,
              label: t.label,
              product_id: t.product_id,
              capacity_litres: t.capacity_litres,
              notes: t.notes || null,
              hub_id: t.hub_id || null
            })))
            .then(({ error: insertError }) => {
              if (insertError) console.error('[store] Failed to sync local physical tanks to database:', insertError.message);
            });
        }
        return [...remote, ...localOnly];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Dispensing pumps — hub-scoped, same pattern as physical tanks above.
  const pumpsSyncedRef = useRef(false);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || pumpsSyncedRef.current) return;
    pumpsSyncedRef.current = true;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase!
        .from('pumps')
        .select('id, label, product_id, last_meter_reading, hub_id')
        .order('label', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[store] Failed to load pumps from database:', error.message);
        return;
      }
      const remote = (data as Pump[]) ?? [];
      const remoteIds = new Set(remote.map(p => p.id));
      setPumps(prevLocal => {
        const localOnly = prevLocal.filter(p => !remoteIds.has(p.id));
        if (localOnly.length > 0) {
          supabase!
            .from('pumps')
            .insert(localOnly.map(p => ({
              id: p.id,
              label: p.label,
              product_id: p.product_id || null,
              last_meter_reading: p.last_meter_reading,
              hub_id: p.hub_id || null
            })))
            .then(({ error: insertError }) => {
              if (insertError) console.error('[store] Failed to sync local pumps to database:', insertError.message);
            });
        }
        return [...remote, ...localOnly];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Products + product_varieties. `pack_config` (which pack sizes a product
  // sells + container rules) has no matching column anywhere in the schema —
  // it stays purely local/localStorage, merged back onto whatever the
  // database returns for every other field.
  const productsSyncedRef = useRef(false);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || productsSyncedRef.current) return;
    productsSyncedRef.current = true;
    let cancelled = false;
    (async () => {
      const [productsRes, varietiesRes] = await Promise.all([
        supabase!.from('products').select('id, name, supply_model, litres_per_ton, litres_per_keg, keg_sell_price, color_light, color_dark'),
        supabase!.from('product_varieties').select('id, product_id, name, sort_order').order('sort_order', { ascending: true })
      ]);
      if (cancelled) return;
      if (productsRes.error) {
        console.error('[store] Failed to load products from database:', productsRes.error.message);
        return;
      }
      if (varietiesRes.error) {
        console.error('[store] Failed to load product varieties from database:', varietiesRes.error.message);
        return;
      }
      const varietiesByProduct = new Map<string, ProductVariety[]>();
      for (const v of (varietiesRes.data as { id: string; product_id: string; name: string }[]) ?? []) {
        const list = varietiesByProduct.get(v.product_id) ?? [];
        list.push({ id: v.id, name: v.name });
        varietiesByProduct.set(v.product_id, list);
      }
      type RemoteProductRow = Omit<Product, 'varieties' | 'pack_config'>;
      const remoteRows = (productsRes.data as RemoteProductRow[]) ?? [];
      const remoteIds = new Set(remoteRows.map(r => r.id));

      setProducts(prevLocal => {
        const localById = new Map(prevLocal.map(p => [p.id, p]));
        const merged: Product[] = remoteRows.map(row => {
          const localMatch = localById.get(row.id);
          const defaults = DEFAULT_PRODUCTS.find(dp => dp.id === row.id);
          return {
            ...row,
            varieties: varietiesByProduct.get(row.id) ?? localMatch?.varieties ?? defaults?.varieties ?? [{ id: `${row.id}-standard`, name: 'Standard' }],
            pack_config: localMatch?.pack_config ?? defaults?.pack_config ?? []
          };
        });
        const localOnly = prevLocal.filter(p => !remoteIds.has(p.id));
        if (localOnly.length > 0) {
          supabase!
            .from('products')
            .insert(localOnly.map(p => ({
              id: p.id,
              name: p.name,
              supply_model: p.supply_model,
              litres_per_ton: p.litres_per_ton,
              litres_per_keg: p.litres_per_keg,
              keg_sell_price: p.keg_sell_price,
              color_light: p.color_light,
              color_dark: p.color_dark
            })))
            .then(({ error: insertError }) => {
              if (insertError) {
                console.error('[store] Failed to sync local products to database:', insertError.message);
                return;
              }
              const varietyRows = localOnly.flatMap(p =>
                p.varieties.map((v, i) => ({ id: v.id, product_id: p.id, name: v.name, sort_order: i }))
              );
              if (varietyRows.length > 0) {
                supabase!
                  .from('product_varieties')
                  .insert(varietyRows)
                  .then(({ error: varietyError }) => {
                    if (varietyError) console.error('[store] Failed to sync local product varieties to database:', varietyError.message);
                  });
              }
            });
        }
        return [...merged, ...localOnly];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_HUB_ID, activeHubId);
  }, [activeHubId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PACK_PRICES, JSON.stringify(packPrices));
  }, [packPrices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PHYSICAL_TANKS, JSON.stringify(allPhysicalTanks));
  }, [allPhysicalTanks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TANKS, JSON.stringify(allTanks));
  }, [allTanks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(allSales));
  }, [allSales]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(allOrders));
  }, [allOrders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(allPayments));
  }, [allPayments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(allAuditLog));
  }, [allAuditLog]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.KEG_RETURNS, JSON.stringify(allKegReturns));
  }, [allKegReturns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(allExpenses));
  }, [allExpenses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PUMPS, JSON.stringify(allPumps));
  }, [allPumps]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PUMP_READINGS, JSON.stringify(allPumpReadings));
  }, [allPumpReadings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(allTransfers));
  }, [allTransfers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_CREDITS, JSON.stringify(allCustomerCredits));
  }, [allCustomerCredits]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(allShifts));
  }, [allShifts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USER_ROLE, userRole);
  }, [userRole]);

  // ==========================================
  // MULTI-HUB ACTIONS & SCOPED COMPUTED VIEWS
  // ==========================================

  const setCurrentUser = (user: UserProfile) => {
    setCurrentUserState(user);
    setUserRole(user.role);
    if (user.role === 'owner') {
      // Owner retains selection or can select all
    } else if (user.hub_id) {
      setActiveHubIdState(user.hub_id);
    }
  };

  const setActiveHubId = (hubId: string) => {
    // Non-owner staff/managers are strictly locked to their assigned hub
    if (currentUser.role !== 'owner' && currentUser.hub_id) {
      setActiveHubIdState(currentUser.hub_id);
      return;
    }
    setActiveHubIdState(hubId);
  };

  const activeHub = useMemo(() => {
    if (activeHubId === 'all') return null;
    return hubs.find(h => h.id === activeHubId) || null;
  }, [hubs, activeHubId]);

  const addHub = (hubData: Omit<Hub, 'id' | 'created_at'>): Hub => {
    const newHub: Hub = {
      ...hubData,
      id: `hub-${crypto.randomUUID()}`,
      created_at: new Date().toISOString()
    };
    setHubs(prev => [...prev, newHub]);
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('hubs')
        .insert({
          id: newHub.id,
          name: newHub.name,
          code: newHub.code,
          state: newHub.state,
          address: newHub.address,
          phone: newHub.phone || null,
          manager_name: newHub.manager_name || null,
          is_active: newHub.is_active,
          created_at: newHub.created_at
        })
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to save hub to database:', error.message);
            showToast('error', `"${newHub.name}" was saved on this device only — it didn't sync to the database (${error.message}).`);
          }
        });
    }
    return newHub;
  };

  const updateHub = (id: string, updates: Partial<Hub>) => {
    setHubs(prev => prev.map(h => (h.id === id ? { ...h, ...updates } : h)));
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('hubs')
        .update({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.code !== undefined && { code: updates.code }),
          ...(updates.state !== undefined && { state: updates.state }),
          ...(updates.address !== undefined && { address: updates.address }),
          ...(updates.phone !== undefined && { phone: updates.phone || null }),
          ...(updates.manager_name !== undefined && { manager_name: updates.manager_name || null }),
          ...(updates.is_active !== undefined && { is_active: updates.is_active })
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to update hub in database:', error.message);
            showToast('error', `Hub changes were saved on this device only — they didn't sync to the database (${error.message}).`);
          }
        });
    }
  };

  const deleteHub = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const hasTanks = allTanks.some(t => t.hub_id === id);
    const hasPumps = allPumps.some(p => p.hub_id === id);
    if (hasTanks || hasPumps) {
      return { success: false, error: 'Cannot delete hub with associated tanks or pumps.' };
    }
    // Real staff accounts live in Supabase `profiles`, not any local array —
    // check the real roster so a hub with real assigned staff can't be
    // deleted out from under them (orphaning their hub_id).
    if (isSupabaseConfigured) {
      const { profiles, error } = await listAllProfiles();
      if (error) {
        return { success: false, error: `Could not verify assigned staff before deleting: ${error}` };
      }
      if (profiles.some(p => p.hub_id === id)) {
        return { success: false, error: 'Cannot delete hub with assigned staff.' };
      }
    }
    setHubs(prev => prev.filter(h => h.id !== id));
    if (activeHubId === id) setActiveHubIdState('all');
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('hubs')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to delete hub from database:', error.message);
            showToast('error', `Removed here, but the database delete failed (${error.message}) — it may reappear on other devices.`);
          }
        });
    }
    return { success: true };
  };

  const getTargetHubId = () => {
    if (activeHubId !== 'all') return activeHubId;
    return currentUser.hub_id || hubs[0]?.id || '';
  };

  // Scoped views for the active hub (or consolidated across all if 'all')
  const physicalTanks = useMemo(() => {
    if (activeHubId === 'all') return allPhysicalTanks;
    return allPhysicalTanks.filter(pt => !pt.hub_id || pt.hub_id === activeHubId);
  }, [allPhysicalTanks, activeHubId]);

  const tanks = useMemo(() => {
    if (activeHubId === 'all') return allTanks;
    return allTanks.filter(t => !t.hub_id || t.hub_id === activeHubId);
  }, [allTanks, activeHubId]);

  const sales = useMemo(() => {
    if (activeHubId === 'all') return allSales;
    return allSales.filter(s => !s.hub_id || s.hub_id === activeHubId);
  }, [allSales, activeHubId]);

  const orders = useMemo(() => {
    if (activeHubId === 'all') return allOrders;
    return allOrders.filter(o => !o.hub_id || o.hub_id === activeHubId);
  }, [allOrders, activeHubId]);

  const payments = useMemo(() => {
    if (activeHubId === 'all') return allPayments;
    return allPayments.filter(p => !p.hub_id || p.hub_id === activeHubId);
  }, [allPayments, activeHubId]);

  const auditLog = useMemo(() => {
    if (activeHubId === 'all') return allAuditLog;
    return allAuditLog.filter(a => !a.hub_id || a.hub_id === activeHubId);
  }, [allAuditLog, activeHubId]);

  const kegReturns = useMemo(() => {
    if (activeHubId === 'all') return allKegReturns;
    return allKegReturns.filter(k => !k.hub_id || k.hub_id === activeHubId);
  }, [allKegReturns, activeHubId]);

  const expenses = useMemo(() => {
    if (activeHubId === 'all') return allExpenses;
    return allExpenses.filter(e => !e.hub_id || e.hub_id === activeHubId);
  }, [allExpenses, activeHubId]);

  const pumps = useMemo(() => {
    if (activeHubId === 'all') return allPumps;
    return allPumps.filter(p => !p.hub_id || p.hub_id === activeHubId);
  }, [allPumps, activeHubId]);

  const pumpReadings = useMemo(() => {
    if (activeHubId === 'all') return allPumpReadings;
    return allPumpReadings.filter(pr => !pr.hub_id || pr.hub_id === activeHubId);
  }, [allPumpReadings, activeHubId]);

  const transfers = useMemo(() => {
    if (activeHubId === 'all') return allTransfers;
    return allTransfers.filter(
      t => !t.from_hub_id || t.from_hub_id === activeHubId || t.to_hub_id === activeHubId
    );
  }, [allTransfers, activeHubId]);

  const shifts = useMemo(() => {
    if (activeHubId === 'all') return allShifts;
    return allShifts.filter(s => !s.hub_id || s.hub_id === activeHubId);
  }, [allShifts, activeHubId]);

  const customerCredits = useMemo(() => {
    if (activeHubId === 'all') return allCustomerCredits;
    return allCustomerCredits.filter(cc => !cc.hub_id || cc.hub_id === activeHubId);
  }, [allCustomerCredits, activeHubId]);

  // ==========================================
  // COMPUTED BUSINESS LOGIC DERIVATIONS
  // ==========================================

  // 1. Customer stats map (aging badges, balances, kegs out)
  const customerStatsMap = useMemo(() => {
    const map: Record<string, CustomerCalculatedStats> = {};
    customers.forEach(c => {
      map[c.id] = calculateCustomerStats(c, orders, kegReturns, transfers, new Date(), customerCredits);
    });
    return map;
  }, [customers, orders, kegReturns, transfers, customerCredits]);

  // Active shift
  const activeShift = useMemo(() => {
    return shifts.find(s => s.status === 'open') || null;
  }, [shifts]);

  // Active shift gate status (all pumps must have opening meter readings)
  const shiftGateStatus = useMemo(() => {
    return checkShiftOpeningMetersGate(activeShift, pumps, pumpReadings, products);
  }, [activeShift, pumps, pumpReadings, products]);

  // 2. Keg inventory summary (total company kegs, out, at depot)
  const kegInventory = useMemo(() => {
    return calculateKegInventory(
      settings.total_company_kegs,
      orders,
      kegReturns,
      settings.kegs_at_depot_low_threshold
    );
  }, [settings.total_company_kegs, settings.kegs_at_depot_low_threshold, orders, kegReturns]);

  // 3. Tank stock by product
  const tankStockByProduct = useMemo(() => {
    const result: Record<string, { totalLitres: number; tanks: Tank[] }> = {};
    products.forEach(p => {
      const pTanks = tanks
        .filter(t => t.product_id === p.id && t.remaining_litres > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const totalLitres = pTanks.reduce((sum, t) => sum + t.remaining_litres, 0);
      result[p.id] = { totalLitres, tanks: pTanks };
    });
    return result;
  }, [products, tanks]);

  // 3b. Read-only per-product snapshot for the Inventory tab (tank litres + containers on loan)
  const stockView = useMemo(() => {
    const result: Record<string, { tankLitres: number; kegsOut: number }> = {};
    products.forEach(p => {
      result[p.id] = { tankLitres: tankStockByProduct[p.id]?.totalLitres || 0, kegsOut: 0 };
    });
    Object.values(customerStatsMap).forEach(stats => {
      Object.entries(stats.kegsOutByPack).forEach(([key, qty]) => {
        const productId = key.split('|')[0];
        if (result[productId]) result[productId].kegsOut += qty;
      });
    });
    return result;
  }, [products, tankStockByProduct, customerStatsMap]);

  // 4. Pump variance audits
  const pumpVarianceAudits = useMemo(() => {
    const allAudits: PumpVarianceAudit[] = [];
    pumps.forEach(pump => {
      const audits = calculatePumpMeterVariance(
        pump,
        pumpReadings,
        orders,
        settings.pump_variance_threshold
      );
      allAudits.push(...audits);
    });
    return allAudits;
  }, [pumps, pumpReadings, orders, settings.pump_variance_threshold]);

  // 5. Split alerts (Overdue Credit, Over Limit, Delivery Shortfall, Pump Variance, Shifts, Low Tank Stock)
  const activeAlerts = useMemo(() => {
    const overdueCredit: { customer: Customer; overdueDays: number; amount: number }[] = [];
    const overLimit: { customer: Customer; balance: number; limit: number; excess: number }[] = [];
    const deliveryShortfall: { tank: Tank; shortfallLitres: number }[] = [];
    const pumpVariance = pumpVarianceAudits.filter(a => a.isOverThreshold);
    const lowTankStock: { product: Product; litres: number; threshold: number }[] = [];

    // Tank running low: combined active stock for a product is above zero but under the reorder threshold
    products.forEach(p => {
      const stock = tankStockByProduct[p.id];
      if (stock && stock.totalLitres > 0 && stock.totalLitres < settings.low_stock_litres_threshold) {
        lowTankStock.push({
          product: p,
          litres: stock.totalLitres,
          threshold: settings.low_stock_litres_threshold
        });
      }
    });

    // Check customer credit alerts
    Object.values(customerStatsMap).forEach(stats => {
      if (stats.currentBalance > 0) {
        if (stats.agingBadge.status === 'overdue') {
          overdueCredit.push({
            customer: stats.customer,
            overdueDays: stats.agingBadge.days,
            amount: stats.currentBalance
          });
        }
        if (stats.currentBalance > stats.customer.credit_limit) {
          overLimit.push({
            customer: stats.customer,
            balance: stats.currentBalance,
            limit: stats.customer.credit_limit,
            excess: stats.currentBalance - stats.customer.credit_limit
          });
        }
      }
    });

    // Check delivery shortfall alerts using settings threshold
    tanks.forEach(t => {
      if (t.shortfall > settings.truck_shortfall_threshold) {
        deliveryShortfall.push({
          tank: t,
          shortfallLitres: t.shortfall
        });
      }
    });

    // Check shift cash discrepancies
    const shiftDiscrepancy = shifts.filter(
      s => s.status === 'closed' && s.cash_variance !== undefined && s.cash_variance !== null && Math.abs(s.cash_variance) > 0.01
    );

    const totalAlertCount =
      overdueCredit.length +
      overLimit.length +
      deliveryShortfall.length +
      pumpVariance.length +
      shiftDiscrepancy.length +
      lowTankStock.length;

    return {
      overdueCredit,
      overLimit,
      deliveryShortfall,
      pumpVariance,
      shiftDiscrepancy,
      lowTankStock,
      totalAlertCount
    };
  }, [customerStatsMap, tanks, products, tankStockByProduct, settings.truck_shortfall_threshold, settings.low_stock_litres_threshold, pumpVarianceAudits, shifts]);

  // Ask for OS notification permission once, for the owner only (these are
  // director-level alerts) — without this call, dispatchAutonomousAlert's
  // Notification.permission check can never become 'granted', so no push
  // notification could ever actually fire.
  useEffect(() => {
    if (userRole !== 'owner') return;
    const alertSettings = getAlertSettings();
    if (alertSettings.pushAlertsEnabled && 'Notification' in window && Notification.permission === 'default') {
      requestPushNotificationPermission();
    }
  }, [userRole]);

  // Autonomous alert scanner — dispatches a real Web Push notification when out-of-the-ordinary events occur
  useEffect(() => {
    if (activeAlerts.totalAlertCount > 0) {
      scanAndTriggerAutonomousAlerts({
        pumpVarianceAudits: activeAlerts.pumpVariance,
        deliveryShortfall: activeAlerts.deliveryShortfall,
        shiftDiscrepancy: activeAlerts.shiftDiscrepancy,
        overLimit: activeAlerts.overLimit,
        overdueCredit: activeAlerts.overdueCredit,
        lowTankStock: activeAlerts.lowTankStock
      });
    }
  }, [activeAlerts]);


  // 6. Today's operational stats
  const todayStats = useMemo(() => {
    const todayStr = getDepotToday();
    const todayOrders = orders.filter(o => !o.voided && depotDateKey(o.date) === todayStr);

    // Money collected today that isn't credit (cash, bank transfer, POS card, or paid portions of split sales)
    const cashTransferSales = todayOrders
      .filter(o => o.payment_method === 'cash' || o.payment_method === 'transfer' || o.payment_method === 'pos' || o.payment_method === 'split')
      .reduce((sum, o) => sum + (o.paid_amount || 0), 0);

    // Per-method breakdown of the above — a straight-method order counts its
    // full paid_amount, a split order attributes each leg to its own method.
    const sumByMethod = (method: SinglePaymentMethod) =>
      todayOrders.reduce((sum, o) => {
        if (o.payment_method === method) return sum + (o.paid_amount || 0);
        if (o.payment_method === 'split' && o.payment_splits) {
          return sum + o.payment_splits.filter(s => s.method === method).reduce((s, sp) => s + sp.amount, 0);
        }
        return sum;
      }, 0);
    const cashSalesToday = sumByMethod('cash');
    const transferSalesToday = sumByMethod('transfer');
    const posSalesToday = sumByMethod('pos');

    // Total revenue billed today, regardless of payment method — includes the
    // full value of credit sales (not yet collected), unlike cashTransferSales.
    const grossSalesToday = todayOrders.reduce((sum, o) => sum + Number(o.line_amount || 0), 0);

    // Total Credit Outstanding across all customers
    const creditOutstanding = Object.values(customerStatsMap).reduce(
      (sum, s) => sum + s.currentBalance,
      0
    );

    // Total packs sold today
    const kegsSoldToday = todayOrders.reduce((sum, o) => sum + Number(o.qty || 0), 0);

    // Containers bought outright today
    const purchasedKegsToday = todayOrders
      .filter(o => o.container_mode === 'bought')
      .reduce((sum, o) => sum + Number(o.qty || 0), 0);

    // Sales into the customer's own containers today
    const customerKegsFilledToday = todayOrders
      .filter(o => o.container_mode === 'none')
      .reduce((sum, o) => sum + Number(o.qty || 0), 0);

    // Expenses today
    const expensesToday = expenses
      .filter(e => !e.voided && depotDateKey(e.date) === todayStr)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return {
      cashTransferSales,
      cashSalesToday,
      transferSalesToday,
      posSalesToday,
      creditOutstanding,
      companyKegsOut: kegInventory.totalKegsOut,
      kegsAtDepot: kegInventory.kegsAtDepot,
      kegsSoldToday,
      purchasedKegsToday,
      customerKegsFilledToday,
      expensesToday,
      grossSalesToday
    };
  }, [orders, expenses, customerStatsMap, kegInventory]);

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  // 1. Log Truck Intake (Bulk Truck, Vegetable Oil)
  const logTruckIntake = (data: {
    supplierId: string;
    productId: string;
    truckLabel: string;
    tons: number;
    actualKegs: number;
    leftoverLitres: number;
    physicalTankId?: string;
    spaceNote?: string;
    date?: string;
  }) => {
    const product = products.find(p => p.id === data.productId);
    if (!product) return { success: false, error: 'Product not found' };
    if (!data.supplierId) return { success: false, error: 'Supplier is required for bulk truck intake' };

    const metrics = calculateIntakeMetrics(
      data.tons,
      product.litres_per_ton || 1075,
      data.actualKegs,
      data.leftoverLitres,
      kegInventory.kegsAtDepot,
      product.litres_per_keg,
      settings.truck_shortfall_threshold
    );

    const newTank: Tank = {
      id: `tank-${Date.now()}`,
      product_id: data.productId,
      truck_label: data.truckLabel.trim() || `TRK-${Date.now().toString().slice(-4)}`,
      tons: Number(data.tons),
      received_litres: metrics.recoveredLitres,
      remaining_litres: metrics.recoveredLitres,
      date: data.date || new Date().toISOString(),
      shortfall: metrics.shortfall,
      supplier_id: data.supplierId,
      physical_tank_id: data.physicalTankId || null,
      space_note: data.spaceNote?.trim() || undefined,
      supply_model: 'bulk_truck',
      hub_id: getTargetHubId()
    };

    setTanks(prev => [newTank, ...prev]);
    return { success: true, tank: newTank };
  };

  // 1b. Log Pre-Kegged Intake (Palm Oil)
  const logPreKeggedIntake = (data: {
    supplierId: string;
    productId: string;
    kegsReceived: number;
    truckLabel?: string;
    physicalTankId?: string;
    spaceNote?: string;
    date?: string;
  }) => {
    const product = products.find(p => p.id === data.productId);
    if (!product) return { success: false, error: 'Product not found' };
    if (!data.supplierId) return { success: false, error: 'Supplier is required for pre-kegged intake' };

    const metrics = calculatePreKeggedIntakeMetrics(data.kegsReceived, product.litres_per_keg);

    const supplier = suppliers.find(s => s.id === data.supplierId);
    const supplierPrefix = supplier ? supplier.name.split(' ')[0].toUpperCase() : 'BATCH';
    const truckLabel = data.truckLabel?.trim() || `KEG-${supplierPrefix}-${Date.now().toString().slice(-4)}`;

    const newTank: Tank = {
      id: `tank-${Date.now()}`,
      product_id: data.productId,
      truck_label: truckLabel,
      tons: 0,
      received_litres: metrics.exactLitres,
      remaining_litres: metrics.exactLitres,
      date: data.date || new Date().toISOString(),
      shortfall: 0,
      supplier_id: data.supplierId,
      physical_tank_id: data.physicalTankId || null,
      space_note: data.spaceNote?.trim() || undefined,
      supply_model: 'pre_kegged',
      hub_id: getTargetHubId()
    };

    setTanks(prev => [newTank, ...prev]);
    return { success: true, tank: newTank };
  };

  // Append one row to the immutable audit trail.
  const logAudit = (entry: Omit<AuditEntry, 'id' | 'at' | 'actor_role' | 'actor_name'>) => {
    setAuditLog(prev => [
      {
        ...entry,
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        actor_role: userRole,
        actor_name: currentUser.full_name || (userRole === 'owner' ? 'Managing Director' : 'Depot Cashier'),
        hub_id: getTargetHubId()
      },
      ...prev
    ]);
  };

  // 2. Create a multi-line sale: price each line off the matrix, draw litres FIFO
  //    across all lines, settle under one payment.
  const createSale = (data: {
    customerId: string;
    paymentMethod: PaymentMethod;
    paymentSplits?: PaymentSplit[];
    amountTendered?: number | null;
    note?: string;
    pricingTier?: CustomerType;
    creditTermDays?: number;
    dueDate?: string;
    date?: string;
    lines: {
      productId: string;
      varietyId: string;
      packSizeId: string;
      qty: number;
      containerMode: ContainerMode;
      overrideUnitPrice?: number | null;
      priceAdjustReason?: string;
      kegOnly?: boolean;
      pumpId?: string | null;
    }[];
  }) => {
    const customer = customers.find(c => c.id === data.customerId) || (data.customerId === ONE_TIME_CUSTOMER_ID ? ONE_TIME_CUSTOMER : null);
    if (!customer) return { success: false, error: 'Customer not found' };
    const creditLeg = data.paymentMethod === 'split'
      ? data.paymentSplits?.find(sp => sp.method === 'credit')
      : null;
    const isDebtInvolved = data.paymentMethod === 'credit' || !!creditLeg;
    if (customer.id === ONE_TIME_CUSTOMER_ID && isDebtInvolved) {
      return { success: false, error: 'Retail walk-in customers cannot purchase on debt' };
    }
    if (!data.lines || data.lines.length === 0) {
      return { success: false, error: 'A sale needs at least one line' };
    }

    const tier: CustomerType = data.pricingTier || customer.type;

    // Shift opening-meter gate applies while any line dispenses a bulk product.
    const anyBulk = data.lines.some(l => {
      const p = products.find(pr => pr.id === l.productId);
      return p ? p.supply_model === 'bulk_truck' : false;
    });
    if (anyBulk) {
      const gateCheck = checkShiftOpeningMetersGate(activeShift, pumps, pumpReadings, products);
      if (!gateCheck.isPassed) {
        return {
          success: false,
          error: 'Shift opening meter gate active: record opening meter readings for all bulk dispensing pumps before recording sales.'
        };
      }
    }

    const creationTime = new Date();
    const now = data.date ? new Date(data.date) : creationTime;
    const saleId = `sale-${creationTime.getTime()}`;
    const effectiveTermDays = data.creditTermDays ?? (creditLeg?.credit_term_days ?? customer.credit_term_days ?? 14);
    let dueDate: string | null = null;
    if (isDebtInvolved) {
      if (data.dueDate) {
        dueDate = data.dueDate;
      } else {
        const due = new Date(now);
        due.setDate(due.getDate() + effectiveTermDays);
        dueDate = due.toISOString();
      }
    }

    let workingTanks = tanks;
    const newLines: Order[] = [];

    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i];
      const product = products.find(p => p.id === line.productId);
      if (!product) return { success: false, error: `Product not found for line ${i + 1}` };
      const variety = product.varieties.find(v => v.id === line.varietyId);
      if (!variety) return { success: false, error: `Variety not selected for line ${i + 1}` };
      if (!(Number(line.qty) > 0)) {
        return { success: false, error: `Line ${i + 1}: quantity must be greater than zero` };
      }

      const priced = priceSaleLine({
        product,
        varietyId: line.varietyId,
        packSizeId: line.packSizeId,
        tier,
        qty: Number(line.qty),
        containerMode: line.containerMode,
        overrideUnitPrice: line.overrideUnitPrice ?? null,
        packPrices,
        kegOnly: line.kegOnly
      });

      if (priced.unpriced) {
        return {
          success: false,
          error: line.kegOnly
            ? `Line ${i + 1}: ${product.name} has no keg sell price set. Set it in Inventory.`
            : `Line ${i + 1}: ${product.name} / ${variety.name} / ${packLabelFor(line.packSizeId)} has no price for the ${tier} tier. Set it in Inventory.`
        };
      }
      if (priced.priceAdjusted && !line.priceAdjustReason?.trim()) {
        return {
          success: false,
          error: `Line ${i + 1}: the price was changed from the standard ₦${(priced.matrixUnitPrice ?? 0).toLocaleString()} — a reason is required.`
        };
      }

      const draw = executeFifoTankDraw(workingTanks, line.productId, priced.litres);
      if (!draw.success) {
        return { success: false, error: `Line ${i + 1}: ${draw.errorMessage || 'insufficient tank stock'}` };
      }
      workingTanks = draw.updatedTanks;

      const lineAmount = priced.lineAmount;
      newLines.push({
        id: `line-${creationTime.getTime()}-${i + 1}`,
        sale_id: saleId,
        customer_id: data.customerId,
        product_id: line.productId,
        variety_id: variety.id,
        variety_name: variety.name,
        pack_size_id: line.packSizeId,
        qty: Number(line.qty),
        litres: priced.litres,
        unit_price: priced.unitPrice,
        original_unit_price: priced.matrixUnitPrice,
        price_adjusted: priced.priceAdjusted,
        price_adjust_reason: priced.priceAdjusted ? line.priceAdjustReason?.trim() || null : null,
        oil_amount: priced.oilAmount,
        container_mode: line.containerMode,
        returnable: priced.returnable,
        container_unit_price: line.containerMode === 'bought' ? priced.containerUnitPrice : null,
        container_amount: line.containerMode === 'bought' ? priced.containerAmount : null,
        line_amount: lineAmount,
        amount: lineAmount,
        pricing_tier: tier,
        payment_method: data.paymentMethod,
        paid_amount: data.paymentMethod === 'credit' ? 0 : lineAmount,
        due_date: data.paymentMethod === 'credit' ? dueDate : null,
        date: now.toISOString(),
        source_tank_id: draw.primaryTankId,
        tank_allocations: draw.allocations.map(a => ({ tank_id: a.tankId, litres: a.drawnLitres })),
        pump_id: line.pumpId ?? null,
        voided: false,
        note: i === 0 ? data.note?.trim() || undefined : undefined,
        hub_id: getTargetHubId()
      });
    }

    const total = Number(newLines.reduce((s, l) => s + l.line_amount, 0).toFixed(2));
    const creditPortion = data.paymentMethod === 'credit'
      ? total
      : creditLeg ? Number(creditLeg.amount.toFixed(2)) : 0;
    const paidPortion = Number(Math.max(0, total - creditPortion).toFixed(2));

    // Distribute paidPortion and split info across the newLines
    let remainingPaid = paidPortion;
    for (const l of newLines) {
      if (creditPortion === 0) {
        l.paid_amount = l.line_amount;
      } else {
        const linePaid = Math.min(l.line_amount, remainingPaid);
        l.paid_amount = Number(linePaid.toFixed(2));
        remainingPaid = Math.max(0, Number((remainingPaid - linePaid).toFixed(2)));
      }
      l.payment_method = data.paymentMethod;
      l.payment_splits = data.paymentSplits;
      l.due_date = (l.line_amount - (l.paid_amount || 0) > 0.01) ? dueDate : null;
      l.credit_term_days = isDebtInvolved ? effectiveTermDays : undefined;
    }

    const cashLeg = data.paymentMethod === 'split'
      ? data.paymentSplits?.find(sp => sp.method === 'cash')
      : null;
    const tendered =
      data.paymentMethod === 'cash' && data.amountTendered != null
        ? Number(data.amountTendered)
        : cashLeg && cashLeg.amount_tendered != null
        ? Number(cashLeg.amount_tendered)
        : null;
    const changeDue =
      data.paymentMethod === 'cash' && tendered != null
        ? Number(Math.max(0, tendered - total).toFixed(2))
        : cashLeg && cashLeg.change_due != null
        ? Number(cashLeg.change_due)
        : null;

    const sale: Sale = {
      id: saleId,
      customer_id: data.customerId,
      date: now.toISOString(),
      payment_method: data.paymentMethod,
      payment_splits: data.paymentSplits,
      amount_tendered: tendered,
      change_due: changeDue,
      cashier_name: currentUser.full_name || (userRole === 'owner' ? 'Managing Director' : 'Depot Cashier'),
      note: data.note?.trim() || undefined,
      credit_term_days: isDebtInvolved ? effectiveTermDays : undefined,
      due_date: dueDate,
      voided: false,
      hub_id: getTargetHubId()
    };

    const updatedMap = new Map(workingTanks.map(t => [t.id, t]));
    setTanks(prev => prev.map(t => updatedMap.get(t.id) || t));
    setSales(prev => [sale, ...prev]);
    setOrders(prev => [...newLines, ...prev]);
    logAudit({ entity_type: 'sale', entity_id: saleId, action: 'create', changes: [] });

    const prevStats = customerStatsMap[customer.id];
    const previousBalance = prevStats ? prevStats.currentBalance : 0;

    const firstLine = newLines[0];
    const firstProduct = products.find(p => p.id === firstLine.product_id);
    const receipt: ReceiptData = {
      receiptNumber: `REC-${creationTime.getTime().toString().slice(-6)}`,
      type: 'order',
      date: now.toISOString(),
      customer,
      sale,
      lines: newLines,
      order: firstLine,
      product: firstProduct,
      packLabel: packLabelFor(firstLine.pack_size_id),
      varietyName: firstLine.variety_name,
      pricingTier: tier,
      amountTendered: tendered,
      changeDue,
      paymentMethod: data.paymentMethod,
      paymentSplits: data.paymentSplits,
      previousBalance,
      newBalance: previousBalance + creditPortion,
      cashierName: sale.cashier_name
    };

    setActiveReceipt(receipt);
    return { success: true, sale, lines: newLines, receipt };
  };

  // 3. Record Customer Credit Payment (FIFO allocation)
  const recordCustomerPayment = (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    date?: string
  ) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return { success: false, error: 'Customer not found' };

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero' };
    }

    const effectiveDate = date || new Date().toISOString();
    const prevStats = customerStatsMap[customer.id];
    const previousBalance = prevStats ? prevStats.currentBalance : 0;

    const paymentResult = applyFifoPayment(orders, customerId, numericAmount);

    const updatedOrdersMap = new Map(paymentResult.updatedOrders.map(o => [o.id, o]));
    setOrders(prev => prev.map(o => updatedOrdersMap.get(o.id) || o));

    const newBalance = Math.max(0, previousBalance - paymentResult.totalApplied);
    const receiptNumber = `PAY-${Date.now().toString().slice(-6)}`;
    const overpayment = paymentResult.unappliedLeftover > 0.01 ? Number(paymentResult.unappliedLeftover.toFixed(2)) : 0;

    // Any amount beyond what the open invoices needed becomes store credit,
    // recorded on the customer's credit ledger instead of being discarded.
    if (overpayment > 0) {
      setCustomerCredits(prev => [
        {
          id: `cc-${Date.now()}`,
          customer_id: customerId,
          amount: overpayment,
          source_payment_id: receiptNumber,
          created_at: effectiveDate,
          note: 'Overpayment added to store credit',
          hub_id: getTargetHubId()
        },
        ...prev
      ]);
    }

    // Persist the payment event itself so a fully-applied settlement still leaves a trace.
    const payment: Payment = {
      id: `pay-${Date.now()}`,
      customer_id: customerId,
      amount: numericAmount,
      method: paymentMethod === 'credit' ? 'transfer' : paymentMethod,
      date: effectiveDate,
      applied_to: paymentResult.appliedOrders.map(a => ({ order_id: a.orderId, amount: a.amountApplied })),
      overpayment_to_credit: overpayment,
      source: 'payment',
      recorded_by: userRole === 'owner' ? 'Managing Director' : 'Depot Cashier',
      hub_id: getTargetHubId()
    };
    setPayments(prev => [payment, ...prev]);
    logAudit({ entity_type: 'payment', entity_id: payment.id, action: 'create', changes: [] });

    const receipt: ReceiptData = {
      receiptNumber,
      type: 'payment',
      date: effectiveDate,
      customer,
      paymentAmount: numericAmount,
      paymentMethod,
      previousBalance,
      newBalance,
      unappliedLeftover: paymentResult.unappliedLeftover,
      cashierName: userRole === 'owner' ? 'Managing Director' : 'Depot Cashier'
    };

    setActiveReceipt(receipt);

    return { success: true, receipt };
  };

  // 3b. Redeem a customer's store credit against their open invoices (FIFO).
  const redeemCustomerCredit = (customerId: string, amount: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return { success: false, error: 'Customer not found' };

    const stats = customerStatsMap[customer.id];
    const available = stats ? stats.creditBalance : 0;
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Redeem amount must be greater than zero' };
    }
    if (numericAmount > available + 0.01) {
      return { success: false, error: `Only ${available.toFixed(2)} of store credit is available` };
    }
    const previousBalance = stats ? stats.currentBalance : 0;
    if (previousBalance <= 0.01) {
      return { success: false, error: 'This customer has no open balance to apply credit to' };
    }

    const paymentResult = applyFifoPayment(orders, customerId, numericAmount);
    const updatedOrdersMap = new Map(paymentResult.updatedOrders.map(o => [o.id, o]));
    setOrders(prev => prev.map(o => updatedOrdersMap.get(o.id) || o));

    // Draw the redeemed amount down on the credit ledger (negative entry).
    const redeemed = paymentResult.totalApplied;
    const receiptNumber = `CRD-${Date.now().toString().slice(-6)}`;
    if (redeemed > 0.01) {
      setCustomerCredits(prev => [
        {
          id: `cc-${Date.now()}`,
          customer_id: customerId,
          amount: -Number(redeemed.toFixed(2)),
          source_payment_id: receiptNumber,
          created_at: new Date().toISOString(),
          note: 'Store credit applied to invoices',
          hub_id: getTargetHubId()
        },
        ...prev
      ]);

      const payment: Payment = {
        id: `pay-${Date.now()}`,
        customer_id: customerId,
        amount: Number(redeemed.toFixed(2)),
        method: 'transfer',
        date: new Date().toISOString(),
        applied_to: paymentResult.appliedOrders.map(a => ({ order_id: a.orderId, amount: a.amountApplied })),
        overpayment_to_credit: 0,
        source: 'credit_redeem',
        recorded_by: userRole === 'owner' ? 'Managing Director' : 'Depot Cashier',
        note: 'Store credit applied to invoices',
        hub_id: getTargetHubId()
      };
      setPayments(prev => [payment, ...prev]);
      logAudit({ entity_type: 'payment', entity_id: payment.id, action: 'create', changes: [] });
    }

    const receipt: ReceiptData = {
      receiptNumber,
      type: 'payment',
      date: new Date().toISOString(),
      customer,
      paymentAmount: redeemed,
      paymentMethod: 'credit',
      previousBalance,
      newBalance: Math.max(0, previousBalance - redeemed),
      unappliedLeftover: paymentResult.unappliedLeftover,
      cashierName: userRole === 'owner' ? 'Managing Director' : 'Depot Cashier'
    };
    setActiveReceipt(receipt);

    return { success: true, receipt };
  };

  // 3c. Void a whole sale.
  const voidSale = (saleId: string, reason: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return { success: false, error: 'Sale not found' };
    if (sale.voided) return { success: false, error: 'This sale is already voided' };
    if (!reason.trim()) return { success: false, error: 'A reason is required to void a sale' };

    const saleLines = orders.filter(o => o.sale_id === saleId);
    const lineIds = new Set(saleLines.map(l => l.id));
    const blockingPayment = payments.find(
      p => !p.voided && p.applied_to.some(a => lineIds.has(a.order_id))
    );
    if (blockingPayment) {
      return {
        success: false,
        error: 'A recorded payment is applied to this sale. Void the payment first, then the sale.'
      };
    }

    // Restore drawn litres to their source tanks.
    const restore: Record<string, number> = {};
    for (const line of saleLines) {
      for (const alloc of line.tank_allocations || []) {
        restore[alloc.tank_id] = (restore[alloc.tank_id] || 0) + alloc.litres;
      }
    }
    setTanks(prev =>
      prev.map(t => (restore[t.id] ? { ...t, remaining_litres: t.remaining_litres + restore[t.id] } : t))
    );
    setOrders(prev => prev.map(o => (o.sale_id === saleId ? { ...o, voided: true } : o)));
    setSales(prev =>
      prev.map(s =>
        s.id === saleId
          ? { ...s, voided: true, voided_at: new Date().toISOString(), voided_by: userRole, void_reason: reason.trim() }
          : s
      )
    );
    logAudit({
      entity_type: 'sale',
      entity_id: saleId,
      action: 'void',
      changes: [{ field: 'voided', old: false, new: true }],
      reason: reason.trim()
    });
    return { success: true };
  };

  // 3d. Void a recorded payment.
  const voidPayment = (paymentId: string, reason: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment not found' };
    if (payment.voided) return { success: false, error: 'This payment is already voided' };
    if (!reason.trim()) return { success: false, error: 'A reason is required to void a payment' };

    setOrders(prev =>
      prev.map(o => {
        const applied = payment.applied_to.find(a => a.order_id === o.id);
        if (!applied) return o;
        return { ...o, paid_amount: Math.max(0, Number(((o.paid_amount || 0) - applied.amount).toFixed(2))) };
      })
    );
    if (payment.overpayment_to_credit > 0) {
      setCustomerCredits(prev => [
        {
          id: `cc-${Date.now()}`,
          customer_id: payment.customer_id,
          amount: -Number(payment.overpayment_to_credit.toFixed(2)),
          source_payment_id: payment.id,
          created_at: new Date().toISOString(),
          note: 'Reversal of voided overpayment credit',
          hub_id: payment.hub_id || getTargetHubId()
        },
        ...prev
      ]);
    }
    setPayments(prev =>
      prev.map(p =>
        p.id === paymentId
          ? { ...p, voided: true, voided_at: new Date().toISOString(), void_reason: reason.trim() }
          : p
      )
    );
    logAudit({
      entity_type: 'payment',
      entity_id: paymentId,
      action: 'void',
      changes: [{ field: 'voided', old: false, new: true }],
      reason: reason.trim()
    });
    return { success: true };
  };

  // Correct a payment's recorded date/time — the amount and allocation are
  // untouched (void + re-record the payment for anything bigger than a date fix).
  const updatePaymentDate = (paymentId: string, date: string, reason: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment not found' };
    if (payment.voided) return { success: false, error: 'This payment is voided' };
    if (!reason.trim()) return { success: false, error: 'A reason is required to edit a payment' };
    if (!date || date === payment.date) return { success: true };

    const oldDate = payment.date;
    setPayments(prev => prev.map(p => (p.id === paymentId ? { ...p, date } : p)));
    logAudit({
      entity_type: 'payment',
      entity_id: paymentId,
      action: 'edit',
      changes: [{ field: 'date', old: oldDate, new: date }],
      reason: reason.trim()
    });
    return { success: true };
  };

  // 3e. Edit one sale line and keep every derived figure correct.
  const updateOrderLine = (
    lineId: string,
    patch: { qty?: number; unitPrice?: number; containerMode?: ContainerMode; date?: string },
    reason: string
  ) => {
    const line = orders.find(o => o.id === lineId);
    if (!line) return { success: false, error: 'Sale line not found' };
    if (line.voided) return { success: false, error: 'This line is voided' };
    if (!reason.trim()) return { success: false, error: 'A reason is required to edit a line' };
    const product = products.find(p => p.id === line.product_id);
    if (!product) return { success: false, error: 'Product not found' };

    const nextQty = patch.qty != null ? Math.max(1, Math.floor(patch.qty)) : line.qty;
    const nextMode: ContainerMode = patch.containerMode ?? line.container_mode;
    const nextUnitOverride =
      patch.unitPrice != null ? patch.unitPrice : line.price_adjusted ? line.unit_price : null;
    // Fingerprint of a keg-only line (no oil at all) — the Order model has no
    // dedicated column for this, so it's inferred from the original line.
    const wasKegOnly = line.litres === 0 && line.oil_amount === 0 && line.container_mode === 'bought';

    const priced = priceSaleLine({
      product,
      varietyId: line.variety_id,
      packSizeId: line.pack_size_id,
      tier: line.pricing_tier,
      qty: nextQty,
      containerMode: nextMode,
      kegOnly: wasKegOnly,
      overrideUnitPrice: nextUnitOverride,
      packPrices
    });
    if (priced.unpriced) return { success: false, error: 'That combination has no price' };

    // Reconcile the tank draw for the change in litres.
    const litresDelta = Number((priced.litres - line.litres).toFixed(2));
    let nextAllocations = line.tank_allocations || [];
    if (litresDelta > 0.001) {
      const draw = executeFifoTankDraw(tanks, line.product_id, litresDelta);
      if (!draw.success) return { success: false, error: draw.errorMessage || 'Not enough tank stock for the increase' };
      const updatedMap = new Map(draw.updatedTanks.map(t => [t.id, t]));
      setTanks(prev => prev.map(t => updatedMap.get(t.id) || t));
      const merged: Record<string, number> = {};
      for (const a of nextAllocations) merged[a.tank_id] = (merged[a.tank_id] || 0) + a.litres;
      for (const a of draw.allocations) merged[a.tankId] = (merged[a.tankId] || 0) + a.drawnLitres;
      nextAllocations = Object.entries(merged).map(([tank_id, litres]) => ({ tank_id, litres }));
    } else if (litresDelta < -0.001) {
      let giveBack = -litresDelta;
      const restore: Record<string, number> = {};
      const kept: { tank_id: string; litres: number }[] = [];
      for (const a of nextAllocations) {
        const take = Math.min(a.litres, giveBack);
        if (take > 0) {
          restore[a.tank_id] = (restore[a.tank_id] || 0) + take;
          giveBack -= take;
        }
        if (a.litres - take > 0.001) kept.push({ tank_id: a.tank_id, litres: Number((a.litres - take).toFixed(2)) });
      }
      setTanks(prev =>
        prev.map(t => (restore[t.id] ? { ...t, remaining_litres: t.remaining_litres + restore[t.id] } : t))
      );
      nextAllocations = kept;
    }

    const changes: { field: string; old: unknown; new: unknown }[] = [];
    if (nextQty !== line.qty) changes.push({ field: 'qty', old: line.qty, new: nextQty });
    if (Math.abs(priced.unitPrice - line.unit_price) > 0.001)
      changes.push({ field: 'unit_price', old: line.unit_price, new: priced.unitPrice });
    if (nextMode !== line.container_mode) changes.push({ field: 'container_mode', old: line.container_mode, new: nextMode });
    if (patch.date && patch.date !== line.date) changes.push({ field: 'date', old: line.date, new: patch.date });

    setOrders(prev =>
      prev.map(o =>
        o.id === lineId
          ? {
              ...o,
              qty: nextQty,
              litres: priced.litres,
              unit_price: priced.unitPrice,
              price_adjusted: priced.priceAdjusted,
              oil_amount: priced.oilAmount,
              container_mode: nextMode,
              returnable: priced.returnable,
              container_unit_price: nextMode === 'bought' ? priced.containerUnitPrice : null,
              container_amount: nextMode === 'bought' ? priced.containerAmount : null,
              line_amount: priced.lineAmount,
              amount: priced.lineAmount,
              paid_amount:
                o.payment_method === 'credit' || o.payment_method === 'split'
                  ? Math.min(o.paid_amount || 0, priced.lineAmount)
                  : priced.lineAmount,
              tank_allocations: nextAllocations,
              source_tank_id: nextAllocations[0]?.tank_id ?? o.source_tank_id,
              date: patch.date || o.date
            }
          : o
      )
    );
    logAudit({ entity_type: 'order_line', entity_id: lineId, action: 'edit', changes, reason: reason.trim() });
    return { success: true };
  };

  // 3f. Expense edit / void.
  const updateExpense = (
    expenseId: string,
    patch: { category?: string; amount?: number; note?: string; date?: string },
    reason: string
  ) => {
    const exp = expenses.find(e => e.id === expenseId);
    if (!exp) return { success: false, error: 'Expense not found' };
    if (!reason.trim()) return { success: false, error: 'A reason is required to edit an expense' };
    const expRec = exp as unknown as Record<string, unknown>;
    const changes: { field: string; old: unknown; new: unknown }[] = [];
    (['category', 'amount', 'note', 'date'] as const).forEach(k => {
      if (patch[k] != null && patch[k] !== expRec[k]) {
        changes.push({ field: k, old: expRec[k], new: patch[k] });
      }
    });
    setExpenses(prev =>
      prev.map(e =>
        e.id === expenseId
          ? {
              ...e,
              category: patch.category?.trim() || e.category,
              amount: patch.amount != null && patch.amount > 0 ? Number(patch.amount) : e.amount,
              note: patch.note != null ? patch.note.trim() || undefined : e.note,
              date: patch.date || e.date
            }
          : e
      )
    );
    logAudit({ entity_type: 'expense', entity_id: expenseId, action: 'edit', changes, reason: reason.trim() });
    return { success: true };
  };

  const voidExpense = (expenseId: string, reason: string) => {
    const exp = expenses.find(e => e.id === expenseId);
    if (!exp) return { success: false, error: 'Expense not found' };
    if (exp.voided) return { success: false, error: 'This expense is already voided' };
    if (!reason.trim()) return { success: false, error: 'A reason is required to void an expense' };
    setExpenses(prev =>
      prev.map(e =>
        e.id === expenseId
          ? { ...e, voided: true, voided_at: new Date().toISOString(), void_reason: reason.trim() }
          : e
      )
    );
    logAudit({
      entity_type: 'expense',
      entity_id: expenseId,
      action: 'void',
      changes: [{ field: 'voided', old: false, new: true }],
      reason: reason.trim()
    });
    return { success: true };
  };

  // 3g. Truck-intake correction (date / label / supplier / note only — never litres).
  const updateTankIntake = (
    tankId: string,
    patch: { date?: string; truck_label?: string; supplier_id?: string | null; space_note?: string },
    reason: string
  ) => {
    const tank = tanks.find(t => t.id === tankId);
    if (!tank) return { success: false, error: 'Intake record not found' };
    if (!reason.trim()) return { success: false, error: 'A reason is required to edit an intake' };
    const tankRec = tank as unknown as Record<string, unknown>;
    const changes: { field: string; old: unknown; new: unknown }[] = [];
    (['date', 'truck_label', 'supplier_id', 'space_note'] as const).forEach(k => {
      if (patch[k] !== undefined && patch[k] !== tankRec[k]) {
        changes.push({ field: k, old: tankRec[k], new: patch[k] });
      }
    });
    setTanks(prev =>
      prev.map(t =>
        t.id === tankId
          ? {
              ...t,
              date: patch.date || t.date,
              truck_label: patch.truck_label?.trim() || t.truck_label,
              supplier_id: patch.supplier_id !== undefined ? patch.supplier_id : t.supplier_id,
              space_note: patch.space_note !== undefined ? patch.space_note : t.space_note
            }
          : t
      )
    );
    logAudit({ entity_type: 'tank_intake', entity_id: tankId, action: 'edit', changes, reason: reason.trim() });
    return { success: true };
  };

  // 4. Log Keg Return — counted against the (product, pack size) the container was taken in.
  const logKegReturn = (
    customerId: string,
    qty: number,
    productId: string,
    packSizeId: string,
    note?: string
  ) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return { success: false, error: 'Customer not found' };

    const numericQty = Number(qty);
    if (!Number.isFinite(numericQty) || numericQty <= 0) {
      return { success: false, error: 'Keg return quantity must be greater than zero' };
    }
    const stats = customerStatsMap[customerId];
    const outForPack = stats?.kegsOutByPack?.[`${productId}|${packSizeId}`] ?? 0;
    if (numericQty > outForPack) {
      return {
        success: false,
        error: `${customer.name} has only ${outForPack} ${packLabelFor(packSizeId)} container(s) out for this product`
      };
    }

    const newReturn: KegReturn = {
      id: `ret-${Date.now()}`,
      customer_id: customerId,
      product_id: productId,
      pack_size_id: packSizeId,
      qty: numericQty,
      date: new Date().toISOString(),
      note: note?.trim() || undefined,
      hub_id: getTargetHubId()
    };

    setKegReturns(prev => [newReturn, ...prev]);
    return { success: true, kegReturn: newReturn };
  };

  // 5. Inter-Customer / Inter-Agent Transfer (company containers only)
  const logTransfer = (data: {
    fromCustomerId: string;
    toCustomerId: string;
    itemType: 'keg';
    qty: number;
    productId?: string | null;
    packSizeId?: string | null;
    notes?: string;
  }) => {
    if (data.fromCustomerId === data.toCustomerId) {
      return { success: false, error: 'Sender and receiver must be different customers' };
    }
    if (Number(data.qty) <= 0) {
      return { success: false, error: 'Transfer quantity must be greater than 0' };
    }
    const senderKegs = customerStatsMap[data.fromCustomerId]?.totalCompanyKegsOut ?? 0;
    if (Number(data.qty) > senderKegs) {
      return { success: false, error: `Sender only has ${senderKegs} company container(s) to transfer` };
    }

    const targetHubId = getTargetHubId();
    const newTransfer: Transfer = {
      id: `tr-${Date.now()}`,
      from_customer_id: data.fromCustomerId,
      to_customer_id: data.toCustomerId,
      item_type: 'keg',
      qty: Number(data.qty),
      product_id: data.productId ?? null,
      pack_size_id: data.packSizeId ?? null,
      date: new Date().toISOString(),
      note: data.notes?.trim() || undefined,
      from_hub_id: targetHubId,
      to_hub_id: targetHubId
    };

    setTransfers(prev => [newTransfer, ...prev]);
    return { success: true, transfer: newTransfer };
  };

  // 7. Shift Management: Start Shift
  const startShift = (data: {
    cashierName: string;
    openingFloat: number;
    notes?: string;
    openingReadings?: Record<string, number>;
  }) => {
    const targetHubId = getTargetHubId();
    if (allShifts.some(s => s.status === 'open' && (!s.hub_id || s.hub_id === targetHubId))) {
      return { success: false, error: 'A shift is already open for this hub. Close it before starting a new one.' };
    }
    if (!Number.isFinite(Number(data.openingFloat)) || Number(data.openingFloat) < 0) {
      return { success: false, error: 'Opening float cannot be negative' };
    }

    const recordedAtIso = new Date().toISOString();
    const newPumpReadings: PumpReading[] = [];
    const validReadings: Record<string, number> = {};

    if (data.openingReadings) {
      for (const [pumpId, reading] of Object.entries(data.openingReadings)) {
        const num = Number(reading);
        if (!isNaN(num) && num > 0) {
          const pump = allPumps.find(p => p.id === pumpId);
          const validation = validateNewPumpReading(num, pump?.last_meter_reading ?? 0);
          if (!validation.isValid) {
            return { success: false, error: validation.error };
          }
          validReadings[pumpId] = num;
          newPumpReadings.push({
            id: `pr-shift-open-${Date.now()}-${pumpId}`,
            pump_id: pumpId,
            reading: num,
            recorded_at: recordedAtIso,
            note: `Shift opening meter reading (${data.cashierName || currentUser.full_name || 'Staff'})`,
            hub_id: targetHubId
          });
        }
      }

      // Update pumps last_meter_reading
      setPumps(prev => prev.map(p => {
        const r = validReadings[p.id];
        return r !== undefined && !isNaN(Number(r)) ? { ...p, last_meter_reading: Number(r) } : p;
      }));

      // Append to pumpReadings
      if (newPumpReadings.length > 0) {
        setPumpReadings(prev => [...prev, ...newPumpReadings]);
      }
    }

    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      cashier_name: data.cashierName || currentUser.full_name,
      start_time: recordedAtIso,
      opening_float: Number(data.openingFloat),
      opening_readings: Object.keys(validReadings).length > 0 ? validReadings : undefined,
      status: 'open',
      note: data.notes?.trim() || undefined,
      hub_id: targetHubId
    };

    setShifts(prev => [newShift, ...prev]);
    return { success: true, shift: newShift };
  };

  // 8. Shift Management: Close Shift
  const closeShift = (data: {
    shiftId: string;
    cashCounted: number;
    notes?: string;
    closingReadings?: Record<string, number>;
  }) => {
    const shift = shifts.find(s => s.id === data.shiftId);
    if (!shift) return { success: false, error: 'Shift not found' };

    const targetHubId = shift.hub_id || getTargetHubId();
    const shiftEndDate = new Date();
    const recordedAtIso = shiftEndDate.toISOString();
    const newPumpReadings: PumpReading[] = [];
    const validClosingReadings: Record<string, number> = {};

    if (data.closingReadings) {
      for (const [pumpId, reading] of Object.entries(data.closingReadings)) {
        const num = Number(reading);
        if (!isNaN(num) && num > 0) {
          const pump = allPumps.find(p => p.id === pumpId);
          const opening = shift.opening_readings?.[pumpId] ?? pump?.last_meter_reading ?? 0;
          const validation = validateNewPumpReading(num, opening);
          if (!validation.isValid) {
            return { success: false, error: validation.error };
          }
          validClosingReadings[pumpId] = num;
          newPumpReadings.push({
            id: `pr-shift-close-${Date.now()}-${pumpId}`,
            pump_id: pumpId,
            reading: num,
            recorded_at: recordedAtIso,
            note: `Shift closing meter reading (${shift.cashier_name || currentUser.full_name || 'Staff'})`,
            hub_id: targetHubId
          });
        }
      }

      // Update pumps last_meter_reading
      setPumps(prev => prev.map(p => {
        const r = validClosingReadings[p.id];
        return r !== undefined && !isNaN(Number(r)) ? { ...p, last_meter_reading: Number(r) } : p;
      }));

      // Append to pumpReadings
      if (newPumpReadings.length > 0) {
        setPumpReadings(prev => [...prev, ...newPumpReadings]);
      }
    }

    const { cashSales, cashExpenses } = computeShiftCash(shift, orders, expenses, shiftEndDate, sales);

    const summary = calculateShiftSummary(
      shift.opening_float,
      cashSales,
      cashExpenses,
      data.cashCounted
    );

    const updatedShift: Shift = {
      ...shift,
      end_time: shiftEndDate.toISOString(),
      cash_sales: summary.cashSales,
      cash_expenses: summary.cashExpenses,
      expected_cash: summary.expectedCash,
      cash_counted: summary.cashCounted,
      cash_variance: summary.cashVariance,
      closing_readings: Object.keys(validClosingReadings).length > 0 ? validClosingReadings : undefined,
      status: 'closed',
      note: data.notes ? (shift.note ? `${shift.note} | ${data.notes}` : data.notes) : shift.note
    };

    setShifts(prev => prev.map(s => s.id === data.shiftId ? updatedShift : s));
    return { success: true, shift: updatedShift };
  };

  // 8b. Record Shift Opening Readings (Shift Meter Gate)
  const recordShiftOpeningReadings = (readings: Record<string, number>) => {
    if (!activeShift) {
      return startShift({
        cashierName: currentUser.full_name || 'Depot Cashier',
        openingFloat: 0,
        notes: 'Shift opened with morning pump readings',
        openingReadings: readings
      });
    }

    const recordedAtIso = new Date().toISOString();
    const newPumpReadings: PumpReading[] = [];

    for (const [pumpId, reading] of Object.entries(readings)) {
      const num = Number(reading);
      if (!isNaN(num) && num > 0) {
        const pump = allPumps.find(p => p.id === pumpId);
        const validation = validateNewPumpReading(num, pump?.last_meter_reading ?? 0);
        if (!validation.isValid) {
          return { success: false, error: validation.error };
        }
        newPumpReadings.push({
          id: `pr-shift-open-${Date.now()}-${pumpId}`,
          pump_id: pumpId,
          reading: num,
          recorded_at: recordedAtIso,
          note: `Shift opening meter reading (${activeShift.cashier_name || 'Staff'})`,
          hub_id: activeShift.hub_id || getTargetHubId()
        });
      }
    }

    // Update pumps last_meter_reading
    setPumps(prev => prev.map(p => {
      const r = readings[p.id];
      return r !== undefined && !isNaN(Number(r)) ? { ...p, last_meter_reading: Number(r) } : p;
    }));

    // Append to pumpReadings
    setPumpReadings(prev => [...prev, ...newPumpReadings]);

    // Update shift opening readings record
    const updatedShift: Shift = {
      ...activeShift,
      opening_readings: {
        ...(activeShift.opening_readings || {}),
        ...readings
      }
    };

    setShifts(prev => prev.map(s => s.id === activeShift.id ? updatedShift : s));
    return { success: true };
  };

  // 9. Record Pump Reading (Audit Log)
  const recordPumpReading = (pumpId: string, reading: number, note?: string, confirmed?: boolean) => {
    const pump = pumps.find(p => p.id === pumpId);
    if (!pump) return { success: false, error: 'Pump not found' };

    const validation = validateNewPumpReading(reading, pump.last_meter_reading);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    if (validation.warning && !confirmed) {
      return { success: false, warning: validation.warning };
    }

    const newReading: PumpReading = {
      id: `pr-${Date.now()}`,
      pump_id: pumpId,
      reading: Number(reading),
      recorded_at: new Date().toISOString(),
      note: note?.trim() || undefined,
      recorded_by: currentUser.full_name || (userRole === 'owner' ? 'Managing Director' : 'Depot Cashier'),
      hub_id: pump.hub_id || getTargetHubId()
    };

    // Update pump's last_meter_reading
    setPumps(prev => prev.map(p => (p.id === pumpId ? { ...p, last_meter_reading: Number(reading) } : p)));
    setPumpReadings(prev => [...prev, newReading]);

    return { success: true, pumpReading: newReading };
  };

  // 9a. Reset a pump's meter (new/replaced meter, recalibration, new market —
  //     a deliberate break in the monotonic sequence). Owner-only in the UI.
  //     Bypasses validateNewPumpReading on purpose: this is the one place a
  //     lower reading is legitimate. Reconciliation (calculatePumpMeterVariance)
  //     treats the is_reset row as a fresh baseline, not a giant shortfall.
  const resetPumpMeter = (pumpId: string, oldFinalReading: number, newReading: number, reason: string) => {
    const pump = pumps.find(p => p.id === pumpId);
    if (!pump) return { success: false, error: 'Pump not found' };

    const numOldReading = Number(oldFinalReading);
    const numReading = Number(newReading);
    if (isNaN(numOldReading) || numOldReading < 0) {
      return { success: false, error: 'Please enter a valid final reading (0 or higher) for what the meter showed just before it was rubbed off' };
    }
    if (isNaN(numReading) || numReading < 0) {
      return { success: false, error: 'Please enter a valid meter reading (0 or higher)' };
    }
    if (!reason.trim()) {
      return { success: false, error: 'A reason is required to reset a pump meter' };
    }

    const recordedBy = currentUser.full_name || (userRole === 'owner' ? 'Managing Director' : 'Depot Cashier');
    const now = new Date().toISOString();
    // Snapshot exactly what the meter read the instant before it was zeroed —
    // this is the "rub off" reading the depot needs on file — then, right
    // after it, the fresh baseline the new batch starts counting from.
    const finalReading: PumpReading = {
      id: `pr-${Date.now()}`,
      pump_id: pumpId,
      reading: numOldReading,
      recorded_at: now,
      note: `Final reading before meter rub-off — ${reason.trim()}`,
      recorded_by: recordedBy,
      hub_id: pump.hub_id || getTargetHubId()
    };
    const resetReading: PumpReading = {
      id: `pr-${Date.now()}-reset`,
      pump_id: pumpId,
      reading: numReading,
      recorded_at: now,
      note: reason.trim(),
      recorded_by: recordedBy,
      hub_id: pump.hub_id || getTargetHubId(),
      is_reset: true
    };

    setPumps(prev => prev.map(p => (p.id === pumpId ? { ...p, last_meter_reading: numReading } : p)));
    setPumpReadings(prev => [...prev, finalReading, resetReading]);

    return { success: true, pumpReading: resetReading };
  };

  // 9b. Pumps CRUD (named register). Note: `physical_tank_id` has no column
  // on the `pumps` table yet (schema gap #14 in supabase/SCHEMA.md, deferred
  // there as low-value) — kept fully working in local state, just not sent
  // to Supabase until that column exists.
  const addPump = (data: { label: string; productId?: string; openingReading?: number; physicalTankId?: string | null; hubId?: string }) => {
    const newPump: Pump = {
      id: `p-${Date.now()}`,
      label: data.label.trim(),
      product_id: data.productId || undefined,
      last_meter_reading: Number(data.openingReading) || 0,
      physical_tank_id: data.physicalTankId || null,
      hub_id: data.hubId || getTargetHubId()
    };
    setPumps(prev => [...prev, newPump]);
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('pumps')
        .insert({
          id: newPump.id,
          label: newPump.label,
          product_id: newPump.product_id || null,
          last_meter_reading: newPump.last_meter_reading,
          hub_id: newPump.hub_id || null
        })
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to save pump to database:', error.message);
            showToast('error', `"${newPump.label}" was saved on this device only — it didn't sync to the database (${error.message}).`);
          }
        });
    }
    return newPump;
  };

  const updatePump = (pumpId: string, updates: { label?: string; product_id?: string | null; physical_tank_id?: string | null; hub_id?: string }) => {
    setPumps(prev =>
      prev.map(p =>
        p.id === pumpId
          ? {
              ...p,
              label: updates.label !== undefined ? updates.label.trim() || p.label : p.label,
              product_id: updates.product_id !== undefined ? updates.product_id || undefined : p.product_id,
              physical_tank_id: updates.physical_tank_id !== undefined ? updates.physical_tank_id || null : p.physical_tank_id,
              hub_id: updates.hub_id !== undefined ? updates.hub_id : p.hub_id
            }
          : p
      )
    );
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('pumps')
        .update({
          ...(updates.label !== undefined && { label: updates.label.trim() || undefined }),
          ...(updates.product_id !== undefined && { product_id: updates.product_id || null }),
          ...(updates.hub_id !== undefined && { hub_id: updates.hub_id || null })
        })
        .eq('id', pumpId)
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to update pump in database:', error.message);
            showToast('error', `Pump changes were saved on this device only — they didn't sync to the database (${error.message}).`);
          }
        });
    }
  };

  const deletePump = (pumpId: string) => {
    const hasReadings = pumpReadings.some(r => r.pump_id === pumpId);
    if (hasReadings) {
      return { success: false, error: 'Cannot remove a pump with logged readings — its history would be lost.' };
    }
    setPumps(prev => prev.filter(p => p.id !== pumpId));
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('pumps')
        .delete()
        .eq('id', pumpId)
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to delete pump from database:', error.message);
            showToast('error', `Removed here, but the database delete failed (${error.message}) — it may reappear on other devices.`);
          }
        });
    }
    return { success: true };
  };

  // 10. Add Expense
  const addExpense = (
    category: string,
    amount: number,
    note?: string,
    date?: string,
    options?: {
      recordedBy?: string;
      chargeToCustomerId?: string;
      debtReason?: string;
    }
  ) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Expense amount must be greater than zero' };
    }
    if (!category.trim()) {
      return { success: false, error: 'Expense category is required' };
    }
    const staffName = options?.recordedBy || currentUser?.full_name || 'Staff';
    const expenseDate = date || new Date().toISOString();
    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      date: expenseDate,
      category: category.trim(),
      amount: numericAmount,
      note,
      recorded_by: staffName,
      customer_id: options?.chargeToCustomerId || undefined,
      charge_to_customer: !!options?.chargeToCustomerId,
      hub_id: getTargetHubId()
    };

    setExpenses(prev => [newExpense, ...prev]);

    // If "Charge to Customer Debt" is selected, automatically record a customer debt order line
    if (options?.chargeToCustomerId) {
      const cust = customers.find(c => c.id === options.chargeToCustomerId);
      if (cust) {
        const debtSaleId = `sale-exp-${Date.now()}`;
        const reason = options.debtReason?.trim() || note?.trim() || `Expense (${category.trim()})`;
        const effectiveTerms = cust.credit_term_days || 14;
        const dueDate = new Date(new Date(expenseDate).getTime() + effectiveTerms * 86400000).toISOString();

        const debtSale: Sale = {
          id: debtSaleId,
          customer_id: cust.id,
          date: expenseDate,
          payment_method: 'credit',
          cashier_name: staffName,
          note: `Debited from expense: ${reason}`,
          credit_term_days: effectiveTerms,
          due_date: dueDate,
          voided: false,
          hub_id: getTargetHubId()
        };

        const debtOrder: Order = {
          id: `ord-exp-${Date.now()}`,
          sale_id: debtSaleId,
          customer_id: cust.id,
          product_id: products[0]?.id || 'veg',
          variety_id: products[0]?.varieties[0]?.id || 'standard',
          variety_name: products[0]?.varieties[0]?.name || 'Expense Surcharge',
          pack_size_id: 'sz_custom',
          qty: 1,
          litres: 0,
          unit_price: numericAmount,
          original_unit_price: numericAmount,
          price_adjusted: false,
          price_adjust_reason: null,
          oil_amount: numericAmount,
          container_mode: 'none',
          returnable: false,
          container_unit_price: null,
          container_amount: null,
          line_amount: numericAmount,
          amount: numericAmount,
          pricing_tier: cust.type,
          payment_method: 'credit',
          paid_amount: 0,
          credit_term_days: effectiveTerms,
          due_date: dueDate,
          date: expenseDate,
          source_tank_id: null,
          tank_allocations: null,
          voided: false,
          note: `Expense: ${category} - ${reason}`,
          hub_id: getTargetHubId()
        };

        setSales(prev => [debtSale, ...prev]);
        setOrders(prev => [debtOrder, ...prev]);
      }
    }

    return { success: true, expense: newExpense };
  };

  // 11. Add Product — starts with one "Standard" variety, no pack sizes and no
  //     prices; the owner configures those in the Inventory tab.
  const addProduct = (productData: Omit<Product, 'id'>) => {
    const id = `prod-${Date.now()}`;
    const varieties = productData.varieties && productData.varieties.length
      ? productData.varieties
      : [{ id: `${id}-standard`, name: 'Standard' }];
    const newProduct: Product = {
      ...productData,
      id,
      varieties,
      pack_config: productData.pack_config ?? []
    };
    setProducts(prev => [...prev, newProduct]);
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .insert({
          id: newProduct.id,
          name: newProduct.name,
          supply_model: newProduct.supply_model,
          litres_per_ton: newProduct.litres_per_ton,
          litres_per_keg: newProduct.litres_per_keg,
          keg_sell_price: newProduct.keg_sell_price,
          color_light: newProduct.color_light,
          color_dark: newProduct.color_dark
        })
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to save product to database:', error.message);
            showToast('error', `"${newProduct.name}" was saved on this device only — it didn't sync to the database (${error.message}).`);
            return;
          }
          supabase!
            .from('product_varieties')
            .insert(varieties.map((v, i) => ({ id: v.id, product_id: newProduct.id, name: v.name, sort_order: i })))
            .then(({ error: varietyError }) => {
              if (varietyError) console.error('[store] Failed to save product varieties to database:', varietyError.message);
            });
        });
    }
    return newProduct;
  };

  // 11b. Update Product (name, supply_model, varieties, pack_config, …).
  // `pack_config` has no database column — local-only, never sent.
  const updateProduct = (productId: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => (p.id === productId ? { ...p, ...updates } : p)));
    if (updates.varieties) {
      // A variety that no longer exists can't keep priced rows in the
      // Inventory price matrix — prune them so they don't linger orphaned.
      const keptVarietyIds = new Set(updates.varieties.map(v => v.id));
      setPackPrices(prev => prev.filter(pp => pp.product_id !== productId || keptVarietyIds.has(pp.variety_id)));
    }
    if (isSupabaseConfigured && supabase) {
      const productPatch: Record<string, unknown> = {};
      if (updates.name !== undefined) productPatch.name = updates.name;
      if (updates.supply_model !== undefined) productPatch.supply_model = updates.supply_model;
      if (updates.litres_per_ton !== undefined) productPatch.litres_per_ton = updates.litres_per_ton;
      if (updates.litres_per_keg !== undefined) productPatch.litres_per_keg = updates.litres_per_keg;
      if (updates.keg_sell_price !== undefined) productPatch.keg_sell_price = updates.keg_sell_price;
      if (updates.color_light !== undefined) productPatch.color_light = updates.color_light;
      if (updates.color_dark !== undefined) productPatch.color_dark = updates.color_dark;

      const applyVarieties = () => {
        if (!updates.varieties) return;
        const varieties = updates.varieties;
        supabase!
          .from('product_varieties')
          .delete()
          .eq('product_id', productId)
          .then(({ error: deleteError }) => {
            if (deleteError) {
              console.error('[store] Failed to replace product varieties in database:', deleteError.message);
              return;
            }
            supabase!
              .from('product_varieties')
              .insert(varieties.map((v, i) => ({ id: v.id, product_id: productId, name: v.name, sort_order: i })))
              .then(({ error: insertError }) => {
                if (insertError) console.error('[store] Failed to save product varieties to database:', insertError.message);
              });
          });
      };

      if (Object.keys(productPatch).length > 0) {
        supabase
          .from('products')
          .update(productPatch)
          .eq('id', productId)
          .then(({ error }) => {
            if (error) {
              console.error('[store] Failed to update product in database:', error.message);
              showToast('error', `Product changes were saved on this device only — they didn't sync to the database (${error.message}).`);
              return;
            }
            applyVarieties();
          });
      } else {
        applyVarieties();
      }
    }
  };

  // 11c. Delete Product
  const deleteProduct = (productId: string) => {
    const hasActiveTanks = tanks.some(t => t.product_id === productId && t.remaining_litres > 0);
    if (hasActiveTanks) {
      return { success: false, error: 'Cannot remove product with active stock in storage tanks.' };
    }
    setProducts(prev => prev.filter(p => p.id !== productId));
    setPackPrices(prev => prev.filter(pp => pp.product_id !== productId));
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to delete product from database:', error.message);
            showToast('error', `Removed here, but the database delete failed (${error.message}) — it may reappear on other devices.`);
          }
        });
    }
    return { success: true };
  };

  // 12. Price matrix — upsert one cell keyed by (product, variety, pack size, tier).
  const setPackPrice = (
    productId: string,
    varietyId: string,
    packSizeId: string,
    tier: CustomerType,
    price: number
  ) => {
    setPackPrices(prev => {
      const idx = prev.findIndex(
        p =>
          p.product_id === productId &&
          p.variety_id === varietyId &&
          p.pack_size_id === packSizeId &&
          p.tier === tier
      );
      const row: PackPrice = { product_id: productId, variety_id: varietyId, pack_size_id: packSizeId, tier, price: Number(price) };
      if (idx === -1) return [...prev, row];
      const next = prev.slice();
      next[idx] = row;
      return next;
    });
  };

  // 12b. Price matrix — bulk upsert (the Inventory "Save prices" action).
  const bulkSetPackPrices = (rows: PackPrice[]) => {
    setPackPrices(prev => {
      const map = new Map<string, PackPrice>();
      for (const p of prev) {
        map.set(`${p.product_id}|${p.variety_id}|${p.pack_size_id}|${p.tier}`, p);
      }
      for (const r of rows) {
        map.set(`${r.product_id}|${r.variety_id}|${r.pack_size_id}|${r.tier}`, {
          ...r,
          price: Number(r.price)
        });
      }
      return Array.from(map.values());
    });
  };

  // 12c. Per-product pack-size list + returnable / container-price config.
  const updateProductPackConfig = (productId: string, config: ProductPackConfig[]) => {
    setProducts(prev => prev.map(p => (p.id === productId ? { ...p, pack_config: config } : p)));
  };

  // 13. Update Settings
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...newSettings };
      if (isSupabaseConfigured && supabase) {
        supabase
          .from('app_settings')
          .upsert(toAppSettingsRow(next))
          .then(({ error }) => {
            if (error) {
              console.error('[store] Failed to save settings to database:', error.message);
              showToast('error', `Settings were saved on this device only — they didn't sync to the database (${error.message}).`);
            }
          });
      }
      return next;
    });
  };

  // 14. Add Customer
  const addCustomer = (customerData: Omit<Customer, 'id'>) => {
    const newCust: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`,
      hub_id: customerData.hub_id || getTargetHubId()
    };
    setCustomers(prev => [...prev, newCust]);
    return newCust;
  };

  // 15. Update Customer
  const updateCustomer = (id: string, customerData: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, ...customerData } : c)));
  };

  // 16. Suppliers CRUD
  const addSupplier = (supplierData: Omit<Supplier, 'id'>) => {
    const newSup: Supplier = {
      ...supplierData,
      id: `sup-${Date.now()}`
    };
    setSuppliers(prev => [...prev, newSup]);
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('suppliers')
        .insert({ id: newSup.id, name: newSup.name, phone: newSup.phone || null })
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to save supplier to database:', error.message);
            showToast('error', `"${newSup.name}" was saved on this device only — it didn't sync to the database (${error.message}).`);
          }
        });
    }
    return newSup;
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('suppliers')
        .update({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.phone !== undefined && { phone: updates.phone || null })
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to update supplier in database:', error.message);
            showToast('error', `Supplier changes were saved on this device only — they didn't sync to the database (${error.message}).`);
          }
        });
    }
  };

  const deleteSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('suppliers')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to delete supplier from database:', error.message);
            showToast('error', `Removed here, but the database delete failed (${error.message}) — it may reappear on other devices.`);
          }
        });
    }
  };

  // 17. Physical Tanks CRUD
  const addPhysicalTank = (tankData: Omit<PhysicalTank, 'id'>) => {
    const newPT: PhysicalTank = {
      ...tankData,
      id: `pt-${Date.now()}`,
      hub_id: tankData.hub_id || getTargetHubId()
    };
    setPhysicalTanks(prev => [...prev, newPT]);
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('physical_tanks')
        .insert({
          id: newPT.id,
          label: newPT.label,
          product_id: newPT.product_id,
          capacity_litres: newPT.capacity_litres,
          notes: newPT.notes || null,
          hub_id: newPT.hub_id || null
        })
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to save physical tank to database:', error.message);
            showToast('error', `"${newPT.label}" was saved on this device only — it didn't sync to the database (${error.message}).`);
          }
        });
    }
    return newPT;
  };

  const updatePhysicalTank = (id: string, updates: Partial<PhysicalTank>) => {
    setPhysicalTanks(prev => prev.map(pt => pt.id === id ? { ...pt, ...updates } : pt));
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('physical_tanks')
        .update({
          ...(updates.label !== undefined && { label: updates.label }),
          ...(updates.product_id !== undefined && { product_id: updates.product_id }),
          ...(updates.capacity_litres !== undefined && { capacity_litres: updates.capacity_litres }),
          ...(updates.notes !== undefined && { notes: updates.notes || null }),
          ...(updates.hub_id !== undefined && { hub_id: updates.hub_id || null })
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to update physical tank in database:', error.message);
            showToast('error', `Tank changes were saved on this device only — they didn't sync to the database (${error.message}).`);
          }
        });
    }
  };

  const deletePhysicalTank = (id: string) => {
    const hasPumps = allPumps.some(p => p.physical_tank_id === id);
    const hasStockRecords = allTanks.some(t => t.physical_tank_id === id);
    if (hasPumps || hasStockRecords) {
      return { success: false, error: 'Cannot delete a physical tank with pumps or stock records still assigned to it.' };
    }
    setPhysicalTanks(prev => prev.filter(pt => pt.id !== id));
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('physical_tanks')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error('[store] Failed to delete physical tank from database:', error.message);
            showToast('error', `Removed here, but the database delete failed (${error.message}) — it may reappear on other devices.`);
          }
        });
    }
    return { success: true };
  };

  // 18. Reset to default seed data — offline/dev mode only (hidden entirely
  // once Supabase is configured; see SettingsScreen.tsx). Clears only this
  // app's own STORAGE_KEYS, never a blanket localStorage.clear() — this
  // origin may also hold the Supabase auth session token and other data
  // that has nothing to do with this reset.
  const resetToSeedData = () => {
    setHubs(DEFAULT_HUBS);
    setCurrentUserState(FALLBACK_OWNER_IDENTITY);
    setActiveHubIdState('all');
    setProducts(DEFAULT_PRODUCTS);
    setPackPrices(DEFAULT_PACK_PRICES);
    setCustomers(DEFAULT_CUSTOMERS);
    setSuppliers(DEFAULT_SUPPLIERS);
    setPhysicalTanks(DEFAULT_PHYSICAL_TANKS);
    setTanks(SEED_TANKS);
    setSales(SEED_SALES);
    setOrders(SEED_ORDERS);
    setPayments(SEED_PAYMENTS);
    setAuditLog(SEED_AUDIT_LOG);
    setKegReturns(SEED_KEG_RETURNS);
    setExpenses(SEED_EXPENSES);
    setSettings(DEFAULT_SETTINGS);
    setPumps(DEFAULT_PUMPS);
    setPumpReadings(SEED_PUMP_READINGS);
    setTransfers(SEED_TRANSFERS);
    setCustomerCredits([]);
    setShifts(SEED_SHIFTS);
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        packPrices,
        customers,
        suppliers,
        physicalTanks,
        tanks,
        sales,
        orders,
        payments,
        auditLog,
        kegReturns,
        expenses,
        settings,
        pumps,
        pumpReadings,
        transfers,
        customerCredits,
        shifts,
        activeShift,
        shiftGateStatus,
        userRole,
        setUserRole,
        theme,
        setTheme,
        toggleTheme,
        customerStatsMap,
        kegInventory,
        tankStockByProduct,
        stockView,
        pumpVarianceAudits,
        activeAlerts,
        todayStats,
        hubs,
        currentUser,
        activeHubId,
        activeHub,
        setCurrentUser,
        setActiveHubId,
        addHub,
        updateHub,
        deleteHub,
        allTanks,
        allSales,
        allOrders,
        allShifts,
        allExpenses,
        allPumps,
        logTruckIntake,
        logPreKeggedIntake,
        createSale,
        recordCustomerPayment,
        redeemCustomerCredit,
        voidSale,
        voidPayment,
        updatePaymentDate,
        updateOrderLine,
        updateExpense,
        voidExpense,
        updateTankIntake,
        logKegReturn,
        logTransfer,
        startShift,
        closeShift,
        recordShiftOpeningReadings,
        recordPumpReading,
        resetPumpMeter,
        addPump,
        updatePump,
        deletePump,
        addExpense,
        addProduct,
        updateProduct,
        deleteProduct,
        setPackPrice,
        bulkSetPackPrices,
        updateProductPackConfig,
        updateSettings,
        addCustomer,
        updateCustomer,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        addPhysicalTank,
        updatePhysicalTank,
        deletePhysicalTank,
        activeReceipt,
        setActiveReceipt,
        resetToSeedData
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

