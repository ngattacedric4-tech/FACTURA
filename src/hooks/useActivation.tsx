import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface ActivationState {
  enforced: boolean;
  expiresAt: string | null;
  plan: string | null;
  active: boolean;
  daysLeft: number;
  minutesLeft: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useActivation(): ActivationState {
  const { company } = useAuth();
  const [enforced, setEnforced] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: settingRow }, activationRes] = await Promise.all([
        supabase.from('platform_settings').select('value').eq('key', 'activation_enforced').maybeSingle(),
        company
          ? supabase.from('company_activations').select('plan, expires_at').eq('company_id', company.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setEnforced((settingRow?.value || 'false') === 'true');
      setExpiresAt((activationRes.data as any)?.expires_at ?? null);
      setPlan((activationRes.data as any)?.plan ?? null);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const now = Date.now();
  const expMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  const active = expMs > now;
  const minutesLeft = active ? Math.ceil((expMs - now) / 60_000) : 0;
  const daysLeft    = active ? Math.ceil((expMs - now) / 86_400_000) : 0;

  return { enforced, expiresAt, plan, active, daysLeft, minutesLeft, loading, refresh: fetchAll };
}
