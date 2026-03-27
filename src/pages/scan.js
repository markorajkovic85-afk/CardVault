// CardVault — Scan & Import Business Card Page

import { saveContact, saveCardImages } from '../js/db.js';
import { syncContact } from '../js/sync.js';
import { captureFromCamera, uploadFromGallery } from '../js/camera.js';
import { recognizeText, mergeFields, normalizePhoneNumber } from '../js/ocr.js';
import { isGeminiConfigured, extractFieldsWithAI } from '../js/gemini.js';
import { showToast } from '../components/toast.js';
import { uuid, escapeHtml, resizeBase64Image, createThumbnail } from '../js/utils.js';

let currentStep = 1;
let frontImage = null;
let backImage = null;
let fields = { name: '', title: '', company: '', email: '', phone: '', website: '' };
let contextData = { occasion: '', date: new Date().toISOString().split('T')[0], notes: '' };
let ocrFallbackActive = false;
let geminiFallbackActive = false;

export async function render(container) {
  // Reset state
  currentStep = 1;
  frontImage = null;
  backImage = null;
  fields = { name: '', title: '', company: '', email: '', phone: '', website: '' };
  contextData = { occasion: '', date: new Date().toISOString().split('T')[0], notes: '' };
  ocrFallbackActive = false;
  geminiFallbackActive = false;

  renderStep(container);
}

