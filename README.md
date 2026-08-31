# Vehicle Build Platform

NFS-style vehicle customization/build recommendation platform. Frontend +
API, ready to deploy to Cloudflare Pages + Workers (matching the rest of
the Ace Dynamics stack).

## Repo layout

```
public/                  Static frontend — deploy to Cloudflare Pages
  index.html              Build configurator: category browser, live
                           client-side dependency/conflict engine, VIN
                           decode input, and a "Verify via Server" button
                           that cross-checks the client calc against the
                           deployed Worker's /api/build/evaluate.
  visual-builder.html      Option 3 — pre-modeled SVG layer-swap visual
                           builder. Fully static, no API calls.

worker/                  Cloudflare Worker — deploy with wrangler
  index.js                 Entry point: routes /api/health, /api/catalog,
                            /api/vin/decode, /api/build/evaluate,
                            /api/build/autocomplete, /api/build/render
  engine.js                 Dependency/conflict resolution + estimation.
                             Pure functions, ESM, no Node-specific APIs.
  vin-decode.js              VIN → vehicle identity (live NHTSA vPIC +
                              fixture fallback) + WMI region detection.
                              Uses global fetch, native to Workers.
  photo-render.js             Option 2 — AI photo-render pipeline (prompt
                               builder + pluggable provider; mock provider
                               active by default — see "Wiring a real
                               image-gen provider" below).
  catalog.js                   Part data as an ES module (Workers can't
                                read arbitrary files at runtime — this is
                                catalog.json converted to an importable
                                object).
  test.js                       13 assertions against the REAL Worker
                                 fetch(request) handler, using Node 22's
                                 native Request/Response — validates the
                                 exact code that deploys, no wrangler
                                 required to run these.
  local-dev-server.js            Wraps the Worker's fetch handler in plain
                                  Node http for quick local testing without
                                  wrangler installed. Not part of the
                                  deployment — wrangler dev replaces this
                                  once you're testing against the real
                                  Cloudflare runtime.

wrangler.toml            Worker deployment config
SOURCES.md                Full data-sources registry from the research
                           pass (vehicle identity, fitment standards,
                           regional sources, competitors, etc.)
```

## Deploying

### 1. Deploy the Worker (API)

```bash
cd worker
npm install
npx wrangler login          # first time only
npx wrangler deploy
```

This prints your live API URL, something like:
`https://vehicle-build-platform-api.<your-subdomain>.workers.dev`

### 2. Point the frontend at it

Open `public/index.html`, find the `API_BASE` constant near the top of the
`<script>` block, and set it to the URL from step 1.

### 3. Deploy the frontend to Cloudflare Pages

Easiest path: connect this GitHub repo to Cloudflare Pages (Pages →
Create project → connect to Git), set the build output directory to
`public`, no build command needed (it's static HTML, no bundler).

## Testing before you deploy anything

```bash
cd worker
npm test                    # 13 assertions against the real fetch handler
node local-dev-server.js    # serves the Worker on http://localhost:8787
```

With the local dev server running, set `API_BASE = 'http://localhost:8787'`
in `public/index.html` and open it directly in a browser to test the full
frontend-to-backend flow before touching Cloudflare at all.

## Try it right now, no deploy needed

Try a VIN in the configurator once connected: `3MZBPACL5KM123456` (US-built
Mazda 3 fixture) or `JM1BPACL5K1123456` (same car, Japan-built — watch the
region field change). These resolve via local fixtures since NHTSA's live
API wasn't reachable from the dev sandbox this was built in — see
"Known limitations" below.

## Known limitations (tracked honestly)

- **`vin-decode.js`'s live NHTSA path is unverified against the real
  internet** — built and tested in a network-restricted sandbox with no
  route to `vpic.nhtsa.dot.gov`. The code path is correct and falls back
  to fixtures automatically on failure; test it with a real VIN once
  deployed to confirm the live branch works as written.
- **`photo-render.js` now uses Cloudflare Workers AI by default** —
  `stable-diffusion-v1-5-img2img`, bound via the `[ai]` block in
  `wrangler.toml`. Free allocation: 10,000 Neurons/day, no separate vendor
  account. It automatically falls back to the mock provider when `env.AI`
  isn't available (e.g. running `worker/test.js` directly, or
  `local-dev-server.js` without wrangler) — see "Wiring a real image-gen
  provider" below for swapping in a paid provider later.
- **`catalog.js` has 20 parts, text-only, no product images** — see
  SOURCES.md for retailer sources (Summit Racing, Up Garage, Nengun) that
  have real product photos if/when that gets prioritized.
- **CORS is wide open (`*`)** in `worker/index.js` — tighten
  `Access-Control-Allow-Origin` to your actual Pages domain before treating
  this as production-ready.

## Photo rendering

`/api/build/render` uses **Cloudflare Workers AI** (`workersAiProvider` in
`worker/photo-render.js`) by default — no extra deploy step needed beyond
what's already in `wrangler.toml`'s `[ai]` block. It builds a prompt from
the actually-selected catalog parts, runs it against
`stable-diffusion-v1-5-img2img` with the uploaded base photo, and returns
the result as base64. Falls back to `mockProvider` automatically whenever
`env.AI` isn't present (unit tests, `local-dev-server.js` without
wrangler) so nothing breaks outside the real Cloudflare runtime.

### Swapping in a paid provider later

`worker/photo-render.js` has a commented-out `openAiProvider` function
showing the shape, for when Workers AI's free quota or generic-SD quality
isn't enough:

1. `npx wrangler secret put OPENAI_API_KEY` (or whichever vendor)
2. Uncomment and adapt the provider function for your chosen vendor's API
3. In `worker/index.js`'s `/api/build/render` handler, swap the
   `provider: env && env.AI ? workersAiProvider : mockProvider` line for
   your new provider

Vendor candidates from the research pass: OpenAI images/edit endpoint,
Stability AI image-to-image, or Visualizee's white-label "VizTunr" product.
