# FIFA World Cup 2026 — Live Scores & Monte Carlo Forecast

A fast, static web app that shows **live World Cup 2026 scores** alongside a **probabilistic forecast** of how the tournament will unfold — champion odds, round-by-round advancement, a most-likely bracket, Round-of-32 matchup projections, and per-match predictions blended with bookmaker odds.

No backend server. Live scores come straight from a public feed in the browser; the heavy simulation runs in CI and ships its results as static JSON.

> **Not affiliated with FIFA.** Ratings, odds and predictions are independent estimates for entertainment.

---

## Features

- **Live scores & goals** — from the public ESPN scoreboard, polled every ~10s, with goalscorers, cards and the match clock.
- **Group tables** — computed live from results; qualification marked only once a group is mathematically decided.
- **Championship forecast** — Monte Carlo probabilities for every team to win its group, reach each round, and lift the trophy, plus the change since the pre-tournament baseline.
- **Round-of-32 projection** — from the current standings: the most likely knockout ties (how often each exact pairing forms), and each top contender's most likely R32 opponent. Sharpens after every match and locks to 100% once the group stage ends.
- **Next-match predictions** — model 1X2 (home/draw/away) probabilities blended with bookmaker odds.
- **Most Likely Outcome** — a deterministic favourites-advance bracket, recomputed live from the latest results.
- **Roll the dice** — sample an alternative but plausible tournament (upset-damped) on demand.

---

## How it works

```
ESPN scoreboard ─┐                          ┌─► Live overlay (browser, ~10s polling)
                 ├─► GitHub Actions job ─────┤
The Odds API ────┘   (Monte Carlo, every     └─► frontend/public/data/*.json ─► Vercel (static site)
                      5 min, odds cached)
```

