// CardVault — My Digital Business Card Page

import { getMyCard, saveMyCard } from '../js/db.js';
import { generateQR, buildVCard } from '../js/qr.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, resizeImage } from '../js/utils.js';
import { fetchMyCardRemote, saveMyCardRemote } from '../js/supabase-api.js';
import { isSupabaseConfigured } from '../js/supabase-client.js';

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
  // 1. Try local IndexedDB first (fast)
  cardData = await getMyCard();

  // 2. Fallback to localStorage backup
  if (!cardData) {
    try {
      const backup = localStorage.getItem('myCardBackup');
      if (backup) {
        cardData = JSON.parse(backup);
        await saveMyCard(cardData);
      }
    } catch { /* ignore corrupt backup */ }
  }

  // 3. Fallback to Supabase user_metadata (cross-device sync)
  if (!cardData && isSupabaseConfigured()) {
    try {
      const remote = await fetchMyCardRemote();
      if (remote) {
        cardData = remote;
        await saveMyCard(cardData);
        localStorage.setItem('myCardBackup', JSON.stringify(cardData));
      }
    } catch { /* ignore remote fetch failure */ }
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
      <div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div>
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
      ${c.email ? `<div class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg> ${escapeHtml(c.email)}</div>` : ''}
      ${c.phone ? `<div class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ${escapeHtml(c.phone)}</div>` : ''}
      ${c.website ? `<div class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> ${escapeHtml(c.website)}</div>` : ''}
    </div>
    <div class="qr-container" id="qr-code"></div>
    <div class="flex gap-8 mt-16">
      <button class="btn btn-secondary" id="edit-btn" style="flex:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
      <button class="btn btn-primary" id="share-btn" style="flex:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share</button>
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
          ${c.photo ? `<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:2rem"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-light)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>'}
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

  container.querySelector('#cancel-btn').addEventListener('click', () => {
    editing = false;
    if (cardData?.name) {
      renderCard(container);
    } else {
      renderEmpty(container);
    }
  });

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

    // Save locally
    await saveMyCard(cardData);
    try { localStorage.setItem('myCardBackup', JSON.stringify(cardData)); } catch { /* quota */ }

    // Sync to Supabase so other devices get it
    if (isSupabaseConfigured()) {
      await saveMyCardRemote(cardData);
    }

    editing = false;
    showToast('Card saved and synced!', 'success', false);
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
