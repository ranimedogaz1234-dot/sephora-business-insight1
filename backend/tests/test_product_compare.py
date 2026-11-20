"""/products/compare on the synthetic fixtures.

Hand-counted (after deduplication):
* P1001 (Alpha Labs, $20): 4 reviews, 2019 x2 (5, 4), 2022 x1 (5), 2023 x1 (4) -> avg 4.5.
* P1003 (Beta Botanics, $68): 5 reviews, 2021 x2 (5, 2), 2022 x2 (5, 5), 2023 x1 (4) -> avg 4.2.
* P1007 (Delta Scents, Fragrance): no review records.
"""

import pytest

from tests.conftest import api


def test_compare_two_products_in_request_order(client):
    body = api(client, "/products/compare", {"product_id": ["P1003", "P1001"]})
    assert body["granularity"] == "year"
    assert [p["product_id"] for p in body["items"]] == ["P1003", "P1001"]
    beta, alpha = body["items"]
    assert beta["price_usd"] == 68.0
    assert beta["review_stats"]["review_record_count"] == 5
    assert beta["review_stats"]["average_rating"] == 4.2
    assert alpha["review_stats"]["average_rating"] == 4.5
    assert [b["count"] for b in alpha["review_stats"]["rating_distribution"]] == [0, 0, 0, 2, 2]
    assert "ingredients" not in alpha  # comparison payload stays lean


def test_compare_activity_shares_one_period_axis(client):
    body = api(client, "/products/compare", {"product_id": ["P1001", "P1003"]})
    by_period = {p["period"]: p for p in body["periods"]}
    assert list(by_period) == ["2019", "2020", "2021", "2022", "2023"]
    assert by_period["2019"]["review_counts"] == [2, 0]
    assert by_period["2019"]["average_ratings"] == [4.5, None]
    assert by_period["2020"]["review_counts"] == [0, 0]
    assert by_period["2021"]["review_counts"] == [0, 2]
    assert by_period["2021"]["average_ratings"] == [None, 3.5]
    assert by_period["2022"]["review_counts"] == [1, 2]
    totals = [sum(p["review_counts"][i] for p in body["periods"]) for i in range(2)]
    assert totals == [4, 5]


def test_compare_quarterly(client):
    body = api(
        client, "/products/compare", {"product_id": ["P1001", "P1003"], "granularity": "quarter"}
    )
    assert body["periods"][0]["period"] == "2019-Q1"
    assert body["periods"][-1]["period"] == "2023-Q1"
    assert sum(sum(p["review_counts"]) for p in body["periods"]) == 9


def test_compare_with_a_product_without_reviews(client):
    body = api(client, "/products/compare", {"product_id": ["P1007", "P1001"]})
    fragrance = body["items"][0]
    assert fragrance["primary_category"] == "Fragrance"
    assert fragrance["review_stats"]["review_record_count"] == 0
    assert fragrance["review_stats"]["average_rating"] is None
    assert all(p["review_counts"][0] == 0 for p in body["periods"])


def test_compare_only_unreviewed_products_has_no_periods(client):
    body = api(client, "/products/compare", {"product_id": ["P1007", "P1008"]})
    assert body["periods"] == []


def test_compare_duplicates_are_collapsed(client):
    body = api(client, "/products/compare", {"product_id": ["P1001", "P1003", "P1001"]})
    assert [p["product_id"] for p in body["items"]] == ["P1001", "P1003"]


def test_compare_unknown_product_is_404(client):
    res = client.get("/api/v1/products/compare", params={"product_id": ["P1001", "P999999"]})
    assert res.status_code == 404
    assert "P999999" in res.json()["detail"]


@pytest.mark.parametrize(
    "params",
    [
        {"product_id": ["P1001"]},
        {"product_id": ["P1001", "P1001"]},
        {"product_id": ["P1001", "P1002", "P1003", "P1004", "P1005"]},
        {"product_id": ["P1001", "1002"]},
        {"product_id": ["P1001", "P1002"], "granularity": "month"},
        {"product_id": ["P1001", "P1002"], "author_id": "A01"},
        {},
    ],
)
def test_compare_rejects_invalid_input(client, params):
    api(client, "/products/compare", params, status=422)
