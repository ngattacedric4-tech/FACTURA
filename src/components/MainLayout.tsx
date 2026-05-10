import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard,
  Users,
  Package,
  ReceiptText,
  CreditCard,
  LogOut,
  Settings,
  Menu,
  X,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Crown,
} from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { PLAN_LABEL } from '@/lib/plans';
import { Button } from '@/components/ui/button';


interface MainLayoutProps {
  children: React.ReactNode;
  onNavigate: (path: string) => void;
  currentPage: string;
}

export function MainLayout({ children, onNavigate, currentPage }: MainLayoutProps) {
  const { user, company } = useAuth();
  const { plan } = usePlan();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', collapsed.toString());
  }, [collapsed]);

  const navigation = [
    { name: 'Tableau de bord', icon: LayoutDashboard, id: 'dashboard' },
    { name: 'Clients', icon: Users, id: 'clients' },
    { name: 'Catalogue', icon: Package, id: 'products' },
    { name: 'Factures & Devis', icon: ReceiptText, id: 'invoices' },
    { name: 'Paiements', icon: CreditCard, id: 'payments' },
    { name: 'Export DGI', icon: FileSpreadsheet, id: 'export-dgi' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="bg-[#F8F9FA] flex overflow-hidden">
      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        style={{ width: collapsed ? '52px' : '240px' }}
        className={`fixed left-0 top-0 h-screen bg-white border-r border-[#E5E7EB] flex flex-col transition-all duration-200 ease-in-out z-50 overflow-hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* LOGO — h-14 */}
        <div className="h-14 flex items-center px-3 shrink-0 cursor-pointer" onClick={() => onNavigate('dashboard')}>
          {collapsed ? (
            <span className="font-black text-base mx-auto text-[#111827]">F</span>
          ) : (
            <span className="font-black text-lg px-1 tracking-tighter text-[#111827]">FACTURA</span>
          )}
        </div>

        {/* NAV — flex-1, pas de overflow, pas de scrollbar */}
        <nav className="flex-1 px-2 flex flex-col gap-0.5">
          {navigation.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setSidebarOpen(false);
              }}
              className={`flex items-center rounded-lg h-9 cursor-pointer transition-all duration-200 group relative
                ${currentPage === item.id 
                  ? 'bg-[#F3F4F6] text-[#111827] font-semibold' 
                  : 'text-[#6B7280] font-medium hover:bg-[#F3F4F6] hover:text-[#111827]'
                }
                ${collapsed ? 'w-9 justify-center mx-auto' : 'px-2 gap-2.5'}
              `}
            >
              <item.icon size={16} className="flex-shrink-0" />
              {!collapsed && (
                <span className="text-[13px]">{item.name}</span>
              )}
              {/* Tooltip si collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#111827] text-white text-[12px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none hidden lg:block">
                  {item.name}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* BOTTOM */}
        <div className="px-2 pb-3 flex flex-col gap-0.5 shrink-0">
          <button
            onClick={() => { onNavigate('pricing'); setSidebarOpen(false); }}
            className={`flex items-center rounded-lg h-9 cursor-pointer transition-all duration-200 group relative font-medium ${
              plan === 'enterprise'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:opacity-90'
                : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
            } ${collapsed ? 'w-9 justify-center mx-auto' : 'px-2 gap-2.5 w-full justify-start'}`}
          >
            {plan === 'enterprise' ? <Crown size={16} className="flex-shrink-0"/> : <Sparkles size={16} className="flex-shrink-0"/>}
            {!collapsed && <span className="text-[13px]">{PLAN_LABEL[plan]}</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#111827] text-white text-[12px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none hidden lg:block">
                Plan {PLAN_LABEL[plan]}
              </div>
            )}
          </button>

          <button
            onClick={() => { onNavigate('settings'); setSidebarOpen(false); }}
            className={`flex items-center rounded-lg h-9 cursor-pointer transition-all duration-200 group relative text-[#6B7280] font-medium hover:bg-[#F3F4F6] hover:text-[#111827] ${collapsed ? 'w-9 justify-center mx-auto' : 'px-2 gap-2.5 w-full justify-start'}`}
          >
            <Settings size={16} className="flex-shrink-0" />
            {!collapsed && <span className="text-[13px]">Paramètres</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#111827] text-white text-[12px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none hidden lg:block">
                Paramètres
              </div>
            )}
          </button>
          
          <button 
            onClick={handleLogout}
            className={`flex items-center rounded-lg h-9 cursor-pointer transition-all duration-200 group relative text-[#EF4444] font-medium hover:bg-red-50 hover:text-[#DC2626] ${collapsed ? 'w-9 justify-center mx-auto' : 'px-2 gap-2.5 w-full justify-start'}`}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span className="text-[13px]">Déconnexion</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#111827] text-white text-[12px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none hidden lg:block">
                Déconnexion
              </div>
            )}
          </button>

          <div className="border-t border-[#F3F4F6] my-1 shrink-0"></div>
          
          {/* User profile */}
          <div className={`flex items-center h-9 ${collapsed ? 'justify-center w-full' : 'gap-2 px-1'}`}>
            <div className="w-7 h-7 rounded-full bg-[#111827] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {company?.name?.substring(0, 2).toUpperCase() || 'FA'}
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex flex-col justify-center">
                <p className="text-[13px] leading-tight font-medium text-[#111827] truncate">{company?.name || 'Ma Société'}</p>
                <p className="text-[11px] leading-tight mt-0.5 text-[#9CA3AF] truncate">{user?.email}</p>
              </div>
            )}
          </div>
          
          {/* Bouton collapse */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden lg:flex items-center h-9 mt-1 rounded-lg text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-all
              ${collapsed ? 'w-9 justify-center mx-auto' : 'px-2 gap-2 w-full'}
            `}
          >
            {collapsed 
              ? <ChevronRight size={16} /> 
              : <ChevronLeft size={16} />
            }
            {!collapsed && (
              <span className="text-[13px] font-medium">Réduire</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        style={{ marginLeft: collapsed ? '52px' : '240px' }}
        className="min-h-screen transition-all duration-200 ease-in-out bg-[#F8F9FA] w-full max-lg:!ml-0"
      >
        {/* Header Mobile */}
        <header className="lg:hidden bg-white border-b border-[#E5E7EB] h-14 flex items-center justify-between px-4 shrink-0 fixed top-0 w-full z-30">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-black tracking-tighter text-[#111827]">FACTURA</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-[#111827]">
            <Menu size={16} />
          </Button>
        </header>

        {/* Scrollable Area */}
        <div className="lg:pt-0 pt-14 h-screen overflow-y-auto">
          <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
