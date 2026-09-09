import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Product,
  RateCard,
  Customer,
  Tank,
  Order,
  KegReturn,
  Expense,
  AppSettings,
  UserRole,
  CustomerCalculatedStats,
  KegInventorySummary,
  ReceiptData,
  UnitType,
  PaymentMethod,
  KegSource,
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
  DEFAULT_RATE_CARDS,
  DEFAULT_CUSTOMERS,
  DEFAULT_SETTINGS,
  DEFAULT_PUMPS,
  DEFAULT_SUPPLIERS,
  DEFAULT_PHYSICAL_TANKS,
  SEED_PUMP_READINGS,
  SEED_TANKS,
  SEED_ORDERS,
  SEED_KEG_RETURNS,
  SEED_EXPENSES,
  SEED_TRANSFERS,
  SEED_DIPSTICK_READINGS,
  SEED_SHIFTS
} from '../constants/config';
import {
  calculateCustomerStats,
  calculateKegInventory,
  executeFifoTankDraw,
  applyFifoPayment,
  lookupRatePerLitre,
  calculateOrderPricing,
  calculateIntakeMetrics,
  calculatePreKeggedIntakeMetrics,
  checkShiftOpeningMetersGate,
  ShiftOpeningGateStatus,
  calculatePumpMeterVariance,
  validateNewPumpReading,
  calculatePerOrderMeterVariance,
  calculateDipstickVariance,
  calculateShiftSummary,
  computeShiftCash,
  getDepotToday,
  depotDateKey
} from './businessLogic';

interface StoreContextType {
  products: Product[];
  rateCards: RateCard[];
  customers: Customer[];
  suppliers: Supplier[];
  physicalTanks: PhysicalTank[];
  tanks: Tank[];
  orders: Order[];
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
  pumpVarianceAudits: PumpVarianceAudit[];
  activeAlerts: {
    overdueCredit: { customer: Customer; overdueDays: number; amount: number }[];
    overLimit: { customer: Customer; balance: number; limit: number; excess: number }[];
    deliveryShortfall: { tank: Tank; shortfallLitres: number }[];
    pumpVariance: PumpVarianceAudit[];
    dipstickVariance: { reading: TankDipstickReading; tank: Tank; variance: number }[];
    shiftDiscrepancy: Shift[];
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
  
  createNewOrder: (data: {
    customerId: string;
    productId: string;
    unit: UnitType;
    qty: number;
    paymentMethod: PaymentMethod;
    kegSource: KegSource;
    pumpId?: string | null;
    meterReading?: number | null;
    deliveredQty?: number | null;
    note?: string;
    customRate?: number;
    discountReason?: string;
  }) => { success: boolean; order?: Order; receipt?: ReceiptData; error?: string };

  recordCustomerPayment: (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod
  ) => { success: boolean; receipt?: ReceiptData; error?: string };

  redeemCustomerCredit: (
    customerId: string,
    amount: number
  ) => { success: boolean; receipt?: ReceiptData; error?: string };

  logKegReturn: (
    customerId: string,
    qty: number
  ) => { success: boolean; kegReturn?: KegReturn; error?: string };

  logTransfer: (data: {
    fromCustomerId: string;
    toCustomerId: string;
    itemType: 'keg';
    qty: number;
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

  addExpense: (
    category: string,
    amount: number,
    note?: string
  ) => { success: boolean; expense?: Expense; error?: string };

  addProduct: (productData: Omit<Product, 'id'>) => Product;
  updateProduct: (productId: string, updates: Partial<Product>) => void;
  deleteProduct: (productId: string) => { success: boolean; error?: string };
  updateRateCard: (productId: string, tier: string, ratePerLitre: number) => void;
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
  PRODUCTS: 'iyanu_products_v2',
  RATE_CARDS: 'iyanu_rate_cards_v2',
  CUSTOMERS: 'iyanu_customers_v2',
  SUPPLIERS: 'iyanu_suppliers_v2',
  PHYSICAL_TANKS: 'iyanu_physical_tanks_v2',
  TANKS: 'iyanu_tanks_v2',
  ORDERS: 'iyanu_orders_v2',
  KEG_RETURNS: 'iyanu_keg_returns_v2',
  EXPENSES: 'iyanu_expenses_v2',
  SETTINGS: 'iyanu_settings_v2',
  PUMPS: 'iyanu_pumps_v2',
  PUMP_READINGS: 'iyanu_pump_readings_v2',
  TRANSFERS: 'iyanu_transfers_v2',
  CUSTOMER_CREDITS: 'iyanu_customer_credits_v2',
  DIPSTICK_READINGS: 'iyanu_dipstick_readings_v2',
  SHIFTS: 'iyanu_shifts_v2',
  USER_ROLE: 'iyanu_user_role_v2',
  THEME: 'iyanu_theme_v2'
};

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
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return saved ? JSON.parse(saved) : DEFAULT_PRODUCTS;
  });

