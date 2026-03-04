// CardVault — Settings Page

import { showToast } from '../components/toast.js';
import { getPendingSyncCount, exportAllToActiveBackends, importContactsFromProvider, getSyncModeLabel } from '../js/sync.js';
import { getStorageEstimate } from '../js/db.js';
import { getSyncMode, setSyncMode, testProviderConnection, getProviderLabel } from '../js/remote-sync-api.js';

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

const NOTION_APPS_SCRIPT_CODE = `// CardVault — Notion Sync via Google Apps Script
// 1) Create a Notion integration and copy the secret token
// 2) Share your Notion database with that integration
// 3) Set DATABASE_ID and NOTION_TOKEN below
// 4) Deploy this script as a Web App (Anyone)

const NOTION_TOKEN = 'secret_xxx';
const DATABASE_ID = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const NOTION_VERSION = '2022-06-28';

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'test') return jsonResponse(testConnection());
  if (action === 'list') return jsonResponse(listContacts());
  return jsonResponse({ success: false, error: 'Unknown action' });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  const data = payload.contact || payload;
  const action = payload.action;

  if (action === 'add') return jsonResponse(addContact(data));
  if (action === 'delete') return jsonResponse(deleteContact(data.id || payload.id));
  if (action === 'update') return jsonResponse(updateContact(data));
  return jsonResponse({ success: false, error: 'Unknown action' });
}

function notionRequest(path, method, payload) {
  const options = {
    method: method || 'get',
    muteHttpExceptions: true,
    headers: {
      'Authorization': 'Bearer ' + NOTION_TOKEN,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    }
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  const res = UrlFetchApp.fetch('https://api.notion.com/v1' + path, options);
  const status = res.getResponseCode();
  const body = JSON.parse(res.getContentText() || '{}');
  if (status < 200 || status >= 300) {
    throw new Error(body.message || ('Notion API error ' + status));
  }
  return body;
}

function testConnection() {
  try {
    const response = notionRequest('/databases/' + DATABASE_ID, 'get');
    return {
      success: true,
      databaseTitle: (((response.title || [])[0] || {}).plain_text) || 'Untitled',
      rowCount: 'Connected'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function listContacts() {
  try {
    const response = notionRequest('/databases/' + DATABASE_ID + '/query', 'post', {
      page_size: 100,
      filter: { property: 'Archived', checkbox: { equals: false } }
    });
    return { success: true, contacts: response.results.map(toContact) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function addContact(data) {
  try {
    const contact = { ...data, id: data.id || Utilities.getUuid() };
    const existingPageId = findPageIdByContactId(contact.id);
    if (existingPageId) {
      return updateContactByPageId(existingPageId, contact);
    }
    return createContactPage(contact);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function createContactPage(data) {
  const now = new Date().toISOString();
  const response = notionRequest('/pages', 'post', {
    parent: { database_id: DATABASE_ID },
    properties: buildProperties({ ...data, createdAt: data.createdAt || now, updatedAt: now, archived: false })
  });
  return { success: true, id: data.id, notionPageId: response.id };
}

function updateContactByPageId(pageId, data) {
  notionRequest('/pages/' + pageId, 'patch', {
    properties: buildProperties({ ...data, updatedAt: new Date().toISOString(), archived: false })
  });
  return { success: true, id: data.id, notionPageId: pageId };
}

function updateContact(data) {
  try {
    const pageId = findPageIdByContactId(data.id);
    if (!pageId) return createContactPage(data);
    return updateContactByPageId(pageId, data);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function deleteContact(id) {
  try {
    const pageId = findPageIdByContactId(id);
    if (!pageId) return { success: false, error: 'Contact not found' };

    notionRequest('/pages/' + pageId, 'patch', { archived: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function findPageIdByContactId(contactId) {
  const response = notionRequest('/databases/' + DATABASE_ID + '/query', 'post', {
    page_size: 1,
    filter: { property: 'ID', rich_text: { equals: contactId } }
  });
  return response.results[0] ? response.results[0].id : null;
}

function buildProperties(c) {
  return {
    Name: { title: [{ text: { content: c.name || 'Unknown' } }] },
    ID: { rich_text: [{ text: { content: c.id || '' } }] },
    Title: { rich_text: [{ text: { content: c.title || '' } }] },
    Company: { rich_text: [{ text: { content: c.company || '' } }] },
    Email: { email: c.email || null },
    Phone: { phone_number: c.phone || null },
    Website: { url: c.website || null },
    Occasion: { rich_text: [{ text: { content: c.occasion || '' } }] },
    Date: { rich_text: [{ text: { content: c.date || '' } }] },
    Notes: { rich_text: [{ text: { content: c.notes || '' } }] },
    ImageData: { rich_text: [{ text: { content: (c.imageData || '').substring(0, 1900) } }] },
    CreatedAt: { rich_text: [{ text: { content: c.createdAt || '' } }] },
    UpdatedAt: { rich_text: [{ text: { content: c.updatedAt || '' } }] },
    Archived: { checkbox: !!c.archived }
  };
}

function toContact(page) {
  const p = page.properties || {};
  return {
    id: rich(p.ID),
    name: title(p.Name),
    title: rich(p.Title),
    company: rich(p.Company),
    email: p.Email ? (p.Email.email || '') : '',
    phone: p.Phone ? (p.Phone.phone_number || '') : '',
    website: p.Website ? (p.Website.url || '') : '',
    occasion: rich(p.Occasion),
    date: rich(p.Date),
    notes: rich(p.Notes),
    imageData: rich(p.ImageData),
    createdAt: rich(p.CreatedAt),
    updatedAt: rich(p.UpdatedAt)
  };
}

function rich(prop) {
  return ((prop && prop.rich_text || []).map(x => x.plain_text).join('')) || '';
}

function title(prop) {
  return ((prop && prop.title || []).map(x => x.plain_text).join('')) || '';
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}`;

