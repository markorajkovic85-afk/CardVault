// CardVault — SPA Router & App Init

import { getSession, onAuthStateChange } from './supabase-auth.js';
import { isSupabaseConfigured } from './supabase-client.js';
import { shouldAllowRoute, isPublicRoute } from './auth-guard.js';

const routes = {
  '/login': () => import('../pages/login.js'),
  '/dashboard': () => import('../pages/dashboard.js'),
  '/my-card': () => import('../pages/my-card.js'),
  '/scan': () => import('../pages/scan.js'),
  '/contacts': () => import('../pages/contacts.js'),
  '/contact': () => import('../pages/contact-detail.js'),
  '/settings': () => import('../pages/settings.js')
};

const appEl = document.getElementById('app');

async function navigate() {
  const hash = location.hash.slice(1) || '/my-card';
  const [path, ...params] = hash.split('/').filter(Boolean);
  const route = `/${path || 'my-card'}`;

  const loader = routes[route];
  if (!loader) {
    appEl.innerHTML = '<div class="empty-state"><p>Page not found</p></div>';
    return;
  }

  try {
    const session = isSupabaseConfigured() ? await getSession() : null;
    if (!shouldAllowRoute(route, Boolean(session))) {
      location.hash = '#/login';
      return;
    }

    appEl.style.opacity = '0';
    await new Promise((r) => setTimeout(r, 150));

    const module = await loader();
    const id = params[0] || null;
    appEl.innerHTML = '';
    await module.render(appEl, { id });

    requestAnimationFrame(() => {
      appEl.style.opacity = '1';
    });
  } catch (err) {
    console.error('Navigation error:', err);
    appEl.innerHTML = '<div class="empty-state"><p>Error loading page</p></div>';
    appEl.style.opacity = '1';
  }
}

window.addEventListener('hashchange', navigate);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((err) => {
    console.warn('SW registration failed:', err);
  });
}

window.addEventListener('online', async () => {
  try {
    const { flushSyncQueue } = await import('./sync.js');
    await flushSyncQueue();
  } catch (e) {
    console.warn('Sync flush failed:', e);
  }
});

onAuthStateChange((_event, session) => {
  if (!session && !isPublicRoute(location.hash.slice(1) || '/my-card')) {
    location.hash = '#/login';
    return;
  }
  if (session && (location.hash === '#/login' || location.hash === '')) {
    location.hash = '#/my-card';
  }
});

navigate();
