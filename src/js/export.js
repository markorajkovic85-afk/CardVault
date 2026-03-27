// CardVault — Contact Export Utilities
import { getAllContacts } from './db.js';

const CSV_COLUMNS = [
  { key: 'name',     label: 'Name' },
  { key: 'title',    label: 'Title' },
  { key: 'company',  label: 'Company' },
  { key: 'email',    label: 'Email' },
  { key: 'phone',    label: 'Phone' },
  { key: 'website',  label: 'Website' },
  { key: 'occasion', label: 'Occasion' },
  { key: 'date',     label: 'Date Met' },
  { key: 'notes',    label: 'Notes' },
  { key: 'createdAt',label: 'Added' },
];

function escapeCSV(value = '') {
  const s = String(value ?? '').replace(/"/g, '""');
  return /[,"\n\r]/.test(s) ? `"${s}"` : s;
}

export async function downloadContactsCSV() {
  const contacts = (await getAllContacts()).filter(c => !c.pendingDelete);
  if (!contacts.length) throw new Error('No contacts to export');

  const header = CSV_COLUMNS.map(c => c.label).join(',');
  const rows = contacts.map(contact =>
    CSV_COLUMNS.map(col => escapeCSV(contact[col.key])).join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `cardvault-contacts-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return contacts.length;
}

export function buildVCardBatch(contacts) {
  return contacts.filter(c => !c.pendingDelete).map(c => [
    'BEGIN:VCARD',
    'VERSION:3.0',
    c.name    ? `FN:${c.name}`              : '',
    c.title   ? `TITLE:${c.title}`          : '',
    c.company ? `ORG:${c.company}`          : '',
    c.email   ? `EMAIL:${c.email}`          : '',
    c.phone   ? `TEL:${c.phone}`            : '',
    c.website ? `URL:${c.website}`          : '',
    c.notes   ? `NOTE:${c.notes}`           : '',
    'END:VCARD',
  ].filter(Boolean).join('\n')).join('\n\n');
}

export async function downloadContactsVCard() {
  const contacts = (await getAllContacts()).filter(c => !c.pendingDelete);
  if (!contacts.length) throw new Error('No contacts to export');
  const vcf  = buildVCardBatch(contacts);
  const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `cardvault-contacts-${new Date().toISOString().slice(0,10)}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return contacts.length;
}
