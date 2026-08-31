/**
 * Cloudflare Worker — API entry point
 * ------------------------------------
 * Deploy: wrangler deploy
 * Local dev: wrangler dev  (real Cloudflare simulation, not the Node mock
 *   used during development — see worker/test.js for the Node-side tests
 *   that validated this logic before deployment)
 *
 * Routes mirror server.js (the original Node prototype) exactly, so
 * anything tested against that API shape works unchanged here.
 */

import { catalogData } from './catalog.js';
import { validateCatalog, evaluateBuild, autoCompleteBuild } from './engine.js';
import { decodeVIN } from './vin-decode.js';
import { renderBuild } from './photo-render.js';

const { parts: catalog, vehicle: defaultVehicle } = catalogData;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // tighten to your Pages domain before going to production
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (pathname === '/api/health' && method === 'GET') {
      return json({ ok: true, catalogValid: validateCatalog(catalog).valid });
    }

    if (pathname === '/api/catalog' && method === 'GET') {
      return json(catalogData);
    }

    if (pathname === '/api/vin/decode' && method === 'POST') {
      const { vin } = await readJSON(request);
      if (!vin) return json({ error: 'vin is required' }, 400);
      try {
        const result = await decodeVIN(vin, { useLive: true });
        return json(result);
      } catch (err) {
        return json({ error: err.message }, 404);
      }
    }

    if (pathname === '/api/build/evaluate' && method === 'POST') {
      const { partIds, basePowerWhp } = await readJSON(request);
      if (!Array.isArray(partIds)) return json({ error: 'partIds must be an array' }, 400);
      const power = typeof basePowerWhp === 'number' ? basePowerWhp : defaultVehicle.basePowerWhp;
      return json(evaluateBuild(partIds, catalog, power));
    }

    if (pathname === '/api/build/autocomplete' && method === 'POST') {
      const { partIds } = await readJSON(request);
      if (!Array.isArray(partIds)) return json({ error: 'partIds must be an array' }, 400);
      const completed = autoCompleteBuild(partIds, catalog);
      return json({ partIds: completed, added: completed.filter(id => !partIds.includes(id)) });
    }

    if (pathname === '/api/build/render' && method === 'POST') {
      const { buildIds, imageBase64, vehicle } = await readJSON(request);
      if (!Array.isArray(buildIds)) return json({ error: 'buildIds must be an array' }, 400);
      try {
        const result = await renderBuild({
          vehicle: vehicle || defaultVehicle,
          buildIds,
          catalog,
          imageBase64,
        });
        return json(result);
      } catch (err) {
        return json({ error: err.message }, 400);
      }
    }

    return json({ error: `No route for ${method} ${pathname}` }, 404);
  },
};
