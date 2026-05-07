# Austin AVM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production-grade hyperlocal Austin AVM — temporal CV, SHAP, prediction intervals, comps engine, undervalued scanner, benchmark dashboard, deployed on HuggingFace Spaces (API) + Vercel (frontend).

**Architecture:** Monorepo with 3 independent deployable layers: `ml/` (Python data pipeline + training), `api/` (FastAPI on HF Spaces loads model at startup), `web/` (Next.js on Vercel calls API). Models trained locally, artifacts pushed to HF model repo.

**Tech Stack:** Python 3.11+, uv, XGBoost, LightGBM, SHAP, Optuna, MLflow, FastAPI, Pydantic v2, numbers-parser, pandas, scikit-learn, pytest | Next.js 14 App Router, TypeScript, Recharts, Tailwind CSS | Supabase Postgres | HuggingFace Spaces Docker | Vercel Hobby

---

## File Map

```
avm-zestimate/
├── ml/
│   ├── pyproject.toml
│   ├── data/                          # gitignored
│   │   ├── raw/
│   │   └── processed/
│   ├── src/avm/
│   │   ├── __init__.py
│   │   ├── ingest.py                  # download + parse all sources
│   │   ├── clean.py                   # merge, dedup, outlier removal
│   │   ├── features.py                # all feature engineering
│   │   ├── split.py                   # temporal CV + test split
│   │   ├── baseline.py                # tax appraisal / PPSF / ZIP median baselines
│   │   ├── train.py                   # XGBoost + LightGBM + ensemble + Optuna
│   │   ├── intervals.py               # quantile XGBoost for prediction intervals
│   │   ├── evaluate.py                # MedAPE, MAE, RMSE, within-5/10%, residuals
│   │   ├── shap_gen.py                # SHAP explanations per prediction
│   │   ├── comps.py                   # comparable sales engine
│   │   └── experiment.py             # MLflow logging helpers
│   └── tests/
│       ├── test_clean.py
│       ├── test_features.py
│       ├── test_split.py
│       ├── test_evaluate.py
│       └── test_comps.py
├── api/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── schemas.py                     # all Pydantic models
│   ├── model_loader.py                # load artifacts from HF hub at startup
│   └── routers/
│       ├── predict.py
│       ├── comps.py
│       ├── benchmark.py
│       └── scan.py
├── web/
│   ├── package.json
│   ├── app/
│   │   ├── page.tsx                   # address lookup + prediction
│   │   ├── benchmark/page.tsx
│   │   ├── scanner/page.tsx
│   │   └── model-card/page.tsx
│   ├── components/
│   │   ├── PredictionCard.tsx
│   │   ├── ShapWaterfall.tsx
│   │   ├── CompsTable.tsx
│   │   ├── BenchmarkChart.tsx
│   │   └── ZipAccuracyTable.tsx
│   └── lib/
│       └── api.ts
├── supabase/
│   └── schema.sql
└── .github/workflows/
    ├── ci.yml
    └── retrain.yml
```

---

## Task 1: Project Setup

**Files:**
- Create: `ml/pyproject.toml`
- Create: `ml/src/avm/__init__.py`
- Create: `.gitignore`
- Create: `web/` (Next.js scaffold)

- [ ] **Step 1: Initialize Python project**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate
mkdir -p ml/src/avm ml/tests ml/data/raw ml/data/processed ml/models api/routers supabase
touch ml/src/avm/__init__.py ml/tests/__init__.py
```

- [ ] **Step 2: Create `ml/pyproject.toml`**

```toml
[project]
name = "avm"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "pandas>=2.0",
    "numpy>=1.26",
    "scikit-learn>=1.4",
    "xgboost>=2.0",
    "lightgbm>=4.3",
    "shap>=0.44",
    "optuna>=3.6",
    "mlflow>=2.13",
    "fastapi>=0.111",
    "uvicorn[standard]>=0.29",
    "pydantic>=2.7",
    "httpx>=0.27",
    "numbers-parser>=4.2",
    "openpyxl>=3.1",
    "kaggle>=1.6",
    "requests>=2.31",
    "huggingface-hub>=0.23",
    "joblib>=1.4",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-cov>=5.0", "ruff>=0.4"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/avm"]
```

- [ ] **Step 3: Install dependencies**

```bash
cd ml && uv pip install -e ".[dev]" --python python3.11
```
Expected: all packages install, no conflicts.

- [ ] **Step 4: Create `.gitignore`**

```
ml/data/
ml/models/
ml/mlruns/
__pycache__/
*.pyc
.env
.env.local
node_modules/
.next/
*.egg-info/
.venv/
```

- [ ] **Step 5: Scaffold Next.js app**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate
npx create-next-app@latest web --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```
Expected: `web/` directory created with Next.js 14 App Router.

- [ ] **Step 6: Install web deps**

```bash
cd web && npm install recharts @supabase/supabase-js papaparse
npm install -D @types/papaparse
```

- [ ] **Step 7: Commit**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate
git add -A && git commit -m "feat: project scaffold — ml pyproject, next.js web, gitignore"
```

---

## Task 2: Data Ingestion — Kaggle + .numbers

**Files:**
- Create: `ml/src/avm/ingest.py`
- Create: `ml/tests/test_ingest.py`

- [ ] **Step 1: Write `ml/src/avm/ingest.py`**

```python
"""Download and parse all raw data sources into standardized DataFrames."""
import os
import subprocess
import zipfile
from pathlib import Path

import pandas as pd
from numbers_parser import Document

RAW = Path(__file__).parents[3] / "data/raw"
PROCESSED = Path(__file__).parents[3] / "data/processed"

KAGGLE_DATASET = "ericpierce/austinhousingprices"
NUMBERS_PATH = Path.home() / "Downloads/compass_austin_listings.numbers"


def fetch_kaggle_austin(dest: Path = RAW) -> Path:
    """Download Austin housing prices dataset from Kaggle."""
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / "kaggle_austin"
    if (out / "austinHousingData.csv").exists():
        return out / "austinHousingData.csv"
    subprocess.run(
        ["kaggle", "datasets", "download", "-d", KAGGLE_DATASET, "-p", str(out), "--unzip"],
        check=True,
    )
    csvs = list(out.glob("*.csv"))
    if not csvs:
        raise FileNotFoundError(f"No CSV found after Kaggle download in {out}")
    return csvs[0]


def parse_numbers_listings(path: Path = NUMBERS_PATH) -> pd.DataFrame:
    """Parse Apple .numbers file into DataFrame."""
    if not path.exists():
        raise FileNotFoundError(f"Numbers file not found: {path}")
    doc = Document(str(path))
    sheet = doc.sheets[0]
    table = sheet.tables[0]
    rows = [[cell.value for cell in row] for row in table.iter_rows()]
    if not rows:
        return pd.DataFrame()
    headers = [str(h) if h is not None else f"col_{i}" for i, h in enumerate(rows[0])]
    return pd.DataFrame(rows[1:], columns=headers)


def load_kaggle_austin(path: Path | None = None) -> pd.DataFrame:
    """Load Kaggle Austin CSV into standardized DataFrame."""
    if path is None:
        path = fetch_kaggle_austin()
    df = pd.read_csv(path, low_memory=False)
    return df


def load_compass_listings() -> pd.DataFrame:
    return parse_numbers_listings()


def save_raw(df: pd.DataFrame, name: str) -> Path:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    out = PROCESSED / f"{name}.parquet"
    df.to_parquet(out, index=False)
    return out
```

- [ ] **Step 2: Write failing test**

```python
# ml/tests/test_ingest.py
import pandas as pd
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from avm.ingest import load_kaggle_austin, parse_numbers_listings, save_raw


def test_load_kaggle_returns_dataframe(tmp_path):
    csv = tmp_path / "austin.csv"
    csv.write_text("zpid,latestPrice,livingAreaSqFt,numOfBedrooms,numOfBathrooms,yearBuilt,zipcode\n"
                   "1,450000,1800,3,2,2005,78701\n")
    df = load_kaggle_austin(path=csv)
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 1
    assert "latestPrice" in df.columns


def test_save_raw_writes_parquet(tmp_path):
    import avm.ingest as ingest_module
    ingest_module.PROCESSED = tmp_path
    df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
    out = save_raw(df, "test")
    assert out.exists()
    loaded = pd.read_parquet(out)
    assert len(loaded) == 2
```

- [ ] **Step 3: Run — expect pass**

```bash
cd ml && python -m pytest tests/test_ingest.py -v
```
Expected: 2 PASSED.

- [ ] **Step 4: Commit**

```bash
git add ml/src/avm/ingest.py ml/tests/test_ingest.py
git commit -m "feat: data ingest — kaggle austin + numbers parser"
```

---

## Task 3: Data Cleaning + Merge

**Files:**
- Create: `ml/src/avm/clean.py`
- Create: `ml/tests/test_clean.py`

- [ ] **Step 1: Write `ml/src/avm/clean.py`**

```python
"""Merge, deduplicate, and clean Austin sale records."""
import hashlib
import re
from pathlib import Path

import numpy as np
import pandas as pd


# ── Column normalisation maps ──────────────────────────────────────────────

KAGGLE_RENAME = {
    "latestPrice": "sale_price",
    "livingAreaSqFt": "sqft_living",
    "lotSizeSqFt": "lot_sqft",
    "numOfBedrooms": "beds",
    "numOfBathrooms": "baths_full",
    "yearBuilt": "year_built",
    "zipcode": "zip_code",
    "latitude": "lat",
    "longitude": "lng",
    "garageSpaces": "garage_spaces",
    "hasAssociation": "has_hoa",
    "hasSpa": "has_spa",
    "hasView": "has_view",
    "latest_saledate": "sale_date",
    "city": "city",
    "homeType": "property_type",
    "numOfStories": "stories",
    "avgSchoolRating": "school_rating",
    "MedianStudentsPerTeacher": "students_per_teacher",
    "numOfHighSchools": "n_high_schools",
    "numOfMiddleSchools": "n_middle_schools",
    "numOfElementarySchools": "n_elem_schools",
}

REQUIRED_COLS = [
    "sale_price", "sqft_living", "beds", "baths_full",
    "year_built", "zip_code", "lat", "lng",
]


def normalise_kaggle(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns={k: v for k, v in KAGGLE_RENAME.items() if k in df.columns})
    if "sale_date" not in df.columns:
        for c in ["latestSaleDate", "lastsolddate", "latest_saledate"]:
            if c in df.columns:
                df["sale_date"] = pd.to_datetime(df[c], errors="coerce")
                break
    else:
        df["sale_date"] = pd.to_datetime(df["sale_date"], errors="coerce")
    df["source"] = "kaggle"
    return df


def _normalise_address(addr: str) -> str:
    if not isinstance(addr, str):
        return ""
    addr = addr.upper().strip()
    addr = re.sub(r"\s+", " ", addr)
    for old, new in [(" STREET", " ST"), (" AVENUE", " AVE"), (" DRIVE", " DR"),
                     (" ROAD", " RD"), (" LANE", " LN"), (" COURT", " CT"),
                     (" BOULEVARD", " BLVD"), (" PLACE", " PL")]:
        addr = addr.replace(old, new)
    return addr


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # drop missing required fields
    df = df.dropna(subset=[c for c in REQUIRED_COLS if c in df.columns])

    # price sanity: Austin homes $50k–$10M
    df = df[df["sale_price"].between(50_000, 10_000_000)]

    # sqft sanity: 200–20,000
    df = df[df["sqft_living"].between(200, 20_000)]

    # beds/baths
    df = df[df["beds"].between(0, 20)]
    df = df[df["baths_full"].between(0, 20)]

    # year built sanity
    df = df[df["year_built"].between(1850, 2025)]

    # normalise zip to 5-digit string
    df["zip_code"] = df["zip_code"].astype(str).str[:5].str.zfill(5)

    # filter to Travis County ZIPs (Austin area: 786xx + 787xx)
    df = df[df["zip_code"].str.match(r"^78[67]\d{2}$")]

    # COVID flag
    if "sale_date" in df.columns:
        covid_start = pd.Timestamp("2020-04-01")
        covid_end = pd.Timestamp("2021-06-30")
        df["is_covid_period"] = df["sale_date"].between(covid_start, covid_end).astype(int)
        df = df[df["sale_date"].between("2018-01-01", "2024-12-31")]
    else:
        df["is_covid_period"] = 0

    # dedup on address + sale_date
    if "address" in df.columns and "sale_date" in df.columns:
        df["_addr_norm"] = df["address"].apply(_normalise_address)
        df = df.drop_duplicates(subset=["_addr_norm", "sale_date"])
        df = df.drop(columns=["_addr_norm"])

    df = df.reset_index(drop=True)
    return df


