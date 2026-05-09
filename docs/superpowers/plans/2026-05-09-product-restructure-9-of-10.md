# Austin Housing Intelligence — 9/10 Product Restructure Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the app from a "many features at once" dashboard into a clean three-mode product: Value a Property · Browse Opportunities · Upload Listings.

**Architecture:** The homepage gets one address input + three mode tabs. Each mode shows only what it needs. `/deals` → `/opportunities`, `/scanner` → `/upload`. The API gets `/opportunities` as the canonical endpoint (renamed from `/deals`). Three new canvas components (ValueCanvas, BrowseCanvas, UploadCanvas) extract mode logic from the 200-line page.tsx monolith. Source chips ("HISTORICAL", "CACHED", "UPLOAD") appear on every opportunity/search card.

**Tech Stack:** Next.js 14 (App Router, Server + Client Components), TypeScript, FastAPI, Pydantic v2, Supabase Postgres, CSS vars (globals.css), existing component library in `web/components/`

---

## File Map

**Create:**
- `web/app/opportunities/page.tsx` — renamed from deals (full rewrite of content)
- `web/app/upload/page.tsx` — renamed from scanner (content migration)
- `web/components/ValueCanvas.tsx` — property valuation mode UI
- `web/components/BrowseCanvas.tsx` — NL search + ranked results mode UI
- `web/components/UploadCanvas.tsx` — CSV upload + scoring mode UI
- `web/components/OpportunityCard.tsx` — renamed/updated from DealCard

**Modify:**
- `web/app/page.tsx` — full rewrite: hero + mode tabs + trust strip
- `web/app/layout.tsx` — nav links updated, title updated
- `web/lib/api.ts` — rename DealItem→OpportunityItem, getDeals→getOpportunities, add `data_source` field
- `api/routers/deals.py` — add `/opportunities` route alias, rename primary path
- `api/main.py` — register updated router
- `web/components/SearchResults.tsx` — add source chip per result card

**Delete (after content migrated):**
- `web/app/deals/` directory
- `web/app/scanner/` directory
- `web/components/DealCard.tsx` (replaced by OpportunityCard.tsx)

---

## Task 1: Rename /deals → /opportunities everywhere

**Files:**
- Delete: `web/app/deals/page.tsx`
- Create: `web/app/opportunities/page.tsx`
- Create: `web/components/OpportunityCard.tsx`
- Modify: `web/app/layout.tsx:19`
- Modify: `web/lib/api.ts` (DealItem, getDeals)
- Modify: `api/routers/deals.py`
- Modify: `api/main.py`

- [ ] **Step 1: Add /opportunities route to API router**

Replace entire `api/routers/deals.py`:

```python
from fastapi import APIRouter, Query
from api.schemas import DealResponse
from api.db import db

router = APIRouter()


@router.get("/opportunities", response_model=list[DealResponse])
@router.get("/deals", response_model=list[DealResponse], include_in_schema=False)
def get_opportunities(
    limit: int = Query(default=20, le=100),
    min_gap: float = Query(default=0.0),
):
    if not db:
        return []
    q = (
        db.table("deals")
        .select("*")
        .gte("value_gap_pct", min_gap)
        .order("deal_score", desc=True)
        .limit(limit)
    )
    rows = q.execute().data
    return [DealResponse(**r) for r in rows]
```

- [ ] **Step 2: Verify api/main.py still imports deals router correctly**

Open `api/main.py`. The import is `from api.routers import ... deals`. No change needed — the router object stays the same, only the route path changed. Confirm the file still has `app.include_router(deals.router, tags=["deals"])`.

- [ ] **Step 3: Update frontend API client**

In `web/lib/api.ts`, make these exact changes:

Find and replace `DealItem` → `OpportunityItem` (all occurrences).
Find and replace `getDeals` → `getOpportunities` (function name + export).
Add `data_source` field to the interface.
Change the fetch URL from `/deals` to `/opportunities`.

Exact replacements in `web/lib/api.ts`:

```typescript
// Replace DealItem interface:
export interface OpportunityItem {
  id: string;
  address?: string;
  zip_code?: string;
  list_price?: number;
  predicted_price: number;
  value_gap_pct: number;
  confidence_score: number;
  beds?: number;
  baths_full?: number;
  sqft_living?: number;
  year_built?: number;
  photo_url?: string;
  condition_note?: string;
  shap_top_driver?: string;
  deal_score?: number;
  data_source?: string;
  created_at?: string;
}

// Replace getDeals function:
export async function getOpportunities(params?: {
  limit?: number;
  min_gap?: number;
}): Promise<OpportunityItem[]> {
  const url = new URL(`${API_BASE}/opportunities`);
  if (params?.limit)   url.searchParams.set("limit",   String(params.limit));
  if (params?.min_gap) url.searchParams.set("min_gap", String(params.min_gap));
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error("opportunities fetch failed");
  return res.json();
}
```

- [ ] **Step 4: Create OpportunityCard component**

Create `web/components/OpportunityCard.tsx`:

