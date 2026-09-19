import {
  Product,
  PackSize,
  PackPrice,
  Customer,
  AppSettings,
  Tank,
  Sale,
  Order,
  KegReturn,
  Payment,
  AuditEntry,
  Expense,
  Pump,
  PumpReading,
  Transfer,
  Shift,
  Supplier,
  PhysicalTank,
  CustomerType,
  Hub,
  UserProfile,
  PaymentMethod
} from '../types';

export const LITRES_PER_KEG = 25;

/* ------------------------------------------------------------------ *
 * PACK SIZES — the fixed, standardized set of containers the depot
 * sells oil in. Only sz_25 (the company keg) is returnable/deposit-
 * tracked via the keg-fleet custody system; every other size is a
 * one-way outright sale, same as the 1L bottle.
 * Frozen constant, referenced by id everywhere.
 * ------------------------------------------------------------------ */

export const PACK_SIZES: readonly PackSize[] = Object.freeze([
  { id: 'sz_1', litres: 1, short: '1L', label: '1 L' },
  { id: 'sz_12_5', litres: 12.5, short: '12.5L', label: '12.5 L' },
  { id: 'sz_14', litres: 14, short: '14L', label: '14 L' },
  { id: 'sz_25', litres: 25, short: '25L', label: '25 L' },
  { id: 'sz_28', litres: 28, short: '28L', label: '28 L' },
  { id: 'sz_30', litres: 30, short: '30L', label: '30 L' },
  { id: 'sz_56', litres: 56, short: '¼ Drum (56L)', label: '56 L (1/4 Drum)' },
  { id: 'sz_112_5', litres: 112.5, short: '½ Drum (112.5L)', label: '112.5 L (1/2 Drum)' },
  { id: 'sz_256', litres: 256, short: '1 Drum (256L)', label: '256 L (1 Drum)' }
]);

export const packSizeById = (id: string): PackSize | null => PACK_SIZES.find(s => s.id === id) ?? null;

export const packLitres = (id: string): number => packSizeById(id)?.litres ?? 0;

export const packLabel = (id: string): string => packSizeById(id)?.label ?? id;

export const packShort = (id: string): string => packSizeById(id)?.short ?? id;

/* ------------------------------------------------------------------ *
 * PAYMENT MODE VISUAL THEMES — Consistent color coding across the app
 * ------------------------------------------------------------------ */

export interface PaymentModeTheme {
  label: string;
  badgeLabel: string;
  dotCls: string;
  badgeCls: string;
  buttonActiveCls: string;
  textCls: string;
  bgSubtleCls: string;
  borderCls: string;
}

export const PAYMENT_MODE_THEME: Record<PaymentMethod, PaymentModeTheme> = {
  cash: {
    label: 'Cash',
    badgeLabel: 'CASH',
    dotCls: 'bg-emerald-500',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80',
    buttonActiveCls: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30',
    textCls: 'text-emerald-600 dark:text-emerald-400',
    bgSubtleCls: 'bg-emerald-50/70 dark:bg-emerald-950/30',
    borderCls: 'border-emerald-200 dark:border-emerald-800/60'
  },
  transfer: {
    label: 'Bank Transfer',
    badgeLabel: 'TRANSFER',
    dotCls: 'bg-sky-500',
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800/80',
    buttonActiveCls: 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-500/25 ring-2 ring-sky-500/30',
    textCls: 'text-sky-600 dark:text-sky-400',
    bgSubtleCls: 'bg-sky-50/70 dark:bg-sky-950/30',
    borderCls: 'border-sky-200 dark:border-sky-800/60'
  },
  pos: {
    label: 'Card / POS',
    badgeLabel: 'POS',
    dotCls: 'bg-purple-500',
    badgeCls: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800/80',
    buttonActiveCls: 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/25 ring-2 ring-purple-500/30',
    textCls: 'text-purple-600 dark:text-purple-400',
    bgSubtleCls: 'bg-purple-50/70 dark:bg-purple-950/30',
    borderCls: 'border-purple-200 dark:border-purple-800/60'
  },
  credit: {
    label: 'Debt',
    badgeLabel: 'DEBT',
    dotCls: 'bg-amber-500',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/80',
    buttonActiveCls: 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/25 ring-2 ring-amber-500/30',
    textCls: 'text-amber-600 dark:text-amber-400',
    bgSubtleCls: 'bg-amber-50/70 dark:bg-amber-950/30',
    borderCls: 'border-amber-200 dark:border-amber-800/60'
  },
  split: {
    label: 'Split / Double',
    badgeLabel: 'SPLIT',
    dotCls: 'bg-indigo-500',
    badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/80',
    buttonActiveCls: 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25 ring-2 ring-indigo-500/30',
    textCls: 'text-indigo-600 dark:text-indigo-400',
    bgSubtleCls: 'bg-indigo-50/70 dark:bg-indigo-950/30',
    borderCls: 'border-indigo-200 dark:border-indigo-800/60'
  }
};

