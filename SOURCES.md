# Data Sources Registry

Compiled from research into every category of data this platform depends on.
Organized so each catalog/vehicle field can eventually cite where its real
data would come from. Status column reflects what's been verified via search
vs. what's a named-but-unverified lead.

## Vehicle Identity (VIN decode)

| Source | Coverage | Notes | Status |
|---|---|---|---|
| NHTSA vPIC | US, free, official | Baseline year/make/model/trim/engine/transmission. No production date/options. | Integrated (live call in vin-decode.js, falls back to fixtures if unreachable) |
| CarQuery API | Global, free tier | JSON, year/make/model/trim | Verified |
| CarAPI.app | Global, paid tiers | VIN decode, trim specs, plate-to-VIN, OBD-II codes | Verified |
| VehicleDatabases.com | US-strong | VIN decode + window sticker (factory build sheet) + market value | Verified |
| Enthusiast chassis-code wikis | Platform-specific | Best JDM/tuner-relevant detail, no API, manual curation | Verified (unstructured) |

## Fitment Standards

| Source | Region | Notes | Status |
|---|---|---|---|
| ACES/PIES (Auto Care Association) | US | VCdb/Qdb/PCdb 2.0 (Mar 2026), subscription, daily updates | Verified, paid |
| SEMA Data Co-op (SDC) | US, performance-specific | 500-650+ brands, 2.5-4.5M part numbers, **free/open** — more relevant than general ACES since it's performance-native | Verified — priority integration candidate |
| TecDoc / TecAlliance | Europe | "Google for the Aftermarket," 700-1000+ brands, VIN/VRM/OE search, CLEPA-recommended | Verified, subscription |
| Wheel-Size.com API | Global | Bolt pattern/offset/tire size by exact trim | Verified |

## Region-Specific Vehicle/Listing Data

| Source | Region | Notes | Status |
|---|---|---|---|
| Carapis | Japan + 30-200 global marketplaces | Unified API over Carsensor/Goo-net/USS + Mobile.de/AutoScout24/Encar/Che168/Avito/Dubizzle | Verified |
| Megazip / PartsSouq / Amayama | Japan (+ Russia/UAE) | Chassis-code → exploded OEM parts diagrams + part numbers | Verified |
| Teoalida Japan Car DB | Japan | ~160K JDM models, static dataset (sourced from Goo-net) | Verified, paid dataset |
| Up Garage | Japan | Used/aftermarket performance parts, 800K+ items, real current pricing, ships internationally | Verified |
| Nengun Performance | Japan | Direct-from-Japan HKS/Nismo/Greddy/Blitz/Rays with live SKUs | Verified |
| DVLA API / HPI | UK | Registration → spec, MOT history + advisories (unique wear/reliability signal) | Verified |
| RedBook / NEVDIS (MotorWeb) | Australia | 800+ spec attributes, factory options via VIN, powers carsales.com.au | Verified |
| Encar / KB Chachacha | Korea | Includes verified diagnostic/inspection + govt accident history | Verified |
| Che168 / Dongchedi | China | Largest China listing platforms | Named, unverified in depth |
| CarDekho Group (ZigWheels, Gaadi) | India/SEA/Middle East | Dominant multi-region platform | Verified |
| Team-BHP | India | 4.5M+ posts, mods/DIY/track focus, acquired by CARS24 (2025) — may get official API | Verified |
| Carsome | Malaysia/SEA | Used-car platform | Named, unverified in depth |

## Performance / Real-World Gains (ground truth for estimates)

| Source | Notes | Status |
|---|---|---|
| Dragy | GPS-logged runs tied to real mod setups | Verified, no public API confirmed |
| Shop/forum dyno sheets | Per-platform, unstructured | Verified, needs scraping |
| RomRaider / EcuFlash | Open-source Subaru (+ some Nissan/BMW) ECU tuning + datalogging | Verified — datalogs are highest-fidelity performance signal found |
| Speeduino / rusEFI / LibreTune | Open-source standalone ECU projects, community base maps | Verified |

## Community / Build Evidence

| Source | Notes | Status |
|---|---|---|
| Platform forums (NASIOC, Mazda3Revolution, RX7Club, etc.) | Richest historical volume, unstructured, needs LLM extraction | Verified |
| Reddit API | Official, rate-limited | Verified |
| YouTube Data API | Metadata only, no structured parts lists | Verified |

## Salvage / Parts Availability

| Source | Notes | Status |
|---|---|---|
| Row52 | 51 yards, ~49K vehicles, US/Canada, Pick-n-Pull only | Verified, narrow coverage |
| LKQ interchange finder | Own network | Verified |
| JunkyardIndex | Aggregates Row52/LKQ/Pull-A-Part/AutoRecycler | Verified |

