/**
 * Regional Source Registry
 * -----------------------------------------
 * Combines every regional adapter behind one function. This is what makes
 * the platform actually international instead of "one source, hardcoded":
 * adding a new region/source means adding one adapter file here, not
 * touching the catalog, the engine, or the API routes.
 */

import * as usSema from './us-sema.js';
import * as euTecdoc from './eu-tecdoc.js';
import * as jpAftermarket from './jp-aftermarket.js';

const ADAPTERS = [usSema, euTecdoc, jpAftermarket];

export function listRegions() {
  return ADAPTERS.map(a => ({ regionCode: a.regionCode, sourceName: a.sourceName, sourceUrl: a.sourceUrl }));
}

/**
 * Returns region-specific parts for a given region code, or all regions'
 * parts if no region is specified. Each returned part carries its own
 * `region` and `sourceRef` — the caller merges these with the base
 * (unsourced/generic) catalog as it sees fit.
 */
export async function fetchRegionalParts(vehicle, regionCode = null) {
  const adapters = regionCode
    ? ADAPTERS.filter(a => a.regionCode === regionCode)
    : ADAPTERS;

  const results = await Promise.all(adapters.map(a => a.fetchParts(vehicle)));
  return results.flat();
}

/**
 * Merges the base catalog (generic/unsourced placeholder parts) with
 * region-specific sourced parts. Base parts get region: 'global' and
 * sourceRef: null if they don't already have one, so every part in the
 * merged result has a consistent shape for the frontend to render.
 */
export function mergeWithBase(baseParts, regionalParts) {
  const tagged = baseParts.map(p => ({
    region: p.region || 'global',
    sourceRef: p.sourceRef || null,
    ...p,
  }));
  return [...tagged, ...regionalParts];
}
