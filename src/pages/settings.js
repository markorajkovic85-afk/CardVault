// CardVault — Settings Page

import { testConnection } from '../js/sheets-api.js';
import { showToast } from '../components/toast.js';
import { getPendingSyncCount } from '../js/sync.js';
import { getStorageEstimate } from '../js/db.js';

const APPS_SCRIPT_CODE = `// CardVault — Google Apps Script Backend
// Paste this into Extensions → Apps Script in your Google Sheet
// Deploy as Web App with "Anyone" access

const SHEET_NAME = 'Contacts';

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'test') return jsonResponse(testConnection());
  if (action === 'list') return jsonResponse(listContacts());
  return jsonResponse({ success: false, error: 'Unknown action' });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  if (action === 'add') return jsonResponse(addContact(data));
  if (action === 'delete') return jsonResponse(deleteContact(data.id));
  if (action === 'update') return jsonResponse(updateContact(data));
  return jsonResponse({ success: false, error: 'Unknown action' });
}

function testConnection() {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    return { success: true, sheetName: sheet.getName(), rowCount: Math.max(0, lastRow - 1) };
  } catch (err) { return { success: false, error: err.message }; }
}

function listContacts() {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, contacts: [] };
    const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
    const headers = ['id','name','title','company','email','phone','website','occasion','date','notes','imageData','createdAt','updatedAt'];
    const contacts = data.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i] || '');
      return obj;
    });
    return { success: true, contacts };
  } catch (err) { return { success: false, error: err.message }; }
}

function addContact(data) {
  try {
    const sheet = getSheet();
    const id = data.id || Utilities.getUuid();
    const now = new Date().toISOString();
    sheet.appendRow([id, data.name||'', data.title||'', data.company||'', data.email||'', data.phone||'', data.website||'', data.occasion||'', data.date||'', data.notes||'', (data.imageData||'').substring(0,49000), data.createdAt||now, now]);
    return { success: true, id };
  } catch (err) { return { success: false, error: err.message }; }
}

function deleteContact(id) {
  try {
    const sheet = getSheet();
    const data = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) { sheet.deleteRow(i + 1); return { success: true }; }
    }
    return { success: false, error: 'Contact not found' };
  } catch (err) { return { success: false, error: err.message }; }
}

function updateContact(data) {
  try {
    const sheet = getSheet();
    const allData = sheet.getRange(1, 1, sheet.getLastRow(), 13).getValues();
    const headers = ['id','name','title','company','email','phone','website','occasion','date','notes','imageData','createdAt','updatedAt'];
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        const row = i + 1;
        headers.forEach((h, col) => {
          if (h !== 'id' && h !== 'createdAt' && data[h] !== undefined)
            sheet.getRange(row, col + 1).setValue(h === 'imageData' ? (data[h]||'').substring(0,49000) : data[h]);
        });
        sheet.getRange(row, 13).setValue(new Date().toISOString());
        return { success: true };
      }
    }
    return { success: false, error: 'Contact not found' };
  } catch (err) { return { success: false, error: err.message }; }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id','name','title','company','email','phone','website','occasion','date','notes','imageData','createdAt','updatedAt']);
    sheet.getRange(1, 1, 1, 13).setFontWeight('bold');
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}`;

