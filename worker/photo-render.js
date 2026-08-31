/**
 * AI Photo-Render Module (Worker/ESM version) — Option 2
 * Same design as the Node version: prompt built strictly from catalog
 * fitment notes, pluggable provider, mock provider included since no real
 * image-gen vendor is wired yet. See README for wiring a real provider —
 * on Workers this would call out via fetch() same as vin-decode.js does.
 */

import { analyzeBuild } from './engine.js';

export function buildRenderPrompt(vehicle, buildIds, catalog) {
  const parts = buildIds.map(id => catalog.find(p => p.id === id)).filter(Boolean);
  const visualParts = parts.filter(p => p.cat === 'Visual');
  if (visualParts.length === 0) return null;

  const descriptions = visualParts.map(p => `${p.name} (${p.sub})`).join(', ');
  return [
    `Photorealistic edit of the uploaded ${vehicle.make} ${vehicle.model} (${vehicle.generation || vehicle.modelYear}).`,
    `Apply these modifications, keeping the vehicle's pose, lighting, and background unchanged: ${descriptions}.`,
    `Preserve exact body proportions except where the modification itself changes them (e.g. widebody kit widens the fenders).`,
  ].join(' ');
}

export async function mockProvider(prompt) {
  await new Promise(r => setTimeout(r, 10));
  return {
    imageUrl: null,
    imageBase64: '[mock-render-output-would-be-base64-here]',
    provider: 'mock',
    prompt,
    warning: 'This is a simulated response — no real image was generated. Wire a real provider (see README) for actual output.',
  };
}

/**
 * Real provider shape, for reference — requires an API key bound as a
 * Worker secret (wrangler secret put OPENAI_API_KEY) and is NOT active
 * until you swap it in for mockProvider below.
 */
// async function openAiProvider(prompt, imageBase64, env) {
//   const res = await fetch('https://api.openai.com/v1/images/edits', {
//     method: 'POST',
//     headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
//     body: buildMultipartForm({ image: imageBase64, prompt }),
//   });
//   if (!res.ok) throw new Error(`Image provider error: ${res.status}`);
//   const json = await res.json();
//   return { imageUrl: json.data[0].url, provider: 'openai' };
// }

export async function renderBuild({ vehicle, buildIds, catalog, imageBase64, provider = mockProvider }) {
  if (!imageBase64) {
    throw new Error('A base photo is required for photo-based rendering.');
  }

  const analysis = analyzeBuild(buildIds, catalog);
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
