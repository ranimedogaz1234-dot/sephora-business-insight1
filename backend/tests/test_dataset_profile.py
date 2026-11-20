"""/dataset/profile on the synthetic fixtures.

Fixture facts: 8 catalogue products (one has no catalogue rating or review count, one has no
tertiary category); 18 raw review rows, 2 exact duplicates, 16 records; 2 records without
reviewer attributes or a recommendation answer; 4 of the 5 Skincare products are reviewed.
"""

from tests.conftest import api


def _table(body, name):
    return next(t for t in body["tables"] if t["name"] == name)


def _col(table, name):
    return next(c for c in table["columns"] if c["name"] == name)


def test_profile_lists_both_tables_with_source_columns(client):
    body = api(client, "/dataset/profile")
    products, reviews = _table(body, "products"), _table(body, "reviews")
    assert products["row_count"] == 8 and products["source"] == "product_info.csv"
    assert reviews["row_count"] == 16
    assert reviews["source"] == "reviews_0-1.csv, reviews_1-2.csv"
    assert len(products["columns"]) == 27  # every product_info.csv column
    assert [c["name"] for c in reviews["columns"]][:2] == ["reviewer_id (withheld)", "rating"]
    assert set(reviews["dropped_columns"]) == {"Unnamed: 0", "product_name", "price_usd"}


def test_missing_value_statistics(client):
    body = api(client, "/dataset/profile")
    products, reviews = _table(body, "products"), _table(body, "reviews")
    rating = _col(products, "rating")
    assert rating["missing"] == 1 and rating["non_null"] == 7
    assert rating["missing_share"] == 0.125
    assert _col(products, "tertiary_category")["missing"] == 1
    for name in ("skin_tone", "skin_type", "is_recommended"):
        assert _col(reviews, name)["missing"] == 2, name
    assert _col(reviews, "submission_time")["missing"] == 0


def test_column_statistics_by_kind(client):
    body = api(client, "/dataset/profile")
    products, reviews = _table(body, "products"), _table(body, "reviews")
    price = _col(products, "price_usd")
    assert (price["min"], price["max"]) == (20.0, 310.0)
    assert _col(products, "primary_category")["distinct"] == 4
    assert _col(products, "brand_name")["distinct"] == 4
    stars = _col(reviews, "rating")
    assert (stars["min"], stars["max"]) == (1.0, 5.0)
    assert stars["mean"] == 3.625
    when = _col(reviews, "submission_time")
    assert (when["date_min"], when["date_max"]) == ("2019-03-10", "2023-03-01")
    assert _col(reviews, "skin_type")["distinct"] == 4
    assert _col(reviews, "review_text")["median_length"] > 0


def test_reviewer_identifier_is_withheld(client):
    body = api(client, "/dataset/profile")
    author = _col(_table(body, "reviews"), "reviewer_id (withheld)")
    assert author["exposed"] is False
    for key in ("non_null", "missing", "missing_share", "distinct", "min", "max"):
        assert author[key] is None
    text = str(body)
    assert "author" not in text  # the source field name is not echoed either
    assert "A01" not in text  # no reviewer IDs
    assert "Holy grail" not in text  # no review text values


def test_quality_checks_are_computed(client):
    checks = {c["name"]: c for c in api(client, "/dataset/profile")["checks"]}
    dup = checks["Exact duplicate reviews removed"]
    assert dup["status"] == "info" and dup["value"] == "2 of 18 raw rows"
    assert checks["Ratings within 1–5"]["status"] == "pass"
    assert checks["Reviews linked to catalogue products"]["value"] == "100.0% linked"
    assert checks["Skincare products with review records"]["value"] == "4 of 5 (80.0%)"
    assert checks["Recommendation answered"]["value"] == "87.5% of review records"
    assert {c["status"] for c in checks.values()} <= {"pass", "warn", "info"}
