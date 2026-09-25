import { CustomerType, ContainerMode, PackPrice, Product } from '../types';
import { packLitres } from '../constants/config';

/**
 * PRICING — single source of truth for pack-size sale-line pricing.
 *
 * Price is an ABSOLUTE amount per pack, keyed by (product, variety, pack size,
 * customer tier). There is NO per-litre arithmetic and NO hard-coded fallback:
 * an unpriced combination returns `null`, and the caller must surface that.
 */

const round2 = (n: number): number => Number((n || 0).toFixed(2));

/**
 * The depot's own counter (retail) rate per litre: the retail-tier price of a
 * pack whose litre size is known, divided by that pack's litres.
 *
 * Nothing in this app carries a built-in ₦/litre figure. A depot that has not
 * priced a single retail pack gets 0 here, and every caller must read 0 as "not
 * configured" — state the litres, omit the money — instead of quoting a rate
 * the owner never set.
 */
export function retailRatePerLitre(packPrices: PackPrice[]): number {
  for (const pp of packPrices) {
    if (pp.tier !== 'retail' || pp.price <= 0) continue;
    const litres = packLitres(pp.pack_size_id);
    if (litres > 0) return round2(pp.price / litres);
  }
  return 0;
}

/**
 * The same derivation keyed by product id, so litres lost on one product's
 * tank/pump are valued at THAT product's own counter rate rather than at a
 * sibling product's price. A product with no retail pack price is absent from
 * the map (absent = not configured, never 0-as-a-real-rate confusion).
 */
export function retailRatePerLitreByProduct(packPrices: PackPrice[]): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const pp of packPrices) {
    if (pp.tier !== 'retail' || pp.price <= 0) continue;
    if (rates[pp.product_id] !== undefined) continue;
    const litres = packLitres(pp.pack_size_id);
    if (litres > 0) rates[pp.product_id] = round2(pp.price / litres);
  }
  return rates;
}

/** Look up the absolute price for ONE pack. `null` = not priced yet. */
export function lookupPackPrice(
  packPrices: PackPrice[],
  productId: string,
  varietyId: string,
  packSizeId: string,
  tier: CustomerType
): number | null {
  const row = packPrices.find(
    p =>
      p.product_id === productId &&
      p.variety_id === varietyId &&
      p.pack_size_id === packSizeId &&
      p.tier === tier
  );
  return row ? row.price : null;
}

export interface LinePricingInput {
  product: Product;
  varietyId: string;
  packSizeId: string;
  tier: CustomerType;
  qty: number;
  containerMode: ContainerMode;
  /** Staff-entered price for ONE pack. When set and different from the matrix, the line is "price adjusted". */
  overrideUnitPrice?: number | null;
  packPrices: PackPrice[];
  /**
   * Selling the empty container itself — no oil. Zeroes litres and the oil
   * charge entirely; the line is priced purely off the container's buy price
   * (falling back to the product's `keg_sell_price`), same as an outright
   * ('bought') container today, just without any oil riding along.
   */
  kegOnly?: boolean;
}

export interface LinePricingResult {
  packLitres: number;
  litres: number;
  matrixUnitPrice: number | null;
  unitPrice: number;
  priceAdjusted: boolean;
  oilAmount: number;
  returnable: boolean;
  containerUnitPrice: number;
  containerAmount: number;
  lineAmount: number;
  /** True when neither a matrix price nor a valid override is available. */
  unpriced: boolean;
}

/**
 * Resolve every money field for one sale line. Used identically by the New Sale
 * screen (live preview) and `store.createSale` (commit) so the two never drift.
 */
export function priceSaleLine(input: LinePricingInput): LinePricingResult {
  const {
    product,
    varietyId,
    packSizeId,
    tier,
    qty,
    containerMode,
    overrideUnitPrice,
    packPrices,
    kegOnly
  } = input;

  const litresPerPack = packLitres(packSizeId);
  const packs = Math.max(0, Number(qty) || 0);

  const cfg = product.pack_config.find(c => c.pack_size_id === packSizeId);
  const returnable = cfg?.returnable ?? false;
  const containerUnitPrice = cfg?.container_buy_price ?? product.keg_sell_price ?? 0;

  // Selling the empty container itself: no oil at all, priced purely off the
  // container's buy price. Skips the oil pricing matrix entirely.
  if (kegOnly) {
    const containerAmount = round2(packs * containerUnitPrice);
    return {
      packLitres: litresPerPack,
      litres: 0,
      matrixUnitPrice: null,
      unitPrice: 0,
      priceAdjusted: false,
      oilAmount: 0,
      returnable,
      containerUnitPrice: round2(containerUnitPrice),
      containerAmount,
      lineAmount: containerAmount,
      unpriced: containerUnitPrice <= 0
    };
  }

  const litres = round2(packs * litresPerPack);

  const matrixUnitPrice = lookupPackPrice(packPrices, product.id, varietyId, packSizeId, tier);

  const hasOverride =
    overrideUnitPrice !== null &&
    overrideUnitPrice !== undefined &&
    Number.isFinite(Number(overrideUnitPrice)) &&
    Number(overrideUnitPrice) > 0;

  const unitPrice = hasOverride ? Number(overrideUnitPrice) : matrixUnitPrice ?? 0;
  const unpriced = !hasOverride && matrixUnitPrice === null;
  const priceAdjusted =
    matrixUnitPrice !== null && Math.abs(unitPrice - matrixUnitPrice) > 0.001;

  const oilAmount = round2(packs * unitPrice);
  const containerAmount = containerMode === 'bought' ? round2(packs * containerUnitPrice) : 0;
  const lineAmount = round2(oilAmount + containerAmount);

  return {
    packLitres: litresPerPack,
    litres,
    matrixUnitPrice,
    unitPrice: round2(unitPrice),
    priceAdjusted,
    oilAmount,
    returnable,
    containerUnitPrice: round2(containerUnitPrice),
    containerAmount,
    lineAmount,
    unpriced
  };
}
