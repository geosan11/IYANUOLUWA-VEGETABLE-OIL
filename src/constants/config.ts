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
  TankDipstickReading,
  Shift,
  Supplier,
  PhysicalTank,
  CustomerType
} from '../types';

export const LITRES_PER_KEG = 30;

/* ------------------------------------------------------------------ *
 * PACK SIZES — the fixed set of containers the depot sells oil in.
 * Frozen constant, referenced by id everywhere.
 * ------------------------------------------------------------------ */

export const PACK_SIZES: readonly PackSize[] = Object.freeze([
  { id: 'sz_1', litres: 1, short: '1L', label: '1 L' },
  { id: 'sz_12_5', litres: 12.5, short: '12.5L', label: '12.5 L' },
  { id: 'sz_14', litres: 14, short: '14L', label: '14 L' },
  { id: 'sz_25', litres: 25, short: '25L', label: '25 L' },
  { id: 'sz_28', litres: 28, short: '28L', label: '28 L' },
  { id: 'sz_30', litres: 30, short: '30L', label: '30 L' },
  { id: 'sz_56', litres: 56, short: '56L', label: '56 L (¼ drum)' },
  { id: 'sz_112_5', litres: 112.5, short: '112.5L', label: '112.5 L (½ drum)' },
  { id: 'sz_256', litres: 256, short: '256L', label: '256 L (1 drum)' }
]);

export const packSizeById = (id: string): PackSize | null =>
  PACK_SIZES.find(s => s.id === id) ?? null;

export const packLitres = (id: string): number => packSizeById(id)?.litres ?? 0;

export const packLabel = (id: string): string => packSizeById(id)?.label ?? id;

export const packShort = (id: string): string => packSizeById(id)?.short ?? id;

/* ------------------------------------------------------------------ *
 * PRODUCTS + varieties + per-product pack config
 * ------------------------------------------------------------------ */

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'veg',
    name: 'Golden Vegetable Oil',
    supply_model: 'bulk_truck',
    litres_per_ton: 1075,
    litres_per_keg: 30,
    keg_sell_price: 3500,
    varieties: [
      { id: 'veg-soya', name: 'Pure Soya (Grade A)' },
      { id: 'veg-olein', name: 'Triple-Refined Palm Olein' },
      { id: 'veg-groundnut', name: 'Groundnut / Peanut Blend' },
      { id: 'veg-corn', name: 'Refined Corn / Maize Oil' }
    ],
    pack_config: [
      { pack_size_id: 'sz_1', returnable: false, container_buy_price: 0, sort: 0 },
      { pack_size_id: 'sz_25', returnable: true, container_buy_price: 3500, sort: 1 },
      { pack_size_id: 'sz_30', returnable: true, container_buy_price: 3800, sort: 2 },
      { pack_size_id: 'sz_56', returnable: true, container_buy_price: 6000, sort: 3 },
      { pack_size_id: 'sz_112_5', returnable: true, container_buy_price: 11000, sort: 4 },
      { pack_size_id: 'sz_256', returnable: true, container_buy_price: 22000, sort: 5 }
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
      { pack_size_id: 'sz_25', returnable: true, container_buy_price: 3000, sort: 0 },
      { pack_size_id: 'sz_56', returnable: true, container_buy_price: 5500, sort: 1 },
      { pack_size_id: 'sz_112_5', returnable: true, container_buy_price: 10500, sort: 2 },
      { pack_size_id: 'sz_256', returnable: true, container_buy_price: 21000, sort: 3 }
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

// A litre in a small pack costs a little more; a drum a little less.
const SIZE_FACTOR: Record<string, number> = {
  sz_1: 1.15,
  sz_12_5: 1.05,
  sz_14: 1.04,
  sz_25: 1.0,
  sz_28: 0.99,
  sz_30: 0.985,
  sz_56: 0.97,
  sz_112_5: 0.955,
  sz_256: 0.94
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

export const DEFAULT_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', name: 'Presco Oil Plc', phone: '+234 803 100 2000' },
  { id: 'sup-2', name: 'Okomu Oil Palm Company', phone: '+234 802 200 3000' },
  { id: 'sup-3', name: 'Grand Cereals Mills', phone: '+234 805 300 4000' },
  { id: 'sup-4', name: 'Ondo Local Palm Producers', phone: '+234 809 400 5000' }
];

export const DEFAULT_PHYSICAL_TANKS: PhysicalTank[] = [
  { id: 'pt-1', label: 'Yard Tank 1 (Bulk Veg - 30,000L)', product_id: 'veg', capacity_litres: 30000, notes: 'Main East yard bulk vertical tank' },
  { id: 'pt-2', label: 'Yard Tank 2 (Reserve Veg - 20,000L)', product_id: 'veg', capacity_litres: 20000, notes: 'Secondary West yard tank' },
  { id: 'pt-3', label: 'Yard Tank 3 (Palm Decanting - 15,000L)', product_id: 'red', capacity_litres: 15000, notes: 'Dedicated decanting vessel for palm deliveries' }
];

export const DEFAULT_PUMPS: Pump[] = [
  {
    id: 'p-1',
    label: 'Pump 1 (Golden Vegetable Oil)',
    product_id: 'veg',
    last_meter_reading: 12450
  },
  {
    id: 'p-2',
    label: 'Pump 2 (Golden Vegetable Oil)',
    product_id: 'veg',
    last_meter_reading: 8920
  }
];

export const SEED_PUMP_READINGS: PumpReading[] = [
  {
    id: 'pr-1',
    pump_id: 'p-1',
    reading: 11160,
    recorded_at: '2026-08-01T06:00:00Z',
    note: 'Monthly baseline calibration'
  },
  {
    id: 'pr-2',
    pump_id: 'p-1',
    reading: 12450,
    recorded_at: '2026-09-08T07:00:00Z',
    note: 'Morning shift meter verification'
  },
  {
    id: 'pr-3',
    pump_id: 'p-2',
    reading: 8920,
    recorded_at: '2026-09-08T07:00:00Z',
    note: 'Morning shift meter verification'
  }
];

export const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Mr Samson',
    type: 'corporate',
    credit_limit: 300000,
    credit_term_days: 30,
    phone: '+2348031234567'
  },
  {
    id: 'cust-2',
    name: 'Arena',
    type: 'agent',
    credit_limit: 200000,
    credit_term_days: 14,
    phone: '+2348022345678'
  },
  {
    id: 'cust-3',
    name: 'Iya Aige',
    type: 'agent',
    credit_limit: 150000,
    credit_term_days: 14,
    phone: '+2348053456789'
  },
  {
    id: 'cust-4',
    name: 'Lekki Agent',
    type: 'agent',
    credit_limit: 100000,
    credit_term_days: 14,
    phone: '+2348094567890'
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  company_name: 'Iyanuoluwa Vegetable & Palm Oil Depot',
  company_phone: '+234 802 000 1122',
  company_address: 'Plot 14, Commercial Avenue, Alaba Depot, Lagos',
  company_logo_url: null,
  litres_per_keg: 30,
  total_company_kegs: 500,
  kegs_at_depot_low_threshold: 20,
  low_stock_litres_threshold: 500,
  truck_shortfall_threshold: 50,
  pump_variance_threshold: 20,
  dipstick_variance_threshold: 30,
  default_daily_float: 150000,
  daily_float: 150000
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
    last_dipstick_reading: 15435,
    last_dipstick_variance: 0
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
    last_dipstick_reading: 10740,
    last_dipstick_variance: -10
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
    last_dipstick_reading: 12250,
    last_dipstick_variance: 0
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
    voided: false
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
    voided: false
  },
  {
    id: 'sale-102',
    customer_id: 'cust-2',
    date: '2026-08-28T14:30:00Z',
    payment_method: 'credit',
    cashier_name: 'Depot Cashier',
    note: 'Depot dispatch',
    voided: false
  },
  {
    id: 'sale-103',
    customer_id: 'cust-3',
    date: '2026-09-07T09:15:00Z',
    payment_method: 'transfer',
    cashier_name: 'Depot Cashier',
    note: 'Customer brought own jerrycans',
    voided: false
  },
  {
    id: 'sale-104',
    customer_id: 'cust-4',
    date: '2026-09-04T12:00:00Z',
    payment_method: 'credit',
    cashier_name: 'Depot Cashier',
    note: 'Fast agent restock',
    voided: false
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
    sourceTankId: 'tank-v1'
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
    sourceTankId: 'tank-v1'
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
    sourceTankId: 'tank-r1'
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
    sourceTankId: 'tank-v1'
  })
];

