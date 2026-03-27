// CardVault — Supabase API

import { getSupabaseClient } from './supabase-client.js';

function getActiveUserId() {
  return localStorage.getItem('cardvault.activeUserId') || '';
}

export async function fetchContactsPage({ page = 1, pageSize = 50 } = {}) {
  const supabase = getSupabaseClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { contacts: data || [], total: count || 0 };
}

export async function upsertContact(contact) {
  const supabase = getSupabaseClient();
  const userId = getActiveUserId();
  const payload = { ...contact, user_id: userId };

  const { data, error } = await supabase
    .from('contacts')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteContactRemote(contactId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId);

  if (error) throw error;
}

// ===== My Card (synced via Supabase user_metadata) =====

export async function fetchMyCardRemote() {
  try {
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.user_metadata?.myCard || null;
  } catch {
    return null;
  }
}

export async function saveMyCardRemote(cardData) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      data: { myCard: cardData }
    });
    if (error) throw error;
  } catch (err) {
    console.warn('Failed to sync myCard to Supabase:', err.message);
  }
}
