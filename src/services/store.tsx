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
  KegSource
} from '../types';
import {
  DEFAULT_PRODUCTS,
  DEFAULT_RATE_CARDS,
  DEFAULT_CUSTOMERS,
  DEFAULT_SETTINGS,
  SEED_TANKS,
  SEED_ORDERS,
  SEED_KEG_RETURNS,
  SEED_EXPENSES,
  LITRES_PER_KEG
} from '../constants/config';
import {
  calculateCustomerStats,
  calculateKegInventory,
  executeFifoTankDraw,
  applyFifoPayment,
  lookupRatePerLitre,
  calculateOrderPricing,
  calculateIntakeMetrics,
  calculateLitres
} from './businessLogic';

interface StoreContextType {
  products: Product[];
  rateCards: RateCard[];
  customers: Customer[];
  tanks: Tank[];
  orders: Order[];
  kegReturns: KegReturn[];
  expenses: Expense[];
  settings: AppSettings;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  
  // Computed values
  customerStatsMap: Record<string, CustomerCalculatedStats>;
  kegInventory: KegInventorySummary;
  tankStockByProduct: Record<string, { totalLitres: number; tanks: Tank[] }>;
  activeAlerts: {
    overdueCredit: { customer: Customer; overdueDays: number; amount: number }[];
    overLimit: { customer: Customer; balance: number; limit: number; excess: number }[];
    deliveryShortfall: { tank: Tank; shortfallLitres: number }[];
    totalAlertCount: number;
  };
  todayStats: {
    cashTransferSales: number;
    creditOutstanding: number;
    companyKegsOut: number;
    kegsAtDepot: number;
    customerKegsFilledToday: number;
    expensesToday: number;
    dailyFloatRemaining: number;
  };

  // Actions
  logTruckIntake: (data: {
    productId: string;
    truckLabel: string;
    tons: number;
    actualKegs: number;
    leftoverLitres: number;
  }) => { success: boolean; tank?: Tank; error?: string };
  
  createNewOrder: (data: {
    customerId: string;
    productId: string;
    unit: UnitType;
    qty: number;
    paymentMethod: PaymentMethod;
    kegSource: KegSource;
    note?: string;
  }) => { success: boolean; order?: Order; receipt?: ReceiptData; error?: string };

  recordCustomerPayment: (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod
  ) => { success: boolean; receipt?: ReceiptData; error?: string };

  logKegReturn: (
    customerId: string,
    qty: number
  ) => { success: boolean; kegReturn?: KegReturn; error?: string };

  addExpense: (
    category: string,
    amount: number,
    note?: string
  ) => { success: boolean; expense?: Expense; error?: string };

  updateSettings: (newSettings: Partial<AppSettings>) => void;
  addCustomer: (customerData: Omit<Customer, 'id'>) => Customer;
  updateCustomer: (id: string, customerData: Partial<Customer>) => void;

  // Receipt Modal State
  activeReceipt: ReceiptData | null;
  setActiveReceipt: (receipt: ReceiptData | null) => void;

