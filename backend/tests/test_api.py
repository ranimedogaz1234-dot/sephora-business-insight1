"""Endpoint behaviour on the synthetic fixtures, with hand-checked expected values.

Fixture facts (see tests/fixtures/make_fixtures.py): 18 raw review rows, 2 exact
duplicates, 16 reviews; ratings 1..5 = [2, 2, 2, 4, 6]; 14 reviewers; 4 reviewed
Skincare products; catalogue of 8 products / 4 brands / 4 primary categories.
"""

import pytest

from tests.conftest import FIXTURES, api, make_client


# ----------------------------------------------------------------------------- system
def test_health_reports_dataset_status_without_loading(client):
    body = api(client, "/health")
    assert body["status"] == "ok"
    assert body["dataset_available"] is True
    assert body["dataset_loaded"] is False
    api(client, "/kpis")
    assert api(client, "/health")["dataset_loaded"] is True


def test_preload_loads_dataset_at_startup(tmp_path):
    with make_client(FIXTURES, tmp_path / "cache", preload=True) as c:
        assert api(c, "/health")["dataset_loaded"] is True


def test_overview_keeps_part1_contract(client):
    body = api(client, "/overview")
    assert body["catalogue"] == {
        "total_products": 8,
        "total_brands": 4,
        "total_categories": 4,
        "sephora_listed_review_count": 355,
    }
    assert body["reviews"]["review_count"] == 16
    assert body["reviews"]["duplicate_reviews_removed"] == 2
    assert body["reviews"]["review_scope_category"] == "Skincare"


def test_filter_options(client):
    body = api(client, "/filters")
    assert [c["name"] for c in body["catalogue"]["primary_categories"]][0] == "Skincare"
    assert body["catalogue"]["brands"] == [
        "Alpha Labs",
        "Beta Botanics",
        "Delta Scents",
        "Gamma Glow",
    ]
    assert body["reviews"]["scope_category"] == "Skincare"
    assert [s["name"] for s in body["reviews"]["subcategories"]] == [
        "Moisturizers",
        "Treatments",
        "Cleansers",
    ]
    assert body["reviews"]["date_min"] == "2019-03-10"
    assert body["reviews"]["date_max"] == "2023-03-01"
    assert body["reviews"]["ratings"] == [1, 2, 3, 4, 5]


# ----------------------------------------------------------------------------- KPIs
def test_executive_kpis(client):
    body = api(client, "/kpis")
    assert body["catalogue"] == {
        "total_products": 8,
        "total_brands": 4,
        "total_categories": 4,
        "sephora_review_count": 355,
        "average_price_usd": 84.625,
        "median_price_usd": 38.5,
    }
    assert body["reviews"] == {
        "review_count": 16,
        "average_rating": 3.625,
        "five_star_share": 0.375,
        "recommendation_rate": 0.7143,
        "recommendation_responses": 14,
        "unique_reviewers": 14,
        "reviewed_products": 4,
        "reviewed_brands": 2,
        "first_review_date": "2019-03-10",
        "last_review_date": "2023-03-01",
    }
    assert body["data_quality"] == {
        "raw_review_count": 18,
        "duplicate_reviews_removed": 2,
        "review_records_total": 16,
    }
    assert body["filters_applied"] is False


def test_review_filters_never_change_catalogue_kpis(client):
    unfiltered = api(client, "/kpis")
    filtered = api(client, "/kpis", {"brand": "Alpha Labs", "rating": [5]})
    assert filtered["filters_applied"] is True
    assert filtered["catalogue"] == unfiltered["catalogue"]
    assert filtered["reviews"]["review_count"] == 3


def test_unmatched_filters_return_empty_figures(client):
    body = api(client, "/kpis", {"brand": "No Such Brand"})["reviews"]
    assert body["review_count"] == 0
    assert body["average_rating"] is None
    assert body["first_review_date"] is None


# ----------------------------------------------------------------------------- reviews
def test_rating_distribution(client):
    body = api(client, "/reviews/rating-distribution")
    assert [b["count"] for b in body["buckets"]] == [2, 2, 2, 4, 6]
    assert [b["share"] for b in body["buckets"]] == [0.125, 0.125, 0.125, 0.25, 0.375]
    assert body["total"] == 16


