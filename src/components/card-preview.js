// CardVault — Business Card Preview Component (placeholder, used by pages directly via CSS classes)
// The business card visual is rendered inline by pages using the .business-card CSS class.
// This file exists for future extraction into a Web Component if needed.

export function renderBusinessCard(contact, options = {}) {
  const { showAvatar = true } = options;
  const esc = (s) => {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  };

  return `
    <div class="business-card">
      ${showAvatar && contact.photo ? `<img class="card-avatar" src="${contact.photo}" alt="Photo">` : ''}
      <div class="card-name">${esc(contact.name)}</div>
      ${contact.title ? `<div class="card-title">${esc(contact.title)}</div>` : ''}
      ${contact.company ? `<div class="card-company">${esc(contact.company)}</div>` : ''}
      ${contact.email ? `<div class="card-detail">&#9993; ${esc(contact.email)}</div>` : ''}
      ${contact.phone ? `<div class="card-detail">&#9742; ${esc(contact.phone)}</div>` : ''}
      ${contact.website ? `<div class="card-detail">&#127760; ${esc(contact.website)}</div>` : ''}
    </div>
  `;
}
