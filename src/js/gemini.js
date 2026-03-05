// CardVault — Google Gemini Vision API Client

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Try models in order of free tier generosity
const MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  return phone.trim().replace(/^\+/, '00');
}

function getApiKey() {
  return (localStorage.getItem('geminiApiKey') || '').trim();
}

/**
 * Check if Gemini AI is configured
 */
export function isGeminiConfigured() {
  return !!getApiKey();
}

/**
 * Extract business card fields from an image using Gemini Vision
 * @param {string} imageBase64 - Base64 data URL of the card image
 * @param {string} [backImageBase64] - Optional back side image
 * @returns {Promise<{name, title, company, email, phone, website}>}
 */
export async function extractFieldsWithAI(imageBase64, backImageBase64 = null) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Gemini API key not configured');

  // Strip data URL prefix to get raw base64
  const stripPrefix = (dataUrl) => dataUrl.replace(/^data:image\/\w+;base64,/, '');

  const imageParts = [
    {
      inlineData: {
        mimeType: 'image/png',
        data: stripPrefix(imageBase64)
      }
    }
  ];

  if (backImageBase64) {
    imageParts.push({
      inlineData: {
        mimeType: 'image/png',
        data: stripPrefix(backImageBase64)
      }
    });
  }

  const prompt = `You are extracting contact information from a business card image.
Analyze the visual layout, font sizes, and positioning to correctly identify each field.
Typically: the largest/boldest text is the person's name, smaller text below is their job title, and the company name is often prominent too.

Return ONLY a JSON object with these exact keys (use empty string if not found):
{
  "name": "Full name of the person",
  "title": "Job title / position",
  "company": "Company or organization name",
  "email": "Email address",
  "phone": "Phone number (keep original formatting)",
  "website": "Website URL"
}

Important: preserve Balkan/Slavic diacritics exactly as printed (č, ć, š, ž, đ) for names, titles, and company fields.
For phone values, if the number starts with + return it with 00 instead (example: +385... -> 00385...).

${backImageBase64 ? 'Two images are provided: the front and back of the card. Combine information from both sides.' : 'One image is provided: the front of the card.'}

Return ONLY valid JSON, no markdown, no explanation.`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        ...imageParts
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500
    }
  };

  // Try each model in order, falling back on quota/rate errors
  let lastError = null;

  for (const model of MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.error?.message || `API error ${res.status}`;
        // If quota exceeded, try the next model
        if (res.status === 429 || msg.toLowerCase().includes('quota')) {
          console.warn(`[Gemini] ${model} quota exceeded, trying next model...`);
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON from response (handle potential markdown wrapping)
      const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const fields = JSON.parse(jsonStr);

      // Validate and sanitize
      return {
        name: (fields.name || '').trim(),
        title: (fields.title || '').trim(),
        company: (fields.company || '').trim(),
        email: (fields.email || '').trim().toLowerCase(),
        phone: normalizePhoneNumber(fields.phone || ''),
        website: (fields.website || '').trim()
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('AI request timed out. Try again.');
      }
      lastError = err;
      // Only retry on quota errors, not on other failures
      if (!err.message?.toLowerCase().includes('quota')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('All AI models exceeded quota. Try again later.');
}
