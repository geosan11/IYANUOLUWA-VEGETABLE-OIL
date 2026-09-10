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
    packPrices
  } = input;

  const litresPerPack = packLitres(packSizeId);
  const packs = Math.max(0, Number(qty) || 0);
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

  const cfg = product.pack_config.find(c => c.pack_size_id === packSizeId);
  const returnable = cfg?.returnable ?? false;
  const containerUnitPrice = cfg?.container_buy_price ?? product.keg_sell_price ?? 0;

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
