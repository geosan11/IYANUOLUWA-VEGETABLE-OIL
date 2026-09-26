import React from 'react';
import { useStore } from '../../services/store';
import { getVisibleNavItems } from '../../constants/nav';
import {
  Warning,
  CaretRight,
  Sun,
  Moon,
  Drop
} from '@phosphor-icons/react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const OPERATIONS_IDS = ['dashboard', 'order', 'ledger', 'customers'];
const DEPOT_IDS = ['pumps', 'intake', 'kegs', 'inventory'];
const MANAGEMENT_IDS = ['expenses', 'ai-advisor', 'staff', 'settings'];

const LABEL_OVERRIDES: Record<string, string> = {
  dashboard: 'Dashboard',
  order: 'New Sale',
  ledger: 'Transaction ledger',
  customers: 'Customers & Debt',
  pumps: 'Pumps',
  intake: 'Truck Intake',
  kegs: 'Kegs Ledger',
  inventory: 'Products & pricing',
  expenses: 'Expenses & float',
  'ai-advisor': 'AI Advisor',
  staff: 'Staff Management',
  settings: 'Settings'
};

/**
 * Hover-to-expand: always rendered narrow (icons only); hovering the panel
 * grows it over the content via CSS (`group-hover`), no click toggle needed.
 */
