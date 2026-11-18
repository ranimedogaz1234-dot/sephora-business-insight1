"""Values available to the UI's filter controls (all derived from the data)."""

from __future__ import annotations

from app.data.dataset import Dataset
from app.schemas.responses import CatalogueOptions, FilterOptions, NamedCount, ReviewOptions
from app.services.common import RATINGS, REVIEW_SCOPE_CATEGORY, to_date
from app.services.products import review_years


def _counts(series) -> list[NamedCount]:
    """Value counts (desc, then name) — counted on the categorical codes, not on strings."""
    vc = series.value_counts(dropna=True)
    ordered = sorted(
        ((str(k), int(v)) for k, v in vc.items() if v > 0), key=lambda kv: (-kv[1], kv[0])
    )
    return [NamedCount(name=k, count=v) for k, v in ordered]


def filter_options(ds: Dataset) -> FilterOptions:
    def compute() -> FilterOptions:
        p, r = ds.products, ds.reviews
        secondary = {
            str(cat): _counts(group["secondary_category"])
            for cat, group in p.groupby("primary_category", observed=True)
        }
        return FilterOptions(
            catalogue=CatalogueOptions(
                primary_categories=_counts(p["primary_category"]),
                secondary_categories=dict(sorted(secondary.items())),
                brands=sorted(p["brand_name"].dropna().astype(str).unique(), key=str.casefold),
                price_min=float(p["price_usd"].min()),
                price_max=float(p["price_usd"].max()),
            ),
            reviews=ReviewOptions(
                scope_category=REVIEW_SCOPE_CATEGORY,
                subcategories=_counts(r["subcategory"]),
                brands=_counts(r["brand_name"]),
                years=review_years(ds),
                skin_types=sorted(str(c) for c in r["skin_type"].cat.categories),
                ratings=list(RATINGS),
                date_min=to_date(r["submission_time"].min()) if len(r) else None,
                date_max=to_date(r["submission_time"].max()) if len(r) else None,
            ),
        )

    return ds.memo("filter_options", compute)