## Direct Competitor

| Platform | Notes |
|---|---|
| MotorMia | VIN/manual entry, AI recommendations ("Mia"), 500K+ community builds, enterprise data product selling aggregated demand data. Closest existing analog — study for parity, differentiate on fitment/dependency rigor + unrestricted toy/track mode + JDM depth. |

## Cosmetic/Visual Preview (crowded — confirms build-in-house is not the differentiator)

Car Editor, ModDrip, ModCar.ai, AutoVisuals, Visualizee.ai (+ white-label "VizTunr"), Phygital+, 3DTuning (3D-model, non-photo), TunedRides (wrap-specific, B2B), Car Wrapper 3D (ties previews to real film manufacturer libraries — 3M/Avery Dennison/Hexis/Oracal).
**Recommendation carried into system design:** integrate/partner rather than build. Not implemented in this codebase.

## Explicitly Ruled Out

- **Insurance-approved mod lists** (Adrian Flux, Chris Knott, Keith Michaels) — real category, but not structured/sourceable data; broker-by-broker quote decisions, not a public compatibility database. Dropped as a data source candidate.

## Genuinely Unlimited-Free (no request cap, no trial, no forced upgrade)

Distinct from everything above: these have no metered tier at all, vs. the
"free tier with a cap" sources this project already excluded (vinfreecheck
100/mo, GlobalVIN 100/mo sandbox, Vincario/vindecoder.eu free credits,
Auto.dev, CarAPI daily caps — none of these are integrated).

| Source | Category | Why unlimited | Built into this codebase? |
|---|---|---|---|
| NHTSA vPIC | VIN decode | Free US govt service, no key, no stated cap | Yes — `vin-decode.js` live path |
| Offline WMI table (own, ISO 3779 public data) | VIN decode | Self-hosted, zero network calls — same pattern as corgi/Wal33D/nhtsa-vin-decoder | Yes — `vin-decode.js` `getManufacturerFromVIN()`, real fallback layer used when both NHTSA and fixtures miss |
| Wikidata SPARQL | Vehicle spec | CC0 public domain, no key, no paywall (soft query-timeout only) | Yes — `sources/wikidata-spec.js`. Untested in dev sandbox (network allowlist blocks query.wikidata.org — got a 403), but unlike SEMA/TecDoc this should genuinely work once deployed since it needs no credentials, only network access, which the dev sandbox — not the code — is what's restricted. Verify post-deploy. |
| DBpedia SPARQL | Vehicle spec | Same model as Wikidata | Not built — same category as Wikidata, redundant to add both initially |
| eBay Motors Browse API | Parts marketplace | No per-call cost, only transaction fees if selling | Yes — `sources/ebay-motors.js`, but requires a free developer account + OAuth token (`wrangler secret put EBAY_OAUTH_TOKEN`) to activate. "Unlimited free" here means no metered paywall, not zero setup. |
| SEMA Search (browse tool) | Parts marketplace | Free to browse | **Not built** — human-facing only, no API, no bulk export. Automating it means scraping, which carries the ToS/legal caveats already flagged elsewhere in this doc. Not worth building a fake adapter for a source that can't actually be called programmatically. |
| Up Garage (website) | Parts marketplace | Free to browse | **Not built** — same reasoning as SEMA Search. Already listed above under Japan sources with the understanding that real automation would need scraping, not an API call. |
| Wheel-Size.com (free website) | Fitment | Free to browse | **Not built** — the free-to-browse claim applies to the human site, not their API (which is the paid/sandboxed one flagged earlier). Automated access to the free tier means scraping. |
| CarQueryAPI | Vehicle catalog | N/A | **Explicitly excluded** — stopped updating in 2019, live endpoint unreliable. Not referenced anywhere in this codebase. |

**The honest pattern, worth stating plainly**: genuinely unlimited-free at
API scale only exists where (a) a government/nonprofit funds it outright
(NHTSA, Wikidata/DBpedia), or (b) you self-host public data instead of
calling someone's server (the offline WMI table). Every commercial
aftermarket-parts vendor — even the generous ones like SEMA Data Co-op —
meters volume or requires credentials somewhere, because hosting fitment
data costs real money. The three genuinely free-and-automatable sources
above are integrated; the three browse-only ones are correctly left
unautomated rather than faked.

## Not Yet Verified (named leads only, flagged honestly rather than presented as confirmed)

- Motorsport sanctioning body technical/class rules (FIA, SCCA, NASA, Time Attack) — relevant specifically to categorizing "track-only" mods by class legality
- Technical Service Bulletins / recall databases as a "known issues per mod" signal
- Che168/Dongchedi and Carsome in depth (named above, not independently deep-dived)
