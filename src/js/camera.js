// CardVault — Camera & Image Capture

/**
 * Read EXIF orientation tag from a File (JPEG only).
 * Returns 1–8 (EXIF spec) or 1 if not found.
 */
function getExifOrientation(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView(e.target.result);
      // JPEG SOI marker
      if (view.getUint16(0, false) !== 0xFFD8) { resolve(1); return; }
      let offset = 2;
      while (offset < view.byteLength) {
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xFFE1) {
          // APP1 — may contain Exif
          if (view.getUint32(offset + 2, false) !== 0x45786966) { resolve(1); return; }
          const little = view.getUint16(offset + 8, false) === 0x4949;
          offset += 8;
          const ifd = view.getUint32(offset + 4, little);
          offset += ifd;
          const entries = view.getUint16(offset, little);
          for (let i = 0; i < entries; i++) {
            if (view.getUint16(offset + 2 + i * 12, little) === 0x0112) {
              resolve(view.getUint16(offset + 2 + i * 12 + 8, little));
              return;
            }
          }
        } else if ((marker & 0xFF00) !== 0xFF00) {
          break;
        } else {
          offset += view.getUint16(offset, false);
        }
      }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
}

/**
 * Draw an image onto a canvas applying EXIF orientation correction.
 */
function drawWithOrientation(img, orientation) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  // Orientations 5-8 swap width/height
  if (orientation >= 5 && orientation <= 8) {
    canvas.width = h;
    canvas.height = w;
  } else {
    canvas.width = w;
    canvas.height = h;
  }

  // Apply transform for each EXIF orientation value
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
    default: break; // orientation 1 — no transform needed
  }

  ctx.drawImage(img, 0, 0);
  return canvas;
}

/**
 * Convert a File to an orientation-corrected base64 data URL.
 * Handles JPEG EXIF rotation so vertical cards appear upright.
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    getExifOrientation(file).then((orientation) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = drawWithOrientation(img, orientation);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  });
}

/**
 * Open camera and capture a photo.
 * Returns orientation-corrected base64 data URL or null.
 */
export async function captureFromCamera() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Rear camera

    input.addEventListener('change', async () => {
      if (input.files?.[0]) {
        const dataUrl = await fileToDataUrl(input.files[0]);
        resolve(dataUrl);
      } else {
        resolve(null);
      }
    });

    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * Open file picker for gallery upload.
 * Returns orientation-corrected base64 data URL or null.
 */
export async function uploadFromGallery() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', async () => {
      if (input.files?.[0]) {
        const dataUrl = await fileToDataUrl(input.files[0]);
        resolve(dataUrl);
      } else {
        resolve(null);
      }
    });

    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
