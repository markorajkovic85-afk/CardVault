// CardVault — Google Gemini Vision API Client

import { isSupabaseConfigured, getSupabaseClient } from './supabase-client.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Try models in order of free tier generosity
const MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const LOCAL_STORAGE_KEY = 'geminiApiKey';
const PROFILE_METADATA_KEY = 'geminiApiKeyEncrypted';
const ENCRYPTION_VERSION = 1;

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  return phone.trim().replace(/^\+/, '00');
}

function getApiKey() {
  return (localStorage.getItem(LOCAL_STORAGE_KEY) || '').trim();
}

function setApiKey(key) {
  const normalized = (key || '').trim();
  if (!normalized) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return '';
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, normalized);
  return normalized;
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveUserScopedKey(userId) {
  if (!crypto?.subtle) {
    throw new Error('Browser crypto API unavailable');
  }

  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`cardvault-gemini:${userId}`),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(`${location.origin}:cardvault-gemini-profile-v1`),
      iterations: 120000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptApiKey(userId, apiKey) {
  const key = await deriveUserScopedKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(apiKey)
  );

  return {
    version: ENCRYPTION_VERSION,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted))
  };
}

async function decryptApiKey(userId, payload) {
  if (!payload?.iv || !payload?.ciphertext) return '';
  const key = await deriveUserScopedKey(userId);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.ciphertext)
  );
  return new TextDecoder().decode(decrypted).trim();
}

async function getAuthenticatedUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user || null;
}

export function getStoredGeminiKey() {
  return getApiKey();
}

export async function hydrateGeminiKeyFromProfile({ force = false } = {}) {
  if (!force && getApiKey()) return { source: 'local', synced: false };

  try {
    const user = await getAuthenticatedUser();
    const encryptedPayload = user?.user_metadata?.[PROFILE_METADATA_KEY];
    if (!user || !encryptedPayload) return { source: 'none', synced: false };

    const decrypted = await decryptApiKey(user.id, encryptedPayload);
    if (!decrypted) return { source: 'none', synced: false };

    setApiKey(decrypted);
    return { source: 'supabase', synced: true };
  } catch (error) {
    console.warn('Unable to load Gemini key from Supabase profile:', error.message || error);
    return { source: 'error', synced: false, error: error.message || 'Sync failed' };
  }
}

export async function saveGeminiKey(apiKey) {
  const normalized = setApiKey(apiKey);
  if (!normalized) throw new Error('Gemini API key is required.');

  try {
    const user = await getAuthenticatedUser();
    if (!user) return { savedLocal: true, savedRemote: false };

    const encryptedPayload = await encryptApiKey(user.id, normalized);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      data: { [PROFILE_METADATA_KEY]: encryptedPayload }
    });
    if (error) throw error;
    return { savedLocal: true, savedRemote: true };
  } catch (error) {
    console.warn('Unable to sync Gemini key to Supabase profile:', error.message || error);
    return { savedLocal: true, savedRemote: false, error: error.message || 'Sync failed' };
  }
}

export async function clearGeminiKey() {
  setApiKey('');

  try {
    const user = await getAuthenticatedUser();
    if (!user) return { clearedLocal: true, clearedRemote: false };

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      data: { [PROFILE_METADATA_KEY]: null }
    });
    if (error) throw error;
    return { clearedLocal: true, clearedRemote: true };
  } catch (error) {
    console.warn('Unable to clear Gemini key from Supabase profile:', error.message || error);
    return { clearedLocal: true, clearedRemote: false, error: error.message || 'Sync failed' };
  }
}

/**
 * Check if Gemini AI is configured
 */
export function isGeminiConfigured() {
  return !!getApiKey();
}

function parseJsonResponse(text) {
  const sanitized = text.replace(/[\x00-\x1f\x7f]/g, (ch) => {
    if (ch === '\n' || ch === '\r' || ch === '\t') return ch;
    return '';
  });

  const stripped = sanitized.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(stripped);
  } catch (e) {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch (e2) {
        // fall through
      }
    }
    console.error('[Gemini] Failed to parse JSON response. Raw text:', text);
    throw new Error('AI returned invalid data. Please try again.');
  }
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
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          title: { type: "string" },
          company: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          website: { type: "string" }
        },
        required: ["name", "title", "company", "email", "phone", "website"]
      }
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

      const fields = parseJsonResponse(text);

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
