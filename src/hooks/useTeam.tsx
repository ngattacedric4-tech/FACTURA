import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { TeamMember, TeamRole } from '@/types/database';

export function useTeam() {
  const { company } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!company) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at');
    setMembers((data ?? []) as TeamMember[]);
    setLoading(false);
  }, [company]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function inviteMember(email: string, role: Exclude<TeamRole, 'owner'>) {
    if (!company) throw new Error('Aucune entreprise');
    const token = crypto.randomUUID();
    const { error } = await supabase.from('team_members').insert({
      company_id: company.id,
      invited_email: email.toLowerCase().trim(),
      role,
      invite_token: token,
    });
    if (error) throw error;
    await fetchMembers();
    return token;
  }

  async function updateRole(memberId: string, role: TeamRole) {
    const { error } = await supabase.from('team_members').update({ role }).eq('id', memberId);
    if (error) throw error;
    await fetchMembers();
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) throw error;
    await fetchMembers();
  }

  return { members, loading, refresh: fetchMembers, inviteMember, updateRole, removeMember };
}