1. **Data fetch** — the job reads fixtures, results and live ratings from the [ESPN public scoreboard](https://www.espn.com/) (no key) and bookmaker odds from [The Odds API](https://the-odds-api.com/) (optional key).
2. **Simulation** — it runs a Monte Carlo of the remaining tournament, a Round-of-32 matchup projection, and a deterministic "most likely" prediction, then commits the results as JSON under `frontend/public/data/`.
3. **Delivery** — Vercel rebuilds the static site on every commit. The frontend reads the JSON and overlays live ESPN scores client-side, so scores stay current between simulation runs.
4. **No secret reaches the browser** — the Odds API key lives only in CI.

### The model

| Layer | What it does |
|-------|--------------|
| **Ratings** | Seeded with the official **FIFA / Coca-Cola World Ranking points**, updated in-tournament using FIFA's **SUM** method (importance `I` = 50 group / 60 knockout, expected result on the `/600` curve, no goal-difference term, penalty-shootout results). |
| **Match model** | **Dixon-Coles Poisson** — expected goals derived from the rating gap with a low-score correction; draws resolved via extra time then penalties. |
| **Forecast** | **Monte Carlo** (50,000 tournaments) producing per-team probabilities for each milestone. |
| **R32 projection** | The same simulation tallies, across all 16 R32 slots, how often each exact two-team pairing forms — using FIFA tiebreakers, the eight best third-placed teams, and the official **Annex C** assignment table. |
| **Market blend** | Bookmaker 1X2 and outright odds blended into the model (default **30% market / 70% model** in CI) for next-match and champion probabilities. |

---

## Repository layout

```
wc-2026/
├── shared/      Canonical TypeScript types + the official knockout bracket (single source of truth)
├── job/         Data-fetch + simulation (Node/TypeScript, runs in GitHub Actions)
│   └── src/
│       ├── adapters/    espn, odds-api, outrights-api, team-codes
│       ├── sim/         engine (Monte Carlo), poisson, predict, r32, bracket, tiebreakers, …
│       ├── ratings.ts   FIFA SUM rating updates
│       └── index.ts     pipeline entry point
├── frontend/    Vite + React + Tailwind static site (Scores · Groups · Forecast · Simulate)
│   └── public/data/     generated JSON artifacts (committed by the job)
└── .github/workflows/refresh.yml   scheduled fetch → simulate → commit
```

npm workspaces tie the three packages together.

### Generated data artifacts

| File | Contents |
|------|----------|
| `fixtures.json` | Teams (with ratings) + full match schedule |
| `scores.json` | Recent / live / upcoming matches |
| `standings.json` | Group standings |
| `forecast.json` | Monte Carlo probabilities per team (+ pre-tournament baseline) |
| `r32.json` | Round-of-32 projection — most-likely ties + top contenders' likely opponents |
| `prediction.json` | Deterministic full-tournament prediction |
| `upcoming.json` | Next matches with model + market 1X2 |
| `meta.json` | Snapshot timestamp, sim count, seed |

---

## Refresh pipeline

The workflow runs **every 5 minutes** but is designed to be cheap and quota-friendly:

- It **exits early** unless a match result has changed (detected from ESPN) **or** the cached odds are stale (older than `ODDS_TTL_HOURS`).
- Odds are fetched from The Odds API **only when the cache is stale (~3×/day)** and cached privately (via GitHub Actions cache) for reuse. Match-driven re-runs use the cached odds — **no API call**.
- A run commits `frontend/public/data/*.json` only when something actually changed, which triggers a Vercel deploy.

Result: the forecast and R32 projection refresh within ~5 min of any match finishing, while Odds API usage stays around **~180 requests/month** (within the free 500/month tier).

---

## Local development

Requires **Node 20+**.

```bash
# 1. Install all workspaces
npm install

# 2. Generate data (fetches live ESPN; Odds API optional)
npm run simulate

# 3. Run the dev server → http://localhost:5173
npm run dev
```

To enable odds blending locally, create a `.env` in the repo root:

```ini
ODDS_API_KEY=your_the_odds_api_key   # optional — without it the model runs odds-free
```

Other useful scripts:

```bash
npm test            # job unit tests (vitest)
npm run typecheck   # typecheck all three packages
npm run build       # production build of the frontend → dist/
```

---

## Configuration

All knobs are environment variables read by the job (defaults in `job/src/config.ts`).

| Variable | Default | Description |
|----------|---------|-------------|
| `SIM_COUNT` | `10000` (CI: `50000`) | Monte Carlo iterations |
| `SIM_SEED` | timestamp | Fixed integer for reproducible runs |
| `MODEL_TYPE` | `poisson` | Match model (`poisson` \| `elo`) |
| `BASE_GOALS_RATE` | `1.25` | Baseline expected goals per team |
| `KO_GOALS_MULTIPLIER` | `0.85` | Knockout-stage goal-rate multiplier |
| `FORM_VOLATILITY` | `0.05` | Per-iteration "good/bad day" strength noise |
| `ELO_REGRESSION` | `1.0` | Shrink ratings toward the mean (`1.0` = none) |
| `BLEND_ODDS_WEIGHT` | `0.6` (CI: `0.3`) | Market weight for per-match odds |
| `OUTRIGHT_ODDS_WEIGHT` | `0.6` (CI: `0.3`) | Market weight for champion odds |
| `ODDS_API_KEY` | — | [The Odds API](https://the-odds-api.com/) key (optional) |
| `ODDS_TTL_HOURS` | `7.5` | How long cached odds are reused before re-fetch |
| `ODDS_CACHE` | `job/.cache/odds.json` | Cached-odds path |
| `OUTPUT_DIR` | `frontend/public/data` | Where artifacts are written |

### Secrets (GitHub → Settings → Secrets and variables → Actions)

| Secret | Required | Purpose |
|--------|----------|---------|
| `ODDS_API_KEY` | Optional | Enables bookmaker-odds blending. Without it the app runs model-only. |

Live scores need **no key** (ESPN is public). Odds are used only to derive blended probabilities — raw odds are never published.

---

## Deployment

- **Simulation:** GitHub Actions (`refresh.yml`) on the schedule above; commits data to `master`.
- **Hosting:** Vercel, auto-deploying on every push (`npm run build` → `dist/`).

---

## Notes & limitations

- **Forecast vs. live** — the Forecast and R32 projection update on the refresh cycle (~5 min), whereas Scores, Groups and the Simulate "Most Likely Outcome" reflect live ESPN results immediately.
- **R32 convergence** — projected pairings sharpen with every result and reach 100% once the group stage is complete; the only residual uncertainty is FIFA's drawing of lots for teams level on every tiebreaker.
- **Annex C accuracy** — the Round-of-32 third-placed assignment (all 495 group combinations of which eight thirds qualify and which slot each fills) matches FIFA's published regulations exactly.

---

## Tech stack

TypeScript · React · Vite · Tailwind CSS · Node · GitHub Actions · Vercel · ESPN public API · The Odds API.

---

## License

MIT.