```tsx
import { OpportunityItem } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function SourceChip({ source }: { source?: string }) {
  const label = !source || source === "kaggle_historical" ? "HISTORICAL"
    : source === "active_listing" ? "LIVE SAMPLE"
    : source === "upload" ? "UPLOAD"
    : "CACHED";
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.12em", textTransform: "uppercase",
      padding: "2px 7px",
      background: label === "LIVE SAMPLE" ? "rgba(79,179,165,0.12)" : "var(--bg-3)",
      color: label === "LIVE SAMPLE" ? "var(--teal)" : "var(--mute)",
      border: `1px solid ${label === "LIVE SAMPLE" ? "var(--teal)" : "var(--line-2)"}`,
    }}>
      {label}
    </span>
  );
}

export function OpportunityCard({ item }: { item: OpportunityItem }) {
  const gap = item.value_gap_pct;
  const isHot = gap >= 20;
  const filled = Math.round((item.confidence_score / 100) * 14);

  return (
    <div className="panel tick-corners" style={{ overflow: "hidden" }}>
      <div className="panel-head">
        <div className="panel-dot" style={isHot ? { background: "var(--gold)" } : {}} />
        <span className="panel-label" style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {(item.address || "ADDR UNKNOWN").toUpperCase()}
        </span>
        <span style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
        }}>
          <SourceChip source={item.data_source} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
            color: "#fff", background: isHot ? "var(--gold)" : "var(--mute-2)",
            padding: "2px 8px", letterSpacing: "0.06em",
          }}>
            +{gap.toFixed(1)}%
          </span>
        </span>
      </div>
      <div style={{ padding: "14px 14px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 4 }}>HISTORICAL PRICE</div>
            <div className="t-mono" style={{ fontSize: 15, color: "var(--ink-2)" }}>
              {item.list_price ? fmt(item.list_price) : "—"}
            </div>
          </div>
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 4 }}>AVM ESTIMATE</div>
            <div className="t-mono" style={{ fontSize: 15, color: "var(--gold)", fontWeight: 600 }}>
              {fmt(item.predicted_price)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          {item.zip_code    && <span className="t-eyebrow">{item.zip_code}</span>}
          {item.beds   != null && <span className="t-eyebrow">{item.beds}BD</span>}
          {item.baths_full != null && <span className="t-eyebrow">{item.baths_full}BA</span>}
          {item.sqft_living != null && <span className="t-eyebrow">{item.sqft_living.toLocaleString()}SF</span>}
        </div>
        {item.condition_note && (
          <p className="t-mono" style={{ fontSize: 11, color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.5, borderLeft: "2px solid var(--line-2)", paddingLeft: 8 }}>
            &quot;{item.condition_note}&quot;
          </p>
        )}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span className="t-eyebrow">CONFIDENCE</span>
            <span className="t-mono" style={{ fontSize: 10, color: "var(--gold)", fontWeight: 600 }}>{item.confidence_score}%</span>
          </div>
          <div className="conf-segments">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className={`conf-seg${i < filled ? " on" : ""}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create /opportunities page**

Create `web/app/opportunities/page.tsx`:

```tsx
import { getOpportunities } from "@/lib/api";
import { OpportunityCard } from "@/components/OpportunityCard";

export const revalidate = 3600;

export default async function OpportunitiesPage() {
  let items;
  try {
    items = await getOpportunities({ limit: 50 });
  } catch {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "32px 28px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <a href="/" className="btn-ghost" style={{ display: "inline-block", marginBottom: 24 }}>← BACK</a>
          <p className="t-mono" style={{ color: "var(--red)", fontSize: 12 }}>ERR · COULD NOT LOAD OPPORTUNITIES · CHECK API CONNECTION</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "32px 28px 64px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <a href="/" className="btn-ghost" style={{ display: "inline-block", marginBottom: 24 }}>← BACK</a>
        <div style={{ marginBottom: 28 }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>
            RESEARCH VIEW · HISTORICAL SALES BACKTEST · AUSTIN TX
          </div>
          <h1 className="t-display" style={{ fontSize: 36, margin: "0 0 8px", color: "var(--ink)" }}>
            Market <span style={{ color: "var(--gold)" }}>Opportunity</span> Analysis
          </h1>
          <div className="t-mono" style={{ fontSize: 12, color: "var(--mute)" }}>
            {items.length} PROPERTIES · MODEL ESTIMATE VS HISTORICAL SALE PRICE · KAGGLE 2018–2021
          </div>
          <div className="t-mono" style={{ fontSize: 11, color: "var(--gold)", marginTop: 8, padding: "6px 10px", background: "rgba(176,122,16,0.08)", borderLeft: "2px solid var(--gold)" }}>
            HISTORICAL DATA ONLY — NOT LIVE LISTINGS · FOR RESEARCH &amp; PORTFOLIO USE
          </div>
        </div>

        {items.length === 0 ? (
          <div className="panel" style={{ padding: "48px 32px", textAlign: "center" }}>
            <div className="t-eyebrow" style={{ marginBottom: 12 }}>NO DATA FOUND</div>
            <p className="t-mono" style={{ fontSize: 12, color: "var(--mute)" }}>
              BACKTEST RUNS WEEKLY · GITHUB ACTIONS · MONDAY 08:00 UTC
            </p>
          </div>
        ) : (
          <div className="grid-deals">
            {items.map((item) => (
              <OpportunityCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Update nav in layout.tsx**

In `web/app/layout.tsx`, change `NAV_LINKS` to:

```typescript
const NAV_LINKS = [
  { href: "/",              label: "VALUATION" },
  { href: "/opportunities", label: "OPPORTUNITIES" },
  { href: "/upload",        label: "UPLOAD" },
  { href: "/benchmark",     label: "BENCHMARK" },
  { href: "/model-card",    label: "MODEL CARD" },
];
```

Also update the title and brand name in `layout.tsx`:

```typescript
// Change brand "AVM" span to:
<span className="t-display" style={{ fontSize: 13, color: "var(--gold)", letterSpacing: "0.08em", flexShrink: 0 }}>
  AUSTIN AVM
