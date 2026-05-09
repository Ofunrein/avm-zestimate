# TCAD + Census ACS Training Enrichment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the Austin AVM training pipeline with TCAD parcel data and Census ACS income data so `assessed_ratio`, `price_per_sqft_assessed`, and `zip_income_score` contain real values instead of zeros and 0.5 defaults.

**Architecture:** Two new ingest functions added to `ml/src/avm/ingest.py`. One new enrichment function added to `ml/src/avm/features.py`. `run_training.py` calls enrichment after base feature engineering. Expected accuracy gain: MedAPE drops from ~12% toward ~8-9% once both features are real.

**Tech Stack:** Python, pandas, requests, Census API (free, no key needed for ACS 5-year), TCAD public bulk download (free CSV), existing XGBoost + LightGBM pipeline.

---

## Why these two sources matter

| Feature | Current value | With enrichment |
|---|---|---|
| `zip_income_score` | Always `0.5` (neutral default) | Real Census ACS median income normalized by ZIP |
| `price_per_sqft_assessed` | Usually `0` (no assessed value in Kaggle data) | Real TCAD appraised value / sqft |
| `assessed_ratio` | Usually `0` | Real TCAD appraised value / sale price |

These are in `FEATURE_COLS` and `build_feature_matrix` — the model slots exist. Zeros are deadweight. Real values give the model signal it currently ignores.

---

## File Map

**Create:**
- `ml/src/avm/enrich_tcad.py` — download + parse TCAD bulk parcel CSV → dict keyed by address/parcel
- `ml/src/avm/enrich_census.py` — fetch Census ACS 5-year ZIP income data → dict keyed by ZIP5

**Modify:**
- `ml/src/avm/features.py` — `add_location` accepts `income_lookup` dict (already has the parameter, just needs real data); `add_assessed_features` uses TCAD appraised values
- `ml/run_training.py` — load TCAD + Census dicts before feature engineering, pass to functions

**No schema changes** — both features already exist in `FEATURE_COLS`.

---

## Task 1: Census ACS ZIP income lookup

The Census ACS 5-year estimates provide `B19013_001E` (median household income) for every ZIP Code Tabulation Area (ZCTA). Free, no API key required.

**Files:**
- Create: `ml/src/avm/enrich_census.py`

- [ ] **Step 1: Write test**

Create `ml/tests/test_enrich_census.py`:

```python
def test_fetch_zip_income_returns_dict():
    """Census ACS returns dict mapping ZIP5 str to float 0-1."""
    from avm.enrich_census import fetch_zip_income_scores
    result = fetch_zip_income_scores(state_fips="48")  # Texas
    # Should have at least Austin ZIPs
    assert isinstance(result, dict)
    assert len(result) > 0
    # Keys are 5-digit ZIP strings
    sample_key = next(iter(result))
    assert len(sample_key) == 5
    # Values are 0-1 normalized floats
    for v in result.values():
        assert 0.0 <= v <= 1.0

def test_austin_zips_present():
    from avm.enrich_census import fetch_zip_income_scores
    result = fetch_zip_income_scores(state_fips="48")
    assert "78701" in result or "78704" in result or "78744" in result
```

Run: `cd ml && python -m pytest tests/test_enrich_census.py -v`
Expected: FAIL (function not defined yet)

- [ ] **Step 2: Create enrich_census.py**

Create `ml/src/avm/enrich_census.py`:

