"""Input validation, data exposure and HTTP hardening."""

import pytest

from tests.conftest import FIXTURES, api, make_client

DATA_ENDPOINTS = [
    "/overview",
    "/filters",
    "/kpis",
    "/reviews/rating-distribution",
    "/reviews/trends",
    "/reviews/activity-heatmap",
    "/reviews?page_size=100",
    "/reviews/r_c78c45e2db818b2b",
    "/products/top-reviewed",
    "/products/top-by-year?year=2022",
    "/products/review-years",
    "/products/rating-popularity",
    "/products?page_size=100",
    "/products/P1002",
    "/brands",
    "/brands/top",
    "/categories/catalogue",
    "/categories/reviews",
    "/prices/distribution",
]


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/kpis", {"rating": 6}),
        ("/kpis", {"rating": 0}),
        ("/kpis", {"date_from": "2022-01-01", "date_to": "2021-01-01"}),
        ("/kpis", {"date_from": "not-a-date"}),
        ("/kpis", {"unknown_param": 1}),
        ("/kpis", {"brand": ["x"] * 51}),
        ("/kpis", {"brand": "x" * 121}),
        ("/kpis", {"product_id": "1002"}),
        ("/kpis", {"recommended": "maybe"}),
        ("/reviews", {"page": 0}),
        ("/reviews", {"page_size": 101}),
        ("/reviews", {"q": "a"}),
        ("/reviews", {"q": "x" * 101}),
        ("/reviews", {"sort_by": "__class__"}),
        ("/reviews", {"sort_by": "author_id"}),
        ("/reviews", {"order": "sideways"}),
        ("/reviews/trends", {"granularity": "week"}),
        ("/products/top-reviewed", {"limit": 51}),
        ("/products/top-by-year", {}),
        ("/products/top-by-year", {"year": 1800}),
        ("/products/rating-popularity", {"limit": 3001}),
        ("/products", {"price_min": 50, "price_max": 10}),
        ("/products", {"price_min": -1}),
        ("/products", {"sort_by": "ingredients"}),
        ("/products", {"min_catalogue_rating": 6}),
        ("/brands", {"sort_by": "brand_id"}),
        ("/prices/distribution", {"bin_width": 1, "max_price": 5000}),
        ("/prices/distribution", {"bin_width": 0}),
        ("/reviews/not-an-id", None),
        ("/products/abc", None),
    ],
)
def test_invalid_input_is_rejected_with_422(client, path, params):
    api(client, path, params, status=422)


def test_unknown_resources_return_404(client):
    api(client, "/products/P999999", status=404)
    api(client, "/reviews/r_0000000000000000", status=404)
    api(client, "/categories/catalogue", {"parent": "Nope"}, status=404)


def test_reviewer_identity_is_never_exposed(client):
    for path in DATA_ENDPOINTS:
        res = client.get(f"/api/v1{path}")
        assert res.status_code == 200, path
        body = res.text
        assert "author" not in body, path
        assert '"A01"' not in body and '"A03"' not in body, path


def test_responses_do_not_leak_filesystem_paths(client, tmp_path):
    for path in DATA_ENDPOINTS:
        body = client.get(f"/api/v1{path}").text
        assert str(FIXTURES) not in body and "fixtures" not in body, path


def test_missing_dataset_returns_503_without_paths(empty_client, tmp_path):
    assert api(empty_client, "/health")["dataset_available"] is False
    res = empty_client.get("/api/v1/kpis")
    assert res.status_code == 503
    assert str(tmp_path) not in res.text


def test_security_headers_on_api_responses(client):
    res = client.get("/api/v1/health")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["referrer-policy"] == "no-referrer"
    assert res.headers["cache-control"] == "no-store"


def test_api_is_read_only(client):
    assert client.post("/api/v1/kpis").status_code == 405
    assert client.delete("/api/v1/products/P1001").status_code == 405


def test_cors_allows_only_configured_origins_and_get(client):
    ok = client.options(
        "/api/v1/kpis",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad_origin = client.options(
        "/api/v1/kpis",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in bad_origin.headers
    post = client.options(
        "/api/v1/kpis",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert post.status_code == 400


def test_docs_disabled_in_production(tmp_path):
    prod = make_client(FIXTURES, tmp_path / "cache", environment="production")
    assert prod.get("/docs").status_code == 404
    assert prod.get("/openapi.json").status_code == 404
    dev = make_client(FIXTURES, tmp_path / "cache2")
    assert dev.get("/openapi.json").status_code == 200


def test_large_responses_are_gzipped(client):
    res = client.get("/api/v1/reviews/trends", headers={"Accept-Encoding": "gzip"})
    assert res.headers.get("content-encoding") == "gzip"
