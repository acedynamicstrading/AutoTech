/**
 * US Region Adapter — SEMA Data Co-op
 * -----------------------------------------
 * SEMA Data Co-op (SDC) is the specialty-equipment (performance aftermarket)
 * counterpart to general ACES/PIES — free/open, 500-650+ brands, 2.5-4.5M
 * part numbers, built specifically for performance parts rather than OEM
 * replacement parts. This is why it was flagged as the priority US
 * integration over general ACES in SOURCES.md.
 *
 * Real access model: SDC membership (free) + API credentials via
 * sema.org/sda. NOT called live here — no credentials configured, and the
 * SDC API domain isn't in this project's dev network allowlist. Fixture
 * data below models real US performance-brand parts referenced in the
 * earlier research (turbo/exhaust/suspension category from Summit
 * Racing-class retailers).
 */

export const regionCode = 'US';
export const sourceName = 'SEMA Data Co-op';
export const sourceUrl = 'https://www.sema.org/sda';

export async function fetchParts(vehicle) {
  // Real call would be something like:
  //   GET https://api.semadatacoop.org/v1/parts?make={make}&model={model}&year={year}
  //   Authorization: Bearer {SDC_API_KEY}
  // Not executed here — see file header. Returning fixture data shaped
  // like a real SDC response would normalize to.

  return [
    {
      id: 'us_borgwarner_efr_turbo',
      cat: 'Performance', sub: 'Engine & Forced Induction',
      name: 'BorgWarner EFR 6758 Turbo Kit',
      cost: [4200, 6800], powerGain: [130, 190],
      requires: ['fuel_system', 'ecu_tune', 'intercooler', 'clutch_upgrade'],
      conflicts: ['jp_hks_gt_supercharger'], trackOnly: true, confidence: 'med',
      note: 'US-market performance turbo brand, common on Skyactiv-G swap builds per SDC-listed applications.',
      region: 'US',
      sourceRef: { name: sourceName, url: sourceUrl },
    },
    {
      id: 'us_borla_catback',
      cat: 'Performance', sub: 'Intake & Exhaust',
      name: 'Borla ATAK Cat-Back Exhaust',
      cost: [850, 1400], powerGain: [8, 15],
      requires: [], conflicts: [], trackOnly: true, confidence: 'high',
      note: 'US-manufactured, SDC-listed direct-fit application for this platform.',
      region: 'US',
      sourceRef: { name: sourceName, url: sourceUrl },
    },
  ];
}
