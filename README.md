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
    data/           CSV loading, cleaning, deterministic review IDs, in-memory cache
    schemas/        Pydantic response models (typed API contract)
    services/       Analytics computations
    main.py         Application factory
  tests/            pytest suite + synthetic fixtures
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

The full review set (~1.1M rows) is loaded on the first data request (about 10 seconds).

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
