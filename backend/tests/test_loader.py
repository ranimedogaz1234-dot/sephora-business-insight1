from app.data.loader import clean_reviews, load_dataset, read_raw_reviews
from tests.conftest import FIXTURES


def test_removes_only_exact_duplicates():
    ds = load_dataset(FIXTURES)
    assert ds.raw_review_count == 6
    assert ds.duplicate_reviews_removed == 1
    assert len(ds.reviews) == 5


def test_preserves_near_duplicates_that_differ_in_meaningful_fields():
    ds = load_dataset(FIXTURES)
    a003 = ds.reviews[ds.reviews["author_id"] == "A003"]
    assert sorted(a003["rating"].tolist()) == [1, 2]


def test_csv_index_column_is_dropped():
    ds = load_dataset(FIXTURES)
    assert not any(c.startswith("Unnamed") for c in ds.reviews.columns)


def test_review_ids_are_unique_and_deterministic():
    first = load_dataset(FIXTURES).reviews["review_id"]
    second = load_dataset(FIXTURES).reviews["review_id"]
    assert first.is_unique
    assert first.str.match(r"^r_[0-9a-f]{16}$").all()
    assert first.tolist() == second.tolist()


def test_review_ids_do_not_depend_on_row_order():
    raw, _ = read_raw_reviews(FIXTURES)
    forward, _ = clean_reviews(raw)
    backward, _ = clean_reviews(raw.iloc[::-1].reset_index(drop=True))
    assert set(forward["review_id"]) == set(backward["review_id"])