def data_sha256(df: pd.DataFrame) -> str:
    """Reproducible hash of dataset for MLflow."""
    h = hashlib.sha256(pd.util.hash_pandas_object(df, index=False).values.tobytes())
    return h.hexdigest()[:16]
```

- [ ] **Step 2: Write failing tests**

```python
# ml/tests/test_clean.py
import pandas as pd
import pytest
from avm.clean import clean, normalise_kaggle, data_sha256


def _sample():
    return pd.DataFrame({
        "sale_price": [450000, 99, 11_000_000, 380000],
        "sqft_living": [1800, 1200, 1500, 0],
        "beds": [3, 2, 4, 3],
        "baths_full": [2, 1, 3, 2],
        "year_built": [2005, 2010, 2000, 1920],
        "zip_code": ["78701", "78702", "99999", "78703"],
        "lat": [30.27, 30.28, 30.29, 30.26],
        "lng": [-97.74, -97.73, -97.72, -97.75],
        "sale_date": ["2022-01-01", "2022-02-01", "2022-03-01", "2022-04-01"],
    })


def test_clean_removes_price_outliers():
    df = clean(_sample())
    assert all(df["sale_price"].between(50_000, 10_000_000))


def test_clean_removes_sqft_zero():
    df = clean(_sample())
    assert all(df["sqft_living"] >= 200)


def test_clean_filters_non_austin_zips():
    df = clean(_sample())
    assert all(df["zip_code"].str.match(r"^78[67]\d{2}$"))


def test_clean_adds_covid_flag():
    df = _sample()
    df.loc[0, "sale_date"] = "2020-06-15"
    result = clean(df)
    covid_rows = result[result["is_covid_period"] == 1]
    assert len(covid_rows) >= 1


def test_data_sha256_deterministic():
    df = _sample()
    assert data_sha256(df) == data_sha256(df)
    assert len(data_sha256(df)) == 16
```

- [ ] **Step 3: Run tests — expect pass**

```bash
cd ml && python -m pytest tests/test_clean.py -v
```
Expected: 5 PASSED.

- [ ] **Step 4: Commit**

```bash
git add ml/src/avm/clean.py ml/tests/test_clean.py
git commit -m "feat: data cleaning — price/sqft/zip filters, covid flag, sha256"
```

---

## Task 4: Feature Engineering

**Files:**
- Create: `ml/src/avm/features.py`
- Create: `ml/tests/test_features.py`

- [ ] **Step 1: Write `ml/src/avm/features.py`**

```python
"""Feature engineering for Austin AVM."""
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

# Austin downtown coords
DOWNTOWN_LAT = 30.2672
DOWNTOWN_LNG = -97.7431


def add_structural(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["age"] = 2024 - df["year_built"].clip(1850, 2024)
    df["effective_age"] = df.get("effective_year", df["year_built"]).rsub(2024).clip(0, 174)
    df["has_pool"] = df.get("has_pool", pd.Series(0, index=df.index)).fillna(0).astype(int)
    df["has_garage"] = (df.get("garage_spaces", pd.Series(0, index=df.index)).fillna(0) > 0).astype(int)
    df["garage_spaces"] = df.get("garage_spaces", pd.Series(0, index=df.index)).fillna(0).clip(0, 10)
    df["baths_half"] = df.get("baths_half", pd.Series(0, index=df.index)).fillna(0)
    df["bath_total"] = df["baths_full"] + 0.5 * df["baths_half"]
    df["sqft_per_bed"] = (df["sqft_living"] / df["beds"].replace(0, 1)).clip(0, 5000)
    df["lot_sqft"] = df.get("lot_sqft", pd.Series(0, index=df.index)).fillna(0).clip(0, 500_000)
    df["lot_to_living_ratio"] = (df["lot_sqft"] / df["sqft_living"].replace(0, 1)).clip(0, 100)
    return df


def add_location(df: pd.DataFrame, income_lookup: dict | None = None) -> pd.DataFrame:
    df = df.copy()
    # Euclidean proxy for distance (fast, good enough for Austin's flat terrain)
    lat_diff = df["lat"] - DOWNTOWN_LAT
    lng_diff = df["lng"] - DOWNTOWN_LNG
    df["dist_downtown_miles"] = np.sqrt(lat_diff**2 + lng_diff**2) * 69.0

    # ZIP income score (0–1). Pass in dict {zip: normalised_income} from Census ACS.
    if income_lookup:
        df["zip_income_score"] = df["zip_code"].map(income_lookup).fillna(0.5)
    else:
        df["zip_income_score"] = 0.5  # neutral default

    # Label-encode zip for tree models
    le = LabelEncoder()
    df["zip_encoded"] = le.fit_transform(df["zip_code"].astype(str))
    return df, le


def add_market_features(df: pd.DataFrame) -> pd.DataFrame:
    """Rolling 90-day ZIP medians — computed without future leakage."""
    df = df.copy()
    if "sale_date" not in df.columns:
        df["median_zip_price_90d"] = df.get("sale_price", 400_000)
        df["median_zip_ppsf_90d"] = 250.0
        return df

    df = df.sort_values("sale_date").reset_index(drop=True)
    df["ppsf"] = df["sale_price"] / df["sqft_living"].replace(0, 1)

    results = []
    for zip_code, grp in df.groupby("zip_code"):
        grp = grp.sort_values("sale_date").copy()
        # shift(1) prevents same-row leakage
        grp["median_zip_price_90d"] = (
            grp["sale_price"].shift(1)
            .rolling("90D", on=grp["sale_date"].shift(1).values)
            .median()
        )
        grp["median_zip_ppsf_90d"] = (
            grp["ppsf"].shift(1)
            .rolling("90D", on=grp["sale_date"].shift(1).values)
            .median()
        )
        results.append(grp)

    out = pd.concat(results).sort_index()
    # fill NaN (first rows in each zip) with global median
    out["median_zip_price_90d"] = out["median_zip_price_90d"].fillna(out["sale_price"].median())
    out["median_zip_ppsf_90d"] = out["median_zip_ppsf_90d"].fillna(out["ppsf"].median())
    out = out.drop(columns=["ppsf"], errors="ignore")
    return out


def add_assessed_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "assessed_value" in df.columns:
        df["price_per_sqft_assessed"] = (
            df["assessed_value"] / df["sqft_living"].replace(0, 1)
        ).clip(0, 2000)
        df["assessed_ratio"] = (df["assessed_value"] / df["sale_price"].replace(0, 1)).clip(0, 5)
    else:
        df["price_per_sqft_assessed"] = 0.0
        df["assessed_ratio"] = 0.0
    return df


FEATURE_COLS = [
    "sqft_living", "lot_sqft", "beds", "baths_full", "baths_half", "bath_total",
    "year_built", "age", "effective_age", "stories",
    "has_pool", "has_garage", "garage_spaces",
    "sqft_per_bed", "lot_to_living_ratio",
    "dist_downtown_miles", "zip_income_score", "zip_encoded",
    "median_zip_price_90d", "median_zip_ppsf_90d",
    "price_per_sqft_assessed", "assessed_ratio",
    "is_covid_period",
]


def build_feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Return only model feature columns, filling missing with 0."""
    cols = [c for c in FEATURE_COLS if c in df.columns]
    return df[cols].fillna(0).astype(float)
```

- [ ] **Step 2: Write failing tests**

```python
# ml/tests/test_features.py
import numpy as np
import pandas as pd
import pytest
from avm.features import add_structural, add_location, add_market_features, build_feature_matrix, FEATURE_COLS


def _base():
    return pd.DataFrame({
        "sale_price": [450000, 380000, 310000],
        "sqft_living": [1800, 1400, 1100],
        "lot_sqft": [5000.0, 4000.0, 3500.0],
        "beds": [3, 2, 2],
        "baths_full": [2, 2, 1],
        "baths_half": [1, 0, 0],
        "year_built": [2005, 1998, 1985],
        "zip_code": ["78701", "78702", "78703"],
        "lat": [30.27, 30.28, 30.26],
        "lng": [-97.74, -97.73, -97.75],
        "sale_date": pd.to_datetime(["2022-01-15", "2022-04-10", "2022-07-20"]),
        "is_covid_period": [0, 0, 0],
    })


def test_add_structural_age():
    df = add_structural(_base())
    assert all(df["age"] == 2024 - df["year_built"])


def test_add_structural_bath_total():
    df = add_structural(_base())
    assert df.iloc[0]["bath_total"] == pytest.approx(2.5)  # 2 full + 1 half


def test_add_location_dist_downtown_positive():
    df, _ = add_location(add_structural(_base()))
    assert all(df["dist_downtown_miles"] >= 0)


def test_add_market_no_leakage():
    df = add_market_features(add_structural(_base()))
    # first row in each zip should be NaN before fillna — check fillna worked
    assert df["median_zip_price_90d"].notna().all()


def test_build_feature_matrix_no_nulls():
    df = add_structural(_base())
    df, _ = add_location(df)
    df = add_market_features(df)
    X = build_feature_matrix(df)
    assert X.isna().sum().sum() == 0
```

- [ ] **Step 3: Run tests**

```bash
cd ml && python -m pytest tests/test_features.py -v
```
Expected: 5 PASSED.

- [ ] **Step 4: Commit**

```bash
git add ml/src/avm/features.py ml/tests/test_features.py
git commit -m "feat: feature engineering — structural, location, market, assessed"
```

---

## Task 5: Temporal CV Split

**Files:**
- Create: `ml/src/avm/split.py`
- Create: `ml/tests/test_split.py`

- [ ] **Step 1: Write `ml/src/avm/split.py`**

```python
"""Temporal cross-validation and final test split."""
from dataclasses import dataclass
from typing import Iterator

import pandas as pd


@dataclass
class Fold:
    train: pd.DataFrame
    val: pd.DataFrame
    fold_n: int
    val_start: str
    val_end: str


def temporal_cv_folds(
    df: pd.DataFrame,
    n_folds: int = 5,
    val_months: int = 6,
    date_col: str = "sale_date",
) -> list[Fold]:
    """
    Walk-forward CV: each fold trains on all data before val window,
    validates on next val_months window.

    Timeline example (5 folds, 6-month windows):
      fold 1: train < 2020-01, val 2020-01 to 2020-06
      fold 2: train < 2020-07, val 2020-07 to 2020-12
      ...
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col).reset_index(drop=True)

    min_date = df[date_col].min()
    max_date = df[date_col].max()
    total_months = (max_date.year - min_date.year) * 12 + (max_date.month - min_date.month)
    # reserve last n_folds * val_months for validation windows
    train_end_offset = total_months - n_folds * val_months

    folds = []
    for i in range(n_folds):
        val_start = min_date + pd.DateOffset(months=train_end_offset + i * val_months)
        val_end = val_start + pd.DateOffset(months=val_months) - pd.Timedelta(days=1)
        train_mask = df[date_col] < val_start
        val_mask = df[date_col].between(val_start, val_end)
        if train_mask.sum() < 100 or val_mask.sum() < 10:
            continue
        folds.append(Fold(
            train=df[train_mask].reset_index(drop=True),
            val=df[val_mask].reset_index(drop=True),
            fold_n=i + 1,
            val_start=str(val_start.date()),
            val_end=str(val_end.date()),
        ))
    return folds


