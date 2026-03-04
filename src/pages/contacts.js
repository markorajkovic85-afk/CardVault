// CardVault — Contacts List Page

import { getAllContacts, deleteContact as dbDeleteContact, deleteCardImages, bulkPutContacts, getAllPendingSync } from '../js/db.js';
import { fetchContacts, isConfigured } from '../js/sheets-api.js';
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

  // Try refreshing from Sheets in background — merge, don't replace
  if (navigator.onLine && isConfigured()) {
    try {
      const remote = await fetchContacts();
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
      console.warn('Failed to refresh from Sheets:', err);
    }
  }
}

function renderList(container) {
  const filtered = filterAndSort(contacts);

  container.innerHTML = `
    <h1>Contacts</h1>
    <div class="search-container" style="position:relative;">
      <span class="search-icon" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);">&#128269;</span>
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
        ${c.email ? `<a href="mailto:${escapeHtml(c.email)}" title="Email" onclick="event.stopPropagation()">&#9993;</a>` : ''}
        ${c.phone ? `<a href="tel:${escapeHtml(c.phone)}" title="Call" onclick="event.stopPropagation()">&#9742;</a>` : ''}
        <a class="delete-trigger" data-id="${c.id}" data-name="${escapeHtml(c.name || 'this contact')}" title="Delete" style="background:var(--color-error);color:white;">&#128465;</a>
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
      <div class="icon">&#128101;</div>
      <p>No contacts saved yet.<br>Scan your first business card!</p>
      <button class="btn btn-primary mt-16" onclick="location.hash='#/scan'">Scan a Card</button>
    </div>
  `;
}