  const [rateCards, setRateCards] = useState<RateCard[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RATE_CARDS);
    return saved ? JSON.parse(saved) : DEFAULT_RATE_CARDS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return saved ? JSON.parse(saved) : DEFAULT_CUSTOMERS;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    return saved ? JSON.parse(saved) : DEFAULT_SUPPLIERS;
  });

  const [physicalTanks, setPhysicalTanks] = useState<PhysicalTank[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PHYSICAL_TANKS);
    return saved ? JSON.parse(saved) : DEFAULT_PHYSICAL_TANKS;
  });

  const [tanks, setTanks] = useState<Tank[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TANKS);
    return saved ? JSON.parse(saved) : SEED_TANKS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return saved ? JSON.parse(saved) : SEED_ORDERS;
  });

  const [kegReturns, setKegReturns] = useState<KegReturn[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.KEG_RETURNS);
    return saved ? JSON.parse(saved) : SEED_KEG_RETURNS;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return saved ? JSON.parse(saved) : SEED_EXPENSES;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const [pumps, setPumps] = useState<Pump[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PUMPS);
    return saved ? JSON.parse(saved) : DEFAULT_PUMPS;
  });

  const [pumpReadings, setPumpReadings] = useState<PumpReading[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PUMP_READINGS);
    return saved ? JSON.parse(saved) : SEED_PUMP_READINGS;
  });

  const [transfers, setTransfers] = useState<Transfer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSFERS);
    return saved ? JSON.parse(saved) : SEED_TRANSFERS;
  });

  const [customerCredits, setCustomerCredits] = useState<CustomerCredit[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMER_CREDITS);
    return saved ? JSON.parse(saved) : [];
  });

  const [dipstickReadings, setDipstickReadings] = useState<TankDipstickReading[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DIPSTICK_READINGS);
    return saved ? JSON.parse(saved) : SEED_DIPSTICK_READINGS;
  });

  const [shifts, setShifts] = useState<Shift[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    return saved ? JSON.parse(saved) : SEED_SHIFTS;
  });

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
    localStorage.setItem(STORAGE_KEYS.RATE_CARDS, JSON.stringify(rateCards));
  }, [rateCards]);

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
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

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
    return checkShiftOpeningMetersGate(activeShift, pumps, pumpReadings);
  }, [activeShift, pumps, pumpReadings]);

  // 2. Keg inventory summary (total company kegs, out, at depot)
  const kegInventory = useMemo(() => {
    const summary = calculateKegInventory(settings.total_company_kegs, orders, kegReturns);
    return {
      ...summary,
      isDepotStockCritical: summary.kegsAtDepot < settings.kegs_at_depot_low_threshold
    };
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

  // 5. Split alerts (Overdue Credit, Over Limit, Delivery Shortfall, Pump Variance, Dipstick, Shifts)
  const activeAlerts = useMemo(() => {
    const overdueCredit: { customer: Customer; overdueDays: number; amount: number }[] = [];
    const overLimit: { customer: Customer; balance: number; limit: number; excess: number }[] = [];
    const deliveryShortfall: { tank: Tank; shortfallLitres: number }[] = [];
    const pumpVariance = pumpVarianceAudits.filter(a => a.isOverThreshold);
    const dipstickVariance: { reading: TankDipstickReading; tank: Tank; variance: number }[] = [];

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
      shiftDiscrepancy.length;

    return {
      overdueCredit,
      overLimit,
      deliveryShortfall,
      pumpVariance,
      dipstickVariance,
      shiftDiscrepancy,
      totalAlertCount
    };
  }, [customerStatsMap, tanks, settings.truck_shortfall_threshold, settings.dipstick_variance_threshold, pumpVarianceAudits, dipstickReadings, shifts]);


  // 6. Today's operational stats
  const todayStats = useMemo(() => {
    const todayStr = getDepotToday();
    const todayOrders = orders.filter(o => depotDateKey(o.date) === todayStr);

    // Cash/Transfer sales today
    const cashTransferSales = todayOrders
      .filter(o => o.payment_method === 'cash' || o.payment_method === 'transfer')
      .reduce((sum, o) => sum + (o.paid_amount || 0), 0);

    // Total Credit Outstanding across all customers
    const creditOutstanding = Object.values(customerStatsMap).reduce(
      (sum, s) => sum + s.currentBalance,
      0
    );

    // Total Kegs sold today (all orders with unit === 'keg')
    const kegsSoldToday = todayOrders
      .filter(o => o.unit === 'keg')
      .reduce((sum, o) => sum + Number(o.qty || 0), 0);

    // Customer-purchased keg containers today (outright sale of company container)
    const purchasedKegsToday = todayOrders
      .filter(o => o.unit === 'keg' && o.keg_source === 'purchased')
      .reduce((sum, o) => sum + Number(o.qty || 0), 0);

    // Customer-owned kegs filled today
    const customerKegsFilledToday = todayOrders
      .filter(o => o.unit === 'keg' && o.keg_source === 'own')
      .reduce((sum, o) => sum + Number(o.qty || 0), 0);

    // Expenses today
    const expensesToday = expenses
      .filter(e => depotDateKey(e.date) === todayStr)
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
      product.litres_per_keg
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

  // 2. Create New Order with FIFO Tank Draw, Shift Meter Gate & Keg Outright Purchase
  const createNewOrder = (data: {
    customerId: string;
    productId: string;
    unit: UnitType;
    qty: number;
    paymentMethod: PaymentMethod;
    kegSource: KegSource;
    pumpId?: string | null;
    meterReading?: number | null;
    deliveredQty?: number | null;
    note?: string;
    customRate?: number;
    discountReason?: string;
  }) => {
    // 0. Hard Gate: Shift opening meter readings required
    const gateCheck = checkShiftOpeningMetersGate(activeShift, pumps, pumpReadings);
    if (!gateCheck.isPassed) {
      return {
        success: false,
        error: 'Shift opening meter gate active: Please record opening meter readings for all pumps before recording any sales.'
      };
    }

    const customer = customers.find(c => c.id === data.customerId);
    if (!customer) return { success: false, error: 'Customer not found' };

    const product = products.find(p => p.id === data.productId);
    if (!product) return { success: false, error: 'Product not found' };

    const standardRate = lookupRatePerLitre(rateCards, data.productId, customer.type);
    const effectiveRate = data.customRate !== undefined && data.customRate !== null && !isNaN(Number(data.customRate)) && Number(data.customRate) > 0
      ? Number(data.customRate)
      : standardRate;

    const isDiscounted = effectiveRate < standardRate;
    if (isDiscounted && !data.discountReason?.trim()) {
      return {
        success: false,
        error: `Discount reason required: Entered rate (₦${effectiveRate.toLocaleString()}/L) is below the standard rate card (₦${standardRate.toLocaleString()}/L). Please enter an authorized discount reason.`
      };
    }

    const pricing = calculateOrderPricing(
      data.unit,
      data.qty,
      effectiveRate,
      product.litres_per_keg,
      product.litres_per_ton,
      data.kegSource,
      product.keg_sell_price
    );

    // 1. Execute FIFO Tank Draw
    const drawResult = executeFifoTankDraw(tanks, data.productId, pricing.litres);
    if (!drawResult.success) {
      return { success: false, error: drawResult.errorMessage || 'Failed to draw from tanks' };
    }

    // 2. Compute due date and payment status
    const orderDate = new Date();
    let dueDate: string | null = null;
    let paidAmount = 0;

    if (data.paymentMethod === 'credit') {
      const due = new Date(orderDate);
      due.setDate(due.getDate() + customer.credit_term_days);
      dueDate = due.toISOString();
      paidAmount = 0;
    } else {
      paidAmount = pricing.amount; // Cash / Transfer paid immediately
    }

    const assignedPump = data.pumpId ? pumps.find(p => p.id === data.pumpId) : null;

    // Handle per-order meter reading
    let meterDelta: number | undefined;
    let meterVariance: number | undefined;
    if (data.pumpId && data.meterReading !== undefined && data.meterReading !== null) {
      const meterAudit = calculatePerOrderMeterVariance(
        data.pumpId,
        Number(data.meterReading),
        pricing.litres,
        orders,
        assignedPump?.last_meter_reading || 0,
        settings.pump_variance_threshold
      );

      const guard = validateNewPumpReading(Number(data.meterReading), meterAudit.previousReading);
      if (!guard.isValid) {
        return { success: false, error: guard.error };
      }

      meterDelta = meterAudit.meterDelta;
      meterVariance = meterAudit.variance;

      setPumps(prev => prev.map(p => p.id === data.pumpId ? { ...p, last_meter_reading: Number(data.meterReading) } : p));
    }

    let deliveredQty: number | undefined;
    let shortfall: number | undefined;
    if (data.deliveredQty !== undefined && data.deliveredQty !== null) {
      deliveredQty = Number(data.deliveredQty);
      shortfall = Number(data.qty) - deliveredQty;
    }

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      customer_id: data.customerId,
      product_id: data.productId,
      unit: data.unit,
      qty: Number(data.qty),
      litres: pricing.litres,
      rate: effectiveRate,
      amount: pricing.amount,
      paid_amount: paidAmount,
      payment_method: data.paymentMethod,
      keg_source: data.unit === 'keg' ? data.kegSource : null,
      keg_price: data.unit === 'keg' && data.kegSource === 'purchased' ? product.keg_sell_price : null,
      keg_amount: pricing.kegAmount > 0 ? pricing.kegAmount : null,
      discount_reason: isDiscounted ? data.discountReason?.trim() : null,
      date: orderDate.toISOString(),
      due_date: dueDate,
      source_tank_id: drawResult.primaryTankId,
      pump_id: data.pumpId || null,
      meter_reading: data.meterReading !== undefined && data.meterReading !== null ? Number(data.meterReading) : undefined,
      meter_delta: meterDelta,
      meter_variance: meterVariance,
      delivered_qty: deliveredQty,
      shortfall: shortfall,
      note: data.note?.trim() || undefined
    };

    // 3. Commit state updates
    setTanks(drawResult.updatedTanks);
    setOrders(prev => [newOrder, ...prev]);

    // 4. Generate Official Receipt
    const prevStats = customerStatsMap[customer.id];
    const previousBalance = prevStats ? prevStats.currentBalance : 0;
    const newBalance = data.paymentMethod === 'credit'
      ? previousBalance + pricing.amount
      : previousBalance;

    const primaryAlloc = drawResult.allocations[0];

    const receipt: ReceiptData = {
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      type: 'order',
      date: orderDate.toISOString(),
      customer,
      order: newOrder,
      product,
      tankLabel: primaryAlloc ? primaryAlloc.truckLabel : undefined,
      pumpLabel: assignedPump ? assignedPump.label : undefined,
      kegPrice: newOrder.keg_price,
      kegAmount: newOrder.keg_amount,
      discountReason: newOrder.discount_reason,
      paymentMethod: data.paymentMethod,
      previousBalance,
      newBalance,
      cashierName: userRole === 'owner' ? 'Managing Director' : 'Depot Cashier'
    };

    setActiveReceipt(receipt);

    return {
      success: true,
      order: newOrder,
      receipt
    };
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

    // Any amount beyond what the open invoices needed becomes store credit,
    // recorded on the customer's credit ledger instead of being discarded.
    if (paymentResult.unappliedLeftover > 0.01) {
      setCustomerCredits(prev => [
        {
          id: `cc-${Date.now()}`,
          customer_id: customerId,
          amount: Number(paymentResult.unappliedLeftover.toFixed(2)),
          source_payment_id: receiptNumber,
          created_at: new Date().toISOString(),
          note: 'Overpayment added to store credit'
        },
        ...prev
      ]);
    }

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

  // 4. Log Keg Return (Audit Log)
  const logKegReturn = (customerId: string, qty: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return { success: false, error: 'Customer not found' };

    const numericQty = Number(qty);
    if (!Number.isFinite(numericQty) || numericQty <= 0) {
      return { success: false, error: 'Keg return quantity must be greater than zero' };
    }
    const kegsOut = customerStatsMap[customerId]?.totalCompanyKegsOut ?? 0;
    if (numericQty > kegsOut) {
      return { success: false, error: `${customer.name} only has ${kegsOut} company keg(s) out` };
    }

    const newReturn: KegReturn = {
      id: `ret-${Date.now()}`,
      customer_id: customerId,
      qty: numericQty,
      date: new Date().toISOString()
    };

    setKegReturns(prev => [newReturn, ...prev]);
    return { success: true, kegReturn: newReturn };
  };

  // 5. Inter-Customer / Inter-Agent Transfer (company kegs only)
  const logTransfer = (data: {
    fromCustomerId: string;
    toCustomerId: string;
    itemType: 'keg';
    qty: number;
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
      return { success: false, error: `Sender only has ${senderKegs} company keg(s) to transfer` };
    }

    const newTransfer: Transfer = {
      id: `tr-${Date.now()}`,
      from_customer_id: data.fromCustomerId,
      to_customer_id: data.toCustomerId,
      item_type: 'keg',
      qty: Number(data.qty),
      date: new Date().toISOString(),
      notes: data.notes?.trim() || undefined
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
      isOverThreshold: varianceAudit.isOverThreshold,
      notes: data.notes?.trim() || undefined
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
      notes: data.notes?.trim() || undefined
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
      notes: data.notes ? (shift.notes ? `${shift.notes} | ${data.notes}` : data.notes) : shift.notes
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
      note: note?.trim() || undefined
    };

    // Update pump's last_meter_reading
    setPumps(prev => prev.map(p => (p.id === pumpId ? { ...p, last_meter_reading: Number(reading) } : p)));
    setPumpReadings(prev => [...prev, newReading]);

    return { success: true, pumpReading: newReading };
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

  // 11. Add Product
  const addProduct = (productData: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...productData,
      id: `prod-${Date.now()}`
    };
    setProducts(prev => [...prev, newProduct]);
    // Seed default rate card tiers for newly created product
    const newRateCards: RateCard[] = [
      { product_id: newProduct.id, tier: 'retail', rate_per_litre: 5200 },
      { product_id: newProduct.id, tier: 'agent', rate_per_litre: 4800 },
      { product_id: newProduct.id, tier: 'corporate', rate_per_litre: 4500 }
    ];
    setRateCards(prev => [...prev, ...newRateCards]);
    return newProduct;
  };

  // 11b. Update Product (e.g. litres_per_ton, supply_model, litres_per_keg)
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
    setRateCards(prev => prev.filter(r => r.product_id !== productId));
    return { success: true };
  };

  // 12. Update Rate Card
  const updateRateCard = (productId: string, tier: string, ratePerLitre: number) => {
    setRateCards(prev => {
      const exists = prev.some(r => r.product_id === productId && r.tier === tier);
      if (exists) {
        return prev.map(r => (r.product_id === productId && r.tier === tier ? { ...r, rate_per_litre: Number(ratePerLitre) } : r));
      } else {
        return [...prev, { product_id: productId, tier: tier as any, rate_per_litre: Number(ratePerLitre) }];
      }
    });
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
    setRateCards(DEFAULT_RATE_CARDS);
    setCustomers(DEFAULT_CUSTOMERS);
    setSuppliers(DEFAULT_SUPPLIERS);
    setPhysicalTanks(DEFAULT_PHYSICAL_TANKS);
    setTanks(SEED_TANKS);
    setOrders(SEED_ORDERS);
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
        rateCards,
        customers,
        suppliers,
        physicalTanks,
        tanks,
        orders,
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
        pumpVarianceAudits,
        activeAlerts,
        todayStats,
        logTruckIntake,
        logPreKeggedIntake,
        createNewOrder,
        recordCustomerPayment,
        redeemCustomerCredit,
        logKegReturn,
        logTransfer,
        recordDipstickReading,
        startShift,
        closeShift,
        recordShiftOpeningReadings,
        recordPumpReading,
        addExpense,
        addProduct,
        updateProduct,
        deleteProduct,
        updateRateCard,
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

