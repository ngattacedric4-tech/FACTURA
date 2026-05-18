import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { PlanId, PLAN_LIMITS, PlanLimits } from '@/lib/plans';

export interface UsageCounters {
  invoicesThisMonth: number;
  estimatesThisMonth: number;
  clientsCount: number;
  productsCount: number;
}

interface PlanContextValue {
  plan: PlanId;
  limits: PlanLimits;
  usage: UsageCounters;
  loading: boolean;
  canCreate: (kind: 'invoice' | 'estimate' | 'client' | 'product') => boolean;
  refresh: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { company } = useAuth();
  const [plan, setPlan] = useState<PlanId>('starter');
  const [usage, setUsage] = useState<UsageCounters>({ invoicesThisMonth: 0, estimatesThisMonth: 0, clientsCount: 0, productsCount: 0 });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!company) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('company_id', company.id)
        .maybeSingle();
      if (sub?.plan) setPlan(sub.plan as PlanId);
      else setPlan('starter');

      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [invs, ests, cls, prs] = await Promise.all([
        supabase.from('invoices').select('id', { count: 'exact', head: true })
          .eq('company_id', company.id).eq('type', 'invoice').gte('created_at', startMonth),
        supabase.from('invoices').select('id', { count: 'exact', head: true })
          .eq('company_id', company.id).eq('type', 'estimate').gte('created_at', startMonth),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
      ]);

      setUsage({
        invoicesThisMonth: invs.count || 0,
        estimatesThisMonth: ests.count || 0,
        clientsCount: cls.count || 0,
        productsCount: prs.count || 0,
      });
    } finally { setLoading(false); }
  }, [company]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const limits: PlanLimits = PLAN_LIMITS[plan];

  const canCreate = (kind: 'invoice' | 'estimate' | 'client' | 'product'): boolean => {
    if (kind === 'invoice')  return usage.invoicesThisMonth  < limits.invoicesPerMonth;
    if (kind === 'estimate') return usage.estimatesThisMonth < limits.estimatesPerMonth;
    if (kind === 'client')   return usage.clientsCount       < limits.clients;
    if (kind === 'product')  return usage.productsCount      < limits.products;
    return true;
  };

  return (
    <PlanContext.Provider value={{ plan, limits, usage, loading, canCreate, refresh: fetchAll }}>
      {children}
    </PlanContext.Provider>
  );
};

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within <PlanProvider>');
  return ctx;
}