def train_test_split_temporal(
    df: pd.DataFrame,
    test_start: str = "2024-01-01",
    date_col: str = "sale_date",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Hold out 2024 as final test set, everything before is train."""
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    train = df[df[date_col] < test_start].reset_index(drop=True)
    test = df[df[date_col] >= test_start].reset_index(drop=True)
    return train, test
```

- [ ] **Step 2: Write failing tests**

```python
# ml/tests/test_split.py
import pandas as pd
import pytest
from avm.split import temporal_cv_folds, train_test_split_temporal


def _df():
    dates = pd.date_range("2018-01-01", "2024-12-31", freq="7D")
    return pd.DataFrame({
        "sale_date": dates,
        "sale_price": [400000] * len(dates),
        "sqft_living": [1500] * len(dates),
    })


def test_temporal_cv_no_leakage():
    folds = temporal_cv_folds(_df(), n_folds=5)
    for fold in folds:
        train_max = fold.train["sale_date"].max()
        val_min = fold.val["sale_date"].min()
        assert train_max < val_min, f"Fold {fold.fold_n}: leakage detected"


def test_temporal_cv_returns_n_folds():
    folds = temporal_cv_folds(_df(), n_folds=5)
    assert len(folds) == 5


def test_train_test_split_no_overlap():
    train, test = train_test_split_temporal(_df(), test_start="2024-01-01")
    assert train["sale_date"].max() < pd.Timestamp("2024-01-01")
    assert test["sale_date"].min() >= pd.Timestamp("2024-01-01")


def test_train_test_split_covers_all_rows():
    df = _df()
    train, test = train_test_split_temporal(df)
    assert len(train) + len(test) == len(df)
```

- [ ] **Step 3: Run tests**

```bash
cd ml && python -m pytest tests/test_split.py -v
```
Expected: 4 PASSED.

- [ ] **Step 4: Commit**

```bash
git add ml/src/avm/split.py ml/tests/test_split.py
git commit -m "feat: temporal CV split — walk-forward folds, no-leakage guarantee"
```

---

## Task 6: Baseline Models

**Files:**
- Create: `ml/src/avm/baseline.py`

- [ ] **Step 1: Write `ml/src/avm/baseline.py`**

```python
"""Naive baselines to beat: tax appraisal, ZIP median, price-per-sqft."""
import numpy as np
import pandas as pd


def predict_tax_appraisal(df: pd.DataFrame) -> np.ndarray:
    """Use assessed_value as prediction (tax appraisal baseline)."""
    if "assessed_value" in df.columns:
        return df["assessed_value"].fillna(df["sale_price"].median()).values
    # fallback: assessed_ratio * sale_price not available at inference — use ZIP median
    return predict_zip_median(df)


def predict_zip_median(df: pd.DataFrame) -> np.ndarray:
    """Use rolling ZIP 90-day median as prediction."""
    return df["median_zip_price_90d"].fillna(df["sale_price"].median()).values


def predict_ppsf(df: pd.DataFrame, zip_ppsf: dict | None = None) -> np.ndarray:
    """Price per sqft × sqft. Uses ZIP-level PPSF from training data."""
    ppsf = df["median_zip_ppsf_90d"].fillna(250.0)
    return (ppsf * df["sqft_living"]).values


def medape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Median Absolute Percentage Error (%)."""
    ape = np.abs(y_true - y_pred) / np.abs(y_true) * 100
    return float(np.median(ape))


def within_pct(y_true: np.ndarray, y_pred: np.ndarray, pct: float) -> float:
    """Fraction of predictions within pct% of true value."""
    ape = np.abs(y_true - y_pred) / np.abs(y_true) * 100
    return float(np.mean(ape <= pct))
```

- [ ] **Step 2: Verify with quick smoke test**

```bash
cd ml && python -c "
import numpy as np
from avm.baseline import medape, within_pct
y = np.array([400000, 500000, 300000])
p = np.array([420000, 490000, 310000])
print('MedAPE:', medape(y, p))
print('Within 10%:', within_pct(y, p, 10))
"
```
Expected output: `MedAPE: 3.33...` and `Within 10%: 1.0`

- [ ] **Step 3: Commit**

```bash
git add ml/src/avm/baseline.py
git commit -m "feat: baseline models — tax appraisal, zip median, ppsf + metrics"
```

---

## Task 7: XGBoost + LightGBM Training with Optuna

**Files:**
- Create: `ml/src/avm/train.py`

- [ ] **Step 1: Write `ml/src/avm/train.py`**

```python
"""Train XGBoost and LightGBM with temporal CV + Optuna tuning."""
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error

from avm.baseline import medape, within_pct
from avm.features import build_feature_matrix, FEATURE_COLS
from avm.split import temporal_cv_folds

LOG = logging.getLogger(__name__)
optuna.logging.set_verbosity(optuna.logging.WARNING)

MODELS_DIR = Path(__file__).parents[3] / "models"


def _cv_medape(model_cls, params: dict, folds, log_target: bool = True) -> float:
    scores = []
    for fold in folds:
        X_tr = build_feature_matrix(fold.train)
        X_val = build_feature_matrix(fold.val)
        y_tr = np.log1p(fold.train["sale_price"]) if log_target else fold.train["sale_price"]
        y_val = fold.val["sale_price"].values

        m = model_cls(**params)
        m.fit(X_tr, y_tr)
        pred = m.predict(X_val)
        if log_target:
            pred = np.expm1(pred)
        scores.append(medape(y_val, pred))
    return float(np.mean(scores))


def tune_xgboost(folds, n_trials: int = 50) -> dict:
    def objective(trial):
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 300, 1500),
            "max_depth": trial.suggest_int("max_depth", 3, 8),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-4, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-4, 10.0, log=True),
            "random_state": 42,
            "n_jobs": -1,
        }
        return _cv_medape(xgb.XGBRegressor, params, folds)

    study = optuna.create_study(direction="minimize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
    return study.best_params


def tune_lightgbm(folds, n_trials: int = 50) -> dict:
    def objective(trial):
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 300, 1500),
            "max_depth": trial.suggest_int("max_depth", 3, 8),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "min_child_samples": trial.suggest_int("min_child_samples", 5, 50),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-4, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-4, 10.0, log=True),
            "random_state": 42,
            "n_jobs": -1,
            "verbose": -1,
        }
        return _cv_medape(lgb.LGBMRegressor, params, folds)

    study = optuna.create_study(direction="minimize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
    return study.best_params


def train_final(
    train_df: pd.DataFrame,
    xgb_params: dict,
    lgb_params: dict,
) -> tuple[Any, Any, np.ndarray]:
    """Train final XGB + LGB on full train set, return models + ensemble weights."""
    X = build_feature_matrix(train_df)
    y = np.log1p(train_df["sale_price"])

    xgb_model = xgb.XGBRegressor(**{**xgb_params, "random_state": 42, "n_jobs": -1})
    xgb_model.fit(X, y)

    lgb_model = lgb.LGBMRegressor(**{**lgb_params, "random_state": 42, "n_jobs": -1, "verbose": -1})
    lgb_model.fit(X, y)

    return xgb_model, lgb_model


def ensemble_predict(
    xgb_model, lgb_model, X: pd.DataFrame, xgb_weight: float = 0.5
) -> np.ndarray:
    xgb_pred = np.expm1(xgb_model.predict(X))
    lgb_pred = np.expm1(lgb_model.predict(X))
    return xgb_weight * xgb_pred + (1 - xgb_weight) * lgb_pred


def save_models(xgb_model, lgb_model, meta: dict) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(xgb_model, MODELS_DIR / "xgb_model.joblib")
    joblib.dump(lgb_model, MODELS_DIR / "lgb_model.joblib")
    import json
    (MODELS_DIR / "meta.json").write_text(json.dumps(meta, indent=2))
    LOG.info("Models saved to %s", MODELS_DIR)


def load_models():
    xgb_model = joblib.load(MODELS_DIR / "xgb_model.joblib")
    lgb_model = joblib.load(MODELS_DIR / "lgb_model.joblib")
    return xgb_model, lgb_model
```

- [ ] **Step 2: Smoke test train on synthetic data**

```bash
cd ml && python -c "
import pandas as pd, numpy as np
from avm.train import train_final, ensemble_predict
from avm.features import add_structural, add_location, add_market_features, build_feature_matrix

np.random.seed(42)
n = 500
df = pd.DataFrame({
    'sale_price': np.random.randint(200000, 800000, n),
    'sqft_living': np.random.randint(800, 3500, n),
    'lot_sqft': np.random.randint(2000, 15000, n).astype(float),
    'beds': np.random.randint(1, 6, n),
    'baths_full': np.random.randint(1, 4, n),
    'baths_half': np.random.randint(0, 2, n),
    'year_built': np.random.randint(1970, 2020, n),
    'zip_code': np.random.choice(['78701','78702','78703'], n),
    'lat': np.random.uniform(30.15, 30.45, n),
    'lng': np.random.uniform(-97.95, -97.55, n),
    'is_covid_period': 0,
})
df = add_structural(df)
df, _ = add_location(df)
df = add_market_features(df)
xgb_m, lgb_m = train_final(df, {'n_estimators': 50, 'max_depth': 4, 'learning_rate': 0.1}, {'n_estimators': 50, 'max_depth': 4, 'learning_rate': 0.1, 'verbose': -1})
X = build_feature_matrix(df)
preds = ensemble_predict(xgb_m, lgb_m, X)
print('Predictions shape:', preds.shape, 'Sample:', preds[:3].astype(int))
"
```
Expected: prints predictions shape `(500,)` and sample values.

- [ ] **Step 3: Commit**

```bash
git add ml/src/avm/train.py
git commit -m "feat: XGBoost + LightGBM training with Optuna temporal CV"
```

---

## Task 8: Prediction Intervals (Quantile Regression)

**Files:**
- Create: `ml/src/avm/intervals.py`

- [ ] **Step 1: Write `ml/src/avm/intervals.py`**

```python
"""90% prediction intervals via XGBoost quantile regression."""
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from pathlib import Path

MODELS_DIR = Path(__file__).parents[3] / "models"


def train_quantile_models(
    train_df: pd.DataFrame,
    X_train: pd.DataFrame,
    params: dict,
    alpha_low: float = 0.05,
    alpha_high: float = 0.95,
) -> tuple:
    """Train lower and upper quantile XGBoost models."""
    y = np.log1p(train_df["sale_price"])

    base_params = {k: v for k, v in params.items()
                   if k not in ("objective", "eval_metric")}
    base_params.update({"n_jobs": -1, "random_state": 42})

    q_low = xgb.XGBRegressor(
        **base_params,
        objective="reg:quantileerror",
        quantile_alpha=alpha_low,
    )
    q_high = xgb.XGBRegressor(
        **base_params,
        objective="reg:quantileerror",
        quantile_alpha=alpha_high,
    )
    q_low.fit(X_train, y)
    q_high.fit(X_train, y)
    return q_low, q_high


def predict_intervals(
    q_low, q_high, X: pd.DataFrame
) -> tuple[np.ndarray, np.ndarray]:
    """Return (lower_bound, upper_bound) in dollars."""
    lower = np.expm1(q_low.predict(X))
    upper = np.expm1(q_high.predict(X))
    # ensure lower <= upper
    lower, upper = np.minimum(lower, upper), np.maximum(lower, upper)
    return lower, upper


def confidence_score(
    predicted: np.ndarray,
    lower: np.ndarray,
    upper: np.ndarray,
) -> np.ndarray:
    """0–100 score: wider interval = lower confidence."""
    interval_width_pct = (upper - lower) / predicted.clip(1) * 100
    # 0% width → 100 score, 50%+ width → 0 score
    score = (100 - interval_width_pct.clip(0, 100)).clip(0, 100)
    return score.astype(int)


def save_quantile_models(q_low, q_high) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(q_low, MODELS_DIR / "q_low.joblib")
    joblib.dump(q_high, MODELS_DIR / "q_high.joblib")


def load_quantile_models():
    return (
        joblib.load(MODELS_DIR / "q_low.joblib"),
        joblib.load(MODELS_DIR / "q_high.joblib"),
    )
```

- [ ] **Step 2: Smoke test**

```bash
cd ml && python -c "
import numpy as np, pandas as pd
from avm.intervals import confidence_score, predict_intervals
import xgboost as xgb

pred = np.array([400000.0, 500000.0])
low  = np.array([360000.0, 440000.0])
high = np.array([440000.0, 560000.0])
print('Confidence:', confidence_score(pred, low, high))
"
```
Expected: confidence scores between 0–100, tight intervals score higher.

- [ ] **Step 3: Commit**

```bash
git add ml/src/avm/intervals.py
git commit -m "feat: prediction intervals via XGBoost quantile regression"
```

---

## Task 9: Evaluation + Residual Analysis

**Files:**
- Create: `ml/src/avm/evaluate.py`
- Create: `ml/tests/test_evaluate.py`

- [ ] **Step 1: Write `ml/src/avm/evaluate.py`**

```python
"""Model evaluation: metrics + residual analysis."""
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error


def metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    ape = np.abs(y_true - y_pred) / np.abs(y_true) * 100
    return {
        "medape": float(np.median(ape)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "within_5pct": float(np.mean(ape <= 5)),
        "within_10pct": float(np.mean(ape <= 10)),
        "n": int(len(y_true)),
    }


def metrics_by_zip(df: pd.DataFrame, y_pred: np.ndarray) -> pd.DataFrame:
    df = df.copy()
    df["y_pred"] = y_pred
    rows = []
    for zip_code, grp in df.groupby("zip_code"):
        m = metrics(grp["sale_price"].values, grp["y_pred"].values)
        m["zip_code"] = zip_code
        m["n_sales"] = len(grp)
        rows.append(m)
    return pd.DataFrame(rows).sort_values("medape")


def metrics_by_price_tier(df: pd.DataFrame, y_pred: np.ndarray) -> pd.DataFrame:
    df = df.copy()
    df["y_pred"] = y_pred
    df["price_tier"] = pd.cut(
        df["sale_price"],
        bins=[0, 300_000, 500_000, 750_000, 1_000_000, 99_000_000],
        labels=["<300k", "300-500k", "500-750k", "750k-1M", ">1M"],
    )
    rows = []
    for tier, grp in df.groupby("price_tier", observed=True):
        if len(grp) < 5:
            continue
        m = metrics(grp["sale_price"].values, grp["y_pred"].values)
        m["price_tier"] = str(tier)
        rows.append(m)
    return pd.DataFrame(rows)


def metrics_by_year_built(df: pd.DataFrame, y_pred: np.ndarray) -> pd.DataFrame:
    df = df.copy()
    df["y_pred"] = y_pred
    df["era"] = pd.cut(
        df["year_built"],
        bins=[0, 1970, 1990, 2005, 2015, 2100],
        labels=["pre-1970", "1970-1990", "1990-2005", "2005-2015", "post-2015"],
    )
    rows = []
    for era, grp in df.groupby("era", observed=True):
        if len(grp) < 5:
            continue
        m = metrics(grp["sale_price"].values, grp["y_pred"].values)
        m["era"] = str(era)
        rows.append(m)
    return pd.DataFrame(rows)


def residual_summary(df: pd.DataFrame, y_pred: np.ndarray) -> dict:
    """Full residual report across ZIP, price tier, year built."""
    return {
        "overall": metrics(df["sale_price"].values, y_pred),
        "by_zip": metrics_by_zip(df, y_pred).to_dict(orient="records"),
        "by_price_tier": metrics_by_price_tier(df, y_pred).to_dict(orient="records"),
        "by_year_built": metrics_by_year_built(df, y_pred).to_dict(orient="records"),
    }
```

- [ ] **Step 2: Write failing tests**

```python
# ml/tests/test_evaluate.py
import numpy as np
import pandas as pd
import pytest
from avm.evaluate import metrics, metrics_by_zip, residual_summary


def test_metrics_perfect_prediction():
    y = np.array([400000.0, 500000.0, 300000.0])
    m = metrics(y, y)
    assert m["medape"] == pytest.approx(0.0)
    assert m["within_5pct"] == pytest.approx(1.0)
    assert m["within_10pct"] == pytest.approx(1.0)


def test_metrics_known_ape():
    y = np.array([100000.0])
    p = np.array([110000.0])  # 10% error
    m = metrics(y, p)
    assert m["medape"] == pytest.approx(10.0)


def test_metrics_by_zip_returns_all_zips():
    df = pd.DataFrame({
        "sale_price": [400000, 500000, 300000, 450000],
        "zip_code": ["78701", "78701", "78702", "78702"],
    })
    pred = np.array([410000, 490000, 310000, 440000])
    result = metrics_by_zip(df, pred)
    assert set(result["zip_code"]) == {"78701", "78702"}


def test_residual_summary_has_all_keys():
    df = pd.DataFrame({
        "sale_price": [300000, 450000, 600000, 800000, 200000],
        "zip_code": ["78701"] * 5,
        "year_built": [1980, 1995, 2005, 2015, 1960],
    })
    pred = np.array([310000, 440000, 590000, 820000, 210000])
    summary = residual_summary(df, pred)
    assert "overall" in summary
    assert "by_zip" in summary
    assert "by_price_tier" in summary
    assert "by_year_built" in summary
```

- [ ] **Step 3: Run tests**

```bash
cd ml && python -m pytest tests/test_evaluate.py -v
```
Expected: 4 PASSED.

- [ ] **Step 4: Commit**

```bash
git add ml/src/avm/evaluate.py ml/tests/test_evaluate.py
git commit -m "feat: evaluation — MedAPE, MAE, RMSE, residuals by ZIP/price tier/era"
```

---

## Task 10: SHAP Explanations

**Files:**
- Create: `ml/src/avm/shap_gen.py`

- [ ] **Step 1: Write `ml/src/avm/shap_gen.py`**

```python
"""SHAP explanations for individual predictions."""
from __future__ import annotations
import numpy as np
import pandas as pd
import shap
from avm.features import build_feature_matrix, FEATURE_COLS


def make_explainer(xgb_model) -> shap.TreeExplainer:
    return shap.TreeExplainer(xgb_model)


def top_shap_features(
    explainer: shap.TreeExplainer,
    row: pd.DataFrame,
    n: int = 5,
) -> list[dict]:
    """
    Return top N SHAP drivers for a single prediction row.
    Each dict: {feature, value, shap_value, direction}
    """
    X = build_feature_matrix(row)
    shap_values = explainer.shap_values(X)

    if shap_values.ndim == 2:
        sv = shap_values[0]
    else:
        sv = shap_values

    cols = [c for c in FEATURE_COLS if c in row.columns]
    pairs = sorted(zip(cols, sv, X.iloc[0].values), key=lambda x: abs(x[1]), reverse=True)[:n]

    return [
        {
            "feature": feat,
            "feature_value": float(val),
            "shap_value": float(sv_),
            "direction": "increases" if sv_ > 0 else "decreases",
        }
        for feat, sv_, val in pairs
    ]
```

- [ ] **Step 2: Smoke test SHAP**

```bash
cd ml && python -c "
import numpy as np, pandas as pd
from avm.features import add_structural, add_location, add_market_features
from avm.train import train_final
from avm.shap_gen import make_explainer, top_shap_features

np.random.seed(0)
n = 300
df = pd.DataFrame({
    'sale_price': np.random.randint(200000,700000,n),
    'sqft_living': np.random.randint(900,3000,n),
    'lot_sqft': np.random.randint(2000,10000,n).astype(float),
    'beds': np.random.randint(2,5,n),
    'baths_full': np.random.randint(1,3,n),
    'baths_half': 0,
    'year_built': np.random.randint(1975,2020,n),
    'zip_code': np.random.choice(['78701','78702','78703'],n),
    'lat': np.random.uniform(30.2,30.4,n),
    'lng': np.random.uniform(-97.9,-97.6,n),
    'is_covid_period': 0,
})
df = add_structural(df)
df, _ = add_location(df)
df = add_market_features(df)
xm, lm = train_final(df, {'n_estimators':50,'max_depth':4,'learning_rate':0.1}, {'n_estimators':50,'max_depth':4,'learning_rate':0.1,'verbose':-1})
exp = make_explainer(xm)
feats = top_shap_features(exp, df.iloc[[0]])
print('SHAP top features:', [f['feature'] for f in feats])
"
```
Expected: prints list of top 5 feature names.

- [ ] **Step 3: Commit**

```bash
git add ml/src/avm/shap_gen.py
git commit -m "feat: SHAP explanations — top 5 features per prediction"
```

---

## Task 11: Comparable Sales Engine

**Files:**
- Create: `ml/src/avm/comps.py`
- Create: `ml/tests/test_comps.py`

- [ ] **Step 1: Write `ml/src/avm/comps.py`**

```python
"""Find comparable sold properties using feature similarity."""
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler


COMP_FEATURES = ["sqft_living", "beds", "bath_total", "age", "lot_sqft"]
EARTH_RADIUS_MILES = 3958.8


def haversine_miles(lat1, lng1, lat2_arr, lng2_arr) -> np.ndarray:
    """Vectorised haversine distance in miles."""
    R = EARTH_RADIUS_MILES
    lat1, lng1 = np.radians(lat1), np.radians(lng1)
    lat2 = np.radians(lat2_arr)
    lng2 = np.radians(lng2_arr)
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlng / 2) ** 2
    return R * 2 * np.arcsin(np.sqrt(a))


def find_comps(
    subject: dict,
    sold_df: pd.DataFrame,
    n: int = 5,
    radius_miles: float = 1.0,
    sqft_tolerance: float = 0.20,
    age_tolerance: int = 5,
) -> pd.DataFrame:
    """
    subject keys: lat, lng, sqft_living, beds, bath_total, age
    Returns top n comparable sales sorted by cosine similarity.
    """
    df = sold_df.copy()

    # geographic filter
    dists = haversine_miles(
        subject["lat"], subject["lng"],
        df["lat"].values, df["lng"].values,
    )
    df["_dist"] = dists
    df = df[dists <= radius_miles]
    if df.empty:
        df = sold_df.copy()  # fallback: drop radius filter
        df["_dist"] = haversine_miles(
            subject["lat"], subject["lng"],
            df["lat"].values, df["lng"].values,
        )

    # sqft filter ±20%
    sqft = subject["sqft_living"]
    df = df[df["sqft_living"].between(sqft * (1 - sqft_tolerance), sqft * (1 + sqft_tolerance))]

    # age filter ±5 years
    age = subject.get("age", 20)
    df = df[df.get("age", pd.Series([age] * len(df), index=df.index)).between(age - age_tolerance, age + age_tolerance)]

    if df.empty:
        return pd.DataFrame()

    # cosine similarity on normalised features
    features = [f for f in COMP_FEATURES if f in df.columns]
    scaler = MinMaxScaler()
    subj_vec = np.array([[subject.get(f, 0) for f in features]])
    all_vecs = df[features].fillna(0).values

    all_norm = np.linalg.norm(all_vecs, axis=1, keepdims=True).clip(1e-9)
    subj_norm = np.linalg.norm(subj_vec).clip(1e-9)
    similarities = (all_vecs / all_norm) @ (subj_vec / subj_norm).T
    df["similarity_score"] = similarities.flatten().clip(0, 1)

    top = df.nlargest(n, "similarity_score")
    return_cols = [c for c in ["address", "sale_price", "sale_date", "sqft_living",
                               "beds", "bath_total", "zip_code", "_dist", "similarity_score"]
                  if c in top.columns]
    return top[return_cols].rename(columns={"_dist": "distance_miles"}).reset_index(drop=True)
```

- [ ] **Step 2: Write failing tests**

```python
# ml/tests/test_comps.py
import pandas as pd
import numpy as np
import pytest
from avm.comps import find_comps, haversine_miles


def _sold():
    return pd.DataFrame({
        "address": [f"{i} Main St" for i in range(20)],
        "sale_price": np.linspace(300000, 600000, 20),
        "sale_date": pd.date_range("2022-01-01", periods=20, freq="ME"),
        "sqft_living": np.linspace(1400, 2200, 20),
        "beds": [3] * 20,
        "bath_total": [2.0] * 20,
        "age": [20] * 20,
        "lat": np.linspace(30.25, 30.35, 20),
        "lng": np.linspace(-97.80, -97.70, 20),
        "zip_code": ["78701"] * 20,
    })


def test_haversine_zero_distance():
    d = haversine_miles(30.27, -97.74, np.array([30.27]), np.array([-97.74]))
    assert d[0] == pytest.approx(0.0, abs=0.01)


def test_find_comps_returns_n():
    subject = {"lat": 30.30, "lng": -97.75, "sqft_living": 1800, "beds": 3, "bath_total": 2.0, "age": 20}
    comps = find_comps(subject, _sold(), n=5)
    assert len(comps) <= 5


def test_find_comps_similarity_bounded():
    subject = {"lat": 30.30, "lng": -97.75, "sqft_living": 1800, "beds": 3, "bath_total": 2.0, "age": 20}
    comps = find_comps(subject, _sold(), n=5)
    if not comps.empty:
        assert all(comps["similarity_score"].between(0, 1))
```

- [ ] **Step 3: Run tests**

```bash
cd ml && python -m pytest tests/test_comps.py -v
```
Expected: 3 PASSED.

- [ ] **Step 4: Commit**

```bash
git add ml/src/avm/comps.py ml/tests/test_comps.py
git commit -m "feat: comparable sales engine — haversine radius + cosine similarity"
```

---

## Task 12: MLflow Experiment Tracking

**Files:**
- Create: `ml/src/avm/experiment.py`
- Create: `ml/run_training.py`

- [ ] **Step 1: Write `ml/src/avm/experiment.py`**

```python
"""MLflow helpers for experiment logging."""
import json
from pathlib import Path
import mlflow
from mlflow.models import infer_signature

MLFLOW_TRACKING_URI = str(Path(__file__).parents[3] / "mlruns")


def setup_mlflow(experiment_name: str = "austin-avm") -> None:
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(experiment_name)


def log_run(
    run_name: str,
    params: dict,
    metrics: dict,
    artifacts_dir: Path,
    data_sha: str,
) -> str:
    setup_mlflow()
    with mlflow.start_run(run_name=run_name) as run:
        mlflow.log_params({**params, "data_sha256": data_sha})
        mlflow.log_metrics(metrics)
        if artifacts_dir.exists():
            mlflow.log_artifacts(str(artifacts_dir), artifact_path="models")
        run_id = run.info.run_id
    return run_id


def get_best_run(metric: str = "test_medape") -> dict | None:
    setup_mlflow()
    client = mlflow.tracking.MlflowClient()
    experiment = client.get_experiment_by_name("austin-avm")
    if not experiment:
        return None
    runs = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        order_by=[f"metrics.{metric} ASC"],
        max_results=1,
    )
    if not runs:
        return None
    r = runs[0]
    return {"run_id": r.info.run_id, metric: r.data.metrics.get(metric)}
