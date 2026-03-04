# Directive: Offline & Sync Strategy

## Goal
Ensure the app works fully offline and syncs automatically when connectivity is restored.

## Core Principle
IndexedDB is the source of truth locally. Google Sheets is the cloud backup. The app must work without internet after initial load.

## IndexedDB Stores (`src/js/db.js`)

### `myCard`
- Key: `"default"` (single record)
- Value: `{ name, title, company, email, phone, website, photo }`

### `contacts`
- Key: auto-increment `id`
- Value: `{ id, name, title, company, email, phone, website, occasion, date, notes, sheetsId, createdAt, updatedAt, pendingDelete }`

### `cardImages`
- Key: `contactId`
- Value: `{ contactId, front: base64, back: base64 }`

### `pendingSync`
- Key: auto-increment
- Value: `{ action: "add"|"update"|"delete", contactId, data, timestamp }`

## Sync Engine (`src/js/sync.js`)

### Save Flow
```
User saves contact
  → Write to IndexedDB `contacts` store
  → If online:
      → POST to Sheets API
      → If success: store sheetsId, toast "Saved & synced"
      → If fail: add to pendingSync, toast "Saved locally"
  → If offline:
      → Add to pendingSync queue
      → Toast "Saved locally. Will sync when online."
```

### Auto-Sync on Reconnect
```
window.addEventListener('online', flushSyncQueue)

flushSyncQueue():
  → Get all pendingSync entries (ordered by timestamp)
  → For each entry:
      → Execute API call (add/update/delete)
      → If success: remove from pendingSync
      → If fail: keep in queue, retry next time
  → Toast summary: "Synced N contacts"
```

### Delete Flow
```
User deletes contact
  → Mark pendingDelete: true in IndexedDB
  → If online:
      → DELETE from Sheets API
      → If success: remove from IndexedDB
  → If offline:
      → Add delete action to pendingSync
      → Hide from UI (filter pendingDelete contacts)
```

### Contacts Refresh
```
On contacts page load:
  → Show IndexedDB cached contacts immediately
  → If online: fetch from Sheets, update IndexedDB cache
  → Merge: Sheets data wins for existing contacts, local-only contacts preserved
```

## Service Worker Caching (`src/sw.js`)

### Cache Strategy
- **App shell** (HTML, CSS, JS): Cache-first, update in background
- **CDN libs** (Tesseract, QRCode, idb): Cache-first
- **Tesseract model files**: Cache on first use, serve from cache thereafter
- **API calls** (Sheets): Network-first, fall back to cached response

### Cached Assets
```
/index.html
/css/styles.css
/js/app.js, db.js, sync.js, ocr.js, qr.js, camera.js, sheets-api.js, utils.js
/pages/my-card.js, scan.js, contacts.js, contact-detail.js, settings.js
/components/nav-bar.js, card-preview.js, toast.js, search-bar.js
/assets/icons/*, placeholder-avatar.svg
CDN: tesseract.min.js, qrcode.min.js, idb index.js
```

## Status Indicator
- Nav bar shows connection status dot:
  - Green: online, no pending syncs
  - Yellow: online, syncing / or offline with pending items
  - Red: offline

## Edge Cases
- Sync queue grows too large: cap at 100 entries, warn user
- Conflict: last-write-wins using `updatedAt` timestamp
- Sheets quota exceeded: back off, notify user
- Corrupt IndexedDB: graceful degradation, offer "Clear Local Data" in settings
