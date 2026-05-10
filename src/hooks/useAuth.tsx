import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Company } from '@/types/database';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  loading: boolean;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  company: null,
  loading: true,
  refreshCompany: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  // undefined = pas encore initialisé, null = déconnecté, string = user ID connecté
  const lastUserIdRef = useRef<string | null | undefined>(undefined);

  const fetchCompany = async (userId: string) => {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) setCompany(data as Company);
    else setCompany(null);
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        lastUserIdRef.current = null;
        setUser(null);
        setCompany(null);
        setLoading(false);
        return;
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        const newUserId = session?.user?.id ?? null;
        const userChanged = newUserId !== lastUserIdRef.current;
        lastUserIdRef.current = newUserId;

        if (!userChanged) return; // même user qui revient d'un autre onglet — ne rien faire

        setLoading(true);
        setUser(session?.user ?? null);
        if (session?.user) {
          await Promise.race([
            fetchCompany(session.user.id),
            new Promise<void>(resolve => setTimeout(resolve, 8000)),
          ]);
        } else {
          setCompany(null);
        }
        setLoading(false);
      }
      // TOKEN_REFRESHED et autres événements → ignorer pour éviter les re-renders inutiles
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const refreshCompany = async () => {
    if (user) await fetchCompany(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, company, loading, refreshCompany }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
