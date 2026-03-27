import { getDashboardStats } from '../js/supabase-api.js';
import { showToast } from '../components/toast.js';

function renderTrendBars(points) {
  if (!points.length) return '<p class="text-sm text-light">No data yet.</p>';
  const max = Math.max(...points.map((p) => p.count), 1);
  return `
    <div class="trend-chart">
      ${points.map((p) => `
        <div class="trend-col" title="${p.date}: ${p.count}">
          <div class="trend-bar" style="height:${Math.max(6, (p.count / max) * 100)}%"></div>
        </div>
      `).join('')}
    </div>
  `;
}

export async function render(container) {
  container.innerHTML = '<h1>Dashboard</h1><div class="card"><p>Loading stats…</p></div>';

  try {
    const stats = await getDashboardStats();

    container.innerHTML = `
      <h1>Dashboard</h1>

      <div class="stats-grid mb-16">
        <div class="card"><h3>Total Contacts</h3><p class="stat-value">${stats.totalContacts}</p></div>
        <div class="card"><h3>This Week</h3><p class="stat-value">${stats.contactsThisWeek}</p></div>
        <div class="card"><h3>This Month</h3><p class="stat-value">${stats.contactsThisMonth}</p></div>
        <div class="card"><h3>Distinct Companies</h3><p class="stat-value">${stats.distinctCompanies}</p></div>
      </div>

      <div class="card mb-16">
        <h3>Top Occasions</h3>
        ${stats.topOccasions.length === 0 ? '<p class="text-sm text-light">No occasions yet.</p>' : `
          <ul class="stats-list">
            ${stats.topOccasions.map((item) => `<li><span>${item.occasion}</span><strong>${item.count}</strong></li>`).join('')}
          </ul>
        `}
      </div>

      <div class="card">
        <h3>30-Day Added Contacts Trend</h3>
        ${renderTrendBars(stats.trend30Days)}
      </div>
    `;
  } catch (error) {
    showToast(error.message || 'Failed to load dashboard.', 'error');
    container.innerHTML = '<h1>Dashboard</h1><div class="empty-state"><p>Unable to load stats.</p></div>';
  }
}
