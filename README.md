# JusticeGap

JusticeGap maps how far people are from legal help in the real world.

- Enter a location + legal problem
- See nearest relevant services (courts / legal aid / CJCs)
- Compare route options (driving, walking, public transport)
- Get an access-to-justice narrative (“47 minutes away and only open weekdays”)

> Disclaimer: This project provides informational directions and service discovery. It is not legal advice.

## Status
This repo currently contains a **static frontend demo** (Leaflet + mock SG services). It supports:
- Singapore map default
- Issue filtering
- Opening-hours evaluation in Asia/Singapore time
- Multi-route tracing for driving + walking (alternatives via OSRM)
- Public transport UI support (requires OneMap token; integration depends on network/CORS)

## Quick start (demo)

1) Start the static server:

- From PowerShell:
  - `cd <path-to-your-project>`
  - `py -m http.server 5173`

2) Open in your browser:
- http://localhost:5173

## Live data & discovery (new)

### A) Service directory ingestion (CSV/JSON → services.json)
We now ship a schema + importer:

- Schema: [data/services.schema.json](data/services.schema.json)
- Sample data: [data/services.sample.json](data/services.sample.json)
- Importer: [scripts/import-services.js](scripts/import-services.js)

Example (CSV input):
1) Create a CSV with headers:
  - `id,name,type,lat,lng,issues,hours_weekdays,hours_weekend,phone,url,eligibility,address,service_area`
2) Run:
  - `npm run import:services -- --input=path\to\services.csv --output=data\services.json`

### B) OneMap theme discovery (live data catalog)
We added a small backend to fetch OneMap theme metadata (token-based). This lets you discover whether OneMap exposes a legal‑aid themed layer.

1) Copy [.env.example](.env.example) → `.env` and set:
  - `ONEMAP_EMAIL`, `ONEMAP_PASSWORD`
2) Start the API server:
  - `npm install`
  - `npm run dev:server`
3) Discover themes:
  - `GET http://localhost:8787/api/onemap/themes`
4) Fetch a specific theme:
  - `GET http://localhost:8787/api/onemap/theme?queryName=<THEME_NAME>`

> If you already have a OneMap token, set `ONEMAP_TOKEN` instead of email/password.

## How routing works (today)

### Driving + walking
- Uses OSRM public routing endpoint.
- Requests multiple alternatives and draws multiple polylines.

### Public transport
- UI includes a OneMap token input.
- If a OneMap access token is provided, the app attempts to fetch PT routing.
- If network/DNS/CORS prevents access, the app shows a clear message and continues to work for walking/driving.

## Making it fully live & operational (production checklist)

To be “live” (public URL + real data + reliable routing), you’ll need 3 upgrades:

### 1) Real Singapore service directory
Replace the mock `locations` list with a real dataset.

Minimum fields per service:
- name, type, lat/lng
- issues supported
- hours (weekday/weekend) + holiday overrides (optional)
- contact info (URL/phone)
- eligibility notes (where applicable)

### 2) Backend API (required)
A backend is needed to:
- keep API tokens/keys off the client
- avoid CORS issues
- add caching and rate limiting

Recommended endpoints:
- `GET /api/services?issue=...&openNow=...` → returns services
- `GET /api/route?mode=driving|walking|transit&from=lat,lng&to=lat,lng` → returns route alternatives + geometry
- `POST /api/triage` → maps free-text user problem to issue taxonomy (LLM-assisted)

### 3) Transit routing (Singapore)
Options:
- OneMap routing (token-based) via backend proxy
- Host your own transit engine (OpenTripPlanner + GTFS) for more control

## Deployment (recommended)

- Frontend: Vercel / Cloudflare Pages / Azure Static Web Apps
- Backend: Azure Functions / Cloud Run / Fly.io / Render
- Secrets: provider-managed secret store (do not commit tokens)

## Prompts you can use to get me to “make it live”

Pick one of the following (copy/paste). These are written to be specific and actionable.

### Prompt A — “Create production backend + deploy”
"Take the JusticeGap demo and make it production-ready. Create a Node.js backend with:
- /api/services served from a JSON file
- /api/route proxy that supports driving/walking (OSRM) and transit (OneMap)
- caching (in-memory is fine) + basic rate limiting
- environment variables for OneMap credentials/token
Then add a deployment guide for Vercel (frontend) + Render/Fly.io (backend)."

### Prompt B — “OneMap transit fully working”
"Implement OneMap public transport routing end-to-end. Add a backend endpoint that:
- fetches/refreshes OneMap access tokens server-side
- calls OneMap routing for PT
- normalizes the response to GeoJSON LineString + duration + distance
Update the frontend to call the backend instead of OneMap directly."

### Prompt C — “Real Singapore dataset ingestion”
"Replace mock locations with a real Singapore service directory. Create:
- data schema + validation
- a script that imports a CSV/JSON dataset into the schema
- UI improvements: search, filters, and service detail panel"

### Prompt D — “Add GPT triage safely”
"Add a /api/triage endpoint that takes a free-text legal problem and returns:
- normalized issue(s)
- recommended service types
- a disclaimer-only response (no legal advice)
Add prompt/guardrails and unit tests for the classifier."

## Notes / known limitations
- Public transit routing depends on external availability and may require a server proxy.
- Public routing services have rate limits; production should use hosted routing or caching.

## Backend (new)

API server is in [server/index.js](server/index.js). Endpoints:
- `GET /health`
- `GET /api/services` → returns [data/services.json](data/services.json)
- `GET /api/onemap/themes` → OneMap theme list
- `GET /api/onemap/theme?queryName=...` → theme detail

The frontend will attempt to load `/api/services`. If it fails, it uses local demo data.

## Docs
- PRD: [PRD.md](PRD.md)

