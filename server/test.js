const assert = require('assert');
const fs = require('fs');
const path = require('path');
const engine = require('./engine');
const { decodeVIN, getRegionFromVIN } = require('./vin-decode');
const { routes } = require('./server');

const catalogData = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
const { parts: catalog, vehicle } = catalogData;

let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    failed++;
  }
}

// fake req/res helpers for testing route handlers directly without a real socket
function fakeReq(bodyObj) {
  const chunks = [Buffer.from(JSON.stringify(bodyObj || {}))];
  let i = 0;
  return {
    on(event, cb) {
      if (event === 'data') chunks.forEach(c => cb(c));
      if (event === 'end') cb();
      return this;
    },
  };
}

(async () => {
  console.log('\n--- WMI Region Detection ---');
  await test('US VIN (1) resolves to North America (USA)', () => {
    assert.strictEqual(getRegionFromVIN('1HGCM82633A123456').region, 'North America (USA)');
  });
  await test('Japan VIN (J) resolves to Japan', () => {
    assert.strictEqual(getRegionFromVIN('JM1BPACL5K1123456').region, 'Japan');
  });
  await test('Germany VIN (W) resolves to Germany', () => {
    assert.strictEqual(getRegionFromVIN('WBA3A5C50CF123456').region, 'Germany');
  });
  await test('Korea VIN (K) resolves to Korea', () => {
    assert.strictEqual(getRegionFromVIN('KMHD35LE5EU123456').region, 'Korea');
  });
  await test('Region result includes the confirm-with-user caveat', () => {
    const r = getRegionFromVIN('1HGCM82633A123456');
    assert.ok(r.note.includes('confirm market'));
  });

  console.log('\n--- VIN Decode (fixture fallback, live NHTSA unreachable in this sandbox) ---');
  await test('Known fixture VIN decodes to Mazda 3', async () => {
    const result = await decodeVIN('3MZBPACL5KM123456');
    assert.strictEqual(result.make, 'Mazda');
    assert.strictEqual(result.model, '3');
    assert.strictEqual(result.region, 'North America (USA)');
  });
  await test('Japan-built Mazda 3 fixture resolves region to Japan despite same model', async () => {
    const result = await decodeVIN('JM1BPACL5K1123456');
    assert.strictEqual(result.plantCountry, 'Japan');
    assert.strictEqual(result.region, 'Japan');
  });
  await test('Unknown VIN throws a clear error', async () => {
    await assert.rejects(() => decodeVIN('UNKNOWNVIN000000X'), /VIN decode failed/);
  });

  console.log('\n--- Catalog Integrity ---');
  await test('Catalog validates with no errors', () => {
    const v = engine.validateCatalog(catalog);
    assert.strictEqual(v.valid, true, v.errors.join('; '));
  });
  await test('Every part has a fitment note (no silent unknowns)', () => {
    catalog.forEach(p => assert.ok(p.note && p.note.length > 5, `${p.id} missing note`));
  });

  console.log('\n--- Dependency Engine ---');
  await test('Turbo kit alone reports 4 missing requirements', () => {
    const r = engine.analyzeBuild(['turbo_kit'], catalog);
    assert.strictEqual(r.missing.length, 4);
    assert.strictEqual(r.isValid, false);
  });
  await test('Auto-completed turbo build is valid', () => {
    const completed = engine.autoCompleteBuild(['turbo_kit'], catalog);
    const r = engine.analyzeBuild(completed, catalog);
    assert.strictEqual(r.isValid, true);
  });
  await test('GT wing + duckbill produces a conflict', () => {
    const r = engine.analyzeBuild(['gt_wing', 'duckbill'], catalog);
    assert.strictEqual(r.conflicts.length, 1);
  });
  await test('Bucket seats without half cage flags missing requirement', () => {
    const r = engine.analyzeBuild(['bucket_seats'], catalog);
    assert.strictEqual(r.missing.length, 1);
    assert.strictEqual(r.missing[0].needsId, 'half_cage');
  });
  await test('Empty build is trivially valid', () => {
    const r = engine.analyzeBuild([], catalog);
    assert.strictEqual(r.isValid, true);
  });
  await test('Circular dependency is detected on an adversarial catalog', () => {
    const broken = JSON.parse(JSON.stringify(catalog));
    broken.find(p => p.id === 'fuel_system').requires.push('ecu_tune');
    broken.find(p => p.id === 'ecu_tune').requires.push('fuel_system');
    const v = engine.validateCatalog(broken);
    assert.strictEqual(v.valid, false);
    assert.ok(v.errors.some(e => e.includes('Circular dependency')));
  });
  await test('Asymmetric conflict is detected on an adversarial catalog', () => {
    const broken = JSON.parse(JSON.stringify(catalog));
    broken.find(p => p.id === 'nitrous').conflicts.push('coilovers');
    const v = engine.validateCatalog(broken);
    assert.strictEqual(v.valid, false);
    assert.ok(v.errors.some(e => e.includes('Asymmetric conflict')));
  });

  console.log('\n--- Estimation ---');
  await test('Full turbo package power estimate lands within the original spec range (350-420 whp)', () => {
    const completed = engine.autoCompleteBuild(['turbo_kit'], catalog);
    const est = engine.estimateBuild(completed, catalog, vehicle.basePowerWhp);
    assert.ok(est.totalPower.min >= 300 && est.totalPower.max <= 450,
      `got ${est.totalPower.min}-${est.totalPower.max}`);
  });
  await test('Confidence label degrades to low when only low-confidence parts selected', () => {
    const est = engine.estimateBuild(['nitrous'], catalog, vehicle.basePowerWhp);
    assert.strictEqual(est.confidence.label, 'low');
  });

  console.log('\n--- Server Route Handlers (in-process, no real socket) ---');
  await test('GET /api/health reports catalog valid', async () => {
    const { status, body } = await routes['GET /api/health']();
    assert.strictEqual(status, 200);
    assert.strictEqual(body.catalogValid, true);
  });
  await test('GET /api/catalog returns full part list', async () => {
    const { status, body } = await routes['GET /api/catalog']();
    assert.strictEqual(status, 200);
    assert.strictEqual(body.parts.length, catalog.length);
  });
  await test('POST /api/vin/decode with known fixture VIN', async () => {
    const req = fakeReq({ vin: '3MZBPACL5KM123456' });
    const { status, body } = await routes['POST /api/vin/decode'](req);
    assert.strictEqual(status, 200);
    assert.strictEqual(body.make, 'Mazda');
  });
  await test('POST /api/vin/decode with missing vin returns 400', async () => {
    const req = fakeReq({});
    const { status } = await routes['POST /api/vin/decode'](req);
    assert.strictEqual(status, 400);
  });
  await test('POST /api/build/evaluate returns isValid + estimate', async () => {
    const req = fakeReq({ partIds: ['coilovers', 'sway_bars'] });
    const { status, body } = await routes['POST /api/build/evaluate'](req);
    assert.strictEqual(status, 200);
    assert.strictEqual(body.isValid, true);
    assert.ok(body.estimate.cost.min > 0);
  });
  await test('POST /api/build/autocomplete adds missing requirements', async () => {
    const req = fakeReq({ partIds: ['bucket_seats'] });
    const { status, body } = await routes['POST /api/build/autocomplete'](req);
    assert.strictEqual(status, 200);
    assert.ok(body.added.includes('half_cage'));
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
