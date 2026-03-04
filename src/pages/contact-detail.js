// CardVault — Contact Detail Page

import { getContact, getCardImages } from '../js/db.js';
import { escapeHtml, formatDate } from '../js/utils.js';

export async function render(container, { id }) {
  if (!id) {
    container.innerHTML = '<div class="empty-state"><p>Contact not found</p></div>';
    return;
  }

  const contact = await getContact(id);
  if (!contact) {
    container.innerHTML = '<div class="empty-state"><p>Contact not found</p></div>';
    return;
  }

  const images = await getCardImages(id);

  container.innerHTML = `
    <div class="flex-between mb-16">
      <button class="btn btn-secondary" id="back-btn" style="padding:8px 16px;">&#8592; Back</button>
      <h2 style="margin:0;">${escapeHtml(contact.name || 'Contact')}</h2>
      <div style="width:70px;"></div>
    </div>

    <div class="business-card mb-16">
      <div class="card-name">${escapeHtml(contact.name || '')}</div>
      ${contact.title ? `<div class="card-title">${escapeHtml(contact.title)}</div>` : ''}
      ${contact.company ? `<div class="card-company">${escapeHtml(contact.company)}</div>` : ''}
      ${contact.email ? `<div class="card-detail">&#9993; <a href="mailto:${escapeHtml(contact.email)}" style="color:inherit">${escapeHtml(contact.email)}</a></div>` : ''}
      ${contact.phone ? `<div class="card-detail">&#9742; <a href="tel:${escapeHtml(contact.phone)}" style="color:inherit">${escapeHtml(contact.phone)}</a></div>` : ''}
      ${contact.website ? `<div class="card-detail">&#127760; <a href="${escapeHtml(contact.website)}" target="_blank" style="color:inherit">${escapeHtml(contact.website)}</a></div>` : ''}
    </div>

    ${contact.occasion || contact.date || contact.notes ? `
      <div class="card mb-16">
        <h3>Context</h3>
        ${contact.occasion ? `<p><strong>Met at:</strong> ${escapeHtml(contact.occasion)}</p>` : ''}
        ${contact.date ? `<p><strong>Date:</strong> ${formatDate(contact.date)}</p>` : ''}
        ${contact.notes ? `<p><strong>Notes:</strong> ${escapeHtml(contact.notes)}</p>` : ''}
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
      Added ${formatDate(contact.createdAt)}
    </p>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    location.hash = '#/contacts';
  });
}
