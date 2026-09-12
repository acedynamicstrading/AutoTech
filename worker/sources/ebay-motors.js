/**
 * Parts Marketplace Source — eBay Motors (Browse API)
 * -----------------------------------------
 * eBay doesn't charge for API access itself — free developer account,
 * no per-call cost (only normal seller transaction fees apply if you
 * actually sell through it). Different honesty category than Wikidata
 * though: this DOES require a free developer account + OAuth token,
 * so it's "unlimited free" in the sense of no metered paywall, not in
 * the sense of "no setup required."
 *
 * NOT called live here — no eBay developer credentials configured for
 * this project. Real integration: register at developer.ebay.com, get
 * an OAuth app token, call the Browse API's item_summary/search endpoint
 * filtered to Motors categories.
 */

const EBAY_BROWSE_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';

export async function searchPartsListing(query, env) {
  if (!env?.EBAY_OAUTH_TOKEN) {
    return {
      source: 'ebay-motors-not-configured',
      results: [],
      note: 'No EBAY_OAUTH_TOKEN bound — set one via `wrangler secret put EBAY_OAUTH_TOKEN` after registering a free developer account at developer.ebay.com to activate this source.',
    };
  }

  try {
    const url = `${EBAY_BROWSE_ENDPOINT}?q=${encodeURIComponent(query)}&category_ids=6030`; // 6030 = eBay Motors Parts & Accessories
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.EBAY_OAUTH_TOKEN}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
    });
    if (!res.ok) throw new Error(`eBay Browse API responded ${res.status}`);
    const json = await res.json();
    return {
      source: 'ebay-motors-live',
      results: (json.itemSummaries || []).map(item => ({
        title: item.title,
        price: item.price,
        condition: item.condition,
        url: item.itemWebUrl,
      })),
    };
  } catch (err) {
    return { source: 'ebay-motors-error', results: [], error: err.message };
  }
}
