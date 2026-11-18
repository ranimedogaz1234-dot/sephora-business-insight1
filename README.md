# Sephora Business Insight

Business-intelligence platform for the Sephora products and Skincare reviews dataset.

| Layer | Stack |
| --- | --- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, Recharts |
| Backend | Python, FastAPI, Pandas |
| Data | Six CSV files — the single source of truth (no database server) |
| Tooling | Git, GitHub Actions, pytest, ruff, Vitest, ESLint |

> **Private data.** The original CSV files are never committed. They live outside the
> repository and are referenced through `SBI_DATA_DIR`. Automated tests use small synthetic
> fixtures in `backend/tests/fixtures/`.

## Project structure

```
backend/
  app/
    api/            FastAPI routers (versioned under /api/v1) and dependencies
    core/           Settings (environment variables, prefix SBI_)
    data/           CSV loading + cleaning (loader), typed tables (prepare),
                    Parquet cache (cache, build_cache), in-memory dataset (dataset, store)
    schemas/        Validated query models (queries) and response models (responses)
    services/       Analytics: kpis, reviews, products, brands, categories, prices, filters
    main.py         Application factory (CORS, GZip, security headers, optional preload)
  scripts/          benchmark.py, validate_against_csv.py (real-data tools, never run in CI)
  tests/            pytest suite, synthetic fixtures, independent csv-module oracle
frontend/
  src/
    app/            App Router pages and layout
    components/     layout/, ui/ (cards, badges), charts/ (Recharts wrappers)
    lib/            api/ (typed client + types), config, formatting, theme, navigation
scripts/            Repository safety check (used in CI)
.github/workflows/  CI: safety check, backend lint + tests, frontend lint + typecheck + tests + build
```

## Getting started

### Prerequisites

Node.js 24+, npm, Python 3.12+ and the dataset folder (`product_info.csv` + `reviews_*.csv`).

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
copy .env.example .env   # then set SBI_DATA_DIR to your dataset folder
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs — health: http://localhost:8000/api/v1/health

On first start the six CSVs are read once (~20–35 s) and a Parquet cache is written to
`SBI_CACHE_DIR` (default `backend/.cache/`, gitignored). Later starts load the cache in
under a second. You can pre-build or verify it explicitly:

```powershell
.venv\Scripts\python -m app.data.build_cache          # build if missing/stale (verifies SHA-256)
.venv\Scripts\python -m app.data.build_cache --force  # always rebuild
```

The cache is rebuilt automatically when any source CSV changes (name, size or modification
time; set `SBI_CACHE_VERIFY_HASH=true` to also compare content hashes) or when
`CACHE_VERSION` in `app/data/cache.py` is bumped.

### Frontend

```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Open http://localhost:3000.

### Tests

```powershell
cd backend; .venv\Scripts\python -m pytest; .venv\Scripts\python -m ruff check .
cd frontend; npm test; npm run lint; npm run typecheck
bash scripts/check-tracked-files.sh
```

### Real-data validation and benchmark (local only)

```powershell
cd backend
.venv\Scripts\python -m scripts.validate_against_csv   # API vs independent csv-module oracle
.venv\Scripts\python -m scripts.benchmark             # load time, memory, endpoint latency
$env:SBI_VALIDATE_REAL_DATA="1"; .venv\Scripts\python -m pytest tests/test_realdata.py
```

## API (v1)

All endpoints are `GET` under `/api/v1`. Interactive docs at `/docs` (disabled when
`SBI_ENVIRONMENT=production`).

| Endpoint | Data source | Purpose |
| --- | --- | --- |
| `/health` | — | Liveness and dataset status (never loads data) |
| `/overview` | both | Dataset summary |
| `/filters` | both | Values for filter controls (categories, brands, subcategories, years…) |
| `/kpis` | both | Executive KPIs; review figures honour review filters, catalogue figures never do |
| `/reviews/rating-distribution` | reviews | Count and share per star rating |
| `/reviews/trends?granularity=month\|quarter\|year` | reviews | Volume and rating over time (gaps zero-filled) |
| `/reviews/activity-heatmap` | reviews | Year × month review counts |
| `/reviews` | reviews | Review explorer: filters, text search `q`, sort, pagination |
| `/reviews/{review_id}` | reviews | One review |
| `/products/top-reviewed` | reviews | Most reviewed products |
| `/products/top-by-year?year=` | reviews | Most reviewed products in a year |
| `/products/review-years` | reviews | Years with reviews (year selector) |
| `/products/rating-popularity` | reviews + catalogue | Rating vs review volume vs loves (scatter) |
| `/products` | catalogue | Catalogue search, filters, sort, pagination |
| `/products/{product_id}` | catalogue + reviews | Product detail with review statistics |
| `/brands` | catalogue + reviews | All brands, sortable and searchable |
| `/brands/top` | reviews | Top brands by review volume |
| `/categories/catalogue[?parent=]` | catalogue | All nine primary categories, or one category's subcategories |
| `/categories/reviews` | reviews | Skincare subcategory breakdown |
| `/prices/distribution` | catalogue | Price histogram with overflow bin and statistics |

**Review filters** (all review-based endpoints): `date_from`, `date_to` (inclusive),
`brand`, `subcategory`, `product_id`, `rating`, `skin_type` (repeat a parameter for
multiple values), `recommended`.
**Paging**: `page` (≥ 1), `page_size` (1–100); responses include `total` and `total_pages`.
Sorting uses whitelisted `sort_by` fields with `order=asc|desc` and a deterministic tie-break.
Text search is literal (never a regex) and case-insensitive. Unknown parameters and
out-of-range values return `422`.

## Data rules

- **Catalogue figures** (`product_info.csv`): 8,494 products, 304 brands, nine primary categories.
  Catalogue charts may use all nine categories.
- **Review figures** are computed from the review CSV records, which cover Skincare products
  only — review-based category charts use Skincare subcategories.
- Sephora's own `reviews` column in the catalogue is reported separately as
  "Sephora-listed reviews" and never mixed with review-record counts.
- Only exact duplicate review copies (all fields identical, ignoring the CSV row-index column)
  are removed. Near-duplicates that differ in any field are preserved.
- Each review gets a stable `review_id` from a deterministic content hash.
- Field names keep the two review counts apart: `review_count` / `review_record_count`
  (review CSV rows) vs `sephora_review_count` (Sephora's catalogue figure).
- Reviewer `author_id` is used only to count distinct reviewers and is never returned.