export const getPaymentModeTheme = (method: string): PaymentModeTheme => {
  const m = method.toLowerCase() as PaymentMethod;
  return (
    PAYMENT_MODE_THEME[m] ?? {
      label: method,
      badgeLabel: method.toUpperCase(),
      dotCls: 'bg-slate-400',
      badgeCls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      buttonActiveCls: 'bg-slate-800 text-white border-slate-800',
      textCls: 'text-slate-600 dark:text-slate-400',
      bgSubtleCls: 'bg-slate-50 dark:bg-slate-900',
      borderCls: 'border-slate-200 dark:border-slate-800'
    }
  );
};

/* ------------------------------------------------------------------ *
 * PRODUCTS + varieties + per-product pack config
 * ------------------------------------------------------------------ */

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'veg',
    name: 'Golden Vegetable Oil',
    supply_model: 'bulk_truck',
    litres_per_ton: 1075,
    litres_per_keg: 25,
    keg_sell_price: 3500,
    varieties: [
      { id: 'veg-soya', name: 'Pure Soya (Grade A)' },
      { id: 'veg-olein', name: 'Triple-Refined Palm Olein' },
      { id: 'veg-groundnut', name: 'Groundnut / Peanut Blend' },
      { id: 'veg-corn', name: 'Refined Corn / Maize Oil' }
    ],
    pack_config: [
      { pack_size_id: 'sz_1', returnable: false, container_buy_price: 0, sort: 0 },
      { pack_size_id: 'sz_12_5', returnable: false, container_buy_price: 0, sort: 1 },
      { pack_size_id: 'sz_14', returnable: false, container_buy_price: 0, sort: 2 },
      { pack_size_id: 'sz_25', returnable: true, container_buy_price: 3500, sort: 3 },
      { pack_size_id: 'sz_28', returnable: false, container_buy_price: 0, sort: 4 },
      { pack_size_id: 'sz_30', returnable: false, container_buy_price: 0, sort: 5 },
      { pack_size_id: 'sz_56', returnable: false, container_buy_price: 0, sort: 6 },
      { pack_size_id: 'sz_112_5', returnable: false, container_buy_price: 0, sort: 7 },
      { pack_size_id: 'sz_256', returnable: false, container_buy_price: 0, sort: 8 }
    ],
    color_light: '#FCD34D',
    color_dark: '#B45309'
  },
  {
    id: 'red',
    name: 'Red / Palm Oil',
    supply_model: 'pre_kegged',
    litres_per_ton: null,
    litres_per_keg: 25,
    keg_sell_price: 3000,
    varieties: [
      { id: 'red-edo', name: 'Grade-A Edo Spec' },
      { id: 'red-ondo', name: 'Ondo Local Producer' }
    ],
    pack_config: [
      { pack_size_id: 'sz_1', returnable: false, container_buy_price: 0, sort: 0 },
      { pack_size_id: 'sz_12_5', returnable: false, container_buy_price: 0, sort: 1 },
      { pack_size_id: 'sz_14', returnable: false, container_buy_price: 0, sort: 2 },
      { pack_size_id: 'sz_25', returnable: true, container_buy_price: 3000, sort: 3 },
      { pack_size_id: 'sz_28', returnable: false, container_buy_price: 0, sort: 4 },
      { pack_size_id: 'sz_30', returnable: false, container_buy_price: 0, sort: 5 },
      { pack_size_id: 'sz_56', returnable: false, container_buy_price: 0, sort: 6 },
      { pack_size_id: 'sz_112_5', returnable: false, container_buy_price: 0, sort: 7 },
      { pack_size_id: 'sz_256', returnable: false, container_buy_price: 0, sort: 8 }
    ],
    color_light: '#F87171',
    color_dark: '#7F1D1D'
  }
];

