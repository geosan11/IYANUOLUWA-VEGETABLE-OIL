/**
 * The database's rules for master data, in a form a screen can ask *before* it
 * writes. Every one of these mirrors a real constraint in
 * `supabase/migrations/`, quoted at each function so the two can be compared:
 *
 *   physical_tanks.capacity_litres numeric(12,2) not null check (capacity_litres > 0)   (0001)
 *   physical_tanks.product_id      text not null references products(id)               (0001)
 *   products_bulk_needs_lpt        check (supply_model <> 'bulk_truck' or litres_per_ton is not null)  (0001)
 *
 * Why this exists: a row the database refuses does not fail loudly. The insert
 * comes back 400, the row is already in local state, so the counter keeps
 * showing a tank that no other device will ever see — and the only trace is a
 * console line naming a Postgres constraint. The screens validate first, in
 * words the depot can act on, and the store refuses the same rows again at the
 * boundary in case a caller forgets.
 */
import { numberOrBlank } from './businessLogic';
import type { SupplyModel } from '../types';

/** Either a usable value or the reason there isn't one. */
export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T,>(value: T): Validation<T> => ({ ok: true, value });
const fail = (error: string): Validation<never> => ({ ok: false, error });

/**
 * The smallest capacity the depot accepts, in whole litres. The database's own
 * floor is "greater than zero" (`capacity_litres > 0`); one litre is the
 * smallest whole-litre tank a depot can actually have, and it is what the
 * Capacity inputs offer as their `min`.
 */
export const MIN_TANK_CAPACITY_LITRES = 1;

/**
 * A figure that must be present and positive — blank, "0", "-5", "abc" and
 * "1,0" all fail rather than reaching Postgres. A grouped value ("1,250") is
 * read with `numberOrBlank`, so a typed comma is not truncated to 1.
 */
export function positiveFigure(
  raw: string | number | null | undefined,
  field: string,
  minimum = MIN_TANK_CAPACITY_LITRES
): Validation<number> {
  const shown = raw === null || raw === undefined ? '' : String(raw).trim();
  if (shown === '') {
    return fail(`${field} is required — the database refuses a blank value, so nothing was saved.`);
  }
  const value = numberOrBlank(shown, 0);
  if (!Number.isFinite(value) || value < minimum) {
    return fail(`${field} must be at least ${minimum} (you entered "${shown}").`);
  }
  return ok(value);
}

/** `physical_tanks.capacity_litres ... check (capacity_litres > 0)`. */
export function validateTankCapacity(raw: string | number | null | undefined): Validation<number> {
  return positiveFigure(raw, 'Tank capacity (litres)');
}

/**
 * `physical_tanks.product_id text not null references products(id)`. A blank
 * product id is how a form with no catalogue loaded yet submits, and Postgres
 * answers with a foreign-key violation.
 */
export function validateTankProduct(productId: string | null | undefined): Validation<string> {
  const id = (productId ?? '').trim();
  if (!id) {
    return fail(
      'Choose the product this tank stores — the database refuses a tank with no product, so nothing was saved.'
    );
  }
  return ok(id);
}

/**
 * `products_bulk_needs_lpt check (supply_model <> 'bulk_truck' or litres_per_ton is not null)`,
 * plus `products_litres_per_ton_positive check (litres_per_ton is null or litres_per_ton > 0)`.
 * A pre-kegged product has no density at all, so it is always null and never
 * validated — the depot figure in Settings governs bulk intake anyway.
 */
export function validateProductDensity(
  supplyModel: SupplyModel,
  raw: string | number | null | undefined
): Validation<number | null> {
  if (supplyModel !== 'bulk_truck') return ok(null);
  return positiveFigure(raw, 'Litres per metric ton');
}
