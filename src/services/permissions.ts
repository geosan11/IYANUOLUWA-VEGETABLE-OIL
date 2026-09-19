import { UserRole } from '../types';
import { useStore } from './store';
import { getVisibleNavItems } from '../constants/nav';

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
 * Single source of truth for role-based access. `allowedScreens` is the
 * per-user override an owner can grant in Team Members & Screen Access
 * (src/constants/nav.ts's getVisibleNavItems) — an explicit grant unlocks
 * viewing the AI Advisor the same way it unlocks navigating to it, so a
 * granted staff member isn't blocked by this check after already getting
 * past the nav gate.
 */
export function can(role: UserRole, action: string, allowedScreens?: string[] | null): boolean {
  if (role === 'owner') return true;
  if (action === 'viewAIAdvisor') {
    if (role === 'hub_manager') return true;
    return getVisibleNavItems(role, allowedScreens).some(item => item.id === 'ai-advisor');
  }
  if (role === 'hub_manager') {
    if (action === 'authorizeCreditOverride') return true;
    return !OWNER_ONLY.includes(action);
  }
  return !OWNER_ONLY.includes(action) && action !== 'authorizeCreditOverride';
}

/** Hook flavour — reads the active role straight from the store. */
export function usePermissions() {
  const { userRole, currentUser } = useStore();
  const isOwner = userRole === 'owner';
  return {
    role: userRole,
    currentUser,
    isOwner,
    isHubManager: userRole === 'hub_manager',
    isStaff: userRole === 'staff',
    isDriver: userRole === 'driver',
    canSwitchHubs: userRole === 'owner',
    can: (action: string) => can(userRole, action, currentUser.allowed_screens),
    /**
     * Can this user reach `screenId` at all — by role default or by an
     * explicit `allowed_screens` grant? If they can navigate to a screen,
     * they should be able to operate its normal actions too (the owner
     * granted it on purpose) — a short, explicit list of actions stay
     * hard owner-only regardless (user accounts, hub create/delete,
     * factory reset), checked separately from this.
     */
    canOperate: (screenId: string) =>
      isOwner || getVisibleNavItems(userRole, currentUser.allowed_screens).some(item => item.id === screenId)
  };
}

