// CardVault — Google Gemini Vision API Client

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `API error ${res.status}`;
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
      phone: (fields.phone || '').trim(),
      website: (fields.website || '').trim()
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('AI request timed out. Try again.');
    }
    throw err;
  }
}
