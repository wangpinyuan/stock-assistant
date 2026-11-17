import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { webOrigins, apiHost } from '../src/infrastructure/config';

test('app returns validation errors as 400 and limits browser origins', async () => {
  const app = await buildApp();
  try {
    assert.equal(apiHost, '127.0.0.1');
    const invalid = await app.inject({ method: 'POST', url: '/holdings', payload: { code: 'bad' } });
    assert.equal(invalid.statusCode, 400);
    const invalidDate = await app.inject({ method: 'POST', url: '/holdings', payload: { code: '000001', quantity: 1, averageCost: 1, buyDate: 'invalid' } });
    assert.equal(invalidDate.statusCode, 400);
    const invalidLimit = await app.inject({ method: 'GET', url: '/news?limit=-1' });
    assert.equal(invalidLimit.statusCode, 400);
    const trusted = await app.inject({ method: 'GET', url: '/health', headers: { origin: webOrigins[0] } });
    assert.equal(trusted.statusCode, 200);
    const untrusted = await app.inject({ method: 'GET', url: '/settings', headers: { origin: 'https://untrusted.example' } });
    assert.equal(untrusted.statusCode, 403);
    assert.equal(untrusted.headers['access-control-allow-origin'], undefined);
    const missing = await app.inject({ method: 'GET', url: '/unknown' });
    assert.equal(missing.statusCode, 404);
    for (const url of ['/ai/reports', '/portfolio/snapshots']) {
      assert.equal((await app.inject({ method: 'GET', url })).statusCode, 501);
    }
    assert.equal((await app.inject({ method: 'POST', url: '/ai/analyze/portfolio' })).statusCode, 501);
  } finally { await app.close(); }
});