export async function render(container) {
  const syncMode = getSyncMode();
  const pendingCount = await getPendingSyncCount();
  const storage = await getStorageEstimate();
  const storageMB = (storage.usage / 1024 / 1024).toFixed(1);

  container.innerHTML = `
    <h1>Settings</h1>

    <div class="card mb-16">
      <h2>Sync Mode</h2>
      <p class="text-sm text-light mb-8">Current: ${escapeHtmlBasic(getSyncModeLabel())}</p>
      <div class="form-group">
        <label class="form-label">Active backend(s)</label>
        <select class="form-input" id="sync-mode">
          <option value="sheets" ${syncMode === 'sheets' ? 'selected' : ''}>Google Sheets only</option>
          <option value="notion" ${syncMode === 'notion' ? 'selected' : ''}>Notion only</option>
          <option value="both" ${syncMode === 'both' ? 'selected' : ''}>Google Sheets + Notion (both)</option>
        </select>
      </div>
    </div>

    <div class="card mb-16">
      <h2>Backend Connection URLs</h2>
      <div class="form-group">
        <label class="form-label">Google Sheets Web App URL</label>
        <input class="form-input" type="url" id="sheets-url"
          value="${localStorage.getItem('sheetsWebAppUrl') || ''}" placeholder="https://script.google.com/macros/s/...">
      </div>
      <div class="form-group">
        <label class="form-label">Notion Web App URL</label>
        <input class="form-input" type="url" id="notion-url"
          value="${localStorage.getItem('notionWebAppUrl') || ''}" placeholder="https://script.google.com/macros/s/...">
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" id="save-url-btn" style="flex:1">Save URLs</button>
        <button class="btn btn-secondary" id="test-sheets-btn" style="flex:1">Test Google Sheets</button>
        <button class="btn btn-secondary" id="test-notion-btn" style="flex:1">Test Notion</button>
      </div>
      <div id="connection-result"></div>
    </div>

    <div class="card mb-16">
      <h2>Data Transfer</h2>
      <p class="text-sm text-light mb-8">Use export to extract local data into active backend(s). Use import to recover local data from one source.</p>
      <button class="btn btn-primary btn-block" id="export-btn">Export Local Contacts to Active Backend(s)</button>

      <div class="form-group mt-16">
        <label class="form-label">Import source</label>
        <select class="form-input" id="import-source">
          <option value="sheets">Google Sheets</option>
          <option value="notion">Notion</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Import strategy</label>
        <select class="form-input" id="import-strategy">
          <option value="merge">Merge into local data</option>
          <option value="replace">Replace all local contacts</option>
        </select>
      </div>
      <button class="btn btn-secondary btn-block" id="import-btn">Import Contacts from Source</button>
    </div>

    <details class="collapsible card mb-16">
      <summary>Google Sheets Setup Guide</summary>
      <div class="content">
        <ol style="padding-left:20px;font-size:0.875rem;color:var(--color-text-light);line-height:1.8;">
          <li>Open your Google Sheet</li>
          <li>Go to <strong>Extensions → Apps Script</strong></li>
          <li>Paste the code below and deploy as Web App (Anyone)</li>
        </ol>
        <div class="code-block" style="margin-top:12px;">
          <button class="copy-btn" id="copy-sheets-code-btn">Copy</button>
          <code>${escapeHtmlBasic(APPS_SCRIPT_CODE)}</code>
        </div>
      </div>
    </details>

    <details class="collapsible card mb-16">
      <summary>Notion Setup Guide (with upsert + import-friendly behavior)</summary>
      <div class="content">
        <ol style="padding-left:20px;font-size:0.875rem;color:var(--color-text-light);line-height:1.8;">
          <li>Create a Notion integration and database</li>
          <li>Share the database with the integration</li>
          <li>Set <code>NOTION_TOKEN</code> and <code>DATABASE_ID</code></li>
          <li>Deploy the script as Web App (Anyone)</li>
        </ol>
        <div class="code-block" style="margin-top:12px;">
          <button class="copy-btn" id="copy-notion-code-btn">Copy</button>
          <code>${escapeHtmlBasic(NOTION_APPS_SCRIPT_CODE)}</code>
        </div>
      </div>
    </details>

    <div class="card mb-16">
      <h2>AI Card Reading</h2>
      <div class="form-group">
        <label class="form-label">Gemini API Key</label>
        <input class="form-input" type="password" id="gemini-key"
          value="${localStorage.getItem('geminiApiKey') || ''}" placeholder="AIza...">
      </div>
      <button class="btn btn-secondary btn-block" id="save-gemini-btn">Save API Key</button>
    </div>

    <div class="card">
      <h2>App Info</h2>
      <p class="text-sm text-light">Version: 1.2.0</p>
      <p class="text-sm text-light">Storage used: ${storageMB} MB</p>
      ${pendingCount > 0 ? `<p class="text-sm" style="color:var(--color-warning);">Pending sync: ${pendingCount} item${pendingCount > 1 ? 's' : ''}</p>` : ''}
      <button class="btn btn-danger btn-block mt-16" id="clear-data-btn">Clear All Local Data</button>
    </div>
  `;

  container.querySelector('#sync-mode').addEventListener('change', (e) => {
    setSyncMode(e.target.value);
    showToast(`Sync mode saved: ${e.target.options[e.target.selectedIndex].text}`, 'success', false);
    render(container);
  });

  container.querySelector('#save-url-btn').addEventListener('click', () => {
    localStorage.setItem('sheetsWebAppUrl', container.querySelector('#sheets-url').value.trim());
    localStorage.setItem('notionWebAppUrl', container.querySelector('#notion-url').value.trim());
    showToast('Backend URLs saved', 'success', false);
  });

  container.querySelector('#test-sheets-btn').addEventListener('click', () => runConnectionTest(container, 'sheets'));
  container.querySelector('#test-notion-btn').addEventListener('click', () => runConnectionTest(container, 'notion'));

  container.querySelector('#export-btn').addEventListener('click', async () => {
    try {
      showToast('Export started...', 'info', false);
      const result = await exportAllToActiveBackends();
      showToast(`Export done. ${result.exported}/${result.total} contacts exported.`, result.failed ? 'warning' : 'success', false);
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  });

  container.querySelector('#import-btn').addEventListener('click', async () => {
    const provider = container.querySelector('#import-source').value;
    const replaceLocal = container.querySelector('#import-strategy').value === 'replace';

    if (replaceLocal && !confirm('Replace will wipe all local contacts before importing. Continue?')) return;

    try {
      const result = await importContactsFromProvider(provider, replaceLocal);
      showToast(`Imported ${result.imported} contacts from ${getProviderLabel(provider)}.`, 'success', false);
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error');
    }
  });

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

  container.querySelector('#copy-sheets-code-btn').addEventListener('click', () => copyCode(APPS_SCRIPT_CODE));
  container.querySelector('#copy-notion-code-btn').addEventListener('click', () => copyCode(NOTION_APPS_SCRIPT_CODE));

  container.querySelector('#clear-data-btn').addEventListener('click', async () => {
    if (!confirm('This will delete all local data including cached contacts and card images. Cloud data will not be affected. Continue?')) return;
    const dbs = await indexedDB.databases?.() || [];
    for (const db of dbs) {
      if (db.name === 'cardvault') indexedDB.deleteDatabase(db.name);
    }
    localStorage.removeItem('sheetsWebAppUrl');
    localStorage.removeItem('notionWebAppUrl');
    localStorage.removeItem('syncProvider');
    localStorage.removeItem('syncMode');
    localStorage.removeItem('sortPreference');
    localStorage.removeItem('geminiApiKey');
    localStorage.removeItem('myCardBackup');
    showToast('All local data cleared', 'success', false);
    setTimeout(() => location.reload(), 1000);
  });
}

async function runConnectionTest(container, provider) {
  const resultDiv = container.querySelector('#connection-result');
  resultDiv.innerHTML = '<div class="loading-overlay" style="padding:16px;"><div class="spinner"></div><p>Testing...</p></div>';

  const result = await testProviderConnection(provider);
  if (result.success) {
    const targetName = result.databaseTitle || result.sheetName || getProviderLabel(provider);
    resultDiv.innerHTML = `<div class="connection-result success">&#9989; ${escapeHtmlBasic(getProviderLabel(provider))} connected: <strong>${escapeHtmlBasic(targetName)}</strong></div>`;
  } else {
    resultDiv.innerHTML = `<div class="connection-result error">&#10060; ${escapeHtmlBasic(result.error || 'Connection failed')}</div>`;
  }
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast('Code copied to clipboard!', 'success', false);
  }).catch(() => {
    showToast('Failed to copy', 'error', false);
  });
}

function escapeHtmlBasic(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
