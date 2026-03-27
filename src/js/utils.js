// CardVault — Shared Utilities

/**
 * Generate a UUID v4
 */
export function uuid() {
  return crypto.randomUUID?.() ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/**
 * Format a date string to locale display
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch {
    return isoString;
  }
}

/**
 * Get initials from a name (for avatar placeholders)
 */
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Debounce a function
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Resize an image File to max width, returns base64 data URL.
 * Does NOT correct EXIF orientation — use camera.js fileToDataUrl for that.
 */
export function resizeImage(file, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const isPortrait = img.naturalHeight > img.naturalWidth;
        // For portrait images, constrain by height instead of width
        const scale = isPortrait
          ? Math.min(1, maxWidth / img.naturalHeight)
          : Math.min(1, maxWidth / img.naturalWidth);
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Resize a base64 image string.
 * Handles both landscape (constrain width) and portrait (constrain height)
 * so vertical business cards are never over-compressed.
 */
export function resizeBase64Image(dataUrl, maxDimension = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const isPortrait = h > w;
      // Scale so the longer dimension hits maxDimension
      const scale = Math.min(1, maxDimension / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', isPortrait ? 0.88 : 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Create a thumbnail for contact list display (small, aspect-ratio-safe)
 */
export function createThumbnail(dataUrl, maxDimension = 200) {
  return resizeBase64Image(dataUrl, maxDimension);
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
