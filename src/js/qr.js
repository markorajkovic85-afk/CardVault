// CardVault — QR Code Generator (vCard format)

/**
 * Generate a QR code from contact data into a target element
 * @param {HTMLElement} container - Element to render QR into
 * @param {Object} contact - { name, title, company, email, phone, website }
 */
export function generateQR(container, contact) {
  if (!container) return;
  container.innerHTML = '';

  const vcard = buildVCard(contact);
  if (!vcard) return;

  // QRCode.js loaded via CDN
  if (typeof QRCode === 'undefined') {
    container.textContent = 'QR library not loaded';
    return;
  }

  new QRCode(container, {
    text: vcard,
    width: 200,
    height: 200,
    colorDark: '#1B2A4A',
    colorLight: '#FFFFFF',
    correctLevel: QRCode.CorrectLevel.M
  });
}

/**
 * Build vCard 3.0 string from contact fields
 */
export function buildVCard(contact) {
  if (!contact?.name) return '';

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.name}`
  ];

  if (contact.title) lines.push(`TITLE:${contact.title}`);
  if (contact.company) lines.push(`ORG:${contact.company}`);
  if (contact.email) lines.push(`EMAIL:${contact.email}`);
  if (contact.phone) lines.push(`TEL:${contact.phone}`);
  if (contact.website) lines.push(`URL:${contact.website}`);

  lines.push('END:VCARD');
  return lines.join('\n');
}
