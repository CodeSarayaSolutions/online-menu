const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isSameOrigin } = require('../../.local/unit/lib/request-origin');
test('HTTPS public origin works behind an HTTP proxy without trusting forwarded headers', () => {
  const make = origin => ({ url: 'http://localhost:3017/api/auth/login', headers: new Headers({ origin, host: 'attacker.invalid', 'x-forwarded-host': 'attacker.invalid' }) });
  assert.equal(isSameOrigin(make('https://menu.saraya.solutions'), 'https://menu.saraya.solutions'), true);
  assert.equal(isSameOrigin(make('https://attacker.invalid'), 'https://menu.saraya.solutions'), false);
  assert.equal(isSameOrigin(make('null'), 'https://menu.saraya.solutions'), false);
  assert.equal(isSameOrigin(make('http://localhost:3017')), true);
  assert.equal(isSameOrigin(make('https://menu.saraya.solutions'), 'malformed'), false);
});
