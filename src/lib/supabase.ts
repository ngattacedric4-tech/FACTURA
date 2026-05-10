/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder-project.supabase.co';

const CLIENT_VERSION = 'v3-memlock';

declare global {
  // eslint-disable-next-line no-var
  var __FACTURA_SUPABASE__: { v: string; client: SupabaseClient } | undefined;
}

const memoryLock = async <T,>(_name: string, _to: number, fn: () => Promise<T>): Promise<T> => fn();

function makeClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      lock: memoryLock,
    },
  });
}

const cached = globalThis.__FACTURA_SUPABASE__;
export const supabase: SupabaseClient =
  cached && cached.v === CLIENT_VERSION
    ? cached.client
    : (globalThis.__FACTURA_SUPABASE__ = { v: CLIENT_VERSION, client: makeClient() }).client;
