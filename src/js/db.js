// CardVault — IndexedDB Wrapper
// Uses idb library from CDN

import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@8/build/index.js';

const DB_NAME = 'cardvault';
const DB_VERSION = 1;

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // My personal card
        if (!db.objectStoreNames.contains('myCard')) {
          db.createObjectStore('myCard');
        }
        // Saved contacts
        if (!db.objectStoreNames.contains('contacts')) {
          const store = db.createObjectStore('contacts', { keyPath: 'id' });
          store.createIndex('name', 'name');
          store.createIndex('company', 'company');
          store.createIndex('createdAt', 'createdAt');
        }
        // Card images (front/back)
        if (!db.objectStoreNames.contains('cardImages')) {
          db.createObjectStore('cardImages', { keyPath: 'contactId' });
        }
        // Pending sync queue
        if (!db.objectStoreNames.contains('pendingSync')) {
          db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
        }
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
  return await db.getAll('contacts');
}

export async function getContact(id) {
  const db = await getDB();
  return await db.get('contacts', id);
}

export async function saveContact(contact) {
  const db = await getDB();
  await db.put('contacts', contact);
}

export async function deleteContact(id) {
  const db = await getDB();
  await db.delete('contacts', id);
}

export async function bulkPutContacts(contacts) {
  const db = await getDB();
  const tx = db.transaction('contacts', 'readwrite');
  await Promise.all(contacts.map(c => tx.store.put(c)));
  await tx.done;
}

export async function replaceAllContacts(contacts) {
  const db = await getDB();
  const tx = db.transaction('contacts', 'readwrite');
  await tx.store.clear();
  await Promise.all((contacts || []).map(c => tx.store.put(c)));
  await tx.done;
}

// ===== Card Images =====

export async function getCardImages(contactId) {
  const db = await getDB();
  return await db.get('cardImages', contactId) || null;
}

export async function saveCardImages(contactId, front, back) {
  const db = await getDB();
  await db.put('cardImages', { contactId, front: front || null, back: back || null });
}

export async function deleteCardImages(contactId) {
  const db = await getDB();
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
    timestamp: new Date().toISOString()
  });
}

export async function getAllPendingSync() {
  const db = await getDB();
  return await db.getAll('pendingSync');
}


export async function updatePendingSync(id, patch) {
  const db = await getDB();
  const existing = await db.get('pendingSync', id);
  if (!existing) return;
  await db.put('pendingSync', { ...existing, ...patch, id });
}

export async function deletePendingSync(id) {
  const db = await getDB();
  await db.delete('pendingSync', id);
}

export async function clearPendingSync() {
  const db = await getDB();
  await db.clear('pendingSync');
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
