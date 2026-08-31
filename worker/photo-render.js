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

/**
 * Prompt builder for the text-to-image path (no uploaded photo). Unlike
 * buildRenderPrompt above — which describes an *edit* and returns null with
 * nothing to edit — this always returns a prompt, since a from-scratch
 * generation still needs to describe the whole car even when stock.
 */
export function buildTextToImagePrompt(vehicle, buildIds, catalog) {
  const parts = buildIds.map(id => catalog.find(p => p.id === id)).filter(Boolean);
  const visualParts = parts.filter(p => p.cat === 'Visual');
  const vehicleDesc = `${vehicle.make} ${vehicle.model} (${vehicle.generation || vehicle.modelYear})`;
  const modsClause = visualParts.length
    ? `fitted with these visual modifications: ${visualParts.map(p => `${p.name} (${p.sub})`).join(', ')}`
    : 'in stock, unmodified condition';

  return [
    `Photorealistic three-quarter front studio photo of a ${vehicleDesc}, ${modsClause}.`,
    `Clean neutral studio background, soft natural daylight, sharp focus, professional automotive photography, no text or watermarks.`,
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
 * Real provider — Cloudflare Workers AI, bound as `env.AI` (see wrangler.toml
 * [ai] block). Free allocation: 10,000 Neurons/day, shared across all
 * Workers AI models on the account, resetting daily at 00:00 UTC. No
 * separate API key or third-party account needed — it's a native Worker
 * binding, same as any other env resource.
 *
 * Uses stable-diffusion-v1-5-img2img: takes the uploaded base photo plus
 * the catalog-derived prompt and returns a transformed image. `strength`
 * controls how far the output can drift from the input photo (0 = identical
 * to input, 1 = ignores input entirely) — kept low-ish here so the render
 * stays recognizably the user's actual car rather than a generic reimagining.
 */
export async function workersAiProvider(prompt, imageBase64, env) {
  if (!env || !env.AI) {
    throw new Error('Workers AI binding (env.AI) is not available — add [ai]\\nbinding = "AI" to wrangler.toml and redeploy.');
  }

  const inputBytes = base64ToUint8Array(imageBase64);

  const output = await env.AI.run('@cf/runwayml/stable-diffusion-v1-5-img2img', {
    prompt,
    image: Array.from(inputBytes),
    strength: 0.55,
    num_steps: 20,
  });

  // Workers AI image models return a ReadableStream of raw image bytes.
  const buffer = await new Response(output).arrayBuffer();

  return {
    imageUrl: null,
    imageBase64: arrayBufferToBase64(buffer),
    provider: 'workers-ai',
  };
}

/**
 * Real provider — Cloudflare Workers AI text-to-image, bound as `env.AI`
 * (same binding as workersAiProvider above, no extra setup). Used when
 * there's no uploaded photo to edit — e.g. a build looked up by VIN — so
 * the car has to be generated from a description instead of transformed
 * from a base image.
 *
 * Uses flux-1-schnell (Black Forest Labs): fast text-to-image, 1–4 steps,
 * part of the same free Workers AI Neurons allocation as the img2img model
 * above. Unlike the img2img provider, the response comes back as
 * `{ image: base64String }` directly — no ReadableStream to buffer.
 */
export async function workersAiTextToImageProvider(prompt, env) {
  if (!env || !env.AI) {
    throw new Error('Workers AI binding (env.AI) is not available — add [ai]\\nbinding = "AI" to wrangler.toml and redeploy.');
  }

  const output = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
    prompt,
    steps: 6,
  });

  return {
    imageUrl: null,
    imageBase64: output.image,
    provider: 'workers-ai-flux',
  };
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Real provider shape for OpenAI, kept for reference in case a paid
 * higher-fidelity provider is wanted later. Requires a Worker secret
 * (wrangler secret put OPENAI_API_KEY) and is NOT active by default —
 * see index.js for how the provider is currently selected.
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

export async function renderBuild({ vehicle, buildIds, catalog, imageBase64, provider = mockProvider, env }) {
  if (!imageBase64) {
    throw new Error('A base photo is required for photo-based rendering.');
  }

  const analysis = analyzeBuild(buildIds, catalog);
  const prompt = buildRenderPrompt(vehicle, buildIds, catalog);

  if (!prompt) {
    return { skipped: true, reason: 'No visual parts selected — nothing to render.' };
  }

  const result = await provider(prompt, imageBase64, env);

  return {
    skipped: false,
    prompt,
    buildValid: analysis.isValid,
    buildWarnings: analysis.isValid ? [] : [...analysis.missing, ...analysis.conflicts],
    ...result,
  };
}

/**
 * Text-to-image counterpart to renderBuild — no imageBase64 required, since
 * the vehicle+build description alone is enough to generate a render. Used
 * by the /api/build/render-image route (VIN-only flow, no photo upload).
 */
export async function renderBuildFromText({ vehicle, buildIds, catalog, provider = mockProvider, env }) {
  const analysis = analyzeBuild(buildIds, catalog);
  const prompt = buildTextToImagePrompt(vehicle, buildIds, catalog);

  const result = await provider(prompt, env);

  return {
    skipped: false,
    prompt,
    buildValid: analysis.isValid,
    buildWarnings: analysis.isValid ? [] : [...analysis.missing, ...analysis.conflicts],
    ...result,
  };
}