// sale-103 was paid in full on the spot — mark its line settled.
const paidLine = SEED_ORDERS.find(o => o.id === 'line-103-1');
if (paidLine) paidLine.paid_amount = paidLine.line_amount;

export const SEED_KEG_RETURNS: KegReturn[] = [
  {
    id: 'ret-1',
    customer_id: 'cust-1',
    product_id: 'veg',
    pack_size_id: 'sz_30',
    qty: 5,
    date: '2026-08-15T15:20:00Z'
  },
  {
    id: 'ret-2',
    customer_id: 'cust-2',
    product_id: 'veg',
    pack_size_id: 'sz_30',
    qty: 3,
    date: '2026-09-02T11:00:00Z'
  }
];

export const SEED_TRANSFERS: Transfer[] = [
  {
    id: 'trf-1',
    from_customer_id: 'cust-1', // Mr Samson
    to_customer_id: 'cust-2', // Arena
    item_type: 'keg',
    qty: 2,
    product_id: 'veg',
    pack_size_id: 'sz_30',
    date: '2026-09-03T14:00:00Z',
    note: 'Direct market transfer from Samson to Arena'
  }
];

export const SEED_PAYMENTS: Payment[] = [];

export const SEED_AUDIT_LOG: AuditEntry[] = [];

export const SEED_DIPSTICK_READINGS: TankDipstickReading[] = [
  {
    id: 'ds-1',
    tank_id: 'tank-v1',
    reading_litres: 15660,
    recorded_at: '2026-09-08T07:30:00Z',
    variance: 0,
    is_flagged: false,
    note: 'Morning yard calibration'
  }
];

export const SEED_SHIFTS: Shift[] = [
  {
    id: 'shift-1',
    supervisor_name: 'Alhaja Sikirat (Owner)',
    start_time: '2026-09-08T07:00:00Z',
    end_time: null,
    opening_float: 150000,
    opening_readings: {
      'p-1': 12450,
      'p-2': 8920
    },
    cash_sales: 0,
    cash_expenses: 37000,
    expected_cash: 113000,
    cash_counted: null,
    cash_variance: null,
    status: 'open',
    note: 'Morning shift operational run'
  }
];

export const SEED_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    date: '2026-09-08T08:00:00Z',
    category: 'Diesel/Gen',
    amount: 25000,
    note: '30L diesel for 40kVA generator'
  },
  {
    id: 'exp-2',
    date: '2026-09-08T09:30:00Z',
    category: 'Loading & Offloading',
    amount: 12000,
    note: 'Depot boys offloading assistance'
  }
];

export const EXPENSE_CATEGORIES = [
  'Diesel/Gen',
  'Loading & Offloading',
  'Transport & Logistics',
  'Depot Maintenance',
  'Water & Spillage'
];
