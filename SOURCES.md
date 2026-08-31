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

## Not Yet Verified (named leads only, flagged honestly rather than presented as confirmed)

- Motorsport sanctioning body technical/class rules (FIA, SCCA, NASA, Time Attack) — relevant specifically to categorizing "track-only" mods by class legality
- Technical Service Bulletins / recall databases as a "known issues per mod" signal
- Che168/Dongchedi and Carsome in depth (named above, not independently deep-dived)