function renderStepIndicator() {
  const labels = ['Scan front', 'Scan back (optional)', 'Review fields', 'Add context', 'Done'];
  return `
    <p class="sr-only" aria-live="polite">Current step: ${labels[currentStep - 1]}</p>
    <div class="step-phases" aria-label="Wizard phases">
      <span class="phase ${currentStep <= 2 ? 'active' : ''}">Capture</span>
      <span class="phase ${currentStep === 3 ? 'active' : ''}">Review</span>
      <span class="phase ${currentStep >= 4 ? 'active' : ''}">Context &amp; Save</span>
    </div>
    <div class="steps">
      ${[1,2,3,4,5].map((s, idx) => `
        <div class="step ${s === currentStep ? 'active' : ''} ${s < currentStep ? 'done' : ''}">
          <span class="step-label">${labels[idx]}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStep(container) {
  switch (currentStep) {
    case 1: renderCapture(container, 'front'); break;
    case 2: renderCapture(container, 'back'); break;
    case 3: renderReview(container); break;
    case 4: renderContext(container); break;
    case 5: renderSaving(container); break;
  }
}

function renderCapture(container, side) {
  const isFront = side === 'front';
  container.innerHTML = `
    ${renderStepIndicator()}
    <h1>Scan ${isFront ? 'Front' : 'Back'} of Card</h1>
    <p class="text-light text-sm mb-16">${isFront ? 'Take a photo or upload an image of the business card.' : 'Optionally scan the back for additional information.'}</p>

    ${isFront && frontImage ? `
      <div class="scan-preview mb-16">
        <img src="${frontImage}" alt="Front of card">
      </div>
    ` : ''}

    <div class="scan-actions">
      <button class="btn btn-primary" id="camera-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Camera</button>
      <button class="btn btn-secondary" id="upload-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Upload</button>
    </div>

    <div id="processing" class="loading-overlay hidden" role="status" aria-live="polite">
      <div class="spinner"></div>
      <p>Reading card...</p>
    </div>

    <div id="result" class="hidden"></div>

    ${!isFront ? `
      <button class="btn btn-link btn-block mt-16" id="skip-back-btn">Skip — No back side</button>
    ` : ''}
  `;

  container.querySelector('#camera-btn').addEventListener('click', () => handleCapture(container, side, 'camera'));
  container.querySelector('#upload-btn').addEventListener('click', () => handleCapture(container, side, 'upload'));

  if (!isFront) {
    container.querySelector('#skip-back-btn').addEventListener('click', () => {
      currentStep = 3;
      renderStep(container);
    });
  }
}

async function handleCapture(container, side, method) {
  const imageDataUrl = method === 'camera'
    ? await captureFromCamera()
    : await uploadFromGallery();

  if (!imageDataUrl) return;

  // Resize image
  const resized = await resizeBase64Image(imageDataUrl, 1200);

  if (side === 'front') {
    frontImage = resized;
  } else {
    backImage = resized;
  }

  // Show processing
  const processing = container.querySelector('#processing');
  processing.classList.remove('hidden');

  try {
    const { fields: extracted } = await recognizeText(resized);

    if (side === 'front') {
      fields = { ...extracted };
      processing.classList.add('hidden');
      renderPostOcrConfirmation(container);
    } else {
      // Merge back fields with front (don't overwrite)
      fields = mergeFields(fields, extracted);
      processing.classList.add('hidden');
      // Move to step 3 (review)
      currentStep = 3;
      renderStep(container);
    }
  } catch (err) {
    processing.classList.add('hidden');
    ocrFallbackActive = true;
    showToast(`OCR failed: ${err.message}. You can enter details manually.`, 'warning');
    currentStep = 3;
    renderStep(container);
  }
}

function renderPostOcrConfirmation(container) {
  container.innerHTML = `
    ${renderStepIndicator()}
    <div class="card scan-micro-state">
      <div class="scan-preview preview-soft-fade mb-16">
        <img src="${frontImage}" alt="Front scan preview">
      </div>
      <h3>We’ve read the card.</h3>
      <p class="text-light text-sm">Now scan the back or continue to review extracted fields.</p>
      <div class="flex gap-8 mt-16">
        <button class="btn btn-secondary" id="continue-review-btn" style="flex:1">Continue</button>
        <button class="btn btn-primary" id="scan-back-btn" style="flex:1">Scan Back</button>
      </div>
    </div>
  `;

  const goReview = () => {
    currentStep = 3;
    renderStep(container);
  };

  container.querySelector('#scan-back-btn').addEventListener('click', () => {
    currentStep = 2;
    renderStep(container);
  });
  container.querySelector('#continue-review-btn').addEventListener('click', goReview);

  setTimeout(() => {
    const continueBtn = container.querySelector('#continue-review-btn');
    if (continueBtn) goReview();
  }, 1800);
}

function renderReview(container) {
  const REVIEW_FIELDS = [
    { key: 'name', label: 'Full Name', type: 'text' },
    { key: 'title', label: 'Job Title', type: 'text' },
    { key: 'company', label: 'Company', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'website', label: 'Website', type: 'url' },
  ];

  const hasGemini = isGeminiConfigured();

  container.innerHTML = `
    ${renderStepIndicator()}
    <h1>Review Details</h1>
    <p class="text-light text-sm mb-16">Check and correct the extracted information.</p>
    <div class="scan-ai-banner mb-16">
      <strong>AI extracted ${REVIEW_FIELDS.filter((f) => Boolean(fields[f.key])).length} fields from your card.</strong>
      <span>Please verify before saving.</span>
    </div>
    ${ocrFallbackActive ? `
      <div class="inline-alert mb-16">
        We couldn’t read this card. You can still type details manually — your photos are saved.
      </div>
    ` : ''}
    <div class="card">
      ${REVIEW_FIELDS.map(f => `
        <div class="form-group">
          <label class="form-label">${f.label}</label>
          <input class="form-input" type="${f.type}" name="${f.key}"
            value="${escapeHtml(fields[f.key] || '')}" placeholder="${f.label}">
        </div>
      `).join('')}
      <p class="text-sm text-light">AI may be wrong on company names and phone numbers — double-check these.</p>
    </div>
    ${hasGemini ? `
      <button class="btn btn-secondary btn-block mt-16 btn-ai-secondary" id="smart-read-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Smart Read
        <span class="ai-badge">Gemini</span>
      </button>
      <p class="text-sm text-light text-center mt-8" id="smart-read-hint">Fields wrong? Let AI re-read the card.</p>
      ${geminiFallbackActive ? '<p class="text-sm text-center mt-8"><span class="fallback-badge">AI re-read unavailable — using camera text only.</span></p>' : ''}
    ` : ''}
    <div class="flex gap-8 mt-16">
      <button class="btn btn-link" id="back-btn" style="flex:1">Back</button>
      <button class="btn btn-primary" id="next-btn" style="flex:1">Next</button>
    </div>
  `;

  // Smart Read (AI)
  if (hasGemini) {
    container.querySelector('#smart-read-btn').addEventListener('click', async () => {
      const btn = container.querySelector('#smart-read-btn');
      const hint = container.querySelector('#smart-read-hint');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;"></div> Reading with AI...';
      hint.textContent = '';

      try {
        geminiFallbackActive = false;
        const aiFields = await extractFieldsWithAI(frontImage, backImage);

        // Update form fields with AI results
        REVIEW_FIELDS.forEach(f => {
          const input = container.querySelector(`input[name="${f.key}"]`);
          if (input && aiFields[f.key]) {
            input.value = aiFields[f.key];
            fields[f.key] = aiFields[f.key];
          }
        });

        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> AI updated these fields.';
        btn.style.borderColor = 'var(--color-success)';
        btn.style.color = 'var(--color-success)';
        showToast('Fields updated with AI reading', 'success', false);
      } catch (err) {
        geminiFallbackActive = true;
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Smart Read <span class="ai-badge">Gemini</span>';
        hint.innerHTML = '<span class="fallback-badge">AI re-read unavailable — using camera text only.</span>';
        showToast(`AI read failed: ${err.message}`, 'error');
      }
    });
  }

  container.querySelector('#back-btn').addEventListener('click', () => {
    saveFormFields(container);
    currentStep = 1;
    renderStep(container);
  });

  container.querySelector('#next-btn').addEventListener('click', () => {
    saveFormFields(container);
    currentStep = 4;
    renderStep(container);
  });
}

function renderContext(container) {
  container.innerHTML = `
    ${renderStepIndicator()}
    <h1>Add Context</h1>
    <p class="text-light text-sm mb-16">Where did you receive this card?</p>
    <div class="card">
      <div class="form-group">
        <label class="form-label">Where I Met Them</label>
        <input class="form-input" type="text" name="occasion"
          value="${escapeHtml(contextData.occasion)}" placeholder="e.g., Tech Conference Berlin">
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" name="date" value="${contextData.date}">
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-input" name="notes" placeholder="Any additional notes...">${escapeHtml(contextData.notes)}</textarea>
      </div>
    </div>
    <div class="flex gap-8 mt-16">
      <button class="btn btn-link" id="back-btn" style="flex:1">Back</button>
      <button class="btn btn-primary" id="save-btn" style="flex:1">Save Contact</button>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    saveContextFields(container);
    currentStep = 3;
    renderStep(container);
  });

  container.querySelector('#save-btn').addEventListener('click', async () => {
    saveContextFields(container);
    currentStep = 5;
    renderStep(container);
    await doSave(container);
  });
}

async function renderSaving(container) {
  container.innerHTML = `
    ${renderStepIndicator()}
    <div class="loading-overlay" role="status" aria-live="polite">
      <div class="spinner"></div>
      <p>Saving contact...</p>
    </div>
  `;
}

async function doSave(container) {
  const contactId = uuid();
  const now = new Date().toISOString();

  // Create thumbnail for contact list display
  let thumbnail = '';
  if (frontImage) {
    try {
      thumbnail = await createThumbnail(frontImage);
    } catch { /* ignore */ }
  }

  const contact = {
    id: contactId,
    ...fields,
    occasion: contextData.occasion,
    date: contextData.date,
    notes: contextData.notes,
    imageData: thumbnail,
    createdAt: now,
    updatedAt: now
  };

  try {
    // Save to IndexedDB
    await saveContact(contact);

    // Save images to IndexedDB
    if (frontImage || backImage) {
      await saveCardImages(contactId, frontImage, backImage);
    }

    // Try to sync to Supabase
    const result = await syncContact(contact);

    if (result.synced) {
      showToast('Contact saved & synced!', 'success');
    } else if (result.reason === 'offline') {
      showToast('Contact saved locally. Will sync when online.', 'warning');
    } else {
      showToast(`Contact saved locally. Sync failed: ${result.reason}`, 'warning');
    }

    // Reset and show success
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
        <h2>Contact Saved!</h2>
        <p>${escapeHtml(fields.name || 'New contact')} has been added.</p>
        <button class="btn btn-primary mt-24" id="scan-another">Scan Another Card</button>
        <button class="btn btn-secondary mt-8" id="view-contacts">View Contacts</button>
      </div>
    `;

    container.querySelector('#scan-another').addEventListener('click', () => render(container));
    container.querySelector('#view-contacts').addEventListener('click', () => {
      location.hash = '#/contacts';
    });

  } catch (err) {
    showToast(`Save failed: ${err.message}`, 'error');
    currentStep = 4;
    renderStep(container);
  }
}

function saveFormFields(container) {
  ['name', 'title', 'company', 'email', 'phone', 'website'].forEach(key => {
    const input = container.querySelector(`input[name="${key}"]`);
    if (!input) return;
    const value = input.value.trim();
    fields[key] = key === 'phone' ? normalizePhoneNumber(value) : value;
  });
}

function saveContextFields(container) {
  const occasion = container.querySelector('input[name="occasion"]');
  const date = container.querySelector('input[name="date"]');
  const notes = container.querySelector('textarea[name="notes"]');
  if (occasion) contextData.occasion = occasion.value.trim();
  if (date) contextData.date = date.value;
  if (notes) contextData.notes = notes.value.trim();
}