def test_monthly_trend_is_zero_filled(client):
    body = api(client, "/reviews/trends", {"granularity": "month"})
    periods = [p["period"] for p in body["points"]]
    assert periods[0] == "2019-03" and periods[-1] == "2023-03"
    assert len(periods) == 49
    assert sum(p["review_count"] for p in body["points"]) == 16
    empty = next(p for p in body["points"] if p["period"] == "2019-04")
    assert empty["review_count"] == 0 and empty["average_rating"] is None


def test_quarterly_and_yearly_trends(client):
    q = api(client, "/reviews/trends", {"granularity": "quarter"})
    assert q["points"][0]["period"] == "2019-Q1"
    assert q["points"][0]["period_start"] == "2019-01-01"
    y = api(client, "/reviews/trends", {"granularity": "year"})
    assert {p["period"]: p["review_count"] for p in y["points"]} == {
        "2019": 2,
        "2020": 4,
        "2021": 3,
        "2022": 4,
        "2023": 3,
    }


def test_activity_heatmap_grid(client):
    body = api(client, "/reviews/activity-heatmap")
    assert body["years"] == [2019, 2020, 2021, 2022, 2023]
    assert len(body["cells"]) == 5 * 12
    assert sum(c["review_count"] for c in body["cells"]) == 16
    assert body["max_count"] == 3  # Jan 2020: A03, A04 and the A03 near-duplicate


def test_review_list_pagination(client):
    page1 = api(client, "/reviews", {"page_size": 5})
    assert page1["total"] == 16 and page1["total_pages"] == 4 and len(page1["items"]) == 5
    page4 = api(client, "/reviews", {"page_size": 5, "page": 4})
    assert len(page4["items"]) == 1
    beyond = api(client, "/reviews", {"page_size": 5, "page": 9})
    assert beyond["items"] == [] and beyond["total"] == 16
    ids = [
        i["review_id"]
        for p in range(1, 5)
        for i in api(client, "/reviews", {"page_size": 5, "page": p})["items"]
    ]
    assert len(set(ids)) == 16  # no row repeated or skipped across pages


def test_review_list_default_sort_is_newest_first(client):
    items = api(client, "/reviews", {"page_size": 100})["items"]
    dates = [i["submission_date"] for i in items]
    assert dates == sorted(dates, reverse=True)
    assert items[0]["submission_date"] == "2023-03-01"


@pytest.mark.parametrize("order", ["asc", "desc"])
def test_review_list_sort_by_rating_is_deterministic(client, order):
    params = {"sort_by": "rating", "order": order, "page_size": 100}
    a = api(client, "/reviews", params)["items"]
    b = api(client, "/reviews", params)["items"]
    assert a == b
    ratings = [i["rating"] for i in a]
    assert ratings == sorted(ratings, reverse=order == "desc")


def test_review_list_missing_helpfulness_sorts_last(client):
    for order in ("asc", "desc"):
        items = api(
            client, "/reviews", {"sort_by": "helpfulness", "order": order, "page_size": 100}
        )["items"]
        values = [i["helpfulness"] for i in items]
        first_none = values.index(None)
        assert all(v is None for v in values[first_none:])


def test_review_text_search_is_literal_and_case_insensitive(client):
    assert api(client, "/reviews", {"q": "SERUM"})["total"] == 5
    assert api(client, "/reviews", {"q": "holy grail"})["total"] == 2
    assert api(client, "/reviews", {"q": "holy grail", "brand": "Alpha Labs"})["total"] == 1
    # regex metacharacters are matched literally, never interpreted
    assert api(client, "/reviews", {"q": "(.*)"})["total"] == 0
    assert api(client, "/reviews", {"q": "s.rum"})["total"] == 0


def test_review_list_filters(client):
    body = api(client, "/reviews", {"subcategory": "Moisturizers", "rating": [1, 2]})
    assert body["total"] == 3
    assert {i["product_id"] for i in body["items"]} == {"P1002"}
    body = api(client, "/reviews", {"date_from": "2020-01-05", "date_to": "2020-01-05"})
    assert body["total"] == 2  # inclusive on both ends
    assert api(client, "/reviews", {"recommended": "false"})["total"] == 4
    assert api(client, "/reviews", {"skin_type": "oily"})["total"] == 3


