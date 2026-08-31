const http = require('http');
const fs = require('fs');
const path = require('path');
const { decodeVIN, getRegionFromVIN } = require('./vin-decode');
const engine = require('./engine');

const catalogData = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
const { parts: catalog, vehicle: defaultVehicle } = catalogData;

function sendJSON(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
  });
}

const routes = {
  'GET /api/catalog': async () => ({ status: 200, body: catalogData }),

  'GET /api/health': async () => ({ status: 200, body: { ok: true, catalogValid: engine.validateCatalog(catalog).valid } }),

  'POST /api/vin/decode': async (req) => {
    const { vin } = await readBody(req);
    if (!vin) return { status: 400, body: { error: 'vin is required' } };
    try {
      const result = await decodeVIN(vin, { useLive: true });
      return { status: 200, body: result };
    } catch (err) {
      return { status: 404, body: { error: err.message } };
    }
  },

  'POST /api/build/evaluate': async (req) => {
    const { partIds, basePowerWhp } = await readBody(req);
    if (!Array.isArray(partIds)) return { status: 400, body: { error: 'partIds must be an array' } };
    const power = typeof basePowerWhp === 'number' ? basePowerWhp : defaultVehicle.basePowerWhp;
    const result = engine.evaluateBuild(partIds, catalog, power);
    return { status: 200, body: result };
  },

  'POST /api/build/autocomplete': async (req) => {
    const { partIds } = await readBody(req);
    if (!Array.isArray(partIds)) return { status: 400, body: { error: 'partIds must be an array' } };
    const completed = engine.autoCompleteBuild(partIds, catalog);
    return { status: 200, body: { partIds: completed, added: completed.filter(id => !partIds.includes(id)) } };
  },
};

const server = http.createServer(async (req, res) => {
  const key = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[key];
  if (!handler) return sendJSON(res, 404, { error: `No route for ${key}` });
  try {
    const { status, body } = await handler(req);
    sendJSON(res, status, body);
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`Build platform API listening on :${PORT}`));
}

module.exports = { server, routes };