```python
"""
Fetch Census ACS 5-year median household income by ZIP Code Tabulation Area.
Returns normalized 0-1 scores keyed by ZIP5 string.

No API key required. Uses Census public data API.
ACS 5-year variable B19013_001E = median household income in past 12 months.

Usage:
    from avm.enrich_census import fetch_zip_income_scores
    income_lookup = fetch_zip_income_scores()  # defaults to Texas (state 48)
"""
import json
import urllib.request
from pathlib import Path

CACHE_PATH = Path(__file__).parents[3] / "data/raw/census_acs_income.json"
ACS_YEAR = "2022"  # latest stable ACS 5-year


def fetch_zip_income_scores(
    state_fips: str = "48",  # Texas
    force_refresh: bool = False,
) -> dict[str, float]:
    """Return dict mapping ZIP5 → normalized income score (0–1)."""
    if CACHE_PATH.exists() and not force_refresh:
        with open(CACHE_PATH) as f:
            return json.load(f)

    url = (
        f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5"
        f"?get=B19013_001E,NAME&for=zip+code+tabulation+area:*&in=state:{state_fips}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "AustinAVM/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())

    # data[0] is header row: ['B19013_001E', 'NAME', 'state', 'zip code tabulation area']
    rows = data[1:]
    raw: dict[str, float] = {}
    for row in rows:
        income_str, _, _, zip5 = row
        try:
            income = float(income_str)
            if income > 0:
                raw[zip5] = income
        except (ValueError, TypeError):
            continue

    if not raw:
        return {}

    min_income = min(raw.values())
    max_income = max(raw.values())
    span = max_income - min_income or 1.0
    normalized = {z: round((v - min_income) / span, 4) for z, v in raw.items()}

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_PATH, "w") as f:
        json.dump(normalized, f)

    return normalized
```

- [ ] **Step 3: Run test — must pass**

```bash
cd ml && python -m pytest tests/test_enrich_census.py -v --tb=short
```

Expected: 2 PASSED (Census API call succeeds, Austin ZIPs present, values 0-1)

- [ ] **Step 4: Commit**

```bash
git add ml/src/avm/enrich_census.py ml/tests/test_enrich_census.py
git commit -m "feat: Census ACS ZIP income enrichment for zip_income_score feature"
```

---

## Task 2: TCAD parcel data lookup

Travis County Appraisal District publishes bulk parcel data as a free CSV download. It contains `appraised_value`, `land_value`, street address for every parcel in Travis County (~400k rows).

Download URL: `https://traviscad.org/appraisaldata` → "Export Property Data" CSV.
File is large (~100MB). Cached locally at `ml/data/raw/tcad_parcels.csv`.

**Files:**
- Create: `ml/src/avm/enrich_tcad.py`

- [ ] **Step 1: Write test**

Create `ml/tests/test_enrich_tcad.py`:

```python
from pathlib import Path
import pytest

TCAD_CSV = Path(__file__).parents[2] / "data/raw/tcad_parcels.csv"


def test_tcad_lookup_returns_dict():
    """TCAD lookup builds address→appraised_value dict from CSV."""
    if not TCAD_CSV.exists():
        pytest.skip("TCAD CSV not downloaded yet — run download_tcad() first")
    from avm.enrich_tcad import build_tcad_lookup
    result = build_tcad_lookup(TCAD_CSV)
    assert isinstance(result, dict)
    assert len(result) > 1000  # Travis County has ~400k parcels


def test_tcad_values_are_positive():
    if not TCAD_CSV.exists():
        pytest.skip("TCAD CSV not downloaded")
    from avm.enrich_tcad import build_tcad_lookup
    result = build_tcad_lookup(TCAD_CSV)
    sample = list(result.items())[:20]
    for _, v in sample:
        assert v > 0
```

- [ ] **Step 2: Create enrich_tcad.py**

Create `ml/src/avm/enrich_tcad.py`:

