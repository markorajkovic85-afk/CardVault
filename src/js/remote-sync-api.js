import { isSupabaseConfigured } from './supabase-client.js';
import { getSession } from './supabase-auth.js';
import {
  fetchContactsPage,
  upsertContact,
  deleteContactRemote
} from './supabase-api.js';
import {
  testConnection as testSheetsConnection,
  fetchContacts as fetchSheetsContacts,
  addContact as addContactToSheets,
  updateContactInSheets,
  deleteContactFromSheets,
  isConfigured as isSheetsConfigured
} from './sheets-api.js';

export function getSyncMode() {
  return 'multi';
}

export function setSyncMode() {
  return 'multi';
}

export function getProviderLabel() {
  const providers = getConfiguredActiveProviders();
  return providers.length > 0 ? providers.join(' + ') : 'None';
}

export function getActiveProviders() {
  return ['supabase', 'sheets'];
}

export function isProviderConfigured(provider) {
  if (provider === 'sheets') return isSheetsConfigured();
  return isSupabaseConfigured();
}

export function getConfiguredActiveProviders() {
  return getActiveProviders().filter((provider) => isProviderConfigured(provider));
}

export function isSyncConfigured() {
  return getConfiguredActiveProviders().length > 0;
}

export async function testProviderConnection(provider = 'supabase') {
  if (provider === 'sheets') {
    return testSheetsConnection();
  }

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

export async function fetchContactsFromProvider(provider = 'supabase') {
  if (provider === 'sheets') {
    return fetchSheetsContacts();
  }

  const result = await fetchContactsPage({ page: 1, pageSize: 500 });
  return result.contacts;
}

export async function addContactToProvider(provider = 'supabase', contact) {
  if (provider === 'sheets') {
    return addContactToSheets(contact);
  }
  return upsertContact(contact);
}

export async function updateContactInProvider(provider = 'supabase', contact) {
  if (provider === 'sheets') {
    return updateContactInSheets(contact);
  }
  return upsertContact(contact);
}

export async function deleteContactFromProvider(provider = 'supabase', contactId) {
  if (provider === 'sheets') {
    return deleteContactFromSheets(contactId);
  }
  return deleteContactRemote(contactId);
}

export async function fetchContactsFromActiveProviders() {
  const providers = getConfiguredActiveProviders();
  if (providers.length === 0) return [];

  const all = await Promise.allSettled(providers.map((provider) => fetchContactsFromProvider(provider)));
  const firstSuccess = all.find((result) => result.status === 'fulfilled');
  return firstSuccess?.value || [];
}
