// CardVault — Offline Sync Engine

import { getAllPendingSync, deletePendingSync } from './db.js';
import { addContact, deleteContactFromSheets, updateContactInSheets } from './sheets-api.js';
import { showToast } from '../components/toast.js';

/**
 * Try to sync a contact to Google Sheets. If offline, queue it.
 */
export async function syncContact(contact) {
  const { addPendingSync } = await import('./db.js');

  if (!navigator.onLine) {
    await addPendingSync('add', contact.id, contact);
    return { synced: false, reason: 'offline' };
  }

  try {
    await addContact(contact);
    return { synced: true };
  } catch (err) {
    await addPendingSync('add', contact.id, contact);
    return { synced: false, reason: err.message };
  }
}

/**
 * Try to delete from Sheets. If offline, queue it.
 */
export async function syncDelete(contactId) {
  const { addPendingSync } = await import('./db.js');

  if (!navigator.onLine) {
    await addPendingSync('delete', contactId);
    return { synced: false, reason: 'offline' };
  }

  try {
    await deleteContactFromSheets(contactId);
    return { synced: true };
  } catch (err) {
    await addPendingSync('delete', contactId);
    return { synced: false, reason: err.message };
  }
}

/**
 * Flush all pending sync operations
 */
export async function flushSyncQueue() {
  if (!navigator.onLine) return;

  const pending = await getAllPendingSync();
  if (pending.length === 0) return;

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      switch (item.action) {
        case 'add':
          await addContact(item.data);
          break;
        case 'delete':
          await deleteContactFromSheets(item.contactId);
          break;
        case 'update':
          await updateContactInSheets(item.data);
          break;
      }
      await deletePendingSync(item.id);
      synced++;
    } catch (err) {
      console.warn('Sync failed for item:', item.id, err);
      failed++;
    }
  }

  if (synced > 0) {
    showToast(`Synced ${synced} contact${synced > 1 ? 's' : ''} to Google Sheets`, 'success', false);
  }
  if (failed > 0) {
    showToast(`${failed} item${failed > 1 ? 's' : ''} failed to sync. Will retry later.`, 'warning');
  }
}

/**
 * Get count of pending sync items
 */
export async function getPendingSyncCount() {
  const pending = await getAllPendingSync();
  return pending.length;
}