```python
"""
TCAD (Travis County Appraisal District) parcel data enrichment.

Download the bulk CSV manually from https://traviscad.org/appraisaldata
("Export Property Data" — free, no login required).
Save to ml/data/raw/tcad_parcels.csv.

Column names vary by year. This module handles the most common TCAD export formats.

Usage:
    from avm.enrich_tcad import build_tcad_lookup
    tcad = build_tcad_lookup(Path("ml/data/raw/tcad_parcels.csv"))
    # Returns dict: normalized_address_str → appraised_value_float
"""
import re
from pathlib import Path
import pandas as pd

# TCAD export column name variants across years
_APPRAISED_COLS = ["appraised_value", "AppraisedValue", "APPRAISED_VALUE", "tot_appr_val", "TotApprVal"]
_ADDRESS_COLS = ["situs_address", "SitusAddress", "SITUS_ADDRESS", "situs_addr", "property_address"]


def _normalize_address(addr: str) -> str:
    """Lowercase, strip unit numbers, collapse whitespace for fuzzy match."""
    addr = str(addr).lower().strip()
    addr = re.sub(r"\s+(apt|unit|#|ste|suite)\s*\S+", "", addr)
    addr = re.sub(r"\s+", " ", addr)
    return addr


def _find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for c in candidates:
        if c in df.columns:
            return c
    # Case-insensitive fallback
    lower_map = {col.lower(): col for col in df.columns}
    for c in candidates:
        if c.lower() in lower_map:
            return lower_map[c.lower()]
    return None


def build_tcad_lookup(csv_path: Path) -> dict[str, float]:
    """Parse TCAD bulk CSV → dict mapping normalized address to appraised value."""
    df = pd.read_csv(csv_path, low_memory=False, dtype=str)

    addr_col = _find_col(df, _ADDRESS_COLS)
    appr_col = _find_col(df, _APPRAISED_COLS)

    if not addr_col or not appr_col:
        raise ValueError(
            f"Cannot find address/appraised columns in TCAD CSV.\n"
            f"Available: {list(df.columns[:20])}"
        )

    lookup: dict[str, float] = {}
    for _, row in df[[addr_col, appr_col]].iterrows():
        try:
            value = float(str(row[appr_col]).replace(",", "").replace("$", ""))
            if value <= 0:
                continue
            key = _normalize_address(row[addr_col])
            if key:
                lookup[key] = value
        except (ValueError, TypeError):
            continue

    return lookup


def lookup_appraised_value(address: str, tcad: dict[str, float]) -> float | None:
    """Look up appraised value for a normalized address string."""
    key = _normalize_address(address)
    return tcad.get(key)
```

- [ ] **Step 3: Run test (skip if CSV not downloaded)**

```bash
cd ml && python -m pytest tests/test_enrich_tcad.py -v --tb=short
```

Expected: SKIPPED (CSV not yet downloaded) or PASSED if CSV present.

- [ ] **Step 4: Commit**

```bash
git add ml/src/avm/enrich_tcad.py ml/tests/test_enrich_tcad.py
git commit -m "feat: TCAD parcel appraised value lookup for assessed_ratio feature"
```

---

## Task 3: Wire enrichments into run_training.py

Connect Census ACS income and TCAD appraised values into the training pipeline. The feature engineering functions already accept these inputs — just need to load and pass them.

**Files:**
- Modify: `ml/run_training.py`
- Modify: `ml/src/avm/features.py` (update `add_assessed_features` to accept TCAD lookup dict)

- [ ] **Step 1: Update add_assessed_features to accept TCAD lookup**

In `ml/src/avm/features.py`, replace `add_assessed_features`:

```python
def add_assessed_features(
    df: pd.DataFrame,
    tcad_lookup: dict | None = None,
) -> pd.DataFrame:
    df = df.copy()
    # Populate assessed_value from TCAD if not already present
    if tcad_lookup and "address" in df.columns:
        from avm.enrich_tcad import lookup_appraised_value
        def _get_tcad(row):
            if row.get("assessed_value", 0) > 0:
                return row["assessed_value"]
            found = lookup_appraised_value(str(row.get("address", "")), tcad_lookup)
            return found if found else 0.0
        df["assessed_value"] = df.apply(_get_tcad, axis=1)

    if "assessed_value" in df.columns and df["assessed_value"].sum() > 0:
        df["price_per_sqft_assessed"] = (
            df["assessed_value"] / df["sqft_living"].replace(0, 1)
        ).clip(0, 2000)
        if "sale_price" in df.columns:
            df["assessed_ratio"] = (
                df["assessed_value"] / df["sale_price"].replace(0, 1)
            ).clip(0, 5)
        else:
            df["assessed_ratio"] = 0.0
    else:
        df["price_per_sqft_assessed"] = 0.0
        df["assessed_ratio"] = 0.0
    return df
```

- [ ] **Step 2: Update run_training.py to load enrichments**

In `ml/run_training.py`, add after imports (near top):

