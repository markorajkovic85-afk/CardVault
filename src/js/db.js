// CardVault — IndexedDB Wrapper
// Uses idb library from CDN

import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@8/build/index.js';

const DB_NAME = 'cardvault';
const DB_VERSION = 2;

let dbPromise;

function getActiveUserId() {
  return localStorage.getItem('cardvault.activeUserId') || 'anonymous';
}

function sanitizeContactForCache(contact) {
  if (!contact || typeof contact !== 'object') return contact;
  return {
    ...contact,
    userId: contact.userId || getActiveUserId()
  };
}

function belongsToActiveUser(record) {
  if (!record || typeof record !== 'object') return false;
  const activeUserId = getActiveUserId();
  return (record.userId || activeUserId) === activeUserId;
}

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        // contacts store
        if (!db.objectStoreNames.contains('contacts')) {
          const store = db.createObjectStore('contacts', { keyPath: 'id' });
          store.createIndex('name', 'name');
          store.createIndex('company', 'company');
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('userId', 'userId');
        } else if (oldVersion < 2) {
          const store = tx.objectStore('contacts');
          if (!store.indexNames.contains('userId')) {
            store.createIndex('userId', 'userId');
          }
        }

        // myCard store
        if (!db.objectStoreNames.contains('myCard')) {
          db.createObjectStore('myCard');
        }

        // cardImages store
        if (!db.objectStoreNames.contains('cardImages')) {
          const store = db.createObjectStore('cardImages', { keyPath: 'contactId' });
          store.createIndex('userId', 'userId');
        } else if (oldVersion < 2) {
          const store = tx.objectStore('cardImages');
          if (!store.indexNames.contains('userId')) {
            store.createIndex('userId', 'userId');
          }
        }

        // pendingSync store
        if (!db.objectStoreNames.contains('pendingSync')) {
          const store = db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
          store.createIndex('userId', 'userId');
        } else if (oldVersion < 2) {
          const store = tx.objectStore('pendingSync');
          if (!store.indexNames.contains('userId')) {
            store.createIndex('userId', 'userId');
          }
        }
      },
      // When another tab/device opens a newer DB version, reload this tab gracefully
      blocking() {
        if (dbPromise) {
          dbPromise = null;
        }
      },
      blocked() {
        console.warn('CardVault DB upgrade blocked by another tab. Please close other tabs.');
      },
      terminated() {
        dbPromise = null;
        // Reload the page so the user gets a fresh DB connection
        window.location.reload();
      }
    });
  }
  return dbPromise;
}

// ===== My Card =====

export async function getMyCard() {
  const db = await getDB();
  return await db.get('myCard', 'default') || null;
}

export async function saveMyCard(data) {
  const db = await getDB();
  await db.put('myCard', data, 'default');
}

// ===== Contacts =====

export async function getAllContacts() {
  const db = await getDB();
  const all = await db.getAll('contacts');
  return all.filter(belongsToActiveUser);
}

export async function getContact(id) {
  const db = await getDB();
  const record = await db.get('contacts', id);
  return belongsToActiveUser(record) ? record : null;
}

export async function saveContact(contact) {
  const db = await getDB();
  await db.put('contacts', sanitizeContactForCache(contact));
}

export async function deleteContact(id) {
  const db = await getDB();
  const record = await db.get('contacts', id);
  if (!belongsToActiveUser(record)) return;
  await db.delete('contacts', id);
}

export async function bulkPutContacts(contacts) {
  const db = await getDB();
  const tx = db.transaction('contacts', 'readwrite');
  await Promise.all((contacts || []).map((c) => tx.store.put(sanitizeContactForCache(c))));
  await tx.done;
}

export async function replaceAllContacts(contacts) {
  const db = await getDB();
  const all = await db.getAll('contacts');
  const tx = db.transaction('contacts', 'readwrite');

  await Promise.all(all.filter(belongsToActiveUser).map((c) => tx.store.delete(c.id)));
  await Promise.all((contacts || []).map((c) => tx.store.put(sanitizeContactForCache(c))));

  await tx.done;
}

// ===== Card Images =====

export async function getCardImages(contactId) {
  const db = await getDB();
  const record = await db.get('cardImages', contactId);
  return belongsToActiveUser(record) ? record : null;
}

export async function saveCardImages(contactId, front, back) {
  const db = await getDB();
  await db.put('cardImages', {
    contactId,
    userId: getActiveUserId(),
    front: front || null,
    back: back || null
  });
}

export async function deleteCardImages(contactId) {
  const db = await getDB();
  const record = await db.get('cardImages', contactId);
  if (!belongsToActiveUser(record)) return;
  await db.delete('cardImages', contactId);
}

// ===== Pending Sync =====

export async function addPendingSync(action, contactId, data = null, targets = null) {
  const db = await getDB();
  await db.add('pendingSync', {
    action,
    contactId,
    data,
    targets,
    userId: getActiveUserId(),
    timestamp: new Date().toISOString()
  });
}

export async function getAllPendingSync() {
  const db = await getDB();
  const all = await db.getAll('pendingSync');
  return all.filter(belongsToActiveUser);
}

export async function updatePendingSync(id, patch) {
  const db = await getDB();
  const existing = await db.get('pendingSync', id);
  if (!existing || !belongsToActiveUser(existing)) return;
  await db.put('pendingSync', { ...existing, ...patch, id });
}

export async function deletePendingSync(id) {
  const db = await getDB();
  const existing = await db.get('pendingSync', id);
  if (!existing || !belongsToActiveUser(existing)) return;
  await db.delete('pendingSync', id);
}

export async function clearPendingSync() {
  const db = await getDB();
  const tx = db.transaction('pendingSync', 'readwrite');
  const all = await tx.store.getAll();
  await Promise.all(all.filter(belongsToActiveUser).map((item) => tx.store.delete(item.id)));
  await tx.done;
}

// ===== Utility =====

export async function getStorageEstimate() {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    return {
      usage: est.usage || 0,
      quota: est.quota || 0
    };
  }
  return { usage: 0, quota: 0 };
}
