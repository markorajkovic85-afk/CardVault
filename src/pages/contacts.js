// CardVault — Contacts List Page

import { getAllContacts, deleteContact as dbDeleteContact, deleteCardImages, bulkPutContacts } from '../js/db.js';
import { fetchContactsPage } from '../js/supabase-api.js';
import { isSyncConfigured } from '../js/remote-sync-api.js';
import { syncDelete } from '../js/sync.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, formatDate, getInitials, debounce } from '../js/utils.js';

let contacts = [];
let searchQuery = '';
let sortBy = localStorage.getItem('sortPreference') || 'date';
let activeFilters = {
  occasion: '',
  company: '',
  hasEmail: false,
  hasPhone: false,
  dateFrom: '',
  dateTo: '',
};
let filtersOpen = false;
let currentPage = 1;
let totalRemote = 0;
const PAGE_SIZE = 50;

function toListContact(contact) {
  if (!contact || typeof contact !== 'object') return contact;
  const sanitized = { ...contact };
  delete sanitized.imageData;
  return sanitized;
}

export async function render(container) {
  container.innerHTML = renderContactsLoading();

  const queuedFilter = localStorage.getItem('cardvault.contactsFilter');
  if (queuedFilter !== null) {
    searchQuery = queuedFilter;
    localStorage.removeItem('cardvault.contactsFilter');
  }
  currentPage = 1;
  contacts = (await getAllContacts()).map(toListContact).filter((c) => !c.pendingDelete);
  renderList(container);

  if (navigator.onLine && isSyncConfigured()) {
    await loadRemotePage(container, 1, true);
  }
}

async function loadRemotePage(container, page, replaceExisting = false) {
  const list = container.querySelector('#contacts-list');
  const syncHint = document.createElement('div');
  syncHint.className = 'text-sm text-light text-center';
  syncHint.style.padding = '8px';
  syncHint.textContent = 'Syncing...';
  if (list) list.parentNode.insertBefore(syncHint, list);

  try {
    const remote = await fetchContactsPage({ page, pageSize: PAGE_SIZE });
    totalRemote = remote.total;
    currentPage = page;

    const mergedMap = new Map((replaceExisting ? [] : contacts).map((c) => [c.id, c]));
    remote.contacts.forEach((c) => mergedMap.set(c.id, toListContact(c)));
    contacts = Array.from(mergedMap.values()).filter((c) => !c.pendingDelete);
    await bulkPutContacts(contacts);
    renderList(container);
  } catch (err) {
    console.warn('Failed to refresh from Supabase:', err);
  } finally {
    syncHint.remove();
  }
}

