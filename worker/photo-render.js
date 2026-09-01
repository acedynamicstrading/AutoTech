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
 * Real provider — Cloudflare Workers AI, FLUX.2, bound as `env.AI` (see
 * wrangler.toml [ai] block). FLUX.2 is a true image-EDIT model with native
 * multi-reference support — built for "here's a photo, apply this specific
 * change," which fits this use case better than SD 1.5's older img2img
 * (which tends to drift the car's identity/proportions since it isn't
 * edit-aware, just a noised-and-redenoised transform).
 *
 * Cost note: FLUX.2 consumes meaningfully more of the free 10,000
 * Neurons/day budget per image than SD 1.5 — realistically single-digit
 * free renders/day rather than dozens (Cloudflare's own pricing page lists
 * ~1,364 Neurons for just the first megapixel on the 9B variant). Fine for
 * on-demand renders (triggered once per finished build), not for
 * live-preview-on-every-click.
 *
 * IMPORTANT — input images must be ≤512x512. Resize on the CLIENT before
 * upload (see public/index.html's renderBuildPhoto()) — Workers has no
 * canvas/image-resize API built in, so this is not something the Worker
 * itself can correct if an oversized photo arrives.
 *
 * Workers AI's FLUX.2 binding currently requires a multipart-form
 * workaround rather than a plain JS object (per Cloudflare's own docs) —
 * building a real Request just to get a correctly-encoded multipart body
 * + boundary, then handing that stream to env.AI.run().
 */
export async function flux2Provider(prompt, imageBase64, env, opts = {}) {
  if (!env || !env.AI) {
    throw new Error('Workers AI binding (env.AI) is not available — add [ai]\\nbinding = "AI" to wrangler.toml and redeploy.');
  }

  const model = opts.model || '@cf/black-forest-labs/flux-2-klein-4b';
  const imageBytes = base64ToUint8Array(imageBase64);
  const imageBlob = new Blob([imageBytes], { type: 'image/jpeg' });

  const form = new FormData();
  form.append('prompt', prompt);
  form.append('input_image_0', imageBlob, 'car.jpg');
  form.append('width', '1024');
  form.append('height', '1024');

  const formRequest = new Request('http://dummy', { method: 'POST', body: form });
  const formStream = formRequest.body;
  const formContentType = formRequest.headers.get('content-type') || 'multipart/form-data';

  const output = await env.AI.run(model, {
    multipart: { body: formStream, contentType: formContentType },
  });

  const buffer = await new Response(output).arrayBuffer();

  return {
    imageUrl: null,
    imageBase64: arrayBufferToBase64(buffer),
    provider: 'flux-2',
    model,
  };
}

/**
 * Real provider — Cloudflare Workers AI, Stable Diffusion 1.5 img2img.
 * Kept available as a fallback/comparison option (pass provider:
 * workersAiProvider explicitly) — cheaper per render than FLUX.2, but
 * lower fidelity for precise part-level edits. See flux2Provider above
 * for the current default real provider.
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
