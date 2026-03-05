import { testConnection, fetchContacts, addContact, updateContactInSheets, deleteContactFromSheets, isConfigured as isSheetsConfigured } from './sheets-api.js';
import { testNotionConnection, fetchNotionContacts, addContactToNotion, updateContactInNotion, deleteContactFromNotion, isNotionConfigured } from './notion-api.js';

const PROVIDERS = ['sheets', 'notion'];

export function getSyncMode() {
  const mode = localStorage.getItem('syncMode');
  if (mode) return mode;

  // Backward compatibility for the old key
  const legacy = localStorage.getItem('syncProvider');
  if (legacy === 'notion') return 'notion';
  return 'sheets';
}

export function setSyncMode(mode) {
  localStorage.setItem('syncMode', mode);
  localStorage.removeItem('syncProvider');
}

export function getProviderLabel(provider) {
  return provider === 'notion' ? 'Notion' : 'Google Sheets';
}

export function getActiveProviders() {
  const mode = getSyncMode();
  if (mode === 'both') return [...PROVIDERS];
  return PROVIDERS.includes(mode) ? [mode] : ['sheets'];
}

export function isProviderConfigured(provider) {
  return provider === 'notion' ? isNotionConfigured() : isSheetsConfigured();
}

export function getConfiguredActiveProviders() {
  return getActiveProviders().filter(isProviderConfigured);
}

export function isSyncConfigured() {
  return getConfiguredActiveProviders().length > 0;
}

export async function testProviderConnection(provider) {
  return provider === 'notion' ? testNotionConnection() : testConnection();
}

export async function fetchContactsFromProvider(provider) {
  return provider === 'notion' ? fetchNotionContacts() : fetchContacts();
}

export async function addContactToProvider(provider, contact) {
  return provider === 'notion' ? addContactToNotion(contact) : addContact(contact);
}

export async function updateContactInProvider(provider, contact) {
  return provider === 'notion' ? updateContactInNotion(contact) : updateContactInSheets(contact);
}

export async function deleteContactFromProvider(provider, contactId) {
  return provider === 'notion' ? deleteContactFromNotion(contactId) : deleteContactFromSheets(contactId);
}

export async function fetchContactsFromActiveProviders() {
  const providers = getConfiguredActiveProviders();
  if (providers.length === 0) return [];

  const merged = new Map();

  // Fetch all providers in parallel with a 5s timeout per provider
  const timeout = (ms) => new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
  );

  const results = await Promise.allSettled(
    providers.map(provider =>
      Promise.race([fetchContactsFromProvider(provider), timeout(5000)])
    )
  );

  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    for (const contact of result.value) {
      const existing = merged.get(contact.id);
      if (!existing) {
        merged.set(contact.id, contact);
        continue;
      }

      const existingUpdated = existing.updatedAt || existing.createdAt || '';
      const incomingUpdated = contact.updatedAt || contact.createdAt || '';
      if (incomingUpdated >= existingUpdated) {
        merged.set(contact.id, contact);
      }
    }
  }

  return Array.from(merged.values());
}
