# Directive: Google Apps Script Integration

## Goal
Provide the Google Apps Script code that turns a Google Sheet into a REST API backend for CardVault.

## Sheet Structure
First row is headers. Data starts at row 2.

| Column | Header | Type |
|--------|--------|------|
| A | id | string (UUID) |
| B | name | string |
| C | title | string |
| D | company | string |
| E | email | string |
| F | phone | string |
| G | website | string |
| H | occasion | string |
| I | date | string (ISO) |
| J | notes | string |
| K | imageData | string (base64, truncated for Sheets cell limit) |
| L | createdAt | string (ISO) |
| M | updatedAt | string (ISO) |

**Note:** Google Sheets cells have a 50,000 character limit. Card images stored as base64 may exceed this. Strategy: store a compressed thumbnail (max 200px wide) in the Sheet, keep full image only in IndexedDB.

## API Endpoints

### GET `?action=test`
Returns: `{ success: true, sheetName: "Sheet1", rowCount: 42 }`
Used by settings page to verify connection.

### GET `?action=list`
Returns: `{ success: true, contacts: [...] }`
All contacts as JSON array.

### POST `action=add`
Body: contact JSON object
Returns: `{ success: true, id: "uuid" }`
Appends new row to sheet.

### POST `action=delete`
Body: `{ id: "uuid" }`
Returns: `{ success: true }`
Finds row by ID column, deletes it.

### POST `action=update`
Body: `{ id: "uuid", ...fields }`
Returns: `{ success: true }`
Finds row by ID, updates changed fields.

## Full Apps Script Code

```javascript
// CardVault — Google Apps Script Backend
// Paste this into Extensions → Apps Script in your Google Sheet
// Deploy as Web App with "Anyone" access

const SHEET_NAME = 'Contacts'; // Change if your sheet tab has a different name

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'test') {
    return jsonResponse(testConnection());
  }

  if (action === 'list') {
    return jsonResponse(listContacts());
  }

  return jsonResponse({ success: false, error: 'Unknown action' });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  if (action === 'add') {
    return jsonResponse(addContact(data));
  }

  if (action === 'delete') {
    return jsonResponse(deleteContact(data.id));
  }

  if (action === 'update') {
    return jsonResponse(updateContact(data));
  }

  return jsonResponse({ success: false, error: 'Unknown action' });
}

function testConnection() {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    return {
      success: true,
      sheetName: sheet.getName(),
      rowCount: Math.max(0, lastRow - 1) // Exclude header
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function listContacts() {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, contacts: [] };

    const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
    const headers = ['id','name','title','company','email','phone','website','occasion','date','notes','imageData','createdAt','updatedAt'];

    const contacts = data.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i] || '');
      return obj;
    });

    return { success: true, contacts };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function addContact(data) {
  try {
    const sheet = getSheet();
    const id = data.id || Utilities.getUuid();
    const now = new Date().toISOString();

    sheet.appendRow([
      id,
      data.name || '',
      data.title || '',
      data.company || '',
      data.email || '',
      data.phone || '',
      data.website || '',
      data.occasion || '',
      data.date || '',
      data.notes || '',
      (data.imageData || '').substring(0, 49000), // Sheets cell limit
      data.createdAt || now,
      now
    ]);

    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function deleteContact(id) {
  try {
    const sheet = getSheet();
    const data = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }

    return { success: false, error: 'Contact not found' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function updateContact(data) {
  try {
    const sheet = getSheet();
    const allData = sheet.getRange(1, 1, sheet.getLastRow(), 13).getValues();
    const headers = ['id','name','title','company','email','phone','website','occasion','date','notes','imageData','createdAt','updatedAt'];

    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        const row = i + 1;
        headers.forEach((h, col) => {
          if (h !== 'id' && h !== 'createdAt' && data[h] !== undefined) {
            sheet.getRange(row, col + 1).setValue(
              h === 'imageData' ? (data[h] || '').substring(0, 49000) : data[h]
            );
          }
        });
        sheet.getRange(row, 13).setValue(new Date().toISOString()); // updatedAt
        return { success: true };
      }
    }

    return { success: false, error: 'Contact not found' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id','name','title','company','email','phone','website','occasion','date','notes','imageData','createdAt','updatedAt']);
    sheet.getRange(1, 1, 1, 13).setFontWeight('bold');
  }

  return sheet;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Deployment Steps
1. Open your Google Sheet
2. Go to **Extensions → Apps Script**
3. Delete any existing code in `Code.gs`
4. Paste the code above
5. Click **Deploy → New Deployment**
6. Click the gear icon, select **Web App**
7. Set "Who has access" to **Anyone**
8. Click **Deploy**
9. Copy the Web App URL
10. Paste into CardVault Settings

## Edge Cases
- Sheet tab renamed: update `SHEET_NAME` constant
- Cell limit exceeded: imageData truncated to 49,000 chars
- Concurrent writes: Google Sheets handles row-level locking
- Script timeout: Apps Script has 6-minute execution limit (not an issue for single operations)
- Quota: Google Apps Script has daily quotas (20,000 calls/day for free accounts)
