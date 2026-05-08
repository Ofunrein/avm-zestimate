# Austin AVM — AI Layer Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the Austin AVM from an ML engineering project to a full AI engineering product by adding LLM-powered explanations, natural language search, RAG neighborhood context, and an agentic deal monitor.

**Architecture:** Four subsystems layered on top of the existing XGBoost+LightGBM ensemble API (HuggingFace Spaces) + Next.js frontend (Vercel) + Supabase DB. All LLM calls use Claude Haiku (`claude-haiku-4-5`) via the Anthropic API. No vector DB — RAG uses ZIP-keyed context injection.

**Tech Stack:** Anthropic Python SDK, Claude Haiku, Redfin bulk CSV, GreatSchools API, Walk Score API, Census ACS API, Austin Open Data API, SendGrid (free tier), GitHub Actions cron.

---

## Subsystem 1: LLM SHAP Explanation

**What it does:** After every prediction, generate a 2-3 sentence plain English narrative explaining why the model valued the property the way it did, using the SHAP top-5 features and neighborhood context.

**API:** `POST /explain`

**Input:**
```json
{
  "predicted_price": 453235,
  "lower_bound": 398000,
  "upper_bound": 512000,
  "confidence_score": 82,
  "shap_top5": [
    {"feature": "sqft_living", "feature_value": 1850, "shap_value": 45000, "direction": "increases"},
    {"feature": "zip_median_price", "feature_value": 485000, "shap_value": 28000, "direction": "increases"},
    {"feature": "year_built", "feature_value": 1978, "shap_value": -18000, "direction": "decreases"},
    {"feature": "beds", "feature_value": 3, "shap_value": 8000, "direction": "increases"},
    {"feature": "has_pool", "feature_value": 0, "shap_value": -5000, "direction": "decreases"}
  ],
  "zip_code": "78704",
  "neighborhood_context": "Walk Score 89, school rating 8/10, median income $72k, low crime"
}
```

**Output:**
```json
{"explanation": "This 1,850 sqft home in 78704 is valued at $453k primarily because of its size (+$45k) and a strong ZIP median of $485k (+$28k). The 1978 build year slightly suppresses value (-$18k) and the absence of a pool costs another $5k. Confidence is high at 82% — the model predicts $398k–$512k with 90% probability."}
```

**Prompt template:**
```
You are a real estate analyst. Given SHAP feature contributions and neighborhood context, write a 2-3 sentence explanation of this Austin TX home valuation in plain English. Be specific about dollar amounts. End with a one-sentence market signal (strong buy / fair value / overpriced).

Property: {sqft} sqft, {beds}BR/{baths}BA, built {year}, ZIP {zip}
Predicted: ${price:,} (range: ${lower:,}–${upper:,}, {confidence}% confidence)
Key value drivers: {shap_top5_formatted}
Neighborhood: {neighborhood_context}
```

**Frontend:** `ExplanationCard` component renders below the SHAP waterfall on homepage. Auto-called client-side after `POST /predict` returns. Shows skeleton loader during fetch, then fades in.

**Model:** `claude-haiku-4-5`, max_tokens=150, temperature=0.3.

---

## Subsystem 2: Natural Language Search

**What it does:** User types a natural language query in a search bar on the homepage. Claude parses it into structured filters. API queries the `predictions` Supabase table and returns ranked results.

**Homepage change:** Search bar rendered above the prediction form. On submit, results grid replaces the form area. "← Value a specific property" link restores the form.

**API:** `POST /search`

**Input:** `{"query": "find undervalued 3BR under $400k in 78704 with a pool"}`

**Parsing prompt:**
```
Extract search parameters from this Austin TX real estate query. Return JSON only.
Schema: {"beds_min": int|null, "baths_min": float|null, "sqft_min": int|null, "sqft_max": int|null, "price_max": int|null, "zip_codes": [str]|null, "has_pool": bool|null, "undervalued_only": bool, "year_built_min": int|null}
Query: {query}
```