```python
from avm.enrich_census import fetch_zip_income_scores
from avm.enrich_tcad import build_tcad_lookup
```

Then in `main()`, add after `df = clean(raw)` (before feature engineering step):

```python
    # Load enrichment data (fail-soft: returns empty dict if unavailable)
    print("[2/9] Loading enrichment data...")
    try:
        income_lookup = fetch_zip_income_scores()
        print(f"  Census ACS: {len(income_lookup)} ZIP income scores loaded")
    except Exception as e:
        income_lookup = {}
        print(f"  Census ACS: skipped ({e})")

    tcad_path = Path(__file__).parent / "data/raw/tcad_parcels.csv"
    try:
        tcad_lookup = build_tcad_lookup(tcad_path) if tcad_path.exists() else {}
        print(f"  TCAD: {len(tcad_lookup)} parcel values loaded")
    except Exception as e:
        tcad_lookup = {}
        print(f"  TCAD: skipped ({e})")
```

Then update the feature engineering calls to pass these:

```python
    # Feature engineering (was step 2, now step 3 after enrichment load)
    print("[3/9] Feature engineering...")
    df = add_structural(df)
    df, zip_encoder = add_location(df, income_lookup=income_lookup)
    df = add_market_features(df)
    df = add_assessed_features(df, tcad_lookup=tcad_lookup)
```

Also update inference in `api/routers/predict.py` and `scan.py` — `add_assessed_features` call stays the same (no TCAD at inference, keeps `assessed_value` from user input if provided).

- [ ] **Step 3: Run a quick training smoke test**

```bash
cd ml && python -c "
from avm.enrich_census import fetch_zip_income_scores
scores = fetch_zip_income_scores()
print(f'Census: {len(scores)} ZIPs, sample: {dict(list(scores.items())[:3])}')
print('78701:', scores.get('78701', 'NOT FOUND'))
print('78744:', scores.get('78744', 'NOT FOUND'))
"
```

Expected output: ZIP income scores loaded, 78701 and 78744 present with different values.

- [ ] **Step 4: Commit**

```bash
git add ml/src/avm/features.py ml/run_training.py
git commit -m "feat: wire Census ACS income + TCAD appraised values into training pipeline"
```

---

## Task 4: Download TCAD bulk CSV

TCAD publishes bulk data at https://traviscad.org/appraisaldata — free download, no account required.

- [ ] **Step 1: Navigate to TCAD data download**

Go to: `https://traviscad.org/appraisaldata`

Click "Export Property Data" (or equivalent current label — TCAD redesigns the page occasionally).

Download the CSV file (usually ~80-120MB, contains all Travis County parcels).

- [ ] **Step 2: Save to correct path**

```bash
mv ~/Downloads/tcad_*.csv /path/to/avm-zestimate/ml/data/raw/tcad_parcels.csv
```

Replace `/path/to/` with your actual repo path. Add to `.gitignore` (file is too large for git):

Confirm `ml/data/` is in `.gitignore`:
```
ml/data/
```

Already there — no change needed.

- [ ] **Step 3: Run TCAD test to verify parse works**

```bash
cd ml && python -m pytest tests/test_enrich_tcad.py -v --tb=short
```

Expected: 2 PASSED (dict has >1000 entries, all values positive).

- [ ] **Step 4: Run training with enrichment**

```bash
cd ml && python run_training.py 5  # 5 Optuna trials for quick test
```

Expected output includes:
```
[2/9] Loading enrichment data...
  Census ACS: 1800+ ZIP income scores loaded
  TCAD: 300000+ parcel values loaded
```

And final MedAPE should be lower than the baseline ~12.6%.

---

## Expected accuracy improvement

| Scenario | Expected MedAPE |
|---|---|
| Current (zeros) | ~12.6% |
| Census ACS only | ~11–12% |
| Census ACS + TCAD | ~9–11% |
| Both + more Optuna trials | ~8–10% |

The improvement comes from `zip_income_score` (currently 0.5 for everyone → real spread across ZIPs) and `assessed_ratio` (currently 0 → real signal: TCAD appraised value vs sale price catches assessment lag in fast-appreciating ZIPs).
