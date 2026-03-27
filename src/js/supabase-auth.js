import { getSupabaseClient, isSupabaseConfigured } from './supabase-client.js';

const ACTIVE_USER_KEY = 'cardvault.activeUserId';

export function getActiveUserId() {
  return localStorage.getItem(ACTIVE_USER_KEY) || '';
}

function setActiveUserId(userId) {
  if (userId) localStorage.setItem(ACTIVE_USER_KEY, userId);
  else localStorage.removeItem(ACTIVE_USER_KEY);
}

export async function getSession() {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session || null;
  setActiveUserId(session?.user?.id || '');
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

export async function signUpWithEmail(email, password) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  setActiveUserId(data?.user?.id || data?.session?.user?.id || '');
  return data;
}

export async function signInWithEmail(email, password) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  setActiveUserId(data?.user?.id || '');
  return data;
}

export async function signOut() {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  setActiveUserId('');
  if (error) throw error;
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured()) {
    callback('SIGNED_OUT', null);
    return () => {};
  }
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    setActiveUserId(session?.user?.id || '');
    callback(event, session);
  });
  return () => data.subscription.unsubscribe();
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error('AUTH_REQUIRED');
  return session;
}
