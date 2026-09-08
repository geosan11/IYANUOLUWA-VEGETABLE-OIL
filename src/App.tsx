import React, { useState } from 'react';
import { StoreProvider, useStore } from './services/store';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { MobileNav } from './components/layout/MobileNav';
import { ReceiptModal } from './components/common/ReceiptModal';

import { DashboardScreen } from './screens/DashboardScreen';
import { TruckIntakeScreen } from './screens/TruckIntakeScreen';
import { NewOrderScreen } from './screens/NewOrderScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { KegsScreen } from './screens/KegsScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { SettingsScreen } from './screens/SettingsScreen';

const MainLayout: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { activeReceipt, setActiveReceipt } = useStore();

  const renderActiveScreen = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardScreen onNavigate={setCurrentTab} />;
      case 'intake':
        return <TruckIntakeScreen />;
      case 'order':
        return <NewOrderScreen />;
      case 'customers':
        return <CustomersScreen />;
      case 'kegs':
        return <KegsScreen />;
      case 'expenses':
        return <ExpensesScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Desktop Sidebar (Permanent Desktop Navigation) */}
      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <TopHeader
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          onMobileMenuOpen={() => setIsMobileMenuOpen(true)}
        />

        {/* Scrollable Screen Content Container */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            {renderActiveScreen()}
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
