// CardVault — Offline Sync Engine (Supabase)

import {
  getAllPendingSync,
  deletePendingSync,
  getAllContacts,
  replaceAllContacts,
  getCardImages,
  saveContact
} from './db.js';
import {
  fetchContactsPage,
  upsertContact,
  deleteContactRemote,
  uploadCardImage
} from './supabase-api.js';
import { isSupabaseConfigured } from './supabase-client.js';
import { getSession } from './supabase-auth.js';
import { showToast } from '../components/toast.js';

async function syncSingleAction(action, contactId, data) {
  if (action === 'delete') {
    await deleteContactRemote(contactId);
    return;
  }

  const contact = { ...(data || {}) };
  if (!contact?.id) return;

  const imageRecord = await getCardImages(contact.id);
  if (imageRecord?.front && !contact.frontImagePath) {
    contact.frontImagePath = await uploadCardImage(contact.id, 'front', imageRecord.front);
  }
  if (imageRecord?.back && !contact.backImagePath) {
    contact.backImagePath = await uploadCardImage(contact.id, 'back', imageRecord.back);
  }

  const saved = await upsertContact(contact);
  await saveContact(saved);
}

async function queueOrSync(action, contactId, data = null) {
  const { addPendingSync } = await import('./db.js');
  const session = await getSession();

  if (!isSupabaseConfigured() || !session) {
    await addPendingSync(action, contactId, data, ['supabase']);
    return { synced: false, reason: 'auth/config missing' };
  }

  if (!navigator.onLine) {
    await addPendingSync(action, contactId, data, ['supabase']);
    return { synced: false, reason: 'offline' };
  }

  try {
    await syncSingleAction(action, contactId, data);
    return { synced: true, reason: '' };
  } catch (error) {
    await addPendingSync(action, contactId, data, ['supabase']);
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

export async function importContactsFromProvider(_provider, replaceLocal = true) {
  if (!navigator.onLine) throw new Error('Device is offline');

  const all = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetchContactsPage({ page, pageSize: 200 });
    all.push(...res.contacts);
    hasMore = all.length < res.total;
    page += 1;
  }

  if (replaceLocal) {
    await replaceAllContacts(all);
  }

  return { imported: all.length, replaceLocal };
}

export async function flushSyncQueue() {
  if (!navigator.onLine || !isSupabaseConfigured()) return;
  const session = await getSession();
  if (!session) return;

  const pending = await getAllPendingSync();
  if (pending.length === 0) return;

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await syncSingleAction(item.action, item.contactId, item.data);
      await deletePendingSync(item.id);
      synced += 1;
    } catch (error) {
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
  return 'Supabase';
}
