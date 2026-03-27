import test from 'node:test';
import assert from 'node:assert/strict';
import { toScopedContactPayload } from '../src/js/contact-scope.js';
import { buildTopCompanies, buildTopOccasions, buildTrend30Days } from '../src/js/dashboard-utils.js';

test('toScopedContactPayload always scopes to user_id', () => {
  const payload = toScopedContactPayload({ id: 'abc', name: 'Taylor', user_id: 'ignored' }, 'user-123');
  assert.equal(payload.user_id, 'user-123');
  assert.equal(payload.id, 'abc');
});

test('buildTopOccasions returns top 5 sorted', () => {
  const top = buildTopOccasions([
    { occasion: 'Expo' }, { occasion: 'Expo' }, { occasion: 'Meetup' }, { occasion: 'Coffee' }
  ]);
  assert.equal(top[0].occasion, 'Expo');
  assert.equal(top[0].count, 2);
  assert.ok(top.length <= 5);
});


test('buildTopCompanies returns top 5 sorted', () => {
  const top = buildTopCompanies([
    { company: 'Acme' }, { company: 'Acme' }, { company: 'Beta' }, { company: 'Gamma' }
  ]);
  assert.equal(top[0].company, 'Acme');
  assert.equal(top[0].count, 2);
  assert.ok(top.length <= 5);
});

test('buildTrend30Days builds fixed 30-day window', () => {
  const now = new Date('2026-03-27T00:00:00.000Z');
  const trend = buildTrend30Days([{ created_at: '2026-03-27T11:00:00.000Z' }], now);
  assert.equal(trend.length, 30);
  assert.equal(trend[29].date, '2026-03-27');
  assert.equal(trend[29].count, 1);
});
