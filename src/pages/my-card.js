// CardVault — My Digital Business Card Page

import { getMyCard, saveMyCard } from '../js/db.js';
import { generateQR, buildVCard } from '../js/qr.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, resizeImage } from '../js/utils.js';

const FIELDS = [
  { key: 'name', label: 'Full Name', type: 'text', placeholder: 'John Doe', required: true },
  { key: 'title', label: 'Job Title', type: 'text', placeholder: 'Software Engineer' },
  { key: 'company', label: 'Company', type: 'text', placeholder: 'Acme Corp' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'john@acme.com', required: true },
  { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+1 234 567 890' },
  { key: 'website', label: 'Website / LinkedIn', type: 'url', placeholder: 'https://linkedin.com/in/johndoe' },
];

let cardData = null;
let editing = false;

export async function render(container) {
  cardData = await getMyCard();

  // Fallback: restore from localStorage if IndexedDB was cleared
  if (!cardData) {
    try {
      const backup = localStorage.getItem('myCardBackup');
      if (backup) {
        cardData = JSON.parse(backup);
        await saveMyCard(cardData);
      }
    } catch { /* ignore corrupt backup */ }
  }

  editing = false;

  if (!cardData || !cardData.name) {
    renderEmpty(container);
  } else {
    renderCard(container);
  }
}

function renderEmpty(container) {
  container.innerHTML = `
    <h1>My Business Card</h1>
    <div class="empty-state">
      <div class="icon">&#128188;</div>
      <p>Set up your digital business card</p>
      <button class="btn btn-primary mt-16" id="setup-btn">Create My Card</button>
    </div>
  `;
  container.querySelector('#setup-btn').addEventListener('click', () => {
    cardData = { name: '', title: '', company: '', email: '', phone: '', website: '', photo: '' };
    editing = true;
    renderEdit(container);
  });
}

function renderCard(container) {
  const c = cardData;
  container.innerHTML = `
    <h1>My Business Card</h1>
    <div class="business-card">
      ${c.photo ? `<img class="card-avatar" src="${c.photo}" alt="Photo">` : ''}
      <div class="card-name">${escapeHtml(c.name)}</div>
      ${c.title ? `<div class="card-title">${escapeHtml(c.title)}</div>` : ''}
      ${c.company ? `<div class="card-company">${escapeHtml(c.company)}</div>` : ''}
      ${c.email ? `<div class="card-detail">&#9993; ${escapeHtml(c.email)}</div>` : ''}
      ${c.phone ? `<div class="card-detail">&#9742; ${escapeHtml(c.phone)}</div>` : ''}
      ${c.website ? `<div class="card-detail">&#127760; ${escapeHtml(c.website)}</div>` : ''}
    </div>
    <div class="qr-container" id="qr-code"></div>
    <div class="flex gap-8 mt-16">
      <button class="btn btn-secondary" id="edit-btn" style="flex:1">&#9998; Edit</button>
      <button class="btn btn-primary" id="share-btn" style="flex:1">&#128228; Share</button>
    </div>
  `;

  generateQR(container.querySelector('#qr-code'), c);

  container.querySelector('#edit-btn').addEventListener('click', () => {
    editing = true;
    renderEdit(container);
  });

  container.querySelector('#share-btn').addEventListener('click', () => shareCard());
}

function renderEdit(container) {
  const c = cardData || {};
  container.innerHTML = `
    <h1>${c.name ? 'Edit' : 'Create'} My Card</h1>
    <div class="card">
      <div class="form-group text-center">
        <div id="photo-preview" style="width:80px;height:80px;border-radius:50%;margin:0 auto 8px;overflow:hidden;background:var(--color-bg);display:flex;align-items:center;justify-content:center;">
          ${c.photo ? `<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:2rem">&#128100;</span>'}
        </div>
        <button class="btn btn-secondary" id="photo-btn" style="font-size:0.813rem;padding:6px 16px">Change Photo</button>
        <input type="file" id="photo-input" accept="image/*" class="hidden">
      </div>
      ${FIELDS.map(f => `
        <div class="form-group">
          <label class="form-label">${f.label}${f.required ? ' *' : ''}</label>
          <input class="form-input" type="${f.type}" name="${f.key}"
            value="${escapeHtml(c[f.key] || '')}" placeholder="${f.placeholder}"
            ${f.required ? 'required' : ''}>
        </div>
      `).join('')}
      <div class="flex gap-8 mt-16">
        <button class="btn btn-secondary" id="cancel-btn" style="flex:1">Cancel</button>
        <button class="btn btn-primary" id="save-btn" style="flex:1">Save</button>
      </div>
    </div>
  `;

  // Photo upload
  const photoBtn = container.querySelector('#photo-btn');
  const photoInput = container.querySelector('#photo-input');
  photoBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', async () => {
    if (photoInput.files?.[0]) {
      const dataUrl = await resizeImage(photoInput.files[0], 400);
      cardData.photo = dataUrl;
      container.querySelector('#photo-preview').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
    }
  });

  // Cancel
  container.querySelector('#cancel-btn').addEventListener('click', () => {
    editing = false;
    if (cardData?.name) {
      renderCard(container);
    } else {
      renderEmpty(container);
    }
  });

  // Save
  container.querySelector('#save-btn').addEventListener('click', async () => {
    const formData = {};
    FIELDS.forEach(f => {
      formData[f.key] = container.querySelector(`input[name="${f.key}"]`).value.trim();
    });

    if (!formData.name) {
      showToast('Name is required', 'error', false);
      return;
    }

    cardData = { ...cardData, ...formData };
    await saveMyCard(cardData);
    // Backup to localStorage for persistence across cache clears
    try { localStorage.setItem('myCardBackup', JSON.stringify(cardData)); } catch { /* quota */ }
    editing = false;
    showToast('Card saved!', 'success', false);
    renderCard(container);
  });
}

async function shareCard() {
  const vcard = buildVCard(cardData);
  if (!vcard) return;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${cardData.name}'s Business Card`,
        text: vcard
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        fallbackCopy(vcard);
      }
    }
  } else {
    fallbackCopy(vcard);
  }
}

function fallbackCopy(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Card info copied to clipboard!', 'success', false);
  }).catch(() => {
    showToast('Could not share card', 'error', false);
  });
}
