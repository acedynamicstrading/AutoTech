/**
 * VIN Decode & Region Detection (Worker/ESM version)
 * Uses global fetch, which is native to the Workers runtime (unlike Node
 * where it needed the node-fetch polyfill or Node 18+). No behavior change
 * from the Node version — same live-call-with-fixture-fallback design.
 */

const NHTSA_ENDPOINT = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json';

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

export function getRegionFromVIN(vin) {
  if (!vin || vin.length < 1) return { region: 'unknown', wmiChar: null };
  const wmiChar = vin[0].toUpperCase();
  const match = WMI_REGION_TABLE.find(r => wmiChar >= r.range[0] && wmiChar <= r.range[1]);
  return {
    region: match ? match.region : 'unknown',
    wmiChar,
    note: 'WMI indicates country of manufacture, not necessarily original sale market or factory spec — confirm market/trim/options with the user before assuming full fitment identity.',
  };
}

// Fallback fixtures — used only if the live NHTSA call fails (network issue,
// rate limit, or an invalid/test VIN not in their database).
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

export async function decodeVIN(vin, { useLive = true } = {}) {
  let result = null;

  if (useLive) {
    try {
      const res = await fetch(NHTSA_ENDPOINT.replace('{vin}', encodeURIComponent(vin)));
      if (!res.ok) throw new Error(`NHTSA API responded ${res.status}`);
      const json = await res.json();
      result = normalizeNhtsaResponse(json, vin);
    } catch (err) {
      result = null; // fall through to fixtures
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
