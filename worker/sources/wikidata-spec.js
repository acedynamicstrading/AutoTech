/**
 * Vehicle Spec Source — Wikidata SPARQL
 * -----------------------------------------
 * Unlike SEMA Data Co-op and TecDoc (both need paid credentials this
 * project doesn't have), Wikidata's public SPARQL endpoint is genuinely
 * free with no API key and no tiered paywall — CC0 public domain data.
 * The only real constraint is a soft query-timeout on very expensive
 * queries, not a request cap.
 *
 * IMPORTANT — different honesty note than the other adapters: this one's
 * fetch() call is written to actually work once deployed to Cloudflare.
 * It's untested here not because of missing credentials, but because this
 * dev sandbox's network allowlist doesn't include query.wikidata.org (same
 * restriction that blocks the NHTSA live call in this environment). Once
 * this Worker is live on Cloudflare's actual network, this function should
 * work as written — that's a real claim to verify post-deploy, not a
 * permanent limitation like the SEMA/TecDoc stubs.
 *
 * Scope: this is vehicle SPEC data (production years, engine displacement,
 * body class), not parts fitment data — Wikidata doesn't have an aftermarket
 * parts catalog. Useful as a supplementary cross-check for vin-decode.js's
 * output, not a replacement for the parts-source adapters.
 */

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

function buildQuery(make, model) {
  // Wikidata property reference for context:
  //   P31 = instance of, Q3231690 = automobile model
  //   P176 = manufacturer, P2043 = length, P2048 = height, P2067 = mass
  //   P2101 = power output
  return `
    SELECT ?item ?itemLabel ?manufacturerLabel ?inceptionYear WHERE {
      ?item wdt:P31 wd:Q3231690;
            rdfs:label ?itemLabel.
      OPTIONAL { ?item wdt:P176 ?manufacturer. }
      OPTIONAL { ?item wdt:P571 ?inceptionYear. }
      FILTER(CONTAINS(LCASE(?itemLabel), LCASE("${make}")))
      FILTER(CONTAINS(LCASE(?itemLabel), LCASE("${model}")))
      FILTER(LANG(?itemLabel) = "en")
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 5
  `;
}

export async function fetchVehicleSpec(make, model) {
  const query = buildQuery(make, model);
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/sparql-results+json', 'User-Agent': 'vehicle-build-platform/0.1 (research project)' },
    });
    if (!res.ok) throw new Error(`Wikidata SPARQL responded ${res.status}`);
    const json = await res.json();
    const bindings = json?.results?.bindings || [];
    return {
      source: 'wikidata-sparql-live',
      sourceUrl: WIKIDATA_SPARQL_ENDPOINT,
      results: bindings.map(b => ({
        label: b.itemLabel?.value,
        manufacturer: b.manufacturerLabel?.value,
        inceptionYear: b.inceptionYear?.value,
      })),
    };
  } catch (err) {
    // Expected in this dev sandbox (network allowlist doesn't include
    // query.wikidata.org) — real deployment should not hit this branch.
    return {
      source: 'wikidata-sparql-unreachable',
      sourceUrl: WIKIDATA_SPARQL_ENDPOINT,
      results: [],
      error: err.message,
      note: 'Live Wikidata call failed — if this happens post-deploy (not just in dev sandbox), check query syntax or Wikidata endpoint status, since this source has no auth/key to misconfigure.',
    };
  }
}
