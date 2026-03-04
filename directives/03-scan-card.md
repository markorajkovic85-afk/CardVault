# Directive: Scan & Import Business Cards

## Goal
Scan physical business cards via camera/gallery, extract text with OCR, review, add context, and save.

## Page: `src/pages/scan.js`

## Flow (Step-by-step wizard)

### Step 1: Capture Front
- Two options: "Use Camera" or "Upload Photo"
- Camera: open rear camera via MediaDevices API, show live preview, capture button
- Upload: file input accepting `image/*`
- After capture: run Tesseract.js OCR on image
- Show loading spinner with "Reading card..." message
- Display extracted fields in editable form

### Step 2: Scan Back (Optional)
- "Scan Back of Card" button
- Same capture flow as Step 1
- OCR runs on back image
- **Merge logic:** only fill EMPTY fields from back scan. Never overwrite front data.
- Show merged result with indicator of which side each field came from

### Step 3: Review & Edit
- All extracted fields shown in editable form:
  - Name, Job Title, Company, Email, Phone, Website
- User corrects any OCR mistakes
- Visual indicator for low-confidence fields (if available from Tesseract)

### Step 4: Context
- Where I met this person (text input, e.g., "Tech Conference Berlin")
- Date (date picker, defaults to today)
- Notes (textarea, optional)

### Step 5: Save
- Save to IndexedDB `contacts` store
- Save card image(s) to IndexedDB `cardImages` store (base64)
- Attempt sync to Google Sheets via `sheets-api.js`
- Show persistent toast:
  - Success: "Contact saved & synced to Google Sheets"
  - Offline: "Contact saved locally. Will sync when online."
  - Error: "Save failed: [specific reason]"
- Reset form for next scan

## OCR Field Extraction (`src/js/ocr.js`)
Parse raw OCR text into structured fields using these patterns:
- **Email:** regex for `x@x.x` pattern
- **Phone:** regex for phone patterns (international, with/without country code)
- **Website:** regex for `http://`, `https://`, `www.` patterns
- **Name:** typically the largest/boldest text (first line heuristic)
- **Company:** second line heuristic after name
- **Title:** line between name and company, or line containing common title keywords

## Image Storage
- Store as base64 data URL in IndexedDB
- Front and back stored separately, linked by contact ID
- Max image size: resize to 1200px wide before storing (reduce storage)

## Dependencies
- `src/js/camera.js` — capture/upload
- `src/js/ocr.js` — Tesseract wrapper + field parser
- `src/js/db.js` — IndexedDB
- `src/js/sync.js` — online/offline sync
- `src/js/sheets-api.js` — Google Sheets POST
- `src/components/toast.js` — feedback

## Edge Cases
- OCR fails completely: show "Could not read card" with manual entry option
- Very blurry image: suggest retaking photo
- Duplicate contact: warn if name+company already exists (optional v2)
- Camera permission denied: fall back to upload-only mode
- Large image: resize before OCR for performance
