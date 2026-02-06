# JusticeGap — PRD (Product Requirements Document)

Date: 2026-02-06  
Product: JusticeGap (“Legal reality, but mapped”)  
Region: Singapore  
Audience: Residents seeking legal help + policymakers/NGOs assessing access-to-justice gaps

## 1) Problem & Goal
People don’t fail to seek legal help because they don’t care; they fail because help is distant, confusing, and time-inconvenient.

**Goal**: Given a user’s location and legal issue, show *the nearest appropriate legal help* and *the real-world effort* to reach it (travel time, opening hours, eligibility, case types). Make the “justice gap” measurable and empathetic.

### Primary user question
“How far am I from justice—right now?”

### Success criteria (MVP)
- User enters location (or uses GPS) + selects legal issue.
- App returns a ranked list of relevant services (legal aid, clinics, CJCs, courts) with:
  - travel time (public transport + walking + driving)
  - distance
  - open/closed status + next open time
  - case types supported + basic eligibility notes
- Map renders selected route(s) and allows switching among options.

## 2) Scope

### In-scope (MVP)
- Singapore baseline map
- Dataset of legal help locations
- Issue → service matching
- Multi-mode routing (walk/drive/transit) with route alternatives when supported
- Opening-hours evaluation in Asia/Singapore timezone
- Basic filters (open now, weekdays-only)
- Accessibility + mobile-friendly UI

### Out-of-scope (MVP)
- Legal advice or case strategy
- Appointment booking / case intake
- User accounts
- Payments

## 3) Personas
1) **Resident in urgent need**
   - wants nearest help for a specific issue
   - cares about “open now” + travel time
2) **Working parent**
   - needs weekend/evening options
3) **Policy/NGO analyst (demo)**
   - wants a story + insight for access-to-justice

## 4) User journeys

### 4.1 Resident: find nearest help
1. Open app.
2. Provide location (GPS or manual).
3. Choose legal issue.
4. App lists relevant services ranked by *fastest transit time* (default) and shows best route.
5. User switches mode (transit/walking/driving) and selects alternative routes.

### 4.2 Analyst: tell a story
1. Open app in front of audience.
2. Pick different neighborhoods.
3. Show changes in travel time and “only open weekdays” insight.

## 5) Functional requirements

### FR-01 Location input
- Manual `lat,lng` entry + browser geolocation.
- Validate and handle errors gracefully.

### FR-02 Issue taxonomy
- Supported issues (MVP): divorce/family, employment, debt, criminal, housing, immigration.
- Expandable taxonomy.

### FR-03 Service directory
Each service record must include:
- `id`, `name`, `type` (court/clinic/cjc/other)
- coordinates (lat/lng)
- supported `issues`
- `hours` (weekday/weekend) and holiday overrides (optional)
- contact info (phone, email, URL)
- eligibility notes (where applicable)
- service area constraints (optional)

### FR-04 Matching & ranking
- Filter by issue compatibility.
- Optional filters: open now, weekdays-only.
- Rank results by shortest *selected* mode travel time; default = public transport.

### FR-05 Routing & route alternatives
- Must support modes:
  - walking
  - driving
  - public transport (Singapore)
- Must display:
  - at least 1 route per mode
  - multiple alternatives where available (Google-maps-like)
- Route trace shown on map; selecting an option highlights that route.

### FR-06 Availability / opening hours
- Compute open/closed using Asia/Singapore timezone.
- Show “open now” and “next open time”.

### FR-07 Safety and disclaimers
- Must display clear disclaimer: informational only, not legal advice.
- Avoid collecting sensitive personal data.

## 6) Non-functional requirements

### NFR-01 Privacy
- Do not log precise user locations by default.
- If analytics is enabled, anonymize + coarse geohash.

### NFR-02 Reliability
- Graceful degradation if routing provider fails (fallback to straight-line estimate).

### NFR-03 Performance
- First load under ~2s on typical broadband.
- Route results under ~3–5s.

### NFR-04 Security
- Keys/tokens must not be shipped in client code.
- Use server-side proxy for OneMap or other providers.

### NFR-05 Compliance
- Respect provider ToS and rate limits.
- Include attribution for basemap and routing providers.

## 7) Data & integrations

### 7.1 Service directory sources (Singapore)
MVP options:
- Curated JSON (manual)
- Government/NGO open datasets if available
- Later: periodic sync job

### 7.2 Routing providers
- **Walking/driving**: OSRM demo server for prototype; production should use hosted OSRM, Mapbox Directions, or Google Directions.
- **Public transport (Singapore)**: OneMap routing if available, or a GTFS-based transit engine (OTP) hosted by you.

### 7.3 LLM / GPT integration (issue → service matching)
- Input: user’s free-text problem description.
- Output: normalized issue type(s) + confidence + recommended service categories.
- Must include guardrails: no legal advice, only triage.

## 8) Architecture (target “live” setup)

### MVP (demo)
- Static frontend (Leaflet)
- Static JSON data
- Routing via public endpoints (best-effort)

### Production (recommended)
- Frontend: static SPA (Vite/Next optional)
- Backend: small API service
  - `/api/services` service directory
  - `/api/route` proxy to routing providers (handles keys, CORS, caching)
  - `/api/triage` GPT-assisted issue classification
- Storage: S3/Blob + optional DB for service directory
- Deployment: Cloudflare Pages/Vercel for frontend, Azure Functions/Render/Fly.io for backend

## 9) Acceptance criteria (MVP)
- Selecting an issue returns at least 1 matching result (with demo dataset).
- App shows 2+ routes for driving and walking (when OSRM returns alternatives).
- PT mode shows in UI; if token not set, app explains how to enable.
- Route selection highlights route and zooms appropriately.

## 10) Risks & mitigations
- **Routing APIs rate limits / CORS** → server proxy + caching
- **Transit routing complexity** → OneMap token-based integration first; later host OTP.
- **Incorrect opening hours** → add a structured hours model + manual verification

## 11) Roadmap

### Phase 0 (done)
- Leaflet map, Singapore centering, mock dataset, route polylines, route list UI.

### Phase 1 (make it “live”)
- Create backend API + secrets management
- Replace mock dataset with real SG services
- Implement OneMap transit through backend proxy
- Add observability + rate limiting

### Phase 2 (impact)
- Add coverage heatmaps / justice deserts
- Add multilingual UI
- Add “next open” scheduling

