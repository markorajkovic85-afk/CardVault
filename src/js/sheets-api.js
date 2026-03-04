// CardVault — Google Sheets Web App API Client

function getWebAppUrl() {
  return (localStorage.getItem('sheetsWebAppUrl') || '').trim();
}

/**
 * Test connection to the Google Sheets Web App
 * Returns { success, sheetName?, rowCount?, error? }
 */
export async function testConnection() {
  const url = getWebAppUrl();
  if (!url) return { success: false, error: 'No Web App URL configured. Go to Settings to add it.' };

  try {
    new URL(url);
  } catch {
    return { success: false, error: 'Invalid URL. Make sure you copied the full Web App URL.' };
  }

  if (!navigator.onLine) {
    return { success: false, error: 'No internet connection. Check your network and try again.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${url}?action=test`, {
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Server returned ${res.status}. Check your Web App URL and deployment settings.` };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timed out. The Web App may be slow or unreachable.' };
    }
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      return { success: false, error: 'Network error. Check your internet connection, or make sure the Web App is deployed with "Anyone" access.' };
    }
    return { success: false, error: `Connection failed: ${err.message}` };
  }
}

/**
 * Fetch all contacts from Google Sheets
 */
export async function fetchContacts() {
  const url = getWebAppUrl();
  if (!url) throw new Error('No Web App URL configured');

  const res = await fetch(`${url}?action=list`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch contacts');
  return data.contacts;
}

/**
 * Add a contact to Google Sheets
 */
export async function addContact(contact) {
  const url = getWebAppUrl();
  if (!url) throw new Error('No Web App URL configured');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script doesn't support application/json in some cases
    body: JSON.stringify({ action: 'add', ...contact })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to add contact');
  return data;
}

/**
 * Delete a contact from Google Sheets
 */
export async function deleteContactFromSheets(id) {
  const url = getWebAppUrl();
  if (!url) throw new Error('No Web App URL configured');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'delete', id })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to delete contact');
  return data;
}

/**
 * Update a contact in Google Sheets
 */
export async function updateContactInSheets(contact) {
  const url = getWebAppUrl();
  if (!url) throw new Error('No Web App URL configured');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'update', ...contact })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to update contact');
  return data;
}

/**
 * Check if Sheets connection is configured
 */
export function isConfigured() {
  return !!getWebAppUrl();
}