/* ------------------------------------------------------------------ *
 * PRICE MATRIX — one absolute price per (product, variety, pack size, tier).
 * Seeded from a small model so ~100 rows aren't hand-written; the owner
 * tunes every cell in the Inventory tab.
 * ------------------------------------------------------------------ */

const TIER_BASE_PER_LITRE: Record<string, Record<CustomerType, number>> = {
  veg: { retail: 5200, agent: 4800, corporate: 4500 },
  red: { retail: 5600, agent: 5100, corporate: 4800 }
};

// A litre in a small pack costs more, a litre in a big drum costs less —
// 25L (the standard company keg) is the baseline. Seed defaults only; the
// owner tunes every actual price cell in the Inventory tab afterward.
const SIZE_FACTOR: Record<string, number> = {
  sz_1: 1.15,
  sz_12_5: 1.08,
  sz_14: 1.06,
  sz_25: 1.0,
  sz_28: 0.98,
  sz_30: 0.97,
  sz_56: 0.92,
  sz_112_5: 0.88,
  sz_256: 0.85
};

// Per-litre premium/discount for each variety, applied on top of the tier base.
const VARIETY_PREMIUM_PER_LITRE: Record<string, number> = {
  'veg-soya': 0,
  'veg-olein': -100,
  'veg-groundnut': 250,
  'veg-corn': 150,
  'red-edo': 0,
  'red-ondo': -150
};

const round50 = (n: number) => Math.round(n / 50) * 50;

function buildDefaultPackPrices(products: Product[]): PackPrice[] {
  const tiers: CustomerType[] = ['retail', 'agent', 'corporate'];
  const rows: PackPrice[] = [];
  for (const product of products) {
    const base = TIER_BASE_PER_LITRE[product.id] ?? TIER_BASE_PER_LITRE.veg;
    for (const variety of product.varieties) {
      const varietyPremium = VARIETY_PREMIUM_PER_LITRE[variety.id] ?? 0;
      for (const cfg of product.pack_config) {
        const litres = packLitres(cfg.pack_size_id);
        const factor = SIZE_FACTOR[cfg.pack_size_id] ?? 1;
        for (const tier of tiers) {
          const perLitre = (base[tier] + varietyPremium) * factor;
          rows.push({
            product_id: product.id,
            variety_id: variety.id,
            pack_size_id: cfg.pack_size_id,
            tier,
            price: round50(litres * perLitre)
          });
        }
      }
    }
  }
  return rows;
}

export const DEFAULT_PACK_PRICES: PackPrice[] = buildDefaultPackPrices(DEFAULT_PRODUCTS);

/* ------------------------------------------------------------------ *
 * OTHER CATALOG DATA (unchanged)
 * ------------------------------------------------------------------ */

export const DEFAULT_HUBS: Hub[] = [
  {
    id: 'hub-los-alaba',
    name: 'Alaba Central Depot',
    code: 'ALB-01',
    state: 'Lagos',
    address: 'Plot 14, Commercial Avenue, Alaba International, Lagos',
    phone: '+234 802 000 1122',
    manager_name: 'Babatunde Raji',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'hub-los-ikeja',
    name: 'Ikeja Industrial Hub',
    code: 'IKJ-02',
    state: 'Lagos',
    address: 'Block B, Industrial Estate, Ikeja, Lagos',
    phone: '+234 803 444 5566',
    manager_name: 'Musa Bello',
    is_active: true,
    created_at: '2026-02-15T00:00:00Z'
  },
  {
    id: 'hub-oyo-ibadan',
    name: 'Ibadan Regional Depot',
    code: 'IBD-01',
    state: 'Oyo',
    address: 'Ring Road Oil Terminal, Ibadan, Oyo State',
    phone: '+234 805 777 8899',
    manager_name: 'Rasheed Adebayo',
    is_active: true,
    created_at: '2026-03-10T00:00:00Z'
  }
];

