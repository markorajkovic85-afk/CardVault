import { getSupabaseClient } from './supabase-client.js';
import { requireSession } from './supabase-auth.js';
import { toScopedContactPayload } from './contact-scope.js';
import { buildTopOccasions, buildTrend30Days } from './dashboard-utils.js';

const CONTACTS_TABLE = 'contacts';
const BUCKET = 'card-images';

function mapContactFromDb(row) {
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
    frontImagePath: row.front_image_path || '',
    backImagePath: row.back_image_path || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    buffer[i] = bytes.charCodeAt(i);
  }
  return new Blob([buffer], { type: contentType });
}


export async function fetchContactsPage({ page = 1, pageSize = 50 } = {}) {
  const session = await requireSession();
  const supabase = getSupabaseClient();
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from(CONTACTS_TABLE)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    contacts: (data || []).map(mapContactFromDb),
    total: count || 0,
    page,
    pageSize,
    userId: session.user.id
  };
}

export async function fetchContactById(id) {
  await requireSession();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(CONTACTS_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return mapContactFromDb(data);
}

export async function upsertContact(contact) {
  const session = await requireSession();
  const supabase = getSupabaseClient();
  const payload = toScopedContactPayload({ ...contact, updatedAt: new Date().toISOString() }, session.user.id);

  const { data, error } = await supabase
    .from(CONTACTS_TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapContactFromDb(data);
}

export async function deleteContactRemote(contactId) {
  await requireSession();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(CONTACTS_TABLE).delete().eq('id', contactId);
  if (error) throw error;
}

export async function uploadCardImage(contactId, side, dataUrl) {
  if (!dataUrl) return '';
  const session = await requireSession();
  const supabase = getSupabaseClient();
  const path = `${session.user.id}/${contactId}/${side}.jpg`;
  const blob = dataUrlToBlob(dataUrl);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
  if (error) throw error;

  return path;
}

export async function getSignedImageUrl(path, expiresIn = 3600) {
  if (!path) return '';
  await requireSession();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || '';
}

export async function getDashboardStats() {
  await requireSession();
  const supabase = getSupabaseClient();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setMonth(now.getMonth() - 1);
  const trendStart = new Date(now);
  trendStart.setDate(now.getDate() - 29);

  const [totalRes, weekRes, monthRes, companiesRes, occasionsRes, trendRes] = await Promise.all([
    supabase.from(CONTACTS_TABLE).select('id', { count: 'exact', head: true }),
    supabase.from(CONTACTS_TABLE).select('id', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
    supabase.from(CONTACTS_TABLE).select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
    supabase.from(CONTACTS_TABLE).select('company').neq('company', ''),
    supabase.from(CONTACTS_TABLE).select('occasion').neq('occasion', ''),
    supabase.from(CONTACTS_TABLE).select('created_at').gte('created_at', trendStart.toISOString())
  ]);

  [totalRes, weekRes, monthRes, companiesRes, occasionsRes, trendRes].forEach((res) => {
    if (res.error) throw res.error;
  });

  const distinctCompanies = new Set((companiesRes.data || []).map((c) => (c.company || '').trim()).filter(Boolean));

  const topOccasions = buildTopOccasions(occasionsRes.data || []);
  const trend30Days = buildTrend30Days(trendRes.data || [], now);

  return {
    totalContacts: totalRes.count || 0,
    contactsThisWeek: weekRes.count || 0,
    contactsThisMonth: monthRes.count || 0,
    distinctCompanies: distinctCompanies.size,
    topOccasions,
    trend30Days
  };
}
