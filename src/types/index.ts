export type CustomerType = 'retail' | 'agent' | 'corporate';
export type UnitType = 'litre' | 'keg' | 'ton';
export type SinglePaymentMethod = 'cash' | 'transfer' | 'credit' | 'pos';
export type PaymentMethod = SinglePaymentMethod | 'split';

export interface PaymentSplit {
  method: SinglePaymentMethod;
  amount: number;
  amount_tendered?: number | null;
  change_due?: number | null;
  reference?: string | null;
  credit_term_days?: number;
  due_date?: string | null;
}

export type KegSource = 'company' | 'own' | 'purchased' | null;
export type UserRole = 'owner' | 'hub_manager' | 'staff' | 'driver';
export type SupplyModel = 'bulk_truck' | 'pre_kegged';

export interface Hub {
  id: string; // e.g. 'hub-los-alaba', 'hub-los-ikeja', 'hub-oyo-ibadan'
  name: string; // e.g. "Alaba Central Depot"
  code: string; // e.g. "LOS-ALB-01"
  state: string; // e.g. "Lagos", "Oyo"
  address: string;
  phone?: string;
  manager_name?: string;
  is_active: boolean;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  hub_id: string | null; // null for owner (global super-admin); assigned to a hub for manager/staff/driver
  active: boolean;
  created_at?: string;
  /**
   * Per-user screen override. `null`/`undefined`/`[]` = fall back to the
   * role default (every screen except the `adminOnly` ones). A non-empty
   * list means exactly those nav item ids, however many/few — see
   * `getVisibleNavItems` in constants/nav.ts. Ignored for `owner`, who
   * always sees everything.
   */
  allowed_screens?: string[] | null;
}

/** How a returnable container leaves the depot on a sale line. */
export type ContainerMode = 'taken' | 'bought' | 'none';

/** A fixed pack size the depot sells oil in (1L, 25L, 256L drum, …). */
export interface PackSize {
  id: string; // stable key, e.g. 'sz_25'
  litres: number; // 25
  short: string; // '25L'
  label: string; // '25 L' or '256 L (1 drum)'
}

/** A grade / spec of a product (e.g. "Pure Soya", "Groundnut Blend"). Now a full SKU with its own price rows. */
export interface ProductVariety {
  id: string;
  name: string;
}

/** Which pack sizes a product sells, and the returnable-container rules for each. */
export interface ProductPackConfig {
  pack_size_id: string; // FK -> PACK_SIZES; presence in the array = "product sells this size"
  returnable: boolean; // regulars return the keg/drum
  container_buy_price: number; // charged when the container is bought outright; 0 when n/a
  sort?: number;
}

export interface Product {
  id: string; // 'veg' | 'red' | custom string
  name: string;
  supply_model: SupplyModel;
  litres_per_ton: number | null; // null for pre_kegged
  litres_per_keg: number; // KEPT — intake maths only
  keg_sell_price: number | null; // KEPT — fallback container price
  varieties: ProductVariety[]; // REQUIRED, length >= 1; first entry is the default
  pack_config: ProductPackConfig[]; // which sizes this product sells + container rules
  color_light: string;
  color_dark: string;
}

/** Absolute price for ONE pack, keyed by variety x pack size x customer tier. */
export interface PackPrice {
  product_id: string;
  variety_id: string;
  pack_size_id: string;
  tier: CustomerType;
  price: number; // absolute price for one pack at this tier (NOT per-litre)
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
  hub_id?: string;
}

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  credit_limit: number;
  credit_term_days: number;
  phone: string;
  hub_id?: string | null;
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
  hub_id?: string;
}

export interface Pump {
  id: string;
  label: string;
  product_id?: string;
  last_meter_reading: number;
  /** Yard {@link PhysicalTank} this pump draws from — the pump's "source". */
  physical_tank_id?: string | null;
  hub_id?: string;
}

export interface PumpReading {
  id: string;
  pump_id: string;
  reading: number;
  recorded_at: string;
  note?: string;
  recorded_by?: string;
  hub_id?: string;
  /** True only for a deliberate meter reset/replacement — reconciliation
   * treats this reading as a fresh baseline instead of diffing against
   * whatever the pump last read, so a real meter swap doesn't get flagged
   * as a giant theft/shortage variance. */
  is_reset?: boolean;
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
  /** Depot-local calendar day (YYYY-MM-DD) this reconciliation covers. */
  day: string;
  note?: string;
}

/** A single sale can carry several line items ({@link Order}) settled by one payment. */
export interface Sale {
  id: string; // 'sale-<ts>'
  customer_id: string;
  date: string; // ISO — stamped "now"
  payment_method: PaymentMethod;
  payment_splits?: PaymentSplit[];
  amount_tendered?: number | null;
  change_due?: number | null;
  cashier_name?: string;
  note?: string;
  credit_term_days?: number;
  due_date?: string | null;
  voided?: boolean;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  hub_id?: string;
}

/** One sale line. Grouped under a {@link Sale} by `sale_id`. */
export interface Order {
  id: string; // 'line-<ts>-<n>'
  sale_id: string;
  customer_id: string; // denormalised — existing filters use it
  product_id: string;
  variety_id: string;
  variety_name: string;
  pack_size_id: string;
  qty: number; // number of packs (integer)
  litres: number; // qty * packLitres(pack_size_id)

