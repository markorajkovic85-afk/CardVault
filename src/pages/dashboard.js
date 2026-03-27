import { getDashboardStats } from '../js/supabase-api.js';
import { getAllContacts } from '../js/db.js';
import { getConfiguredActiveProviders } from '../js/remote-sync-api.js';
import { exportAllToActiveBackends } from '../js/sync.js';
import { buildVCard } from '../js/qr.js';
import { showToast } from '../components/toast.js';

function formatAxisLabel(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatTooltipDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

function renderTrendBars(points) {
  if (!points.length) return '<p class="text-sm text-light">No data yet.</p>';
  const max = Math.max(...points.map((p) => p.count), 1);
  const first = points[0];
  const mid = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];

  return `
    <div class="trend-chart-wrap">
      <div class="trend-chart-header" id="trend-active-label" aria-live="polite">Tap a bar to view date + count</div>
      <div class="trend-chart">
        <div class="trend-zero-line" aria-hidden="true"></div>
        ${points.map((p) => {
    const dateLabel = formatTooltipDate(p.date);
    return `
            <div class="trend-col">
              <button class="trend-bar-btn" data-date="${p.date}" data-count="${p.count}" data-label="${dateLabel}" aria-label="${dateLabel}: ${p.count} contacts">
                <div class="trend-bar" style="height:${Math.max(6, (p.count / max) * 100)}%"></div>
              </button>
            </div>
          `;
  }).join('')}
      </div>
      <div class="trend-axis" aria-hidden="true">
        <span>${formatAxisLabel(first.date)}</span>
        <span>${formatAxisLabel(mid.date)}</span>
        <span>${formatAxisLabel(last.date)}</span>
      </div>
    </div>
  `;
}

function saveContactsFilter(filter) {
  localStorage.setItem('cardvault.contactsFilter', filter);
  location.hash = '#/contacts';
}

