import {
  LayoutDashboard,
  Truck,
  PlusCircle,
  Users,
  Package,
  ReceiptText,
  Settings,
  Sparkles
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

/** Single source of truth for the app's top-level destinations. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ai-advisor', label: 'AI Operations Advisor', icon: Sparkles, adminOnly: true },
  { id: 'intake', label: 'Truck Intake', icon: Truck },
  { id: 'order', label: 'New Sale', icon: PlusCircle },
  { id: 'customers', label: 'Customers & Credit', icon: Users },
  { id: 'kegs', label: 'Kegs Ledger', icon: Package },
  { id: 'expenses', label: 'Expenses & Float', icon: ReceiptText },
  { id: 'settings', label: 'Settings', icon: Settings }
];
