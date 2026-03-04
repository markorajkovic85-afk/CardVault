# CardVault — AI Agent Context

> Read AGENTS.md for the 3-layer architecture. This file adds CardVault-specific context.

## Project
CardVault is a mobile-first PWA for managing business cards. No build step — vanilla JS + ES modules + CDN imports.

## Quick Reference
- **Directives:** `directives/01-07` — SOPs for each feature area
- **App code:** `src/` — HTML, CSS, JS (pages, components, utilities)
- **Theme:** Navy `#1B2A4A` + Gold `#C9A84C`
- **Backend:** Google Sheets via Apps Script Web App
- **Offline:** IndexedDB + pendingSync queue
- **OCR:** Tesseract.js v5 (English only, CDN)
- **Hosting:** GitHub Pages (static)

## Key Files
| File | Purpose |
|------|---------|
| `src/js/db.js` | IndexedDB wrapper (myCard, contacts, cardImages, pendingSync stores) |
| `src/js/sync.js` | Offline sync engine — queues operations, flushes on reconnect |
| `src/js/sheets-api.js` | Google Sheets Web App client (add, list, delete, update, test) |
| `src/js/ocr.js` | Tesseract.js wrapper + field extraction parser |
| `src/js/app.js` | Hash-based SPA router |

## Conventions
- All pages are ES modules in `src/pages/`, export a `render()` function
- All components are in `src/components/`, registered as web components
- Use `showToast(message, type)` for user feedback (never silent failures)
- IDs are UUIDs generated client-side
- Dates stored as ISO strings
- Images stored as base64 data URLs in IndexedDB

## Don't
- Don't add a build step or bundler
- Don't use npm packages (CDN only)
- Don't store secrets in code (Sheets URL is user-configured)
- Don't write to localStorage for anything except settings (use IndexedDB for data)