function renderList(container) {
  const filtered = filterAndSort(contacts);
  const canLoadMore = contacts.length < totalRemote;
  const activeCount = countActiveFilters();
  const occasions = getUniqueValues(contacts, 'occasion');
  const companies = getUniqueValues(contacts, 'company');

  container.innerHTML = `
    <div class="contacts-header">
      <h1>Contacts <span class="contact-count">${filtered.length}</span></h1>
    </div>

    <div class="search-row">
      <div class="search-container" style="position:relative;flex:1">
        <span class="search-icon" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input class="search-input" type="text" placeholder="Search name, company, event…"
          value="${escapeHtml(searchQuery)}" id="search-input">
        ${searchQuery ? `
          <button class="search-clear" id="search-clear-btn" aria-label="Clear search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        ` : ''}
      </div>

      <button class="btn btn-secondary filter-toggle-btn" id="filter-toggle-btn"
        aria-expanded="${filtersOpen}" aria-controls="filter-panel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
        Filter
        ${activeCount > 0 ? `<span class="filter-badge">${activeCount}</span>` : ''}
      </button>
    </div>

    <div class="sort-controls">
      <button class="sort-btn ${sortBy === 'date' ? 'active' : ''}" data-sort="date">Date</button>
      <button class="sort-btn ${sortBy === 'name' ? 'active' : ''}" data-sort="name">Name</button>
      <button class="sort-btn ${sortBy === 'company' ? 'active' : ''}" data-sort="company">Company</button>
    </div>

    ${activeCount > 0 ? `
      <div class="active-filters-row" id="active-filters-row">
        ${activeFilters.occasion ? `<span class="filter-pill" data-reset="occasion">Event: ${escapeHtml(activeFilters.occasion)} ✕</span>` : ''}
        ${activeFilters.company ? `<span class="filter-pill" data-reset="company">Company: ${escapeHtml(activeFilters.company)} ✕</span>` : ''}
        ${activeFilters.hasEmail ? '<span class="filter-pill" data-reset="hasEmail">Has email ✕</span>' : ''}
        ${activeFilters.hasPhone ? '<span class="filter-pill" data-reset="hasPhone">Has phone ✕</span>' : ''}
        ${activeFilters.dateFrom ? `<span class="filter-pill" data-reset="dateFrom">From: ${activeFilters.dateFrom} ✕</span>` : ''}
        ${activeFilters.dateTo ? `<span class="filter-pill" data-reset="dateTo">To: ${activeFilters.dateTo} ✕</span>` : ''}
        <button class="filter-reset-all" id="reset-all-btn">Reset all</button>
      </div>
    ` : ''}

    <div id="filter-panel" class="filter-panel ${filtersOpen ? 'open' : ''}">
      <div class="filter-panel-inner">
        <div class="filter-group">
          <label class="filter-label">Event / Occasion</label>
          <select class="form-input" id="filter-occasion">
            <option value="">All events</option>
            ${occasions.map((o) => `<option value="${escapeHtml(o)}" ${activeFilters.occasion === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Company</label>
          <select class="form-input" id="filter-company">
            <option value="">All companies</option>
            ${companies.map((c) => `<option value="${escapeHtml(c)}" ${activeFilters.company === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>
        </div>

        <div class="filter-group filter-row">
          <label class="filter-label">Date range</label>
          <div class="flex gap-8">
            <input class="form-input" type="date" id="filter-date-from" value="${activeFilters.dateFrom}" placeholder="From" style="flex:1">
            <input class="form-input" type="date" id="filter-date-to" value="${activeFilters.dateTo}" placeholder="To" style="flex:1">
          </div>
        </div>

        <div class="filter-group">
          <label class="filter-label">Contact info</label>
          <div class="flex gap-8">
            <button class="chip-toggle ${activeFilters.hasEmail ? 'active' : ''}" id="toggle-email" type="button">Has email</button>
            <button class="chip-toggle ${activeFilters.hasPhone ? 'active' : ''}" id="toggle-phone" type="button">Has phone</button>
          </div>
        </div>

        <div class="flex gap-8 mt-16">
          <button class="btn btn-secondary" id="filter-reset-btn" style="flex:1">Reset filters</button>
          <button class="btn btn-primary" id="filter-apply-btn" style="flex:1">Apply</button>
        </div>
      </div>
    </div>

    <div id="contacts-list">
      ${filtered.length === 0 ? renderEmpty() : filtered.map((c) => renderContactItem(c)).join('')}
    </div>

    ${canLoadMore ? '<button class="btn btn-secondary btn-block mt-16" id="load-more-btn">Load more</button>' : ''}
  `;

  bindSearchEvents(container);
  bindFilterEvents(container);
  bindSortEvents(container);
  bindContactEvents(container);
  container.querySelector('#load-more-btn')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    await loadRemotePage(container, currentPage + 1, false);
  });
}

function bindSearchEvents(container) {
  const input = container.querySelector('#search-input');
  const debouncedSearch = debounce((val) => {
    searchQuery = val;
    renderList(container);
  });
  input?.addEventListener('input', (e) => debouncedSearch(e.target.value));
  container.querySelector('#search-clear-btn')?.addEventListener('click', () => {
    searchQuery = '';
    renderList(container);
  });
}

function bindSortEvents(container) {
  container.querySelectorAll('.sort-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      sortBy = btn.dataset.sort;
      localStorage.setItem('sortPreference', sortBy);
      renderList(container);
    });
  });
}

function bindFilterEvents(container) {
  container.querySelector('#filter-toggle-btn')?.addEventListener('click', () => {
    filtersOpen = !filtersOpen;
    renderList(container);
  });

  container.querySelectorAll('.filter-pill[data-reset]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const { reset } = pill.dataset;
      if (!reset) return;
      if (typeof activeFilters[reset] === 'boolean') activeFilters[reset] = false;
      else activeFilters[reset] = '';
      renderList(container);
    });
  });

  container.querySelector('#reset-all-btn')?.addEventListener('click', () => {
    resetFilters();
    renderList(container);
  });

  container.querySelector('#filter-apply-btn')?.addEventListener('click', () => {
    activeFilters.occasion = container.querySelector('#filter-occasion')?.value || '';
    activeFilters.company = container.querySelector('#filter-company')?.value || '';
    activeFilters.dateFrom = container.querySelector('#filter-date-from')?.value || '';
    activeFilters.dateTo = container.querySelector('#filter-date-to')?.value || '';
    filtersOpen = false;
    renderList(container);
  });

  container.querySelector('#filter-reset-btn')?.addEventListener('click', () => {
    resetFilters();
    filtersOpen = false;
    renderList(container);
  });

  container.querySelector('#toggle-email')?.addEventListener('click', () => {
    activeFilters.hasEmail = !activeFilters.hasEmail;
    container.querySelector('#toggle-email')?.classList.toggle('active', activeFilters.hasEmail);
  });
  container.querySelector('#toggle-phone')?.addEventListener('click', () => {
    activeFilters.hasPhone = !activeFilters.hasPhone;
    container.querySelector('#toggle-phone')?.classList.toggle('active', activeFilters.hasPhone);
  });
}

function bindContactEvents(container) {
  container.querySelectorAll('.contact-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.contact-actions') || e.target.closest('.delete-trigger')) return;
      const id = el.dataset.id;
      location.hash = `#/contact/${id}`;
    });
  });

  container.querySelectorAll('.delete-trigger').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      if (!confirm(`Delete ${name}'s contact?`)) return;

      try {
        await dbDeleteContact(id);
        await deleteCardImages(id);
        const result = await syncDelete(id);

        contacts = contacts.filter((c) => c.id !== id);
        renderList(container);

        if (result.synced) showToast('Contact deleted', 'success', false);
        else showToast('Deleted locally. Will sync when online.', 'warning', false);
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
    filtered = filtered.filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.occasion || '').toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q) ||
      (c.createdAt || '').slice(0, 10).includes(q) ||
      formatDate(c.createdAt || '').toLowerCase().includes(q)
    );
  }

  if (activeFilters.occasion) {
    filtered = filtered.filter((c) =>
      (c.occasion || '').toLowerCase() === activeFilters.occasion.toLowerCase()
    );
  }
  if (activeFilters.company) {
    filtered = filtered.filter((c) =>
      (c.company || '').toLowerCase() === activeFilters.company.toLowerCase()
    );
  }
  if (activeFilters.hasEmail) {
    filtered = filtered.filter((c) => c.email && c.email.trim());
  }
  if (activeFilters.hasPhone) {
    filtered = filtered.filter((c) => c.phone && c.phone.trim());
  }
  if (activeFilters.dateFrom) {
    filtered = filtered.filter((c) =>
      (c.date || c.createdAt || '').slice(0, 10) >= activeFilters.dateFrom
    );
  }
  if (activeFilters.dateTo) {
    filtered = filtered.filter((c) =>
      (c.date || c.createdAt || '').slice(0, 10) <= activeFilters.dateTo
    );
  }

  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'company': return (a.company || '').localeCompare(b.company || '');
      case 'date':
      default: return (b.createdAt || '').localeCompare(a.createdAt || '');
    }
  });

  return filtered;
}

