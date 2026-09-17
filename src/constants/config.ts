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
 * PACK SIZES — the fixed set of containers the depot sells oil in.
 * Standard company size is strictly 25L for kegs and 1L for bottles.
 * Frozen constant, referenced by id everywhere.
 * ------------------------------------------------------------------ */

export const PACK_SIZES: readonly PackSize[] = Object.freeze([
  { id: 'sz_1', litres: 1, short: '1L', label: '1 L' },
  { id: 'sz_25', litres: 25, short: '25L', label: '25 L' }
]);

export const packSizeById = (id: string): PackSize | null => {
  const found = PACK_SIZES.find(s => s.id === id);
  if (found) return found;
  if (id === 'sz_30') return { id: 'sz_30', litres: 30, short: '30L', label: '30 L' };
  if (id === 'sz_56') return { id: 'sz_56', litres: 56, short: '56L', label: '56 L' };
  if (id === 'sz_112_5') return { id: 'sz_112_5', litres: 112.5, short: '112.5L', label: '112.5 L' };
  if (id === 'sz_256') return { id: 'sz_256', litres: 256, short: '256L', label: '256 L' };
  return null;
};

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
      { pack_size_id: 'sz_25', returnable: true, container_buy_price: 3500, sort: 1 }
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
      { pack_size_id: 'sz_25', returnable: true, container_buy_price: 3000, sort: 0 }
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

// A litre in a small pack costs a little more; 25L is standard baseline.
const SIZE_FACTOR: Record<string, number> = {
  sz_1: 1.15,
  sz_25: 1.0
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

const seedPrice = (
  productId: string,
  varietyId: string,
  packSizeId: string,
  tier: CustomerType
): number =>
  DEFAULT_PACK_PRICES.find(
    p =>
      p.product_id === productId &&
      p.variety_id === varietyId &&
      p.pack_size_id === packSizeId &&
      p.tier === tier
  )?.price ?? 0;

const containerBuyPrice = (productId: string, packSizeId: string): number =>
  DEFAULT_PRODUCTS.find(p => p.id === productId)?.pack_config.find(
    c => c.pack_size_id === packSizeId
  )?.container_buy_price ?? 0;

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

export const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'usr-owner',
    full_name: 'Alhaja Sikirat (Owner)',
    email: 'alhaja@iyanuolwa.com',
    phone: '+234 802 000 1122',
    role: 'owner',
    hub_id: null, // Global access across all hubs
    active: true,
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'usr-mgr-alaba',
    full_name: 'Babatunde Raji',
    email: 'babatunde@iyanuolwa.com',
    phone: '+234 803 111 2233',
    role: 'hub_manager',
    hub_id: 'hub-los-alaba',
    active: true,
    created_at: '2026-01-15T00:00:00Z'
  },
  {
    id: 'usr-staff-alaba',
    full_name: 'Chidinma Okafor',
    email: 'chidinma@iyanuolwa.com',
    phone: '+234 806 333 4455',
    role: 'staff',
    hub_id: 'hub-los-alaba',
    active: true,
    created_at: '2026-02-01T00:00:00Z'
  },
  {
    id: 'usr-mgr-ikeja',
    full_name: 'Musa Bello',
    email: 'musa@iyanuolwa.com',
    phone: '+234 803 444 5566',
    role: 'hub_manager',
    hub_id: 'hub-los-ikeja',
    active: true,
    created_at: '2026-02-15T00:00:00Z'
  },
  {
    id: 'usr-staff-ikeja',
    full_name: 'Samuel Adeleke',
    email: 'samuel@iyanuolwa.com',
    phone: '+234 809 555 6677',
    role: 'staff',
    hub_id: 'hub-los-ikeja',
    active: true,
    created_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'usr-driver-alaba',
    full_name: 'Emeka Obi (Driver)',
    email: 'emeka@iyanuolwa.com',
    phone: '+234 807 888 9900',
    role: 'driver',
    hub_id: 'hub-los-alaba',
    active: true,
    created_at: '2026-02-10T00:00:00Z'
  }
];

