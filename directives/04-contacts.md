# Directive: Contacts List

## Goal
Display all saved business card contacts with search, sort, detail view, and delete.

## Pages
- `src/pages/contacts.js` — list view
- `src/pages/contact-detail.js` — full detail view

## Data Loading
1. On page mount: load cached contacts from IndexedDB
2. If online: fetch from Google Sheets (`?action=list`), update IndexedDB cache
3. Show cached data immediately, refresh when Sheets data arrives
4. Pull-to-refresh or refresh button to force re-fetch

## List View

### Contact Card
Each card shows:
- **Name** (bold, primary)
- **Company** (secondary text)
- **Occasion/Where Met** (tertiary text)
- **Date** (formatted, right-aligned)
- **Email** — tap opens `mailto:` link
- **Phone** — tap opens `tel:` link

### Search (`src/components/search-bar.js`)
- Single search input at top
- Filters contacts by: name, company, or occasion
- Real-time filtering as user types (debounced 300ms)

### Sort
- Dropdown or toggle buttons: Date (newest first), Name (A-Z), Company (A-Z)
- Default: Date (newest first)
- Sort preference remembered in localStorage

### Delete
- Swipe left on contact to reveal delete button (touch events)
- Confirm dialog: "Delete [Name]'s contact?"
- On confirm:
  1. Remove from IndexedDB
  2. DELETE from Google Sheets (`action=delete&id=X`)
  3. Toast: "Contact deleted" / "Deleted locally, will sync when online"

### Empty State
- No contacts yet: "No contacts saved. Scan your first business card!"
- No search results: "No contacts match your search."

## Detail View (`#/contact/:id`)
- Full card display with all fields
- Scanned card image(s) — front and back if available
- All contact fields: name, title, company, email, phone, website
- Context: where met, date, notes
- Back button to return to list
- Email/phone are tappable links

## Dependencies
- `src/js/db.js` — IndexedDB read/delete
- `src/js/sheets-api.js` — fetch list, delete
- `src/js/sync.js` — offline delete queuing
- `src/components/search-bar.js` — search/sort UI
- `src/components/toast.js` — feedback

## Edge Cases
- Slow network: show cached data with "Refreshing..." indicator
- Delete while offline: queue deletion, mark contact as "pending delete" visually
- Contact with no image: show placeholder icon
- Very long list: virtual scrolling if > 100 contacts (v2 optimization)