**Database query:** Filter `predictions` table by parsed params. Sort by `(predicted_price - list_price) / list_price DESC` when `undervalued_only=true`, else by `predicted_price DESC`. Return top 20.

**Output:** Array of prediction records with address, predicted_price, list_price (if available), value_gap_pct, confidence_score, shap_top_driver.

**Frontend:** `SearchBar` component (homepage, above form). `SearchResults` grid below — cards showing address, price, value gap badge, top SHAP driver. Clicking a card runs `/explain` and shows the explanation inline.

**Inventory seeding:** One-time + monthly refresh via `api/scripts/seed_inventory.py`:
- Download Redfin Austin bulk CSV from `https://www.redfin.com/news/data-center/` (Austin metro file)
- Parse: address, list_price, beds, baths, sqft, year_built, ZIP, lat, lng
- Batch predict via existing `/predict` endpoint
- Upsert into `predictions` table (dedupe by address)
- GitHub Actions workflow: `seed-inventory.yml`, runs monthly + on-demand

---

## Subsystem 3: RAG Neighborhood Context

**What it does:** For any ZIP code, fetch school ratings, walkability, income, and crime data. Cache in Supabase. Inject as text context into Claude prompts (explanation + search summaries).

**API:** `GET /neighborhood/{zip_code}`

**Data sources (all free):**

| Source | Data | API |
|--------|------|-----|
| Texas Education Agency (TEA) | School accountability ratings (A-F) | `tea.texas.gov` — free CSV download, no key |
| Walk Score | Walk/transit/bike scores | `api.walkscore.com` — free 5k/day |
| Census ACS | Median income, population density | `api.census.gov` — no key needed |
| Austin Open Data | Crime incidents by ZIP (last 12mo) | `data.austintexas.gov` — no key needed |

**Cache table:** `neighborhood_cache (cache_key text PK, data_json jsonb, created_at timestamptz)`

**TTL:** 30 days. On cache hit, return immediately. On miss, fetch all 4 sources in parallel, merge, store.

**Output format:**
```json
{
  "zip_code": "78704",
  "school_rating": "A",
  "walk_score": 89,
  "transit_score": 52,
  "bike_score": 71,
  "median_income": 72400,
  "population_density": 4200,
  "crime_incidents_per_1k": 18.3,
  "summary": "Walk Score 89 (Walker's Paradise), school rating A (TEA), median income $72k, below-average crime (18.3/1k)"
}
```

**Integration:** Called by `/explain` and `/search` to inject `summary` string into Claude prompts. If fetch fails, context is omitted gracefully (no 500).

**New file:** `api/services/neighborhood.py` — fetches + merges all 4 sources. `api/routers/neighborhood.py` — route handler with cache logic.

---

## Subsystem 4: Agentic Deal Monitor

**What it does:** Weekly automated agent that downloads current Austin listings from Redfin, runs batch predictions, identifies undervalued properties (predicted > list + 10%), optionally analyzes listing photos via Claude Vision, stores deals in Supabase, and sends email alerts.

**Data source:** Redfin Austin bulk download — free weekly CSV at `https://www.redfin.com/news/data-center/` (Austin metro). Contains: address, list_price, beds, baths, sqft, year_built, ZIP, lat, lng, photo_url.

**Monitor script:** `api/scripts/monitor.py`

```
1. Download Redfin Austin CSV (curl, no auth)
2. For each listing: call /predict endpoint
3. Compute value_gap_pct = (predicted - list) / list * 100
4. Filter: value_gap_pct > 10% AND confidence_score >= 70
5. For top 20 deals: fetch listing photo URL → POST to Claude Vision
   - Prompt: "Describe the condition and notable features of this Austin TX home listing photo in 1 sentence."
   - Appends condition_note to deal record (model: `claude-haiku-4-5` with vision, max_tokens=80)
6. Upsert into `deals` table
7. For deals with value_gap_pct > 15%: send SendGrid email
```

