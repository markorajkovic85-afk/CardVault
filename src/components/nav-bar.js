// CardVault — Bottom Navigation Bar

const NAV_ITEMS = [
  { path: '#/dashboard', label: 'Dashboard', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="5"/><rect x="12" y="9" width="3" height="9"/><rect x="17" y="6" width="3" height="12"/></svg>` },
  { path: '#/my-card', label: 'My Card', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5 18c0-2 1.5-3 4-3s4 1 4 3"/><line x1="16" y1="9" x2="20" y2="9"/><line x1="16" y1="13" x2="19" y2="13"/></svg>` },
  { path: '#/scan', label: 'Scan', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>` },
  { path: '#/contacts', label: 'Contacts', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
  { path: '#/settings', label: 'Settings', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` }
];

class NavBar extends HTMLElement {
  connectedCallback() {
    this.render();
    window.addEventListener('hashchange', () => this.updateActive());
  }

  render() {
    this.innerHTML = `
      <style>
        nav-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.85);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          backdrop-filter: blur(20px) saturate(180%);
          border-top: 1px solid rgba(201, 168, 76, 0.2);
          display: flex;
          justify-content: space-around;
          padding: 6px 0 calc(6px + var(--safe-bottom));
          z-index: 500;
          max-width: 100%;
          box-shadow: 0 -1px 12px rgba(27, 42, 74, 0.06);
        }
        nav-bar.hidden {
          display: none;
        }
        nav-bar .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          text-decoration: none;
          color: var(--color-text-light);
          font-size: 0.625rem;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 8px;
          transition: color var(--transition);
          -webkit-tap-highlight-color: transparent;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        nav-bar .nav-item .nav-icon { display:flex; align-items:center; justify-content:center; width:28px; height:28px; }
        nav-bar .nav-item.active { color: var(--color-accent); }
        nav-bar .nav-item.active .nav-icon { color: var(--color-accent); }
      </style>
      ${NAV_ITEMS.map((item) => `
        <a class="nav-item ${this.isActive(item.path) ? 'active' : ''}" href="${item.path}" data-path="${item.path}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    `;
    this.updateVisibility();
  }

  isActive(path) {
    const hash = location.hash || '#/my-card';
    return hash.startsWith(path);
  }

  updateActive() {
    this.updateVisibility();
    this.querySelectorAll('.nav-item').forEach((el) => {
      const isActive = this.isActive(el.dataset.path);
      el.classList.toggle('active', isActive);
    });
  }

  updateVisibility() {
    const current = location.hash || '#/my-card';
    this.classList.toggle('hidden', current.startsWith('#/login'));
  }
}

customElements.define('nav-bar', NavBar);
