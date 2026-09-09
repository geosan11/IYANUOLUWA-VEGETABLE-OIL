import { Product, RateCard, Customer, AppSettings, Tank, Order, KegReturn, Expense, Pump, PumpReading, Transfer, TankDipstickReading, Shift, Supplier, PhysicalTank } from '../types';

export const LITRES_PER_KEG = 30;

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'veg',
    name: 'Golden Vegetable Oil',
    supply_model: 'bulk_truck',
    litres_per_ton: 1075,
    litres_per_keg: 30,
    keg_sell_price: 3500,
    color_light: '#FCD34D',
    color_dark: '#B45309'
  },
  {
    id: 'red',
    name: 'Red / Palm Oil',
    supply_model: 'pre_kegged',
    litres_per_ton: null,
    litres_per_keg: 25, // Note: confirm actual capacity with client
    keg_sell_price: 3000,
    color_light: '#F87171',
    color_dark: '#7F1D1D'
  }
];

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

// Seed initial orders showing credit aging variety (Current, Due in 2d, Overdue)
export const SEED_ORDERS: Order[] = [
  {
    id: 'ord-101',
    customer_id: 'cust-1', // Mr Samson (Corporate, 30 days)
    product_id: 'veg',
    unit: 'keg',
    qty: 15,
    litres: 450,
    rate: 4500,
    amount: 67500,
    paid_amount: 0,
    payment_method: 'credit',
    keg_source: 'company',
    date: '2026-08-05T10:00:00Z',
    due_date: '2026-09-04T10:00:00Z', // Overdue
    source_tank_id: 'tank-v1',
    pump_id: 'p-1',
    meter_reading: 11610,
    note: 'Initial supply'
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
    meter_reading: 12060,
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
    meter_reading: 5340,
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
    meter_reading: 12300,
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

export const SEED_TRANSFERS: Transfer[] = [
  {
    id: 'trf-1',
    from_customer_id: 'cust-1', // Mr Samson
    to_customer_id: 'cust-2',   // Arena
    item_type: 'keg',
    qty: 2,
    date: '2026-09-03T14:00:00Z',
    note: 'Direct market transfer from Samson to Arena'
  }
];

export const SEED_DIPSTICK_READINGS: TankDipstickReading[] = [
  {
    id: 'ds-1',
    tank_id: 'tank-v1',
    reading_litres: 15660,
    recorded_at: '2026-09-08T07:30:00Z',
    variance: 0,
    isOverThreshold: false,
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
      'p-2': 8920,
      'p-3': 5340
    },
    cash_sales: 0,
    cash_expenses: 37000,
    expected_cash: 113000,
    cash_counted: null,
    cash_variance: null,
    status: 'open',
    notes: 'Morning shift operational run'
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
