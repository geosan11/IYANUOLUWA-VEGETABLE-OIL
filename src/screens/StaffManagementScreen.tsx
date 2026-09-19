import React from 'react';
import { UserPlus } from '@phosphor-icons/react';
import { ScreenAccessPanel } from '../components/common/ScreenAccessPanel';

/**
 * Owner-only (see NAV_ITEMS' `ownerOnly` flag) — creating accounts and
 * assigning roles/screen access lived inside Settings; broken out to its
 * own screen since it's a privilege-escalation surface, not routine config.
 */
export const StaffManagementScreen: React.FC = () => {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 dark:bg-cyan-950/60 border border-cyan-500/20 dark:border-cyan-800 flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-slate-900 dark:text-white leading-tight">
            Staff Management
          </h1>
          <p className="text-xs font-sans text-slate-500 dark:text-slate-400">
            Create accounts, assign roles and hubs, and control exactly which screens each person can see.
          </p>
        </div>
      </div>

      <ScreenAccessPanel />
    </div>
  );
};

export default StaffManagementScreen;
