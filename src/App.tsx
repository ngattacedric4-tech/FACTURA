/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthProvider } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { MainLayout } from './components/MainLayout';
import { AuthPages } from './pages/AuthPages';
import { useAuth } from './hooks/useAuth';
import { useAdmin } from './hooks/useAdmin';
import { OnboardingPage } from './pages/OnboardingPage';
import { CheckoutDemoPage } from './pages/CheckoutDemoPage';
import { Dashboard } from './pages/Dashboard';
import { ClientsPage } from './pages/ClientsPage';
import { ProductsPage } from './pages/ProductsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ExportDGIPage } from './pages/ExportDGIPage';
import { SettingsPage } from './pages/SettingsPage';
import { PricingPage } from './pages/PricingPage';
import { LandingPage } from './pages/LandingPage';
import { AdminPage } from './pages/AdminPage';
import { TeamPage } from './pages/TeamPage';
import { ApiPage } from './pages/ApiPage';
import { AuditPage } from './pages/AuditPage';
import { InviteAcceptPage } from './pages/InviteAcceptPage';
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { ReceiptText } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface CheckoutData {
  plan: 'pro' | 'business';
  planName: string;
  price: string;
}

const APP_PAGES = new Set(['dashboard','clients','products','invoices','payments','export-dgi','settings','pricing','team','api','audit']);

function readHash() {
  return window.location.hash.replace(/^#\/?/, '');
}

function readInviteToken(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/invite=([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

function AppContent() {
  const { user, company, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // All view state derived from a single source: the URL hash
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);

  const hashToState = (hash: string) => {
    if (hash === 'login')  return { showAuth: true,  authMode: 'login'  as const, page: 'dashboard' };
    if (hash === 'signup') return { showAuth: true,  authMode: 'signup' as const, page: 'dashboard' };
    const page = APP_PAGES.has(hash) ? hash : 'dashboard';
    return { showAuth: false, authMode: 'login' as const, page };
  };

  const initial = hashToState(readHash());
  const [showAuth, setShowAuth]   = useState(initial.showAuth);
  const [authMode, setAuthMode]   = useState<'login' | 'signup'>(initial.authMode);
  const [currentPage, setCurrentPage] = useState(initial.page);

  // Single hashchange handler drives all state
  useEffect(() => {
    const onHashChange = () => {
      const s = hashToState(readHash());
      setShowAuth(s.showAuth);
      setAuthMode(s.authMode);
      setCurrentPage(s.page);
      setCheckoutData(null);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Navigation helpers — only write to hash, state follows via hashchange
  const navigate = useCallback((page: string) => {
    const target = APP_PAGES.has(page) ? page : 'dashboard';
    window.location.hash = target === 'dashboard' ? '' : target;
  }, []);

  const goToAuth = useCallback((mode: 'login' | 'signup') => {
    window.location.hash = mode; // → #login or #signup
  }, []);

  // On user login / logout
  useEffect(() => {
    const id = user?.id ?? null;
    if (prevUserIdRef.current === id) return;
    prevUserIdRef.current = id;
    if (!user) {
      setCheckoutData(null);
      window.location.hash = ''; // back to landing
    } else {
      navigate('dashboard');
    }
  }, [user, navigate]);

  if (loading || (!!user && adminLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#111827] rounded-lg flex items-center justify-center">
            <ReceiptText size={16} className="text-white" />
          </div>
          <span className="text-[20px] font-black tracking-tight text-[#111827]">FACTURA</span>
        </div>
        <div className="w-48 h-0.5 bg-[#F3F4F6] rounded-full overflow-hidden">
          <div className="h-full bg-[#111827] rounded-full" style={{ animation: 'loading 1.5s ease-in-out infinite' }} />
        </div>
        <p className="text-[13px] text-[#9CA3AF]">Chargement de votre espace...</p>
      </div>
    );
  }

  // Acceptation invitation team — fonctionne loggé ou non
  const inviteToken = readInviteToken();
  if (inviteToken) {
    return <InviteAcceptPage token={inviteToken} onDone={() => { window.location.hash = ''; }} />;
  }

  if (!user) {
    if (showAuth) return <AuthPages initialMode={authMode} />;
    return (
      <LandingPage
        onGetStarted={() => goToAuth('signup')}
        onLogin={() => goToAuth('login')}
      />
    );
  }

  // Admin — interface séparée
  if (isAdmin) return <AdminPage />;

  if (!company) return <OnboardingPage />;

  // Checkout demo — full-page sans rechargement
  if (checkoutData) {
    return (
      <CheckoutDemoPage
        plan={checkoutData.plan}
        planName={checkoutData.planName}
        price={checkoutData.price}
        onCancel={() => { setCheckoutData(null); navigate('pricing'); }}
        onSuccess={() => {
          const label = checkoutData.planName;
          setCheckoutData(null);
          navigate('pricing');
          toast.success(`Paiement réussi ! Plan ${label} activé.`, { duration: 6000 });
        }}
      />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':  return <Dashboard    onNavigate={navigate} />;
      case 'clients':    return <ClientsPage  onNavigate={navigate} />;
      case 'products':   return <ProductsPage onNavigate={navigate} />;
      case 'invoices':   return <InvoicesPage onNavigate={navigate} />;
      case 'payments':   return <PaymentsPage onNavigate={navigate} />;
      case 'export-dgi': return <ExportDGIPage onNavigate={navigate} />;
      case 'settings':   return <SettingsPage onNavigate={navigate} />;
      case 'pricing':    return <PricingPage  onNavigate={navigate} onStartCheckout={setCheckoutData} />;
      case 'team':       return <TeamPage     onNavigate={navigate} />;
      case 'api':        return <ApiPage      onNavigate={navigate} />;
      case 'audit':      return <AuditPage    onNavigate={navigate} />;
      default:           return <Dashboard    onNavigate={navigate} />;
    }
  };

  return (
    <>
      <MainLayout onNavigate={navigate} currentPage={currentPage}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </MainLayout>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: 'Geist Variable, system-ui, sans-serif',
              fontSize: '13px',
              borderRadius: '12px',
            },
            duration: 3000,
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}
