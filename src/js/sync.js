// CardVault — Offline Sync Engine

import { getAllPendingSync, deletePendingSync, updatePendingSync, getAllContacts, bulkPutContacts, replaceAllContacts, saveContact } from './db.js';
import {
  addContactToProvider,
  deleteContactFromProvider,
  updateContactInProvider,
  isSyncConfigured,
  getConfiguredActiveProviders,
  fetchContactsFromProvider,
  getProviderLabel,
  getSyncMode
} from './remote-sync-api.js';
import { showToast } from '../components/toast.js';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncToTargets(action, contactId, data, requestedTargets = null) {
  const { addPendingSync } = await import('./db.js');

  const targets = (requestedTargets && requestedTargets.length > 0)
    ? requestedTargets
    : getConfiguredActiveProviders();

  if (targets.length === 0) {
    return { synced: false, reason: 'not configured', syncedTargets: [], failedTargets: [] };
  }

  if (!navigator.onLine) {
    await addPendingSync(action, contactId, data, targets);
    return { synced: false, reason: 'offline', syncedTargets: [], failedTargets: targets };
  }

  const failedTargets = [];
  const syncedTargets = [];

  for (const provider of targets) {
    try {
      let response;
      if (action === 'add') response = await addContactToProvider(provider, data);
      if (action === 'update') response = await updateContactInProvider(provider, data);
      if (action === 'delete') response = await deleteContactFromProvider(provider, contactId);

      if (provider === 'notion' && data && response?.notionPageId) {
        await saveContact({ ...data, notionPageId: response.notionPageId });
      }

      syncedTargets.push(provider);
    } catch (err) {
      console.warn(`Sync ${action} failed for ${provider}:`, err);
      failedTargets.push(provider);
    }
  }

  if (failedTargets.length > 0) {
    await addPendingSync(action, contactId, data, failedTargets);
  }

  return {
    synced: failedTargets.length === 0,
    reason: failedTargets.length === 0 ? '' : 'partial failure',
    syncedTargets,
    failedTargets
  };
}

/**
 * Try to sync a contact to the active backend(s). If offline or not configured, queue it.
 */
export async function syncContact(contact) {
  return syncToTargets('add', contact.id, contact);
}

/**
 * Try to delete a contact from active backend(s). If offline, queue it.
 */
export async function syncDelete(contactId) {
  return syncToTargets('delete', contactId, null);
}

/**
 * Try to update a contact in active backend(s). If offline, queue it.
 */
export async function syncUpdate(contact) {
  return syncToTargets('update', contact.id, contact);
}

/**
 * Export local contacts to active backend(s), sequentially to avoid rate-limit spikes.
 */
export async function exportAllToActiveBackends() {
  if (!navigator.onLine) throw new Error('Device is offline');
  if (!isSyncConfigured()) throw new Error('No backend configured');

  const contacts = (await getAllContacts()).filter(c => !c.pendingDelete);
  let exported = 0;
  let failed = 0;

  for (const contact of contacts) {
    const result = await syncToTargets('add', contact.id, contact);
    if (result.synced) exported++;
    else failed++;
    await wait(getSyncMode() === 'both' ? 300 : 180);
  }

  return { total: contacts.length, exported, failed };
}

/**
 * Import contacts from one provider and merge or replace local data.
 */
export async function importContactsFromProvider(provider, replaceLocal = false) {
  if (!navigator.onLine) throw new Error('Device is offline');

  const remote = await fetchContactsFromProvider(provider);
  if (!Array.isArray(remote)) throw new Error('Invalid remote response');

  if (replaceLocal) {
    await replaceAllContacts(remote);
  } else {
    await bulkPutContacts(remote);
  }

  return { imported: remote.length, replaceLocal };
}

/**
 * Flush all pending sync operations
 */
export async function flushSyncQueue() {
  if (!navigator.onLine || !isSyncConfigured()) return;

  const pending = await getAllPendingSync();
  if (pending.length === 0) return;

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    const targets = (item.targets && item.targets.length > 0)
      ? item.targets
      : getConfiguredActiveProviders();

    const result = await syncToTargets(item.action, item.contactId, item.data, targets);

    if (result.failedTargets.length === 0) {
      await deletePendingSync(item.id);
      synced++;
    } else if (result.syncedTargets.length > 0) {
      await updatePendingSync(item.id, { targets: result.failedTargets });
      synced++;
      failed++;
    } else {
      failed++;
    }
  }

  if (synced > 0) {
    showToast(`Synced ${synced} queued item${synced > 1 ? 's' : ''}`, 'success', false);
  }
  if (failed > 0) {
    showToast(`${failed} queued item${failed > 1 ? 's' : ''} still pending.`, 'warning');
  }
}

/**
 * Get count of pending sync items
 */
export async function getPendingSyncCount() {
  const pending = await getAllPendingSync();
  return pending.length;
}

export function getSyncModeLabel() {
  const mode = getSyncMode();
  if (mode === 'both') return `${getProviderLabel('sheets')} + ${getProviderLabel('notion')}`;
  return getProviderLabel(mode);
}
