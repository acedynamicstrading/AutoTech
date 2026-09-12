/**
 * Japan Region Adapter — Up Garage + Nengun Performance
 * -----------------------------------------
 * Up Garage: Japan's largest used/aftermarket parts chain, 800K+ items,
 * 150+ physical stores + English storefront, real current pricing.
 * Nengun Performance: direct-from-Japan shop for HKS/Nismo/Greddy/Blitz/
 * Rays, live SKUs and stock status.
 *
 * These two are combined into one adapter since both are Japan-market
 * performance-brand retailers (not OEM diagram sources like Megazip/
 * PartsSouq/Amayama, which are a separate concern — OEM part lookup, not
 * aftermarket performance parts).
 *
 * Real access model: both are retail storefronts, not API-first — real
 * integration would need product-page scraping (with rate limiting/ToS
 * respect, as flagged in SOURCES.md) or a future partner API if one of
 * them opens one. NOT called live here. Fixture data below models real
 * JDM performance brands referenced in the original research.
 */

export const regionCode = 'JP';
export const sourceName = 'Up Garage / Nengun Performance';
export const sourceUrl = 'https://www.upgarage.com/en';

export async function fetchParts(vehicle) {
  // Real integration: product listing pages per brand/category, e.g.
  //   https://www.upgarage.com/en/search?make={make}&model={model}
  // or Nengun's per-brand catalog pages (HKS, Nismo, Greddy, Blitz, Rays).
  // Not executed here — see file header.

  return [
    {
      id: 'jp_hks_gt_supercharger',
      cat: 'Performance', sub: 'Engine & Forced Induction',
      name: 'HKS GT Supercharger Pro Kit',
      cost: [5200, 8500], powerGain: [90, 140],
      requires: ['fuel_system', 'ecu_tune'], conflicts: ['us_borgwarner_efr_turbo'],
      trackOnly: true, confidence: 'low',
      note: 'Sourced via Nengun — real current SKU, but limited real-world install count on this specific platform per available Japan-market listings. Treat gain range as low-confidence until more installs are documented.',
      region: 'JP',
      sourceRef: { name: 'Nengun Performance', url: sourceUrl },
    },
    {
      id: 'jp_rays_te37',
      cat: 'Visual', sub: 'Wheels & Tires',
      name: 'RAYS Volk Racing TE37 (JDM spec)',
      cost: [3200, 5600], powerGain: [0, 0],
      requires: [], conflicts: [], trackOnly: true, confidence: 'high',
      note: 'Real current Up Garage listing category — JDM bolt pattern/offset spec may differ from NA-market wheel fitment; confirm against Wheel-Size.com data for the specific export-market chassis.',
      region: 'JP',
      sourceRef: { name: 'Up Garage', url: sourceUrl },
    },
  ];
}