def test_review_detail_and_fields(client):
    item = api(client, "/reviews/r_c78c45e2db818b2b")
    assert item["rating"] == 1
    assert item["product_name"] == "Synthetic Night Cream"
    assert item["subcategory"] == "Moisturizers"
    assert item["review_title"] == "Not for me"
    assert item["is_recommended"] is False
    assert "author_id" not in item and "author_key" not in item


# ----------------------------------------------------------------------------- products
def test_top_reviewed_products_with_tiebreak(client):
    body = api(client, "/products/top-reviewed")
    assert [(i["rank"], i["product_id"], i["review_count"]) for i in body] == [
        (1, "P1002", 5),
        (2, "P1003", 5),
        (3, "P1001", 4),
        (4, "P1004", 2),
    ]
    assert body[0]["average_rating"] == 2.4
    assert body[1]["average_rating"] == 4.2
    assert api(client, "/products/top-reviewed", {"limit": 2})[-1]["product_id"] == "P1003"


def test_top_products_by_year(client):
    body = api(client, "/products/top-by-year", {"year": 2022})
    assert body["total_reviews_in_year"] == 4
    assert [(i["product_id"], i["review_count"]) for i in body["items"]] == [
        ("P1003", 2),
        ("P1001", 1),
        ("P1004", 1),
    ]
    assert api(client, "/products/top-by-year", {"year": 2015})["items"] == []
    years = api(client, "/products/review-years")
    assert [y["year"] for y in years] == [2019, 2020, 2021, 2022, 2023]


def test_rating_popularity(client):
    body = api(client, "/products/rating-popularity", {"min_reviews": 4})
    assert body["total_products"] == 3
    assert [p["product_id"] for p in body["points"]] == ["P1002", "P1003", "P1001"]
    assert body["points"][1]["loves_count"] == 5600


def test_product_catalogue_list_and_sorting(client):
    body = api(client, "/products", {"page_size": 100})
    assert body["total"] == 8
    assert [p["product_id"] for p in body["items"]][:2] == ["P1003", "P1002"]  # loves desc
    by_price = api(client, "/products", {"sort_by": "price_usd", "order": "asc", "page_size": 3})
    assert [p["price_usd"] for p in by_price["items"]] == [20.0, 24.0, 28.0]


def test_product_catalogue_keeps_review_counts_separate(client):
    p = next(
        i
        for i in api(client, "/products", {"page_size": 100})["items"]
        if i["product_id"] == "P1002"
    )
    assert p["sephora_review_count"] == 85  # catalogue figure
    assert p["review_record_count"] == 5  # CSV review records
    assert p["catalogue_rating"] == 4.2
    assert p["review_average_rating"] == 2.4
    mask = next(
        i
        for i in api(client, "/products", {"page_size": 100})["items"]
        if i["product_id"] == "P1005"
    )
    assert mask["sephora_review_count"] is None and mask["catalogue_rating"] is None
    assert mask["review_record_count"] == 0 and mask["review_average_rating"] is None


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"q": "serum"}, {"P1003"}),
        ({"q": "ALPHA"}, {"P1001", "P1002"}),
        ({"primary_category": "Makeup"}, {"P1006"}),
        ({"secondary_category": "Moisturizers"}, {"P1002", "P1004"}),
        ({"brand": ["Gamma Glow", "Delta Scents"]}, {"P1005", "P1006", "P1007", "P1008"}),
        ({"price_min": 30, "price_max": 70}, {"P1002", "P1003", "P1004"}),
        ({"min_catalogue_rating": 4.4}, {"P1001", "P1006", "P1007"}),
        ({"has_review_records": "true"}, {"P1001", "P1002", "P1003", "P1004"}),
        ({"has_review_records": "false", "primary_category": "Skincare"}, {"P1005"}),
        ({"new": "true"}, {"P1003"}),
        ({"sephora_exclusive": "true"}, {"P1002"}),
        ({"limited_edition": "true"}, {"P1007"}),
        ({"out_of_stock": "true"}, {"P1005"}),
        ({"online_only": "true"}, {"P1008"}),
    ],
)
def test_product_catalogue_filters(client, params, expected):
    body = api(client, "/products", {**params, "page_size": 100})
    assert {p["product_id"] for p in body["items"]} == expected
    assert body["total"] == len(expected)


