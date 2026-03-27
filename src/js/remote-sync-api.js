import { isSupabaseConfigured } from './supabase-client.js';
import { getSession } from './supabase-auth.js';
import { fetchContactsPage, upsertContact, deleteContactRemote } from './supabase-api.js';

export function getSyncMode() {
  return 'supabase';
}

export function setSyncMode() {
  return 'supabase';
}

export function getProviderLabel() {
  return 'Supabase';
}

export function getActiveProviders() {
  return ['supabase'];
}

export function isProviderConfigured() {
  return isSupabaseConfigured();
}

export function getConfiguredActiveProviders() {
  return isSupabaseConfigured() ? ['supabase'] : [];
}

export function isSyncConfigured() {
  return isSupabaseConfigured();
}

export async function testProviderConnection() {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase URL and anon key are required.' };
  }
  try {
    const session = await getSession();
    return {
      success: true,
      provider: 'supabase',
      authenticated: Boolean(session),
      rowCount: session ? 'Authenticated' : 'Not signed in'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchContactsFromProvider() {
  const result = await fetchContactsPage({ page: 1, pageSize: 500 });
  return result.contacts;
}

export async function addContactToProvider(_provider, contact) {
  return upsertContact(contact);
}

export async function updateContactInProvider(_provider, contact) {
  return upsertContact(contact);
}

export async function deleteContactFromProvider(_provider, contactId) {
  return deleteContactRemote(contactId);
}

export async function fetchContactsFromActiveProviders() {
  if (!isSupabaseConfigured()) return [];
  const result = await fetchContactsPage({ page: 1, pageSize: 500 });
  return result.contacts;
}
