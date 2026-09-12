/**
 * Europe Region Adapter — TecDoc / TecAlliance
 * -----------------------------------------
 * "Google for the Aftermarket" — 700-1000+ brands, VIN/VRM/OE-number
 * search, CLEPA-recommended. Europe's dominant fitment standard, more
 * consolidated than the fragmented US landscape (one standard vs several
 * competing ones).
 *
 * Real access model: TecAlliance subscription API, KBA (German type
 * approval number) or VRM-based lookup. NOT called live here — subscription
 * required, no credentials configured. Fixture data below models what a
 * real TecDoc application-text response normalizes to, reflecting the
 * regional-engineering-difference point made earlier in this project
 * (EU-spec parts differ from US-spec on the same nameplate due to crash/
 * emissions standard differences).
 */

export const regionCode = 'EU';
export const sourceName = 'TecDoc / TecAlliance';
export const sourceUrl = 'https://www.tecalliance.net/products/tecdoc-catalogue/';

export async function fetchParts(vehicle) {
  // Real call would be something like:
  //   GET https://webservice.tecalliance.services/pegasus-3-0/services/TecdocToArticle.jsonEndpoint
  //   ?kTypNr={KBA_TYPE_NUMBER}&manufacturerId={id}
  // Not executed here — see file header.

  return [
    {
      id: 'eu_kw_v3_coilovers',
      cat: 'Performance', sub: 'Suspension',
      name: 'KW Variant 3 Coilovers (EU-spec)',
      cost: [1900, 2600], powerGain: [0, 0],
      requires: [], conflicts: [], trackOnly: false, confidence: 'high',
      note: 'TecDoc application data confirms fitment on EU-market chassis specifically — mounting points can differ from NA-spec on the same generation due to differing crash-standard subframes.',
      region: 'EU',
      sourceRef: { name: sourceName, url: sourceUrl },
    },
    {
      id: 'eu_akrapovic_exhaust',
      cat: 'Performance', sub: 'Intake & Exhaust',
      name: 'Akrapovič Evolution Line Titanium Exhaust',
      cost: [2800, 4200], powerGain: [10, 18],
      requires: [], conflicts: [], trackOnly: true, confidence: 'high',
      note: 'Slovenian manufacturer, TecDoc-listed for EU-market Skyactiv-G — exhaust routing differs from US spec per Euro 6 catalytic converter placement.',
      region: 'EU',
      sourceRef: { name: sourceName, url: sourceUrl },
    },
  ];
}
