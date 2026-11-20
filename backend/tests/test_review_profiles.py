"""/reviews/profiles on the synthetic fixtures (16 deduplicated reviews, 2 without attributes).

Expected skin types, hand-counted from tests/fixtures/reviews_*.csv after deduplication:
combination 4 (ratings 1, 2, 2, 5), dry 4 (5, 5, 4, 3), normal 3 (5, 4, 5), oily 3 (4, 5, 1).
"""

from tests.conftest import api


def _dim(body, name):
    return next(d for d in body["dimensions"] if d["dimension"] == name)


def test_profiles_cover_four_dimensions(client):
    body = api(client, "/reviews/profiles")
    assert body["total_reviews"] == 16
    assert [d["dimension"] for d in body["dimensions"]] == [
        "skin_type",
        "skin_tone",
        "eye_color",
        "hair_color",
    ]
    for d in body["dimensions"]:
        assert d["answered"] + d["missing"] == 16
        assert d["answered"] == sum(s["review_count"] for s in d["segments"])


def test_skin_type_segments_are_hand_checked(client):
    skin = _dim(api(client, "/reviews/profiles"), "skin_type")
    assert skin["answered"] == 14 and skin["missing"] == 2
    # Ordered by review count desc, ties broken alphabetically.
    assert [(s["value"], s["review_count"]) for s in skin["segments"]] == [
        ("combination", 4),
        ("dry", 4),
        ("normal", 3),
        ("oily", 3),
    ]
    by = {s["value"]: s for s in skin["segments"]}
    assert by["combination"]["average_rating"] == 2.5
    assert by["dry"]["average_rating"] == 4.25
    assert by["normal"]["average_rating"] == 4.6667
    assert by["oily"]["average_rating"] == 3.3333
    assert by["combination"]["share"] == round(4 / 14, 4)
    assert by["dry"]["five_star_share"] == 0.5


def test_profiles_honour_review_filters(client):
    body = api(client, "/reviews/profiles", {"brand": "Alpha Labs"})
    skin = _dim(body, "skin_type")
    assert body["total_reviews"] == skin["answered"] + skin["missing"]
    total = api(client, "/kpis", {"brand": "Alpha Labs"})["reviews"]["review_count"]
    assert body["total_reviews"] == total


def test_profiles_empty_when_nothing_matches(client):
    body = api(client, "/reviews/profiles", {"brand": "No Such Brand"})
    assert body["total_reviews"] == 0
    assert all(d["segments"] == [] and d["answered"] == 0 for d in body["dimensions"])


def test_profiles_never_expose_reviewers(client):
    text = str(api(client, "/reviews/profiles"))
    assert "author" not in text
    assert "A01" not in text


def test_profiles_reject_unknown_parameters(client):
    api(client, "/reviews/profiles", {"author_id": "A01"}, status=422)
