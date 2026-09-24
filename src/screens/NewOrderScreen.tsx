import React, { useMemo, useState } from 'react';
import { useStore } from '../services/store';
import { useToast } from '../services/toast';
import { usePermissions } from '../services/permissions';
import {
  formatNaira,
  formatDepotDate,
  formatDepotTime,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  computeShiftCash,
  formatWithCommas,
  parseFromCommas
} from '../services/businessLogic';
import { priceSaleLine } from '../services/pricing';
import { PACK_SIZES, packLabel, packShort, getPaymentModeTheme, ONE_TIME_CUSTOMER_ID } from '../constants/config';
import { ContainerMode, CustomerType, SinglePaymentMethod, ReceiptData, PaymentSplit } from '../types';
import { Modal } from '../components/common/Modal';
import {
  MagnifyingGlass as Search,
  Minus,
  Plus,
  Trash as Trash2,
  ShieldWarning as ShieldAlert,
  Check,
  CaretRight as ChevronRight,
  ClockCounterClockwise,
  ArrowLeft,
  Printer,
  ArrowSquareOut,
  GasPump,
  UserCheck,
  Calculator,
  ShoppingCart,
  Package,
  Clock,
  Users,
  Gauge,
  BeerBottle,
  Jar,
  Cube,
  Drop,
  MagicWand
} from '@phosphor-icons/react';
import { MiniNumberPad } from '../components/common/MiniNumberPad';

/** Small numbered step marker for section headers, echoing a terminal-style flow. */
const StepBadge: React.FC<{ n: number; label: string }> = ({ n, label }) => (
  <div className="flex items-center gap-2">
    <span className="w-5 h-5 rounded bg-brand-500/20 text-brand-700 dark:text-brand-400 font-mono tabular-nums font-bold text-xs flex items-center justify-center shrink-0">
      {n}
    </span>
    <span className="text-xs font-sans font-bold uppercase tracking-wider text-slate-500">{label}</span>
  </div>
);

/** Container icon by pack size, consistent across the item builder: bottle for
 * retail-size bottles, jar for mid-size jerrycans, the same Package icon used
 * elsewhere in this screen for the 25L company keg range, and a crate/cube for
 * quarter-to-full drums. */
const packSizeIcon = (litres: number) => {
  if (litres <= 1) return BeerBottle;
  if (litres <= 14) return Jar;
  if (litres <= 30) return Package;
  return Cube;
};

const PAYMENT_METHODS: { id: SinglePaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'pos', label: 'Card / POS' },
  { id: 'credit', label: 'Debt' }
];

interface DraftLine {
  key: string;
  productId: string;
  productName: string;
  varietyId: string;
  varietyName: string;
  packSizeId: string;
  qty: number;
  containerMode: ContainerMode;
  overrideUnitPrice: number | null;
  priceAdjustReason: string | null;
  unitPrice: number;
  lineAmount: number;
  litres: number;
  priceAdjusted: boolean;
  /** Selling the empty keg itself — no oil. */
  kegOnly: boolean;
  /** Pump this line was dispensed from — null when the product isn't pump-dispensed. */
  pumpId: string | null;
  pumpLabel: string | null;
}

export interface NewOrderScreenProps {
  onNavigate?: (tab: string) => void;
}

