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

// Offline WMI (World Manufacturer Identifier, ISO 3779) -> manufacturer
// table. This is public standard data, not a third-party API — it's the
// same "self-hosted, zero network calls, unlimited" pattern as corgi and
// Wal33D/nhtsa-vin-decoder: no rate limit because there's no external call
// to limit. Used as a genuine offline fallback layer, not just 3 fixture
// VINs — this decodes MANUFACTURER for any VIN whose WMI is in the table,
// live NHTSA call or not.
const WMI_MANUFACTURER_TABLE = {
  'JM1': 'Mazda', 'JM7': 'Mazda', '3MZ': 'Mazda (Mexico-built)', '4MZ': 'Mazda',
  '1HG': 'Honda', '2HG': 'Honda', 'JHM': 'Honda', '19X': 'Honda',
  'JN1': 'Nissan', '1N4': 'Nissan', '1N6': 'Nissan', '5N1': 'Nissan',
  'JF1': 'Subaru', 'JF2': 'Subaru', '4S3': 'Subaru', '4S4': 'Subaru',
  'WBA': 'BMW', 'WBS': 'BMW (M)', 'WBY': 'BMW (i)', '4US': 'BMW (US-built)',
  'WVW': 'Volkswagen', 'WV1': 'Volkswagen (commercial)', '3VW': 'Volkswagen (Mexico-built)', '1VW': 'Volkswagen (US-built)',
  '1FA': 'Ford', '1FT': 'Ford (truck)', '3FA': 'Ford (Mexico-built)', 'WF0': 'Ford (Europe)',
  '1G1': 'Chevrolet', '1GC': 'Chevrolet (truck)', '2G1': 'Chevrolet (Canada-built)', '3G1': 'Chevrolet (Mexico-built)',
  'KMH': 'Hyundai', 'KM8': 'Hyundai',
  'KNA': 'Kia', 'KND': 'Kia',
  'ZFA': 'Fiat', 'ZFF': 'Ferrari', 'ZAR': 'Alfa Romeo', 'ZLA': 'Lancia',
  'VF1': 'Renault', 'VF3': 'Peugeot', 'VF7': 'Citroën',
  'SAJ': 'Jaguar', 'SAL': 'Land Rover', 'SCC': 'Lotus',
  'JT2': 'Toyota', 'JTD': 'Toyota', '4T1': 'Toyota', '5TD': 'Toyota',
  'JA3': 'Mitsubishi', 'JA4': 'Mitsubishi',
  'YV1': 'Volvo', 'YV4': 'Volvo',
};

export function getManufacturerFromVIN(vin) {
  if (!vin || vin.length < 3) return null;
  const wmi3 = vin.slice(0, 3).toUpperCase();
  return WMI_MANUFACTURER_TABLE[wmi3] || null;
}

// Fallback fixtures — used only if BOTH the live NHTSA call fails AND the
// offline WMI table above doesn't have a match. Kept small since the WMI
// table now covers the general case; these are for exact-model-detail
// fixtures the WMI table alone can't give you (model, year, engine).
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
    if (fixture) {
      result = { ...fixture, vin };
    } else {
      // Second fallback layer: offline WMI decode. Won't give model/year/
      // engine (that detail genuinely requires either NHTSA or a fixture),
      // but gives real manufacturer identification for ANY VIN with a
      // known WMI prefix — unlimited, zero network, works even if NHTSA
      // and every other hosted API are all down or unreachable.
      const manufacturer = getManufacturerFromVIN(vin);
      if (manufacturer) {
        result = {
          make: manufacturer, model: null, modelYear: null, bodyClass: null,
          engine: null, driveType: null, plantCountry: null,
          source: 'offline-wmi-table',
          manufacturerNote: 'Manufacturer identified via offline WMI decode only — model/year/engine detail requires a live NHTSA lookup or a matching fixture, neither of which was available.',
        };
      }
    }
  }

  if (!result) {
    throw new Error(`VIN decode failed: no live API result, no local fixture, and unrecognized WMI for ${vin}`);
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
