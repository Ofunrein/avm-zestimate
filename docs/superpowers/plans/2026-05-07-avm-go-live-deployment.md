# AVM Go-Live Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train the Austin AVM model on real Kaggle data and deploy the full stack live: model artifacts on HuggingFace, API on HuggingFace Spaces, frontend on Vercel, schema on Supabase.

**Architecture:** Sequential deployment — Kaggle data download → local training → push artifacts to HF model repo → HF Space auto-deploys API from GitHub → Vercel deploys frontend → Supabase schema applied.

**Tech Stack:** Python 3.13 + uv, kaggle CLI, huggingface_hub, gh CLI, Vercel CLI (npx), Supabase dashboard

---

## Pre-Flight Checklist

Before starting, verify:
- [ ] HuggingFace account exists at huggingface.co
- [ ] Vercel account exists at vercel.com (connect GitHub)
- [ ] Supabase project created at supabase.com
- [ ] Kaggle account exists at kaggle.com

---

## Task 1: Kaggle Credentials Setup

**Files:**
- Create: `~/.kaggle/kaggle.json`

- [ ] **Step 1: Get Kaggle API key**

Go to https://www.kaggle.com/settings → API → "Create New Token" → downloads `kaggle.json`

- [ ] **Step 2: Install credentials**

```bash
mkdir -p ~/.kaggle
cp ~/Downloads/kaggle.json ~/.kaggle/kaggle.json
chmod 600 ~/.kaggle/kaggle.json
```

- [ ] **Step 3: Verify**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate/ml
.venv/bin/python -c "import kaggle; print('Kaggle OK')"
```

Expected: `Kaggle OK` (no auth error)

- [ ] **Step 4: Test dataset access**

```bash
.venv/bin/python -c "
from avm.ingest import fetch_kaggle_austin
path = fetch_kaggle_austin()
print('Downloaded to:', path)
"
```

Expected: prints path to downloaded CSV, e.g. `data/raw/kaggle_austin/austinHousingData.csv`

---

## Task 2: Run Training Pipeline (Smoke Test)

**Files:**
- Modifies: `ml/data/` (creates raw + processed data)
- Creates: `ml/models/` (xgb_model.joblib, lgb_model.joblib, q_low.joblib, q_high.joblib, meta.json, residuals.json)

- [ ] **Step 1: Run smoke training (10 Optuna trials — ~5 min)**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate/ml
.venv/bin/python run_training.py 10
```

Expected output (truncated):
```
=== Austin AVM Training Pipeline ===
[1/9] Loading data...
  Clean records: 10,000+
  Data SHA256: <16 chars>
[2/9] Feature engineering...
[3/9] Temporal split...
  Train: 8,000+ | Test: 500+ | CV folds: 5
[4/9] Tuning XGBoost (10 trials)...
...
Test MedAPE (ensemble): X.XX%
Done.
```

- [ ] **Step 2: Verify model artifacts exist**

```bash
ls -lh ml/models/
```

Expected: `xgb_model.joblib`, `lgb_model.joblib`, `q_low.joblib`, `q_high.joblib`, `meta.json`, `residuals.json`

- [ ] **Step 3: Check MedAPE from meta.json**

```bash
python3 -c "import json; m=json.load(open('models/meta.json')); print('MedAPE:', m['test_medape'])"
```

Expected: a float between 2.0 and 12.0 (target < 4.0 but smoke test with 10 trials may be higher)

- [ ] **Step 4: If smoke test passes, run full training (50 trials — ~30-60 min)**

```bash
.venv/bin/python run_training.py 50
```

Expected: `Test MedAPE (ensemble): <X.XX>%` — aim for < 4.0%

---

## Task 3: HuggingFace Model Repository

**Creates:** HF model repo at `https://huggingface.co/<your-username>/austin-avm-model`

- [ ] **Step 1: Get HuggingFace token**

Go to https://huggingface.co/settings/tokens → "New token" → role: Write → copy token

- [ ] **Step 2: Login via CLI**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate/ml
.venv/bin/python -c "
from huggingface_hub import login
login()  # paste token when prompted
"
```

Expected: `Login successful`

- [ ] **Step 3: Create model repo**

```bash
.venv/bin/python -c "
from huggingface_hub import HfApi
api = HfApi()
api.create_repo('austin-avm-model', repo_type='model', exist_ok=True)
print('Repo created')
"
```

Expected: `Repo created`

- [ ] **Step 4: Push model artifacts**

```bash
HF_USERNAME=$(python3 -c "from huggingface_hub import whoami; print(whoami()['name'])")
echo "Pushing to: $HF_USERNAME/austin-avm-model"

