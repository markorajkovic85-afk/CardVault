// CardVault — SPA Router & App Init

const routes = {
  '/my-card': () => import('../pages/my-card.js'),
  '/scan': () => import('../pages/scan.js'),
  '/contacts': () => import('../pages/contacts.js'),
  '/contact': () => import('../pages/contact-detail.js'),
  '/settings': () => import('../pages/settings.js'),
};

const appEl = document.getElementById('app');

async function navigate() {
  const hash = location.hash.slice(1) || '/my-card';
  const [path, ...params] = hash.split('/').filter(Boolean);
  const route = '/' + path;

  const loader = routes[route];
  if (!loader) {
    appEl.innerHTML = '<div class="empty-state"><p>Page not found</p></div>';
    return;
  }

  try {
    const module = await loader();
    // Pass remaining path segments as params (e.g., /contact/123 → id = "123")
    const id = params[0] || null;
    appEl.innerHTML = '';
    await module.render(appEl, { id });
  } catch (err) {
    console.error('Navigation error:', err);
    appEl.innerHTML = '<div class="empty-state"><p>Error loading page</p></div>';
  }
}

// Listen for hash changes
window.addEventListener('hashchange', navigate);

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.warn('SW registration failed:', err);
  });
}

// Online/offline sync listener
window.addEventListener('online', async () => {
  try {
    const { flushSyncQueue } = await import('./sync.js');
    await flushSyncQueue();
  } catch (e) {
    console.warn('Sync flush failed:', e);
  }
});

// Initial navigation
navigate();
