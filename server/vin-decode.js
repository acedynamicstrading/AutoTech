/**
 * VIN Decode & Region Detection
 * -----------------------------------
 * Two responsibilities:
 *  1. decodeVIN() — resolve a VIN to make/model/year/engine via NHTSA's free
 *     vPIC API (US govt, no key required), with a local fixture fallback for
 *     offline/sandboxed environments.
 *  2. getRegionFromVIN() — determine the vehicle's country/region of origin
 *     from the WMI (World Manufacturer Identifier — the first 1-3 characters
 *     of any VIN, standardized under ISO 3779). This is the real mechanism
 *     behind "VIN tells you the region" — and per the earlier research, it's
 *     the START of identity resolution, not the end: the system should still
 *     ask the user to confirm market/trim/options, since WMI gives country
 *     of manufacture, not necessarily country of original sale or spec.
 */

const NHTSA_ENDPOINT = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json';

// WMI first-character -> region. Real ISO 3779 ranges (simplified to the
// ranges relevant to this project's platforms: US/Canada/Mexico, Japan,
// Germany/Europe, UK, Korea, China).
const WMI_REGION_TABLE = [
  { range: ['1', '5'], region: 'North America (USA)' },
  { range: ['2', '2'], region: 'North America (Canada)' },
  { range: ['3', '3'], region: 'North America (Mexico)' },
  { range: ['4', '4'], region: 'North America (USA)' },
  { range: ['J', 'J'], region: 'Japan' },
  { range: ['K', 'K'], region: 'Korea' },
  { range: ['L', 'L'], region: 'China' },
  { range: ['S', 'S'], region: 'United Kingdom' },
  { range: ['V', 'V'], region: 'France/Spain' },
  { range: ['W', 'W'], region: 'Germany' },
  { range: ['Y', 'Y'], region: 'Sweden/Finland' },
  { range: ['Z', 'Z'], region: 'Italy' },
  { range: ['6', '6'], region: 'Australia' },
];

function getRegionFromVIN(vin) {
  if (!vin || vin.length < 1) return { region: 'unknown', wmiChar: null };
  const wmiChar = vin[0].toUpperCase();
  const match = WMI_REGION_TABLE.find(r => wmiChar >= r.range[0] && wmiChar <= r.range[1]);
  return {
    region: match ? match.region : 'unknown',
    wmiChar,
    note: 'WMI indicates country of manufacture, not necessarily original sale market or factory spec — confirm market/trim/options with the user before assuming full fitment identity.',
  };
}

// Local fixtures used only when live NHTSA call is unavailable (e.g. this
// sandbox's network allowlist doesn't include vpic.nhtsa.dot.gov). In a real
// deployment this table is dead code — decodeVIN() calls the live API.
const MOCK_VIN_DB = {
  '3MZBPACL5KM123456': {
    make: 'Mazda', model: '3', modelYear: '2019', bodyClass: 'Hatchback',
    engine: '2.0L I4 Skyactiv-G', driveType: 'FWD', plantCountry: 'Mexico', source: 'local-fixture',
  },
  'JM1BPACL5K1123456': {
    make: 'Mazda', model: '3', modelYear: '2019', bodyClass: 'Hatchback',
    engine: '2.0L I4 Skyactiv-G', driveType: 'FWD', plantCountry: 'Japan', source: 'local-fixture',
  },
  'JF1VA1J60M9800000': {
    make: 'Subaru', model: 'WRX STI', modelYear: '2021', bodyClass: 'Sedan',
    engine: '2.5L H4 Turbo', driveType: 'AWD', plantCountry: 'Japan', source: 'local-fixture',
  },
};

/**
 * Resolves a VIN to vehicle identity. Tries the live NHTSA vPIC API first
 * (free, no key, US-market-strongest coverage); falls back to local fixtures
 * if the live call fails or is disabled. Always attaches WMI-based region
 * detection regardless of source.
 */
async function decodeVIN(vin, { useLive = true } = {}) {
  let result = null;

  if (useLive && typeof fetch === 'function') {
    try {
      const res = await fetch(NHTSA_ENDPOINT.replace('{vin}', encodeURIComponent(vin)));
      if (!res.ok) throw new Error(`NHTSA API responded ${res.status}`);
      const json = await res.json();
      result = normalizeNhtsaResponse(json, vin);
    } catch (err) {
      // Expected in network-restricted environments (this sandbox included) —
      // fall through to local fixtures rather than failing the whole request.
      result = null;
    }
  }

  if (!result) {
    const fixture = MOCK_VIN_DB[vin];
    if (!fixture) {
      throw new Error(`VIN decode failed: no live API result and no local fixture for ${vin}`);
    }
    result = { ...fixture, vin };
  }

  return {
    ...result,
    ...getRegionFromVIN(vin),
  };
}

function normalizeNhtsaResponse(json, vin) {
  const row = json?.Results?.[0];
  if (!row || !row.Make) return null;
  return {
    make: row.Make,
    model: row.Model,
    modelYear: row.ModelYear,
    bodyClass: row.BodyClass,
    engine: [row.DisplacementL && `${row.DisplacementL}L`, row.EngineCylinders && `${row.EngineCylinders}-cyl`, row.FuelTypePrimary].filter(Boolean).join(' '),
    driveType: row.DriveType,
    plantCountry: row.PlantCountry,
    source: 'nhtsa-vpic-live',
    vin,
  };
}

module.exports = { decodeVIN, getRegionFromVIN };