def test_product_detail(client):
    body = api(client, "/products/P1003")
    assert body["highlights"] == ["Vegan", "Synthetic highlight"]
    assert body["ingredients"][0] == "Water, Glycerin."
    stats = body["review_stats"]
    assert stats["review_record_count"] == 5
    assert stats["average_rating"] == 4.2
    assert [b["count"] for b in stats["rating_distribution"]] == [0, 1, 0, 1, 3]
    assert stats["recommendation_rate"] == 0.75  # 3 of 4 answered
    no_reviews = api(client, "/products/P1007")["review_stats"]
    assert no_reviews["review_record_count"] == 0 and no_reviews["average_rating"] is None


# ----------------------------------------------------------------------------- brands
def test_brand_list(client):
    body = api(client, "/brands")
    assert body["total"] == 4
    assert [(b["brand_name"], b["review_record_count"]) for b in body["items"]] == [
        ("Alpha Labs", 9),
        ("Beta Botanics", 7),
        ("Delta Scents", 0),
        ("Gamma Glow", 0),
    ]
    gamma = body["items"][-1]
    assert gamma["product_count"] == 2 and gamma["category_count"] == 2
    assert gamma["sephora_review_count"] == 60 and gamma["review_average_rating"] is None
    assert api(client, "/brands", {"q": "beta"})["total"] == 1
    by_name = api(client, "/brands", {"sort_by": "brand_name", "order": "asc"})
    assert by_name["items"][0]["brand_name"] == "Alpha Labs"


def test_top_brands(client):
    body = api(client, "/brands/top")
    assert body["total_reviews"] == 16
    assert [
        (b["brand_name"], b["review_count"], b["reviewed_products"]) for b in body["items"]
    ] == [
        ("Alpha Labs", 9, 2),
        ("Beta Botanics", 7, 2),
    ]
    assert body["items"][0]["share"] == 0.5625


# ----------------------------------------------------------------------------- categories
def test_catalogue_categories_cover_all_primary_categories(client):
    body = api(client, "/categories/catalogue")
    assert body["level"] == "primary"
    assert [(c["category"], c["product_count"]) for c in body["items"]] == [
        ("Skincare", 5),
        ("Fragrance", 1),
        ("Makeup", 1),
        ("Tools & Brushes", 1),
    ]
    skincare = body["items"][0]
    assert skincare["sephora_review_count"] == 260
    assert skincare["average_catalogue_rating"] == 4.125  # P1005 has no rating


def test_catalogue_category_drilldown(client):
    body = api(client, "/categories/catalogue", {"parent": "Skincare"})
    assert body["level"] == "secondary" and body["parent"] == "Skincare"
    assert {c["category"]: c["product_count"] for c in body["items"]} == {
        "Moisturizers": 2,
        "Cleansers": 1,
        "Masks": 1,
        "Treatments": 1,
    }


def test_review_categories_use_skincare_subcategories(client):
    body = api(client, "/categories/reviews")
    assert body["scope_category"] == "Skincare"
    assert [
        (c["subcategory"], c["review_count"], c["reviewed_products"]) for c in body["items"]
    ] == [
        ("Moisturizers", 7, 2),
        ("Treatments", 5, 1),
        ("Cleansers", 4, 1),
    ]
    assert sum(c["review_count"] for c in body["items"]) == body["total_reviews"] == 16


# ----------------------------------------------------------------------------- prices
def test_price_distribution(client):
    body = api(client, "/prices/distribution")
    counts = {b["label"]: b["product_count"] for b in body["bins"] if b["product_count"]}
    assert counts == {
        "$20–$30": 3,
        "$30–$40": 1,
        "$40–$50": 1,
        "$60–$70": 1,
        "$150–$160": 1,
        "$300+": 1,
    }
    assert body["bins"][-1]["max_price"] is None
    assert body["stats"]["count"] == 8 and body["stats"]["max"] == 310.0
    makeup = api(client, "/prices/distribution", {"primary_category": "Makeup"})
    assert makeup["stats"]["count"] == 1


def test_price_bins_with_uneven_cap(client):
    body = api(client, "/prices/distribution", {"bin_width": 40, "max_price": 100})
    assert [(b["min_price"], b["max_price"]) for b in body["bins"]] == [
        (0, 40),
        (40, 80),
        (80, 100),
        (100, None),
    ]
    assert [b["product_count"] for b in body["bins"]] == [4, 2, 0, 2]
