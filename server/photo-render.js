/**
 * AI Photo-Render Module (Option 2)
 * -----------------------------------
 * Takes a user's uploaded car photo + a set of selected build parts, and
 * produces a photorealistic mockup showing those parts applied.
 *
 * IMPORTANT — sandbox limitation: this environment has no image-generation
 * API access (network allowlist covers package registries only, not
 * OpenAI/Stability/etc.), so the live path CANNOT be executed or tested
 * here. What's real and tested: prompt construction from the build,
 * provider interface, error handling, and the mock provider path (which
 * simulates a provider's response shape without a live call). Swap in a
 * real provider function and this module works unchanged.
 *
 * Providers this is designed to plug into: OpenAI images/edit endpoint,
 * Stability AI image-to-image, or a vendor API like Visualizee's white-label
 * "VizTunr" product (identified in prior research as a partner candidate).
 */

const engine = require('./engine');

/**
 * Builds a text prompt describing the selected mods, grounded in the
 * catalog's own fitment notes so the prompt doesn't hallucinate details
 * the data doesn't support.
 */
function buildRenderPrompt(vehicle, buildIds, catalog) {
  const parts = buildIds
    .map(id => catalog.find(p => p.id === id))
    .filter(Boolean);

  const visualParts = parts.filter(p => p.cat === 'Visual');
  if (visualParts.length === 0) {
    return null; // nothing visual selected — no render needed
  }

  const descriptions = visualParts.map(p => `${p.name} (${p.sub})`).join(', ');
  return [
    `Photorealistic edit of the uploaded ${vehicle.make} ${vehicle.model} (${vehicle.generation || vehicle.modelYear}).`,
    `Apply these modifications, keeping the vehicle's pose, lighting, and background unchanged: ${descriptions}.`,
    `Preserve exact body proportions except where the modification itself changes them (e.g. widebody kit widens the fenders).`,
  ].join(' ');
}

/**
 * Mock provider — returns a deterministic fake response shaped like a real
 * image-gen API would, so the rest of the pipeline (prompt building, error
 * handling, caller code) can be tested without network access.
 */
async function mockProvider(prompt, imageBase64) {
  await new Promise(r => setTimeout(r, 50)); // simulate latency
  return {
    imageUrl: null,
    imageBase64: '[mock-render-output-would-be-base64-here]',
    provider: 'mock',
    prompt,
    warning: 'This is a simulated response — no real image was generated. Swap in a real provider for actual output.',
  };
}

/**
 * Example of what a real provider adapter looks like (NOT executable here —
 * requires network access + API key). Left commented and structured so
 * wiring in a real key is a small, obvious change.
 */
/*
async function openAiProvider(prompt, imageBase64) {
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: buildMultipartForm({ image: imageBase64, prompt }),
  });
  if (!res.ok) throw new Error(`Image provider error: ${res.status}`);
  const json = await res.json();
  return { imageUrl: json.data[0].url, provider: 'openai' };
}
*/

/**
 * Main entry point. Validates the build first (reuses the dependency
 * engine — no point rendering a build with unmet requirements/conflicts),
 * builds the prompt, and calls the given provider.
 */
async function renderBuild({ vehicle, buildIds, catalog, imageBase64, provider = mockProvider }) {
  if (!imageBase64) {
    throw new Error('A base photo is required for photo-based rendering.');
  }

  const analysis = engine.analyzeBuild(buildIds, catalog);
  const prompt = buildRenderPrompt(vehicle, buildIds, catalog);

  if (!prompt) {
    return { skipped: true, reason: 'No visual parts selected — nothing to render.' };
  }

  const result = await provider(prompt, imageBase64);

  return {
    skipped: false,
    prompt,
    buildValid: analysis.isValid,
    buildWarnings: analysis.isValid ? [] : [...analysis.missing, ...analysis.conflicts],
    ...result,
  };
}

module.exports = { buildRenderPrompt, renderBuild, mockProvider };