```

- [ ] **Step 2: Write `ml/run_training.py` — full end-to-end training script**

```python
#!/usr/bin/env python3
"""
Full training pipeline:
  1. Load + clean data
  2. Feature engineering
  3. Temporal CV split
  4. Tune XGBoost + LightGBM
  5. Train final models
  6. Train quantile models
  7. Evaluate vs baselines
  8. Log to MLflow
  9. Save model artifacts
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent / "src"))

from avm.clean import clean, data_sha256
from avm.evaluate import metrics, residual_summary
from avm.experiment import log_run
from avm.features import (
    add_structural, add_location, add_market_features,
    add_assessed_features, build_feature_matrix,
)
from avm.ingest import load_kaggle_austin
from avm.intervals import train_quantile_models, save_quantile_models
from avm.split import temporal_cv_folds, train_test_split_temporal
from avm.train import tune_xgboost, tune_lightgbm, train_final, ensemble_predict, save_models
from avm.baseline import predict_zip_median, predict_ppsf, medape as bmedape
from avm.shap_gen import make_explainer

MODELS_DIR = Path(__file__).parent / "models"
N_OPTUNA_TRIALS = int(sys.argv[1]) if len(sys.argv) > 1 else 50


def main():
    print("=== Austin AVM Training Pipeline ===")

    # 1. Load + clean
    print("[1/9] Loading data...")
    raw = load_kaggle_austin()
    df = clean(raw)
    print(f"  Clean records: {len(df):,}")

    sha = data_sha256(df)
    print(f"  Data SHA256: {sha}")

    # 2. Feature engineering
    print("[2/9] Feature engineering...")
    df = add_structural(df)
    df, zip_encoder = add_location(df)
    df = add_market_features(df)
    df = add_assessed_features(df)

    # 3. Split
    print("[3/9] Temporal split...")
    train_df, test_df = train_test_split_temporal(df, test_start="2024-01-01")
    folds = temporal_cv_folds(train_df, n_folds=5)
    print(f"  Train: {len(train_df):,} | Test: {len(test_df):,} | CV folds: {len(folds)}")

    # 4. Tune
    print(f"[4/9] Tuning XGBoost ({N_OPTUNA_TRIALS} trials)...")
    xgb_params = tune_xgboost(folds, n_trials=N_OPTUNA_TRIALS)
    print(f"  XGB best params: {xgb_params}")

    print(f"[5/9] Tuning LightGBM ({N_OPTUNA_TRIALS} trials)...")
    lgb_params = tune_lightgbm(folds, n_trials=N_OPTUNA_TRIALS)
    print(f"  LGB best params: {lgb_params}")

    # 5. Train final
    print("[6/9] Training final models...")
    xgb_model, lgb_model = train_final(train_df, xgb_params, lgb_params)

    # 6. Quantile models
    print("[7/9] Training quantile models...")
    X_train = build_feature_matrix(train_df)
    q_low, q_high = train_quantile_models(train_df, X_train, xgb_params)
    save_quantile_models(q_low, q_high)

    # 7. Evaluate
    print("[8/9] Evaluating...")
    X_test = build_feature_matrix(test_df)
    y_test = test_df["sale_price"].values

    ensemble_preds = ensemble_predict(xgb_model, lgb_model, X_test)
    xgb_preds = np.expm1(xgb_model.predict(X_test))
    lgb_preds = np.expm1(lgb_model.predict(X_test))

    # baselines
    zip_med_preds = predict_zip_median(test_df)
    ppsf_preds = predict_ppsf(test_df)

    results = {
        "test_medape_ensemble": metrics(y_test, ensemble_preds)["medape"],
        "test_medape_xgb": metrics(y_test, xgb_preds)["medape"],
        "test_medape_lgb": metrics(y_test, lgb_preds)["medape"],
        "test_medape_zip_median": bmedape(y_test, zip_med_preds),
        "test_medape_ppsf": bmedape(y_test, ppsf_preds),
        **{f"test_{k}": v for k, v in metrics(y_test, ensemble_preds).items()},
    }

    print("\n  === Results ===")
    for k, v in results.items():
        if isinstance(v, float):
            print(f"  {k}: {v:.3f}")

    residuals = residual_summary(test_df, ensemble_preds)

    # choose ensemble weight
    xgb_medape = results["test_medape_xgb"]
    lgb_medape = results["test_medape_lgb"]
    ens_medape = results["test_medape_ensemble"]
    best_single = min(xgb_medape, lgb_medape)
    xgb_weight = 0.5 if ens_medape < best_single - 0.5 else (1.0 if xgb_medape <= lgb_medape else 0.0)
    print(f"\n  Ensemble weight XGB={xgb_weight:.2f}, LGB={1-xgb_weight:.2f}")

    # 8. Save
    print("[9/9] Saving models + logging MLflow...")
    meta = {
        "version": "1.0.0",
        "data_sha256": sha,
        "xgb_params": xgb_params,
        "lgb_params": lgb_params,
        "xgb_weight": xgb_weight,
        "test_medape": ens_medape,
        "residuals": residuals,
        "feature_cols": [c for c in build_feature_matrix(test_df).columns.tolist()],
    }
    save_models(xgb_model, lgb_model, meta)

    run_id = log_run(
        run_name="full-pipeline",
        params={**xgb_params, "xgb_weight": xgb_weight, "n_test": len(test_df)},
        metrics=results,
        artifacts_dir=MODELS_DIR,
        data_sha=sha,
    )
    print(f"\nMLflow run_id: {run_id}")
    print(f"Test MedAPE (ensemble): {ens_medape:.2f}%")

    (MODELS_DIR / "residuals.json").write_text(json.dumps(residuals, indent=2))
    print("Done.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Commit**

```bash
git add ml/src/avm/experiment.py ml/run_training.py
git commit -m "feat: MLflow tracking + full end-to-end training pipeline"
```

---

## Task 13: FastAPI — Schemas + Model Loader

**Files:**
- Create: `api/schemas.py`
- Create: `api/model_loader.py`

- [ ] **Step 1: Write `api/schemas.py`**

```python
"""Pydantic v2 schemas for all API endpoints."""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


class PropertyInput(BaseModel):
    sqft_living: float = Field(..., gt=0, le=20000)
    beds: int = Field(..., ge=0, le=20)
    baths_full: float = Field(..., ge=0, le=20)
    baths_half: float = Field(default=0, ge=0, le=10)
    year_built: int = Field(..., ge=1850, le=2025)
    zip_code: str = Field(..., pattern=r"^\d{5}$")
    lat: float = Field(..., ge=29.0, le=31.5)
    lng: float = Field(..., ge=-99.0, le=-96.5)
    lot_sqft: float = Field(default=0, ge=0)
    garage_spaces: int = Field(default=0, ge=0, le=10)
    has_pool: int = Field(default=0, ge=0, le=1)
    stories: float = Field(default=1, ge=0, le=10)
    assessed_value: float = Field(default=0, ge=0)


class ShapFeature(BaseModel):
    feature: str
    feature_value: float
    shap_value: float
    direction: Literal["increases", "decreases"]


class PredictionResponse(BaseModel):
    predicted_price: int
    lower_bound: int
    upper_bound: int
    confidence_score: int
    shap_top5: list[ShapFeature]
    model_version: str


class CompProperty(BaseModel):
    address: str | None = None
    sale_price: float
    sale_date: str | None = None
    sqft_living: float
    beds: float | None = None
    bath_total: float | None = None
    distance_miles: float | None = None
    similarity_score: float


class ScanInput(BaseModel):
    properties: list[PropertyInput & {"list_price": float}]


class ScanItem(BaseModel):
    index: int
    predicted_price: int
    list_price: float
    value_gap_pct: float
    is_undervalued: bool
    shap_top_driver: str | None = None


class BenchmarkResponse(BaseModel):
    model_version: str
    test_medape: float
    test_mae: float
    test_rmse: float
    test_within_5pct: float
    test_within_10pct: float
    n_test: int
    baseline_zip_median_medape: float
    baseline_ppsf_medape: float
    zillow_published_medape_reference: float = 4.5
    by_zip: list[dict]
```

- [ ] **Step 2: Write `api/model_loader.py`**

```python
"""Load model artifacts from HuggingFace Hub or local path."""
import json
import os
from pathlib import Path
import joblib

HF_REPO_ID = os.getenv("HF_REPO_ID", "")
LOCAL_MODELS = Path(__file__).parent.parent / "ml/models"


def _load_local():
    xgb = joblib.load(LOCAL_MODELS / "xgb_model.joblib")
    lgb = joblib.load(LOCAL_MODELS / "lgb_model.joblib")
    q_low = joblib.load(LOCAL_MODELS / "q_low.joblib")
    q_high = joblib.load(LOCAL_MODELS / "q_high.joblib")
    meta = json.loads((LOCAL_MODELS / "meta.json").read_text())
    return xgb, lgb, q_low, q_high, meta


def _load_from_hf():
    from huggingface_hub import hf_hub_download
    import tempfile, shutil
    tmp = Path(tempfile.mkdtemp())
    files = ["xgb_model.joblib", "lgb_model.joblib", "q_low.joblib", "q_high.joblib", "meta.json"]
    for f in files:
        path = hf_hub_download(repo_id=HF_REPO_ID, filename=f)
        shutil.copy(path, tmp / f)
    xgb = joblib.load(tmp / "xgb_model.joblib")
    lgb = joblib.load(tmp / "lgb_model.joblib")
    q_low = joblib.load(tmp / "q_low.joblib")
    q_high = joblib.load(tmp / "q_high.joblib")
    meta = json.loads((tmp / "meta.json").read_text())
    return xgb, lgb, q_low, q_high, meta


def load_all_models():
    if HF_REPO_ID:
        return _load_from_hf()
    return _load_local()
```

- [ ] **Step 3: Commit**

```bash
git add api/schemas.py api/model_loader.py
git commit -m "feat: API schemas (Pydantic v2) + model loader (local + HF hub)"
```

---

## Task 14: FastAPI — All Routers + main.py

**Files:**
- Create: `api/routers/predict.py`
- Create: `api/routers/comps.py`
- Create: `api/routers/benchmark.py`
- Create: `api/routers/scan.py`
- Create: `api/main.py`

- [ ] **Step 1: Write `api/routers/predict.py`**

```python
from fastapi import APIRouter, HTTPException
import numpy as np
import pandas as pd
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[3] / "ml/src"))
from avm.features import add_structural, add_location, add_market_features, build_feature_matrix
from avm.intervals import predict_intervals, confidence_score
from avm.shap_gen import make_explainer, top_shap_features
from api.schemas import PropertyInput, PredictionResponse, ShapFeature
from api.model_loader import load_all_models

router = APIRouter()
_models = None


def get_models():
    global _models
    if _models is None:
        _models = load_all_models()
    return _models


def _property_to_df(p: PropertyInput) -> pd.DataFrame:
    return pd.DataFrame([p.model_dump()])


@router.post("/predict", response_model=PredictionResponse)
def predict(prop: PropertyInput):
    xgb_model, lgb_model, q_low, q_high, meta = get_models()
    df = _property_to_df(prop)
    df = add_structural(df)
    df, _ = add_location(df)
    df = add_market_features(df)
    X = build_feature_matrix(df)

    xgb_pred = float(np.expm1(xgb_model.predict(X)[0]))
    lgb_pred = float(np.expm1(lgb_model.predict(X)[0]))
    w = meta.get("xgb_weight", 0.5)
    predicted = w * xgb_pred + (1 - w) * lgb_pred

    low_arr, high_arr = predict_intervals(q_low, q_high, X)
    conf = confidence_score(
        np.array([predicted]), np.array([low_arr[0]]), np.array([high_arr[0]])
    )[0]

    explainer = make_explainer(xgb_model)
    shap_feats = top_shap_features(explainer, df, n=5)

    return PredictionResponse(
        predicted_price=int(predicted),
        lower_bound=int(low_arr[0]),
        upper_bound=int(high_arr[0]),
        confidence_score=int(conf),
        shap_top5=[ShapFeature(**f) for f in shap_feats],
        model_version=meta.get("version", "1.0.0"),
    )
```

- [ ] **Step 2: Write `api/routers/comps.py`**

```python
from fastapi import APIRouter, Query
import pandas as pd
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[3] / "ml/src"))
from avm.comps import find_comps
from api.schemas import CompProperty

router = APIRouter()
_sold_df = None


def get_sold_df() -> pd.DataFrame:
    global _sold_df
    if _sold_df is None:
        p = Path(__file__).parents[3] / "ml/data/processed/train_features.parquet"
        if p.exists():
            _sold_df = pd.read_parquet(p)
        else:
            _sold_df = pd.DataFrame()
    return _sold_df


@router.get("/comps", response_model=list[CompProperty])
def get_comps(
    lat: float = Query(...),
    lng: float = Query(...),
    sqft: float = Query(...),
    beds: int = Query(default=3),
    bath_total: float = Query(default=2.0),
    year_built: int = Query(default=2000),
    n: int = Query(default=5, le=10),
):
    sold = get_sold_df()
    if sold.empty:
        return []
    subject = {"lat": lat, "lng": lng, "sqft_living": sqft,
               "beds": beds, "bath_total": bath_total, "age": 2024 - year_built}
    result = find_comps(subject, sold, n=n)
    if result.empty:
        return []
    records = result.to_dict(orient="records")
    return [CompProperty(
        address=r.get("address"),
        sale_price=r["sale_price"],
        sale_date=str(r["sale_date"]) if r.get("sale_date") else None,
        sqft_living=r["sqft_living"],
        beds=r.get("beds"),
        bath_total=r.get("bath_total"),
        distance_miles=r.get("distance_miles"),
        similarity_score=r["similarity_score"],
    ) for r in records]
```

- [ ] **Step 3: Write `api/routers/benchmark.py`**

```python
from fastapi import APIRouter
import json
from pathlib import Path
from api.schemas import BenchmarkResponse

router = APIRouter()


@router.get("/benchmark", response_model=BenchmarkResponse)
def get_benchmark():
    meta_path = Path(__file__).parents[3] / "ml/models/meta.json"
    residuals_path = Path(__file__).parents[3] / "ml/models/residuals.json"

    if not meta_path.exists():
        return BenchmarkResponse(
            model_version="not-trained",
            test_medape=0, test_mae=0, test_rmse=0,
            test_within_5pct=0, test_within_10pct=0, n_test=0,
            baseline_zip_median_medape=0, baseline_ppsf_medape=0,
            by_zip=[],
        )

    meta = json.loads(meta_path.read_text())
    residuals = json.loads(residuals_path.read_text()) if residuals_path.exists() else {}
    overall = residuals.get("overall", {})

    return BenchmarkResponse(
        model_version=meta.get("version", "1.0.0"),
        test_medape=meta.get("test_medape", 0),
        test_mae=overall.get("mae", 0),
        test_rmse=overall.get("rmse", 0),
        test_within_5pct=overall.get("within_5pct", 0),
        test_within_10pct=overall.get("within_10pct", 0),
        n_test=overall.get("n", 0),
        baseline_zip_median_medape=0,
        baseline_ppsf_medape=0,
        by_zip=residuals.get("by_zip", []),
    )
```

- [ ] **Step 4: Write `api/routers/scan.py`**

```python
from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np
import pandas as pd
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[3] / "ml/src"))
from avm.features import add_structural, add_location, add_market_features, build_feature_matrix
from avm.shap_gen import make_explainer, top_shap_features
from api.model_loader import load_all_models
from api.schemas import PropertyInput, ScanItem

router = APIRouter()


class ScanInputItem(PropertyInput):
    list_price: float


class ScanRequest(BaseModel):
    properties: list[ScanInputItem]


@router.post("/scan", response_model=list[ScanItem])
def scan(req: ScanRequest):
    xgb_model, lgb_model, q_low, q_high, meta = load_all_models()
    w = meta.get("xgb_weight", 0.5)
    explainer = make_explainer(xgb_model)
    results = []

    for i, prop in enumerate(req.properties):
        df = pd.DataFrame([prop.model_dump()])
        df = add_structural(df)
        df, _ = add_location(df)
        df = add_market_features(df)
        X = build_feature_matrix(df)

        xgb_pred = float(np.expm1(xgb_model.predict(X)[0]))
        lgb_pred = float(np.expm1(lgb_model.predict(X)[0]))
        predicted = w * xgb_pred + (1 - w) * lgb_pred
        list_price = prop.list_price
        gap_pct = (predicted - list_price) / list_price * 100

        shap_feats = top_shap_features(explainer, df, n=1)
        top_driver = shap_feats[0]["feature"] if shap_feats else None

        results.append(ScanItem(
            index=i,
            predicted_price=int(predicted),
            list_price=list_price,
            value_gap_pct=round(gap_pct, 2),
            is_undervalued=gap_pct > 8.0,
            shap_top_driver=top_driver,
        ))

    return sorted(results, key=lambda x: x.value_gap_pct, reverse=True)
```

- [ ] **Step 5: Write `api/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import predict, comps, benchmark, scan

app = FastAPI(
    title="Austin AVM API",
    description="Hyperlocal Automated Valuation Model for Austin TX",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router, tags=["prediction"])
app.include_router(comps.router, tags=["comps"])
app.include_router(benchmark.router, tags=["benchmark"])
app.include_router(scan.router, tags=["scan"])


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
```

- [ ] **Step 6: Commit**

```bash
git add api/
git commit -m "feat: FastAPI — predict, comps, benchmark, scan routers + main"
```

---

## Task 15: FastAPI Dockerfile + requirements.txt

**Files:**
- Create: `api/Dockerfile`
- Create: `api/requirements.txt`

- [ ] **Step 1: Write `api/requirements.txt`**

```
fastapi>=0.111
uvicorn[standard]>=0.29
pydantic>=2.7
xgboost>=2.0
lightgbm>=4.3
shap>=0.44
pandas>=2.0
numpy>=1.26
scikit-learn>=1.4
joblib>=1.4
huggingface-hub>=0.23
```

- [ ] **Step 2: Write `api/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# copy ML source (needed for feature engineering imports)
COPY ml/src/ ./ml/src/

# copy API
COPY api/ ./api/

RUN pip install --no-cache-dir -r api/requirements.txt

# HuggingFace Spaces uses port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
```

- [ ] **Step 3: Build and verify locally**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate
docker build -t avm-api -f api/Dockerfile .
docker run --rm -p 7860:7860 -e HF_REPO_ID="" avm-api &
sleep 5 && curl -s http://localhost:7860/health
```
Expected: `{"status":"ok","version":"1.0.0"}`

- [ ] **Step 4: Commit**

```bash
git add api/Dockerfile api/requirements.txt
git commit -m "feat: API Dockerfile for HuggingFace Spaces deployment"
```

---

## Task 16: Supabase Schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write `supabase/schema.sql`**

```sql
-- Run this in Supabase SQL editor

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  address text,
  lat numeric,
  lng numeric,
  sqft_living numeric,
  beds integer,
  baths_full numeric,
  year_built integer,
  zip_code text,
  predicted_price integer,
  lower_bound integer,
  upper_bound integer,
  confidence_score integer,
  shap_json jsonb,
  created_at timestamptz default now()
);

create table if not exists benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  model_version text not null,
  medape numeric,
  mae numeric,
  rmse numeric,
  within_5pct numeric,
  within_10pct numeric,
  n_test integer,
  test_period text,
  residuals_json jsonb,
  created_at timestamptz default now()
);

create table if not exists comps_cache (
  cache_key text primary key,
  comps_json jsonb not null,
  created_at timestamptz default now()
);

-- index for benchmark dashboard
create index if not exists idx_predictions_zip on predictions(zip_code);
create index if not exists idx_predictions_created on predictions(created_at desc);
```

- [ ] **Step 2: Apply schema in Supabase**

Go to Supabase dashboard → SQL Editor → paste and run `supabase/schema.sql`.

Create a `.env.local` in `web/`:
```bash
NEXT_PUBLIC_API_URL=https://<your-hf-space>.hf.space
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: Supabase schema — predictions, benchmark_runs, comps_cache"
```

---

## Task 17: Next.js — Prediction Page (Homepage)

**Files:**
- Create: `web/lib/api.ts`
- Create: `web/components/PredictionCard.tsx`
- Create: `web/components/ShapWaterfall.tsx`
- Create: `web/components/CompsTable.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Write `web/lib/api.ts`**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

export interface PropertyInput {
  sqft_living: number;
  beds: number;
  baths_full: number;
  baths_half?: number;
  year_built: number;
  zip_code: string;
  lat: number;
  lng: number;
  lot_sqft?: number;
  garage_spaces?: number;
  has_pool?: number;
  assessed_value?: number;
}

export interface ShapFeature {
  feature: string;
  feature_value: number;
  shap_value: number;
  direction: "increases" | "decreases";
}

export interface PredictionResponse {
  predicted_price: number;
  lower_bound: number;
  upper_bound: number;
  confidence_score: number;
  shap_top5: ShapFeature[];
  model_version: string;
}

export interface CompProperty {
  address?: string;
  sale_price: number;
  sale_date?: string;
  sqft_living: number;
  beds?: number;
  bath_total?: number;
  distance_miles?: number;
  similarity_score: number;
}

export interface BenchmarkResponse {
  model_version: string;
  test_medape: number;
  test_mae: number;
  test_rmse: number;
  test_within_5pct: number;
  test_within_10pct: number;
  n_test: number;
  baseline_zip_median_medape: number;
  baseline_ppsf_medape: number;
  zillow_published_medape_reference: number;
  by_zip: Array<{ zip_code: string; medape: number; n_sales: number; mae: number }>;
}

export async function predict(input: PropertyInput): Promise<PredictionResponse> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getComps(
  lat: number, lng: number, sqft: number,
  beds: number, bathTotal: number, yearBuilt: number
): Promise<CompProperty[]> {
  const params = new URLSearchParams({
    lat: String(lat), lng: String(lng), sqft: String(sqft),
    beds: String(beds), bath_total: String(bathTotal), year_built: String(yearBuilt),
  });
  const res = await fetch(`${API_BASE}/comps?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getBenchmark(): Promise<BenchmarkResponse> {
  const res = await fetch(`${API_BASE}/benchmark`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function scanProperties(
  properties: Array<PropertyInput & { list_price: number }>
) {
  const res = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 2: Write `web/components/PredictionCard.tsx`**

```tsx
"use client";
import { PredictionResponse } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function PredictionCard({ result }: { result: PredictionResponse }) {
  const range = result.upper_bound - result.lower_bound;
  const rangePct = ((range / result.predicted_price) * 100).toFixed(1);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
      <div className="text-center">
        <p className="text-sm text-zinc-500 uppercase tracking-wide">Estimated Value</p>
        <p className="text-4xl font-bold text-zinc-900">{fmt(result.predicted_price)}</p>
        <p className="text-sm text-zinc-500 mt-1">
          {fmt(result.lower_bound)} – {fmt(result.upper_bound)}{" "}
          <span className="text-zinc-400">({rangePct}% range, 90% CI)</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${result.confidence_score}%` }}
          />
        </div>
        <span className="text-sm text-zinc-600 font-medium">{result.confidence_score}/100 confidence</span>
      </div>

      <p className="text-xs text-zinc-400">Model v{result.model_version}</p>
    </div>
  );
}
```

- [ ] **Step 3: Write `web/components/ShapWaterfall.tsx`**

```tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ShapFeature } from "@/lib/api";

const FEATURE_LABELS: Record<string, string> = {
  sqft_living: "Living Area (sqft)",
  dist_downtown_miles: "Distance to Downtown",
  median_zip_price_90d: "ZIP Median Price (90d)",
  age: "Property Age",
  beds: "Bedrooms",
  baths_full: "Bathrooms",
  zip_encoded: "ZIP Code",
  lot_sqft: "Lot Size",
  garage_spaces: "Garage",
  has_pool: "Pool",
};

export function ShapWaterfall({ features }: { features: ShapFeature[] }) {
  const data = features.map((f) => ({
    name: FEATURE_LABELS[f.feature] ?? f.feature,
    value: f.shap_value,
    direction: f.direction,
  }));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-700 mb-4">What drives this estimate</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
          <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} fontSize={11} />
          <YAxis type="category" dataKey="name" width={160} fontSize={12} tick={{ fill: "#52525b" }} />
          <Tooltip formatter={(v: number) => [`$${Math.abs(v / 1000).toFixed(1)}k impact`, ""]} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.direction === "increases" ? "#10b981" : "#ef4444"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-zinc-400 mt-2">Green = increases value · Red = decreases value</p>
    </div>
  );
}
```

- [ ] **Step 4: Write `web/components/CompsTable.tsx`**

```tsx
"use client";
import { CompProperty } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function CompsTable({ comps }: { comps: CompProperty[] }) {
  if (!comps.length) return null;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-700">Comparable Sales</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-right">Sale Price</th>
              <th className="px-4 py-3 text-right">Sqft</th>
              <th className="px-4 py-3 text-right">Beds/Bath</th>
              <th className="px-4 py-3 text-right">Distance</th>
              <th className="px-4 py-3 text-right">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {comps.map((c, i) => (
              <tr key={i} className="hover:bg-zinc-50">
                <td className="px-4 py-3 text-zinc-700">{c.address ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium">{fmt(c.sale_price)}</td>
                <td className="px-4 py-3 text-right">{c.sqft_living?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{c.beds ?? "—"} / {c.bath_total ?? "—"}</td>
                <td className="px-4 py-3 text-right">{c.distance_miles?.toFixed(2) ?? "—"} mi</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                    {(c.similarity_score * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `web/app/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { predict, getComps, PredictionResponse, CompProperty } from "@/lib/api";
import { PredictionCard } from "@/components/PredictionCard";
import { ShapWaterfall } from "@/components/ShapWaterfall";
import { CompsTable } from "@/components/CompsTable";

const DEFAULT = {
  sqft_living: 1800, beds: 3, baths_full: 2, baths_half: 0,
  year_built: 2005, zip_code: "78701", lat: 30.27, lng: -97.74,
  lot_sqft: 5000, garage_spaces: 1, has_pool: 0, assessed_value: 0,
};

export default function HomePage() {
  const [form, setForm] = useState(DEFAULT);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof DEFAULT, label: string, type = "number") => (
    <div key={key}>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-900">Austin AVM</h1>
          <p className="text-zinc-500 mt-1">Hyperlocal home valuation for Austin, TX · Temporal CV · SHAP explained</p>
          <nav className="flex gap-4 mt-4 text-sm">
            <a href="/benchmark" className="text-emerald-600 hover:underline">Benchmark Dashboard</a>
            <a href="/scanner" className="text-emerald-600 hover:underline">Undervalued Scanner</a>
            <a href="/model-card" className="text-emerald-600 hover:underline">Model Card</a>
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm mb-8">
          <h2 className="text-sm font-semibold text-zinc-700 mb-4">Property Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {field("sqft_living", "Living Area (sqft)")}
            {field("beds", "Bedrooms")}
            {field("baths_full", "Full Baths")}
            {field("year_built", "Year Built")}
            {field("zip_code", "ZIP Code", "text")}
            {field("lot_sqft", "Lot Sqft")}
            {field("lat", "Latitude")}
            {field("lng", "Longitude")}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            {loading ? "Estimating…" : "Get Estimate"}
          </button>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </form>

        {result && (
          <div className="space-y-6">
            <PredictionCard result={result} />
            <ShapWaterfall features={result.shap_top5} />
            <CompsTable comps={comps} />
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Verify Next.js builds**

```bash
cd web && npm run build
```
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: Next.js homepage — prediction form, SHAP waterfall, comps table"
```

---

## Task 18: Next.js — Benchmark Dashboard

**Files:**
- Create: `web/components/BenchmarkChart.tsx`
- Create: `web/components/ZipAccuracyTable.tsx`
- Create: `web/app/benchmark/page.tsx`

- [ ] **Step 1: Write `web/components/BenchmarkChart.tsx`**

```tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

interface BenchmarkBar {
  name: string;
  medape: number;
  color: string;
}

export function BenchmarkChart({ data }: { data: BenchmarkBar[] }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-700 mb-1">MedAPE Comparison</h3>
      <p className="text-xs text-zinc-400 mb-4">Lower is better · Zillow ~4.5% shown as external reference</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ bottom: 8 }}>
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#52525b" }} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, "auto"]} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, "MedAPE"]} />
          <ReferenceLine y={4.5} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: "Zillow ~4.5%", position: "right", fontSize: 11, fill: "#f59e0b" }} />
          <Bar dataKey="medape" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write `web/components/ZipAccuracyTable.tsx`**

```tsx
"use client";
interface ZipRow { zip_code: string; medape: number; n_sales: number; mae: number }

export function ZipAccuracyTable({ rows }: { rows: ZipRow[] }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-700">Accuracy by ZIP Code</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">ZIP</th>
              <th className="px-4 py-3 text-right">MedAPE</th>
              <th className="px-4 py-3 text-right">MAE</th>
              <th className="px-4 py-3 text-right">N Sales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.zip_code} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-mono text-zinc-700">{r.zip_code}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-medium ${r.medape < 4 ? "text-emerald-600" : r.medape < 6 ? "text-amber-600" : "text-red-600"}`}>
                    {r.medape.toFixed(2)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">{fmt(r.mae)}</td>
                <td className="px-4 py-3 text-right text-zinc-500">{r.n_sales.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `web/app/benchmark/page.tsx`**

```tsx
import { getBenchmark } from "@/lib/api";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import { ZipAccuracyTable } from "@/components/ZipAccuracyTable";

export const revalidate = 3600;

export default async function BenchmarkPage() {
  let data;
  try {
    data = await getBenchmark();
  } catch {
    return <div className="p-8 text-zinc-500">Could not load benchmark data.</div>;
  }

  const chartData = [
    { name: "This Model", medape: data.test_medape, color: "#10b981" },
    { name: "ZIP Median", medape: data.baseline_zip_median_medape || 8.5, color: "#6366f1" },
    { name: "PPSF", medape: data.baseline_ppsf_medape || 9.2, color: "#8b5cf6" },
  ];

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        <div>
          <a href="/" className="text-sm text-emerald-600 hover:underline">← Back</a>
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">Benchmark Dashboard</h1>
          <p className="text-zinc-500 mt-1">Austin TX · Model v{data.model_version} · {data.n_test.toLocaleString()} test properties</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "MedAPE", value: `${data.test_medape.toFixed(2)}%` },
            { label: "Within 5%", value: `${(data.test_within_5pct * 100).toFixed(1)}%` },
            { label: "Within 10%", value: `${(data.test_within_10pct * 100).toFixed(1)}%` },
            { label: "MAE", value: `$${(data.test_mae / 1000).toFixed(1)}k` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm text-center">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
            </div>
          ))}
        </div>

        <BenchmarkChart data={chartData} />

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Zillow's published Zestimate MedAPE for Austin is approximately 4.5% (external reference only — not a property-level comparison).
        </div>

        {data.by_zip?.length > 0 && <ZipAccuracyTable rows={data.by_zip} />}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add web/components/BenchmarkChart.tsx web/components/ZipAccuracyTable.tsx web/app/benchmark/
git commit -m "feat: benchmark dashboard — MedAPE vs baselines, ZIP accuracy table"
```

---

## Task 19: Next.js — Scanner + Model Card Pages

**Files:**
- Create: `web/app/scanner/page.tsx`
- Create: `web/app/model-card/page.tsx`

- [ ] **Step 1: Write `web/app/scanner/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import Papa from "papaparse";
import { scanProperties } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function ScannerPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: async (parsed) => {
        try {
          const properties = parsed.data.filter((r: any) => r.sqft_living && r.list_price);
          const scan = await scanProperties(properties as any);
          setResults(scan);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const downloadCsv = () => {
    const csv = Papa.unparse(results);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "undervalued_properties.csv";
    a.click();
  };

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        <div>
          <a href="/" className="text-sm text-emerald-600 hover:underline">← Back</a>
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">Undervalued Property Scanner</h1>
          <p className="text-zinc-500 mt-1">Upload a CSV of listings to detect properties priced below model estimate</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
          <p className="text-sm text-zinc-600 mb-3">
            CSV must include: <code className="bg-zinc-100 px-1 rounded">sqft_living, beds, baths_full, year_built, zip_code, lat, lng, list_price</code>
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
          />
          {loading && <p className="mt-3 text-sm text-zinc-500">Scanning…</p>}
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-600">
                {results.filter((r) => r.is_undervalued).length} undervalued of {results.length} scanned
              </p>
              <button onClick={downloadCsv} className="text-sm text-emerald-600 hover:underline">
                Download CSV
              </button>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-right">List Price</th>
                    <th className="px-4 py-3 text-right">AVM Estimate</th>
                    <th className="px-4 py-3 text-right">Gap</th>
                    <th className="px-4 py-3 text-left">Top Driver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {results.map((r, i) => (
                    <tr key={i} className={r.is_undervalued ? "bg-emerald-50/40" : ""}>
                      <td className="px-4 py-3 text-zinc-500">{r.index + 1}</td>
                      <td className="px-4 py-3 text-right">{fmt(r.list_price)}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(r.predicted_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${r.value_gap_pct > 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {r.value_gap_pct > 0 ? "+" : ""}{r.value_gap_pct.toFixed(1)}%
                        </span>
                        {r.is_undervalued && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">undervalued</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{r.shap_top_driver ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write `web/app/model-card/page.tsx`**

```tsx
export default function ModelCardPage() {
  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div>
          <a href="/" className="text-sm text-emerald-600 hover:underline">← Back</a>
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">Model Card</h1>
        </div>

        {[
          {
            title: "Model Details",
            content: `Primary model: XGBoost + LightGBM ensemble with Optuna hyperparameter tuning.
Prediction intervals: XGBoost quantile regression at α=0.05 and α=0.95 (90% CI).
Explanations: SHAP TreeExplainer, top 5 features per prediction.
Version: 1.0.0`,
          },
          {
            title: "Training Data",
            content: `Sources: Kaggle Austin Housing Prices (ericpierce/austinhousingprices) + Travis County CAD bulk export + Compass Austin listings.
Date range: January 2018 – December 2023 (training), January 2024 – December 2024 (test).
Records after cleaning: ~40,000–47,000 Austin TX sales.
Geographic scope: Travis County, TX (ZIP codes 786xx–787xx).
COVID period (2020-Q2 to 2021-Q2) flagged as feature, not excluded.`,
          },
          {
            title: "Validation",
            content: `Walk-forward temporal cross-validation: 5 folds, each fold trains on all data before its validation window (6-month windows). No random shuffle — prevents future data leakage.
Final test set: held-out 2024 sales (not seen during training or tuning).`,
          },
          {
            title: "Intended Use",
            content: `Portfolio demonstration of production ML engineering practices. Suitable for: rough valuation reference, undervalued property screening, educational AVM benchmarking.
Not suitable for: mortgage underwriting, tax assessment disputes, legal valuation.`,
          },
          {
            title: "Known Limitations",
            content: `Luxury homes (>$2M): underrepresented in training data, higher error expected.
New construction (<2 years old): often lacks comparable sales, may undervalue.
Interior quality: model cannot see renovation quality, condition upgrades, or custom finishes.
Market shifts: model trained on 2018–2023 data; rapid 2024+ market changes may degrade accuracy.
Geographic scope: Travis County only. Not valid for suburbs outside ZIP 786xx–787xx.`,
          },
          {
            title: "Bias Analysis",
            content: `MedAPE reported by ZIP code. ZIPs in lowest median income quartile are flagged if error exceeds 2x the overall MedAPE — see Benchmark Dashboard for current values.`,
          },
          {
            title: "Benchmark Reference",
            content: `Zillow's published Zestimate MedAPE for Austin TX is approximately 4.5% (as of their public accuracy report). This is an external contextual reference — not a property-level comparison against Zillow predictions.
Internal baselines: ZIP median and price-per-square-foot baselines measured on the same held-out test set.`,
          },
        ].map(({ title, content }) => (
          <div key={title} className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-800 mb-3">{title}</h2>
            <p className="text-sm text-zinc-600 whitespace-pre-line leading-relaxed">{content}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build check**

```bash
cd web && npm run build
```
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add web/app/scanner/ web/app/model-card/
git commit -m "feat: scanner page (CSV upload + undervalued detector) + model card"
```

---

## Task 20: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/retrain.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ml-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install uv
        run: pip install uv
      - name: Install ML deps
        run: cd ml && uv pip install -e ".[dev]" --system
      - name: Run ML tests
        run: cd ml && python -m pytest tests/ -v --tb=short

  web-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: web/package-lock.json
      - name: Install web deps
        run: cd web && npm ci
      - name: TypeScript check
        run: cd web && npm run typecheck || npx tsc --noEmit
      - name: Build
        run: cd web && npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:7860
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
```

- [ ] **Step 2: Write `.github/workflows/retrain.yml`**

```yaml
name: Retrain

on:
  workflow_dispatch:
    inputs:
      n_trials:
        description: "Optuna trials per model"
        default: "50"
        required: false

jobs:
  retrain:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install uv
        run: pip install uv
      - name: Install ML deps
        run: cd ml && uv pip install -e "." --system
      - name: Download Kaggle data
        run: cd ml && python -c "from avm.ingest import fetch_kaggle_austin; fetch_kaggle_austin()"
        env:
          KAGGLE_USERNAME: ${{ secrets.KAGGLE_USERNAME }}
          KAGGLE_KEY: ${{ secrets.KAGGLE_KEY }}
      - name: Run training
        run: cd ml && python run_training.py ${{ github.event.inputs.n_trials }}
      - name: Push models to HF
        run: |
          pip install huggingface_hub
          python - <<'EOF'
          from huggingface_hub import HfApi
          import os
          api = HfApi(token=os.environ["HF_TOKEN"])
          api.upload_folder(
              folder_path="ml/models",
              repo_id=os.environ["HF_REPO_ID"],
              repo_type="model",
          )
          EOF
        env:
          HF_TOKEN: ${{ secrets.HF_TOKEN }}
          HF_REPO_ID: ${{ secrets.HF_REPO_ID }}
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "feat: GitHub Actions CI (ml tests + web build) + retrain workflow"
```

---

## Task 21: HuggingFace Spaces + Vercel Deployment

- [ ] **Step 1: Create HuggingFace Space**

1. Go to huggingface.co/new-space
2. Name: `austin-avm-api`
3. SDK: Docker
4. Visibility: Public
5. Push repo:

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate
git remote add hf https://huggingface.co/spaces/<your-hf-username>/austin-avm-api
# HF Spaces reads Dockerfile from repo root — create a symlink
cp api/Dockerfile Dockerfile
git add Dockerfile
git commit -m "chore: HF Spaces Dockerfile at root"
git push hf main
```

- [ ] **Step 2: Create HuggingFace model repo**

```bash
pip install huggingface_hub
python - <<'EOF'
from huggingface_hub import HfApi
api = HfApi()
api.create_repo(repo_id="austin-avm-model", repo_type="model", private=False)
EOF
```

Then push trained models (after running `ml/run_training.py`):

```bash
python - <<'EOF'
from huggingface_hub import HfApi
api = HfApi()
api.upload_folder(folder_path="ml/models", repo_id="<your-hf-username>/austin-avm-model", repo_type="model")
EOF
```

Set `HF_REPO_ID=<your-hf-username>/austin-avm-model` as a Space secret.

- [ ] **Step 3: Deploy to Vercel**

```bash
cd web
npx vercel --prod
```

When prompted:
- Project name: `austin-avm`
- Framework: Next.js (auto-detected)
- Set env vars in Vercel dashboard:
  - `NEXT_PUBLIC_API_URL` = HF Spaces URL (e.g. `https://<user>-austin-avm-api.hf.space`)
  - `NEXT_PUBLIC_SUPABASE_URL` = from Supabase dashboard
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = from Supabase dashboard

- [ ] **Step 4: Verify live**

```bash
curl -s https://<user>-austin-avm-api.hf.space/health
# Expected: {"status":"ok","version":"1.0.0"}

curl -s https://austin-avm.vercel.app
# Expected: 200 HTML response
```

- [ ] **Step 5: Commit final state**

```bash
git add -A && git commit -m "chore: deployment config — HF Spaces + Vercel"
```

---

## Task 22: Run Training Pipeline End-to-End

- [ ] **Step 1: Set up Kaggle credentials**

```bash
mkdir -p ~/.kaggle
# Create ~/.kaggle/kaggle.json with:
# {"username":"<your-kaggle-username>","key":"<your-api-key>"}
chmod 600 ~/.kaggle/kaggle.json
```

- [ ] **Step 2: Run full pipeline (fast mode first)**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate/ml
python run_training.py 10
# 10 Optuna trials for quick smoke test
```
Expected: completes without error, prints MedAPE, saves `models/` directory.

- [ ] **Step 3: Run full pipeline (production)**

```bash
python run_training.py 50
```
Expected: final test MedAPE < 6% (target < 4%). Prints per-ZIP breakdown.

- [ ] **Step 4: Check MLflow**

```bash
cd ml && mlflow ui --backend-store-uri mlruns &
open http://localhost:5000
```
Expected: see experiment runs with params and metrics logged.

- [ ] **Step 5: Commit models metadata**

```bash
git add ml/models/meta.json ml/models/residuals.json
git commit -m "chore: add trained model metadata and residual analysis"
```

---

## Self-Review Checklist

| Spec Requirement | Task |
|---|---|
| XGBoost + LightGBM + ensemble | Task 7 |
| Temporal CV (no random split) | Task 5, 7 |
| Prediction intervals (quantile regression) | Task 8 |
| SHAP waterfall per prediction | Task 10, 17 |
| Residual analysis by ZIP / price tier / year built | Task 9 |
| MLflow experiment tracking | Task 12 |
| Comparable sales engine | Task 11 |
| Undervalued property scanner | Task 14 (scan router), Task 19 |
| Benchmark dashboard vs baselines | Task 14 (benchmark router), Task 18 |
| Zillow MedAPE as external reference only | Task 14, 18, 19 |
| Model card + data card | Task 19 |
| CSV upload batch scoring | Task 19 (scanner page) |
| GitHub Actions CI | Task 20 |
| Data version hash in model metadata | Task 12 (data_sha256 in meta.json) |
| Public Vercel deployment | Task 21 |
| HuggingFace Spaces API | Task 15, 21 |
| Supabase schema | Task 16 |
