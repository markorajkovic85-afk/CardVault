// CardVault — Camera & Image Capture

/**
 * Open camera and capture a photo
 * Returns base64 data URL or null if cancelled/failed
 */
export async function captureFromCamera() {
  return new Promise((resolve) => {
    // Create hidden file input with camera capture
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
 * Open file picker for gallery upload
 * Returns base64 data URL or null if cancelled
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

/**
 * Convert a File object to base64 data URL
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