export const DEFAULT_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', name: 'Presco Oil Plc', phone: '+234 803 100 2000' },
  { id: 'sup-2', name: 'Okomu Oil Palm Company', phone: '+234 802 200 3000' },
  { id: 'sup-3', name: 'Grand Cereals Mills', phone: '+234 805 300 4000' },
  { id: 'sup-4', name: 'Ondo Local Palm Producers', phone: '+234 809 400 5000' }
];

export const DEFAULT_PHYSICAL_TANKS: PhysicalTank[] = [
  { id: 'pt-1', label: 'Yard Tank 1 (Bulk Veg - 30,000L)', product_id: 'veg', capacity_litres: 30000, notes: 'Main East yard bulk vertical tank', hub_id: 'hub-los-alaba' },
  { id: 'pt-2', label: 'Yard Tank 2 (Reserve Veg - 20,000L)', product_id: 'veg', capacity_litres: 20000, notes: 'Secondary West yard tank', hub_id: 'hub-los-alaba' },
  { id: 'pt-3', label: 'Yard Tank 3 (Palm Decanting - 15,000L)', product_id: 'red', capacity_litres: 15000, notes: 'Dedicated decanting vessel for palm deliveries', hub_id: 'hub-los-alaba' },
  { id: 'pt-4', label: 'Ikeja Tank 1 (Bulk Veg - 25,000L)', product_id: 'veg', capacity_litres: 25000, notes: 'Ikeja main bulk storage', hub_id: 'hub-los-ikeja' },
  { id: 'pt-5', label: 'Ikeja Tank 2 (Palm Storage - 10,000L)', product_id: 'red', capacity_litres: 10000, notes: 'Ikeja palm oil decanting tank', hub_id: 'hub-los-ikeja' }
];

export const DEFAULT_PUMPS: Pump[] = [
  {
    id: 'p-1',
    label: 'Pump 1 (Golden Vegetable Oil)',
    product_id: 'veg',
    last_meter_reading: 12450,
    physical_tank_id: 'pt-1',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'p-2',
    label: 'Pump 2 (Golden Vegetable Oil)',
    product_id: 'veg',
    last_meter_reading: 8920,
    physical_tank_id: 'pt-1',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'p-3',
    label: 'Pump 3 (Golden Vegetable Oil)',
    product_id: 'veg',
    last_meter_reading: 5310,
    physical_tank_id: 'pt-2',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'p-4',
    label: 'Ikeja Dispenser 1 (Golden Veg)',
    product_id: 'veg',
    last_meter_reading: 3400,
    physical_tank_id: 'pt-4',
    hub_id: 'hub-los-ikeja'
  },
  {
    id: 'p-5',
    label: 'Ikeja Dispenser 2 (Red Palm)',
    product_id: 'red',
    last_meter_reading: 1850,
    physical_tank_id: 'pt-5',
    hub_id: 'hub-los-ikeja'
  }
];

export const SEED_PUMP_READINGS: PumpReading[] = [
  {
    id: 'pr-1',
    pump_id: 'p-1',
    reading: 11160,
    recorded_at: '2026-08-01T06:00:00Z',
    note: 'Monthly baseline calibration',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'pr-2',
    pump_id: 'p-1',
    reading: 12450,
    recorded_at: '2026-09-08T07:00:00Z',
    note: 'Morning shift meter verification',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'pr-3',
    pump_id: 'p-2',
    reading: 8920,
    recorded_at: '2026-09-08T07:00:00Z',
    note: 'Morning shift meter verification',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'pr-4',
    pump_id: 'p-3',
    reading: 5310,
    recorded_at: '2026-09-08T07:00:00Z',
    note: 'Morning shift meter verification',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'pr-5',
    pump_id: 'p-4',
    reading: 3400,
    recorded_at: '2026-09-08T07:00:00Z',
    note: 'Morning shift meter verification',
    hub_id: 'hub-los-ikeja'
  }
];

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

