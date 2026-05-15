import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { TeamRole } from '@/types/database';

const RANK: Record<TeamRole, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export function useRole() {
  const { user, company } = useAuth();
  const [role, setRole] = useState<TeamRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !company) { setRole(null); setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from('team_members')
        .select('role')
        .eq('company_id', company.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setRole((data?.role as TeamRole) ?? null);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [user, company]);

  function can(minRole: TeamRole): boolean {
    if (!role) return false;
    return RANK[role] >= RANK[minRole];
  }

  return { role, loading, can, isOwner: role === 'owner', isAdmin: role === 'admin' || role === 'owner' };
}
