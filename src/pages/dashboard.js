// CardVault — Dashboard (redesigned: symmetrical bento + exports + Sheets)
import { getDashboardStats } from '../js/supabase-api.js';
import { downloadContactsCSV, downloadContactsVCard } from '../js/export.js';
import { isConfigured as isSheetsConfigured } from '../js/sheets-api.js';
import { showToast } from '../components/toast.js';

function arrowIcon(delta) {
  if (delta > 0) return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
  if (delta < 0) return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}

function deltaClass(delta) {
  return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
}

function renderTrendBars(points) {
  if (!points.length) return '<p class="text-sm text-light">No data yet.</p>';
  const max = Math.max(...points.map((p) => p.count), 1);
  const first = points[0]?.date?.slice(5) || '';
  const last = points[points.length - 1]?.date?.slice(5) || '';
  return `
    <div class="trend-chart">
      ${points.map((p) => `
        <div class="trend-col" title="${p.date}: ${p.count}">
          <button class="trend-bar-btn" data-date="${p.date}" data-count="${p.count}"
            aria-label="${p.date}: ${p.count} contacts">
            <div class="trend-bar" style="height:${Math.max(6, (p.count / max) * 100)}%"></div>
          </button>
        </div>
      `).join('')}
    </div>
    <div class="trend-axis">
      <span>${first}</span>
      <span>30-day trend</span>
      <span>${last}</span>
    </div>
  `;
}

function saveContactsFilter(filter) {
  localStorage.setItem('cardvault.contactsFilter', filter);
  location.hash = '#/contacts';
}

export async function render(container) {
  // Show skeleton while loading
  container.innerHTML = `
    <h1>Dashboard</h1>
    <div class="dashboard-bento mb-16">
      <div class="bento-card bento-stat skeleton-card"><div class="skeleton-line" style="width:50%"></div><div class="skeleton-line" style="width:35%;height:28px;margin-top:8px"></div></div>
      <div class="bento-card bento-stat skeleton-card"><div class="skeleton-line" style="width:60%"></div><div class="skeleton-line" style="width:40%;height:28px;margin-top:8px"></div></div>
      <div class="bento-card bento-trend skeleton-card" style="grid-column:span 2"><div class="skeleton-line" style="width:40%"></div><div class="skeleton-line" style="width:100%;height:80px;margin-top:8px"></div></div>
    </div>
  `;

  try {
    const stats = await getDashboardStats();

    // Correct week-vs-last calculation
    const thisWeek = stats.contactsThisWeek || 0;
    const lastWeek = stats.contactsLastWeek || 0;
    const weekDelta = thisWeek - lastWeek;
    const topOccasion = stats.topOccasions[0]?.occasion || '';

    container.innerHTML = `
      <h1>Dashboard</h1>

      <div class="dashboard-bento mb-16">

        <!-- Row 1: Two stat cards -->
        <button class="card bento-card bento-stat" id="total-card">
          <h3>Total Contacts</h3>
          <p class="stat-value">${stats.totalContacts}</p>
          <span class="stat-delta up">
            ${arrowIcon(stats.contactsThisMonth)}
            +${stats.contactsThisMonth} this month
          </span>
          <span class="bento-cta">Open all contacts</span>
        </button>

        <button class="card bento-card bento-stat" id="week-card">
          <h3>This week</h3>
          <p class="stat-value">${thisWeek}</p>
          <span class="stat-delta ${deltaClass(weekDelta)}">
            ${arrowIcon(weekDelta)}
            ${weekDelta > 0 ? '+' : ''}${weekDelta} vs last week
          </span>
          <span class="bento-cta">View this week</span>
        </button>

        <!-- Row 2: Full-width trend chart -->
        <div class="card bento-card bento-trend" id="trend-card">
          <h3>30-day trend</h3>
          ${renderTrendBars(stats.trend30Days)}
          <p class="text-sm text-light mt-8">Tap a bar to filter contacts by that day.</p>
        </div>

        <!-- Row 3: Two list cards -->
        <button class="card bento-card bento-list" id="occasions-card">
          <h3>Top occasions</h3>
          ${stats.topOccasions.length === 0
            ? '<p class="text-sm text-light">No occasions yet.</p>'
            : `<ul class="stats-list">
                ${stats.topOccasions.slice(0, 3).map((item) =>
                  `<li><span>${item.occasion}</span><strong>${item.count}</strong></li>`
                ).join('')}
              </ul>`
          }
          <span class="bento-cta">View by occasion</span>
        </button>

        <div class="card bento-card bento-list">
          <h3>Companies</h3>
          <p class="stat-value" style="font-size:1.5rem">${stats.distinctCompanies}</p>
          <p class="text-sm text-light">distinct companies</p>
        </div>

        <!-- Row 4: Export bar -->
        <div class="bento-export-bar">
          <div style="flex:1;min-width:0">
            <p style="font-size:0.813rem;font-weight:600;color:var(--color-primary);margin:0">Export contacts</p>
            <p class="text-sm text-light" style="margin:2px 0 0">${stats.totalContacts} contacts available</p>
          </div>
          <button class="btn btn-secondary" id="csv-btn" style="font-size:0.813rem;padding:8px 14px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          <button class="btn btn-secondary" id="vcf-btn" style="font-size:0.813rem;padding:8px 14px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            vCard
          </button>
          ${isSheetsConfigured() ? `
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;color:#166534;background:rgba(34,197,94,0.1);border-radius:999px;padding:4px 10px">
              <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block"></span>
              Sheets live
            </span>
          ` : `
            <a href="#/settings" style="font-size:0.75rem;color:var(--color-text-light);text-decoration:underline">Connect Sheets</a>
          `}
        </div>

      </div>
    `;

    // Bind card taps
    container.querySelector('#total-card')?.addEventListener('click', () => saveContactsFilter(''));
    container.querySelector('#week-card')?.addEventListener('click', () => saveContactsFilter(''));
    container.querySelector('#occasions-card')?.addEventListener('click', () => saveContactsFilter(topOccasion));

    // Trend bar taps
    container.querySelectorAll('.trend-bar-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        container.querySelectorAll('.trend-bar-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        saveContactsFilter(btn.dataset.date || '');
      });
    });

    // Export buttons
    container.querySelector('#csv-btn')?.addEventListener('click', async () => {
      try {
        const count = await downloadContactsCSV();
        showToast(`Downloaded ${count} contacts as CSV`, 'success', false);
      } catch (err) {
        showToast(err.message || 'Export failed', 'error');
      }
    });

    container.querySelector('#vcf-btn')?.addEventListener('click', async () => {
      const { downloadContactsVCard } = await import('../js/export.js');
      try {
        const count = await downloadContactsVCard();
        showToast(`Downloaded ${count} contacts as .vcf`, 'success', false);
      } catch (err) {
        showToast(err.message || 'Export failed', 'error');
      }
    });
  } catch (error) {
    showToast(error.message || 'Failed to load dashboard.', 'error');
    container.innerHTML = '<h1>Dashboard</h1><div class="empty-state"><p>Unable to load stats.</p></div>';
  }
}