// Only a bare owner placeholder remains — store.tsx falls back to
// DEFAULT_USERS[0] as the signed-in identity before a real Supabase profile
// takes over (or entirely, in offline mode with no Supabase configured), so
// this can't be emptied outright without breaking first load. No other
// fictional team members; real team members come through the Supabase
// invite flow now (Settings -> Team Members & Screen Access).
export const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'usr-owner',
    full_name: 'Depot Owner',
    email: '',
    phone: '',
    role: 'owner',
    hub_id: null,
    active: true,
    created_at: '2026-01-01T00:00:00Z'
  }
];

// No pre-existing suppliers — register the depot's real suppliers from
// scratch (Settings -> Tanks, Pumps & Suppliers).
export const DEFAULT_SUPPLIERS: Supplier[] = [];

// No pre-existing yard tanks — each hub registers its own physical tanks
// from scratch (Settings -> Tanks, Pumps & Suppliers).
export const DEFAULT_PHYSICAL_TANKS: PhysicalTank[] = [];

// No pre-existing pumps — each hub adds its own pumps individually
// (Pumps screen). Nothing ships pre-attached to any hub.
export const DEFAULT_PUMPS: Pump[] = [];

// No pre-existing meter readings — there are no seed pumps left to log
// readings against; each hub's pump history starts blank.
export const SEED_PUMP_READINGS: PumpReading[] = [];

export const ONE_TIME_CUSTOMER_ID = 'cust-walkin';
export const ONE_TIME_CUSTOMER: Customer = {
  id: ONE_TIME_CUSTOMER_ID,
  name: 'One-time Customer',
  type: 'retail',
  credit_limit: 0,
  credit_term_days: 0,
  phone: '—',
  hub_id: 'hub-los-alaba'
};

// Only the functional walk-in placeholder remains — every named customer
// below it was demo data. Real customers are added from scratch (Customers
// screen).
export const DEFAULT_CUSTOMERS: Customer[] = [ONE_TIME_CUSTOMER];

export const DEFAULT_SETTINGS: AppSettings = {
  company_name: 'Iyanuoluwa Vegetable & Palm Oil Depot',
  company_phone: '+234 802 000 1122',
  company_address: 'Plot 14, Commercial Avenue, Alaba Depot, Lagos',
  company_logo_url: null,
  litres_per_keg: 25,
  total_company_kegs: 500,
  kegs_at_depot_low_threshold: 20,
  low_stock_litres_threshold: 500,
  truck_shortfall_threshold: 50,
  pump_variance_threshold: 20,
  default_daily_float: 150000,
  daily_float: 150000,
  shift_start_time: '07:00',
  shift_end_time: '18:00',
  require_pump_readings_to_start_shift: true,
  require_pump_readings_to_close_shift: true,
  outright_keg_price: 3500,
  keg_deposit_price: 2000
};

// Seed initial tanks to show working depot operation
// No pre-existing stock intake — each hub's tank stock starts empty until
// its own truck/pre-kegged intake is logged against its own physical tanks.
export const SEED_TANKS: Tank[] = [];

// No pre-existing sales/lines — every depot starts with a clean ledger.

export const SEED_SALES: Sale[] = [];

export const SEED_ORDERS: Order[] = [];

// No pre-existing keg returns.
export const SEED_KEG_RETURNS: KegReturn[] = [];

export const SEED_TRANSFERS: Transfer[] = [];

export const SEED_PAYMENTS: Payment[] = [];

export const SEED_AUDIT_LOG: AuditEntry[] = [];

// No pre-existing shifts.
export const SEED_SHIFTS: Shift[] = [];

// No pre-existing expenses.
export const SEED_EXPENSES: Expense[] = [];

export const EXPENSE_CATEGORIES = [
  'Diesel/Gen',
  'Loading & Offloading',
  'Transport & Logistics',
  'Depot Maintenance',
  'Water & Spillage'
];
