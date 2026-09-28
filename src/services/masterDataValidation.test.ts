import {
  MIN_TANK_CAPACITY_LITRES,
  positiveFigure,
  validateTankCapacity,
  validateTankProduct,
  validateProductDensity
} from './masterDataValidation';
import { numberOrBlank } from './businessLogic';

console.log('====================================================');
console.log('RUNNING MASTER-DATA VALIDATION VERIFICATION');
console.log('====================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`✗ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

/** Every refusal must carry a message a person can act on. */
function refusalReason(result: { ok: boolean; error?: string }): string {
  return result.ok ? '' : result.error ?? '';
}

// ---------------------------------------------------------------------------
// 1. THE REPORTED 400: a Physical Tank added with the capacity box left blank
// ---------------------------------------------------------------------------
// The old handler computed `Math.max(0, numberOrBlank(newTankCapacity, 0))`,
// and the Capacity input starts life as ''. Both together sent
// capacity_litres = 0, which 0001_init.sql refuses:
//   capacity_litres numeric(12,2) not null check (capacity_litres > 0)
// so the insert came back 400 and the tank stayed on one device only.
const blankCapacityAsTheOldHandlerSentIt = Math.max(0, numberOrBlank('', 0));
assert(
  blankCapacityAsTheOldHandlerSentIt === 0,
  'Regression context: a blank Capacity input used to be sent as capacity_litres = 0'
);
const blankCapacity = validateTankCapacity('');
assert(!blankCapacity.ok, 'Tank capacity: a blank box is refused instead of being sent as 0');
assert(
  refusalReason(blankCapacity).includes('Tank capacity'),
  'Tank capacity: the refusal names the field, not a Postgres constraint'
);
assert(!validateTankCapacity(0).ok, 'Tank capacity: 0 is refused (the exact value that returned 400)');
assert(!validateTankCapacity(blankCapacityAsTheOldHandlerSentIt).ok, 'Tank capacity: the old sent-0 value is refused');
assert(!validateTankCapacity(-5).ok, 'Tank capacity: a negative capacity is refused');
assert(!validateTankCapacity('abc').ok, 'Tank capacity: non-numeric text is refused');
assert(!validateTankCapacity(null).ok, 'Tank capacity: null is refused');
assert(!validateTankCapacity(undefined).ok, 'Tank capacity: undefined is refused');
assert(MIN_TANK_CAPACITY_LITRES === 1, 'Tank capacity: the depot floor is one whole litre');

const goodCapacity = validateTankCapacity('25000');
assert(goodCapacity.ok && goodCapacity.value === 25000, 'Tank capacity: "25000" is accepted as 25,000 L');
const groupedCapacity = validateTankCapacity('25,000');
assert(
  groupedCapacity.ok && groupedCapacity.value === 25000,
  'Tank capacity: a grouped "25,000" saves 25000, not the 25 a naive parseInt would keep'
);
assert(validateTankCapacity(1).ok, 'Tank capacity: the smallest legal value (1 litre) is accepted');

// ---------------------------------------------------------------------------
// 2. THE OTHER HALF OF THE SAME 400: physical_tanks.product_id is not null
// ---------------------------------------------------------------------------
// `newTankProductId` initialises to `products[0]?.id || ''`, so a form opened
// before the catalogue had loaded submitted product_id = '', and Postgres
// answered with a foreign-key violation.
const blankProduct = validateTankProduct('');
assert(!blankProduct.ok, 'Tank product: a blank product id is refused (it was a FK violation)');
assert(!validateTankProduct(null).ok, 'Tank product: null is refused');
assert(!validateTankProduct('   ').ok, 'Tank product: whitespace is refused');
const realProduct = validateTankProduct('veg');
assert(realProduct.ok && realProduct.value === 'veg', 'Tank product: a real product id is accepted');
const paddedProduct = validateTankProduct('  veg  ');
assert(paddedProduct.ok && paddedProduct.value === 'veg', 'Tank product: surrounding whitespace is trimmed');

// ---------------------------------------------------------------------------
// 3. products_bulk_needs_lpt — a bulk product cannot be saved without density
// ---------------------------------------------------------------------------
const bulkNoDensity = validateProductDensity('bulk_truck', '');
assert(!bulkNoDensity.ok, 'Product density: a bulk_truck product with a blank density is refused');
assert(
  refusalReason(bulkNoDensity).includes('metric ton'),
  'Product density: the refusal says which figure is missing'
);
assert(!validateProductDensity('bulk_truck', '0').ok, 'Product density: 0 is refused for a bulk product');
const bulkDensity = validateProductDensity('bulk_truck', '1,090');
assert(bulkDensity.ok && bulkDensity.value === 1090, 'Product density: "1,090" is accepted as 1090');
const preKeggedDensity = validateProductDensity('pre_kegged', '');
assert(
  preKeggedDensity.ok && preKeggedDensity.value === null,
  'Product density: a pre_kegged product stores null, never a density'
);
const preKeggedTypedDensity = validateProductDensity('pre_kegged', '1090');
assert(
  preKeggedTypedDensity.ok && preKeggedTypedDensity.value === null,
  'Product density: a pre_kegged product ignores a typed density (the depot standard governs)'
);

// ---------------------------------------------------------------------------
// 4. Every refusal carries an actionable sentence
// ---------------------------------------------------------------------------
const everyRefusal = [
  validateTankCapacity(''),
  validateTankProduct(''),
  validateProductDensity('bulk_truck', '')
];
assert(
  everyRefusal.every(result => !result.ok && refusalReason(result).length > 20),
  'All refusals: each carries a full sentence the depot can read, not an empty string'
);
assert(
  positiveFigure('0-floor', 'Capacity', 0).ok,
  'positiveFigure: a 0 floor is honoured when a caller needs "zero is allowed"'
);

console.log('====================================================');
console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================');

