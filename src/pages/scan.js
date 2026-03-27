// CardVault — Scan & Import Business Card Page

import { saveContact, saveCardImages, getAllContacts } from '../js/db.js';
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

// Tracks which engine was used so the review step can show the right banner
// 'ai' | 'ocr' | 'ocr-fallback' | 'manual'
let extractionSource = 'manual';

export async function render(container) {
  currentStep = 1;
  frontImage = null;
  backImage = null;
  fields = { name: '', title: '', company: '', email: '', phone: '', website: '' };
  contextData = { occasion: '', date: new Date().toISOString().split('T')[0], notes: '' };
  extractionSource = 'manual';
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
    case 4:
      renderContext(container).catch((err) => {
        console.warn('Failed to load context suggestions:', err);
        container.innerHTML = `
          ${renderStepIndicator()}
          <h1>Add Context</h1>
          <p class="text-light text-sm mb-16">Where did you receive this card?</p>
          <div class="card">
            <div class="form-group">
              <label class="form-label">Where I Met Them</label>
              <input class="form-input" type="text" name="occasion"
                value="${escapeHtml(contextData.occasion)}" placeholder="e.g. Web Summit 2026">
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
      });
      break;
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
      <button class="btn btn-primary" id="camera-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        Camera
      </button>
      <button class="btn btn-secondary" id="upload-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        Upload
      </button>
    </div>

    <div id="processing" class="loading-overlay hidden" role="status" aria-live="polite">
      <div class="spinner"></div>
      <p id="processing-label">Reading card...</p>
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

// ─────────────────────────────────────────────────────────────────
// Core capture handler — AI FIRST, OCR fallback
// Flow:
//   1. Resize image
//   2. If Gemini configured & online → try AI extraction
//      ✓ success → use AI fields, extractionSource = 'ai'
//      ✗ fail    → fall through to OCR silently
//   3. If AI skipped/failed → run built-in OCR
//      ✓ success → extractionSource = 'ocr' (or 'ocr-fallback' if AI was tried)
//      ✗ fail    → extractionSource = 'manual', empty form
// ─────────────────────────────────────────────────────────────────
async function handleCapture(container, side, method) {
  const imageDataUrl = method === 'camera'
    ? await captureFromCamera()
    : await uploadFromGallery();

  if (!imageDataUrl) return;

  const resized = await resizeBase64Image(imageDataUrl, 1200);

  if (side === 'front') frontImage = resized;
  else backImage = resized;

  const processing = container.querySelector('#processing');
  const processingLabel = container.querySelector('#processing-label');
  processing.classList.remove('hidden');

  const geminiAvailable = isGeminiConfigured() && navigator.onLine;
  let aiAttempted = false;
  let extracted = null;

  // ── Step 1: Try Gemini AI first ──────────────────────────────
  if (geminiAvailable) {
    aiAttempted = true;
    processingLabel.textContent = 'Reading with AI...';
    try {
      const backImg = side === 'back' ? null : backImage; // back scan uses both sides later
      extracted = await extractFieldsWithAI(resized, backImg);
      extractionSource = 'ai';
    } catch (aiErr) {
      console.warn('[Scan] Gemini failed, falling back to OCR:', aiErr.message);
      extracted = null;
    }
  }

  // ── Step 2: OCR fallback if AI was skipped or failed ─────────
  if (!extracted) {
    processingLabel.textContent = aiAttempted ? 'AI unavailable — using built-in OCR...' : 'Reading card...';
    try {
      const ocrResult = await recognizeText(resized);
      extracted = ocrResult.fields;
      extractionSource = aiAttempted ? 'ocr-fallback' : 'ocr';
    } catch (ocrErr) {
      console.warn('[Scan] OCR also failed:', ocrErr.message);
      extracted = null;
      extractionSource = 'manual';
    }
  }

  processing.classList.add('hidden');

  // ── Step 3: Merge / advance ───────────────────────────────────
  if (extracted) {
    if (side === 'front') {
      fields = { ...extracted };
    } else {
      fields = mergeFields(fields, extracted);
    }
  }

  if (side === 'front') {
    if (extractionSource === 'manual') {
      // Both engines failed — go straight to review with empty form
      showToast("Couldn't read this card automatically. Please fill in the details manually.", 'warning');
      currentStep = 3;
      renderStep(container);
    } else {
      renderPostCaptureConfirmation(container);
    }
  } else {
    // Back side — always proceed to review
    currentStep = 3;
    renderStep(container);
  }
}

function renderPostCaptureConfirmation(container) {
  const sourceLabel = extractionSource === 'ai'
    ? '<span class="ai-badge" style="background:rgba(34,197,94,0.12);color:#166534;border-color:rgba(34,197,94,0.4)">AI read ✓</span>'
    : '<span class="ai-badge" style="background:rgba(245,158,11,0.12);color:#92400e;border-color:rgba(245,158,11,0.4)">OCR read</span>';

  container.innerHTML = `
    ${renderStepIndicator()}
    <div class="card scan-micro-state">
      <div class="scan-preview preview-soft-fade mb-16">
        <img src="${frontImage}" alt="Front scan preview">
      </div>
      <div class="flex-between mb-8">
        <h3>Card read successfully.</h3>
        ${sourceLabel}
      </div>
      <p class="text-light text-sm">Scan the back for more details, or continue to review and correct the extracted fields.</p>
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

  // Auto-advance after 1.8s
  setTimeout(() => {
    if (container.querySelector('#continue-review-btn')) goReview();
  }, 1800);
}

function renderReview(container) {
  const REVIEW_FIELDS = [
    { key: 'name',    label: 'Full Name', type: 'text'  },
    { key: 'title',   label: 'Job Title', type: 'text'  },
    { key: 'company', label: 'Company',   type: 'text'  },
    { key: 'email',   label: 'Email',     type: 'email' },
    { key: 'phone',   label: 'Phone',     type: 'tel'   },
    { key: 'website', label: 'Website',   type: 'url'   },
  ];

  const filledCount = REVIEW_FIELDS.filter(f => Boolean(fields[f.key])).length;
  const hasGemini = isGeminiConfigured();

  // ── Banner text based on which engine ran ────────────────────
  let bannerHtml = '';
  if (extractionSource === 'ai') {
    bannerHtml = `
      <div class="scan-ai-banner mb-16">
        <strong>✨ AI extracted ${filledCount} fields from your card.</strong>
        <span>Please verify before saving — AI may occasionally misread company names or phone numbers.</span>
      </div>`;
  } else if (extractionSource === 'ocr-fallback') {
    bannerHtml = `
      <div class="inline-alert mb-16" style="border-color:rgba(245,158,11,0.45);background:rgba(245,158,11,0.10)">
        <strong>⚠️ AI was unavailable</strong> — built-in OCR extracted ${filledCount} fields.
        ${hasGemini ? '<br><small>You can retry AI reading below once you are back online.</small>' : ''}
      </div>`;
  } else if (extractionSource === 'ocr') {
    bannerHtml = `
      <div class="scan-ai-banner mb-16">
        <strong>OCR extracted ${filledCount} fields from your card.</strong>
        <span>No Gemini key configured — <a href="#/settings" style="color:var(--color-accent)">add one in Settings</a> for better accuracy.</span>
      </div>`;
  } else {
    // manual
    bannerHtml = `
      <div class="inline-alert mb-16">
        We couldn't read this card automatically. Please fill in the details manually — your photos are saved.
      </div>`;
  }

  container.innerHTML = `
    ${renderStepIndicator()}
    <h1>Review Details</h1>
    <p class="text-light text-sm mb-16">Check and correct the extracted information.</p>
    ${bannerHtml}
    <div class="card">
      ${REVIEW_FIELDS.map(f => `
        <div class="form-group">
          <label class="form-label">${f.label}</label>
          <input class="form-input" type="${f.type}" name="${f.key}"
            value="${escapeHtml(fields[f.key] || '')}" placeholder="${f.label}">
        </div>
      `).join('')}
      <p class="text-sm text-light">Double-check company names and phone numbers.</p>
    </div>

    ${hasGemini ? `
      <button class="btn btn-secondary btn-block mt-16 btn-ai-secondary" id="smart-read-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        ${extractionSource === 'ocr-fallback' ? 'Retry with AI' : 'Re-read with AI'}
        <span class="ai-badge">Gemini</span>
      </button>
      <p class="text-sm text-light text-center mt-8" id="smart-read-hint">
        ${extractionSource === 'ai' ? 'Fields wrong? Let AI re-read the card.' : 'Try AI reading for better accuracy.'}
      </p>
    ` : ''}

    <div class="flex gap-8 mt-16">
      <button class="btn btn-link" id="back-btn" style="flex:1">Back</button>
      <button class="btn btn-primary" id="next-btn" style="flex:1">Next</button>
    </div>
  `;

  // ── Smart Read (manual AI retry) ─────────────────────────────
  if (hasGemini) {
    container.querySelector('#smart-read-btn').addEventListener('click', async () => {
      const btn = container.querySelector('#smart-read-btn');
      const hint = container.querySelector('#smart-read-hint');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;"></div> Reading with AI...';
      if (hint) hint.textContent = '';

      try {
        const aiFields = await extractFieldsWithAI(frontImage, backImage);
        extractionSource = 'ai';

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
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Retry with AI <span class="ai-badge">Gemini</span>';
        if (hint) hint.innerHTML = '<span class="fallback-badge">AI unavailable — check your connection or API key.</span>';
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

async function renderContext(container) {
  const allContacts = await getAllContacts();
  const knownOccasions = [...new Set(
    allContacts.map((c) => (c.occasion || '').trim()).filter(Boolean)
  )].sort();

  container.innerHTML = `
    ${renderStepIndicator()}
    <h1>Add Context</h1>
    <p class="text-light text-sm mb-16">Where did you receive this card?</p>
    <div class="card">
      <div class="form-group">
        <label class="form-label">Where I Met Them</label>
        <input class="form-input" type="text" name="occasion"
          list="occasions-list"
          value="${escapeHtml(contextData.occasion)}"
          placeholder="e.g. Web Summit 2026"
          autocomplete="off">
        <datalist id="occasions-list">
          ${knownOccasions.map((o) => `<option value="${escapeHtml(o)}"></option>`).join('')}
        </datalist>
        ${knownOccasions.length > 0 ? `
          <p class="text-sm text-light mt-4">Or pick a recent event:</p>
          <div class="occasion-chips" id="occasion-chips">
            ${knownOccasions.slice(0, 6).map((o) => `
              <button class="chip-toggle occasion-chip" data-value="${escapeHtml(o)}" type="button">${escapeHtml(o)}</button>
            `).join('')}
          </div>
        ` : ''}
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

  container.querySelectorAll('.occasion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const input = container.querySelector('input[name="occasion"]');
      if (!input) return;
      input.value = chip.dataset.value || '';
      container.querySelectorAll('.occasion-chip').forEach((item) => item.classList.remove('active'));
      chip.classList.add('active');
    });
  });

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

  let thumbnail = '';
  if (frontImage) {
    try { thumbnail = await createThumbnail(frontImage); } catch { /* ignore */ }
  }

  const contact = {
    id: contactId,
    ...fields,
    occasion: contextData.occasion,
    date: contextData.date,
    notes: contextData.notes,
    imageData: thumbnail,
    extractionSource,
    createdAt: now,
    updatedAt: now
  };

  try {
    await saveContact(contact);

    if (frontImage || backImage) {
      await saveCardImages(contactId, frontImage, backImage);
    }

    const result = await syncContact(contact);

    if (result.synced) {
      showToast('Contact saved & synced!', 'success');
    } else if (result.reason === 'offline') {
      showToast('Contact saved locally. Will sync when online.', 'warning');
    } else {
      showToast(`Contact saved locally. Sync failed: ${result.reason}`, 'warning');
    }

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
    container.querySelector('#view-contacts').addEventListener('click', () => { location.hash = '#/contacts'; });

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
