import React, { useEffect, useRef, useState } from 'react';
import { IconContext, Drop, Spinner } from '@phosphor-icons/react';
import { StoreProvider, useStore } from './services/store';
import { AuthProvider, useAuth } from './services/auth';
import { isSupabaseConfigured } from './services/supabase';
import { NAV_ITEMS, getVisibleNavItems } from './constants/nav';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { MobileNav } from './components/layout/MobileNav';
import { ScreenTransition } from './components/layout/ScreenTransition';
import { ReceiptModal } from './components/common/ReceiptModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { FloatingAIBuddy } from './components/common/FloatingAIBuddy';
import { LoginScreen } from './screens/LoginScreen';

import { DashboardScreen } from './screens/DashboardScreen';
import { TruckIntakeScreen } from './screens/TruckIntakeScreen';
import { NewOrderScreen } from './screens/NewOrderScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { KegsScreen } from './screens/KegsScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { PumpsScreen } from './screens/PumpsScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AIAdvisorScreen } from './screens/AIAdvisorScreen';
import { TransactionLedgerScreen } from './screens/TransactionLedgerScreen';

// Order tabs slide toward when navigating between them mirrors this array —
// the same one the Sidebar / mobile nav render from.
const navOrderIndex = (tabId: string): number => {
  const i = NAV_ITEMS.findIndex(item => item.id === tabId);
  return i === -1 ? 0 : i;
};

const MainLayout: React.FC = () => {
  const [currentTab, setCurrentTabState] = useState<string>('dashboard');
  const [slideDirection, setSlideDirection] = useState(1);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { activeReceipt, setActiveReceipt, userRole, currentUser } = useStore();

  // Owner/admin gets the full sidebar; counter staff & drivers get a compact
  // top-bar screen switcher instead (dedicated counter tablet).
  const isAdmin = userRole === 'owner';

  const visibleNavItems = getVisibleNavItems(userRole, currentUser.allowed_screens);

  // Slides toward the destination tab's position in the nav bar, and scrolls
  // the content pane back to the top so the motion is actually visible.
  const setCurrentTab = (tab: string) => {
    if (tab !== currentTab) {
      setSlideDirection(navOrderIndex(tab) >= navOrderIndex(currentTab) ? 1 : -1);
      if (mainRef.current) mainRef.current.scrollTop = 0;
    }
    setCurrentTabState(tab);
  };

  // If a screen access change (or a role switch) leaves the current tab no
  // longer visible to this user, snap to the first one that still is —
  // otherwise they'd be stuck looking at a screen they can't navigate away
  // from via the nav (it's simply missing from it).
  useEffect(() => {
    if (visibleNavItems.some(item => item.id === currentTab)) return;
    setCurrentTabState(visibleNavItems[0]?.id || 'dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNavItems, currentTab]);

  const renderActiveScreen = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardScreen onNavigate={setCurrentTab} />;
      case 'ai-advisor':
        return <AIAdvisorScreen />;
      case 'intake':
        return <TruckIntakeScreen />;
      case 'pumps':
        return <PumpsScreen />;
      case 'order':
        return <NewOrderScreen onNavigate={setCurrentTab} />;
      case 'ledger':
        return <TransactionLedgerScreen onNavigate={setCurrentTab} />;
      case 'customers':
        return <CustomersScreen />;
      case 'kegs':
        return <KegsScreen />;
      case 'inventory':
        return <InventoryScreen />;
      case 'expenses':
        return <ExpensesScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-200">
      {/* Skip link — first focusable element, jumps keyboard users past the chrome */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-brand-500 focus:text-slate-950 focus:font-bold focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar — owner/admin only */}
      {isAdmin && <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <TopHeader
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          onMobileMenuOpen={() => setIsMobileMenuOpen(true)}
          showScreenSwitcher={!isAdmin}
        />

        {/* Scrollable Screen Content Container */}
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-6 pb-24 split:pb-8 bg-slate-100/80 dark:bg-slate-950 focus:outline-none"
        >
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              <ScreenTransition screenKey={currentTab} direction={slideDirection}>
                {renderActiveScreen()}
              </ScreenTransition>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation & Mobile Drawer */}
      <MobileNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isMenuOpen={isMobileMenuOpen}
        onCloseMenu={() => setIsMobileMenuOpen(false)}
      />

      {/* Floating Circular AI Chat Buddy for Owner/Admin */}
      {isAdmin && <FloatingAIBuddy onNavigate={setCurrentTab} />}

      {/* Global Printable Receipt Modal */}
      <ReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
};

/**
 * Requires a signed-in Supabase session + a loaded `profiles` row before
 * rendering the app, and mirrors that profile into the local store's
 * `currentUser`/`userRole` so every existing role-gated screen just works.
 * A no-op when Supabase isn't configured — local/offline mode is unaffected.
 */
const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ready, session, profile, profileLoading, signOut } = useAuth();
  const { setCurrentUser } = useStore();

  useEffect(() => {
    if (!session?.user || !profile) return;
    setCurrentUser({
      id: profile.id,
      full_name: profile.full_name || session.user.email || 'Depot User',
      email: session.user.email || '',
      role: profile.role,
      hub_id: profile.hub_id,
      active: true,
      allowed_screens: profile.allowed_screens
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, session]);

  if (!isSupabaseConfigured) return <>{children}</>;

  if (!ready) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <Spinner className="w-8 h-8 text-brand-500 animate-spin" weight="bold" />
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  if (!profile) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-4">
        <div className="depot-card p-6 max-w-sm text-center space-y-3">
          {profileLoading ? (
            <>
              <Spinner className="w-8 h-8 text-brand-500 animate-spin mx-auto" weight="bold" />
              <p className="text-sm font-sans text-slate-600 dark:text-slate-300">Loading your account…</p>
            </>
          ) : (
            <>
              <Drop className="w-8 h-8 text-amber-500 mx-auto" weight="fill" />
              <p className="text-sm font-sans font-bold text-slate-800 dark:text-white">Account not set up yet</p>
              <p className="text-xs font-sans text-slate-500 dark:text-slate-400">
                Signed in, but no depot profile was found for this account. Ask an
                owner to check the <code>profiles</code> table in Supabase, or sign out and try again.
              </p>
              <button
                type="button"
                onClick={() => signOut()}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-sans font-bold transition-all"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export function App() {
  return (
    // App-wide icon convention: thin by default, bold on an active tab,
    // selected tile/chip, or primary action — set explicitly per element.
    <IconContext.Provider value={{ weight: 'thin' }}>
      <AuthProvider>
        <StoreProvider>
          <AuthGate>
            <MainLayout />
          </AuthGate>
        </StoreProvider>
      </AuthProvider>
    </IconContext.Provider>
  );
}

export default App;
