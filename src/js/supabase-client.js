import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

let cachedClient = null;

export function getSupabaseConfig() {
  const runtimeConfig = window.__CARDVAULT_CONFIG__ || {};
  const url = runtimeConfig.supabaseUrl || localStorage.getItem('supabaseUrl') || '';
  const anonKey = runtimeConfig.supabaseAnonKey || localStorage.getItem('supabaseAnonKey') || '';
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

export function saveSupabaseConfig({ url, anonKey }) {
  if (url) localStorage.setItem('supabaseUrl', url.trim());
  if (anonKey) localStorage.setItem('supabaseAnonKey', anonKey.trim());
  cachedClient = null;
}

export function clearSupabaseConfig() {
  localStorage.removeItem('supabaseUrl');
  localStorage.removeItem('supabaseAnonKey');
  cachedClient = null;
}

export function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error('Supabase is not configured. Add URL and anon key in Settings.');
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'cardvault.auth'
    }
  });

  return cachedClient;
}
