import { getDashboardStats } from '../js/supabase-api.js';
import { showToast } from '../components/toast.js';

function renderTrendBars(points) {
  if (!points.length) return '<p class="text-sm text-light">No data yet.</p>';
  const max = Math.max(...points.map((p) => p.count), 1);
  return `
    <div class="trend-chart">
      ${points.map((p) => `
        <div class="trend-col" title="${p.date}: ${p.count}">
          <button class="trend-bar-btn" data-date="${p.date}" data-count="${p.count}" aria-label="${p.date}: ${p.count} contacts">
            <div class="trend-bar" style="height:${Math.max(6, (p.count / max) * 100)}%"></div>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function saveContactsFilter(filter) {
  localStorage.setItem('cardvault.contactsFilter', filter);
  location.hash = '#/contacts';
}

export async function render(container) {
  container.innerHTML = '<h1>Dashboard</h1><div class="card"><p>Loading stats…</p></div>';

  try {
    const stats = await getDashboardStats();
    const thisWeek = stats.contactsThisWeek || 0;
    const lastWeek = Math.max(stats.contactsThisMonth - thisWeek, 0);
    const weekDelta = thisWeek - lastWeek;
    const weekState = weekDelta > 0 ? 'positive' : weekDelta < 0 ? 'neutral' : 'flat';
    const topOccasion = stats.topOccasions[0]?.occasion || '';

    container.innerHTML = `
      <h1>Dashboard</h1>

      <div class="dashboard-bento mb-16">
        <button class="card bento-card bento-total" id="total-contacts-card">
          <h3>Total Contacts</h3>
          <p class="stat-value">${stats.totalContacts}</p>
          <p class="text-sm text-light">+${stats.contactsThisMonth} this month</p>
          <span class="bento-cta">Open all contacts</span>
        </button>
        <button class="card bento-card bento-week ${weekState}" id="week-vs-last-card">
          <h3>This week vs last</h3>
          <div class="week-pill-group">
            <span class="week-pill">This: ${thisWeek}</span>
            <span class="week-pill">Last: ${lastWeek}</span>
          </div>
          <p class="text-sm ${weekDelta > 0 ? 'trend-positive' : 'text-light'}">${weekDelta > 0 ? `+${weekDelta}` : weekDelta} vs last week</p>
          <span class="bento-cta">View this week’s contacts</span>
        </button>
        <button class="card bento-card" id="top-occasions-card">
          <h3>Top occasions</h3>
          ${stats.topOccasions.length === 0 ? '<p class="text-sm text-light">No occasions yet.</p>' : `
            <ul class="stats-list">
              ${stats.topOccasions.slice(0, 3).map((item) => `<li><span>${item.occasion}</span><strong>${item.count}</strong></li>`).join('')}
            </ul>
          `}
          <span class="bento-cta">View contacts from top event</span>
        </button>
        <div class="card bento-card" id="trend-card">
          <h3>30-day trend</h3>
          ${renderTrendBars(stats.trend30Days)}
          <p class="text-sm text-light mt-8">Each bar is one day; tap to open contacts added that day.</p>
          <span class="bento-cta">Open latest day in contacts</span>
        </div>
      </div>
    `;

    container.querySelector('#total-contacts-card')?.addEventListener('click', () => saveContactsFilter(''));
    container.querySelector('#week-vs-last-card')?.addEventListener('click', () => saveContactsFilter(''));
    container.querySelector('#top-occasions-card')?.addEventListener('click', () => saveContactsFilter(topOccasion));

    container.querySelectorAll('.trend-bar-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        container.querySelectorAll('.trend-bar-btn').forEach((other) => other.classList.remove('active'));
        btn.classList.add('active');
        const date = btn.dataset.date || '';
        saveContactsFilter(date);
      });
    });

    container.querySelector('#trend-card')?.addEventListener('click', () => {
      const latestDate = stats.trend30Days[stats.trend30Days.length - 1]?.date || '';
      saveContactsFilter(latestDate);
    });
  } catch (error) {
    showToast(error.message || 'Failed to load dashboard.', 'error');
    container.innerHTML = '<h1>Dashboard</h1><div class="empty-state"><p>Unable to load stats.</p></div>';
  }
}
