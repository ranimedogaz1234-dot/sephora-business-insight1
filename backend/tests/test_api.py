def test_health_reports_dataset_status(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["dataset_available"] is True
    assert body["dataset_loaded"] is False


def test_overview_kpis_come_from_records(client):
    res = client.get("/api/v1/overview")
    assert res.status_code == 200
    body = res.json()

    assert body["catalogue"] == {
        "total_products": 3,
        "total_brands": 2,
        "total_categories": 2,
        "sephora_listed_review_count": 42,
    }

    reviews = body["reviews"]
    assert reviews["raw_review_count"] == 6
    assert reviews["duplicate_reviews_removed"] == 1
    assert reviews["review_count"] == 5
    assert reviews["reviewed_products"] == 2
    assert reviews["average_rating"] == 3.4
    assert reviews["five_star_share"] == 0.4
    assert reviews["first_review_date"] == "2019-01-10"
    assert reviews["last_review_date"] == "2023-02-28"
    assert reviews["review_scope_category"] == "Skincare"


def test_health_marks_dataset_loaded_after_overview(client):
    client.get("/api/v1/overview")
    assert client.get("/api/v1/health").json()["dataset_loaded"] is True


def test_missing_dataset_returns_503(empty_client):
    assert empty_client.get("/api/v1/health").json()["dataset_available"] is False
    res = empty_client.get("/api/v1/overview")
    assert res.status_code == 503
