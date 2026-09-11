import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Product,
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
  Pump,
  PumpReading,
  PumpVarianceAudit,
  Transfer,
  CustomerCredit,
  TankDipstickReading,
  Shift,
  Supplier,
  PhysicalTank
} from '../types';
import {
  DEFAULT_PRODUCTS,
  DEFAULT_PACK_PRICES,
  DEFAULT_CUSTOMERS,
  DEFAULT_SETTINGS,
  DEFAULT_PUMPS,
  DEFAULT_SUPPLIERS,
  DEFAULT_PHYSICAL_TANKS,
  SEED_PUMP_READINGS,
  SEED_TANKS,
  SEED_SALES,
  SEED_ORDERS,
  SEED_KEG_RETURNS,
  SEED_PAYMENTS,
  SEED_AUDIT_LOG,
  SEED_EXPENSES,
  SEED_TRANSFERS,
  SEED_DIPSTICK_READINGS,
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
  calculateDipstickVariance,
  calculateShiftSummary,
  computeShiftCash,
  getDepotToday,
  depotDateKey
} from './businessLogic';
import { priceSaleLine } from './pricing';

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
  dipstickReadings: TankDipstickReading[];
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
    dipstickVariance: { reading: TankDipstickReading; tank: Tank; variance: number }[];
    shiftDiscrepancy: Shift[];
    lowTankStock: { product: Product; litres: number; threshold: number }[];
    totalAlertCount: number;
  };
  todayStats: {
    cashTransferSales: number;
    creditOutstanding: number;
    companyKegsOut: number;
    kegsAtDepot: number;
    kegsSoldToday: number;
    purchasedKegsToday: number;
    customerKegsFilledToday: number;
    expensesToday: number;
    dailyFloatRemaining: number;
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
  }) => { success: boolean; tank?: Tank; error?: string };

  logPreKeggedIntake: (data: {
    supplierId: string;
    productId: string;
    kegsReceived: number;
    truckLabel?: string;
    physicalTankId?: string;
    spaceNote?: string;
  }) => { success: boolean; tank?: Tank; error?: string };
  
  createSale: (data: {
    customerId: string;
    paymentMethod: PaymentMethod;
    amountTendered?: number | null;
    note?: string;
    pricingTier?: CustomerType;
    lines: {
      productId: string;
      varietyId: string;
      packSizeId: string;
      qty: number;
      containerMode: ContainerMode;
      overrideUnitPrice?: number | null;
      priceAdjustReason?: string;
    }[];
  }) => { success: boolean; sale?: Sale; lines?: Order[]; receipt?: ReceiptData; error?: string };

  recordCustomerPayment: (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod
  ) => { success: boolean; receipt?: ReceiptData; error?: string };

  redeemCustomerCredit: (
    customerId: string,
    amount: number
  ) => { success: boolean; receipt?: ReceiptData; error?: string };

  /** Void a whole sale — its lines drop out of every balance, tank litres are restored, audited. */
  voidSale: (saleId: string, reason: string) => { success: boolean; error?: string };
  /** Void a recorded payment — reverses paid_amount on its lines and any overpayment credit, audited. */
  voidPayment: (paymentId: string, reason: string) => { success: boolean; error?: string };
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

  recordDipstickReading: (data: {
    tankId: string;
    readingLitres: number;
    notes?: string;
  }) => { success: boolean; reading?: TankDipstickReading; error?: string };

  startShift: (data: {
    cashierName: string;
    openingFloat: number;
    notes?: string;
  }) => { success: boolean; shift?: Shift; error?: string };

  closeShift: (data: {
    shiftId: string;
    cashCounted: number;
    notes?: string;
  }) => { success: boolean; shift?: Shift; error?: string };

  recordShiftOpeningReadings: (
    readings: Record<string, number>
  ) => { success: boolean; error?: string };

  recordPumpReading: (
    pumpId: string,
    reading: number,
    note?: string
  ) => { success: boolean; pumpReading?: PumpReading; error?: string };

  addPump: (data: { label: string; productId?: string; openingReading?: number }) => Pump;
  updatePump: (pumpId: string, updates: { label?: string; product_id?: string | null }) => void;
  deletePump: (pumpId: string) => { success: boolean; error?: string };

  addExpense: (
    category: string,
    amount: number,
    note?: string
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
  deletePhysicalTank: (id: string) => void;

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
  DIPSTICK_READINGS: 'iyanu_dipstick_readings_v3',
  SHIFTS: 'iyanu_shifts_v3',
  USER_ROLE: 'iyanu_user_role_v3',
  THEME: 'iyanu_theme_v3'
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

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  // Load state from LocalStorage or seed defaults
  const [products, setProducts] = useState<Product[]>(() => loadPersisted(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS));

  const [packPrices, setPackPrices] = useState<PackPrice[]>(() => loadPersisted(STORAGE_KEYS.PACK_PRICES, DEFAULT_PACK_PRICES));

  const [customers, setCustomers] = useState<Customer[]>(() => loadPersisted(STORAGE_KEYS.CUSTOMERS, DEFAULT_CUSTOMERS));

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadPersisted(STORAGE_KEYS.SUPPLIERS, DEFAULT_SUPPLIERS));

  const [physicalTanks, setPhysicalTanks] = useState<PhysicalTank[]>(() => loadPersisted(STORAGE_KEYS.PHYSICAL_TANKS, DEFAULT_PHYSICAL_TANKS));

  const [tanks, setTanks] = useState<Tank[]>(() => loadPersisted(STORAGE_KEYS.TANKS, SEED_TANKS));

  const [sales, setSales] = useState<Sale[]>(() => loadPersisted(STORAGE_KEYS.SALES, SEED_SALES));

  const [orders, setOrders] = useState<Order[]>(() => loadPersisted(STORAGE_KEYS.ORDERS, SEED_ORDERS));

  const [payments, setPayments] = useState<Payment[]>(() => loadPersisted(STORAGE_KEYS.PAYMENTS, SEED_PAYMENTS));

  const [auditLog, setAuditLog] = useState<AuditEntry[]>(() => loadPersisted(STORAGE_KEYS.AUDIT_LOG, SEED_AUDIT_LOG));

  const [kegReturns, setKegReturns] = useState<KegReturn[]>(() => loadPersisted(STORAGE_KEYS.KEG_RETURNS, SEED_KEG_RETURNS));

  const [expenses, setExpenses] = useState<Expense[]>(() => loadPersisted(STORAGE_KEYS.EXPENSES, SEED_EXPENSES));

  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadPersisted<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {})
  }));

  const [pumps, setPumps] = useState<Pump[]>(() => loadPersisted<Pump[]>(STORAGE_KEYS.PUMPS, DEFAULT_PUMPS));

  const [pumpReadings, setPumpReadings] = useState<PumpReading[]>(() => loadPersisted(STORAGE_KEYS.PUMP_READINGS, SEED_PUMP_READINGS));

  const [transfers, setTransfers] = useState<Transfer[]>(() => loadPersisted(STORAGE_KEYS.TRANSFERS, SEED_TRANSFERS));

  const [customerCredits, setCustomerCredits] = useState<CustomerCredit[]>(() => loadPersisted<CustomerCredit[]>(STORAGE_KEYS.CUSTOMER_CREDITS, []));

  const [dipstickReadings, setDipstickReadings] = useState<TankDipstickReading[]>(() => loadPersisted(STORAGE_KEYS.DIPSTICK_READINGS, SEED_DIPSTICK_READINGS));

  const [shifts, setShifts] = useState<Shift[]>(() => loadPersisted(STORAGE_KEYS.SHIFTS, SEED_SHIFTS));

  const [userRole, setUserRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
    return (saved as UserRole) || 'owner';
  });

  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  // Sync to LocalStorage on change
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
    localStorage.setItem(STORAGE_KEYS.PHYSICAL_TANKS, JSON.stringify(physicalTanks));
  }, [physicalTanks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TANKS, JSON.stringify(tanks));
  }, [tanks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(auditLog));
  }, [auditLog]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.KEG_RETURNS, JSON.stringify(kegReturns));
  }, [kegReturns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PUMPS, JSON.stringify(pumps));
  }, [pumps]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PUMP_READINGS, JSON.stringify(pumpReadings));
  }, [pumpReadings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(transfers));
  }, [transfers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_CREDITS, JSON.stringify(customerCredits));
  }, [customerCredits]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DIPSTICK_READINGS, JSON.stringify(dipstickReadings));
  }, [dipstickReadings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USER_ROLE, userRole);
  }, [userRole]);

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

  // 5. Split alerts (Overdue Credit, Over Limit, Delivery Shortfall, Pump Variance, Dipstick, Shifts, Low Tank Stock)
  const activeAlerts = useMemo(() => {
    const overdueCredit: { customer: Customer; overdueDays: number; amount: number }[] = [];
    const overLimit: { customer: Customer; balance: number; limit: number; excess: number }[] = [];
    const deliveryShortfall: { tank: Tank; shortfallLitres: number }[] = [];
    const pumpVariance = pumpVarianceAudits.filter(a => a.isOverThreshold);
    const dipstickVariance: { reading: TankDipstickReading; tank: Tank; variance: number }[] = [];
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

    // Check dipstick alerts
    dipstickReadings.forEach(d => {
      if (d.variance !== undefined && Math.abs(d.variance) > settings.dipstick_variance_threshold) {
        const tank = tanks.find(t => t.id === d.tank_id);
        if (tank) {
          dipstickVariance.push({
            reading: d,
            tank,
            variance: d.variance
          });
        }
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
      dipstickVariance.length +
      shiftDiscrepancy.length +
      lowTankStock.length;

    return {
      overdueCredit,
      overLimit,
      deliveryShortfall,
      pumpVariance,
      dipstickVariance,
      shiftDiscrepancy,
      lowTankStock,
      totalAlertCount
    };
  }, [customerStatsMap, tanks, products, tankStockByProduct, settings.truck_shortfall_threshold, settings.dipstick_variance_threshold, settings.low_stock_litres_threshold, pumpVarianceAudits, dipstickReadings, shifts]);


  // 6. Today's operational stats
  const todayStats = useMemo(() => {
    const todayStr = getDepotToday();
    const todayOrders = orders.filter(o => !o.voided && depotDateKey(o.date) === todayStr);

    // Money collected today that isn't credit (cash, bank transfer, POS card)
    const cashTransferSales = todayOrders
      .filter(o => o.payment_method === 'cash' || o.payment_method === 'transfer' || o.payment_method === 'pos')
      .reduce((sum, o) => sum + (o.paid_amount || 0), 0);

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

    const dailyFloatRemaining = Math.max(0, settings.daily_float - expensesToday);

    return {
      cashTransferSales,
      creditOutstanding,
      companyKegsOut: kegInventory.totalKegsOut,
      kegsAtDepot: kegInventory.kegsAtDepot,
      kegsSoldToday,
      purchasedKegsToday,
      customerKegsFilledToday,
      expensesToday,
      dailyFloatRemaining
    };
  }, [orders, expenses, settings.daily_float, customerStatsMap, kegInventory]);

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
      date: new Date().toISOString(),
      shortfall: metrics.shortfall,
      supplier_id: data.supplierId,
      physical_tank_id: data.physicalTankId || null,
      space_note: data.spaceNote?.trim() || undefined,
      supply_model: 'bulk_truck'
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
      date: new Date().toISOString(),
      shortfall: 0,
      supplier_id: data.supplierId,
      physical_tank_id: data.physicalTankId || null,
      space_note: data.spaceNote?.trim() || undefined,
      supply_model: 'pre_kegged'
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
        actor_name: userRole === 'owner' ? 'Managing Director' : 'Depot Cashier'
      },
      ...prev
    ]);
  };

  // 2. Create a multi-line sale: price each line off the matrix, draw litres FIFO
  //    across all lines, settle under one payment.
  const createSale = (data: {
    customerId: string;
    paymentMethod: PaymentMethod;
    amountTendered?: number | null;
    note?: string;
    pricingTier?: CustomerType;
    lines: {
      productId: string;
      varietyId: string;
      packSizeId: string;
      qty: number;
      containerMode: ContainerMode;
      overrideUnitPrice?: number | null;
      priceAdjustReason?: string;
    }[];
  }) => {
    const customer = customers.find(c => c.id === data.customerId);
    if (!customer) return { success: false, error: 'Customer not found' };
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

    const now = new Date();
    const saleId = `sale-${now.getTime()}`;
    let dueDate: string | null = null;
    if (data.paymentMethod === 'credit') {
      const due = new Date(now);
      due.setDate(due.getDate() + customer.credit_term_days);
      dueDate = due.toISOString();
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
        packPrices
      });

      if (priced.unpriced) {
        return {
          success: false,
          error: `Line ${i + 1}: ${product.name} / ${variety.name} / ${packLabelFor(line.packSizeId)} has no price for the ${tier} tier. Set it in Inventory.`
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
        id: `line-${now.getTime()}-${i + 1}`,
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
        voided: false,
        note: i === 0 ? data.note?.trim() || undefined : undefined
      });
    }

    const total = Number(newLines.reduce((s, l) => s + l.line_amount, 0).toFixed(2));
    const tendered =
      data.paymentMethod === 'cash' && data.amountTendered != null ? Number(data.amountTendered) : null;
    const changeDue = tendered != null ? Number(Math.max(0, tendered - total).toFixed(2)) : null;

    const sale: Sale = {
      id: saleId,
      customer_id: data.customerId,
      date: now.toISOString(),
      payment_method: data.paymentMethod,
      amount_tendered: tendered,
      change_due: changeDue,
      cashier_name: userRole === 'owner' ? 'Managing Director' : 'Depot Cashier',
      note: data.note?.trim() || undefined,
      voided: false
    };

    setTanks(workingTanks);
    setSales(prev => [sale, ...prev]);
    setOrders(prev => [...newLines, ...prev]);
    logAudit({ entity_type: 'sale', entity_id: saleId, action: 'create', changes: [] });

    const prevStats = customerStatsMap[customer.id];
    const previousBalance = prevStats ? prevStats.currentBalance : 0;
    const creditPortion = data.paymentMethod === 'credit' ? total : 0;

    const firstLine = newLines[0];
    const firstProduct = products.find(p => p.id === firstLine.product_id);
    const receipt: ReceiptData = {
      receiptNumber: `REC-${now.getTime().toString().slice(-6)}`,
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
    paymentMethod: PaymentMethod
  ) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return { success: false, error: 'Customer not found' };

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero' };
    }

    const prevStats = customerStatsMap[customer.id];
    const previousBalance = prevStats ? prevStats.currentBalance : 0;

    const paymentResult = applyFifoPayment(orders, customerId, numericAmount);

    setOrders(paymentResult.updatedOrders);

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
          created_at: new Date().toISOString(),
          note: 'Overpayment added to store credit'
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
      date: new Date().toISOString(),
      applied_to: paymentResult.appliedOrders.map(a => ({ order_id: a.orderId, amount: a.amountApplied })),
      overpayment_to_credit: overpayment,
      source: 'payment',
      recorded_by: userRole === 'owner' ? 'Managing Director' : 'Depot Cashier'
    };
    setPayments(prev => [payment, ...prev]);
    logAudit({ entity_type: 'payment', entity_id: payment.id, action: 'create', changes: [] });

    const receipt: ReceiptData = {
      receiptNumber,
      type: 'payment',
      date: new Date().toISOString(),
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
    setOrders(paymentResult.updatedOrders);

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
          note: 'Store credit applied to invoices'
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
        note: 'Store credit applied to invoices'
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
          note: 'Reversal of voided overpayment credit'
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

    const priced = priceSaleLine({
      product,
      varietyId: line.variety_id,
      packSizeId: line.pack_size_id,
      tier: line.pricing_tier,
      qty: nextQty,
      containerMode: nextMode,
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
      setTanks(draw.updatedTanks);
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
              paid_amount: o.payment_method === 'credit' ? Math.min(o.paid_amount || 0, priced.lineAmount) : priced.lineAmount,
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
      note: note?.trim() || undefined
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

    const newTransfer: Transfer = {
      id: `tr-${Date.now()}`,
      from_customer_id: data.fromCustomerId,
      to_customer_id: data.toCustomerId,
      item_type: 'keg',
      qty: Number(data.qty),
      product_id: data.productId ?? null,
      pack_size_id: data.packSizeId ?? null,
      date: new Date().toISOString(),
      note: data.notes?.trim() || undefined
    };

    setTransfers(prev => [newTransfer, ...prev]);
    return { success: true, transfer: newTransfer };
  };

  // 6. Tank Dipstick Verification Reading
  const recordDipstickReading = (data: {
    tankId: string;
    readingLitres: number;
    notes?: string;
  }) => {
    const tank = tanks.find(t => t.id === data.tankId);
    if (!tank) return { success: false, error: 'Tank not found' };
    if (!Number.isFinite(Number(data.readingLitres)) || Number(data.readingLitres) <= 0) {
      return { success: false, error: 'Dipstick reading must be greater than 0' };
    }

    const varianceAudit = calculateDipstickVariance(
      Number(data.readingLitres),
      tank.remaining_litres,
      settings.dipstick_variance_threshold
    );

    const newReading: TankDipstickReading = {
      id: `dip-${Date.now()}`,
      tank_id: data.tankId,
      reading_litres: Number(data.readingLitres),
      system_litres: tank.remaining_litres,
      recorded_at: new Date().toISOString(),
      variance: varianceAudit.variance,
      is_flagged: varianceAudit.isOverThreshold,
      note: data.notes?.trim() || undefined
    };

    setDipstickReadings(prev => [newReading, ...prev]);
    return { success: true, reading: newReading };
  };

  // 7. Shift Management: Start Shift
  const startShift = (data: {
    cashierName: string;
    openingFloat: number;
    notes?: string;
  }) => {
    if (shifts.some(s => s.status === 'open')) {
      return { success: false, error: 'A shift is already open. Close it before starting a new one.' };
    }
    if (!Number.isFinite(Number(data.openingFloat)) || Number(data.openingFloat) < 0) {
      return { success: false, error: 'Opening float cannot be negative' };
    }
    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      cashier_name: data.cashierName,
      start_time: new Date().toISOString(),
      opening_float: Number(data.openingFloat),
      status: 'open',
      note: data.notes?.trim() || undefined
    };

    setShifts(prev => [newShift, ...prev]);
    return { success: true, shift: newShift };
  };

  // 8. Shift Management: Close Shift
  const closeShift = (data: {
    shiftId: string;
    cashCounted: number;
    notes?: string;
  }) => {
    const shift = shifts.find(s => s.id === data.shiftId);
    if (!shift) return { success: false, error: 'Shift not found' };

    const shiftEndDate = new Date();
    const { cashSales, cashExpenses } = computeShiftCash(shift, orders, expenses, shiftEndDate);

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
      status: 'closed',
      note: data.notes ? (shift.note ? `${shift.note} | ${data.notes}` : data.notes) : shift.note
    };

    setShifts(prev => prev.map(s => s.id === data.shiftId ? updatedShift : s));
    return { success: true, shift: updatedShift };
  };

  // 8b. Record Shift Opening Readings (Shift Meter Gate)
  const recordShiftOpeningReadings = (readings: Record<string, number>) => {
    if (!activeShift) {
      return { success: false, error: 'No active shift is currently open. Please start a shift first.' };
    }

    const recordedAtIso = new Date().toISOString();
    const newPumpReadings: PumpReading[] = [];

    for (const [pumpId, reading] of Object.entries(readings)) {
      const num = Number(reading);
      if (!isNaN(num) && num > 0) {
        newPumpReadings.push({
          id: `pr-shift-open-${Date.now()}-${pumpId}`,
          pump_id: pumpId,
          reading: num,
          recorded_at: recordedAtIso,
          note: `Shift opening meter reading (${activeShift.cashier_name || 'Staff'})`
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
  const recordPumpReading = (pumpId: string, reading: number, note?: string) => {
    const pump = pumps.find(p => p.id === pumpId);
    if (!pump) return { success: false, error: 'Pump not found' };

    const validation = validateNewPumpReading(reading, pump.last_meter_reading);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const newReading: PumpReading = {
      id: `pr-${Date.now()}`,
      pump_id: pumpId,
      reading: Number(reading),
      recorded_at: new Date().toISOString(),
      note: note?.trim() || undefined,
      recorded_by: userRole === 'owner' ? 'Managing Director' : 'Depot Cashier'
    };

    // Update pump's last_meter_reading
    setPumps(prev => prev.map(p => (p.id === pumpId ? { ...p, last_meter_reading: Number(reading) } : p)));
    setPumpReadings(prev => [...prev, newReading]);

    return { success: true, pumpReading: newReading };
  };

  // 9b. Pumps CRUD (named register)
  const addPump = (data: { label: string; productId?: string; openingReading?: number }) => {
    const newPump: Pump = {
      id: `p-${Date.now()}`,
      label: data.label.trim(),
      product_id: data.productId || undefined,
      last_meter_reading: Number(data.openingReading) || 0
    };
    setPumps(prev => [...prev, newPump]);
    return newPump;
  };

  const updatePump = (pumpId: string, updates: { label?: string; product_id?: string | null }) => {
    setPumps(prev =>
      prev.map(p =>
        p.id === pumpId
          ? {
              ...p,
              label: updates.label !== undefined ? updates.label.trim() || p.label : p.label,
              product_id: updates.product_id !== undefined ? updates.product_id || undefined : p.product_id
            }
          : p
      )
    );
  };

  const deletePump = (pumpId: string) => {
    const hasReadings = pumpReadings.some(r => r.pump_id === pumpId);
    if (hasReadings) {
      return { success: false, error: 'Cannot remove a pump with logged readings — its history would be lost.' };
    }
    setPumps(prev => prev.filter(p => p.id !== pumpId));
    return { success: true };
  };

  // 10. Add Expense
  const addExpense = (category: string, amount: number, note?: string) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Expense amount must be greater than zero' };
    }
    if (!category.trim()) {
      return { success: false, error: 'Expense category is required' };
    }
    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      date: new Date().toISOString(),
      category: category.trim(),
      amount: numericAmount,
      note
    };

    setExpenses(prev => [newExpense, ...prev]);
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
    return newProduct;
  };

  // 11b. Update Product (name, supply_model, varieties, pack_config, …)
  const updateProduct = (productId: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => (p.id === productId ? { ...p, ...updates } : p)));
  };

  // 11c. Delete Product
  const deleteProduct = (productId: string) => {
    const hasActiveTanks = tanks.some(t => t.product_id === productId && t.remaining_litres > 0);
    if (hasActiveTanks) {
      return { success: false, error: 'Cannot remove product with active stock in storage tanks.' };
    }
    setProducts(prev => prev.filter(p => p.id !== productId));
    setPackPrices(prev => prev.filter(pp => pp.product_id !== productId));
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
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // 14. Add Customer
  const addCustomer = (customerData: Omit<Customer, 'id'>) => {
    const newCust: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`
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
    return newSup;
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  // 17. Physical Tanks CRUD
  const addPhysicalTank = (tankData: Omit<PhysicalTank, 'id'>) => {
    const newPT: PhysicalTank = {
      ...tankData,
      id: `pt-${Date.now()}`
    };
    setPhysicalTanks(prev => [...prev, newPT]);
    return newPT;
  };

  const updatePhysicalTank = (id: string, updates: Partial<PhysicalTank>) => {
    setPhysicalTanks(prev => prev.map(pt => pt.id === id ? { ...pt, ...updates } : pt));
  };

  const deletePhysicalTank = (id: string) => {
    setPhysicalTanks(prev => prev.filter(pt => pt.id !== id));
  };

  // 18. Reset to default demo seed data
  const resetToSeedData = () => {
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
    setDipstickReadings(SEED_DIPSTICK_READINGS);
    setShifts(SEED_SHIFTS);
    localStorage.clear();
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
        dipstickReadings,
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
        logTruckIntake,
        logPreKeggedIntake,
        createSale,
        recordCustomerPayment,
        redeemCustomerCredit,
        voidSale,
        voidPayment,
        updateOrderLine,
        updateExpense,
        voidExpense,
        updateTankIntake,
        logKegReturn,
        logTransfer,
        recordDipstickReading,
        startShift,
        closeShift,
        recordShiftOpeningReadings,
        recordPumpReading,
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

