/**
 * Regional Parts Source Adapter Interface
 * -----------------------------------------
 * Every adapter in this folder implements the same shape so the registry
 * can merge them without region-specific logic:
 *
 *   {
 *     regionCode: 'US' | 'EU' | 'JP' | ...,
 *     sourceName: string,           // matches an entry in SOURCES.md
 *     sourceUrl: string,
 *     async fetchParts(vehicle) -> Part[]
 *   }
 *
 * Part shape returned must match the core catalog schema (see catalog.js) —
 * id, cat, sub, name, cost, powerGain, requires, conflicts, trackOnly,
 * confidence, note — PLUS two fields adapters are responsible for setting:
 *   region: the regionCode
 *   sourceRef: { name, url } — traceability back to where this data came from
 *
 * IMPORTANT — sandbox limitation, stated plainly: none of these adapters
 * call a real live API in this environment. SEMA Data Co-op, TecDoc, and
 * Japan retailer sites all require either paid API access, an API key this
 * project doesn't have yet, or are outside the network allowlist available
 * during development. Each adapter's fetchParts() is written against the
 * REAL documented shape of that source (endpoint patterns, field names)
 * with a clearly-labeled fixture standing in for the live call — same
 * pattern as vin-decode.js's NHTSA fallback. Swap the fixture return for a
 * real fetch() once you have credentials for that source.
 */

export const ADAPTER_INTERFACE_VERSION = 1;