export const DEFAULT_CUSTOMERS: Customer[] = [
  ONE_TIME_CUSTOMER,
  {
    id: 'cust-1',
    name: 'Mr Samson',
    type: 'corporate',
    credit_limit: 300000,
    credit_term_days: 30,
    phone: '+2348031234567',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'cust-2',
    name: 'Arena',
    type: 'agent',
    credit_limit: 200000,
    credit_term_days: 14,
    phone: '+2348022345678',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'cust-3',
    name: 'Iya Aige',
    type: 'agent',
    credit_limit: 150000,
    credit_term_days: 14,
    phone: '+2348053456789',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'cust-4',
    name: 'Lekki Agent',
    type: 'agent',
    credit_limit: 100000,
    credit_term_days: 14,
    phone: '+2348094567890',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'cust-5',
    name: 'Ikeja Food Mart & Kitchens',
    type: 'corporate',
    credit_limit: 250000,
    credit_term_days: 14,
    phone: '+2348087654321',
    hub_id: 'hub-los-ikeja'
  }
];

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
export const SEED_TANKS: Tank[] = [
  {
    id: 'tank-v1',
    product_id: 'veg',
    truck_label: 'Truck 1 · AAA-123-XB (Alhaji Musa)',
    tons: 15,
    received_litres: 16125,
    remaining_litres: 15435,
    date: '2026-09-01T08:00:00Z',
    shortfall: 0,
    supplier_id: 'sup-1',
    physical_tank_id: 'pt-1',
    supply_model: 'bulk_truck',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'tank-v2',
    product_id: 'veg',
    truck_label: 'Truck 2 · KJA-492-XA (Emeka Obi)',
    tons: 10,
    received_litres: 10750,
    remaining_litres: 10750,
    date: '2026-09-06T10:30:00Z',
    shortfall: 20,
    supplier_id: 'sup-3',
    physical_tank_id: 'pt-2',
    supply_model: 'bulk_truck',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'tank-r1',
    product_id: 'red',
    truck_label: 'Truck Red · OGL-881-ZZ (Babatunde)',
    tons: 0,
    received_litres: 12500,
    remaining_litres: 12250,
    date: '2026-09-03T11:00:00Z',
    shortfall: 0,
    supplier_id: 'sup-2',
    physical_tank_id: 'pt-3',
    supply_model: 'pre_kegged',
    space_note: 'Filled 1 decanting tank',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'tank-ikj-1',
    product_id: 'veg',
    truck_label: 'Truck 3 · IKD-552-XY (Ikeja Haulage)',
    tons: 12,
    received_litres: 12900,
    remaining_litres: 11200,
    date: '2026-09-02T09:00:00Z',
    shortfall: 0,
    supplier_id: 'sup-1',
    physical_tank_id: 'pt-4',
    supply_model: 'bulk_truck',
    hub_id: 'hub-los-ikeja'
  }
];

/* ------------------------------------------------------------------ *
 * SEED SALES + LINES — pack-size model
 * ------------------------------------------------------------------ */

/** Build one seed sale line, computing money from the seeded price matrix. */
function seedLine(args: {
  id: string;
  saleId: string;
  customerId: string;
  productId: string;
  varietyId: string;
  varietyName: string;
  packSizeId: string;
  qty: number;
  tier: CustomerType;
  containerMode: 'taken' | 'bought' | 'none';
  paymentMethod: Order['payment_method'];
  paidAmount: number;
  dueDate: string | null;
  date: string;
  sourceTankId: string | null;
  hubId?: string;
}): Order {
  const litres = Number((args.qty * packLitres(args.packSizeId)).toFixed(2));
  const unitPrice = seedPrice(args.productId, args.varietyId, args.packSizeId, args.tier);
  const oilAmount = Number((args.qty * unitPrice).toFixed(2));
  const cfg = DEFAULT_PRODUCTS.find(p => p.id === args.productId)?.pack_config.find(
    c => c.pack_size_id === args.packSizeId
  );
  const returnable = cfg?.returnable ?? false;
  const containerUnitPrice =
    args.containerMode === 'bought' ? containerBuyPrice(args.productId, args.packSizeId) : null;
  const containerAmount =
    args.containerMode === 'bought'
      ? Number((args.qty * (containerUnitPrice ?? 0)).toFixed(2))
      : 0;
  const lineAmount = Number((oilAmount + containerAmount).toFixed(2));
  return {
    id: args.id,
    sale_id: args.saleId,
    customer_id: args.customerId,
    product_id: args.productId,
    variety_id: args.varietyId,
    variety_name: args.varietyName,
    pack_size_id: args.packSizeId,
    qty: args.qty,
    litres,
    unit_price: unitPrice,
    original_unit_price: unitPrice,
    price_adjusted: false,
    price_adjust_reason: null,
    oil_amount: oilAmount,
    container_mode: args.containerMode,
    returnable,
    container_unit_price: containerUnitPrice,
    container_amount: args.containerMode === 'bought' ? containerAmount : null,
    line_amount: lineAmount,
    amount: lineAmount,
    pricing_tier: args.tier,
    payment_method: args.paymentMethod,
    paid_amount: args.paidAmount,
    due_date: args.dueDate,
    date: args.date,
    source_tank_id: args.sourceTankId,
    tank_allocations: args.sourceTankId ? [{ tank_id: args.sourceTankId, litres }] : null,
    voided: false,
    hub_id: args.hubId ?? 'hub-los-alaba'
  };
}

