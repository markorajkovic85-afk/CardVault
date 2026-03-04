# Directive: My Digital Business Card

## Goal
Display and manage the user's own digital business card with QR sharing.

## Page: `src/pages/my-card.js`

## Fields
| Field | Type | Required |
|-------|------|----------|
| Full Name | text | yes |
| Job Title | text | no |
| Company | text | no |
| Email | email | yes |
| Phone | tel | no |
| Website/LinkedIn | url | no |
| Profile Photo | image (base64) | no |

## Features

### View Mode (default)
- Display card with all fields in a professional card layout
- Show QR code below card (auto-generated from vCard)
- "Edit" button to switch to edit mode
- "Share" button to share card

### Edit Mode
- All fields become editable inline
- Profile photo: tap to select from file picker, stored as base64 in IndexedDB
- "Save" button persists to IndexedDB `myCard` store
- "Cancel" returns to view mode without saving

### QR Code
- Generated using qrcode.js
- Encodes vCard 3.0 format:
```
BEGIN:VCARD
VERSION:3.0
FN:John Doe
TITLE:Software Engineer
ORG:Acme Corp
EMAIL:john@acme.com
TEL:+1234567890
URL:https://linkedin.com/in/johndoe
END:VCARD
```
- Regenerated whenever card data changes

### Share
- Primary: Web Share API (`navigator.share()`) — shares vCard text
- Fallback: Copy vCard URL to clipboard with toast confirmation

## Storage
- IndexedDB store: `myCard` (single record, key: `"default"`)
- Load on page mount, save on edit confirm

## Dependencies
- `src/js/db.js` — IndexedDB operations
- `src/js/qr.js` — QR generation
- `src/components/card-preview.js` — visual card component
- `src/components/toast.js` — feedback messages

## Edge Cases
- First launch: show empty card with "Set up your card" prompt
- No photo: show placeholder avatar SVG
- Very long fields: truncate with ellipsis in view mode, scroll in edit mode
