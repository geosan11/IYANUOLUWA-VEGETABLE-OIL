import React, { useState } from 'react';
import { StoreProvider, useStore } from './services/store';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { MobileNav } from './components/layout/MobileNav';
import { ReceiptModal } from './components/common/ReceiptModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

import { DashboardScreen } from './screens/DashboardScreen';
import { TruckIntakeScreen } from './screens/TruckIntakeScreen';
import { NewOrderScreen } from './screens/NewOrderScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { KegsScreen } from './screens/KegsScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AIAdvisorScreen } from './screens/AIAdvisorScreen';
import { TransactionLedgerScreen } from './screens/TransactionLedgerScreen';

const MainLayout: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { activeReceipt, setActiveReceipt, userRole } = useStore();

  // Owner/admin gets the full sidebar; counter staff & drivers get a compact
  // top-bar screen switcher instead (dedicated counter tablet).
  const isAdmin = userRole === 'owner';

  const renderActiveScreen = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardScreen onNavigate={setCurrentTab} />;
      case 'ai-advisor':
        return <AIAdvisorScreen />;
      case 'intake':
        return <TruckIntakeScreen />;
      case 'order':
        return <NewOrderScreen />;
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
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 split:pb-8 bg-slate-100/80 dark:bg-slate-950 focus:outline-none"
        >
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>{renderActiveScreen()}</ErrorBoundary>
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

      {/* Global Printable Receipt Modal */}
      <ReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
};

export function App() {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
}

export default App;
