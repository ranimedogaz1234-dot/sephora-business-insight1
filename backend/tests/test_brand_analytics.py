"""Brand and category analytics on the synthetic fixtures.

Hand-counted from tests/fixtures after deduplication:
* Alpha Labs: 9 reviews (P1001 x4, P1002 x5), ratings sum 30 -> 3.3333, five-star 3/9,
  recommendation 5 of 8 answered -> 0.625, 2 reviewed products.
* Beta Botanics: 7 reviews (P1003 x5, P1004 x2), ratings sum 28 -> 4.0, five-star 3/7,
  recommendation 5 of 6 answered -> 0.8333, 2 reviewed products.
* Catalogue: Delta Scents has one Fragrance and one Tools & Brushes product; Gamma Glow has
  one Skincare (Masks) and one Makeup product.
"""

import pytest

from tests.conftest import api


# ----------------------------------------------------------------------------- review stats
def test_brand_review_stats_default_is_review_volume(client):
    body = api(client, "/brands/review-stats")
    assert body["total_reviews"] == 16
    assert body["brands_with_reviews"] == 2
    assert body["min_reviews"] == 1 and body["brands_meeting_threshold"] == 2
    alpha, beta = body["items"]
    assert alpha == {
        "rank": 1,
        "brand_name": "Alpha Labs",
        "review_count": 9,
        "share": 0.5625,
        "average_rating": 3.3333,
        "five_star_share": 0.3333,
        "recommendation_rate": 0.625,
        "reviewed_products": 2,
    }
    assert beta["brand_name"] == "Beta Botanics"
    assert beta["average_rating"] == 4.0
    assert beta["recommendation_rate"] == 0.8333


def test_highest_rated_brands(client):
    body = api(client, "/brands/review-stats", {"sort_by": "average_rating"})
    assert [b["brand_name"] for b in body["items"]] == ["Beta Botanics", "Alpha Labs"]
    assert [b["rank"] for b in body["items"]] == [1, 2]
    asc = api(client, "/brands/review-stats", {"sort_by": "average_rating", "order": "asc"})
    assert [b["brand_name"] for b in asc["items"]] == ["Alpha Labs", "Beta Botanics"]


def test_minimum_review_count_excludes_small_samples(client):
    body = api(client, "/brands/review-stats", {"sort_by": "average_rating", "min_reviews": 8})
    assert [b["brand_name"] for b in body["items"]] == ["Alpha Labs"]
    assert body["brands_with_reviews"] == 2
    assert body["brands_meeting_threshold"] == 1
    none = api(client, "/brands/review-stats", {"min_reviews": 100})
    assert none["items"] == [] and none["brands_meeting_threshold"] == 0


def test_brand_review_stats_ties_break_by_name(client):
    body = api(client, "/brands/review-stats", {"rating": [5]})
    assert [(b["brand_name"], b["review_count"]) for b in body["items"]] == [
        ("Alpha Labs", 3),
        ("Beta Botanics", 3),
    ]


def test_brand_review_stats_follow_filters_and_limit(client):
    body = api(client, "/brands/review-stats", {"subcategory": "Treatments"})
    assert [b["brand_name"] for b in body["items"]] == ["Beta Botanics"]
    assert body["total_reviews"] == 5
    assert len(api(client, "/brands/review-stats", {"limit": 1})["items"]) == 1
    empty = api(client, "/brands/review-stats", {"brand": "No Such Brand"})
    assert empty["total_reviews"] == 0 and empty["items"] == []


def test_recommendation_rate_sort(client):
    body = api(client, "/brands/review-stats", {"sort_by": "recommendation_rate"})
    assert [b["recommendation_rate"] for b in body["items"]] == [0.8333, 0.625]


@pytest.mark.parametrize(
    "params",
    [
        {"sort_by": "brand_name; drop"},
        {"order": "sideways"},
        {"min_reviews": 0},
        {"limit": 501},
        {"author_id": "A01"},
    ],
)
def test_brand_review_stats_rejects_invalid_input(client, params):
    api(client, "/brands/review-stats", params, status=422)


# ----------------------------------------------------------------------------- brand detail
def test_brand_detail_by_exact_name(client):
    body = api(client, "/brands/detail", {"brand": "Alpha Labs"})
    assert body["brand_name"] == "Alpha Labs"
    assert body["product_count"] == 2
    assert body["review_record_count"] == 9
    assert body["review_average_rating"] == 3.3333


def test_brand_detail_without_reviews(client):
    body = api(client, "/brands/detail", {"brand": "Delta Scents"})
    assert body["category_count"] == 2
    assert body["review_record_count"] == 0
    assert body["review_average_rating"] is None


def test_brand_detail_errors(client):
    api(client, "/brands/detail", {"brand": "alpha labs"}, status=404)  # exact match only
    api(client, "/brands/detail", {"brand": "Alpha"}, status=404)  # no substring match
    api(client, "/brands/detail", status=422)
    api(client, "/brands/detail", {"brand": "x" * 121}, status=422)


# ----------------------------------------------------------------------------- categories by brand
def test_catalogue_categories_for_one_brand(client):
    body = api(client, "/categories/catalogue", {"brand": "Delta Scents"})
    assert body["brand"] == "Delta Scents"
    assert body["total_products"] == 2
    assert {c["category"]: c["product_count"] for c in body["items"]} == {
        "Fragrance": 1,
        "Tools & Brushes": 1,
    }
    assert sum(c["share_of_products"] for c in body["items"]) == 1.0


def test_catalogue_subcategories_for_one_brand(client):
    body = api(client, "/categories/catalogue", {"brand": "Gamma Glow", "parent": "Skincare"})
    assert body["level"] == "secondary"
    assert [(c["category"], c["product_count"]) for c in body["items"]] == [("Masks", 1)]


def test_catalogue_categories_unknown_brand(client):
    api(client, "/categories/catalogue", {"brand": "No Such Brand"}, status=404)
    unfiltered = api(client, "/categories/catalogue")
    assert unfiltered["brand"] is None and unfiltered["total_products"] == 8
