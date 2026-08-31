import assert from 'assert';
import worker from './index.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.stack || err.message}`); failed++; }
}

function req(path, { method = 'GET', body } = {}) {
  return new Request(`https://worker.local${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

(async () => {
  console.log('\n--- Cloudflare Worker (real Request/Response, no wrangler needed to verify logic) ---\n');

  await test('OPTIONS request returns CORS headers, no body required', async () => {
    const res = await worker.fetch(req('/api/health', { method: 'OPTIONS' }));
    assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), '*');
  });

  await test('GET /api/health reports catalog valid', async () => {
    const res = await worker.fetch(req('/api/health'));
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.catalogValid, true);
  });

  await test('GET /api/catalog returns full part list with CORS header', async () => {
    const res = await worker.fetch(req('/api/catalog'));
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(body.parts.length > 0);
    assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), '*');
  });

  await test('POST /api/vin/decode with known fixture VIN (live NHTSA unreachable, falls back)', async () => {
    const res = await worker.fetch(req('/api/vin/decode', { method: 'POST', body: { vin: '3MZBPACL5KM123456' } }));
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.make, 'Mazda');
    assert.strictEqual(body.region, 'North America (USA)');
  });

  await test('POST /api/vin/decode Japan-built fixture resolves region correctly', async () => {
    const res = await worker.fetch(req('/api/vin/decode', { method: 'POST', body: { vin: 'JM1BPACL5K1123456' } }));
    const body = await res.json();
    assert.strictEqual(body.region, 'Japan');
  });

  await test('POST /api/vin/decode missing vin returns 400', async () => {
    const res = await worker.fetch(req('/api/vin/decode', { method: 'POST', body: {} }));
    assert.strictEqual(res.status, 400);
  });

  await test('POST /api/build/evaluate returns isValid + estimate', async () => {
    const res = await worker.fetch(req('/api/build/evaluate', { method: 'POST', body: { partIds: ['coilovers', 'sway_bars'] } }));
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.isValid, true);
    assert.ok(body.estimate.cost.min > 0);
  });

  await test('POST /api/build/evaluate flags missing requirements for turbo kit alone', async () => {
    const res = await worker.fetch(req('/api/build/evaluate', { method: 'POST', body: { partIds: ['turbo_kit'] } }));
    const body = await res.json();
    assert.strictEqual(body.isValid, false);
    assert.strictEqual(body.missing.length, 4);
  });

  await test('POST /api/build/autocomplete adds missing requirements', async () => {
    const res = await worker.fetch(req('/api/build/autocomplete', { method: 'POST', body: { partIds: ['bucket_seats'] } }));
    const body = await res.json();
    assert.ok(body.added.includes('half_cage'));
  });

  await test('POST /api/build/render skips cleanly for performance-only build', async () => {
    const res = await worker.fetch(req('/api/build/render', { method: 'POST', body: { buildIds: ['coilovers'], imageBase64: 'fake' } }));
    const body = await res.json();
    assert.strictEqual(body.skipped, true);
  });

  await test('POST /api/build/render requires imageBase64', async () => {
    const res = await worker.fetch(req('/api/build/render', { method: 'POST', body: { buildIds: ['wrap'] } }));
    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.ok(body.error.includes('base photo'));
  });

  await test('POST /api/build/render returns mock render for a visual build', async () => {
    const res = await worker.fetch(req('/api/build/render', { method: 'POST', body: { buildIds: ['widebody', 'wrap'], imageBase64: 'fake' } }));
    const body = await res.json();
    assert.strictEqual(body.skipped, false);
    assert.strictEqual(body.provider, 'mock');
  });

  await test('Unknown route returns 404', async () => {
    const res = await worker.fetch(req('/api/nonexistent'));
    assert.strictEqual(res.status, 404);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed > 0 ? 1 : 0;
})();
