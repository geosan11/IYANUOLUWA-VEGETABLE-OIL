export type CustomerType = 'retail' | 'agent' | 'corporate';
export type UnitType = 'litre' | 'keg' | 'ton';
export type PaymentMethod = 'cash' | 'transfer' | 'credit' | 'pos';
export type KegSource = 'company' | 'own' | 'purchased' | null;
export type UserRole = 'owner' | 'staff' | 'driver';
export type SupplyModel = 'bulk_truck' | 'pre_kegged';

/** A grade / spec of a product actually in the tank (e.g. "Pure Soya", "Groundnut Blend"). */
export interface ProductVariety {
  id: string;
  name: string;
  /** Added to the tier rate/litre for this variety (0 = standard). May be negative. */
  rate_delta_per_litre: number;
}

export interface Product {
  id: string; // 'veg' | 'red' | custom string
  name: string;
  supply_model: SupplyModel;
  litres_per_ton: number | null; // null for pre_kegged
  litres_per_keg: number; // now PER-PRODUCT
  keg_sell_price: number | null; // price to sell physical container outright
  varieties?: ProductVariety[]; // selectable specs; first entry is the default
  color_light: string;
  color_dark: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
}

export interface PhysicalTank {
  id: string;
  label: string; // e.g. "Storage Tank 1"
  product_id: string;
  capacity_litres: number;
  notes?: string;
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
  supplier_id?: string | null;
  space_note?: string;
  physical_tank_id?: string | null;
  supply_model?: SupplyModel;
  last_dipstick_reading?: number;
  last_dipstick_variance?: number;
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
  keg_price?: number | null;
  keg_amount?: number | null;
  discount_reason?: string | null;
  pricing_tier?: CustomerType | null; // tier the rate was drawn from (may be overridden at the counter)
  variety_id?: string | null;
  variety_name?: string | null;
  date: string;
  due_date: string | null;
  source_tank_id: string | null;
  pump_id: string | null;
  meter_reading?: number | null;
  meter_delta?: number | null;
  meter_variance?: number | null;
  delivered_qty?: number | null;
  shortfall?: number | null;
  note?: string;
}

export interface KegReturn {
  id: string;
  customer_id: string;
  qty: number;
  date: string;
}

export interface Transfer {
  id: string;
  from_customer_id: string;
  to_customer_id: string;
  item_type: 'keg';
  qty: number;
  product_id?: string | null;
  date: string;
  note?: string;
  notes?: string;
}

export interface CustomerCredit {
  id: string;
  customer_id: string;
  amount: number; // positive = credit added (overpayment), negative = credit redeemed
  source_payment_id?: string | null;
  created_at: string;
  note?: string;
}

export interface TankDipstickReading {
  id: string;
  tank_id: string;
  reading_litres: number;
  system_litres?: number;
  recorded_at: string;
  note?: string;
  notes?: string;
  variance?: number;
  is_flagged?: boolean;
  isOverThreshold?: boolean;
}

export interface Shift {
  id: string;
  supervisor_name?: string;
  cashier_name?: string;
  start_time: string;
  end_time?: string | null;
  opening_float: number;
  opening_readings?: Record<string, number>;
  cash_sales?: number;
  cash_expenses?: number;
  expected_cash?: number;
  cash_counted?: number | null;
  cash_variance?: number | null;
  note?: string;
  notes?: string;
  status: 'open' | 'closed';
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
  dipstick_variance_threshold: number;
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
  creditBalance: number; // store credit the depot owes this customer (from overpayments)
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
  kegPrice?: number | null;
  kegAmount?: number | null;
  discountReason?: string | null;
  varietyName?: string | null;
  pricingTier?: CustomerType | null;
  amountTendered?: number | null;
  changeDue?: number | null;
  paymentAmount?: number;
  paymentMethod: PaymentMethod;
  previousBalance: number;
  newBalance: number;
  unappliedLeftover?: number;
  cashierName?: string;
}