.venv/bin/python -c "
from huggingface_hub import HfApi
import subprocess, os
api = HfApi()
username = api.whoami()['name']
api.upload_folder(
    folder_path='models',
    repo_id=f'{username}/austin-avm-model',
    repo_type='model',
)
print('Upload complete')
"
```

Expected: progress bars + `Upload complete`

- [ ] **Step 5: Verify files visible on HuggingFace**

Open `https://huggingface.co/<your-username>/austin-avm-model` — should show 6 files.

---

## Task 4: HuggingFace Spaces Setup (API)

**Creates:** HF Space at `https://huggingface.co/spaces/<your-username>/austin-avm-api`

- [ ] **Step 1: Create HuggingFace Space**

Go to https://huggingface.co/new-space:
- Space name: `austin-avm-api`
- SDK: **Docker**
- Visibility: **Public**
- Click "Create Space"

- [ ] **Step 2: Connect GitHub repo**

In the Space settings → "Repository" → Connect to GitHub → select `Ofunrein/avm-zestimate` → branch `main`

If GitHub connection not available, push directly:
```bash
cd /Users/martinofunrein/Downloads/avm-zestimate
git remote add hf https://huggingface.co/spaces/<YOUR_HF_USERNAME>/austin-avm-api
git push hf main
```

- [ ] **Step 3: Add Space secret**

In Space → Settings → Variables and secrets → "New secret":
- Name: `HF_REPO_ID`
- Value: `<your-hf-username>/austin-avm-model`

- [ ] **Step 4: Wait for build (~5-10 min) then verify health**

```bash
HF_SPACE_URL="https://<your-hf-username>-austin-avm-api.hf.space"
curl -s "$HF_SPACE_URL/health"
```

Expected: `{"status":"ok","version":"1.0.0"}`

If cold-start timeout (30s), retry once.

- [ ] **Step 5: Test predict endpoint**

```bash
curl -s -X POST "$HF_SPACE_URL/predict" \
  -H "Content-Type: application/json" \
  -d '{"sqft_living":1800,"beds":3,"baths_full":2,"year_built":2005,"zip_code":"78701","lat":30.27,"lng":-97.74}' \
  | python3 -m json.tool
```

Expected: JSON with `predicted_price`, `lower_bound`, `upper_bound`, `confidence_score`, `shap_top5`

- [ ] **Step 6: Save API URL for next tasks**

```bash
echo "API_URL=https://<your-hf-username>-austin-avm-api.hf.space" > /Users/martinofunrein/Downloads/avm-zestimate/.env.deployment
```

---

## Task 5: Supabase Schema

**Creates:** 3 tables + 3 indexes in Supabase Postgres

- [ ] **Step 1: Get Supabase project credentials**

Go to https://supabase.com/dashboard → your project → Settings → API:
- Copy `Project URL` (e.g. `https://xyzxyz.supabase.co`)
- Copy `anon public` key

- [ ] **Step 2: Apply schema**

Go to https://supabase.com/dashboard → your project → SQL Editor → paste contents of:

```
/Users/martinofunrein/Downloads/avm-zestimate/supabase/schema.sql
```

Click "Run"

Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify tables**

In Supabase → Table Editor — should see: `predictions`, `benchmark_runs`, `comps_cache`

- [ ] **Step 4: Save credentials for Vercel**

```bash
cat >> /Users/martinofunrein/Downloads/avm-zestimate/.env.deployment << EOF
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
EOF
```

---

## Task 6: Vercel Frontend Deployment

**Creates:** Live Next.js app at `https://austin-avm.vercel.app` (or similar)

- [ ] **Step 1: Login to Vercel**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate/web
npx vercel login
```

Follow browser OAuth flow with GitHub account `Ofunrein`.

- [ ] **Step 2: Deploy**

```bash
npx vercel --prod
```

When prompted:
- Set up and deploy? **Y**
- Which scope? **your personal account**
- Link to existing project? **N**
- Project name: **austin-avm** (or accept default)
- Directory: **./** (current)
- Override settings? **N**

Expected: `✅ Production: https://austin-avm-<hash>.vercel.app`

- [ ] **Step 3: Set environment variables**

```bash
# Read saved values
source /Users/martinofunrein/Downloads/avm-zestimate/.env.deployment

npx vercel env add NEXT_PUBLIC_API_URL production <<< "$API_URL"
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "$SUPABASE_URL"
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "$SUPABASE_ANON_KEY"
```

- [ ] **Step 4: Redeploy with env vars**

```bash
npx vercel --prod
```

Expected: new deployment URL with env vars active.

