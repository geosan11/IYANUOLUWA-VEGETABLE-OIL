/**
 * Verification suite for `constants/nav.ts` — the screen-visibility rules and
 * `canOperateScreen`, the predicate behind every "Owner only" / "Managing
 * Director Clearance Required" gate in the app
 * (src/services/permissions.ts's `canOperate`).
 *
 * Run with `npm test` (this suite runs first). Same hand-rolled harness as
 * `businessLogic.test.ts`: no runner, no dependencies, every assertion a
 * one-line sentence so a failure names the broken behaviour.
 *
 * The bug this suite exists for: an owner could grant someone a screen, the
 * grant saved fine, and the person was still shown as blocked. Two ways that
 * happened, both pinned down below —
 *
 *   • a grant for an `ownerOnly` screen (Staff Management) could be stored but
 *     was silently dropped by the nav, so the chip read as granted and the
 *     screen stayed shut (see `getVisibleNavItems` + `canOperateScreen`);
 *   • `canOperate` used to resolve grants *only* through the nav's visible
 *     list, so any screen the nav dropped was dead even though the grant was
 *     real. It now honours an explicit grant on its own.
 *
 * This file touches neither React nor the store — the predicate is pure on
 * purpose, precisely so this can run in plain Node.
 */
import { NAV_ITEMS, canOperateScreen, getVisibleNavItems } from './nav';
import type { UserRole } from '../types';

console.log('====================================================');
console.log('RUNNING SCREEN ACCESS (NAV / RBAC) VERIFICATION');
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

const ids = (role: UserRole, allowedScreens?: string[] | null) =>
  getVisibleNavItems(role, allowedScreens).map(item => item.id);

// ---------------------------------------------------------------------------
// The nav catalogue itself
// ---------------------------------------------------------------------------
assert(NAV_ITEMS.length === 12, `Nav: 12 destinations are registered (got ${NAV_ITEMS.length})`);
assert(
  new Set(NAV_ITEMS.map(i => i.id)).size === NAV_ITEMS.length,
  'Nav: every destination id is unique (no duplicate nav key / grant id)'
);
assert(
  NAV_ITEMS.filter(i => i.ownerOnly).map(i => i.id).join(',') === 'staff',
  'Nav: Staff Management is the only ownerOnly (never-grantable) destination'
);

// ---------------------------------------------------------------------------
// getVisibleNavItems — who sees which nav links
// ---------------------------------------------------------------------------
assert(ids('owner', null).length === NAV_ITEMS.length, 'Nav: the owner sees every destination, with no list set');
assert(
  ids('owner', ['dashboard']).length === NAV_ITEMS.length,
  'Nav: a stray grant on the owner row cannot narrow the owner'
);

const staffDefault = ids('staff', null);
assert(
  staffDefault.join(',') === 'dashboard,order,ledger,customers,pumps,intake,kegs,expenses',
  `Nav: staff with no list gets the role default — the 8 non-admin screens (got ${staffDefault.join(',')})`
);
assert(
  !staffDefault.includes('inventory') &&
    !staffDefault.includes('ai-advisor') &&
    !staffDefault.includes('staff') &&
    !staffDefault.includes('settings'),
  'Nav: the staff role default excludes every adminOnly / ownerOnly screen'
);
assert(
  ids('hub_manager', null).join(',') === staffDefault.join(','),
  'Nav: hub_manager with no list gets the same base set as staff (its extra powers are action-level, not screen-level)'
);
assert(
  ids('driver', null).join(',') === staffDefault.join(','),
  'Nav: driver with no list gets the same base set (haulage screens are not adminOnly)'
);

const granted = ids('staff', ['order', 'inventory', 'ai-advisor', 'settings']);
assert(
  granted.join(',') === 'order,inventory,ai-advisor,settings',
  `Nav: an explicit grant is honoured for adminOnly screens, however few (got ${granted.join(',')})`
);
assert(
  ids('staff', ['staff', 'dashboard']).join(',') === 'dashboard',
  'Nav: a grant for the ownerOnly Staff Management screen is dropped — it never renders a nav link'
);
assert(
  ids('staff', []).length === 0,
  'Nav: an explicit EMPTY list means no screens at all (distinct from null = role default)'
);
assert(
  ids('staff', ['not-a-real-screen']).length === 0,
  'Nav: an unknown screen id in a grant list grants nothing'
);

// ---------------------------------------------------------------------------
// canOperateScreen — the screen gates themselves
// ---------------------------------------------------------------------------
assert(canOperateScreen('dashboard', 'owner', null), "Gate: owner operates any screen ('dashboard')");
assert(
  canOperateScreen('settings', 'owner', null),
  "Gate: owner operates any screen, even with no grant ('settings')"
);

assert(canOperateScreen('dashboard', 'staff', null), 'Gate: staff reaches a role-default screen with no list');
assert(!canOperateScreen('settings', 'staff', null), 'Gate: staff is blocked from settings by role default');

assert(
  canOperateScreen('settings', 'staff', ['settings']),
  'Gate: a granted settings screen is operable (the regression this suite exists for)'
);
assert(
  canOperateScreen('inventory', 'staff', ['inventory']),
  'Gate: a granted Inventory screen is operable — the grant wins even though the role default excludes it'
);
assert(
  canOperateScreen('ai-advisor', 'staff', ['dashboard', 'ai-advisor']),
  'Gate: a grant for the AI Advisor opens the screen for a staff member'
);
assert(
  canOperateScreen('order', 'staff', ['order']),
  'Gate: an explicit list narrower than the role default does not silently keep the rest'
);
assert(
  !canOperateScreen('dashboard', 'staff', ['order']),
  'Gate: a screen left out of an explicit list is NOT operable (the grant list is authoritative, not additive)'
);

assert(
  !canOperateScreen('staff', 'staff', ['staff']),
  'Gate: a stale/hand-edited grant for the ownerOnly Staff Management screen is refused (escalation guard)'
);
assert(!canOperateScreen('staff', 'hub_manager', ['staff']), 'Gate: the ownerOnly refusal holds for hub_manager too');
assert(
  canOperateScreen('staff', 'owner', null) && !canOperateScreen('staff', 'driver', ['staff']),
  'Gate: the ownerOnly screen follows the ROLE — the owner passes it, a grant never substitutes for the role'
);

assert(
  !canOperateScreen('dashboard', 'staff', []),
  'Gate: an explicit empty list blocks even a role-default screen (matches the nav)'
);
assert(
  !canOperateScreen('dashboard', 'staff', ['not-a-real-screen']),
  'Gate: an unknown id in the grant list grants no screen'
);
assert(
  canOperateScreen('ai-advisor', 'hub_manager', ['ai-advisor']),
  'Gate: hub_manager can operate the AI Advisor when it is granted'
);
assert(
  !canOperateScreen('ai-advisor', 'hub_manager', null),
  'Gate: hub_manager has NO screen-level AI Advisor access by role alone — that is an action-level rule (`can`), not a nav one'
);

assert(
  NAV_ITEMS.every(item => canOperateScreen(item.id, 'owner', null)),
  'Gate: every registered destination is operable by the owner'
);
assert(
  NAV_ITEMS.every(item => !item.adminOnly || !canOperateScreen(item.id, 'staff', null)),
  'Gate: no staff member operates an adminOnly screen without a grant'
);

console.log('====================================================');
console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================');

