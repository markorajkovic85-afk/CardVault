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
  // Use English + Croatian packs so diacritics like čđšćž are recognized better.
  worker = await Tess.createWorker('eng+hrv', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        // Could dispatch progress events here
      }
    }
  });

  // Keep spacing fidelity (helps emails/websites/phone numbers parse more accurately).
  await worker.setParameters({
    preserve_interword_spaces: '1'
  });

  return worker;
}

export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  // Normalize international prefix to avoid systems that reject a leading +.
  return phone.trim().replace(/^\+/, '00');
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
  const normalizedText = text
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'");

  const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const normalizeLine = (line) => line.replace(/\s+/g, ' ').trim();
  const getDomainRoot = (value) => value
    ? value.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split(/[./]/)[0].toLowerCase()
    : '';

  const fields = {
    name: '',
    title: '',
    company: '',
    email: '',
    phone: '',
    website: ''
  };

  // Extract email — handle OCR spacing and small dot/comma artifacts.
  const emailRegex = /[\w.+-]+\s*[@©]\s*[\w.-]+[.,]\s*[a-z]{2,}/gi;
  const emailMatch = normalizedText.match(emailRegex);
  if (emailMatch) {
    fields.email = emailMatch[0]
      .replace(/\s/g, '')
      .replace(/©/g, '@')
      .replace(/,([a-z]{2,})$/i, '.$1')
      .toLowerCase();
  }

  // Extract phone — support +, 00 prefix and common OCR separators.
  const phonePatterns = [
    /(?:\+|00)?\d[\d\s.()\/-]{7,}\d/g,
    /\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}[\s.-]?\d{2,4}/g,
  ];
  for (const regex of phonePatterns) {
    const matches = text.match(regex);
    if (matches) {
      const valid = matches.filter(p => p.replace(/\D/g, '').length >= 7);
      if (valid.length > 0) {
        fields.phone = normalizePhoneNumber(valid[0]);
        break;
      }
    }
  }
  const phoneDigits = fields.phone.replace(/\D/g, '');

  // Extract website — support any TLD (including .hr), but avoid email fragments.
  const websiteLine = lines.find((line) => {
    if (line.includes('@')) return false;
    return /^(?:https?:\/\/)?(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:\/[\S]*)?$/i.test(line.replace(/\s/g, ''));
  });
  if (websiteLine) {
    fields.website = websiteLine
      .replace(/\s/g, '')
      .replace(/,([a-z]{2,})$/i, '.$1')
      .replace(/[,;]+$/, '')
      .toLowerCase();
  }

  // Extract name/company/title from remaining lines.
  const contentLines = lines.filter(line => {
    const lower = line.toLowerCase();
    if (fields.email && lower.includes(fields.email)) return false;
    if (fields.phone && line.includes(fields.phone)) return false;
    if (phoneDigits.length >= 7 && line.replace(/\D/g, '').includes(phoneDigits)) return false;
    if (fields.website && lower.includes(fields.website.toLowerCase())) return false;
    if (/^(?:\s*(?:m|t|p|ph|mob|tel|phone)\s*[:.-]\s*)?(?:\+|00)?\d[\d\s.()\/-]{6,}$/.test(line)) return false;
    if (/^(?:m|t|p|ph|mob|tel|phone)\s*[:.-]/i.test(line)) return false;
    if (/^\d[\d\s.+-]+$/.test(line)) return false;
    if (/\b(street|st\.|avenue|ave\.|road|rd\.|blvd|suite|floor|city|state|zip|mail|tel|mob|phone|\d{5})\b/i.test(line)) return false;
    if (/@/.test(line) || /www\./i.test(line) || /\.[a-z]{2,}\b/i.test(line)) return false;
    if (line.length < 3) return false;
    return true;
  }).map(normalizeLine);

  const nameStopWords = /\b(international|technology|cluster|solutions?|systems?|group|company|services?|global|europe|european|innovation|digital|consulting)\b/i;
  const titleKeywords = /\b(manager|director|engineer|developer|designer|ceo|cto|cfo|coo|vp|president|founder|consultant|analyst|specialist|coordinator|lead|head|chief|officer|advisor|partner|associate|intern|assistant|executive|architect|scientist|professor|dr\.|doctor|agent|realtor|broker|attorney|lawyer|accountant|therapist|nurse|pharmacist|technician|supervisor|strategist|planner|sales|marketing)\b/i;

  const nameCandidates = contentLines.map((line, idx) => ({ line, idx, sourceIndexes: [idx] }));
  for (let i = 0; i < contentLines.length - 1; i += 1) {
    if (/^\p{L}[\p{L}'’.-]*$/u.test(contentLines[i]) && /^\p{L}[\p{L}'’.-]*$/u.test(contentLines[i + 1])) {
      nameCandidates.push({
        line: `${contentLines[i]} ${contentLines[i + 1]}`,
        idx: i,
        sourceIndexes: [i, i + 1]
      });
    }
  }

  const scoreNameCandidate = ({ line, idx }) => {
    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 2 || tokens.length > 4) return -10;
    if (/[&@\d]/.test(line)) return -8;

    let score = 0;
    score += (tokens.length === 2 || tokens.length === 3) ? 5 : 2;
    score += tokens.filter(t => t.replace(/[.'’-]/g, '').length > 1).length;
    if (nameStopWords.test(line)) score -= 6;
    if (titleKeywords.test(line)) score -= 8;
    if (/^[^a-z]*$/.test(line) && tokens.length > 2) score -= 3;
    score += Math.max(0, 3 - idx);
    return score;
  };

  const bestName = nameCandidates
    .map(candidate => ({ ...candidate, score: scoreNameCandidate(candidate) }))
    .sort((a, b) => b.score - a.score)[0];

  if (bestName && bestName.score > 0) {
    fields.name = bestName.line;
  } else if (contentLines.length > 0) {
    fields.name = contentLines[0];
  }

  const nameSourceIndexes = new Set(bestName?.score > 0 ? bestName.sourceIndexes : []);

  const companyCandidates = [];
  for (let i = 0; i < contentLines.length; i += 1) {
    const line = contentLines[i];
    if (nameSourceIndexes.has(i)) continue;
    if (!fields.title && titleKeywords.test(line)) {
      fields.title = line;
      continue;
    }
    companyCandidates.push(line);
  }

  const websiteRoot = getDomainRoot(fields.website);
  const emailRoot = getDomainRoot(fields.email?.split('@')[1] || '');
  const preferredRoot = websiteRoot || emailRoot;

  if (companyCandidates.length > 0) {
    const bestCompany = companyCandidates
      .map((line, idx) => {
        let score = 0;
        if (preferredRoot && line.toLowerCase().includes(preferredRoot)) score += 7;
        if (/\b(inc|ltd|llc|gmbh|s\.r\.o\.|corp|group|cluster)\b/i.test(line)) score += 2;
        if (!titleKeywords.test(line)) score += 1;
        score += Math.max(0, 2 - idx);
        return { line, score };
      })
      .sort((a, b) => b.score - a.score)[0];

    fields.company = bestCompany.line;
  }

  // Fallback: derive company from website domain if company is still empty
  if (!fields.company && fields.website) {
    const domain = getDomainRoot(fields.website);
    if (domain && domain.length > 2) {
      fields.company = domain.charAt(0).toUpperCase() + domain.slice(1);
    }
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
