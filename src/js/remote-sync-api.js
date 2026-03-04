import { testConnection, fetchContacts, addContact, updateContactInSheets, deleteContactFromSheets, isConfigured as isSheetsConfigured } from './sheets-api.js';
import { testNotionConnection, fetchNotionContacts, addContactToNotion, updateContactInNotion, deleteContactFromNotion, isNotionConfigured } from './notion-api.js';

export function getSyncProvider() {
  return localStorage.getItem('syncProvider') || 'sheets';
}

export function setSyncProvider(provider) {
  localStorage.setItem('syncProvider', provider);
}

export function isSyncConfigured() {
  return getSyncProvider() === 'notion' ? isNotionConfigured() : isSheetsConfigured();
}

export async function testSyncConnection() {
  return getSyncProvider() === 'notion' ? testNotionConnection() : testConnection();
}

export async function fetchRemoteContacts() {
  return getSyncProvider() === 'notion' ? fetchNotionContacts() : fetchContacts();
}

export async function addRemoteContact(contact) {
  return getSyncProvider() === 'notion' ? addContactToNotion(contact) : addContact(contact);
}

export async function updateRemoteContact(contact) {
  return getSyncProvider() === 'notion' ? updateContactInNotion(contact) : updateContactInSheets(contact);
}

export async function deleteRemoteContact(contactId) {
  return getSyncProvider() === 'notion' ? deleteContactFromNotion(contactId) : deleteContactFromSheets(contactId);
}