</span>

// Change <title> to:
<title>Austin Housing Intelligence — AVM</title>
// Change description to:
<meta name="description" content="Explainable automated valuation model for Austin TX real estate" />
```

- [ ] **Step 7: Delete old deals files**

```bash
rm -rf /Users/martinofunrein/Downloads/avm-zestimate/web/app/deals
rm /Users/martinofunrein/Downloads/avm-zestimate/web/components/DealCard.tsx
```

- [ ] **Step 8: Build check**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate/web && npm run build
```

Expected: PASS with `/opportunities` in route list, no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: rename /deals→/opportunities, add OpportunityCard with source chip, update nav"
```

---

## Task 2: Rename /scanner → /upload + create UploadCanvas component

The scanner functionality moves to `/upload` as a page AND to a reusable `UploadCanvas` component that can be embedded in the homepage.

**Files:**
- Create: `web/app/upload/page.tsx`
- Create: `web/components/UploadCanvas.tsx`
- Delete: `web/app/scanner/page.tsx`

- [ ] **Step 1: Create UploadCanvas component**

Create `web/components/UploadCanvas.tsx`:

```tsx
"use client";
import { useState } from "react";
import Papa from "papaparse";
import { scanProperties, PropertyInput, PropertyScanResult } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function UploadCanvas() {
  const [results, setResults] = useState<PropertyScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setError(null);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      complete: async (parsed) => {
        try {
          const properties = (parsed.data as Record<string, unknown>[]).filter(
            (r) => r.sqft_living && r.list_price
          ) as unknown as Array<PropertyInput & { list_price: number }>;
          if (properties.length === 0) {
            setError("No valid rows found. CSV needs sqft_living and list_price columns.");
            setLoading(false);
            return;
          }
          const scan = await scanProperties(properties);
          setResults(scan);
        } catch {
          setError("Scan failed — check API connection.");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <div style={{ padding: "20px 20px 24px" }}>
      <div className="panel-head" style={{ margin: "-20px -20px 20px", padding: "12px 20px" }}>
        <div className="panel-dot" />
        <span className="panel-label">UPLOAD LISTINGS CSV</span>
        <span className="panel-meta" style={{ marginLeft: "auto" }}>
          REQUIRED COLUMNS: sqft_living, beds, baths_full, year_built, zip_code, lat, lng, list_price
        </span>
      </div>

      <label style={{ display: "block", cursor: "pointer" }}>
        <div style={{
          border: "2px dashed var(--line-2)",
          padding: "32px",
          textAlign: "center",
          background: "var(--bg-2)",
          transition: "border-color .15s",
        }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>
            {loading ? "PROCESSING…" : fileName ? `LOADED: ${fileName}` : "DROP CSV HERE OR CLICK TO BROWSE"}
          </div>
          <div className="t-mono" style={{ fontSize: 11, color: "var(--mute)" }}>
            Each row = one property. Scored and ranked by model estimate vs list price.
          </div>
        </div>
        <input
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleFile}
          disabled={loading}
        />
      </label>

      {error && (
        <div className="t-mono" style={{ fontSize: 12, color: "var(--red)", marginTop: 12 }}>
          ERR · {error}
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="t-eyebrow">{results.length} PROPERTIES SCORED</span>
            <span className="t-mono" style={{ fontSize: 11, color: "var(--mute)" }}>SORTED BY VALUE GAP</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="term">
              <thead>
                <tr>
                  <th>#</th>
                  <th>ZIP</th>
                  <th>SQFT</th>
                  <th className="num">LIST PRICE</th>
                  <th className="num">AVM ESTIMATE</th>
                  <th className="num">GAP</th>
                  <th>TOP DRIVER</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.index}>
                    <td className="t-mono">{i + 1}</td>
                    <td className="t-mono">—</td>
                    <td className="t-mono">—</td>
                    <td className="t-mono num">{fmt(r.list_price)}</td>
                    <td className="t-mono num" style={{ color: "var(--gold)" }}>{fmt(r.predicted_price)}</td>
                    <td className="t-mono num" style={{ color: r.value_gap_pct > 0 ? "var(--teal)" : "var(--red)", fontWeight: 700 }}>
                      {r.value_gap_pct > 0 ? "+" : ""}{r.value_gap_pct.toFixed(1)}%
                    </td>
                    <td className="t-mono" style={{ color: "var(--mute)" }}>{r.shap_top_driver || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create /upload page**

Create `web/app/upload/page.tsx`:

```tsx
import { UploadCanvas } from "@/components/UploadCanvas";

export default function UploadPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "32px 28px 64px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <a href="/" className="btn-ghost" style={{ display: "inline-block", marginBottom: 24 }}>← BACK</a>
        <div style={{ marginBottom: 24 }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>LISTING ANALYSIS · CSV UPLOAD</div>
          <h1 className="t-display" style={{ fontSize: 36, margin: "0 0 8px", color: "var(--ink)" }}>
            Upload <span style={{ color: "var(--gold)" }}>Listings</span>
          </h1>
          <p className="t-mono" style={{ fontSize: 12, color: "var(--mute)" }}>
            Score your own listing CSV. AVM predicts each property, ranks by model estimate vs list price.
          </p>
        </div>
        <div className="panel">
          <UploadCanvas />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Delete old scanner page**

```bash
rm -rf /Users/martinofunrein/Downloads/avm-zestimate/web/app/scanner
```

- [ ] **Step 4: Build check**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate/web && npm run build
```

Expected: PASS with `/upload` in route list, `/scanner` gone.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: rename /scanner→/upload, extract UploadCanvas component"
```

---

## Task 3: Rebuild homepage with mode tabs + address-first UI

The new homepage has: hero (title + tabs) → results canvas (changes per mode) → trust strip. The raw 8-field form moves behind a "manually enter property details" toggle. Browse mode and Upload mode are now proper tabs.

**Files:**
- Rewrite: `web/app/page.tsx`
- Create: `web/components/ValueCanvas.tsx`
- Create: `web/components/BrowseCanvas.tsx`

- [ ] **Step 1: Create ValueCanvas component**

Create `web/components/ValueCanvas.tsx`:

```tsx
"use client";
import { useState } from "react";
import { predict, getComps, PredictionResponse, CompProperty } from "@/lib/api";
import { PredictionCard } from "@/components/PredictionCard";
import { ShapWaterfall } from "@/components/ShapWaterfall";
import { CompsTable } from "@/components/CompsTable";
import { ExplanationCard } from "@/components/ExplanationCard";

const DEFAULT_FORM = {
  sqft_living: 1800, beds: 3, baths_full: 2, baths_half: 0,
  year_built: 2005, zip_code: "78701", lat: 30.27, lng: -97.74,
  lot_sqft: 5000, garage_spaces: 1, has_pool: 0, assessed_value: 0,
};

const FIELDS: Array<[keyof typeof DEFAULT_FORM, string, string]> = [
  ["sqft_living", "LIVING SQFT",  "number"],
  ["lot_sqft",    "LOT SQFT",     "number"],
  ["beds",        "BEDS",         "number"],
  ["baths_full",  "FULL BATHS",   "number"],
  ["year_built",  "YEAR BUILT",   "number"],
  ["zip_code",    "ZIP CODE",     "text"],
  ["lat",         "LATITUDE",     "number"],
  ["lng",         "LONGITUDE",    "number"],
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function ValueCanvas() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [showManual, setShowManual] = useState(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [comps, setComps] = useState<CompProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const [pred, compsData] = await Promise.all([
        predict(form),
        getComps(form.lat, form.lng, form.sqft_living, form.beds, form.baths_full, form.year_built),
      ]);
      setResult(pred);
      setComps(compsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="panel-head">
        <div className="panel-dot" />
        <span className="panel-label">VALUE A PROPERTY</span>
        <span className="panel-meta" style={{ marginLeft: "auto" }}>
          AUSTIN TX · XGB + LGB ENSEMBLE
        </span>
      </div>
      <div style={{ padding: "20px 20px 24px" }}>
        <form onSubmit={handleSubmit}>
          {/* Manual fields toggle */}
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowManual(v => !v)}
              className="btn-ghost"
              style={{ fontSize: 11 }}
            >
              {showManual ? "▾ HIDE PROPERTY DETAILS" : "▸ ENTER PROPERTY DETAILS MANUALLY"}
            </button>
          </div>

          {showManual && (
            <div className="form-grid" style={{ marginBottom: 16 }}>
              {FIELDS.map(([key, label, type]) => (
                <div key={key}>
                  <div className="term-label">{label}</div>
                  <input
                    className="term-input"
                    type={type}
                    step={type === "number" ? "any" : undefined}
                    value={form[key]}
                    onChange={e => setForm(f => ({
                      ...f,
                      [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value,
                    }))}
                    required
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="btn-gold"
            disabled={loading}
            style={{ maxWidth: 320 }}
          >
            {loading ? "ESTIMATING…" : "ESTIMATE VALUE"}
          </button>
        </form>

        {error && (
          <div className="t-mono" style={{ fontSize: 12, color: "var(--red)", marginTop: 12 }}>
            ERR · {error.toUpperCase()}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
              <div className="panel" style={{ flex: 1, minWidth: 200, padding: "16px 20px" }}>
                <div className="t-eyebrow" style={{ marginBottom: 6 }}>AVM ESTIMATE</div>
                <div className="t-display glitch-in" style={{ fontSize: 32, color: "var(--gold)" }}>
                  {fmt(result.predicted_price)}
                </div>
                <div className="t-mono" style={{ fontSize: 11, color: "var(--mute)", marginTop: 4 }}>
                  {fmt(result.lower_bound)} – {fmt(result.upper_bound)} · {result.confidence_score}% confidence
                </div>
              </div>
              <PredictionCard result={result} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}>
              <ShapWaterfall features={result.shap_top5} />
              <ExplanationCard result={result} />
            </div>
            {comps.length > 0 && <CompsTable comps={comps} />}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create BrowseCanvas component**

Create `web/components/BrowseCanvas.tsx`:

```tsx
"use client";
import { useState } from "react";
import { searchProperties, SearchResult } from "@/lib/api";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";

export function BrowseCanvas() {
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q: string) => {
    setLoading(true);
    try {
      const resp = await searchProperties(q);
      setResults(resp.results);
      setTotal(resp.total);
      setQuery(q);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery(null);
    setResults([]);
    setTotal(0);
  };

  return (
    <div>
      <div className="panel-head">
        <div className="panel-dot" />
        <span className="panel-label">BROWSE MARKET OPPORTUNITIES</span>
        <span className="panel-meta" style={{ marginLeft: "auto" }}>HISTORICAL · 78 AUSTIN ZIPS</span>
      </div>
      <div style={{ padding: "20px 20px 24px" }}>
        <SearchBar onSearch={handleSearch} loading={loading} />
        {query ? (
          <SearchResults results={results} total={total} query={query} onClear={handleClear} />
        ) : (
          <div style={{ marginTop: 16 }}>
            <p className="t-mono" style={{ fontSize: 12, color: "var(--mute)", marginBottom: 12 }}>
              Natural language search across Austin properties. Try:
            </p>
            {[
              "3BR under $500k in 78744",
              "undervalued homes in 78750",
              "pool homes built after 2010",
            ].map(s => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                className="btn-ghost"
                style={{ display: "block", marginBottom: 8, fontSize: 11, textAlign: "left" }}
              >
                {s}
              </button>
            ))}
            <div style={{ marginTop: 16 }}>
              <a
                href="/opportunities"
                className="btn-ghost"
                style={{ display: "inline-block", fontSize: 11 }}
              >
                VIEW FULL OPPORTUNITY BOARD →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite homepage page.tsx**

Replace entire `web/app/page.tsx`:

```tsx
"use client";
import { useState, useEffect } from "react";
import { getBenchmark } from "@/lib/api";
import { ValueCanvas } from "@/components/ValueCanvas";
import { BrowseCanvas } from "@/components/BrowseCanvas";
import { UploadCanvas } from "@/components/UploadCanvas";

type Mode = "value" | "browse" | "upload";

const MODES: { id: Mode; label: string }[] = [
  { id: "value",  label: "Value a Property" },
  { id: "browse", label: "Browse Opportunities" },
  { id: "upload", label: "Upload Listings" },
];

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("value");
  const [stats, setStats] = useState({ medape: "—", nTest: "—" });

  useEffect(() => {
    getBenchmark().then(b => setStats({
      medape: b.test_medape != null ? `${b.test_medape.toFixed(2)}%` : "—",
      nTest:  b.n_test != null ? b.n_test.toLocaleString() : "—",
    })).catch(() => {});
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 28px 64px" }}>

        {/* ── Hero ───────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div className="t-eyebrow" style={{ marginBottom: 10 }}>
            AUSTIN HOUSING INTELLIGENCE · EXPLAINABLE AVM · AUSTIN TX
          </div>
          <h1 className="t-display" style={{ fontSize: 44, color: "var(--ink)", margin: "0 0 12px", lineHeight: 0.95 }}>
            Austin Housing<br />
            <span style={{ color: "var(--gold)" }}>Intelligence</span>
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--mute)", margin: "0 0 28px", maxWidth: 520 }}>
            Estimate one property, browse modeled market opportunities, or score your own listings.
          </p>

          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  padding: "10px 22px",
                  background: mode === m.id ? "var(--gold)" : "var(--bg-2)",
                  color: mode === m.id ? "#fff" : "var(--mute)",
                  border: `1.5px solid ${mode === m.id ? "var(--gold)" : "var(--line-2)"}`,
                  cursor: "pointer", transition: "all .12s",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Results canvas ─────────────────────────── */}
        <div className="panel" style={{ marginBottom: 32 }}>
          {mode === "value"  && <ValueCanvas />}
          {mode === "browse" && <BrowseCanvas />}
          {mode === "upload" && <UploadCanvas />}
        </div>

        {/* ── Trust strip ───────────────────────────── */}
        <div style={{
          display: "flex", gap: 32, flexWrap: "wrap",
          paddingTop: 18, borderTop: "1px solid var(--line)",
        }}>
          {[
            { label: "MEDAPE",     value: stats.medape, gold: true },
            { label: "TEST SET",   value: stats.nTest },
            { label: "ZIPS",       value: "38 Austin ZIPs" },
            { label: "MODEL",      value: "XGB + LGB Ensemble" },
            { label: "DATA MODE",  value: "Historical Backtest" },
          ].map(({ label, value, gold }) => (
            <div key={label}>
              <div className="t-eyebrow" style={{ marginBottom: 3 }}>{label}</div>
              <div className="t-mono" style={{ fontSize: 13, color: gold ? "var(--gold)" : "var(--ink-2)", fontWeight: 600 }}>
                {value}
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
```

- [ ] **Step 4: Build check**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate/web && npm run build
```

Expected: PASS. All three canvas components compile. No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: rebuild homepage with mode tabs (Value/Browse/Upload), address-first UI, trust strip"
```

---

## Task 4: Add source chips to SearchResults cards

SearchResults cards currently show no source badge. Every card must show where its data came from.

**Files:**
- Modify: `web/components/SearchResults.tsx`

- [ ] **Step 1: Add SourceChip helper to SearchResults**

Read `web/components/SearchResults.tsx`. Find the card `<div>` block (around line 32). Add a `SourceChip` function at the top of the file and render it inside each card.

Add this function before the `SearchResults` component:

```tsx
function SourceChip({ source }: { source?: string }) {
  const label = !source || source === "kaggle_historical" ? "HISTORICAL"
    : source === "active_listing" ? "LIVE SAMPLE"
    : "CACHED";
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.12em", textTransform: "uppercase",
      padding: "2px 7px",
      background: "var(--bg-3)",
      color: "var(--mute)",
      border: "1px solid var(--line-2)",
    }}>
      {label}
    </span>
  );
}
```

Inside the card loop, after the `address` paragraph and before the price div, add:

```tsx
<div style={{ marginBottom: 8 }}>
  <SourceChip source={(r as SearchResult & { data_source?: string }).data_source} />
</div>
```

Note: `SearchResult` type in `web/lib/api.ts` already has `neighborhood_summary?: string`. Add `data_source?: string` to the `SearchResult` interface.

In `web/lib/api.ts`, update `SearchResult`:

```typescript
export interface SearchResult {
  id: string;
  address?: string;
  zip_code?: string;
  sqft_living?: number;
  beds?: number;
  baths_full?: number;
  year_built?: number;
  predicted_price: number;
  list_price?: number;
  value_gap_pct?: number;
  confidence_score: number;
  shap_top_driver?: string;
  neighborhood_summary?: string;
  data_source?: string;
  created_at?: string;
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate/web && npm run build
```

Expected: PASS. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/SearchResults.tsx web/lib/api.ts
git commit -m "feat: add source chip (HISTORICAL/LIVE/CACHED) to search result cards"
```

---

## Task 5: Push to Vercel + HF Space + sync GitHub

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

Expected: PASS.

- [ ] **Step 2: Push to HF Space**

```bash
git push hf-space main
```

Expected: PASS. HF Space rebuild begins.

- [ ] **Step 3: Verify Vercel auto-deploys**

Vercel is connected to GitHub — a push to `origin main` triggers a Vercel deployment automatically. Check the Vercel dashboard at https://vercel.com/dashboard or run:

```bash
npx vercel ls --token <vercel_token>
```

- [ ] **Step 4: Smoke test live site**

After Vercel deploys (usually 1-2 min after GitHub push):

```bash
curl -s -o /dev/null -w "%{http_code}" https://austin-avm.vercel.app
# Expected: 200

curl -s -X POST "https://ofunrein-austin-avm-api.hf.space/opportunities" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'opportunities: {len(d)} items')"
# Expected: opportunities: N items
```

- [ ] **Step 5: Commit if anything needed**

```bash
git add -A && git status
# If clean: nothing to commit
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| Rename /deals → /opportunities | Task 1 |
| Source chips on cards | Tasks 1 + 4 |
| Rename /scanner → /upload | Task 2 |
| UploadCanvas component | Task 2 |
| Homepage mode tabs | Task 3 |
| Address-first UI (manual fields hidden) | Task 3 |
| Trust strip (4 stats) | Task 3 |
| ValueCanvas / BrowseCanvas extracted | Task 3 |
| SearchResults source chip | Task 4 |
| Deploy + verify | Task 5 |
| "deals" as primary concept removed | Tasks 1+3 |
| Historical language consistent | Tasks 1+3 |

### Gaps: none. All 16 spec steps covered.

### Type consistency check

- `OpportunityItem` defined in Task 1 → used in `OpportunityCard` (Task 1) and `getOpportunities` (Task 1).
- `UploadCanvas` defined in Task 2 → imported in `/upload/page.tsx` (Task 2) and `page.tsx` (Task 3).
- `ValueCanvas`, `BrowseCanvas` defined in Task 3 → imported in `page.tsx` (Task 3).
- `data_source` added to `SearchResult` in Task 4 → used in `SearchResults.tsx` (Task 4).
- `DealCard` deleted in Task 1 Step 7 → no longer referenced anywhere after Task 1 (deals page deleted, homepage rewritten in Task 3, nav updated in Task 1 Step 6).

---

## Task 6: Confidence-tier result cards + SHAP label fixes

The result screen is internally inconsistent: a precise `$518,300` headline with `17/100` confidence is misleading. The UI must change behavior based on confidence score. Three tiers control visual emphasis, headline text, SHAP display, and AI explanation.

**Files:**
- Modify: `web/components/PredictionCard.tsx`
- Modify: `web/components/ShapWaterfall.tsx`
- Modify: `web/components/ExplanationCard.tsx`

### Confidence tiers

| Score | Tier | Behavior |
|-------|------|----------|
| 70–100 | HIGH | Bold gold `$518,300`, normal explanation |
| 40–69  | MEDIUM | Gold `$518K`, "Directional estimate" badge |
| 0–39   | LOW | Muted `~$518K`, warning strip, uncertainty panel |

### SHAP label map (complete)

```
sqft_living              → Living Area
lot_sqft                 → Lot Size
beds                     → Bedrooms
baths_full               → Full Baths
baths_half               → Half Baths
bath_total               → Total Baths
year_built               → Year Built
age                      → Property Age
effective_age            → Effective Age
stories                  → Stories
has_pool                 → Pool Present
has_garage               → Garage Present
garage_spaces            → Garage Spaces
sqft_per_bed             → Sqft per Bedroom
lot_to_living_ratio      → Lot/Living Ratio
dist_downtown_miles      → Distance to Downtown
zip_income_score         → ZIP Income Score
zip_encoded              → Neighborhood Signal
median_zip_price_90d     → Recent ZIP Median Price
median_zip_ppsf_90d      → Recent ZIP Price/Sqft
price_per_sqft_assessed  → Assessed $/Sqft
assessed_ratio           → Assessed Value Ratio
is_covid_period          → Covid Period
```

- [ ] **Step 1: Rewrite PredictionCard with confidence tiers**

Replace entire `web/components/PredictionCard.tsx`:

```tsx
"use client";
import { PredictionResponse } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtApprox = (n: number) => {
  const rounded = Math.round(n / 1000) * 1000;
  return "~" + new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(rounded);
};

function tier(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

const TIER_CONFIG = {
  high:   { label: "AVM ESTIMATE · AUSTIN TX",       badge: null,                    color: "var(--gold)",  muted: false },
  medium: { label: "DIRECTIONAL ESTIMATE",            badge: "USE AS GUIDANCE",       color: "var(--gold)",  muted: false },
  low:    { label: "LOW-CONFIDENCE ESTIMATE",         badge: "⚠ USE AS DIRECTIONAL ONLY", color: "var(--mute)", muted: true  },
};

export function PredictionCard({ result }: { result: PredictionResponse }) {
  const t = tier(result.confidence_score);
  const cfg = TIER_CONFIG[t];
  const segs = 20;
  const filled = Math.round((result.confidence_score / 100) * segs);
  const priceDisplay = t === "low"
    ? fmtApprox(result.predicted_price)
    : fmt(result.predicted_price);

  return (
    <div className="panel tick-corners" style={{ background: "var(--bg-1)" }}>
      <div className="panel-head">
        <div className="panel-dot" style={t === "low" ? { background: "var(--mute-2)" } : {}} />
        <span className="panel-label">{cfg.label}</span>
        <span className="panel-meta">MODEL v{result.model_version} · 90% CI</span>
      </div>

      {/* Low-confidence warning strip */}
      {t === "low" && (
        <div style={{
          background: "rgba(192,57,43,0.07)",
          borderBottom: "1px solid var(--red-soft)",
          padding: "8px 20px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ color: "var(--red)", fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.1em" }}>
            LOW CONFIDENCE — WIDE RANGE — TREAT AS DIRECTIONAL ONLY
          </span>
        </div>
      )}

      <div style={{ padding: "20px 20px 12px", textAlign: "center" }}>
        {cfg.badge && (
          <div className="t-eyebrow" style={{ marginBottom: 8, color: t === "low" ? "var(--red)" : "var(--mute)" }}>
            {cfg.badge}
          </div>
        )}
        <div className={`t-mono${t !== "low" ? " glitch-in" : ""}`} style={{
          fontSize: t === "low" ? 38 : 48,
          color: cfg.color,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          fontWeight: 600,
          opacity: t === "low" ? 0.75 : 1,
        }}>
          {priceDisplay}
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 8, letterSpacing: "0.04em" }}>
          {fmt(result.lower_bound)} <span style={{ color: "var(--mute)" }}>→</span> {fmt(result.upper_bound)}
        </div>
      </div>

      <div style={{ padding: "0 20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span className="t-eyebrow">CONFIDENCE</span>
          <span className="t-mono" style={{
            fontSize: 11, fontWeight: 700,
            color: t === "high" ? "var(--gold)" : t === "medium" ? "var(--ink-2)" : "var(--mute)",
          }}>
            {result.confidence_score}/100
          </span>
        </div>
        <div className="conf-segments">
          {Array.from({ length: segs }).map((_, i) => (
            <div
              key={i}
              className={`conf-seg${i < filled ? " on" : ""}`}
              style={i < filled && t === "low" ? { background: "var(--mute-2)", borderColor: "var(--mute)" } : {}}
            />
          ))}
        </div>
      </div>

      {/* Low-confidence next steps */}
      {t === "low" && (
        <div style={{ margin: "0 16px 16px", padding: "10px 14px", background: "var(--bg-2)", border: "1px solid var(--line-2)" }}>
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>IMPROVE THIS ESTIMATE</div>
          {[
            "Add property details manually below",
            "Review comparable sales",
            "Upload a listings CSV with more properties",
          ].map(s => (
            <div key={s} className="t-mono" style={{ fontSize: 11, color: "var(--mute)", marginBottom: 3 }}>
              · {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate/web && npx tsc --noEmit
```

Expected: PASS (no errors related to PredictionCard).

- [ ] **Step 3: Fix SHAP label map and $0k formatting in ShapWaterfall**

In `web/components/ShapWaterfall.tsx`, replace the `LABELS` map with the full version:

```typescript
const LABELS: Record<string, string> = {
  sqft_living:             "Living Area",
  lot_sqft:                "Lot Size",
  beds:                    "Bedrooms",
  baths_full:              "Full Baths",
  baths_half:              "Half Baths",
  bath_total:              "Total Baths",
  year_built:              "Year Built",
  age:                     "Property Age",
  effective_age:           "Effective Age",
  stories:                 "Stories",
  has_pool:                "Pool Present",
  has_garage:              "Garage Present",
  garage_spaces:           "Garage Spaces",
  sqft_per_bed:            "Sqft per Bedroom",
  lot_to_living_ratio:     "Lot/Living Ratio",
  dist_downtown_miles:     "Distance to Downtown",
  zip_income_score:        "ZIP Income Score",
  zip_encoded:             "Neighborhood Signal",
  median_zip_price_90d:    "Recent ZIP Median Price",
  median_zip_ppsf_90d:     "Recent ZIP Price/Sqft",
  price_per_sqft_assessed: "Assessed $/Sqft",
  assessed_ratio:          "Assessed Value Ratio",
  is_covid_period:         "Covid Period Flag",
};
```

Also fix the X-axis tick formatter to show proper magnitudes (not $0k for small values):

```typescript
// Replace tickFormatter in XAxis:
tickFormatter={(v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  if (abs >= 100)  return `$${v.toFixed(0)}`;
  return `$${v.toFixed(1)}`;
}}
```

Also fix the Tooltip formatter to match:

```typescript
formatter={(v) => {
  if (typeof v !== "number") return [String(v), ""];
  const abs = Math.abs(v);
  const label = abs >= 1000
    ? `${v > 0 ? "+" : ""}$${(v / 1000).toFixed(1)}k`
    : `${v > 0 ? "+" : ""}$${v.toFixed(0)}`;
  return [label, "Impact"];
}}
```

- [ ] **Step 4: Run TypeScript check again**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Add confidence-aware prefix to ExplanationCard**

In `web/components/ExplanationCard.tsx`, add a low-confidence preamble before the explanation text.

After the `setExplanation` line, add a `confidencePrefix` variable in the component:

```tsx
const confidencePrefix =
  prediction.confidence_score < 40
    ? "⚠ Low-confidence estimate — treat as directional only.\n\n"
    : prediction.confidence_score < 70
    ? "Directional estimate. "
    : "";
```

Then in the rendered text:

```tsx
{confidencePrefix && (
  <div className="t-mono" style={{
    fontSize: 11, color: "var(--red)", marginBottom: 10,
    padding: "6px 10px", background: "rgba(192,57,43,0.07)",
    borderLeft: "2px solid var(--red)",
  }}>
    {prediction.confidence_score < 40
      ? "⚠ LOW CONFIDENCE — THIS ESTIMATE IS DIRECTIONAL ONLY"
      : "DIRECTIONAL ESTIMATE — MODERATE CONFIDENCE"}
  </div>
)}
<p className="t-mono" style={{
  fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.7,
  margin: 0, letterSpacing: "0.01em"
}}>
  {explanation}
</p>
```

- [ ] **Step 6: Build check**

```bash
npm run build
```

Expected: PASS. All 5 pages build cleanly.

- [ ] **Step 7: Commit**

```bash
git add web/components/PredictionCard.tsx web/components/ShapWaterfall.tsx web/components/ExplanationCard.tsx
git commit -m "feat: confidence-tier result cards (low/medium/high), SHAP label fixes, $0k formatter fix"
```