function getUniqueValues(list, key) {
  return [...new Set(
    list.map((c) => (c[key] || '').trim()).filter(Boolean)
  )].sort();
}

function countActiveFilters() {
  return (
    (activeFilters.occasion ? 1 : 0) +
    (activeFilters.company ? 1 : 0) +
    (activeFilters.hasEmail ? 1 : 0) +
    (activeFilters.hasPhone ? 1 : 0) +
    (activeFilters.dateFrom ? 1 : 0) +
    (activeFilters.dateTo ? 1 : 0)
  );
}

function resetFilters() {
  activeFilters = {
    occasion: '',
    company: '',
    hasEmail: false,
    hasPhone: false,
    dateFrom: '',
    dateTo: '',
  };
  searchQuery = '';
}

function renderContactItem(c) {
  return `
    <div class="contact-item" data-id="${c.id}">
      <div class="contact-avatar">${getInitials(c.name)}</div>
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(c.name || 'Unknown')}</div>
        <div class="contact-company">${escapeHtml(c.company || '')}</div>
        <div class="contact-meta">${escapeHtml(c.occasion || '')} ${c.date ? `· ${formatDate(c.date)}` : ''}</div>
      </div>
      <div class="contact-actions">
        ${c.email ? `<a href="mailto:${escapeHtml(c.email)}" title="Email" aria-label="Email ${escapeHtml(c.name || 'contact')}" onclick="event.stopPropagation()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg></a>` : ''}
        ${c.phone ? `<a href="tel:${escapeHtml(c.phone)}" title="Call" aria-label="Call ${escapeHtml(c.name || 'contact')}" onclick="event.stopPropagation()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></a>` : ''}
        <a class="delete-trigger" data-id="${c.id}" data-name="${escapeHtml(c.name || 'this contact')}" title="Delete" aria-label="Delete ${escapeHtml(c.name || 'contact')}" style="background:var(--color-error);color:white;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></a>
      </div>
    </div>
  `;
}

function renderContactsLoading() {
  return `
    <h1>Contacts</h1>
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-line" style="width:40%;"></div>
      <div class="skeleton-line" style="width:60%;"></div>
      <div class="skeleton-line" style="width:30%;"></div>
    </div>
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-line" style="width:55%;"></div>
      <div class="skeleton-line" style="width:35%;"></div>
    </div>
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-line" style="width:45%;"></div>
      <div class="skeleton-line" style="width:65%;"></div>
    </div>
  `;
}

function renderEmpty() {
  if (searchQuery) return `<div class="empty-state"><p>No contacts match "${escapeHtml(searchQuery)}"</p></div>`;
  return `
    <div class="empty-state">
      <div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
      <p>No contacts saved yet.<br>Scan your first business card!</p>
      <button class="btn btn-primary mt-16" onclick="location.hash='#/scan'">Scan a Card</button>
    </div>
  `;
}
