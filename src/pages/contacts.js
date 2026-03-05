// CardVault — Contacts List Page

import { getAllContacts, deleteContact as dbDeleteContact, deleteCardImages, bulkPutContacts, getAllPendingSync } from '../js/db.js';
import { fetchContactsFromActiveProviders, isSyncConfigured, getSyncMode } from '../js/remote-sync-api.js';
import { syncDelete } from '../js/sync.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, formatDate, getInitials, debounce } from '../js/utils.js';

let contacts = [];
let searchQuery = '';
let sortBy = localStorage.getItem('sortPreference') || 'date';

export async function render(container) {
  contacts = await getAllContacts();
  contacts = contacts.filter(c => !c.pendingDelete);

  renderList(container);

  // Try refreshing from remote sync provider in background — merge, don't replace
  if (navigator.onLine && isSyncConfigured()) {
    try {
      const remote = await fetchContactsFromActiveProviders();
      if (remote && Array.isArray(remote)) {
        // Find local contacts that haven't synced to Sheets yet
        const pending = await getAllPendingSync();
        const pendingAddIds = new Set(
          pending.filter(p => p.action === 'add').map(p => p.contactId)
        );
        const remoteIds = new Set(remote.map(c => c.id));

        // Keep local-only contacts (not on Sheets and either pending sync or never synced)
        const localOnly = contacts.filter(c => !remoteIds.has(c.id));

        // Merge: remote (source of truth for synced) + local-only (not yet synced)
        const merged = [...remote, ...localOnly].filter(c => !c.pendingDelete);

        await bulkPutContacts(merged);
        contacts = merged;
        renderList(container);
      }
    } catch (err) {
      console.warn(`Failed to refresh from ${getSyncMode()}:`, err);
    }
  }
}

function renderList(container) {
  const filtered = filterAndSort(contacts);

  container.innerHTML = `
    <h1>Contacts</h1>
    <div class="search-container" style="position:relative;">
      <span class="search-icon" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
      <input class="search-input" type="text" placeholder="Search by name, company, or event..."
        value="${escapeHtml(searchQuery)}" id="search-input">
      <div class="sort-controls">
        <button class="sort-btn ${sortBy === 'date' ? 'active' : ''}" data-sort="date">Date</button>
        <button class="sort-btn ${sortBy === 'name' ? 'active' : ''}" data-sort="name">Name</button>
        <button class="sort-btn ${sortBy === 'company' ? 'active' : ''}" data-sort="company">Company</button>
      </div>
    </div>

    <div id="contacts-list">
      ${filtered.length === 0 ? renderEmpty() : filtered.map(c => renderContactItem(c)).join('')}
    </div>
  `;

  // Search
  const searchInput = container.querySelector('#search-input');
  const debouncedSearch = debounce((val) => {
    searchQuery = val;
    const listEl = container.querySelector('#contacts-list');
    const filtered = filterAndSort(contacts);
    listEl.innerHTML = filtered.length === 0 ? renderEmpty() : filtered.map(c => renderContactItem(c)).join('');
    bindContactEvents(container);
  });
  searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));

  // Sort buttons
  container.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sortBy = btn.dataset.sort;
      localStorage.setItem('sortPreference', sortBy);
      renderList(container);
    });
  });

  bindContactEvents(container);
}

function bindContactEvents(container) {
  // Click to view detail
  container.querySelectorAll('.contact-item').forEach(el => {
    el.addEventListener('click', (e) => {
      // Don't navigate if clicking action buttons
      if (e.target.closest('.contact-actions') || e.target.closest('.delete-trigger')) return;
      const id = el.dataset.id;
      location.hash = `#/contact/${id}`;
    });
  });

  // Delete buttons
  container.querySelectorAll('.delete-trigger').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      if (!confirm(`Delete ${name}'s contact?`)) return;

      try {
        await dbDeleteContact(id);
        await deleteCardImages(id);
        const result = await syncDelete(id);

        contacts = contacts.filter(c => c.id !== id);
        renderList(container);

        if (result.synced) {
          showToast('Contact deleted', 'success', false);
        } else {
          showToast('Deleted locally. Will sync when online.', 'warning', false);
        }
      } catch (err) {
        showToast(`Delete failed: ${err.message}`, 'error');
      }
    });
  });
}

function filterAndSort(list) {
  let filtered = list;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.occasion || '').toLowerCase().includes(q)
    );
  }

  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'company':
        return (a.company || '').localeCompare(b.company || '');
      case 'date':
      default:
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    }
  });

  return filtered;
}

function renderContactItem(c) {
  return `
    <div class="contact-item" data-id="${c.id}">
      <div class="contact-avatar">${getInitials(c.name)}</div>
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(c.name || 'Unknown')}</div>
        <div class="contact-company">${escapeHtml(c.company || '')}</div>
        <div class="contact-meta">${escapeHtml(c.occasion || '')} ${c.date ? '· ' + formatDate(c.date) : ''}</div>
      </div>
      <div class="contact-actions">
        ${c.email ? `<a href="mailto:${escapeHtml(c.email)}" title="Email" onclick="event.stopPropagation()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg></a>` : ''}
        ${c.phone ? `<a href="tel:${escapeHtml(c.phone)}" title="Call" onclick="event.stopPropagation()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></a>` : ''}
        <a class="delete-trigger" data-id="${c.id}" data-name="${escapeHtml(c.name || 'this contact')}" title="Delete" style="background:var(--color-error);color:white;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></a>
      </div>
    </div>
  `;
}

function renderEmpty() {
  if (searchQuery) {
    return `<div class="empty-state"><p>No contacts match "${escapeHtml(searchQuery)}"</p></div>`;
  }
  return `
    <div class="empty-state">
      <div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
      <p>No contacts saved yet.<br>Scan your first business card!</p>
      <button class="btn btn-primary mt-16" onclick="location.hash='#/scan'">Scan a Card</button>
    </div>
  `;
}