  unit_price: number; // matrix price for ONE pack at the tier (replaces `rate`)
  original_unit_price: number | null; // matrix price before any override
  price_adjusted: boolean; // true when staff overrode the price (up OR down)
  price_adjust_reason: string | null; // REQUIRED when price_adjusted
  oil_amount: number; // qty * unit_price

  container_mode: ContainerMode; // replaces keg_source
  returnable: boolean; // snapshot from pack_config at sale time
  container_unit_price: number | null; // snapshot of container_buy_price
  container_amount: number | null; // qty * container_unit_price when 'bought'
  line_amount: number; // oil_amount + (container_amount ?? 0)
  amount: number; // alias === line_amount (back-compat for reducers)

  pricing_tier: CustomerType;
  payment_method: PaymentMethod; // mirrors Sale — FIFO/aging reducers read it
  payment_splits?: PaymentSplit[];
  paid_amount: number;
  credit_term_days?: number;
  due_date: string | null;
  date: string; // === Sale.date

  source_tank_id: string | null;
  /** Per-tank FIFO draw breakdown. */
  tank_allocations?: { tank_id: string; litres: number }[] | null;
  voided?: boolean; // mirrors Sale.voided
  note?: string;
  hub_id?: string;
}

export interface KegReturn {
  id: string;
  customer_id: string;
  product_id: string;
  pack_size_id: string; // returns are counted against the size taken
  qty: number;
  date: string;
  note?: string;
  hub_id?: string;
}

export interface Transfer {
  id: string;
  from_customer_id: string;
  to_customer_id: string;
  item_type: 'keg';
  qty: number;
  product_id?: string | null;
  pack_size_id?: string | null;
  date: string;
  note?: string;
  from_hub_id?: string;
  to_hub_id?: string;
}

/** A recorded customer payment. Persisted so a fully-applied settlement still leaves a trace. */
export interface Payment {
  id: string; // 'pay-<ts>'
  customer_id: string;
  amount: number;
  method: PaymentMethod; // cash | transfer | pos (never 'credit')
  date: string; // stamped "now"
  applied_to: { order_id: string; amount: number }[];
  overpayment_to_credit: number; // amount pushed to CustomerCredit (0 if none)
  source: 'payment' | 'credit_redeem';
  recorded_by?: string;
  note?: string;
  voided?: boolean;
  voided_at?: string | null;
  void_reason?: string | null;
  hub_id?: string;
}

export interface CustomerCredit {
  id: string;
  customer_id: string;
  amount: number; // positive = credit added (overpayment), negative = credit redeemed
  source_payment_id?: string | null;
  created_at: string;
  note?: string;
  hub_id?: string;
}

/** One recorded edit / void of a financial record, for dispute history. */
export interface AuditEntry {
  id: string;
  entity_type: 'sale' | 'order_line' | 'payment' | 'expense' | 'tank_intake';
  entity_id: string;
  action: 'create' | 'edit' | 'void' | 'unvoid';
  changes: { field: string; old: unknown; new: unknown }[];
  actor_role: UserRole;
  actor_name?: string;
  at: string; // ISO
  reason?: string;
  hub_id?: string;
}

export interface Shift {
  id: string;
  supervisor_name?: string;
  cashier_name?: string;
  start_time: string;
  end_time?: string | null;
  opening_float: number;
  opening_readings?: Record<string, number>;
  closing_readings?: Record<string, number>;
  cash_sales?: number;
  cash_expenses?: number;
  expected_cash?: number;
  cash_counted?: number | null;
  cash_variance?: number | null;
  note?: string;
  status: 'open' | 'closed';
  hub_id?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  note?: string;
  voided?: boolean;
  voided_at?: string | null;
  void_reason?: string | null;
  recorded_by?: string;
  customer_id?: string;
  charge_to_customer?: boolean;
  hub_id?: string;
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
  shift_start_time: string;
  shift_end_time: string;
  require_pump_readings_to_start_shift?: boolean;
  require_pump_readings_to_close_shift?: boolean;
  outright_keg_price?: number;
  keg_deposit_price?: number;
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
  /** Company containers out on loan, keyed `${product_id}|${pack_size_id}`. */
  kegsOutByPack: Record<string, number>;
  agingBadge: {
    status: 'overdue' | 'due_soon' | 'current';
    label: string;
    days: number;
    colorClass: string;
  };
  openOrders: Order[];
}

/** One line of a customer's running credit statement. */
export interface CustomerStatementRow {
  date: string;
  kind: 'sale' | 'payment' | 'credit_note' | 'keg_return';
  label: string;
  debit: number; // increases what they owe
  credit: number; // reduces what they owe
  runningBalance: number; // outstanding credit balance after this row
  paidStatus?: 'paid' | 'part' | 'unpaid';
  kegBalance: number; // company containers on loan after this row
  note?: string;
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
  sale?: Sale;
  lines?: Order[];
  order?: Order;
  product?: Product;
  packLabel?: string;
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
  paymentSplits?: PaymentSplit[];
  previousBalance: number;
  newBalance: number;
  unappliedLeftover?: number;
  cashierName?: string;
}
