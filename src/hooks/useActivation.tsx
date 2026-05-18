import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { CompanyActivation } from '@/types/database';

export interface ActivationState {
  loading: boolean;
  enforced: boolean;                // kill switch global
  activation: CompanyActivation | null;
  expiresAt: Date | null;
  daysLeft: number;                 // négatif si expiré
  activated: boolean;               // true si non-enforced OU expires_at > now
  refresh: () => Promise<void>;
}

export function useActivation(): ActivationState {
  const { company, user } = useAuth();
  const [activation, setActivation] = useState<CompanyActivation | null>(null);
  const [enforced, setEnforced] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user || !company) {
      setActivation(null);
      setEnforced(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [actRes, settingRes] = await Promise.all([
        supabase
          .from('company_activations')
          .select('*')
          .eq('company_id', company.id)
          .maybeSingle(),
        supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'activation_enforced')
          .maybeSingle(),
      ]);
      setActivation((actRes.data as CompanyActivation | null) ?? null);
      setEnforced(settingRes.data?.value === 'true');
    } catch {
      setActivation(null);
      setEnforced(false);
    } finally {
      setLoading(false);
    }
  }, [user, company]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const expiresAt = activation ? new Date(activation.expires_at) : null;
  const now = Date.now();
  const msLeft = expiresAt ? expiresAt.getTime() - now : -1;
  const daysLeft = expiresAt ? Math.ceil(msLeft / 86_400_000) : -Infinity;
  const isValid = !!expiresAt && expiresAt.getTime() > now;

  // Si kill switch OFF, on considère toujours activé (pas de blocage).
  // Si ON, on exige une activation valide.
  const activated = !enforced || isValid;

  return { loading, enforced, activation, expiresAt, daysLeft, activated, refresh: fetchAll };
}