export const NewOrderScreen: React.FC<NewOrderScreenProps> = ({ onNavigate }) => {
  const {
    products,
    packPrices,
    customers,
    customerStatsMap,
    shiftGateStatus,
    activeShift,
    startShift,
    closeShift,
    recordShiftOpeningReadings,
    createSale,
    pumps,
    expenses,
    sales,
    orders,
    setActiveReceipt,
    currentUser,
    settings,
    addCustomer,
    endShiftRequested,
    clearEndShiftRequest,
    tankStockByProduct
  } = useStore();
  const { can } = usePermissions();
  const { showToast } = useToast();

  // ---- In-page Previous Transactions View toggle ----
  const [showPreviousTransactions, setShowPreviousTransactions] = useState(false);
  const [txnSearch, setTxnSearch] = useState('');

  // ---- customer ----
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);

  // New Customer Modal state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('+234');
  const [newCustType, setNewCustType] = useState<CustomerType>('agent');
  const [newCustLimit, setNewCustLimit] = useState('150,000');
  const [newCustTerms, setNewCustTerms] = useState('14');
  const [addCustomerError, setAddCustomerError] = useState<string | null>(null);

  const isOneTime = customerId === ONE_TIME_CUSTOMER_ID;
  const customer = customers.find(c => c.id === customerId) || null;
  const customerStats = customer ? customerStatsMap[customer.id] : null;
  const tier: CustomerType = customer?.type || 'retail';

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      setAddCustomerError('Please enter a customer name.');
      showToast('error', 'Please enter a customer name.');
      return;
    }
    const limit = Math.round(parseFromCommas(newCustLimit)) || 0;
    const terms = Math.round(Number(newCustTerms.replace(/[^0-9]/g, ''))) || 14;
    const created = addCustomer({
      name: newCustName.trim(),
      type: newCustType,
      credit_limit: limit,
      credit_term_days: terms,
      phone: newCustPhone.trim()
    });
    showToast('success', `Customer "${created.name}" added.`);
    setCustomerId(created.id);
    setIsAddCustomerOpen(false);
    setCustomerOpen(false);
    setCustomerSearch('');
    setNewCustName('');
    setNewCustPhone('+234');
    setNewCustLimit('150000');
  };

  // ---- item builder ----
  const [productId, setProductId] = useState<string>(products[0]?.id || '');
  const product = products.find(p => p.id === productId) || null;
  const [varietyId, setVarietyId] = useState<string>('');
  const [packSizeId, setPackSizeId] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  /**
   * Selling an empty keg outright (no oil). A returnable pack size otherwise
   * always goes out "taken" (company keg, returnable) automatically — there's
   * no per-sale taken/bought choice any more; outright keg sales are their
   * own item instead.
   */
  const [isKegOnlyMode, setIsKegOnlyMode] = useState(false);
  const [pumpId, setPumpId] = useState<string>('');
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideValue, setOverrideValue] = useState('');
  const [priceReason, setPriceReason] = useState('');
  const [showNumpad, setShowNumpad] = useState(false);
  const [numpadTarget, setNumpadTarget] = useState<'qty' | 'price'>('qty');

  // ---- cart + payment ----
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [payMethods, setPayMethods] = useState<SinglePaymentMethod[]>(['cash']);
  const [payAmounts, setPayAmounts] = useState<Partial<Record<SinglePaymentMethod, string>>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showBackdate, setShowBackdate] = useState(false);
  const [saleDateInput, setSaleDateInput] = useState(() => toDatetimeLocalValue());

  // ---- Editable Debt Period / Terms ----
  const [creditTermDays, setCreditTermDays] = useState<number>(14);

  // Sync default credit term days when selected customer changes
  React.useEffect(() => {
    if (customer?.credit_term_days) {
      setCreditTermDays(customer.credit_term_days);
    }
  }, [customer?.id, customer?.credit_term_days]);

  const effectiveDueDate = useMemo(() => {
    const baseTime = showBackdate ? new Date(fromDatetimeLocalValue(saleDateInput)).getTime() : Date.now();
    return new Date(baseTime + Math.max(1, creditTermDays) * 86400000);
  }, [showBackdate, saleDateInput, creditTermDays]);

  // ---- Target 3 dispensing bulk pumps ----
  const targetPumps = useMemo(() => {
    const bulk = pumps.filter(p => {
      const prod = products.find(pr => pr.id === p.product_id);
      return prod ? prod.supply_model === 'bulk_truck' : true;
    });
    return bulk.length > 0 ? bulk : pumps;
  }, [pumps, products]);

  // ---- shift gate & start shift ----
  const currentCashierName = currentUser?.full_name || currentUser?.email || 'Staff';
  const [gateInputs, setGateInputs] = useState<Record<string, string>>({});
  const [gateError, setGateError] = useState<string | null>(null);
  const anyBulk = products.some(p => p.supply_model === 'bulk_truck');
  const gateBlocked = anyBulk && !shiftGateStatus.isPassed;

  // ---- Closing Shift Modal State ----
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [closeShiftCashCounted, setCloseShiftCashCounted] = useState('');
  const [closeShiftPumpInputs, setCloseShiftPumpInputs] = useState<Record<string, string>>({});
  const [closeShiftNotes, setCloseShiftNotes] = useState('');
  const [closeShiftError, setCloseShiftError] = useState<string | null>(null);

  // Opens this modal when the top nav's End Shift button fires the request —
  // that button lives outside this screen, so it can't set local state directly.
  React.useEffect(() => {
    if (!endShiftRequested || !activeShift) return;
    const prefill: Record<string, string> = {};
    for (const p of targetPumps) {
      prefill[p.id] = p.last_meter_reading.toString();
    }
    setCloseShiftPumpInputs(prefill);
    setCloseShiftCashCounted('');
    setCloseShiftError(null);
    setIsCloseShiftModalOpen(true);
    clearEndShiftRequest();
  }, [endShiftRequested, activeShift, targetPumps, clearEndShiftRequest]);

  const liveShiftCash = useMemo(() => {
    if (!activeShift) return null;
    return computeShiftCash(activeShift, orders, expenses, new Date(), sales);
  }, [activeShift, orders, expenses, sales]);

  const liveCloseVariance = useMemo(() => {
    if (!activeShift || !liveShiftCash || !closeShiftCashCounted.trim()) return null;
    const counted = parseFromCommas(closeShiftCashCounted);
    if (isNaN(counted)) return null;
    return counted - liveShiftCash.expectedCash;
  }, [activeShift, liveShiftCash, closeShiftCashCounted]);



  const packConfig = product?.pack_config ?? [];
  const sellableSizes = PACK_SIZES.filter(
    s => packConfig.some(c => c.pack_size_id === s.id && (!isKegOnlyMode || c.returnable))
  );
  const activePackCfg = packConfig.find(c => c.pack_size_id === packSizeId) || null;
  const isReturnable = activePackCfg?.returnable ?? false;
  // A returnable pack always goes out "taken" automatically; an outright keg
  // sale (Sell Kegs item) is always "bought". Nothing else is user-toggled.
  const effectiveContainerMode: ContainerMode = !isReturnable ? 'none' : isKegOnlyMode ? 'bought' : 'taken';

  // Which pump this line was dispensed from — only meaningful for bulk (tank
  // + pump) products; a kegged product or an empty-keg-only line never
  // touches a pump. A pump with no product_id set is generic (serves any
  // bulk product), matching how `targetPumps` reads pump/product pairing.
  const productPumps = useMemo(() => {
    if (!product || product.supply_model !== 'bulk_truck' || isKegOnlyMode) return [];
    return pumps.filter(p => !p.product_id || p.product_id === product.id);
  }, [pumps, product, isKegOnlyMode]);

  // Switching product re-starts the procedure from scratch — variety, pump
  // and pack size are never carried over or pre-picked, so staff always make
  // an explicit choice at each step instead of inheriting a stale default.
  const selectProduct = (id: string) => {
    setProductId(id);
    setIsKegOnlyMode(false);
    setVarietyId('');
    setPackSizeId('');
    setPumpId('');
    setOverrideOn(false);
    setOverrideValue('');
    setPriceReason('');
  };

  const selectSellKegs = () => {
    setIsKegOnlyMode(true);
    setVarietyId(product?.varieties[0]?.id || '');
    setPumpId('');
    setPackSizeId('sz_25');
    setQty(1);
    setOverrideOn(false);
    setOverrideValue('');
    setPriceReason('');
  };

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))
      .slice(0, 8);
  }, [customers, customerSearch]);

  const preview = useMemo(() => {
    if (!product || !varietyId || !packSizeId) return null;
    return priceSaleLine({
      product,
      varietyId,
      packSizeId,
      tier,
      qty,
      containerMode: effectiveContainerMode,
      overrideUnitPrice: overrideOn && overrideValue ? parseFromCommas(overrideValue) : null,
      packPrices,
      kegOnly: isKegOnlyMode
    });
  }, [product, varietyId, packSizeId, tier, qty, effectiveContainerMode, isKegOnlyMode, overrideOn, overrideValue, packPrices]);

  const cartTotal = lines.reduce((s, l) => s + l.lineAmount, 0);

  const isSplitPay = payMethods.length > 1;
  const splitTotalAssigned = Number(
    payMethods.reduce((s, m) => s + parseFromCommas(payAmounts[m] || ''), 0).toFixed(2)
  );
  const splitRemaining = Math.max(0, Number((cartTotal - splitTotalAssigned).toFixed(2)));
  const splitOver = Math.max(0, Number((splitTotalAssigned - cartTotal).toFixed(2)));
  const isSplitBalanced = cartTotal > 0 && Math.abs(splitTotalAssigned - cartTotal) < 0.01;

  const creditPortion = !payMethods.includes('credit')
    ? 0
    : isSplitPay
      ? parseFromCommas(payAmounts.credit || '')
      : cartTotal;

  const projectedBalance = (customerStats?.currentBalance || 0) + creditPortion;
  const overLimit = !!customer && creditPortion > 0 && projectedBalance > customer.credit_limit;
  const overLimitBlocked = overLimit && !can('authorizeCreditOverride');

  const priceAdjustMissingReason = !!preview?.priceAdjusted && !priceReason.trim();

  const canAddLine =
    !!product &&
    !!varietyId &&
    !!packSizeId &&
    qty > 0 &&
    !!preview &&
    !preview.unpriced &&
    preview.lineAmount > 0 &&
    !priceAdjustMissingReason &&
    (productPumps.length === 0 || !!pumpId);

  const cartQtyForPack = (vId: string, sId: string) =>
    lines
      .filter(l => l.productId === product?.id && l.varietyId === vId && l.packSizeId === sId && !l.kegOnly)
      .reduce((s, l) => s + l.qty, 0);

  const repriceDraft = (l: DraftLine, patch: { qty?: number; overrideUnitPrice?: number | null; priceAdjustReason?: string | null }): DraftLine => {
    const prod = products.find(p => p.id === l.productId);
    const nextQty = patch.qty ?? l.qty;
    const nextOverride = patch.overrideUnitPrice !== undefined ? patch.overrideUnitPrice : l.overrideUnitPrice;
    const nextReason = patch.priceAdjustReason !== undefined ? patch.priceAdjustReason : l.priceAdjustReason;
    if (!prod) return { ...l, qty: nextQty, overrideUnitPrice: nextOverride, priceAdjustReason: nextReason };
    const priced = priceSaleLine({
      product: prod,
      varietyId: l.varietyId,
      packSizeId: l.packSizeId,
      tier,
      qty: nextQty,
      containerMode: l.containerMode,
      overrideUnitPrice: nextOverride,
      packPrices,
      kegOnly: l.kegOnly
    });
    return {
      ...l,
      qty: nextQty,
      overrideUnitPrice: nextOverride,
      priceAdjustReason: priced.priceAdjusted ? (nextReason || 'Counter rate') : null,
      unitPrice: priced.unitPrice,
      lineAmount: priced.lineAmount,
      litres: priced.litres,
      priceAdjusted: priced.priceAdjusted
    };
  };

  const addLine = () => {
    if (!product || !preview || !canAddLine) return;
    const variety = product.varieties.find(v => v.id === varietyId);
    const selectedPump = productPumps.length > 0 ? pumps.find(p => p.id === pumpId) || null : null;
    setLines(prev => [
      ...prev,
      {
        key: `dl-${Date.now()}-${prev.length}`,
        productId: product.id,
        productName: product.name,
        varietyId,
        varietyName: variety?.name || '',
        packSizeId,
        qty,
        containerMode: effectiveContainerMode,
        overrideUnitPrice: overrideOn && overrideValue ? parseFromCommas(overrideValue) : null,
        priceAdjustReason: preview.priceAdjusted ? (priceReason.trim() || 'Counter rate') : null,
        unitPrice: preview.unitPrice,
        lineAmount: preview.lineAmount,
        litres: preview.litres,
        priceAdjusted: preview.priceAdjusted,
        kegOnly: isKegOnlyMode,
        pumpId: selectedPump?.id || null,
        pumpLabel: selectedPump?.label || null
      }
    ]);
    setVarietyId('');
    setPumpId('');
    setPackSizeId('');
    setQty(1);
    setIsKegOnlyMode(false);
    setOverrideOn(false);
    setOverrideValue('');
    setPriceReason('');
    setError(null);
  };

  const quickAddPack = (vId: string, sId: string) => {
    if (!product) return;
    if (productPumps.length > 0 && !pumpId) {
      showToast('error', 'Select a dispensing pump first.');
      return;
    }
    const packCfg = packConfig.find(c => c.pack_size_id === sId);
    const containerMode: ContainerMode = packCfg?.returnable ? 'taken' : 'none';
    const priced = priceSaleLine({
      product,
      varietyId: vId,
      packSizeId: sId,
      tier,
      qty: 1,
      containerMode,
      packPrices,
      kegOnly: false
    });
    setVarietyId(vId);
    setPackSizeId(sId);
    setQty(1);
    setOverrideOn(false);
    setOverrideValue('');
    setPriceReason('');
    setError(null);

    if (priced.unpriced) {
      showToast('error', 'No matrix price for this pack — set a unit price on the item in Payment.');
    }

    const variety = product.varieties.find(v => v.id === vId);
    const selectedPump = productPumps.length > 0 ? pumps.find(p => p.id === pumpId) || null : null;
    const pumpKey = selectedPump?.id || null;

    setLines(prev => {
      const existing = prev.find(
        l =>
          l.productId === product.id &&
          l.varietyId === vId &&
          l.packSizeId === sId &&
          !l.kegOnly &&
          l.pumpId === pumpKey
      );
      if (existing) {
        return prev.map(l => (l.key === existing.key ? repriceDraft(l, { qty: l.qty + 1 }) : l));
      }
      return [
        ...prev,
        {
          key: `dl-${Date.now()}-${prev.length}`,
          productId: product.id,
          productName: product.name,
          varietyId: vId,
          varietyName: variety?.name || '',
          packSizeId: sId,
          qty: 1,
          containerMode,
          overrideUnitPrice: null,
          priceAdjustReason: null,
          unitPrice: priced.unitPrice,
          lineAmount: priced.lineAmount,
          litres: priced.litres,
          priceAdjusted: priced.priceAdjusted,
          kegOnly: false,
          pumpId: pumpKey,
          pumpLabel: selectedPump?.label || null
        }
      ];
    });
  };

  const updateLineQty = (key: string, nextQty: number) => {
    if (nextQty < 1) {
      setLines(prev => prev.filter(l => l.key !== key));
      return;
    }
    setLines(prev => prev.map(l => (l.key === key ? repriceDraft(l, { qty: nextQty }) : l)));
  };

  const updateLinePrice = (key: string, raw: string) => {
    const parsed = parseFromCommas(raw);
    const override = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    setLines(prev => prev.map(l => (l.key === key ? repriceDraft(l, { overrideUnitPrice: override }) : l)));
  };

  const updateLineReason = (key: string, reason: string) => {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, priceAdjustReason: reason } : l)));
  };

  const resetLinePrice = (key: string) => {
    setLines(prev => prev.map(l => (l.key === key ? repriceDraft(l, { overrideUnitPrice: null, priceAdjustReason: null }) : l)));
  };

  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key));

  const togglePayMethod = (id: SinglePaymentMethod) => {
    setPayMethods(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        setPayAmounts(amounts => {
          const next = { ...amounts };
          delete next[id];
          return next;
        });
        return prev.filter(m => m !== id);
      }
      if (prev.length === 1) {
        setPayAmounts({});
      }
      return [...prev, id];
    });
  };

  const autoBalanceMethod = (id: SinglePaymentMethod) => {
    const others = payMethods
      .filter(m => m !== id)
      .reduce((s, m) => s + parseFromCommas(payAmounts[m] || ''), 0);
    const remaining = Math.max(0, Number((cartTotal - others).toFixed(2)));
    setPayAmounts(prev => ({ ...prev, [id]: formatWithCommas(remaining) }));
  };

  const fail = (msg: string) => {
    setError(msg);
    showToast('error', msg);
  };

  const completeSale = () => {
    setError(null);
    if (!customer) return fail('Select a customer.');
    if (lines.length === 0) return fail('Add at least one item.');
    if (lines.some(l => l.lineAmount <= 0 && !l.kegOnly)) {
      return fail('Every item needs a unit price. Set the price on the unpriced line in Payment.');
    }
    if (lines.some(l => l.priceAdjusted && !l.priceAdjustReason?.trim())) {
      return fail('Enter a reason for each custom rate before completing the sale.');
    }

    const debtSelected = payMethods.includes('credit');
    if (debtSelected && isOneTime) {
      setIsAddCustomerOpen(true);
      return fail('Walk-in retail customers cannot buy on debt. Please register this customer or select an existing customer.');
    }
    if (overLimitBlocked) return fail('This sale puts the customer over their debt limit — owner approval required.');

    if (isSplitPay) {
      for (const m of payMethods) {
        if (parseFromCommas(payAmounts[m] || '') <= 0) {
          return fail('Each selected payment method needs an amount greater than zero.');
        }
      }
      if (!isSplitBalanced) {
        return fail(`Split payments must equal total (${formatNaira(cartTotal)}) exactly. Currently assigned: ${formatNaira(splitTotalAssigned)}.`);
      }
    }

    const splits: PaymentSplit[] | undefined = isSplitPay
      ? payMethods.map(m => ({
        method: m,
        amount: parseFromCommas(payAmounts[m] || ''),
        credit_term_days: m === 'credit' ? creditTermDays : undefined,
        due_date: m === 'credit' ? effectiveDueDate.toISOString() : undefined
      }))
      : undefined;

    const result = createSale({
      customerId: customer.id,
      paymentMethod: isSplitPay ? 'split' : payMethods[0],
      paymentSplits: splits,
      creditTermDays: debtSelected ? creditTermDays : undefined,
      dueDate: debtSelected ? effectiveDueDate.toISOString() : undefined,
      amountTendered: null,
      note: note.trim() || undefined,
      pricingTier: customer?.type || 'retail',
      date: showBackdate ? fromDatetimeLocalValue(saleDateInput) : undefined,
      lines: lines.map(l => ({
        productId: l.productId,
        varietyId: l.varietyId,
        packSizeId: l.packSizeId,
        qty: l.qty,
        containerMode: l.containerMode,
        overrideUnitPrice: l.overrideUnitPrice,
        priceAdjustReason: l.priceAdjustReason || undefined,
        kegOnly: l.kegOnly,
        pumpId: l.pumpId
      }))
    });

    if (!result.success) {
      const errMsg = result.error || 'Could not record the sale.';
      setError(errMsg);
      showToast('error', errMsg);
      return;
    }
    showToast('success', `Sale recorded for ${customer?.name || 'customer'}: ${formatNaira(cartTotal)}.`);
    setLines([]);
    setPayMethods(['cash']);
    setPayAmounts({});
    setNote('');
    setShowBackdate(false);
    setSaleDateInput(toDatetimeLocalValue());
  };

  const failGate = (msg: string) => {
    setGateError(msg);
    showToast('error', msg);
  };

  const submitGate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGateError(null);
    const readings: Record<string, number> = {};
    for (const p of targetPumps) {
      const valStr = gateInputs[p.id];
      const v = parseFromCommas(valStr);
      if (!valStr || !Number.isFinite(v) || v <= 0) {
        failGate(`Enter a valid opening meter reading for ${p.label}.`);
        return;
      }
      if (v < p.last_meter_reading) {
        failGate(`Meter reading for ${p.label} cannot be less than previous reading (${p.last_meter_reading.toLocaleString()} L). Pumps only count up.`);
        return;
      }
      readings[p.id] = v;
    }

    if (!activeShift) {
      const cashier = currentCashierName;
      const res = startShift({
        cashierName: cashier,
        openingFloat: 0,
        notes: 'Morning shift opened with verified pump readings',
        openingReadings: readings
      });
      if (!res.success) {
        failGate(res.error || 'Could not start shift.');
        return;
      }
      showToast('success', `Shift started for ${cashier}.`);
    } else {
      const res = recordShiftOpeningReadings(readings);
      if (!res.success) {
        failGate(res.error || 'Could not save the readings.');
        return;
      }
      showToast('success', 'Opening pump readings saved.');
    }
  };

  const failCloseShift = (msg: string) => {
    setCloseShiftError(msg);
    showToast('error', msg);
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    setCloseShiftError(null);

    const counted = parseFromCommas(closeShiftCashCounted);
    if (isNaN(counted) || counted < 0 || !closeShiftCashCounted.trim()) {
      failCloseShift('Please enter a valid physical cash amount counted in the drawer.');
      return;
    }

    const closingReadings: Record<string, number> = {};
    for (const p of targetPumps) {
      const valStr = closeShiftPumpInputs[p.id];
      const val = parseFromCommas(valStr);
      const opening = activeShift.opening_readings?.[p.id] ?? p.last_meter_reading ?? 0;
      if (!valStr || isNaN(val) || val <= 0) {
        failCloseShift(`Please enter a valid closing reading for ${p.label}.`);
        return;
      }
      if (val < opening) {
        failCloseShift(`Closing meter for ${p.label} (${val.toLocaleString()} L) cannot be less than opening reading (${opening.toLocaleString()} L). Pumps only count up.`);
        return;
      }
      closingReadings[p.id] = val;
    }

    const res = closeShift({
      shiftId: activeShift.id,
      cashCounted: counted,
      closingReadings,
      notes: closeShiftNotes.trim() || undefined
    });

    if (!res.success) {
      failCloseShift(res.error || 'Failed to end shift.');
      return;
    }

    showToast('success', 'Shift closed successfully.');
    setIsCloseShiftModalOpen(false);
    setCloseShiftCashCounted('');
    setCloseShiftPumpInputs({});
    setCloseShiftNotes('');
  };

  // ---- Recent Transactions List for in-page view ----
  const recentTransactions = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(sale => {
        const saleLines = orders.filter(o => o.sale_id === sale.id);
        const total = saleLines.reduce((s, l) => s + l.line_amount, 0);
        const cust = customers.find(c => c.id === sale.customer_id) || null;
        return {
          sale,
          lines: saleLines,
          total,
          customer: cust,
          customerName: cust?.name || 'Walk-in Customer'
        };
      })
      .filter(item => {
        if (!txnSearch.trim()) return true;
        const q = txnSearch.toLowerCase();
        return (
          item.customerName.toLowerCase().includes(q) ||
          item.sale.id.toLowerCase().includes(q) ||
          item.sale.payment_method.toLowerCase().includes(q) ||
          item.lines.some(l => l.variety_name.toLowerCase().includes(q) || l.product_id.toLowerCase().includes(q))
        );
      });
  }, [sales, orders, customers, txnSearch]);

  const handlePrintReceipt = (item: (typeof recentTransactions)[0]) => {
    const first = item.lines[0];
    if (!first || !item.customer) return;
    const receipt: ReceiptData = {
      receiptNumber: item.sale.id.replace('sale-', 'REC-'),
      type: 'order',
      date: item.sale.date,
      customer: item.customer,
      sale: item.sale,
      lines: item.lines,
      order: first,
      product: products.find(p => p.id === first.product_id),
      packLabel: packShort(first.pack_size_id),
      varietyName: first.variety_name,
      pricingTier: first.pricing_tier,
      amountTendered: item.sale.amount_tendered ?? null,
      changeDue: item.sale.change_due ?? null,
      paymentMethod: item.sale.payment_method,
      previousBalance: 0,
      newBalance: item.lines.reduce((s, l) => s + Math.max(0, l.line_amount - (l.paid_amount || 0)), 0),
      cashierName: item.sale.cashier_name || 'Depot Cashier'
    };
    setActiveReceipt(receipt);
  };

  if (!customer || !product) {
    return (
      <div className="max-w-md mx-auto py-16 text-center text-sm text-slate-500">
        Add at least one customer and one product (with prices in Inventory) to record a sale.
      </div>
    );
  }

  return (
    <div className="pb-28 split:pb-8">
      {/* Mandatory Opening Meter Gate Modal */}
      <Modal
        isOpen={gateBlocked}
        onClose={() => { }}
        hideCloseButton
        size="xl"
        title={
          <span className="flex items-center gap-2.5 text-slate-900 dark:text-white font-heading font-bold text-base">
            <span className="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
              <GasPump className="w-4 h-4" weight="bold" />
            </span>
            <span>{!activeShift ? 'Start Shift & Input Pump Readings' : 'Input Opening Pump Readings'}</span>
          </span>
        }
        subtitle={
          <div className="space-y-1 mt-0.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {!activeShift
                ? 'Please enter opening pump readings to start sales.'
                : `Shift active. Verify pump readings to unlock the sales terminal.`}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold">
                <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>Shift Window: {settings.shift_start_time || '07:00'} – {settings.shift_end_time || '18:00'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 font-sans text-[11px] font-bold border border-brand-200 dark:border-brand-800">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Staff: {currentCashierName}</span>
              </span>
            </div>
          </div>
        }
      >
        <form onSubmit={submitGate} className="space-y-3">
          {!activeShift && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Cashier / Staff on Duty *
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    Account Login
                  </span>
                </div>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={currentCashierName}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-not-allowed select-none shadow-2xs"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Verified account login (non-editable for accountability).</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <GasPump className="w-4 h-4 text-brand-500" weight="bold" />
                <span>Pumps Meter Readings ({targetPumps.length} Active Pumps)</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Check physical pump counter
              </span>
            </div>

            <div className="space-y-1.5">
              {targetPumps.map((p, idx) => {
                const prod = products.find(pr => pr.id === p.product_id);
                return (
                  <div
                    key={p.id}
                    className="p-2.5 sm:px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-brand-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-heading font-black text-sm shrink-0">
                        P{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
                          <span className="truncate">{p.label}</span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold shrink-0">
                            {prod?.name || 'Bulk Oil'}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>Inspect physical pump meter</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 sm:w-60">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={gateInputs[p.id] ?? ''}
                          onChange={e => setGateInputs(prev => ({ ...prev, [p.id]: formatWithCommas(e.target.value) }))}
                          placeholder="Enter meter reading..."
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm font-mono font-black text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-brand-500 shadow-2xs pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                          L
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {gateError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" weight="bold" />
              <span>{gateError}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-heading font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <Check className="w-4 h-4" weight="bold" />
            <span>{!activeShift ? 'Start Shift & Unlock Sales' : 'Confirm Readings & Unlock Sales'}</span>
          </button>
        </form>
      </Modal>

      {/* Mandatory Closing Shift Modal */}
      {/* Mandatory Closing Shift Modal */}
      {isCloseShiftModalOpen && activeShift && liveShiftCash && (
        <Modal
          isOpen
          onClose={() => setIsCloseShiftModalOpen(false)}
          size="lg"
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/30 border border-emerald-500/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shadow-sm shrink-0">
                <Gauge className="w-5 h-5" weight="bold" />
              </div>
              <div>
                <div className="text-slate-900 dark:text-white font-heading font-black text-base sm:text-lg tracking-tight">
                  Take Pump Readings & End Shift
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                  Complete meter reconciliation and cash drawer handover
                </div>
              </div>
            </div>
          }
          subtitle={
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-sans font-semibold text-xs shadow-2xs">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Cashier: {activeShift.cashier_name || currentUser?.full_name || 'Staff'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono text-xs">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Started: {formatDepotTime(activeShift.start_time)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-sans font-semibold text-xs">
                <GasPump className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{targetPumps.length} Active {targetPumps.length === 1 ? 'Pump' : 'Pumps'}</span>
              </span>
            </div>
          }
        >
          <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
            {/* Step 1: Physical Meter Readings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs">
                    1
                  </span>
                  <div>
                    <h3 className="text-sm font-heading font-bold text-slate-900 dark:text-white">
                      Physical Pump Meter Readings
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                      Inspect pump physical counters and enter the exact numerical digits
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-sans font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Must Check Physical Meters
                </span>
              </div>

              <div className="space-y-2.5">
                {targetPumps.map((p, idx) => {
                  const currentInput = closeShiftPumpInputs[p.id] ?? '';
                  const prod = products.find(pr => pr.id === p.product_id);

                  return (
                    <div
                      key={p.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-800 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Left: Pump identity */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-heading font-black text-xs flex items-center justify-center shrink-0">
                          P{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span>{p.label}</span>
                            <span className="text-[10px] font-sans uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                              {prod?.name || 'Bulk Oil'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                            Enter current mechanical / digital counter value
                          </div>
                        </div>
                      </div>

                      {/* Right: Blank, tactile input */}
                      <div className="relative w-full sm:w-52 shrink-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={currentInput}
                          onChange={e => setCloseShiftPumpInputs(prev => ({ ...prev, [p.id]: formatWithCommas(e.target.value) }))}
                          placeholder="Enter current meter..."
                          className="w-full pl-3.5 pr-8 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm font-mono font-black text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                          L
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Cash Drawer Reconciliation */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs">
                    2
                  </span>
                  <div>
                    <h3 className="text-sm font-heading font-bold text-slate-900 dark:text-white">
                      Cash Drawer Count & Reconciliation
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                      Count physical notes in the till drawer and enter total
                    </p>
                  </div>
                </div>
              </div>

              {/* Physical Cash Count Input - Strictly Accountable, NO Auto-Fill */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-sans font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Physical Cash Counted in Drawer (NGN) *
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-lg">₦</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={closeShiftCashCounted}
                    onChange={e => setCloseShiftCashCounted(formatWithCommas(e.target.value))}
                    placeholder="Type actual cash counted in till (e.g. 500,000)..."
                    className="w-full pl-9 pr-14 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono tabular-nums text-lg font-black focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">NGN</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                  Staff accountability: Count all physical notes in till drawer before entering total.
                </p>
              </div>

              {/* Live Reconciliation Feedback Banner (Only shown once cashier enters their count) */}
              {closeShiftCashCounted.trim() !== '' && liveCloseVariance !== null && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs font-sans flex items-center justify-between transition-all ${Math.abs(liveCloseVariance) < 0.01
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : liveCloseVariance < 0
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                      : 'bg-sky-50 dark:bg-sky-950/50 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200'
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">
                      {Math.abs(liveCloseVariance) < 0.01 ? '✓' : liveCloseVariance < 0 ? '⚠' : 'ℹ'}
                    </span>
                    <div>
                      <div className="font-bold">
                        {Math.abs(liveCloseVariance) < 0.01
                          ? 'Till is Perfectly Balanced'
                          : liveCloseVariance < 0
                            ? 'Cash Shortage Detected'
                            : 'Cash Surplus Detected'}
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5">
                        {Math.abs(liveCloseVariance) < 0.01
                          ? `Drawer cash matches expected sales (${formatNaira(liveShiftCash.expectedCash)}) exactly.`
                          : liveCloseVariance < 0
                            ? `Count is ₦${Math.abs(liveCloseVariance).toLocaleString()} less than expected (${formatNaira(liveShiftCash.expectedCash)}).`
                            : `Count is ₦${liveCloseVariance.toLocaleString()} more than expected (${formatNaira(liveShiftCash.expectedCash)}).`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-black text-sm tabular-nums">
                      {liveCloseVariance >= 0 ? `+${formatNaira(liveCloseVariance)}` : `-${formatNaira(Math.abs(liveCloseVariance))}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Handover Notes */}
              <div>
                <label className="block text-xs font-sans font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Handover Notes (Optional)
                </label>
                <input
                  type="text"
                  value={closeShiftNotes}
                  onChange={e => setCloseShiftNotes(e.target.value)}
                  placeholder="Notes for next shift or supervisor (e.g. key handover, safe cash drops)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-sans text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
                />
              </div>
            </div>

            {closeShiftError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" weight="bold" />
                <span>{closeShiftError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-sans font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel / Keep Open
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" weight="bold" />
                <span>Confirm Readings & End Shift</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* PREVIOUS TRANSACTION VIEW (IN THIS PAGE)                                   */}
      {/* ========================================================================= */}
      {showPreviousTransactions ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              id="btn-back-to-new-sale"
              onClick={() => setShowPreviousTransactions(false)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200 text-xs font-sans font-bold transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-brand-600 dark:text-brand-400" weight="bold" />
              <span>Back to New Sale</span>
            </button>

            {onNavigate && (
              <button
                type="button"
                id="btn-goto-ledger"
                onClick={() => onNavigate('ledger')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-sans font-bold shadow-sm transition-all"
              >
                <span>Full Ledger</span>
                <ArrowSquareOut className="w-3.5 h-3.5" weight="bold" />
              </button>
            )}
          </div>
          <div className="depot-card p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txnSearch}
                  onChange={e => setTxnSearch(e.target.value)}
                  placeholder="Search previous transactions by customer or order..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-sans focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Showing <b>{recentTransactions.length}</b> transaction{recentTransactions.length === 1 ? '' : 's'}</span>
              </div>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <ClockCounterClockwise className="w-8 h-8 text-slate-400" />
                <p>No previous transactions found{txnSearch ? ' matching your search' : ' yet'}.</p>
                <button
                  onClick={() => setShowPreviousTransactions(false)}
                  className="mt-2 text-brand-600 dark:text-brand-400 font-bold hover:underline"
                >
                  Create a new sale →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentTransactions.map(item => (
                  <div
                    key={item.sale.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 -mx-4 px-4 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                          {item.customerName}
                        </span>
                        {(() => {
                          const theme = getPaymentModeTheme(item.sale.payment_method);
                          return (
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono uppercase px-2 py-0.5 rounded-md border tracking-wider ${theme.badgeCls}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${theme.dotCls} shrink-0`} />
                              <span>{theme.badgeLabel}</span>
                            </span>
                          );
                        })()}
                        <span className="text-xs font-mono text-slate-400">
                          {formatDepotDate(item.sale.date)} · {formatDepotTime(item.sale.date)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {item.lines.length > 0 ? (
                          item.lines.map((l, idx) => (
                            <span key={l.id}>
                              {idx > 0 && ' · '}
                              {l.qty} × {packShort(l.pack_size_id)} {l.variety_name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">Standard counter sale</span>
                        )}
                      </div>

                      {item.sale.cashier_name && (
                        <div className="text-xs text-slate-400">
                          Cashier: <span className="text-slate-600 dark:text-slate-300">{item.sale.cashier_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <div className="font-mono font-extrabold text-base text-slate-900 dark:text-white">
                          {formatNaira(item.total)}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {item.sale.id.replace('sale-', 'REC-')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-sans font-semibold transition-colors"
                        title="Reprint receipt"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* STANDARD NEW SALE BUILDER                                                 */
        /* ========================================================================= */
        <div>
          <div className="grid grid-cols-1 split:grid-cols-12 gap-5">
            {/* ---------- BUILDER COLUMN (LEFT) ---------- */}
            <div className="split:col-span-8 space-y-5">
              {/* Card 1: Customer Selection (2 Options) */}
              <section className="depot-card p-2.5 space-y-1.5">
                <StepBadge n={1} label="Customer Selection" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-stretch">
                  {/* Option 1: Big One-time Customer button (Full Height) */}
                  <button
                    type="button"
                    id="btn-onetime-customer"
                    onClick={() => {
                      setCustomerId(ONE_TIME_CUSTOMER_ID);
                      setCustomerOpen(false);
                      setCustomerSearch('');
                    }}
                    className={`h-full min-h-[44px] p-2 rounded-xl border-2 transition-all flex items-center gap-2 text-left group cursor-pointer ${isOneTime
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-sm ring-2 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400/60 text-slate-800 dark:text-slate-200'
                      }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 ${isOneTime
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'
                      }`}>
                      <ShoppingCart className="w-3.5 h-3.5" weight="bold" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-heading font-extrabold text-xs leading-tight">
                          One-time Customer
                        </span>
                        {isOneTime && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-sans font-bold text-[9px] uppercase tracking-wider shadow-xs shrink-0">
                            Active ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans leading-snug truncate">
                        Walk-in · Immediate Settlement (No Debt)
                      </p>
                    </div>
                  </button>

                  {/* Option 2: Beside it - Previous Customer Dropdown & Add Customer */}
                  <div className={`p-2 rounded-xl border-2 transition-all flex flex-col justify-center gap-1 ${!isOneTime && customer
                    ? 'bg-brand-50/30 dark:bg-brand-950/20 border-brand-500/80 shadow-sm ring-2 ring-brand-500/10'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}>
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Users className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                        <span>Registered Customer</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddCustomerOpen(true);
                          setCustomerOpen(false);
                          setNewCustName(customerSearch.trim());
                          setAddCustomerError(null);
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 text-[10px] font-sans font-extrabold shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3 h-3" weight="bold" />
                        <span>Add</span>
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        value={
                          customerOpen
                            ? customerSearch
                            : !isOneTime && customer
                              ? customer.name
                              : ''
                        }
                        onChange={e => {
                          setCustomerSearch(e.target.value);
                          setCustomerOpen(true);
                        }}
                        onFocus={() => {
                          setCustomerOpen(true);
                          setCustomerSearch('');
                        }}
                        placeholder="Search previous customer..."
                        className="w-full pl-7 pr-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-sans font-bold focus:outline-none focus:border-brand-500 shadow-2xs"
                      />

                      {customerOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setCustomerOpen(false)} />
                          <div className="absolute z-20 mt-1.5 w-full max-h-64 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredCustomers
                              .filter(c => c.id !== ONE_TIME_CUSTOMER_ID)
                              .map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setCustomerId(c.id);
                                    setCustomerOpen(false);
                                    setCustomerSearch('');
                                  }}
                                  className={`w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer ${c.id === customerId ? 'bg-brand-50 dark:bg-brand-950/40 font-bold text-brand-900 dark:text-brand-300' : ''
                                    }`}
                                >
                                  <div className="min-w-0">
                                    <span className="font-sans font-semibold text-slate-800 dark:text-slate-200 block truncate">
                                      {c.name}
                                    </span>
                                    {c.phone && c.phone !== '—' && (
                                      <span className="text-[10px] font-mono text-slate-400">{c.phone}</span>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                                      {c.type}
                                    </span>
                                    {(customerStatsMap[c.id]?.currentBalance || 0) > 0 && (
                                      <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400">
                                        {formatNaira(customerStatsMap[c.id]?.currentBalance || 0)}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))}

                            {filteredCustomers.filter(c => c.id !== ONE_TIME_CUSTOMER_ID).length === 0 && (
                              <div className="px-4 py-3 text-xs text-slate-400 text-center font-sans">
                                No accounts found. Click "+ Add Customer" above to create!
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {!isOneTime && customer && (
                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-slate-500">
                        <span>
                          Balance:{' '}
                          <strong className={(customerStats?.currentBalance || 0) > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'}>
                            {formatNaira(customerStats?.currentBalance || 0)}
                          </strong>
                        </span>
                        <span>Limit: <strong>{formatNaira(customer.credit_limit || 0)}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Card 2: Item builder */}
              <section className="depot-card p-4 space-y-4">
                <StepBadge n={2} label="Add an item" />

                {/* product selector */}
                <div className="flex flex-wrap gap-2">
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectProduct(p.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-sans font-semibold border transition-all ${p.id === product.id && !isKegOnlyMode
                        ? 'bg-brand-500 text-slate-950 border-brand-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                        }`}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if (isKegOnlyMode) {
                        setIsKegOnlyMode(false);
                        setPackSizeId('');
                        setQty(1);
                        setOverrideOn(false);
                        setOverrideValue('');
                        setPriceReason('');
                      } else {
                        selectSellKegs();
                      }
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-sans font-bold border transition-all cursor-pointer ${isKegOnlyMode
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                      }`}
                  >
                    <Package className="w-4 h-4 text-amber-500" weight="bold" />
                    <span>Sell Empty Kegs</span>
                  </button>
                </div>

                {/* When Selling Empty Kegs: Dedicated 25L Keg Counter Stepper */}
                {isKegOnlyMode ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-300">
                          <Package className="w-5 h-5" weight="bold" />
                        </div>
                        <div>
                          <div className="text-sm font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>25L Company Keg</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold">
                              Standard 25L Keg
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                            Outright empty keg purchase • No oil included
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-sans">Unit Price</div>
                        <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                          {formatNaira(preview?.containerUnitPrice ?? 3000)}
                        </div>
                      </div>
                    </div>

                    {/* Stepper with + and - buttons to increase or decrease the number purchased */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-sans font-medium text-slate-700 dark:text-slate-300">
                          Number of Kegs:
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                          {qty} {qty === 1 ? 'keg' : 'kegs'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setQty(q => Math.max(1, q - 1))}
                          className="w-12 h-12 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 active:scale-95 transition-all shadow-sm cursor-pointer"
                          aria-label="Decrease keg quantity"
                        >
                          <Minus className="w-5 h-5" weight="bold" />
                        </button>

                        <div className="relative flex-1">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={qty}
                            onFocus={() => {
                              setShowNumpad(true);
                              setNumpadTarget('qty');
                            }}
                            onChange={e => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                            className="w-full text-center py-2.5 rounded-xl bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 font-mono font-black text-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setQty(q => q + 1)}
                          className="w-12 h-12 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 active:scale-95 transition-all shadow-sm cursor-pointer"
                          aria-label="Increase keg quantity"
                        >
                          <Plus className="w-5 h-5" weight="bold" />
                        </button>

                        {/* Quick Pad toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowNumpad(prev => !prev || numpadTarget !== 'qty');
                            setNumpadTarget('qty');
                          }}
                          className={`px-3 py-3 rounded-xl border text-xs font-sans font-bold flex items-center gap-1.5 transition-all cursor-pointer ${showNumpad && numpadTarget === 'qty'
                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                            }`}
                          title="Open number pad"
                        >
                          <Calculator className="w-4 h-4" weight="bold" />
                          <span>Pad</span>
                        </button>
                      </div>

                      {/* Quick Quantity Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] text-slate-400 font-sans mr-1">Quick:</span>
                        {[1, 5, 10, 20, 50, 100].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setQty(n)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${qty === n
                              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Interactive Number Pad if open */}
                    {showNumpad && (
                      <div className="pt-1">
                        <MiniNumberPad
                          qty={qty}
                          onQtyChange={setQty}
                          price={preview?.containerUnitPrice ?? 3000}
                          onPriceChange={() => { }}
                          standardPrice={preview?.containerUnitPrice ?? 3000}
                          onResetPrice={() => { }}
                          activeTarget="qty"
                          onTargetChange={setNumpadTarget}
                          onClose={() => setShowNumpad(false)}
                        />
                      </div>
                    )}

                    {preview?.unpriced && (
                      <div className="text-xs text-rose-600 dark:text-rose-400">
                        No empty-keg buy price configured for {product.name}. Set it in the Inventory tab (25L pack size) to sell empty kegs.
                      </div>
                    )}

                    {/* Cost Summary & Add to Sale Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-amber-500/20">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 font-sans">Subtotal</div>
                        <div className="text-base font-mono font-black text-slate-900 dark:text-white">
                          {formatNaira((preview?.containerUnitPrice ?? 3000) * qty)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={addLine}
                        disabled={!canAddLine}
                        className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-sans font-bold text-xs flex items-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" weight="bold" />
                        <span>Add {qty} Empty Keg{qty > 1 ? 's' : ''} to Sale</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* dispensing pump selector — bulk (tank + pump) products only.
                        Independent of variety, so it comes first regardless of
                        which variety/pack size gets picked below. */}
                    {productPumps.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
                          <GasPump className="w-3.5 h-3.5" />
                          <span>Dispensing Pump</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {productPumps.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPumpId(p.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-semibold border transition-colors cursor-pointer ${p.id === pumpId
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                                }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Every variety of this product, each with its own full
                        pack-size/price grid shown at once — no need to pick a
                        variety first. Picking any size tile selects that
                        variety + pack size together. */}
                    {productPumps.length > 0 && !pumpId ? (
                      <div className="text-xs text-slate-400 dark:text-slate-500 italic">Select a dispensing pump to continue.</div>
                    ) : sellableSizes.length === 0 ? (
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        This product has no pack sizes set. Configure them in the Inventory tab.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(tankStockByProduct[product.id]?.totalLitres ?? 0) > 0 && (
                          <div className="flex items-center justify-end text-[11px] font-mono text-slate-400">
                            <Drop className="w-3 h-3 text-amber-500 mr-1" weight="fill" />
                            {tankStockByProduct[product.id].totalLitres.toLocaleString('en-US', { maximumFractionDigits: 0 })} L in tank
                          </div>
                        )}
                        {product.varieties.map(v => {
                          const varietyActive = v.id === varietyId;
                          return (
                            <div key={v.id} className="space-y-2">
                              <div className={`flex items-center gap-2 text-xs font-sans font-extrabold uppercase tracking-wider ${varietyActive ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
                                }`}>
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${varietyActive ? 'bg-brand-500/15 dark:bg-brand-500/20' : 'bg-slate-100 dark:bg-slate-800'
                                  }`}>
                                  <Jar className="w-3 h-3" weight={varietyActive ? 'fill' : 'duotone'} />
                                </span>
                                <span>{v.name}</span>
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 lg:grid-cols-9 gap-1.5">
                                {sellableSizes.map(s => {
                                  const linePrice = priceSaleLine({
                                    product,
                                    varietyId: v.id,
                                    packSizeId: s.id,
                                    tier,
                                    qty: 1,
                                    containerMode: 'none',
                                    packPrices
                                  });
                                  const selected = varietyActive && s.id === packSizeId;
                                  const Icon = packSizeIcon(s.litres);
                                  const inCart = cartQtyForPack(v.id, s.id);
                                  return (
                                    <div key={s.id} className="relative h-full">
                                      {/* Quick add — one tap drops this pack straight into the
                                          sale (merging into an identical line). Tapping the card
                                          itself still just selects it for the qty/builder flow. */}
                                      {!isKegOnlyMode && (
                                        <button
                                          type="button"
                                          onClick={() => quickAddPack(v.id, s.id)}
                                          className={`absolute bottom-1 right-1 z-20 w-5 h-5 rounded-full border flex items-center justify-center shadow-sm transition-colors cursor-pointer ${inCart > 0
                                            ? 'bg-emerald-500 border-emerald-400 text-white'
                                            : 'bg-slate-700/80 border-slate-500 text-slate-100 hover:bg-brand-500 hover:border-brand-400'
                                            }`}
                                          title={inCart > 0
                                            ? `${inCart} × ${s.short} already in this sale — add one more`
                                            : `Quick add one ${s.short} to the sale`}
                                          aria-label={`Quick add one ${s.short}`}
                                        >
                                          {inCart > 0 ? (
                                            <span className="text-[9px] font-mono font-bold leading-none">{inCart}</span>
                                          ) : (
                                            <MagicWand className="w-2.5 h-2.5" weight="bold" />
                                          )}
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => { setVarietyId(v.id); setPackSizeId(s.id); }}
                                        className={`w-full relative rounded-xl border-2 text-center transition-all duration-150 flex flex-col h-full overflow-hidden cursor-pointer hover:scale-[1.03] hover:-translate-y-0.5 hover:z-10 hover:shadow-md ${selected
                                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/50 shadow-glow-brand ring-2 ring-brand-500/20'
                                        : 'border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900 hover:border-brand-300 dark:hover:border-brand-600/60'
                                        }`}
                                    >
                                      {selected && (
                                        <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-xs z-10">
                                          <Check className="w-2 h-2" weight="bold" />
                                        </span>
                                      )}
                                      <div className="flex flex-col items-center justify-center gap-1 p-1.5 pb-1 min-h-[64px]">
                                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${selected
                                          ? 'bg-brand-500 text-white shadow-xs'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                          }`}>
                                          <Icon className="w-4 h-4" weight={selected ? 'fill' : 'duotone'} />
                                        </span>
                                        <span className="text-xs font-sans font-extrabold text-slate-900 dark:text-white leading-tight truncate max-w-full">{s.short}</span>
                                      </div>

                                      <div className={`mt-auto px-1 py-1 border-t text-center ${selected
                                        ? 'bg-brand-600 border-brand-700/60'
                                        : 'bg-slate-900 dark:bg-black/40 border-slate-800/60'
                                        }`}>
                                        <span className="text-[11px] font-mono font-bold tracking-tight">
                                          {linePrice.unpriced ? (
                                            <span className="text-amber-400">no price</span>
                                          ) : (
                                            <span className="text-emerald-300">
                                              {formatNaira(linePrice.unitPrice)}
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {packSizeId && preview && (
                      <div className="space-y-3.5 pt-1">
                        {/* qty stepper + number pad */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-16">Quantity</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setQty(q => Math.max(1, q - 1))}
                                className="w-10 h-10 rounded-xl border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer"
                              >
                                <Minus className="w-4 h-4" weight="bold" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={qty}
                                onFocus={() => {
                                  setShowNumpad(true);
                                  setNumpadTarget('qty');
                                }}
                                onChange={e => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                                className="w-20 text-center py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 font-mono font-black text-base focus:border-brand-500"
                              />
                              <button
                                type="button"
                                onClick={() => setQty(q => q + 1)}
                                className="w-10 h-10 rounded-xl border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer"
                              >
                                <Plus className="w-4 h-4" weight="bold" />
                              </button>

                              {/* Quick Number Pad Toggle */}
                              <button
                                type="button"
                                onClick={() => {
                                  setShowNumpad(prev => !prev || numpadTarget !== 'qty');
                                  setNumpadTarget('qty');
                                }}
                                className={`px-2.5 py-1.5 rounded-xl border text-xs font-sans font-bold flex items-center gap-1.5 transition-all cursor-pointer ${showNumpad && numpadTarget === 'qty'
                                  ? 'bg-brand-500 text-slate-950 border-brand-500 shadow-sm'
                                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                                  }`}
                                title="Open number pad for quick entry"
                              >
                                <Calculator className="w-4 h-4" weight="bold" />
                                <span>Pad</span>
                              </button>
                            </div>
                            <span className="text-xs text-slate-400 font-mono">{preview.litres.toLocaleString()} L</span>
                          </div>

                          {/* Quick Qty Preset Pills */}
                          <div className="flex items-center gap-1 pl-[76px] flex-wrap">
                            {[5, 10, 20, 25, 50, 100].map(n => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setQty(n)}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer ${qty === n
                                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                                  }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* keg disposition — automatic, not a manual choice any more */}
                        {isReturnable && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <Package className="w-3.5 h-3.5" />
                            <span>Company keg goes out on loan (returnable) — use Sell Empty Kegs to sell one outright.</span>
                          </div>
                        )}

                        {/* price (directly editable) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-16">Unit Price</span>
                            <div className="flex items-center gap-2">
                              <div className="relative w-44">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-sm">
                                  ₦
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={overrideOn ? formatWithCommas(overrideValue) : formatWithCommas(preview.matrixUnitPrice != null ? preview.matrixUnitPrice : preview.unitPrice)}
                                  onFocus={() => {
                                    setShowNumpad(true);
                                    setNumpadTarget('price');
                                    if (!overrideOn) {
                                      setOverrideOn(true);
                                      setOverrideValue(formatWithCommas(preview.matrixUnitPrice ?? preview.unitPrice ?? ''));
                                    }
                                  }}
                                  onChange={e => {
                                    setOverrideOn(true);
                                    setOverrideValue(formatWithCommas(e.target.value));
                                  }}
                                  placeholder="0"
                                  className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-black text-base text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                                />
                              </div>
                              <span className="text-xs text-slate-400 font-sans">/ {packShort(packSizeId)}</span>

                              {/* Price Pad Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setShowNumpad(prev => !prev || numpadTarget !== 'price');
                                  setNumpadTarget('price');
                                  if (!overrideOn) {
                                    setOverrideOn(true);
                                    setOverrideValue(String(preview.matrixUnitPrice ?? preview.unitPrice ?? ''));
                                  }
                                }}
                                className={`p-1.5 rounded-xl border text-xs font-sans font-bold flex items-center gap-1 transition-all cursor-pointer ${showNumpad && numpadTarget === 'price'
                                  ? 'bg-brand-500 text-slate-950 border-brand-500 shadow-sm'
                                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                  }`}
                                title="Edit price using number pad"
                              >
                                <Calculator className="w-4 h-4" weight="bold" />
                              </button>

                              {overrideOn && preview.priceAdjusted && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOverrideOn(false);
                                    setOverrideValue('');
                                    setPriceReason('');
                                  }}
                                  className="text-xs font-sans text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  title="Reset back to standard tier rate"
                                >
                                  ↺ Reset standard
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Mandatory Price Override Feedback with Glowing Compulsory Input */}
                          {preview.priceAdjusted && (
                            <div className="pl-[76px] space-y-1.5 text-xs">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-sans font-medium text-[11px]">
                                  Custom rate (Standard: {formatNaira(preview.matrixUnitPrice ?? 0)})
                                </span>
                                <div className="relative flex-1 min-w-[210px] max-w-sm">
                                  <input
                                    type="text"
                                    required
                                    value={priceReason}
                                    onChange={e => setPriceReason(e.target.value)}
                                    placeholder="Reason note (Required)*"
                                    className={`w-full px-3 py-1.5 rounded-xl text-xs font-sans border transition-all duration-300 outline-none ${!priceReason.trim()
                                      ? 'border-amber-500 dark:border-amber-400 bg-amber-50/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 placeholder-amber-700 dark:placeholder-amber-300 ring-2 ring-amber-500/60 shadow-md shadow-amber-500/20 animate-pulse'
                                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-brand-500'
                                      }`}
                                  />
                                </div>
                              </div>
                              {!priceReason.trim() && (
                                <div className="text-[11px] font-sans font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1 animate-pulse">
                                  <span>⚠</span>
                                  <span>Reason note is mandatory for custom rate before adding to sale.</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* INTERACTIVE MINI NUMBER PAD (COLLAPSIBLE / ON-DEMAND) */}
                        {showNumpad && (
                          <div className="pt-1">
                            <MiniNumberPad
                              qty={qty}
                              onQtyChange={setQty}
                              price={overrideOn ? overrideValue : (preview.matrixUnitPrice ?? preview.unitPrice ?? '')}
                              onPriceChange={val => {
                                setOverrideOn(true);
                                setOverrideValue(val);
                              }}
                              standardPrice={preview.matrixUnitPrice}
                              onResetPrice={() => {
                                setOverrideOn(false);
                                setOverrideValue('');
                                setPriceReason('');
                              }}
                              activeTarget={numpadTarget}
                              onTargetChange={setNumpadTarget}
                              onClose={() => setShowNumpad(false)}
                            />
                          </div>
                        )}

                        {preview.unpriced && (
                          <div className="text-xs text-rose-600 dark:text-rose-400">
                            No matrix price configured for {product.name} / {product.varieties.find(v => v.id === varietyId)?.name} /{' '}
                            {packLabel(packSizeId)} at the {tier} tier. Enter a custom price above to sell.
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                            Line: {formatNaira(preview.lineAmount)}
                          </span>
                          <button
                            onClick={addLine}
                            disabled={!canAddLine}
                            className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-sans font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Plus className="w-4 h-4" weight="bold" />
                            {preview.priceAdjusted && !priceReason.trim() ? 'Reason Required' : 'Add to sale'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>

            {/* ---------- PAYMENT & SUMMARY COLUMN (RIGHT) ---------- */}
            {/* Note: Card 3 is removed. Payment is now Step 3. Sticky + its own
                scroll on desktop so Complete Sale stays reachable while the
                (often much taller) item builder on the left scrolls the page. */}
            <div className="split:col-span-4 space-y-4 split:sticky split:top-4 split:self-start split:max-h-[calc(100vh-7rem)] split:overflow-y-auto">
              {/* Step 3: Payment & Items Summary */}
              <section className="depot-card p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <StepBadge n={3} label="Payment" />
                  <button
                    type="button"
                    id="btn-view-previous-transactions-card"
                    onClick={() => setShowPreviousTransactions(true)}
                    title={`Previous Transactions — ${sales.length} counter transaction${sales.length === 1 ? '' : 's'} on record`}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-brand-50 dark:bg-slate-800 dark:hover:bg-brand-950/50 text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="View previous transactions"
                  >
                    <ClockCounterClockwise className="w-4 h-4" weight="bold" />
                  </button>
                </div>

                {/* Items in Sale (only shown when lines exist, replacing the standalone Card 3) */}
                {lines.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                      <span>Items in Sale ({lines.length})</span>
                      <span className="text-slate-900 dark:text-white font-mono text-xs">{formatNaira(cartTotal)}</span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-slate-200/50 dark:divide-slate-800/60">
                      {lines.map(l => (
                        <div key={l.key} className="space-y-1.5 pt-1.5 first:pt-0">
                          <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-sans font-semibold text-slate-900 dark:text-white truncate">
                              {l.qty} × {packShort(l.packSizeId)} {l.kegOnly ? 'empty keg' : `· ${l.productName}`}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {l.kegOnly ? (
                                `${l.productName} keg · outright sale, no oil`
                              ) : (
                                <>
                                  {l.varietyName}
                                  {l.containerMode === 'taken' && ' · keg taken'}
                                  {l.containerMode === 'bought' && ' · keg bought'}
                                </>
                              )}
                              {l.priceAdjusted && ' · adjusted'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                              {formatNaira(l.lineAmount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLine(l.key)}
                              className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                              aria-label="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          </div>

                          {/* Inline line editing — quantity, counter rate and the audit
                              reason are corrected on the line itself rather than
                              round-tripping back through the item builder. */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateLineQty(l.key, l.qty - 1)}
                                className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3 h-3" weight="bold" />
                              </button>
                              <span className="w-8 text-center text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                                {l.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateLineQty(l.key, l.qty + 1)}
                                className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3 h-3" weight="bold" />
                              </button>
                            </div>

                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">₦</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatWithCommas(l.unitPrice)}
                                onChange={e => updateLinePrice(l.key, e.target.value)}
                                aria-label={`Unit price for ${l.productName}`}
                                className="w-24 pl-5 pr-2 py-1 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                              />
                            </div>

                            {l.priceAdjusted && (
                              <>
                                <input
                                  type="text"
                                  value={l.priceAdjustReason ?? ''}
                                  onChange={e => updateLineReason(l.key, e.target.value)}
                                  placeholder="Rate reason*"
                                  className="flex-1 min-w-[110px] px-2 py-1 rounded-md bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] font-sans text-amber-900 dark:text-amber-200 focus:outline-none focus:border-amber-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => resetLinePrice(l.key)}
                                  className="text-[10px] font-sans font-bold text-brand-600 dark:text-brand-400 hover:underline shrink-0 cursor-pointer"
                                  title="Reset back to the standard tier rate"
                                >
                                  ↺ Standard
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total</span>
                      <span className="text-base font-mono font-extrabold text-slate-900 dark:text-white">
                        {formatNaira(cartTotal)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payment methods — pick one for a full payment, or two or more to split the sale across them. */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    {PAYMENT_METHODS.map(m => {
                      const isSelected = payMethods.includes(m.id);
                      const theme = getPaymentModeTheme(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => togglePayMethod(m.id)}
                          aria-pressed={isSelected}
                          className={`py-1.5 px-2.5 rounded-lg text-xs font-sans font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${isSelected
                            ? theme.buttonActiveCls + ' scale-[1.01]'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${theme.dotCls} shrink-0`} />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                    {isSplitPay && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
                            Allocating Across {payMethods.length} Methods
                          </span>
                          {payMethods.length === 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const half = Math.round(cartTotal / 2);
                                setPayAmounts({
                                  [payMethods[0]]: formatWithCommas(half),
                                  [payMethods[1]]: formatWithCommas(cartTotal - half)
                                });
                              }}
                              className="text-[11px] font-sans font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                            >
                              ⚡ 50 / 50 Split
                            </button>
                          )}
                        </div>

                        {payMethods.map(m => {
                          const theme = getPaymentModeTheme(m);
                          return (
                            <div key={m} className={`p-3 rounded-2xl border space-y-2 ${theme.bgSubtleCls} ${theme.borderCls}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[11px] font-sans font-black uppercase tracking-wider flex items-center gap-1.5 ${theme.textCls}`}>
                                  <span className={`w-2 h-2 rounded-full ${theme.dotCls}`} />
                                  {theme.label}
                                </span>
                                <div className="flex items-center gap-1">
                                  {[0.25, 0.5, 0.75].map(pct => (
                                    <button
                                      key={pct}
                                      type="button"
                                      onClick={() => {
                                        if (cartTotal > 0) {
                                          setPayAmounts(prev => ({ ...prev, [m]: formatWithCommas(Math.round(cartTotal * pct)) }));
                                        }
                                      }}
                                      className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:text-brand-600 cursor-pointer"
                                    >
                                      {pct * 100}%
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => autoBalanceMethod(m)}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-sans font-bold bg-white dark:bg-slate-950 text-brand-600 dark:text-brand-400 border border-slate-200 dark:border-slate-800 hover:border-brand-500 cursor-pointer"
                                    title="Fill in whatever is left once the other methods are counted"
                                  >
                                    Balance
                                  </button>
                                </div>
                              </div>

                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₦</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={payAmounts[m] || ''}
                                  onChange={e => setPayAmounts(prev => ({ ...prev, [m]: formatWithCommas(e.target.value) }))}
                                  placeholder={m === 'credit' ? 'Amount on debt' : 'Amount taken now'}
                                  className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {payMethods.includes('credit') && (
                      isOneTime ? (
                        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2.5">
                          <div className="flex items-start gap-2.5">
                            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-xs font-sans font-bold text-amber-900 dark:text-amber-200">
                                Walk-in Retail Customer Selected
                              </div>
                              <p className="text-[11px] font-sans text-amber-700 dark:text-amber-300 mt-0.5">
                                Walk-in retail sales cannot buy on debt. Please register this customer or select an existing customer account to log this debt.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setIsAddCustomerOpen(true)}
                              className="flex-1 py-2 px-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" weight="bold" />
                              <span>Add New Customer</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomerOpen(true)}
                              className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-sans font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Search className="w-3.5 h-3.5" />
                              <span>Find Existing</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              Debt Grace Period
                            </span>
                            <span className="font-mono font-bold text-xs text-amber-900 dark:text-amber-200">
                              {creditTermDays} Days
                            </span>
                          </div>

                          {/* Quick Days Selector */}
                          <div className="grid grid-cols-4 gap-1.5">
                            {[7, 14, 21, 30].map(days => (
                              <button
                                key={days}
                                type="button"
                                onClick={() => setCreditTermDays(days)}
                                className={`py-1 px-1.5 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${creditTermDays === days
                                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                                  : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                                  }`}
                              >
                                {days}d
                              </button>
                            ))}
                          </div>

                          {/* Custom Days Input */}
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] uppercase font-bold text-slate-500 shrink-0">Custom Days:</label>
                            <input
                              type="number"
                              min="1"
                              max="365"
                              value={creditTermDays}
                              onChange={e => setCreditTermDays(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-20 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                            />
                            <span className="text-[11px] text-slate-500 font-medium">days from {showBackdate ? 'sale date' : 'today'}</span>
                          </div>

                          {/* Live Due Date Badge */}
                          <div className="text-[11px] font-sans text-slate-700 dark:text-slate-300 flex items-center justify-between pt-1.5 border-t border-amber-500/20">
                            <span className="text-slate-500">Due Date:</span>
                            <span className="font-bold text-amber-800 dark:text-amber-300 font-mono">
                              {formatDepotDate(effectiveDueDate.toISOString())}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-500">
                            New balance: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatNaira(projectedBalance)}</span>
                          </div>

                          {overLimit && (
                            <div
                              className={`text-[11px] font-semibold pt-1 ${overLimitBlocked
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                                }`}
                            >
                              {overLimitBlocked
                                ? '⚠ Over debt limit — owner approval required.'
                                : '⚠ Over debt limit (owner override).'}
                            </div>
                          )}
                        </div>
                      )
                    )}

                    {isSplitPay && (
                      <div
                        className={`p-2.5 rounded-xl border text-xs font-sans flex items-center justify-between ${isSplitBalanced
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold'
                          : splitRemaining > 0
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900/60 text-amber-800 dark:text-amber-300'
                            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 font-bold'
                          }`}
                      >
                        <span>
                          {isSplitBalanced
                            ? '✓ Fully Balanced (100%)'
                            : splitRemaining > 0
                              ? 'Remaining to allocate:'
                              : 'Exceeds sale total by:'}
                        </span>
                        <span className="font-mono font-bold tabular-nums">
                          {isSplitBalanced
                            ? formatNaira(cartTotal)
                            : splitRemaining > 0
                              ? formatNaira(splitRemaining)
                              : `+${formatNaira(splitOver)}`}
                        </span>
                      </div>
                    )}

                    {!isSplitPay && cartTotal > 0 && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900/60 text-xs font-sans text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                        <span>Full payment via {getPaymentModeTheme(payMethods[0]).label}</span>
                        <span className="font-mono font-bold tabular-nums">{formatNaira(cartTotal)}</span>
                      </div>
                    )}
                  </div>

                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setShowBackdate(v => !v)}
                    aria-pressed={showBackdate}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-sans font-bold transition-all active:scale-95 ${showBackdate
                      ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-800 text-brand-700 dark:text-brand-400'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                  >
                    <ClockCounterClockwise className="w-3.5 h-3.5" weight="bold" />
                    <span>{showBackdate ? 'Using a specific date & time' : 'Backdate this sale'}</span>
                  </button>
                  {showBackdate && (
                    <input
                      type="datetime-local"
                      value={saleDateInput}
                      onChange={e => setSaleDateInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs"
                    />
                  )}
                </div>

                {error && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  onClick={completeSale}
                  disabled={lines.length === 0 || overLimitBlocked}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" weight="bold" /> Complete sale · {formatNaira(cartTotal)}
                  <ChevronRight className="w-4 h-4" weight="bold" />
                </button>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      <Modal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        title="Add New Customer Account"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-sans font-bold uppercase text-slate-500 mb-1">
              Customer / Business Name *
            </label>
            <input
              type="text"
              required
              value={newCustName}
              onChange={e => setNewCustName(e.target.value)}
              placeholder="e.g. Alh. Babatunde Trading Ltd"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-sans font-semibold focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-sans font-bold uppercase text-slate-500 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={newCustPhone}
                onChange={e => setNewCustPhone(e.target.value)}
                placeholder="+23480..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-bold uppercase text-slate-500 mb-1">
                Customer Category
              </label>
              <select
                value={newCustType}
                onChange={e => setNewCustType(e.target.value as CustomerType)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-sans focus:outline-none focus:border-brand-500"
              >
                <option value="retail">Retail</option>
                <option value="agent">Agent / Wholesaler</option>
                <option value="corporate">Corporate</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-sans font-bold uppercase text-slate-500 mb-1">
                Debt Limit (₦)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={newCustLimit}
                onChange={e => setNewCustLimit(formatWithCommas(e.target.value))}
                placeholder="150,000"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-bold uppercase text-slate-500 mb-1">
                Credit Terms (Days)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={newCustTerms}
                onChange={e => setNewCustTerms(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {addCustomerError && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
              {addCustomerError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddCustomerOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-sans font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-xs shadow-sm flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" weight="bold" />
              <span>Save & Select</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default NewOrderScreen;
