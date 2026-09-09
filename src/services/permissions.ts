import { UserRole } from '../types';
import { useStore } from './store';

/**
 * Owner-gated capabilities. Anything listed here is available to `owner` only;
 * `staff` and `driver` get everyday operations (sales, payments, intake, lookups)
 * but never these.
 */
export type PermissionAction =
  | 'editPricing'
  | 'editThresholds'
  | 'editProducts'
  | 'editCompanyProfile'
  | 'factoryReset'
  | 'authorizeCreditOverride'
  | 'viewAIAdvisor';

const OWNER_ONLY: readonly string[] = [
  'editPricing',
  'editThresholds',
  'editProducts',
  'editCompanyProfile',
  'factoryReset',
  'authorizeCreditOverride',
  'viewAIAdvisor'
];

/**
 * Single source of truth for role-based access.
 * Owner can do everything; staff/driver can do everything that is NOT owner-gated.
 */
export function can(role: UserRole, action: string): boolean {
  if (role === 'owner') return true;
  return !OWNER_ONLY.includes(action);
}

/** Hook flavour — reads the active role straight from the store. */
export function usePermissions() {
  const { userRole } = useStore();
  return {
    role: userRole,
    isOwner: userRole === 'owner',
    can: (action: string) => can(userRole, action)
  };
}
