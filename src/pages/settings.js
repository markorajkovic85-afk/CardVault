// CardVault — Settings Page

import { showToast } from '../components/toast.js';
import { getPendingSyncCount, exportAllToActiveBackends, importContactsFromProvider } from '../js/sync.js';
import { getStorageEstimate } from '../js/db.js';
import { getSupabaseConfig, isSupabaseConfigured, saveSupabaseConfig } from '../js/supabase-client.js';
import { getSession, signOut } from '../js/supabase-auth.js';
import { getConfiguredActiveProviders, testProviderConnection } from '../js/remote-sync-api.js';
import { isConfigured as isSheetsConfigured } from '../js/sheets-api.js';

function escapeHtmlBasic(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function render(container) {
  const pendingCount = await getPendingSyncCount();
  const storage = await getStorageEstimate();
  const storageMB = (storage.usage / 1024 / 1024).toFixed(1);
  const config = getSupabaseConfig();
  const session = await getSession();
  const sheetsUrl = localStorage.getItem('sheetsWebAppUrl') || '';
  const activeProviders = getConfiguredActiveProviders();
  const sheetsConfigHtml = `
    <p class="text-sm text-light mb-8">
      Connect a Google Sheet to mirror your contacts in real time.
      <a href="https://docs.cardvault.app/sheets-setup" target="_blank" style="color:var(--color-accent)">Setup guide ↗</a>
    </p>
    <div class="form-group">
      <label class="form-label">Apps Script Web App URL</label>
      <input class="form-input" id="sheets-url"
        placeholder="https://script.google.com/macros/s/…/exec"
        value="${escapeHtmlBasic(sheetsUrl)}">
    </div>
    <div class="flex gap-8">
      <button class="btn btn-secondary" id="sheets-test-btn" style="flex:1">Test Connection</button>
      <button class="btn btn-primary" id="sheets-save-btn" style="flex:1">Save</button>
    </div>
    <p class="text-sm text-light mt-8" id="sheets-status">
      Status: ${isSheetsConfigured() ? '🟢 Configured' : '⚪ Not configured'}
    </p>
  `;

  container.innerHTML = `
    <h1>Settings</h1>

    <details class="card collapsible mb-16">
      <summary>Supabase</summary>
      <div class="content">
        <p class="text-sm text-light mb-8">Status: ${isSupabaseConfigured() ? 'Configured' : 'Missing config'} · ${session ? `Signed in as ${escapeHtmlBasic(session.user.email || 'user')}` : 'Signed out'}</p>
        <div class="form-group">
          <label class="form-label">Supabase URL</label>
          <input class="form-input" id="supabase-url" placeholder="https://your-project.supabase.co" value="${escapeHtmlBasic(config.url)}">
        </div>
        <div class="form-group">
          <label class="form-label">Supabase anon key</label>
          <textarea class="form-input" id="supabase-anon" rows="4" placeholder="eyJ...">${escapeHtmlBasic(config.anonKey)}</textarea>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-secondary" id="test-btn" style="flex:1">Test Connection</button>
          <button class="btn btn-primary" id="save-btn" style="flex:1">Save Config</button>
        </div>
        ${session ? '<button class="btn btn-secondary btn-block mt-8" id="signout-btn">Sign Out</button>' : ''}
      </div>
    </details>

    <details class="card collapsible mb-16">
      <summary>Google Sheets Sync</summary>
      <div class="content">
        ${sheetsConfigHtml}
      </div>
    </details>

    <details class="card collapsible mb-16">
      <summary>Data & Sync</summary>
      <div class="content">
        <p class="text-sm text-light">Active providers: <strong>${activeProviders.length ? activeProviders.join(' + ') : 'None'}</strong></p>
        <p class="text-sm text-light">Pending sync queue: <strong>${pendingCount}</strong></p>
        <p class="text-sm text-light">Offline cache usage: <strong>${storageMB} MB</strong></p>
        <div class="flex gap-8 mt-8">
          <button class="btn btn-secondary" id="export-btn" style="flex:1">Push Local → Active Providers</button>
          <button class="btn btn-secondary" id="import-btn" style="flex:1">Pull Supabase → Local</button>
        </div>
        <button class="btn btn-secondary btn-block mt-8" id="import-sheets-btn">Pull Sheets → Local</button>
      </div>
    </details>
  `;

  container.querySelector('#save-btn').addEventListener('click', () => {
    const url = container.querySelector('#supabase-url').value.trim();
    const anonKey = container.querySelector('#supabase-anon').value.trim();
    if (!url || !anonKey) {
      showToast('Supabase URL and anon key are required.', 'warning');
      return;
    }
    saveSupabaseConfig({ url, anonKey });
    showToast('Supabase config saved.', 'success');
  });

  container.querySelector('#sheets-save-btn').addEventListener('click', () => {
    const url = container.querySelector('#sheets-url').value.trim();
    localStorage.setItem('sheetsWebAppUrl', url);
    container.querySelector('#sheets-status').textContent = `Status: ${isSheetsConfigured() ? '🟢 Configured' : '⚪ Not configured'}`;
    showToast('Sheets URL saved.', 'success', false);
  });

  container.querySelector('#test-btn').addEventListener('click', async () => {
    try {
      const result = await testProviderConnection('supabase');
      if (result.success) {
        showToast(result.authenticated ? 'Connection OK and authenticated.' : 'Connection OK. Please sign in on Login page.', 'success');
      } else {
        showToast(result.error || 'Connection failed.', 'error');
      }
    } catch (error) {
      showToast(error.message || 'Connection test failed.', 'error');
    }
  });

  container.querySelector('#sheets-test-btn').addEventListener('click', async () => {
    try {
      const { testConnection } = await import('../js/sheets-api.js');
      const result = await testConnection();
      if (result.success) {
        showToast(`Connected: "${result.sheetName}" · ${result.rowCount} rows`, 'success');
      } else {
        showToast(result.error || 'Connection failed', 'error');
      }
    } catch (error) {
      showToast(error.message || 'Connection failed', 'error');
    }
  });

  const signOutBtn = container.querySelector('#signout-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await signOut();
      showToast('Signed out.', 'success', false);
      location.hash = '#/login';
    });
  }

  container.querySelector('#export-btn').addEventListener('click', async () => {
    try {
      const result = await exportAllToActiveBackends();
      showToast(`Export complete: ${result.exported}/${result.total}`, 'success');
    } catch (error) {
      showToast(error.message || 'Export failed.', 'error');
    }
  });

  container.querySelector('#import-btn').addEventListener('click', async () => {
    try {
      const result = await importContactsFromProvider('supabase', true);
      showToast(`Imported ${result.imported} contacts from Supabase.`, 'success', false);
    } catch (error) {
      showToast(error.message || 'Import failed.', 'error');
    }
  });

  container.querySelector('#import-sheets-btn').addEventListener('click', async () => {
    try {
      const result = await importContactsFromProvider('sheets', true);
      showToast(`Imported ${result.imported} contacts from Sheets.`, 'success', false);
    } catch (error) {
      showToast(error.message || 'Sheets import failed.', 'error');
    }
  });
}
