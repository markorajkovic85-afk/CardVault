# Directive: Settings & Google Sheets Connection

## Goal
Configure Google Sheets connection, test it, and display the required Apps Script code.

## Page: `src/pages/settings.js`

## Sections

### 1. Google Sheets Connection
- **Input field:** "Google Web App URL" — paste the deployed Apps Script URL
- **Save button:** stores URL in localStorage key `sheetsWebAppUrl`
- **Test Connection button:** sends GET to `URL?action=test`
- **Result display (PERSISTENT — stays on screen until next test):**
  - Success: green box — "Connected! Sheet: [name], [N] contacts"
  - Wrong URL: red box — "Invalid URL. Make sure you copied the full Web App URL."
  - CORS error: red box — "Access denied. Make sure the script is deployed as 'Anyone' access."
  - Network error: red box — "Network error. Check your internet connection."
  - Timeout: red box — "Request timed out. Try again."
  - Other: red box — "Error: [message]"

### 2. Google Apps Script Setup Guide
- Step-by-step instructions (collapsible):
  1. Open your Google Sheet
  2. Go to Extensions → Apps Script
  3. Delete any existing code
  4. Paste the code below
  5. Click Deploy → New Deployment
  6. Select "Web App", set access to "Anyone"
  7. Copy the Web App URL
  8. Paste it in the field above
- **Code block** with the full Apps Script code (see directive 07)
- **Copy button** — copies code to clipboard with toast "Copied!"

### 3. App Info
- App version
- Storage usage (IndexedDB size estimate)
- "Clear Local Data" button with confirm dialog
- Pending sync count (if any items waiting to sync)

## Storage
- `localStorage.sheetsWebAppUrl` — the Web App URL
- `localStorage.sortPreference` — contacts sort order

## Dependencies
- `src/js/sheets-api.js` — connection test
- `src/components/toast.js` — copy confirmation

## Edge Cases
- URL with trailing spaces: trim before saving
- URL without https://: warn user
- Test while offline: show network error immediately
- Empty URL: disable test button
