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

API docs: http://127.0.0.1:8000/docs — health: http://127.0.0.1:8000/api/v1/health

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

Open http://localhost:3001 (the dev server uses port 3001 so it never collides with other projects on 3000).

The **Executive Overview** (`/`) is a server-rendered dashboard. Global filters (period,
Skincare subcategory, brand) live in the URL, so every view can be shared or bookmarked.
Review-based sections follow the filters; catalogue sections (category mix, price
distribution, catalogue counts) always describe all products and are labelled as such.
Sections planned for later parts appear in the sidebar as "Soon" and are not links.

**Product Analytics** (`/products`) explores the whole catalogue (8,494 products, all nine
categories). Search (name or brand, debounced, minimum 2 characters), category → subcategory,
brand, price range and minimum catalogue rating filters, sorting from a preset menu or any
sortable column header, and pagination all run on the backend (`GET /products`); the state lives
in the URL. The table keeps Sephora's catalogue rating and review count separate from the
review-record count (Skincare only).

**Product details** (`/products/[productId]`) show catalogue facts (price, size, variants,
flags, highlights, ingredients as listed), and — for products with review records — headline
review figures, the rating distribution, the review trend, paginated customer reviews (sort by
recency, helpfulness or rating; filter by stars) and data-derived insights. Insights only
restate computed figures: rating and recommendation rate vs the same Skincare subcategory,
share of 1–2 star ratings, price vs the catalogue category median and the most active review
year; comparisons are skipped below 30 review records. Products outside Skincare state plainly
that the review dataset does not cover them.

**Review Analytics** (`/reviews`) analyses the Skincare review records. Filters for review
date range, Skincare subcategory, brand, product, star rating and recommendation scope every
figure on the page: review KPI cards (records, average rating, five-star share, recommend rate,
unique reviewers, reviewed products and brands), review activity over time
(monthly/quarterly/yearly), rating distribution, reviews by brand and by subcategory, the most
reviewed products, and aggregate reviewer profiles (self-reported skin type, skin tone, eye and
hair colour, with the unanswered share stated). Brand, subcategory and product rows drill down
by narrowing the filters. The review explorer adds literal text search (debounced, title and
text), sorting (recency, helpfulness, rating) and server-side pagination of 20 reviews per page;
on phones it switches from a table to review cards. All state lives in the URL, and values
outside the review domain are dropped before reaching the API.

**Brands & Categories** (`/brands`) compares brands and categories. Review-based sections
(most reviewed brands, highest-rated brands, the brand landscape scatter of rating against
review volume, average rating by Skincare subcategory) can be scoped to one Skincare
subcategory, and rating rankings only include brands above a selectable minimum review count
(25, 100, 500 or 1,000; default 100), so a handful of reviews never tops a ranking. Catalogue
sections cover all nine categories: products per category with drill-down into a category's
subcategories, and product counts by brand. Selecting any brand (from a ranking, a scatter dot,
the directory or the focus menu) opens a **brand focus** panel: catalogue footprint, review
figures, category mix, most reviewed products, and a subcategory comparison against all brands
(differences are only highlighted with at least 30 brand reviews). The **brand directory**
lists every catalogue brand with search, sortable columns and pagination.

Design system: white-dominant surfaces, burgundy `#800F35` for emphasis and data marks,
soft pink for selection highlights, Playfair Display for editorial headings and Geist for
all figures, labels and tables. Text colours meet WCAG AA; the heatmap ramp is a single
validated burgundy hue. Every chart has a table view, hover/focus tooltips and an empty
state, and the layout works from 375px phones (drawer navigation) to wide desktops
(collapsible sidebar).

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
| `/reviews/profiles` | reviews | Aggregate reviewer attributes (skin type, skin tone, eye and hair colour) |
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
| `/brands/review-stats?min_reviews=&sort_by=` | reviews | Per-brand review statistics above a minimum review count (rankings, scatter) |
| `/brands/detail?brand=` | catalogue + reviews | One brand by exact name |
| `/categories/catalogue[?parent=&brand=]` | catalogue | All nine primary categories, or one category's subcategories; optionally for one brand |
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
