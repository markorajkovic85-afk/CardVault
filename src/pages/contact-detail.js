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
      <button class="btn btn-secondary" id="back-btn" style="padding:8px 16px;">&#8592; Back</button>
      <h2 style="margin:0;">${escapeHtml(c.name || 'Contact')}</h2>
      <button class="btn btn-secondary" id="edit-btn" style="padding:8px 16px;">&#9998; Edit</button>
    </div>

    <div class="business-card mb-16">
      <div class="card-name">${escapeHtml(c.name || '')}</div>
      ${c.title ? `<div class="card-title">${escapeHtml(c.title)}</div>` : ''}
      ${c.company ? `<div class="card-company">${escapeHtml(c.company)}</div>` : ''}
      ${c.email ? `<div class="card-detail">&#9993; <a href="mailto:${escapeHtml(c.email)}" style="color:inherit">${escapeHtml(c.email)}</a></div>` : ''}
      ${c.phone ? `<div class="card-detail">&#9742; <a href="tel:${escapeHtml(c.phone)}" style="color:inherit">${escapeHtml(c.phone)}</a></div>` : ''}
      ${c.website ? `<div class="card-detail">&#127760; <a href="${escapeHtml(c.website)}" target="_blank" style="color:inherit">${escapeHtml(c.website)}</a></div>` : ''}
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
