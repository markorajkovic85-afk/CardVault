import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAllowRoute, isPublicRoute } from '../src/js/auth-guard.js';

test('public routes are always allowed', () => {
  assert.equal(isPublicRoute('/login'), true);
  assert.equal(shouldAllowRoute('/login', false), true);
  assert.equal(shouldAllowRoute('/settings', false), true);
});

test('protected routes require session', () => {
  assert.equal(shouldAllowRoute('/contacts', false), false);
  assert.equal(shouldAllowRoute('/contacts', true), true);
});
