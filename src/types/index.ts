export type CustomerType = 'retail' | 'agent' | 'corporate';
export type UnitType = 'litre' | 'keg';
export type PaymentMethod = 'cash' | 'transfer' | 'credit';
export type KegSource = 'company' | 'own' | null;
export type UserRole = 'owner' | 'staff' | 'driver';

export interface Product {
  id: string; // 'veg' | 'red'
  name: string;
  litres_per_ton: number;
  color_light: string;
  color_dark: string;
}

export interface RateCard {
  product_id: string;
  tier: CustomerType;
  rate_per_litre: number;
}

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  credit_limit: number;
  credit_term_days: number;
  phone: string;
  created_at?: string;
}

export interface Tank {
  id: string;
  product_id: string;
  truck_label: string;
  tons: number;
  received_litres: number;
  remaining_litres: number;
  date: string;
  shortfall: number;
}

export interface Pump {
  id: string;
  label: string;
  product_id?: string;
  last_meter_reading: number;
}

export interface PumpReading {
  id: string;
  pump_id: string;
  reading: number;
  recorded_at: string;
  note?: string;
}

export interface PumpVarianceAudit {
  pumpId: string;
  pumpLabel: string;
  startReading: number;
  endReading: number;
  meterDelta: number;
  expectedLitres: number;
  variance: number;
  isOverThreshold: boolean;
  startDate: string;
  endDate: string;
  note?: string;
}

export interface Order {
  id: string;
  customer_id: string;
  product_id: string;
  unit: UnitType;
  qty: number;
  litres: number;
  rate: number;
  amount: number;
  paid_amount: number;
  payment_method: PaymentMethod;
  keg_source: KegSource;
  date: string;
  due_date: string | null;
  source_tank_id: string | null;
  pump_id: string | null;
  note?: string;
}

export interface KegReturn {
  id: string;
  customer_id: string;
  qty: number;
  date: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  note?: string;
}

export interface AppSettings {
  company_name: string;
  company_phone: string;
  company_address: string;
  company_logo_url: string | null;
  litres_per_keg: number;
  total_company_kegs: number;
  kegs_at_depot_low_threshold: number;
  low_stock_litres_threshold: number;
  truck_shortfall_threshold: number;
  pump_variance_threshold: number;
  default_daily_float: number;
  daily_float: number;
}

export interface KegInventorySummary {
  totalCompanyKegs: number;
  totalKegsOut: number;
  kegsAtDepot: number;
  isDepotStockCritical: boolean;
}

export interface CustomerCalculatedStats {
  customer: Customer;
  currentBalance: number;
  totalCompanyKegsOut: number;
  agingBadge: {
    status: 'overdue' | 'due_soon' | 'current';
    label: string;
    days: number;
    colorClass: string;
  };
  openOrders: Order[];
}

export interface TankDrawAllocation {
  tankId: string;
  truckLabel: string;
  drawnLitres: number;
  remainingAfterDraw: number;
}

export interface TankDrawResult {
  success: boolean;
  allocations: TankDrawAllocation[];
  primaryTankId: string | null;
  updatedTanks: Tank[];
  errorMessage?: string;
}

export interface PaymentApplicationResult {
  appliedOrders: {
    orderId: string;
    originalAmount: number;
    previousPaid: number;
    amountApplied: number;
    newPaidAmount: number;
    isFullyPaid: boolean;
  }[];
  totalApplied: number;
  unappliedLeftover: number;
  updatedOrders: Order[];
}

export interface ReceiptData {
  receiptNumber: string;
  type: 'order' | 'payment';
  date: string;
  customer: Customer;
  order?: Order;
  product?: Product;
  tankLabel?: string;
  pumpLabel?: string;
  paymentAmount?: number;
  paymentMethod: PaymentMethod;
  previousBalance: number;
  newBalance: number;
  unappliedLeftover?: number;
  cashierName?: string;
}
