import {
  Icon,
  SquaresFour,
  Truck,
  PlusCircle,
  Users,
  Package,
  Stack,
  Invoice,
  Gear,
  Sparkle,
  Scroll,
  GasPump
} from '@phosphor-icons/react';
import type { UserRole } from '../types';

export interface NavItem {
  id: string;
  label: string;
  icon: Icon;
  adminOnly?: boolean;
}

/** Single source of truth for the app's top-level destinations. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: SquaresFour },
  { id: 'order', label: 'New Sale', icon: PlusCircle },
  { id: 'ledger', label: 'Transaction Ledger', icon: Scroll },
  { id: 'customers', label: 'Customers & Debt', icon: Users },
  { id: 'pumps', label: 'Pumps', icon: GasPump },
  { id: 'intake', label: 'Truck Intake', icon: Truck },
  { id: 'kegs', label: 'Kegs Ledger', icon: Package },
  { id: 'inventory', label: 'Products & Pricing', icon: Stack, adminOnly: true },
  { id: 'expenses', label: 'Expenses & Float', icon: Invoice },
  { id: 'ai-advisor', label: 'AI Advisor', icon: Sparkle, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Gear, adminOnly: true }
];

/**
 * Which nav items a signed-in user gets to see.
 * - Owner: always everything (no way to lock the owner out of a screen).
 * - Everyone else with an explicit `allowed_screens` list on their profile:
 *   exactly those screens, however many/few — this is the per-user override.
 * - Everyone else with no list set (`null`/`undefined`/empty): the old
 *   role default — every screen except the ones marked `adminOnly`.
 */
export function getVisibleNavItems(role: UserRole, allowedScreens?: string[] | null): NavItem[] {
  if (role === 'owner') return NAV_ITEMS;
  if (allowedScreens !== null && allowedScreens !== undefined) {
    return NAV_ITEMS.filter(item => allowedScreens.includes(item.id));
  }
  return NAV_ITEMS.filter(item => !item.adminOnly);
}
