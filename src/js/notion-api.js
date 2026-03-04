// CardVault — Notion Web App API Client

function getNotionWebAppUrl() {
  return (localStorage.getItem('notionWebAppUrl') || '').trim();
}

export async function testNotionConnection() {
  const url = getNotionWebAppUrl();
  if (!url) return { success: false, error: 'No Notion Web App URL configured. Go to Settings to add it.' };

  try {
    new URL(url);
  } catch {
    return { success: false, error: 'Invalid URL. Make sure you copied the full Web App URL.' };
  }

  if (!navigator.onLine) {
    return { success: false, error: 'No internet connection. Check your network and try again.' };
  }

  try {
    const res = await fetch(`${url}?action=test`);
    if (!res.ok) {
      return { success: false, error: `Server returned ${res.status}. Check your Web App URL and deployment settings.` };
    }
    const data = await res.json();
    return data;
  } catch (err) {
    return { success: false, error: `Connection failed: ${err.message}` };
  }
}

export async function fetchNotionContacts() {
  const url = getNotionWebAppUrl();
  if (!url) throw new Error('No Notion Web App URL configured');

  const res = await fetch(`${url}?action=list`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch contacts');
  return data.contacts;
}

export async function addContactToNotion(contact) {
  const url = getNotionWebAppUrl();
  if (!url) throw new Error('No Notion Web App URL configured');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'add', contact, ...contact })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to add contact');
  return data;
}

export async function updateContactInNotion(contact) {
  const url = getNotionWebAppUrl();
  if (!url) throw new Error('No Notion Web App URL configured');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'update', contact, ...contact })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to update contact');
  return data;
}

export async function deleteContactFromNotion(id) {
  const url = getNotionWebAppUrl();
  if (!url) throw new Error('No Notion Web App URL configured');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'delete', id })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to delete contact');
  return data;
}

export function isNotionConfigured() {
  return !!getNotionWebAppUrl();
}