export const SEED_SALES: Sale[] = [
  {
    id: 'sale-101',
    customer_id: 'cust-1',
    date: '2026-08-05T10:00:00Z',
    payment_method: 'credit',
    cashier_name: 'Depot Cashier',
    note: 'Initial supply',
    voided: false,
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'sale-102',
    customer_id: 'cust-2',
    date: '2026-08-28T14:30:00Z',
    payment_method: 'credit',
    cashier_name: 'Depot Cashier',
    note: 'Depot dispatch',
    voided: false,
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'sale-103',
    customer_id: 'cust-3',
    date: '2026-09-07T09:15:00Z',
    payment_method: 'transfer',
    cashier_name: 'Depot Cashier',
    note: 'Customer brought own jerrycans',
    voided: false,
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'sale-104',
    customer_id: 'cust-4',
    date: '2026-09-04T12:00:00Z',
    payment_method: 'credit',
    cashier_name: 'Depot Cashier',
    note: 'Fast agent restock',
    voided: false,
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'sale-201',
    customer_id: 'cust-5',
    date: '2026-09-08T08:30:00Z',
    payment_method: 'transfer',
    cashier_name: 'Musa Bello',
    note: 'Ikeja supermarket morning bulk delivery',
    voided: false,
    hub_id: 'hub-los-ikeja'
  }
];

export const SEED_ORDERS: Order[] = [
  seedLine({
    id: 'line-101-1',
    saleId: 'sale-101',
    customerId: 'cust-1',
    productId: 'veg',
    varietyId: 'veg-soya',
    varietyName: 'Pure Soya (Grade A)',
    packSizeId: 'sz_30',
    qty: 15,
    tier: 'corporate',
    containerMode: 'taken',
    paymentMethod: 'credit',
    paidAmount: 0,
    dueDate: '2026-09-04T10:00:00Z', // overdue
    date: '2026-08-05T10:00:00Z',
    sourceTankId: 'tank-v1',
    hubId: 'hub-los-alaba'
  }),
  seedLine({
    id: 'line-102-1',
    saleId: 'sale-102',
    customerId: 'cust-2',
    productId: 'veg',
    varietyId: 'veg-soya',
    varietyName: 'Pure Soya (Grade A)',
    packSizeId: 'sz_30',
    qty: 15,
    tier: 'agent',
    containerMode: 'taken',
    paymentMethod: 'credit',
    paidAmount: 0,
    dueDate: '2026-09-11T14:30:00Z', // due soon
    date: '2026-08-28T14:30:00Z',
    sourceTankId: 'tank-v1',
    hubId: 'hub-los-alaba'
  }),
  seedLine({
    id: 'line-103-1',
    saleId: 'sale-103',
    customerId: 'cust-3',
    productId: 'red',
    varietyId: 'red-edo',
    varietyName: 'Grade-A Edo Spec',
    packSizeId: 'sz_25',
    qty: 12,
    tier: 'agent',
    containerMode: 'none',
    paymentMethod: 'transfer',
    paidAmount: 0, // set below from line_amount
    dueDate: null,
    date: '2026-09-07T09:15:00Z',
    sourceTankId: 'tank-r1',
    hubId: 'hub-los-alaba'
  }),
  seedLine({
    id: 'line-104-1',
    saleId: 'sale-104',
    customerId: 'cust-4',
    productId: 'veg',
    varietyId: 'veg-soya',
    varietyName: 'Pure Soya (Grade A)',
    packSizeId: 'sz_30',
    qty: 8,
    tier: 'agent',
    containerMode: 'taken',
    paymentMethod: 'credit',
    paidAmount: 0,
    dueDate: '2026-09-18T12:00:00Z', // current
    date: '2026-09-04T12:00:00Z',
    sourceTankId: 'tank-v1',
    hubId: 'hub-los-alaba'
  }),
  seedLine({
    id: 'line-201-1',
    saleId: 'sale-201',
    customerId: 'cust-5',
    productId: 'veg',
    varietyId: 'veg-soya',
    varietyName: 'Pure Soya (Grade A)',
    packSizeId: 'sz_30',
    qty: 10,
    tier: 'corporate',
    containerMode: 'none',
    paymentMethod: 'transfer',
    paidAmount: 0,
    dueDate: null,
    date: '2026-09-08T08:30:00Z',
    sourceTankId: 'tank-ikj-1',
    hubId: 'hub-los-ikeja'
  })
];

