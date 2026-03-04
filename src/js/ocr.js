// CardVault — OCR Engine (Tesseract.js)

let worker = null;
let tessLoaded = null;

/**
 * Load Tesseract.js from CDN (once, cached)
 */
function loadTesseract() {
  if (tessLoaded) return tessLoaded;
  if (window.Tesseract?.createWorker) return Promise.resolve(window.Tesseract);

  tessLoaded = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => {
      if (window.Tesseract?.createWorker) {
        resolve(window.Tesseract);
      } else {
        reject(new Error('Tesseract loaded but createWorker not found'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Tesseract.js from CDN'));
    document.head.appendChild(script);
  });
  return tessLoaded;
}

/**
 * Initialize Tesseract worker (lazy, reused)
 */
async function getWorker() {
  if (worker) return worker;

  const Tess = await loadTesseract();
  worker = await Tess.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        // Could dispatch progress events here
      }
    }
  });
  return worker;
}

/**
 * Preprocess image for better OCR: upscale small images, increase contrast
 * Returns a canvas data URL
 */
function preprocessImage(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const minWidth = 1200;
      const scale = img.width < minWidth ? Math.ceil(minWidth / img.width) : 1;
      const w = img.width * scale;
      const h = img.height * scale;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      // Draw upscaled
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      // Increase contrast and convert towards grayscale for better OCR
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Increase contrast (factor 1.5 around midpoint 128)
        const val = Math.min(255, Math.max(0, ((gray - 128) * 1.5) + 128));
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      ctx.putImageData(imageData, 0, 0);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageSource); // fallback to original
    img.src = imageSource;
  });
}

/**
 * Run OCR on an image (base64 data URL or image element)
 * Returns { text, fields }
 */
export async function recognizeText(imageSource) {
  const w = await getWorker();
  // Preprocess: upscale + contrast for better accuracy
  const processed = await preprocessImage(imageSource);
  const { data } = await w.recognize(processed);
  const text = data.text || '';
  console.log('[CardVault OCR] Raw text:', text);
  const fields = extractFields(text);
  return { text, fields };
}

/**
 * Extract structured fields from raw OCR text
 */
export function extractFields(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const fields = {
    name: '',
    title: '',
    company: '',
    email: '',
    phone: '',
    website: ''
  };

  // Extract email — flexible to handle OCR spacing errors
  const emailRegex = /[\w.+-]+\s*@\s*[\w.-]+\.\s*[\w.]+/gi;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    fields.email = emailMatch[0].replace(/\s/g, '').toLowerCase();
  }

  // Extract phone — multiple patterns for OCR variations
  const phonePatterns = [
    /\+?\d[\d\s.()\-]{8,}\d/g,                         // General: digits with separators
    /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,            // US: (123) 456-7890
    /\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/g, // International: +1-234-567-8901
  ];
  for (const regex of phonePatterns) {
    const matches = text.match(regex);
    if (matches) {
      const valid = matches.filter(p => p.replace(/\D/g, '').length >= 7);
      if (valid.length > 0) {
        fields.phone = valid[0].trim();
        break;
      }
    }
  }

  // Extract website — flexible for OCR artifacts
  const urlPatterns = [
    /(?:https?:\/\/|www\.)\s*[\w.-]+\.\s*[\w]{2,}[\S]*/gi,  // Standard URLs
    /[\w.-]+\.\s*(?:com|org|net|io|co|info|biz)\b[\S]*/gi,  // Domain-like patterns without www
  ];
  for (const regex of urlPatterns) {
    const matches = text.match(regex);
    if (matches) {
      // Pick the first match that isn't the email domain
      const url = matches.find(m => !fields.email || !m.includes('@'));
      if (url) {
        fields.website = url.replace(/\s/g, '').replace(/[,;]+$/, '');
        break;
      }
    }
  }

  // Extract name and company from remaining lines
  // Remove lines that contain email, phone, website, or address patterns
  const contentLines = lines.filter(line => {
    const lower = line.toLowerCase();
    if (fields.email && lower.includes(fields.email)) return false;
    if (fields.phone && line.includes(fields.phone)) return false;
    if (fields.website && lower.includes(fields.website.toLowerCase())) return false;
    // Skip lines that look like phone numbers
    if (/^\+?\d[\d\s.()\-]{6,}$/.test(line)) return false;
    // Skip lines that are just numbers (fax, postal codes, etc.)
    if (/^\d[\d\s.+-]+$/.test(line)) return false;
    // Skip address-like lines
    if (/\b(street|st\.|avenue|ave\.|road|rd\.|blvd|suite|floor|city|state|zip|\d{5})\b/i.test(line)) return false;
    // Skip lines that look like URLs or emails even if not matched above
    if (/@/.test(line) || /www\./i.test(line) || /\.com\b/i.test(line)) return false;
    // Skip very short lines (single characters, initials)
    if (line.length < 3) return false;
    return true;
  });

  // Heuristic: first content line is likely the name
  if (contentLines.length > 0) {
    fields.name = contentLines[0];
  }

  // Common title keywords
  const titleKeywords = /\b(manager|director|engineer|developer|designer|ceo|cto|cfo|coo|vp|president|founder|consultant|analyst|specialist|coordinator|lead|head|chief|officer|advisor|partner|associate|intern|assistant|executive|architect|scientist|professor|dr\.|doctor|agent|realtor|broker|attorney|lawyer|accountant|therapist|nurse|pharmacist|technician|supervisor|strategist|planner)\b/i;

  // Try to find title and company from remaining lines
  for (let i = 1; i < contentLines.length; i++) {
    const line = contentLines[i];
    if (!fields.title && titleKeywords.test(line)) {
      fields.title = line;
    } else if (!fields.company && !titleKeywords.test(line)) {
      fields.company = line;
    }
  }

  // If no title found but we have extra lines, second line might be title
  if (!fields.title && contentLines.length > 2) {
    fields.title = contentLines[1];
    if (!fields.company && contentLines.length > 2) {
      fields.company = contentLines[2];
    }
  } else if (!fields.company && contentLines.length > 1 && !fields.title) {
    fields.company = contentLines[1];
  }

  return fields;
}

/**
 * Merge fields from back scan into front scan (don't overwrite existing)
 */
export function mergeFields(front, back) {
  const merged = { ...front };
  for (const key of Object.keys(back)) {
    if (!merged[key] && back[key]) {
      merged[key] = back[key];
    }
  }
  return merged;
}

/**
 * Terminate the worker (cleanup)
 */
export async function terminateOCR() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