**Deals table schema:**
```sql
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  address text,
  zip_code text,
  list_price integer,
  predicted_price integer,
  value_gap_pct numeric,
  confidence_score integer,
  beds integer,
  baths_full numeric,
  sqft_living numeric,
  year_built integer,
  photo_url text,
  condition_note text,
  shap_top_driver text,
  deal_score numeric,  -- value_gap_pct * confidence_score / 100
  alerted_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_deals_created on deals(created_at desc);
create index if not exists idx_deals_gap on deals(value_gap_pct desc);
```

**Email:** SendGrid free tier (100/day). Template: subject "🏠 {N} Austin deals found", body lists top 5 with address, gap%, predicted vs list.

**GitHub Actions:** `.github/workflows/deal-monitor.yml` — cron `0 8 * * 1` (Monday 8am UTC). Secrets: `ANTHROPIC_API_KEY`, `SENDGRID_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `ALERT_EMAIL`.

**Frontend:** `/deals` page in Next.js.
- Header: "This Week's Deals — {N} undervalued Austin properties"
- Filter bar: ZIP, min gap%, min confidence
- Deal cards: address, photo, predicted vs list, gap badge, condition note, SHAP top driver
- Refreshes weekly (static ISR, revalidate 3600)

---

## New Supabase Tables

```sql
-- neighborhood context cache
create table if not exists neighborhood_cache (
  cache_key text primary key,
  data_json jsonb not null,
  created_at timestamptz default now()
);

-- deal monitor results
create table if not exists deals (
  -- (see schema above)
);

create index if not exists idx_neighborhood_created on neighborhood_cache(created_at desc);
```

---

## Environment Variables

| Variable | Where | Used by |
|----------|-------|---------|
| `ANTHROPIC_API_KEY` | HF Space secret + GitHub Actions | All LLM calls |
| `TEA_DATA_URL` | hardcoded in service | TEA school ratings CSV (no key, static URL) || `WALKSCORE_API_KEY` | HF Space secret | Neighborhood service |
| `SENDGRID_API_KEY` | GitHub Actions secret | Deal monitor alerts |
| `ALERT_EMAIL` | GitHub Actions secret | SendGrid recipient |

---

## File Map

**New API files:**
- `api/services/llm.py` — Claude Haiku client, `explain()` and `parse_search_query()` functions
- `api/services/neighborhood.py` — parallel fetch from 4 sources, merge, format summary
- `api/routers/explain.py` — `POST /explain`
- `api/routers/search.py` — `POST /search`
- `api/routers/neighborhood.py` — `GET /neighborhood/{zip_code}`
- `api/routers/deals.py` — `GET /deals` with filters
- `api/scripts/seed_inventory.py` — Redfin CSV → batch predict → upsert predictions
- `api/scripts/monitor.py` — weekly deal monitor agent

**Modified API files:**
- `api/main.py` — register 4 new routers
- `api/requirements.txt` — add `anthropic`, `sendgrid`, `httpx`
- `api/schemas.py` — add `ExplainRequest`, `ExplainResponse`, `SearchRequest`, `SearchResponse`, `NeighborhoodResponse`, `DealResponse`

**New web files:**
- `web/components/SearchBar.tsx` — NL search input with loading state
- `web/components/SearchResults.tsx` — results grid, deal badges, inline explanation
- `web/components/ExplanationCard.tsx` — AI narrative below SHAP waterfall
- `web/components/NeighborhoodCard.tsx` — school/walk/income/crime summary card
- `web/components/DealCard.tsx` — deal monitor card with photo + condition note
- `web/app/deals/page.tsx` — /deals dashboard with filter bar

**Modified web files:**
- `web/app/page.tsx` — add SearchBar above form, add ExplanationCard below results

**GitHub Actions:**
- `.github/workflows/deal-monitor.yml` — weekly Monday cron
- `.github/workflows/seed-inventory.yml` — monthly + on-demand

**Supabase:**
- `supabase/schema.sql` — add `neighborhood_cache` and `deals` tables
