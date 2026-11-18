import pandas as pd

from app.data.loader import clean_reviews, read_dataset, read_raw_reviews
from app.data.prepare import prepare
from tests.conftest import FIXTURES


def test_removes_only_exact_duplicates():
    raw = read_dataset(FIXTURES)
    assert raw.raw_review_count == 18
    assert raw.duplicate_reviews_removed == 2
    assert len(raw.reviews) == 16


def test_preserves_near_duplicates_that_differ_in_meaningful_fields():
    reviews = read_dataset(FIXTURES).reviews
    a03 = reviews[reviews["author_id"] == "A03"]
    assert sorted(a03["rating"].tolist()) == [1, 2]


def test_csv_index_column_is_dropped():
    assert not any(c.startswith("Unnamed") for c in read_dataset(FIXTURES).reviews.columns)


def test_review_ids_are_unique_and_deterministic():
    first = read_dataset(FIXTURES).reviews["review_id"]
    second = read_dataset(FIXTURES).reviews["review_id"]
    assert first.is_unique
    assert first.str.match(r"^r_[0-9a-f]{16}$").all()
    assert first.tolist() == second.tolist()


def test_review_ids_are_stable_golden_values():
    """Guards the ID contract: changing hashing inputs would break stored references."""
    reviews = read_dataset(FIXTURES).reviews.set_index("review_id")
    assert reviews.loc["r_024f805993769034", "author_id"] == "A01"
    assert reviews.loc["r_c78c45e2db818b2b", "rating"] == 1  # A03, rating 1
    assert reviews.loc["r_e36c9f0d0e0210c8", "rating"] == 2  # A03 near-duplicate, rating 2


def test_review_ids_do_not_depend_on_row_order():
    raw, _ = read_raw_reviews(FIXTURES)
    forward, _ = clean_reviews(raw)
    backward, _ = clean_reviews(raw.iloc[::-1].reset_index(drop=True))
    assert set(forward["review_id"]) == set(backward["review_id"])


def test_prepare_produces_compact_typed_tables():
    data = prepare(read_dataset(FIXTURES))
    r, p = data.reviews, data.products
    assert "author_id" not in r.columns  # replaced by a non-exposed integer key
    assert r["author_key"].dtype == "int32"
    assert r["rating"].dtype == "int8"
    assert isinstance(r["brand_name"].dtype, pd.CategoricalDtype)
    assert isinstance(r["subcategory"].dtype, pd.CategoricalDtype)
    assert {"review_text", "review_title"}.isdisjoint(r.columns)
    assert len(data.review_texts) == len(r)
    # catalogue columns renamed so the two review counts can never be confused
    assert {"catalogue_rating", "sephora_review_count"} <= set(p.columns)
    assert {"rating", "reviews"}.isdisjoint(p.columns)


def test_prepared_reviews_are_sorted_and_aligned_with_texts():
    data = prepare(read_dataset(FIXTURES))
    keys = list(zip(data.reviews["submission_time"], data.reviews["review_id"], strict=True))
    assert keys == sorted(keys)
    raw = read_dataset(FIXTURES).reviews.set_index("review_id")
    for rid, title in zip(
        data.reviews["review_id"], data.review_texts["review_title"], strict=True
    ):
        assert raw.loc[rid, "review_title"] == title


def test_reviews_get_skincare_subcategory_from_catalogue():
    data = prepare(read_dataset(FIXTURES))
    subs = dict(
        zip(data.reviews["product_id"].astype(str), data.reviews["subcategory"], strict=True)
    )
    assert subs == {
        "P1001": "Cleansers",
        "P1002": "Moisturizers",
        "P1003": "Treatments",
        "P1004": "Moisturizers",
    }
