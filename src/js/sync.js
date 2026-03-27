// CardVault — Offline Sync Engine (Supabase + Sheets)

import {
  getAllPendingSync,
  deletePendingSync,
  getAllContacts,
  replaceAllContacts,
  getCardImages,
  saveContact
} from './db.js';
import { uploadCardImage } from './supabase-api.js';
import { isSupabaseConfigured } from './supabase-client.js';
import { getSession } from './supabase-auth.js';
import {
  addContactToProvider,
  updateContactInProvider,
  deleteContactFromProvider,
  fetchContactsFromProvider,
  getConfiguredActiveProviders
} from './remote-sync-api.js';
import { showToast } from '../components/toast.js';

function canUseProvider(provider, session) {
  if (provider === 'supabase') return isSupabaseConfigured() && Boolean(session);
  if (provider === 'sheets') return true;
  return false;
}

async function syncSingleAction(action, contactId, data, targets = []) {
  const normalizedTargets = (targets || []).length ? targets : getConfiguredActiveProviders();

  if (normalizedTargets.length === 0) {
    throw new Error('No sync providers configured');
  }

  for (const provider of normalizedTargets) {
    if (action === 'delete') {
      await deleteContactFromProvider(provider, contactId);
      continue;
    }

    const contact = { ...(data || {}) };
    if (!contact?.id) continue;

    if (provider === 'supabase') {
      const imageRecord = await getCardImages(contact.id);
      if (imageRecord?.front && !contact.frontImagePath) {
        contact.frontImagePath = await uploadCardImage(contact.id, 'front', imageRecord.front);
      }
      if (imageRecord?.back && !contact.backImagePath) {
        contact.backImagePath = await uploadCardImage(contact.id, 'back', imageRecord.back);
      }
    }

    const saved = action === 'update'
      ? await updateContactInProvider(provider, contact)
      : await addContactToProvider(provider, contact);

    if (provider === 'supabase' && saved) {
      await saveContact(saved);
    }
  }
}

async function queueOrSync(action, contactId, data = null) {
  const { addPendingSync } = await import('./db.js');
  const session = await getSession();
  const activeProviders = getConfiguredActiveProviders();
  const availableProviders = activeProviders.filter((provider) => canUseProvider(provider, session));

  if (availableProviders.length === 0) {
    await addPendingSync(action, contactId, data, activeProviders);
    return { synced: false, reason: 'auth/config missing' };
  }

  if (!navigator.onLine) {
    await addPendingSync(action, contactId, data, availableProviders);
    return { synced: false, reason: 'offline' };
  }

  try {
    await syncSingleAction(action, contactId, data, availableProviders);
    return { synced: true, reason: '' };
  } catch (error) {
    await addPendingSync(action, contactId, data, availableProviders);
    return { synced: false, reason: error.message || 'sync failed' };
  }
}

export async function syncContact(contact) {
  return queueOrSync('add', contact.id, contact);
}

export async function syncUpdate(contact) {
  return queueOrSync('update', contact.id, contact);
}

export async function syncDelete(contactId) {
  return queueOrSync('delete', contactId, null);
}

export async function exportAllToActiveBackends() {
  const contacts = (await getAllContacts()).filter((c) => !c.pendingDelete);
  let exported = 0;
  let failed = 0;

  for (const contact of contacts) {
    const result = await queueOrSync('add', contact.id, contact);
    if (result.synced) exported += 1;
    else failed += 1;
  }

  return { total: contacts.length, exported, failed };
}

export async function importContactsFromProvider(provider = 'supabase', replaceLocal = true) {
  if (!navigator.onLine) throw new Error('Device is offline');

  const all = await fetchContactsFromProvider(provider);
  if (replaceLocal) {
    await replaceAllContacts(all);
  }

  return { imported: all.length, replaceLocal, provider };
}

export async function flushSyncQueue() {
  if (!navigator.onLine) return;
  const session = await getSession();
  const activeProviders = getConfiguredActiveProviders();
  if (activeProviders.length === 0) return;

  const availableProviders = activeProviders.filter((provider) => canUseProvider(provider, session));
  if (availableProviders.length === 0) return;

  const pending = await getAllPendingSync();
  if (pending.length === 0) return;

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const targets = (item.targets || []).length ? item.targets : availableProviders;
      const filteredTargets = targets.filter((provider) => availableProviders.includes(provider));
      await syncSingleAction(item.action, item.contactId, item.data, filteredTargets);
      await deletePendingSync(item.id);
      synced += 1;
    } catch (_error) {
      failed += 1;
    }
  }

  if (synced > 0) {
    showToast(`Synced ${synced} queued item${synced > 1 ? 's' : ''}`, 'success', false);
  }
  if (failed > 0) {
    showToast(`${failed} queued item${failed > 1 ? 's' : ''} still pending.`, 'warning');
  }
}

export async function getPendingSyncCount() {
  const pending = await getAllPendingSync();
  return pending.length;
}

export function getSyncModeLabel() {
  const providers = getConfiguredActiveProviders();
  return providers.length > 0 ? providers.join(' + ') : 'No provider configured';
}
