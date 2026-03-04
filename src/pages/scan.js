// CardVault — Scan & Import Business Card Page

import { saveContact, saveCardImages } from '../js/db.js';
import { syncContact } from '../js/sync.js';
import { captureFromCamera, uploadFromGallery } from '../js/camera.js';
import { recognizeText, mergeFields } from '../js/ocr.js';
import { showToast } from '../components/toast.js';
import { uuid, escapeHtml, resizeBase64Image, createThumbnail } from '../js/utils.js';

let currentStep = 1;
let frontImage = null;
let backImage = null;
let fields = { name: '', title: '', company: '', email: '', phone: '', website: '' };
let contextData = { occasion: '', date: new Date().toISOString().split('T')[0], notes: '' };

export async function render(container) {
  // Reset state
  currentStep = 1;
  frontImage = null;
  backImage = null;
  fields = { name: '', title: '', company: '', email: '', phone: '', website: '' };
  contextData = { occasion: '', date: new Date().toISOString().split('T')[0], notes: '' };

  renderStep(container);
}

function renderStepIndicator() {
  return `
    <div class="steps">
      ${[1,2,3,4,5].map(s => `
        <div class="step ${s === currentStep ? 'active' : ''} ${s < currentStep ? 'done' : ''}"></div>
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

    ${!isFront ? `
      <div id="preview-area" class="scan-preview mb-16" style="display:none;">
        <img id="preview-img" alt="Card preview">
      </div>
    ` : ''}

    ${isFront && frontImage ? `
      <div class="scan-preview mb-16">
        <img src="${frontImage}" alt="Front of card">
      </div>
    ` : ''}

    <div class="scan-actions">
      <button class="btn btn-primary" id="camera-btn">&#128247; Camera</button>
      <button class="btn btn-secondary" id="upload-btn">&#128193; Upload</button>
    </div>

    <div id="processing" class="loading-overlay hidden">
      <div class="spinner"></div>
      <p>Reading card...</p>
    </div>

    <div id="result" class="hidden"></div>

    ${!isFront ? `
      <button class="btn btn-secondary btn-block mt-16" id="skip-back-btn">Skip — No back side</button>
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
      // Move to step 2 (back scan)
      currentStep = 2;
      renderStep(container);
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
    showToast(`OCR failed: ${err.message}. You can enter details manually.`, 'warning');
    if (side === 'front') {
      currentStep = 3; // Skip to review for manual entry
    } else {
      currentStep = 3;
    }
    renderStep(container);
  }
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

  container.innerHTML = `
    ${renderStepIndicator()}
    <h1>Review Details</h1>
    <p class="text-light text-sm mb-16">Check and correct the extracted information.</p>
    <div class="card">
      ${REVIEW_FIELDS.map(f => `
        <div class="form-group">
          <label class="form-label">${f.label}</label>
          <input class="form-input" type="${f.type}" name="${f.key}"
            value="${escapeHtml(fields[f.key] || '')}" placeholder="${f.label}">
        </div>
      `).join('')}
    </div>
    <div class="flex gap-8 mt-16">
      <button class="btn btn-secondary" id="back-btn" style="flex:1">Back</button>
      <button class="btn btn-primary" id="next-btn" style="flex:1">Next</button>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    // Save current edits
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
      <button class="btn btn-secondary" id="back-btn" style="flex:1">Back</button>
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
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>Saving contact...</p>
    </div>
  `;
}

async function doSave(container) {
  const contactId = uuid();
  const now = new Date().toISOString();

  // Create thumbnail for Sheets
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

    // Try to sync to Google Sheets
    const result = await syncContact(contact);

    if (result.synced) {
      showToast('Contact saved & synced to Google Sheets!', 'success');
    } else if (result.reason === 'offline') {
      showToast('Contact saved locally. Will sync when online.', 'warning');
    } else {
      showToast(`Contact saved locally. Sync failed: ${result.reason}`, 'warning');
    }

    // Reset and show success
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">&#9989;</div>
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
    if (input) fields[key] = input.value.trim();
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