- [ ] **Step 5: Verify all 4 pages load**

```bash
VERCEL_URL="https://austin-avm-<hash>.vercel.app"
for path in "" "/benchmark" "/scanner" "/model-card"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL$path")
  echo "$path → $status"
done
```

Expected: all return `200`

---

## Task 7: GitHub Actions Secrets

**Enables:** Automated retrain workflow via `workflow_dispatch`

- [ ] **Step 1: Get Kaggle API key values**

```bash
python3 -c "import json; k=json.load(open(open.__module__ and '/Users/'+__import__('os').environ['USER']+'/.kaggle/kaggle.json')); print(k['username'], k['key'][:8]+'...')"
```

- [ ] **Step 2: Add secrets to GitHub repo**

```bash
gh secret set KAGGLE_USERNAME -b "$(python3 -c "import json; print(json.load(open('/Users/$USER/.kaggle/kaggle.json'))['username'])")"
gh secret set KAGGLE_KEY -b "$(python3 -c "import json; print(json.load(open('/Users/$USER/.kaggle/kaggle.json'))['key'])")"
```

- [ ] **Step 3: Add HuggingFace secrets**

```bash
# Get your HF username
HF_USER=$(.venv/bin/python -c "from huggingface_hub import whoami; print(whoami()['name'])" 2>/dev/null)

gh secret set HF_REPO_ID -b "${HF_USER}/austin-avm-model" --repo Ofunrein/avm-zestimate

# HF_TOKEN: go to https://huggingface.co/settings/tokens, copy write token
gh secret set HF_TOKEN -b "<paste-hf-token>" --repo Ofunrein/avm-zestimate
```

- [ ] **Step 4: Verify secrets set**

```bash
gh secret list --repo Ofunrein/avm-zestimate
```

Expected: KAGGLE_USERNAME, KAGGLE_KEY, HF_TOKEN, HF_REPO_ID all listed.

- [ ] **Step 5: Test retrain workflow (dry run with 5 trials)**

```bash
gh workflow run retrain.yml --repo Ofunrein/avm-zestimate -f n_trials=5
sleep 10
gh run list --repo Ofunrein/avm-zestimate --limit 3
```

Expected: workflow run appears with status `in_progress` then `success`

---

## Task 8: End-to-End Live Test

**Validates:** full stack working together

- [ ] **Step 1: Test prediction via live frontend**

Open `https://austin-avm-<hash>.vercel.app` in browser:
- Fill form: 1800 sqft, 3 bed, 2 bath, 2005, 78701, lat 30.27, lng -97.74
- Click "Get Estimate"
- Expected: price card appears with predicted value, CI bar, SHAP waterfall

- [ ] **Step 2: Test benchmark page**

Open `/benchmark` — should show MedAPE, within-5%, within-10% stats and chart

- [ ] **Step 3: Create test CSV for scanner**

```bash
cat > /tmp/test_listings.csv << 'EOF'
sqft_living,beds,baths_full,year_built,zip_code,lat,lng,list_price
1800,3,2,2005,78701,30.27,-97.74,380000
2200,4,3,2010,78702,30.28,-97.73,520000
1200,2,1,1985,78703,30.26,-97.75,290000
EOF
```

Upload `/tmp/test_listings.csv` to `/scanner` — should show AVM estimates and gap %

- [ ] **Step 4: Update DEPLOY.md with live URLs**

```bash
cd /Users/martinofunrein/Downloads/avm-zestimate
cat >> DEPLOY.md << EOF

## Live URLs

- Frontend: https://austin-avm-<hash>.vercel.app
- API: https://<hf-username>-austin-avm-api.hf.space
- API docs: https://<hf-username>-austin-avm-api.hf.space/docs
- HF model: https://huggingface.co/<hf-username>/austin-avm-model
EOF
git add DEPLOY.md && git commit -m "docs: add live deployment URLs" && git push origin main
```

- [ ] **Step 5: Merge PR**

```bash
gh pr merge 1 --merge --repo Ofunrein/avm-zestimate
```

---

## Dependency Order

```
Task 1 (Kaggle creds)
  → Task 2 (training)
    → Task 3 (push to HF model repo)
      → Task 4 (HF Spaces API — needs HF_REPO_ID)
        → Task 6 (Vercel — needs API URL)
          → Task 8 (E2E test)
Task 5 (Supabase) → Task 6 (Vercel — needs SUPABASE_URL)
Task 7 (GitHub secrets) — parallel with Task 6
```

Tasks 1→2→3 must be sequential. Tasks 4+5 can run in parallel after Task 3. Task 7 can run any time after Task 3.