export async function render(container) {
  const savedUrl = localStorage.getItem('sheetsWebAppUrl') || '';
  const pendingCount = await getPendingSyncCount();
  const storage = await getStorageEstimate();
  const storageMB = (storage.usage / 1024 / 1024).toFixed(1);

  container.innerHTML = `
    <h1>Settings</h1>

    <!-- Google Sheets Connection -->
    <div class="card mb-16">
      <h2>Google Sheets Connection</h2>
      <div class="form-group">
        <label class="form-label">Web App URL</label>
        <input class="form-input" type="url" id="sheets-url"
          value="${savedUrl}" placeholder="https://script.google.com/macros/s/...">
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" id="save-url-btn" style="flex:1">Save URL</button>
        <button class="btn btn-primary" id="test-btn" style="flex:1" ${!savedUrl ? 'disabled' : ''}>Test Connection</button>
      </div>
      <div id="connection-result"></div>
    </div>

    <!-- Setup Guide -->
    <details class="collapsible card mb-16">
      <summary>Google Apps Script Setup Guide</summary>
      <div class="content">
        <ol style="padding-left:20px;font-size:0.875rem;color:var(--color-text-light);line-height:1.8;">
          <li>Open your Google Sheet</li>
          <li>Go to <strong>Extensions → Apps Script</strong></li>
          <li>Delete any existing code in <code>Code.gs</code></li>
          <li>Paste the code below</li>
          <li>Click <strong>Deploy → New Deployment</strong></li>
          <li>Click the gear icon, select <strong>Web App</strong></li>
          <li>Set "Who has access" to <strong>Anyone</strong></li>
          <li>Click <strong>Deploy</strong></li>
          <li>Copy the Web App URL and paste it above</li>
        </ol>
        <div class="code-block" style="margin-top:12px;">
          <button class="copy-btn" id="copy-code-btn">Copy</button>
          <code id="script-code">${escapeHtmlBasic(APPS_SCRIPT_CODE)}</code>
        </div>
      </div>
    </details>

    <!-- AI Card Reading -->
    <div class="card mb-16">
      <h2>AI Card Reading</h2>
      <p class="text-sm text-light mb-8">Use Google Gemini to intelligently read business cards when the default OCR gets fields wrong.</p>
      <div class="form-group">
        <label class="form-label">Gemini API Key</label>
        <input class="form-input" type="password" id="gemini-key"
          value="${localStorage.getItem('geminiApiKey') || ''}" placeholder="AIza...">
      </div>
      <button class="btn btn-secondary btn-block" id="save-gemini-btn">Save API Key</button>
      <p class="text-sm text-light mt-8">Free tier: 15 requests/min. <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--color-accent);">Get a free API key</a></p>
    </div>

    <!-- App Info -->
    <div class="card">
      <h2>App Info</h2>
      <p class="text-sm text-light">Version: 1.0.0</p>
      <p class="text-sm text-light">Storage used: ${storageMB} MB</p>
      ${pendingCount > 0 ? `<p class="text-sm" style="color:var(--color-warning);">Pending sync: ${pendingCount} item${pendingCount > 1 ? 's' : ''}</p>` : ''}
      <button class="btn btn-danger btn-block mt-16" id="clear-data-btn">Clear All Local Data</button>
    </div>
  `;

  // Save URL
  container.querySelector('#save-url-btn').addEventListener('click', () => {
    const url = container.querySelector('#sheets-url').value.trim();
    localStorage.setItem('sheetsWebAppUrl', url);
    container.querySelector('#test-btn').disabled = !url;
    showToast('URL saved', 'success', false);
  });

  // Test Connection
  container.querySelector('#test-btn').addEventListener('click', async () => {
    const resultDiv = container.querySelector('#connection-result');
    resultDiv.innerHTML = '<div class="loading-overlay" style="padding:16px;"><div class="spinner"></div><p>Testing...</p></div>';

    const result = await testConnection();

    if (result.success) {
      resultDiv.innerHTML = `
        <div class="connection-result success">
          &#9989; Connected! Sheet: <strong>${escapeHtmlBasic(result.sheetName)}</strong>, ${result.rowCount} contact${result.rowCount !== 1 ? 's' : ''}
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="connection-result error">
          &#10060; ${escapeHtmlBasic(result.error)}
        </div>
      `;
    }
  });

  // Save Gemini key
  container.querySelector('#save-gemini-btn').addEventListener('click', () => {
    const key = container.querySelector('#gemini-key').value.trim();
    if (key) {
      localStorage.setItem('geminiApiKey', key);
      showToast('Gemini API key saved', 'success', false);
    } else {
      localStorage.removeItem('geminiApiKey');
      showToast('Gemini API key removed', 'info', false);
    }
  });

  // Copy code
  container.querySelector('#copy-code-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
      showToast('Code copied to clipboard!', 'success', false);
    }).catch(() => {
      showToast('Failed to copy', 'error', false);
    });
  });

  // Clear data
  container.querySelector('#clear-data-btn').addEventListener('click', async () => {
    if (!confirm('This will delete all local data including cached contacts and card images. Data in Google Sheets will not be affected. Continue?')) return;
    const dbs = await indexedDB.databases?.() || [];
    for (const db of dbs) {
      if (db.name === 'cardvault') indexedDB.deleteDatabase(db.name);
    }
    localStorage.removeItem('sheetsWebAppUrl');
    localStorage.removeItem('sortPreference');
    localStorage.removeItem('geminiApiKey');
    localStorage.removeItem('myCardBackup');
    showToast('All local data cleared', 'success', false);
    setTimeout(() => location.reload(), 1000);
  });
}

function escapeHtmlBasic(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
