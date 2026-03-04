// CardVault — Bottom Navigation Bar

const NAV_ITEMS = [
  { path: '#/my-card', label: 'My Card', icon: '&#9878;' },
  { path: '#/scan', label: 'Scan', icon: '&#128247;' },
  { path: '#/contacts', label: 'Contacts', icon: '&#128101;' },
  { path: '#/settings', label: 'Settings', icon: '&#9881;' },
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
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
          display: flex;
          justify-content: space-around;
          padding: 8px 0 calc(8px + var(--safe-bottom));
          z-index: 500;
          max-width: 100%;
        }
        nav-bar .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          text-decoration: none;
          color: var(--color-text-light);
          font-size: 0.688rem;
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 8px;
          transition: color var(--transition);
          -webkit-tap-highlight-color: transparent;
        }
        nav-bar .nav-item .nav-icon {
          font-size: 1.25rem;
          line-height: 1;
        }
        nav-bar .nav-item.active {
          color: var(--color-accent);
        }
        nav-bar .nav-item.active .nav-icon {
          color: var(--color-accent);
        }
        nav-bar .status-indicator {
          position: absolute;
          top: 6px;
          right: 6px;
        }
      </style>
      ${NAV_ITEMS.map(item => `
        <a class="nav-item ${this.isActive(item.path) ? 'active' : ''}" href="${item.path}" data-path="${item.path}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    `;
  }

  isActive(path) {
    const hash = location.hash || '#/my-card';
    return hash.startsWith(path);
  }

  updateActive() {
    this.querySelectorAll('.nav-item').forEach(el => {
      const isActive = this.isActive(el.dataset.path);
      el.classList.toggle('active', isActive);
    });
  }
}

customElements.define('nav-bar', NavBar);
