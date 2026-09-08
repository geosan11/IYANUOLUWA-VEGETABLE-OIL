import { Product, RateCard, Customer, AppSettings, Tank, Order, KegReturn, Expense, Pump, PumpReading } from '../types';

export const LITRES_PER_KEG = 30;

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'veg',
    name: 'Golden Vegetable Oil',
    litres_per_ton: 1090,
    color_light: '#FCD34D',
    color_dark: '#B45309'
  },
  {
    id: 'red',
    name: 'Red / Palm Oil',
    litres_per_ton: 1085,
    color_light: '#F87171',
    color_dark: '#7F1D1D'
  }
];

export const DEFAULT_RATE_CARDS: RateCard[] = [
  { product_id: 'veg', tier: 'retail', rate_per_litre: 5200 },
  { product_id: 'veg', tier: 'agent', rate_per_litre: 4800 },
  { product_id: 'veg', tier: 'corporate', rate_per_litre: 4500 },
  { product_id: 'red', tier: 'retail', rate_per_litre: 5600 },
  { product_id: 'red', tier: 'agent', rate_per_litre: 5100 },
  { product_id: 'red', tier: 'corporate', rate_per_litre: 4800 }
];

export const DEFAULT_PUMPS: Pump[] = [
  {
    id: 'p-1',
    label: 'Pump 1 (Golden Oil Line)',
    product_id: 'veg',
    last_meter_reading: 12450
  },
  {
    id: 'p-2',
    label: 'Pump 2 (Golden Oil Line)',
    product_id: 'veg',
    last_meter_reading: 8920
  },
  {
    id: 'p-3',
    label: 'Pump 3 (Palm Oil Line)',
    product_id: 'red',
    last_meter_reading: 5340
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
  },
  {
    id: 'pr-4',
    pump_id: 'p-3',
    reading: 5040,
    recorded_at: '2026-09-07T06:00:00Z',
    note: 'Baseline palm oil meter reading'
  },
  {
    id: 'pr-5',
    pump_id: 'p-3',
    reading: 5340,
    recorded_at: '2026-09-07T18:00:00Z',
    note: 'End of day reading'
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
  default_daily_float: 150000,
  daily_float: 150000
};

// Seed initial tanks to show working depot operation
export const SEED_TANKS: Tank[] = [
  {
    id: 'tank-v1',
    product_id: 'veg',
    truck_label: 'TRK-VEG-902 (Aliyu)',
    tons: 10,
    received_litres: 10900,
    remaining_litres: 6420,
    date: '2026-09-01T08:30:00Z',
    shortfall: 20
  },
  {
    id: 'tank-v2',
    product_id: 'veg',
    truck_label: 'TRK-VEG-908 (Ibrahim)',
    tons: 15,
    received_litres: 16350,
    remaining_litres: 16350,
    date: '2026-09-06T11:15:00Z',
    shortfall: 45
  },
  {
    id: 'tank-r1',
    product_id: 'red',
    truck_label: 'TRK-RED-404 (Emeka)',
    tons: 8,
    received_litres: 8680,
    remaining_litres: 4150,
    date: '2026-09-03T09:40:00Z',
    shortfall: 35
  }
];

// Seed initial orders showing credit aging variety (Current, Due in 2d, Overdue)
export const SEED_ORDERS: Order[] = [
  {
    id: 'ord-101',
    customer_id: 'cust-1', // Mr Samson (Corporate, 30 days)
    product_id: 'veg',
    unit: 'keg',
    qty: 20,
    litres: 600,
    rate: 4500,
    amount: 90000,
    paid_amount: 0,
    payment_method: 'credit',
    keg_source: 'company',
    date: '2026-08-01T10:00:00Z',
    due_date: '2026-08-31T10:00:00Z', // Overdue
    source_tank_id: 'tank-v1',
    pump_id: 'p-1',
    note: 'Initial month batch'
  },
  {
    id: 'ord-102',
    customer_id: 'cust-2', // Arena (Agent, 14 days)
    product_id: 'veg',
    unit: 'keg',
    qty: 15,
    litres: 450,
    rate: 4800,
    amount: 72000,
    paid_amount: 0,
    payment_method: 'credit',
    keg_source: 'company',
    date: '2026-08-28T14:30:00Z',
    due_date: '2026-09-11T14:30:00Z', // Due in 3 days
    source_tank_id: 'tank-v1',
    pump_id: 'p-1',
    note: 'Depot dispatch'
  },
  {
    id: 'ord-103',
    customer_id: 'cust-3', // Iya Aige (Agent, 14 days)
    product_id: 'red',
    unit: 'keg',
    qty: 10,
    litres: 300,
    rate: 5100,
    amount: 51000,
    paid_amount: 51000,
    payment_method: 'transfer',
    keg_source: 'own',
    date: '2026-09-07T09:15:00Z',
    due_date: null,
    source_tank_id: 'tank-r1',
    pump_id: 'p-3',
    note: 'Customer brought own yellow jerrycans'
  },
  {
    id: 'ord-104',
    customer_id: 'cust-4', // Lekki Agent
    product_id: 'veg',
    unit: 'keg',
    qty: 8,
    litres: 240,
    rate: 4800,
    amount: 38400,
    paid_amount: 0,
    payment_method: 'credit',
    keg_source: 'company',
    date: '2026-09-04T12:00:00Z',
    due_date: '2026-09-18T12:00:00Z', // Current
    source_tank_id: 'tank-v1',
    pump_id: 'p-1',
    note: 'Fast agent restock'
  }
];

export const SEED_KEG_RETURNS: KegReturn[] = [
  {
    id: 'ret-1',
    customer_id: 'cust-1',
    qty: 5,
    date: '2026-08-15T15:20:00Z'
  },
  {
    id: 'ret-2',
    customer_id: 'cust-2',
    qty: 3,
    date: '2026-09-02T11:00:00Z'
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
