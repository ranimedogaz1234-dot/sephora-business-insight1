"""Catalogue price distribution (product_info.csv, all categories)."""

from __future__ import annotations

import numpy as np

from app.data.dataset import Dataset
from app.schemas.queries import PriceDistributionQuery
from app.schemas.responses import PriceBin, PriceDistribution, PriceStats
from app.services.common import r4


def _money(v: float) -> str:
    return f"${v:,.0f}"


def price_distribution(ds: Dataset, q: PriceDistributionQuery) -> PriceDistribution:
    def compute() -> PriceDistribution:
        p = ds.products
        if q.primary_category:
            p = p[p["primary_category"].isin(q.primary_category).to_numpy()]
        prices = p["price_usd"].to_numpy(dtype=np.float64)

        n_bins = q.max_price // q.bin_width + (1 if q.max_price % q.bin_width else 0)
        below = prices[prices < q.max_price]
        counts = np.bincount((below // q.bin_width).astype(np.int64), minlength=n_bins)[:n_bins]
        bins = []
        for i, c in enumerate(counts):
            lo = i * q.bin_width
            hi = min(lo + q.bin_width, q.max_price)
            bins.append(
                PriceBin(
                    label=f"{_money(lo)}–{_money(hi)}",
                    min_price=lo,
                    max_price=hi,
                    product_count=int(c),
                )
            )
        bins.append(
            PriceBin(
                label=f"{_money(q.max_price)}+",
                min_price=q.max_price,
                max_price=None,
                product_count=int((prices >= q.max_price).sum()),
            )
        )

        if len(prices):
            p25, med, p75 = np.percentile(prices, [25, 50, 75])
            stats = PriceStats(
                count=len(prices),
                min=r4(prices.min()),
                p25=r4(p25),
                median=r4(med),
                mean=r4(prices.mean()),
                p75=r4(p75),
                max=r4(prices.max()),
            )
        else:
            stats = PriceStats(
                count=0, min=None, p25=None, median=None, mean=None, p75=None, max=None
            )
        return PriceDistribution(
            bin_width=q.bin_width, max_price=q.max_price, stats=stats, bins=bins
        )

    return ds.memo(("prices", q.cache_key()), compute)
