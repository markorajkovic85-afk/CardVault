// CardVault — Settings Page

import { showToast } from '../components/toast.js';
import { getPendingSyncCount, exportAllToActiveBackends, importContactsFromProvider } from '../js/sync.js';
import { getStorageEstimate } from '../js/db.js';
import { getSupabaseConfig, isSupabaseConfigured, saveSupabaseConfig } from '../js/supabase-client.js';
import { getSession, signOut } from '../js/supabase-auth.js';
import { testProviderConnection } from '../js/remote-sync-api.js';

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

  container.innerHTML = `
    <h1>Settings</h1>

    <div class="card mb-16">
      <h2>Supabase</h2>
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

    <div class="card mb-16">
      <h2>Data & Sync</h2>
      <p class="text-sm text-light">Pending sync queue: <strong>${pendingCount}</strong></p>
      <p class="text-sm text-light">Offline cache usage: <strong>${storageMB} MB</strong></p>
      <div class="flex gap-8 mt-8">
        <button class="btn btn-secondary" id="export-btn" style="flex:1">Push Local → Supabase</button>
        <button class="btn btn-secondary" id="import-btn" style="flex:1">Pull Supabase → Local</button>
      </div>
    </div>
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
      showToast(`Imported ${result.imported} contacts.`, 'success', false);
    } catch (error) {
      showToast(error.message || 'Import failed.', 'error');
    }
  });
}