  // Reset demo data
  resetToSeedData: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

const STORAGE_KEYS = {
  PRODUCTS: 'iyanu_products_v1',
  RATE_CARDS: 'iyanu_rate_cards_v1',
  CUSTOMERS: 'iyanu_customers_v1',
  TANKS: 'iyanu_tanks_v1',
  ORDERS: 'iyanu_orders_v1',
  KEG_RETURNS: 'iyanu_keg_returns_v1',
  EXPENSES: 'iyanu_expenses_v1',
  SETTINGS: 'iyanu_settings_v1',
  USER_ROLE: 'iyanu_user_role_v1',
  THEME: 'iyanu_theme_v1'
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
  const [products] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return saved ? JSON.parse(saved) : DEFAULT_PRODUCTS;
  });

  const [rateCards] = useState<RateCard[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RATE_CARDS);
    return saved ? JSON.parse(saved) : DEFAULT_RATE_CARDS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return saved ? JSON.parse(saved) : DEFAULT_CUSTOMERS;
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
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [userRole, setUserRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
    return (saved as UserRole) || 'owner';
  });

  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  // Sync to LocalStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers]);

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
    localStorage.setItem(STORAGE_KEYS.USER_ROLE, userRole);
  }, [userRole]);

  // 1. Calculate per-customer statistics (dynamic balance, aging, kegs out)
  const customerStatsMap = useMemo(() => {
    const map: Record<string, CustomerCalculatedStats> = {};
    const now = new Date();
    customers.forEach(cust => {
      map[cust.id] = calculateCustomerStats(cust, orders, kegReturns, now);
    });
    return map;
  }, [customers, orders, kegReturns]);

  // 2. Keg inventory summary (total company kegs, out, at depot)
  const kegInventory = useMemo(() => {
    return calculateKegInventory(settings.total_company_kegs, orders, kegReturns);
  }, [settings.total_company_kegs, orders, kegReturns]);

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

  // 4. Split 3-stream alerts
  const activeAlerts = useMemo(() => {
    const overdueCredit: { customer: Customer; overdueDays: number; amount: number }[] = [];
    const overLimit: { customer: Customer; balance: number; limit: number; excess: number }[] = [];
    const deliveryShortfall: { tank: Tank; shortfallLitres: number }[] = [];

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

    // Check delivery shortfall alerts (> 50L) on recent tanks
    tanks.forEach(t => {
      if (t.shortfall > 50) {
        deliveryShortfall.push({
          tank: t,
          shortfallLitres: t.shortfall
        });
      }
    });

    const totalAlertCount = overdueCredit.length + overLimit.length + deliveryShortfall.length;

    return {
      overdueCredit,
      overLimit,
      deliveryShortfall,
      totalAlertCount
    };
  }, [customerStatsMap, tanks]);

  // 5. Today's operational stats
  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Cash/Transfer sales today
    const cashTransferSales = orders
      .filter(o => {
        const orderDateStr = o.date ? o.date.slice(0, 10) : '';
        return orderDateStr === todayStr && (o.payment_method === 'cash' || o.payment_method === 'transfer');
      })
      .reduce((sum, o) => sum + (o.paid_amount || 0), 0);

    // Total Credit Outstanding across all customers
    const creditOutstanding = Object.values(customerStatsMap).reduce(
      (sum, s) => sum + s.currentBalance,
      0
    );

    // Customer-owned kegs filled today
    const customerKegsFilledToday = orders
      .filter(o => {
        const orderDateStr = o.date ? o.date.slice(0, 10) : '';
        return orderDateStr === todayStr && o.unit === 'keg' && o.keg_source === 'own';
      })
      .reduce((sum, o) => sum + Number(o.qty || 0), 0);

    // Expenses today
    const expensesToday = expenses
      .filter(e => (e.date ? e.date.slice(0, 10) : '') === todayStr)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const dailyFloatRemaining = Math.max(0, settings.daily_float - expensesToday);

    return {
      cashTransferSales,
      creditOutstanding,
      companyKegsOut: kegInventory.totalKegsOut,
      kegsAtDepot: kegInventory.kegsAtDepot,
      customerKegsFilledToday,
      expensesToday,
      dailyFloatRemaining
    };
  }, [orders, expenses, settings.daily_float, customerStatsMap, kegInventory]);

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  // 1. Log Truck Intake
  const logTruckIntake = (data: {
    productId: string;
    truckLabel: string;
    tons: number;
    actualKegs: number;
    leftoverLitres: number;
  }) => {
    const product = products.find(p => p.id === data.productId);
    if (!product) return { success: false, error: 'Product not found' };

    const metrics = calculateIntakeMetrics(
      data.tons,
      product.litres_per_ton,
      data.actualKegs,
      data.leftoverLitres,
      kegInventory.kegsAtDepot,
      LITRES_PER_KEG
    );

    const newTank: Tank = {
      id: `tank-${Date.now()}`,
      product_id: data.productId,
      truck_label: data.truckLabel.trim() || `TRK-${Date.now().toString().slice(-4)}`,
      tons: Number(data.tons),
      received_litres: metrics.recoveredLitres,
      remaining_litres: metrics.recoveredLitres,
      date: new Date().toISOString(),
      shortfall: metrics.shortfall
    };

    setTanks(prev => [newTank, ...prev]);
    return { success: true, tank: newTank };
  };

  // 2. Create New Order with FIFO Tank Draw
  const createNewOrder = (data: {
    customerId: string;
    productId: string;
    unit: UnitType;
    qty: number;
    paymentMethod: PaymentMethod;
    kegSource: KegSource;
    note?: string;
  }) => {
    const customer = customers.find(c => c.id === data.customerId);
    if (!customer) return { success: false, error: 'Customer not found' };

    const product = products.find(p => p.id === data.productId);
    if (!product) return { success: false, error: 'Product not found' };

    const ratePerLitre = lookupRatePerLitre(rateCards, data.productId, customer.type);
    const pricing = calculateOrderPricing(data.unit, data.qty, ratePerLitre, LITRES_PER_KEG);

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

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      customer_id: data.customerId,
      product_id: data.productId,
      unit: data.unit,
      qty: Number(data.qty),
      litres: pricing.litres,
      rate: ratePerLitre,
      amount: pricing.amount,
      paid_amount: paidAmount,
      payment_method: data.paymentMethod,
      keg_source: data.unit === 'keg' ? data.kegSource : null,
      date: orderDate.toISOString(),
      due_date: dueDate,
      source_tank_id: drawResult.primaryTankId,
      note: data.note
    };

    // Apply updated tanks
    setTanks(drawResult.updatedTanks);

    // Append order
    setOrders(prev => [newOrder, ...prev]);

    // Prepare Receipt Data
    const prevStats = customerStatsMap[customer.id];
    const previousBalance = prevStats ? prevStats.currentBalance : 0;
    const newBalance = data.paymentMethod === 'credit'
      ? previousBalance + pricing.amount
      : previousBalance;

    const sourceTank = tanks.find(t => t.id === drawResult.primaryTankId);

    const receipt: ReceiptData = {
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      type: 'order',
      date: newOrder.date,
      customer,
      order: newOrder,
      product,
      tankLabel: sourceTank?.truck_label || 'Depot Tanks (FIFO Draw)',
      paymentMethod: data.paymentMethod,
      previousBalance,
      newBalance,
      cashierName: userRole === 'owner' ? 'Managing Director' : 'Depot Cashier'
    };

    setActiveReceipt(receipt);

    return { success: true, order: newOrder, receipt };
  };

  // 3. Record Customer Payment with FIFO application
  const recordCustomerPayment = (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod
  ) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return { success: false, error: 'Customer not found' };

    const prevStats = customerStatsMap[customer.id];
    const previousBalance = prevStats ? prevStats.currentBalance : 0;

    const paymentResult = applyFifoPayment(orders, customerId, amount);

    setOrders(paymentResult.updatedOrders);

    const newBalance = Math.max(0, previousBalance - paymentResult.totalApplied);

    const receipt: ReceiptData = {
      receiptNumber: `PAY-${Date.now().toString().slice(-6)}`,
      type: 'payment',
      date: new Date().toISOString(),
      customer,
      paymentAmount: Number(amount),
      paymentMethod,
      previousBalance,
      newBalance,
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

    const newReturn: KegReturn = {
      id: `ret-${Date.now()}`,
      customer_id: customerId,
      qty: Number(qty),
      date: new Date().toISOString()
    };

    setKegReturns(prev => [newReturn, ...prev]);
    return { success: true, kegReturn: newReturn };
  };

  // 5. Add Expense
  const addExpense = (category: string, amount: number, note?: string) => {
    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      date: new Date().toISOString(),
      category,
      amount: Number(amount),
      note
    };

    setExpenses(prev => [newExpense, ...prev]);
    return { success: true, expense: newExpense };
  };

  // 6. Update Settings
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // 7. Add Customer
  const addCustomer = (customerData: Omit<Customer, 'id'>) => {
    const newCust: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`
    };
    setCustomers(prev => [...prev, newCust]);
    return newCust;
  };

  // 8. Update Customer
  const updateCustomer = (id: string, customerData: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, ...customerData } : c)));
  };

  // 9. Reset to default demo seed data
  const resetToSeedData = () => {
    setCustomers(DEFAULT_CUSTOMERS);
    setTanks(SEED_TANKS);
    setOrders(SEED_ORDERS);
    setKegReturns(SEED_KEG_RETURNS);
    setExpenses(SEED_EXPENSES);
    setSettings(DEFAULT_SETTINGS);
    localStorage.clear();
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        rateCards,
        customers,
        tanks,
        orders,
        kegReturns,
        expenses,
        settings,
        userRole,
        setUserRole,
        theme,
        setTheme,
        toggleTheme,
        customerStatsMap,
        kegInventory,
        tankStockByProduct,
        activeAlerts,
        todayStats,
        logTruckIntake,
        createNewOrder,
        recordCustomerPayment,
        logKegReturn,
        addExpense,
        updateSettings,
        addCustomer,
        updateCustomer,
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
