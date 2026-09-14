import { UserRole } from '../types';
import { useStore } from './store';

/**
 * Role-gated capabilities.
 * - 'owner': Full control across all hubs and global settings.
 * - 'hub_manager': Autonomous local depot operations, local shift/pump oversight, local credit override, viewing hub insights.
 * - 'staff': Daily counter operations (sales, payments, tank intake, pump reading, keg return).
 * - 'driver': Haulage, delivery, and container transfers.
 */
export type PermissionAction =
  | 'editPricing'
  | 'editThresholds'
  | 'editProducts'
  | 'editCompanyProfile'
  | 'factoryReset'
  | 'authorizeCreditOverride'
  | 'viewAIAdvisor'
  | 'manageHubs'
  | 'manageUsers';

const OWNER_ONLY: readonly string[] = [
  'editPricing',
  'editThresholds',
  'editProducts',
  'editCompanyProfile',
  'factoryReset',
  'manageHubs',
  'manageUsers'
];

/**
 * Single source of truth for role-based access.
 */
export function can(role: UserRole, action: string): boolean {
  if (role === 'owner') return true;
  if (role === 'hub_manager') {
    if (action === 'authorizeCreditOverride' || action === 'viewAIAdvisor') return true;
    return !OWNER_ONLY.includes(action);
  }
  return !OWNER_ONLY.includes(action) && action !== 'authorizeCreditOverride' && action !== 'viewAIAdvisor';
}

/** Hook flavour — reads the active role straight from the store. */
export function usePermissions() {
  const { userRole, currentUser } = useStore();
  return {
    role: userRole,
    currentUser,
    isOwner: userRole === 'owner',
    isHubManager: userRole === 'hub_manager',
    isStaff: userRole === 'staff',
    isDriver: userRole === 'driver',
    canSwitchHubs: userRole === 'owner',
    can: (action: string) => can(userRole, action)
  };
}

