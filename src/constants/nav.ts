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

export interface NavItem {
  id: string;
  label: string;
  icon: Icon;
  adminOnly?: boolean;
}

/** Single source of truth for the app's top-level destinations. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: SquaresFour },
  { id: 'ai-advisor', label: 'AI Operations Advisor', icon: Sparkle, adminOnly: true },
  { id: 'intake', label: 'Truck Intake', icon: Truck },
  { id: 'pumps', label: 'Pumps', icon: GasPump },
  { id: 'order', label: 'New Sale', icon: PlusCircle },
  { id: 'ledger', label: 'Transactions', icon: Scroll },
  { id: 'customers', label: 'Customers & Credit', icon: Users },
  { id: 'kegs', label: 'Kegs Ledger', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Stack, adminOnly: true },
  { id: 'expenses', label: 'Expenses & Float', icon: Invoice },
  { id: 'settings', label: 'Settings', icon: Gear }
];
