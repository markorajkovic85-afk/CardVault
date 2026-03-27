export function buildTopOccasions(rows = []) {
  const occasionCounts = {};
  rows.forEach((row) => {
    const key = (row.occasion || '').trim();
    if (!key) return;
    occasionCounts[key] = (occasionCounts[key] || 0) + 1;
  });
  return Object.entries(occasionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([occasion, count]) => ({ occasion, count }));
}

export function buildTrend30Days(rows = [], now = new Date()) {
  const trendStart = new Date(now);
  trendStart.setDate(now.getDate() - 29);
  const trendMap = new Map();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(trendStart);
    d.setDate(trendStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, 0);
  }

  rows.forEach((row) => {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    if (!trendMap.has(key)) return;
    trendMap.set(key, trendMap.get(key) + 1);
  });

  return Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));
}
