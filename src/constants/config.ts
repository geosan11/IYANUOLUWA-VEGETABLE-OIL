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
  Hub,
  UserProfile,
  PaymentMethod
} from '../types';

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

export const DEFAULT_PRODUCTS: Product[] = [];

/* ------------------------------------------------------------------
 * PRICE MATRIX - one absolute price per (product, variety, pack size, tier).
 * Starts EMPTY: the owner sets every cell in the Inventory tab. No price
 * model is seeded any more - nothing may invent a price the depot never
 * agreed with a customer.
 * ------------------------------------------------------------------ */

export const DEFAULT_PACK_PRICES: PackPrice[] = [];

/* ------------------------------------------------------------------ *
 * OTHER CATALOG DATA (unchanged)
 * ------------------------------------------------------------------ */

// No pre-existing hubs — the owner registers each real depot location from
// scratch (Settings -> Hubs & Depots), same convention as suppliers,
// physical tanks, and pumps below.
export const DEFAULT_HUBS: Hub[] = [];

// A single bootstrap identity — store.tsx falls back to this as the signed-in
// `currentUser` before a real Supabase profile loads (or entirely, in
// offline mode with no Supabase configured). Not a roster: real team members
// are Supabase-backed `profiles` rows managed via Staff Management, not
// entries in a local list.
export const FALLBACK_OWNER_IDENTITY: UserProfile = {
  id: 'usr-owner',
  full_name: 'Depot Owner',
  email: '',
  phone: '',
  role: 'owner',
  hub_id: null,
  active: true,
  created_at: '2026-01-01T00:00:00Z'
};

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

// A brand-new depot has no settings at all: every value below is blank or 0,
// and the owner fills them in from Settings (Keg Configuration, Company
// Details, Thresholds). 0 means not configured - see configuredNumber() in
// services/businessLogic.ts. Nothing may treat a 0 here as a real magnitude.
// Shift times keep usable defaults because grouping sales/readings into depot
// days needs a window; they are workflow values, not depot data.
export const DEFAULT_SETTINGS: AppSettings = {
  company_name: '',
  company_phone: '',
  company_address: '',
  company_logo_url: null,
  litres_per_keg: 0,
  default_litres_per_ton: 0,
  total_company_kegs: 0,
  kegs_at_depot_low_threshold: 0,
  low_stock_litres_threshold: 0,
  truck_shortfall_threshold: 0,
  pump_variance_threshold: 0,
  shift_start_time: '07:00',
  shift_end_time: '18:00',
  require_pump_readings_to_start_shift: true,
  require_pump_readings_to_close_shift: true,
  outright_keg_price: 0,
  keg_deposit_price: 0
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