// sale-103 was paid in full on the spot — mark its line settled.
const paidLine = SEED_ORDERS.find(o => o.id === 'line-103-1');
if (paidLine) paidLine.paid_amount = paidLine.line_amount;

// sale-201 was paid in full on the spot — mark its line settled.
const ikejaPaidLine = SEED_ORDERS.find(o => o.id === 'line-201-1');
if (ikejaPaidLine) ikejaPaidLine.paid_amount = ikejaPaidLine.line_amount;

export const SEED_KEG_RETURNS: KegReturn[] = [
  {
    id: 'ret-1',
    customer_id: 'cust-1',
    product_id: 'veg',
    pack_size_id: 'sz_30',
    qty: 5,
    date: '2026-08-15T15:20:00Z',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'ret-2',
    customer_id: 'cust-2',
    product_id: 'veg',
    pack_size_id: 'sz_30',
    qty: 3,
    date: '2026-09-02T11:00:00Z',
    hub_id: 'hub-los-alaba'
  }
];

export const SEED_TRANSFERS: Transfer[] = [];

export const SEED_PAYMENTS: Payment[] = [];

export const SEED_AUDIT_LOG: AuditEntry[] = [];

export const SEED_SHIFTS: Shift[] = [
  {
    id: 'shift-1',
    supervisor_name: 'Babatunde Raji (Manager)',
    start_time: '2026-09-08T07:00:00Z',
    end_time: null,
    opening_float: 150000,
    opening_readings: {
      'p-1': 12450,
      'p-2': 8920,
      'p-3': 5310
    },
    cash_sales: 0,
    cash_expenses: 37000,
    expected_cash: 113000,
    cash_counted: null,
    cash_variance: null,
    status: 'open',
    note: 'Alaba morning operational run',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'shift-2',
    supervisor_name: 'Musa Bello (Manager)',
    start_time: '2026-09-08T07:30:00Z',
    end_time: null,
    opening_float: 100000,
    opening_readings: {
      'p-4': 3400,
      'p-5': 1850
    },
    cash_sales: 0,
    cash_expenses: 15000,
    expected_cash: 85000,
    cash_counted: null,
    cash_variance: null,
    status: 'open',
    note: 'Ikeja morning operational shift',
    hub_id: 'hub-los-ikeja'
  }
];

export const SEED_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    date: '2026-09-08T08:00:00Z',
    category: 'Diesel/Gen',
    amount: 25000,
    note: '30L diesel for 40kVA generator',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'exp-2',
    date: '2026-09-08T09:30:00Z',
    category: 'Loading & Offloading',
    amount: 12000,
    note: 'Depot boys offloading assistance',
    hub_id: 'hub-los-alaba'
  },
  {
    id: 'exp-3',
    date: '2026-09-08T08:15:00Z',
    category: 'Diesel/Gen',
    amount: 15000,
    note: 'Diesel fuel for Ikeja standby generator',
    hub_id: 'hub-los-ikeja'
  }
];

export const EXPENSE_CATEGORIES = [
  'Diesel/Gen',
  'Loading & Offloading',
  'Transport & Logistics',
  'Depot Maintenance',
  'Water & Spillage'
];
