// CardVault — Contact Detail Page (View + Edit)

import { getContact, getCardImages, saveContact } from '../js/db.js';
import { syncUpdate } from '../js/sync.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, formatDate } from '../js/utils.js';

const EDIT_FIELDS = [
  { key: 'name', label: 'Full Name', type: 'text' },
  { key: 'title', label: 'Job Title', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'website', label: 'Website', type: 'url' },
  { key: 'occasion', label: 'Where I Met Them', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

let contact = null;
let images = null;
let editing = false;

export async function render(container, { id }) {
  if (!id) {
    container.innerHTML = '<div class="empty-state"><p>Contact not found</p></div>';
    return;
  }

  contact = await getContact(id);
  if (!contact) {
    container.innerHTML = '<div class="empty-state"><p>Contact not found</p></div>';
    return;
  }

  images = await getCardImages(id);
  editing = false;
  renderView(container);
}

function renderView(container) {
  const c = contact;
  container.innerHTML = `
    <div class="flex-between mb-16">
      <button class="btn btn-secondary" id="back-btn" style="padding:8px 16px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Back</button>
      <h2 style="margin:0;">${escapeHtml(c.name || 'Contact')}</h2>
      <button class="btn btn-secondary" id="edit-btn" style="padding:8px 16px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
    </div>

    <div class="business-card mb-16">
      <div class="card-name">${escapeHtml(c.name || '')}</div>
      ${c.title ? `<div class="card-title">${escapeHtml(c.title)}</div>` : ''}
      ${c.company ? `<div class="card-company">${escapeHtml(c.company)}</div>` : ''}
      ${c.email ? `<div class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg> <a href="mailto:${escapeHtml(c.email)}" style="color:inherit">${escapeHtml(c.email)}</a></div>` : ''}
      ${c.phone ? `<div class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> <a href="tel:${escapeHtml(c.phone)}" style="color:inherit">${escapeHtml(c.phone)}</a></div>` : ''}
      ${c.website ? `<div class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> <a href="${escapeHtml(c.website)}" target="_blank" style="color:inherit">${escapeHtml(c.website)}</a></div>` : ''}
    </div>

    ${c.occasion || c.date || c.notes ? `
      <div class="card mb-16">
        <h3>Context</h3>
        ${c.occasion ? `<p><strong>Met at:</strong> ${escapeHtml(c.occasion)}</p>` : ''}
        ${c.date ? `<p><strong>Date:</strong> ${formatDate(c.date)}</p>` : ''}
        ${c.notes ? `<p><strong>Notes:</strong> ${escapeHtml(c.notes)}</p>` : ''}
      </div>
    ` : ''}

    ${images ? `
      <div class="card">
        <h3>Scanned Card</h3>
        ${images.front ? `
          <p class="text-sm text-light mb-8">Front</p>
          <img src="${images.front}" alt="Card front" style="width:100%;border-radius:var(--radius-sm);margin-bottom:12px;">
        ` : ''}
        ${images.back ? `
          <p class="text-sm text-light mb-8">Back</p>
          <img src="${images.back}" alt="Card back" style="width:100%;border-radius:var(--radius-sm);">
        ` : ''}
      </div>
    ` : ''}

    <p class="text-sm text-light text-center mt-16">
      Added ${formatDate(c.createdAt)}
      ${c.updatedAt && c.updatedAt !== c.createdAt ? ` · Updated ${formatDate(c.updatedAt)}` : ''}
    </p>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    location.hash = '#/contacts';
  });

  container.querySelector('#edit-btn').addEventListener('click', () => {
    editing = true;
    renderEdit(container);
  });
}

function renderEdit(container) {
  const c = contact;
  container.innerHTML = `
    <div class="flex-between mb-16">
      <button class="btn btn-secondary" id="cancel-btn" style="padding:8px 16px;">Cancel</button>
      <h2 style="margin:0;">Edit Contact</h2>
      <button class="btn btn-primary" id="save-btn" style="padding:8px 16px;">Save</button>
    </div>

    <div class="card">
      ${EDIT_FIELDS.map(f => `
        <div class="form-group">
          <label class="form-label">${f.label}</label>
          ${f.type === 'textarea'
            ? `<textarea class="form-input" name="${f.key}" placeholder="${f.label}">${escapeHtml(c[f.key] || '')}</textarea>`
            : `<input class="form-input" type="${f.type}" name="${f.key}" value="${escapeHtml(c[f.key] || '')}" placeholder="${f.label}">`
          }
        </div>
      `).join('')}

      <div class="form-group">
        <label class="form-label">Date Met</label>
        <input class="form-input" type="date" name="date" value="${c.date || ''}">
      </div>
    </div>
  `;

  container.querySelector('#cancel-btn').addEventListener('click', () => {
    editing = false;
    renderView(container);
  });

  container.querySelector('#save-btn').addEventListener('click', async () => {
    const updated = { ...contact };

    EDIT_FIELDS.forEach(f => {
      const el = f.type === 'textarea'
        ? container.querySelector(`textarea[name="${f.key}"]`)
        : container.querySelector(`input[name="${f.key}"]`);
      if (el) updated[f.key] = el.value.trim();
    });

    const dateInput = container.querySelector('input[name="date"]');
    if (dateInput) updated.date = dateInput.value;

    updated.updatedAt = new Date().toISOString();

    // Save to IndexedDB
    await saveContact(updated);
    contact = updated;

    // Sync to Sheets (or queue if offline)
    const result = await syncUpdate(updated);

    if (result.synced) {
      showToast('Contact updated & synced!', 'success', false);
    } else {
      showToast('Updated locally. Will sync when online.', 'warning', false);
    }

    editing = false;
    renderView(container);
  });
}