function getDeltaClass(delta) {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

function getDeltaArrow(delta) {
  if (delta > 0) return '▲';
  if (delta < 0) return '▼';
  return '•';
}

function escapeCsvValue(value) {
  const stringValue = String(value || '');
  if (/[",\n]/.test(stringValue)) return `"${stringValue.replaceAll('"', '""')}"`;
  return stringValue;
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadContactsCsv() {
  const contacts = (await getAllContacts()).filter((c) => !c.pendingDelete);
  const headers = ['id', 'name', 'title', 'company', 'email', 'phone', 'website', 'occasion', 'date', 'notes', 'createdAt'];
  const rows = contacts.map((c) => headers.map((header) => escapeCsvValue(c[header])).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  downloadFile(`cardvault-contacts-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8', csv);
  showToast(`Downloaded ${contacts.length} contacts as CSV.`, 'success');
}

async function downloadContactsVcf() {
  const contacts = (await getAllContacts()).filter((c) => !c.pendingDelete);
  const vcfContent = contacts.map((c) => buildVCard(c)).join('\n');
  downloadFile(`cardvault-contacts-${new Date().toISOString().slice(0, 10)}.vcf`, 'text/vcard;charset=utf-8', vcfContent);
  showToast(`Downloaded ${contacts.length} contacts as vCard.`, 'success');
}

export async function render(container) {
  container.innerHTML = '<h1>Dashboard</h1><div class="card"><p>Loading stats…</p></div>';

  try {
    const stats = await getDashboardStats();
    const thisWeek = stats.contactsThisWeek || 0;
    const lastWeek = stats.contactsLastWeek || 0;
    const weekDelta = thisWeek - lastWeek;
    const topOccasion = stats.topOccasions[0]?.occasion || '';
    const topCompany = stats.topCompanies[0]?.company || '';
    const activeProviders = getConfiguredActiveProviders();

    container.innerHTML = `
      <h1>Dashboard</h1>

      <div class="dashboard-bento mb-16">
        <button class="card bento-card bento-stat" id="total-contacts-card">
          <h3>Total Contacts</h3>
          <p class="stat-value">${stats.totalContacts}</p>
          <p class="text-sm text-light">+${stats.contactsThisMonth} this month</p>
          <span class="bento-cta">Open all contacts</span>
        </button>

        <button class="card bento-card bento-stat" id="week-vs-last-card">
          <h3>This Week vs Last Week</h3>
          <p class="stat-value">${thisWeek}</p>
          <span class="stat-delta ${getDeltaClass(weekDelta)}">${getDeltaArrow(weekDelta)} ${weekDelta > 0 ? '+' : ''}${weekDelta} vs last week</span>
          <p class="text-sm text-light mt-8">Last week: ${lastWeek}</p>
          <span class="bento-cta">View this week’s contacts</span>
        </button>

        <div class="card bento-card bento-trend" id="trend-card">
          <h3>30-Day Trend</h3>
          ${renderTrendBars(stats.trend30Days)}
          <p class="text-sm text-light mt-8">Tap a bar to filter contacts by that day.</p>
          <span class="bento-cta">Open latest day in contacts</span>
        </div>

        <button class="card bento-card bento-list" id="top-occasions-card">
          <h3>Top Occasions</h3>
          ${stats.topOccasions.length === 0 ? '<p class="text-sm text-light">No occasions yet.</p>' : `
            <ul class="stats-list">
              ${stats.topOccasions.slice(0, 5).map((item) => `<li><span>${item.occasion}</span><strong>${item.count}</strong></li>`).join('')}
            </ul>
          `}
          <span class="bento-cta">View contacts from top event</span>
        </button>

        <button class="card bento-card bento-list" id="top-companies-card">
          <h3>Top Companies</h3>
          ${stats.topCompanies.length === 0 ? '<p class="text-sm text-light">No companies yet.</p>' : `
            <ul class="stats-list">
              ${stats.topCompanies.slice(0, 5).map((item) => `<li><span>${item.company}</span><strong>${item.count}</strong></li>`).join('')}
            </ul>
          `}
          <span class="bento-cta">View contacts from top company</span>
        </button>

        <div class="bento-export-bar">
          <strong>Export & Sync</strong>
          <span class="text-sm text-light">Providers: ${activeProviders.length ? activeProviders.join(' + ') : 'None configured'}</span>
          <button class="btn btn-secondary" id="download-csv-btn">Download CSV</button>
          <button class="btn btn-secondary" id="download-vcf-btn">Download vCard (.vcf)</button>
          <button class="btn btn-primary" id="sync-now-btn">Sync Now</button>
        </div>
      </div>
    `;

    container.querySelector('#total-contacts-card')?.addEventListener('click', () => saveContactsFilter(''));
    container.querySelector('#week-vs-last-card')?.addEventListener('click', () => saveContactsFilter(''));
    container.querySelector('#top-occasions-card')?.addEventListener('click', () => saveContactsFilter(topOccasion));
    container.querySelector('#top-companies-card')?.addEventListener('click', () => saveContactsFilter(topCompany));

    container.querySelectorAll('.trend-bar-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        container.querySelectorAll('.trend-bar-btn').forEach((other) => other.classList.remove('active'));
        btn.classList.add('active');
        const label = btn.dataset.label || btn.dataset.date || '';
        const count = btn.dataset.count || '0';
        const trendActiveLabel = container.querySelector('#trend-active-label');
        if (trendActiveLabel) trendActiveLabel.textContent = `${label}: ${count} contacts`;
        const date = btn.dataset.date || '';
        saveContactsFilter(date);
      });
    });

    container.querySelector('#trend-card')?.addEventListener('click', () => {
      const latestDate = stats.trend30Days[stats.trend30Days.length - 1]?.date || '';
      saveContactsFilter(latestDate);
    });

    container.querySelector('#download-csv-btn')?.addEventListener('click', downloadContactsCsv);
    container.querySelector('#download-vcf-btn')?.addEventListener('click', downloadContactsVcf);
    container.querySelector('#sync-now-btn')?.addEventListener('click', async () => {
      try {
        const result = await exportAllToActiveBackends();
        showToast(`Sync complete: ${result.exported}/${result.total}`, 'success');
      } catch (error) {
        showToast(error.message || 'Sync failed.', 'error');
      }
    });
  } catch (error) {
    showToast(error.message || 'Failed to load dashboard.', 'error');
    container.innerHTML = '<h1>Dashboard</h1><div class="empty-state"><p>Unable to load stats.</p></div>';
  }
}
