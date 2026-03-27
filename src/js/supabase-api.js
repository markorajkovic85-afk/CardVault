// CardVault — Supabase API

import { getSupabaseClient } from './supabase-client.js';
import { toScopedContactPayload } from './contact-scope.js';
import { buildTopCompanies, buildTopOccasions, buildTrend30Days } from './dashboard-utils.js';

function getActiveUserId() {
  return localStorage.getItem('cardvault.activeUserId') || '';
}

function mapRowToContact(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || '',
    title: row.title || '',
    company: row.company || '',
    email: row.email || '',
    phone: row.phone || '',
    website: row.website || '',
    occasion: row.occasion || '',
    date: row.date || '',
    notes: row.notes || '',
    imageData: row.image_data || '',
    frontImagePath: row.front_image_path || null,
    backImagePath: row.back_image_path || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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
  return { contacts: (data || []).map(mapRowToContact), total: count || 0 };
}

export async function fetchContactById(contactId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .maybeSingle();

  if (error) throw error;
  return mapRowToContact(data);
}

export async function upsertContact(contact) {
  const supabase = getSupabaseClient();
  const userId = getActiveUserId();
  if (!userId) throw new Error('No active user. Sign in before syncing.');

  const payload = toScopedContactPayload(contact, userId);

  const { data, error } = await supabase
    .from('contacts')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapRowToContact(data);
}

export async function deleteContactRemote(contactId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId);

  if (error) throw error;
}

export async function uploadCardImage(contactId, side, dataUrl) {
  if (!dataUrl) return null;

  const supabase = getSupabaseClient();
  const userId = getActiveUserId();
  if (!userId) throw new Error('No active user. Sign in before uploading images.');

  const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (!mimeMatch) throw new Error('Invalid image format');
  const mimeType = mimeMatch[1];
  const extension = mimeType.split('/')[1] || 'png';
  const base64 = dataUrl.split(',')[1] || '';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const path = `${userId}/${contactId}-${side}.${extension}`;
  const { error } = await supabase.storage
    .from('card-images')
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: true
    });

  if (error) throw error;
  return path;
}

export async function getSignedImageUrl(path, expiresInSeconds = 3600) {
  if (!path) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from('card-images')
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data?.signedUrl || null;
}

export async function getDashboardStats() {
  const supabase = getSupabaseClient();
  const userId = getActiveUserId();
  if (!userId) {
    return {
      totalContacts: 0,
      contactsThisWeek: 0,
      contactsLastWeek: 0,
      contactsThisMonth: 0,
      distinctCompanies: 0,
      topOccasions: [],
      topCompanies: [],
      recentContacts: [],
      trend30Days: buildTrend30Days([])
    };
  }

  const { data: rows, error } = await supabase
    .from('contacts')
    .select('name, email, company, occasion, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);

  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(now.getDate() - 7);

  const monthAgo = new Date(now);
  monthAgo.setMonth(now.getMonth() - 1);

  const safeRows = rows || [];
  const companies = new Set(
    safeRows
      .map((row) => (row.company || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const createdDate = (row) => new Date(row.created_at);
  const thisWeekContacts = safeRows.filter((row) => createdDate(row) >= weekAgo);
  const lastWeekContacts = safeRows.filter((row) => {
    const created = createdDate(row);
    return created >= twoWeeksAgo && created < lastWeekStart;
  });

  return {
    totalContacts: safeRows.length,
    contactsThisWeek: thisWeekContacts.length,
    contactsLastWeek: lastWeekContacts.length,
    contactsThisMonth: safeRows.filter((row) => createdDate(row) >= monthAgo).length,
    distinctCompanies: companies.size,
    topOccasions: buildTopOccasions(safeRows),
    topCompanies: buildTopCompanies(safeRows),
    recentContacts: safeRows
      .filter((row) => row.name || row.email)
      .slice(0, 5)
      .map((row) => ({
        name: row.name || 'Unknown',
        email: row.email || '',
        company: row.company || '',
        created_at: row.created_at
      })),
    trend30Days: buildTrend30Days(safeRows, now)
  };
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
  const normalized = {
    name: cardData?.name || '',
    title: cardData?.title || '',
    company: cardData?.company || '',
    email: cardData?.email || '',
    phone: cardData?.phone || '',
    website: cardData?.website || '',
    // Keep metadata small and deterministic across devices.
    // Photos are stored locally and can exceed metadata limits.
    photo: ''
  };

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      data: { myCard: normalized }
    });
    if (error) throw error;
    return { synced: true, error: '' };
  } catch (err) {
    console.warn('Failed to sync myCard to Supabase:', err.message);
    return { synced: false, error: err.message || 'Failed to sync my card' };
  }
}
