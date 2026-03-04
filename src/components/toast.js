// CardVault — Persistent Toast Notifications

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {'success'|'error'|'warning'|'info'} type - Toast type
 * @param {boolean} persistent - If true, stays until manually dismissed (default: true)
 */
export function showToast(message, type = 'info', persistent = true) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.style.animation = 'slideDown 0.2s ease reverse';
    setTimeout(() => toast.remove(), 200);
  });

  // Auto-dismiss non-persistent toasts after 5s
  if (!persistent) {
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideDown 0.2s ease reverse';
        setTimeout(() => toast.remove(), 200);
      }
    }, 5000);
  }

  container.appendChild(toast);
}

/**
 * Clear all toasts
 */
export function clearToasts() {
  const container = document.getElementById('toast-container');
  if (container) container.innerHTML = '';
}

// Make available globally for non-module scripts
window.showToast = showToast;
window.clearToasts = clearToasts;
