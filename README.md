# FIFA World Cup 2026 – Live Scores & Monte Carlo Forecast

A static site that shows live WC 2026 scores and produces probabilistic knockout forecasts via Monte Carlo simulation. No backend server required.

## Architecture

```
wc-2026/
├── shared/          Canonical TypeScript types (shared between job and frontend)
├── job/             Data-fetch + simulation job (Node, runs in GitHub Actions)
├── frontend/        Vite + React + Tailwind static site
└── .github/workflows/refresh.yml  Scheduled cron – fetches, simulates, commits, deploys
```

**Data flow:**
1. The scheduled GitHub Actions job calls the configured data adapter(s), runs the Monte Carlo simulation, and **commits** `frontend/public/data/*.json`.
2. The static frontend reads those JSON files. It polls `scores.json` and `forecast.json` every 60 s so the page updates without a rebuild.
3. No API key ever reaches the browser.

---

## Quick start

### View locally (no API key needed)

```bash
npm install
npm run simulate:mock   # generates data from mock dataset
npm run dev             # serves the frontend at http://localhost:5173
```

### Run the full simulation with live APIs

```bash
cp .env.example .env
# Edit .env: add API_FOOTBALL_KEY at minimum
npm run simulate        # fetches live data and writes frontend/public/data/
npm run dev
```

---

## Required secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `API_FOOTBALL_KEY` | Yes (live) | Key for [api-football.com](https://www.api-football.com/). Free tier: ~100 req/day. |
| `ODDS_API_KEY` | No | [the-odds-api.com](https://the-odds-api.com/) – enables market-probability blending. |
| `SIM_SEED` | No | Fixed integer seed for reproducible simulations. Leave blank for timestamp-seeded runs. |

Set these in **GitHub → Settings → Secrets → Actions** before enabling the workflow.

---

## Confirming provider IDs

API-Football assigns league IDs dynamically. Before the tournament, verify:

```bash
curl -s "https://v3.football.api-sports.io/leagues?type=cup&name=World+Cup" \
  -H "x-apisports-key: $API_FOOTBALL_KEY" \
  | jq '.response[].league | {id, name, year}'
```

Set `API_FOOTBALL_LEAGUE_ID` in `.env` (or the GitHub secret) to the confirmed value.

---

## Changing data providers

All providers implement the `TournamentAdapter` interface in [job/src/adapters/interface.ts](job/src/adapters/interface.ts). To swap providers:

1. Create a new file in `job/src/adapters/` implementing `TournamentAdapter`.
2. Update the provider selection in [job/src/index.ts](job/src/index.ts).
3. The simulation and frontend require no changes.

---

## Tournament rules implemented

| Rule | File | Notes |
|------|------|-------|
| Group tiebreakers (points → GD → GF → H2H → lots) | [job/src/sim/tiebreakers.ts](job/src/sim/tiebreakers.ts) | Matches FIFA WC 2022 regulations Art. 20. Verify against 2026 regulations when published. |
| Best 8 third-placed teams | [job/src/sim/best-third.ts](job/src/sim/best-third.ts) | Ranked by points, GD, GF, then lots |
| R32 bracket mapping | [job/src/sim/bracket.ts](job/src/sim/bracket.ts) | **⚠ Provisional** – update from official FIFA bracket graphic once published |

---

## Prediction model

**Default: Independent Poisson**

```
homeXG = BASE_GOALS × (homeAttack / awayDefense) × hostMultiplier
awayXG = BASE_GOALS × (awayAttack / homeDefense)
homeGoals ~ Poisson(homeXG)
awayGoals ~ Poisson(awayXG)
```

Attack/defense ratings are derived from Elo, seeded at 1500 and updated after each finished match. `HOST_ADJUSTMENT` (default 1.08) is applied for USA, Canada, and Mexico.

Knockout ties go to extra time (30% of normal-time scoring rate), then penalty shoot-out (50-50 with small Elo skew).

**Alternative: Elo win/draw/loss** – set `MODEL_TYPE=elo` in `.env`.

**Reproducibility:** pass `SIM_SEED=<integer>` to get identical results for the same data snapshot.

---

## Deploy

### GitHub Pages

1. Fork/clone this repo.
2. Add the required secrets.
3. Enable **GitHub Pages** from `gh-pages` branch or `main/docs` (configure to match `deploy` job in workflow).
4. Push to `main` – the workflow runs the job, commits JSON, builds frontend, and deploys.

### Netlify / Vercel / Cloudflare Pages

- Build command: `npm run build`
- Publish directory: `frontend/dist`
- For Cloudflare Pages with 1-minute granularity: adapt `job/src/index.ts` to write to **Cloudflare KV / R2** instead of the filesystem, and deploy the job as a **Cron Trigger Worker**.

---

## Development scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server (reads committed JSON) |
| `npm run simulate` | Fetch live data + run simulation (needs `API_FOOTBALL_KEY`) |
| `npm run simulate:mock` | Run simulation with mock data (no keys needed) |
| `npm run test` | Run unit tests for tiebreakers, Poisson model, etc. |
| `npm run build` | Build production frontend |

---

## Notes & open questions

- **R32 bracket mapping** – The exact slot assignments for group positions and best-third-placed teams are provisional. Verify `job/src/sim/bracket.ts` against the official FIFA WC 2026 bracket before launch. Flag any discrepancy.
- **openfootball 2026 data** – The adapter fetches from the `master` branch. If the file doesn't exist yet, the job falls back to API-Football. Once openfootball publishes 2026 data, fixtures will auto-populate.
- **Third-placed team assignment** – FIFA's assignment table for which of the best-8 third-placed teams fills which R32 slot (based on the combination of groups they came from) is not yet published. Tracked as TODO in `bracket.ts`.