export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { settings, userRole, activeAlerts, theme, toggleTheme, currentUser, activeHub } = useStore();

  const overdueCount = activeAlerts.overdueCredit.length;

  const accessibleNavItems = getVisibleNavItems(userRole, currentUser.allowed_screens)
    .map(item => ({
      ...item,
      label: LABEL_OVERRIDES[item.id] || item.label,
      badge: item.id === 'customers' && overdueCount > 0 ? overdueCount : null
    }));

  const operationsItems = OPERATIONS_IDS
    .map(id => accessibleNavItems.find(item => item.id === id))
    .filter((item): item is typeof accessibleNavItems[0] => Boolean(item));

  const depotItems = DEPOT_IDS
    .map(id => accessibleNavItems.find(item => item.id === id))
    .filter((item): item is typeof accessibleNavItems[0] => Boolean(item));

  const managementItems = MANAGEMENT_IDS
    .map(id => accessibleNavItems.find(item => item.id === id))
    .filter((item): item is typeof accessibleNavItems[0] => Boolean(item));

  const hubDisplay = activeHub
    ? `${activeHub.name} · ${activeHub.state || 'LOS'}`
    : 'Alaba Central · LOS';

  const renderNavItem = (item: typeof accessibleNavItems[0]) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.id)}
        title={item.label}
        className={`w-full flex items-center justify-center group-hover:justify-between rounded-lg transition-colors duration-150 text-[13px] py-1.5 px-2.5 group-hover:px-3 group/btn ${
          isActive
            ? 'bg-[#382f1d] text-[#f59e0b] font-semibold ring-1 ring-inset ring-amber-500/25 shadow-sm'
            : 'text-stone-300 hover:text-white hover:bg-stone-800/60 font-medium'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            className={`w-5 h-5 flex-shrink-0 transition-transform group-hover/btn:scale-110 ${
              isActive ? 'text-amber-400' : 'text-stone-400 group-hover/btn:text-stone-200'
            }`}
            weight={isActive ? 'bold' : 'regular'}
          />
          <span className="truncate whitespace-nowrap hidden group-hover:inline">
            {item.label}
          </span>
        </div>

        {item.badge !== null && item.badge > 0 && (
          <span className="hidden group-hover:inline-flex px-1.5 py-px rounded-md text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="hidden split:block relative flex-shrink-0 z-40 select-none">
      {/* Spacer so the main content reserves the rail's resting width.
          MUST stay in sync with the `w-[72px]` on <aside> below — this div is
          what actually reserves the rail's space, since the panel is absolute.
          72px, not 80px: the aside has NO right padding (see below), so the
          card's right edge lands exactly on the content's left edge at x=72 and
          the root's `bg-slate-50` (= #FAF6ED, per tailwind.config.js) can no
          longer show through the seam. A wider spacer leaves an 8px cream
          strip; a narrower one lets the panel cover the content's first pixels. */}
      <div className="w-[72px]" />

      {/* Floating sidebar panel — expands over content on hover.
          The box is 72px with `py-2 pl-2`: vertical AND left insets only, so the
          card stays docked flush against the main content on the right while
          keeping its 8px float on the left/top/bottom. Card = 72 − 8 = 64px
          wide, which keeps the resting interior at exactly its previous value:
          nav interior = 64 − 2 − 16 = 46px → brand content box = 46 − 2 − 12 =
          32px, the exact fit for the 32px logo.
          Hover width stays 230px (the expanded interior is independent of the
          rest width): card 222px → interior 204px → 180px row content box vs
          the 164–171px worst case, so the 3-digit overdue badge still never
          truncates. */}
      <aside className="absolute top-0 left-0 h-screen py-2 pl-2 z-50 flex flex-col w-[72px] hover:w-[230px] hover:shadow-2xl transition-all duration-300 ease-in-out group">
        <div className="h-full w-full bg-[#1c1b18] text-stone-200 rounded-xl border border-stone-800/80 shadow-2xl flex flex-col justify-between overflow-hidden p-2 backdrop-blur-md">
          {/* Top Brand Card — tightest padding that still clears the 32px logo
              (p-1.5 → 46px tall, vs 50px at p-2). The location used to live in
              its own pulsing-dot row below a divider; it is now merged into
              line 2, so the card is a single 2-line block on hover. */}
          <div className="p-1.5 rounded-xl bg-[#25231f] border border-white/5 mb-1 flex-shrink-0 overflow-hidden transition-all duration-200">
            <div className="flex items-center justify-center group-hover:justify-start gap-2.5">
              {/* Real company logo — the same `settings.company_logo_url` the
                  TopHeader and the printed receipt use, so the sidebar can no
                  longer disagree with them. White chip behind it because a
                  dark or transparent logo needs contrast on #25231f. Falls
                  back to the app's Drop mark (as AuthShell does), never the
                  old hardcoded "IO" letters. */}
              {settings.company_logo_url ? (
                <img
                  src={settings.company_logo_url}
                  alt={settings.company_name || 'Company logo'}
                  className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shadow-md flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-brand-500 text-slate-950 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Drop className="w-4 h-4" weight="fill" />
                </div>
              )}

              {/* Title & Subtitle */}
              <div className="min-w-0 flex-1 hidden group-hover:block transition-opacity duration-200">
                <div className="font-semibold text-[13px] tracking-tight text-white truncate">
                  {settings.company_name || 'Iyanuoluwa Oil'}
                </div>
                {/* Line 2 = the hub/location, merged down from the old
                    standalone dot row. `hubDisplay` resolves to
                    "<hub> · <state>", e.g. "ADEOYE · Lagos", so this is a
                    relocation, not a hardcoded string — and keeping the const
                    in use matters: tsconfig sets `noUnusedLocals`, and
                    `npm run build` runs `tsc`, so literal text here would fail
                    the build unless the const and `activeHub` were also removed. */}
                <div className="text-[10px] text-stone-500 truncate">
                  {hubDisplay}
                </div>
              </div>
            </div>
          </div>

          {/* Nav List — dense, Supabase-style: hairline `divide-y` separators
              replace the old "OPERATIONS / DEPOT & STOCK / MANAGEMENT" text
              headers, which were `hidden group-hover:block` and so added ~61px
              only on hover. With the headers gone, the rail is the same height
              resting and expanded (no reflow when it grows). `min-h-0` lets the
              flex child shrink; `overflow-y-auto no-scrollbar` is kept purely as
              an invisible safety net — at these heights it never engages. */}
          <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden divide-y divide-white/10 no-scrollbar">
            {/* Operations section */}
            <div className="space-y-0.5 py-1">
              {operationsItems.map(item => renderNavItem(item))}
            </div>

            {/* Depot & Stock section */}
            {depotItems.length > 0 && (
              <div className="space-y-0.5 py-1">
                {depotItems.map(item => renderNavItem(item))}
              </div>
            )}

            {/* Management section */}
            {managementItems.length > 0 && (
              <div className="space-y-0.5 py-1">
                {managementItems.map(item => renderNavItem(item))}
              </div>
            )}

            {/* Depot Alerts summary if active */}
            {activeAlerts.totalAlertCount > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onTabChange('dashboard')}
                  className="w-full rounded-lg bg-rose-950/40 border border-rose-800/50 hover:bg-rose-950/60 transition-colors text-[11px] text-rose-300 font-semibold px-2.5 py-2 group-hover:px-3 flex items-center justify-center group-hover:justify-between"
                  title={`${activeAlerts.totalAlertCount} Depot Alerts`}
                >
                  <div className="flex items-center gap-2">
                    <Warning className="w-3.5 h-3.5 text-rose-400 animate-pulse flex-shrink-0" weight="bold" />
                    <span className="hidden group-hover:inline">
                      {activeAlerts.totalAlertCount} Depot Alerts
                    </span>
                  </div>
                  <CaretRight className="hidden group-hover:inline w-3.5 h-3.5 text-rose-400" />
                </button>
              </div>
            )}
          </nav>

          {/* Bottom Controls — one compact row (~33px) instead of the old
              name row plus separate version pill (~44px). The theme switch now
              lives in an always-visible row, so it is reachable while the rail
              is collapsed: its old row was `hidden group-hover:flex`, which made
              the control unclickable at rest.

              Status dot + version + name are one cluster that is `hidden` at
              rest. They are ~62px wide, which no longer fits the 46px interior
              of the 80px rail — and an over-wide centered flex item would clip
              symmetrically against the card's `overflow-hidden`, so the cluster
              has to leave the resting layout entirely. The theme toggle stays as
              the row's only visible child, centered by `justify-center` with
              ~11px clear on each side. */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-center group-hover:justify-between gap-2 flex-shrink-0">
            <div className="hidden group-hover:flex items-center gap-1.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="truncate text-[11px] text-stone-300 font-medium hidden group-hover:inline">
                {currentUser.full_name.split(' ')[0]} ({currentUser.role.replace('_', ' ')})
              </span>
              <span className="text-[10px] font-mono font-semibold text-amber-400 flex-shrink-0">
                1.2
              </span>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1 rounded-md bg-stone-800/60 border border-stone-700/60 text-stone-400 hover:text-white hover:bg-stone-800 transition-colors flex-shrink-0"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" weight="bold" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-stone-300" weight="bold" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
