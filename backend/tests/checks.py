"""API-vs-oracle checks, shared by the fixture tests and the real-data validation script."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from fastapi.testclient import TestClient

from tests.oracle import Oracle

TOL = 6e-5  # API rounds ratios/averages to 4 decimals


@dataclass
class Report:
    passed: int = 0
    failures: list[str] = field(default_factory=list)

    def check(self, name: str, ok: bool, detail: Any = "") -> None:
        if ok:
            self.passed += 1
        else:
            self.failures.append(f"{name}: {detail}")

    def eq(self, name: str, api: Any, expected: Any) -> None:
        self.check(name, api == expected, f"api={api!r} expected={expected!r}")

    def approx(self, name: str, api: float | None, expected: float | None) -> None:
        if api is None or expected is None:
            self.check(name, api is None and expected is None, f"api={api} expected={expected}")
        else:
            self.check(name, abs(api - expected) <= TOL, f"api={api} expected={expected}")


@dataclass
class Scenario:
    name: str
    params: dict[str, Any]  # API query params
    oracle: dict[str, Any]  # Oracle.select kwargs


def scenarios(o: Oracle) -> list[Scenario]:
    """Filter scenarios derived from the data (valid for fixtures and real data)."""
    brands = Oracle.ranking(Oracle.group(o.reviews, lambda r: r.brand), 2)
    subcats = Oracle.ranking(Oracle.group(o.reviews, lambda r: o.subcategory(r.pid)), 2)
    busiest_year = int(max(Oracle.by_period(o.reviews, 4).items(), key=lambda kv: kv[1])[0])
    skin = sorted({r.skin_type for r in o.reviews if r.skin_type})
    out = [
        Scenario("all", {}, {}),
        Scenario("top-brand", {"brand": brands[0][0]}, {"brand": [brands[0][0]]}),
        Scenario(
            "subcategory+low-ratings",
            {"subcategory": subcats[-1][0], "rating": [1, 2]},
            {"subcategory": [subcats[-1][0]], "rating": [1, 2]},
        ),
        Scenario(
            "half-year+recommended",
            {
                "date_from": f"{busiest_year}-01-01",
                "date_to": f"{busiest_year}-06-30",
                "recommended": "true",
            },
            {
                "date_from": f"{busiest_year}-01-01",
                "date_to": f"{busiest_year}-06-30",
                "recommended": True,
            },
        ),
    ]
    if skin and len(brands) > 1:
        out.append(
            Scenario(
                "skin-type+two-brands",
                {"skin_type": skin[-1], "brand": [b for b, _ in brands]},
                {"skin_type": [skin[-1]], "brand": [b for b, _ in brands]},
            )
        )
    return out


def _get(client: TestClient, path: str, params: dict | None = None) -> Any:
    res = client.get(f"/api/v1{path}", params=params)
    assert res.status_code == 200, f"{path} {params} -> {res.status_code} {res.text[:300]}"
    return res.json()


def check_catalogue(client: TestClient, o: Oracle, rep: Report) -> None:
    exp = o.catalogue()
    api = _get(client, "/kpis")["catalogue"]
    for k in ("total_products", "total_brands", "total_categories", "sephora_review_count"):
        rep.eq(f"catalogue.{k}", api[k], exp[k])
    rep.approx("catalogue.average_price", api["average_price_usd"], exp["average_price_usd"])
    rep.approx("catalogue.median_price", api["median_price_usd"], exp["median_price_usd"])

    prim = _get(client, "/categories/catalogue")
    rep.eq(
        "categories.catalogue.primary",
        {i["category"]: i["product_count"] for i in prim["items"]},
        o.catalogue_categories(),
    )
    for parent in o.catalogue_categories():
        sec = _get(client, "/categories/catalogue", {"parent": parent})
        rep.eq(
            f"categories.catalogue.{parent}",
            {i["category"]: i["product_count"] for i in sec["items"]},
            o.catalogue_categories(parent),
        )

    for bw, mx in ((10, 300), (25, 200)):
        api_bins = _get(client, "/prices/distribution", {"bin_width": bw, "max_price": mx})
        rep.eq(
            f"prices.bins[{bw},{mx}]",
            [b["product_count"] for b in api_bins["bins"]],
            o.price_bins(bw, mx),
        )

    rep.eq("products.total", _get(client, "/products", {"page_size": 1})["total"], len(o.products))
    for q in ("serum", "cream"):
        rep.eq(
            f"products.search[{q}]",
            _get(client, "/products", {"q": q, "page_size": 1})["total"],
            o.products_matching(q),
        )
    reviewed = len({r.pid for r in o.reviews})
    rep.eq(
        "products.has_review_records",
        _get(client, "/products", {"has_review_records": "true", "page_size": 1})["total"],
        reviewed,
    )


def check_overview(client: TestClient, o: Oracle, rep: Report) -> None:
    api = _get(client, "/overview")
    exp = o.kpis(o.reviews)
    rep.eq("overview.raw_review_count", api["reviews"]["raw_review_count"], o.raw_count)
    rep.eq(
        "overview.duplicates_removed",
        api["reviews"]["duplicate_reviews_removed"],
        o.raw_count - len(o.reviews),
    )
    rep.eq("overview.review_count", api["reviews"]["review_count"], exp["review_count"])
    rep.eq(
        "overview.sephora_listed",
        api["catalogue"]["sephora_listed_review_count"],
        o.catalogue()["sephora_review_count"],
    )
    years = {y["year"]: y["review_count"] for y in _get(client, "/filters")["reviews"]["years"]}
    rep.eq("filters.years", years, {int(k): v for k, v in Oracle.by_period(o.reviews, 4).items()})


def check_scenario(client: TestClient, o: Oracle, s: Scenario, rep: Report) -> None:
    rs = o.select(**s.oracle)
    p = s.params
    tag = s.name

    exp = o.kpis(rs)
    api = _get(client, "/kpis", p)["reviews"]
    for k in (
        "review_count",
        "recommendation_responses",
        "unique_reviewers",
        "reviewed_products",
        "reviewed_brands",
        "first_review_date",
        "last_review_date",
    ):
        rep.eq(f"[{tag}] kpis.{k}", api[k], exp[k])
    for k in ("average_rating", "five_star_share", "recommendation_rate"):
        rep.approx(f"[{tag}] kpis.{k}", api[k], exp[k])

    dist = _get(client, "/reviews/rating-distribution", p)
    rep.eq(
        f"[{tag}] rating_distribution", [b["count"] for b in dist["buckets"]], o.rating_counts(rs)
    )

    for gran, width in (("year", 4), ("month", 7)):
        trend = _get(client, "/reviews/trends", {**p, "granularity": gran})
        api_counts = {
            pt["period"]: pt["review_count"] for pt in trend["points"] if pt["review_count"]
        }
        rep.eq(f"[{tag}] trend.{gran}", api_counts, Oracle.by_period(rs, width))
    heat = _get(client, "/reviews/activity-heatmap", p)
    api_heat = {
        f"{c['year']}-{c['month']:02d}": c["review_count"]
        for c in heat["cells"]
        if c["review_count"]
    }
    rep.eq(f"[{tag}] heatmap", api_heat, Oracle.by_period(rs, 7))

    top = _get(client, "/products/top-reviewed", {**p, "limit": 10})
    by_product = Oracle.group(rs, lambda r: r.pid)
    rep.eq(
        f"[{tag}] top_products",
        [(i["product_id"], i["review_count"]) for i in top],
        Oracle.ranking(by_product, 10),
    )
    for i in top:
        rep.approx(
            f"[{tag}] top_products.avg[{i['product_id']}]",
            i["average_rating"],
            by_product[i["product_id"]][1],
        )

    brands = _get(client, "/brands/top", {**p, "limit": 10})
    rep.eq(
        f"[{tag}] top_brands",
        [(i["brand_name"], i["review_count"]) for i in brands["items"]],
        Oracle.ranking(Oracle.group(rs, lambda r: r.brand), 10),
    )

    cats = _get(client, "/categories/reviews", p)
    by_sub = Oracle.group(rs, lambda r: o.subcategory(r.pid))
    rep.eq(
        f"[{tag}] review_categories",
        {i["subcategory"]: i["review_count"] for i in cats["items"]},
        {k: v[0] for k, v in by_sub.items()},
    )
    for i in cats["items"]:
        rep.approx(
            f"[{tag}] review_categories.avg[{i['subcategory']}]",
            i["average_rating"],
            by_sub[i["subcategory"]][1],
        )

    pop = _get(client, "/products/rating-popularity", {**p, "min_reviews": 2, "limit": 1})
    rep.eq(
        f"[{tag}] rating_popularity.total",
        pop["total_products"],
        sum(1 for v in by_product.values() if v[0] >= 2),
    )

    listing = _get(client, "/reviews", {**p, "page_size": 1})
    rep.eq(f"[{tag}] reviews.total", listing["total"], len(rs))


def check_years(client: TestClient, o: Oracle, rep: Report) -> None:
    for year in sorted({int(r.date[:4]) for r in o.reviews}):
        rs = o.select(year=year)
        api = _get(client, "/products/top-by-year", {"year": year, "limit": 10})
        rep.eq(f"top_by_year[{year}].total", api["total_reviews_in_year"], len(rs))
        rep.eq(
            f"top_by_year[{year}]",
            [(i["product_id"], i["review_count"]) for i in api["items"]],
            Oracle.ranking(Oracle.group(rs, lambda r: r.pid), 10),
        )


def check_brands_table(client: TestClient, o: Oracle, rep: Report) -> None:
    items, page = [], 1
    while True:
        res = _get(
            client,
            "/brands",
            {"page": page, "page_size": 100, "sort_by": "brand_name", "order": "asc"},
        )
        items += res["items"]
        if page >= res["total_pages"]:
            break
        page += 1
    review_counts = {k: v[0] for k, v in Oracle.group(o.reviews, lambda r: r.brand).items()}
    product_counts: dict[str, int] = {}
    for prod in o.products.values():
        product_counts[prod["brand_name"]] = product_counts.get(prod["brand_name"], 0) + 1
    rep.eq("brands.count", len(items), len(product_counts))
    rep.eq(
        "brands.product_count", {i["brand_name"]: i["product_count"] for i in items}, product_counts
    )
    rep.eq(
        "brands.review_record_count",
        {i["brand_name"]: i["review_record_count"] for i in items if i["review_record_count"]},
        review_counts,
    )


def check_products_detail(client: TestClient, o: Oracle, rep: Report) -> None:
    by_product = Oracle.group(o.reviews, lambda r: r.pid)
    for pid, _ in Oracle.ranking(by_product, 5):
        api = _get(client, f"/products/{pid}")["review_stats"]
        rs = [r for r in o.reviews if r.pid == pid]
        rep.eq(f"product[{pid}].count", api["review_record_count"], len(rs))
        rep.approx(f"product[{pid}].avg", api["average_rating"], by_product[pid][1])
        rep.eq(
            f"product[{pid}].dist",
            [b["count"] for b in api["rating_distribution"]],
            o.rating_counts(rs),
        )


def check_search(client: TestClient, o: Oracle, rep: Report) -> None:
    brand = Oracle.ranking(Oracle.group(o.reviews, lambda r: r.brand), 1)[0][0]
    for term in ("holy grail", "serum"):
        rep.eq(
            f"search[{term}]",
            _get(client, "/reviews", {"q": term, "page_size": 1})["total"],
            o.search_count(term),
        )
        rep.eq(
            f"search[{term}]+brand",
            _get(client, "/reviews", {"q": term, "brand": brand, "page_size": 1})["total"],
            o.search_count(term, o.select(brand=[brand])),
        )


ALL_CHECKS: list[Callable[[TestClient, Oracle, Report], None]] = [
    check_catalogue,
    check_overview,
    check_years,
    check_brands_table,
    check_products_detail,
    check_search,
]


def run_all(client: TestClient, o: Oracle) -> Report:
    rep = Report()
    for fn in ALL_CHECKS:
        fn(client, o, rep)
    for s in scenarios(o):
        check_scenario(client, o, s, rep)
    return rep
