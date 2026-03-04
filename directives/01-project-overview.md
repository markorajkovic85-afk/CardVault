# Directive: Project Overview

## Goal
Build CardVault — a mobile-first PWA for managing business cards with OCR scanning, QR sharing, Google Sheets backend, and offline support.

## Tech Stack
- **Framework:** Vanilla JS + Web Components (no build step)
- **Styling:** CSS custom properties, navy (#1B2A4A) / gold (#C9A84C) theme
- **OCR:** Tesseract.js v5 (CDN, English only)
- **QR:** qrcode.js (CDN)
- **Camera:** MediaDevices API (browser-native)
- **Offline DB:** IndexedDB via idb wrapper (CDN)
- **Backend:** Google Apps Script Web App → Google Sheets
- **PWA:** Service Worker + manifest.json
- **Hosting:** GitHub Pages (static, no build)
- **Bundling:** None — ES modules with CDN imports

## CDN Libraries
```html
<!-- Tesseract.js v5 -->
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>

<!-- QRCode.js -->
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>

<!-- idb (IndexedDB wrapper) -->
<script type="module">
  import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@8/build/index.js';
</script>
```

## Architecture
Follows the 3-layer pattern from AGENTS.md:
1. **Directives** (`directives/`) — These SOP files
2. **Orchestration** — AI agent reads directives, makes decisions
3. **Execution** (`src/`) — The actual app code (deterministic, testable)

## Routing
Hash-based SPA router (`#/my-card`, `#/scan`, `#/contacts`, `#/settings`).
Pages are lazy-loaded ES modules in `src/pages/`.

## Data Flow
1. User scans card → OCR extracts text → user reviews/edits
2. Contact saved to IndexedDB immediately
3. If online: POST to Google Sheets via Apps Script Web App
4. If offline: queued in `pendingSync` store, flushed on reconnect
5. Contacts list fetches from Sheets, caches in IndexedDB

## Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#1B2A4A` | Nav, headers, card backgrounds |
| `--color-accent` | `#C9A84C` | Buttons, highlights, links |
| `--color-bg` | `#F5F5F5` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, inputs |
| `--color-text` | `#1A1A1A` | Body text |
| `--color-text-light` | `#6B7280` | Secondary text |
| `--color-success` | `#22C55E` | Success toasts |
| `--color-error` | `#EF4444` | Error toasts |
| `--color-warning` | `#F59E0B` | Warning/pending toasts |

## File Map
See plan.md for full folder structure. Key files:
- `src/index.html` — SPA shell
- `src/js/app.js` — Router + init
- `src/js/db.js` — IndexedDB wrapper
- `src/js/sync.js` — Offline sync engine
- `src/js/sheets-api.js` — Google Sheets client
- `src/js/ocr.js` — Tesseract wrapper
- `src/js/qr.js` — QR code generator
- `src/js/camera.js` — Camera/gallery capture
