const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildRenderPrompt, renderBuild } = require('./photo-render');

const catalogData = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
const { parts: catalog, vehicle } = catalogData;

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

(async () => {
  console.log('\n--- Photo Render Pipeline (Option 2) ---');

  await test('Prompt building includes visual part names and sub-categories', () => {
    const prompt = buildRenderPrompt(vehicle, ['widebody', 'gt_wing', 'wrap'], catalog);
    assert.ok(prompt.includes('Aggressive Widebody Kit'));
    assert.ok(prompt.includes('Adjustable GT Wing'));
    assert.ok(prompt.includes('Full Satin/Gloss Wrap'));
  });

  await test('Performance-only build (no visual parts) skips render, no wasted API call', () => {
    const prompt = buildRenderPrompt(vehicle, ['turbo_kit', 'fuel_system'], catalog);
    assert.strictEqual(prompt, null);
  });

  await test('renderBuild throws without a base photo', async () => {
    await assert.rejects(
      () => renderBuild({ vehicle, buildIds: ['wrap'], catalog, imageBase64: null }),
      /base photo is required/
    );
  });

  await test('renderBuild skips cleanly for performance-only builds', async () => {
    const result = await renderBuild({ vehicle, buildIds: ['coilovers'], catalog, imageBase64: 'fakebase64' });
    assert.strictEqual(result.skipped, true);
  });

  await test('renderBuild with mock provider returns simulated result + carries build validity', async () => {
    const result = await renderBuild({ vehicle, buildIds: ['widebody', 'wheels_18'], catalog, imageBase64: 'fakebase64' });
    assert.strictEqual(result.skipped, false);
    assert.strictEqual(result.provider, 'mock');
    assert.ok(result.warning.includes('simulated'));
    assert.strictEqual(result.buildValid, true);
  });

  await test('renderBuild surfaces build warnings (invalid build) alongside the render', async () => {
    // turbo_kit alone is missing 4 requirements — should still render the visual
    // parts if any are selected, but flag the build isn't fully valid
    const result = await renderBuild({ vehicle, buildIds: ['widebody', 'turbo_kit'], catalog, imageBase64: 'fakebase64' });
    assert.strictEqual(result.buildValid, false);
    assert.ok(result.buildWarnings.length > 0);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
