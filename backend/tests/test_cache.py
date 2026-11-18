import json
import os
import shutil
from pathlib import Path

import pandas as pd
import pytest

from app.data import cache
from app.data.build_cache import main as build_cache_main
from app.data.loader import read_dataset
from app.data.prepare import prepare
from app.data.store import clear_cache, get_dataset, open_dataset
from tests.conftest import FIXTURES


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    """A private copy of the fixtures so tests can modify source files."""
    target = tmp_path / "data"
    shutil.copytree(FIXTURES, target, ignore=shutil.ignore_patterns("*.py", "__pycache__"))
    return target


def test_first_open_builds_cache_then_reuses_it(data_dir, tmp_path):
    cache_dir = tmp_path / "cache"
    first = open_dataset(data_dir, cache_dir)
    assert first.source == "csv"
    assert sorted(p.name for p in cache_dir.iterdir()) == sorted(
        [cache.MANIFEST, *cache.DATA_FILES]
    )
    second = open_dataset(data_dir, cache_dir)
    assert second.source == "cache"
    assert not second.texts_loaded  # review text is lazy


def test_cached_tables_equal_freshly_prepared_tables(data_dir, tmp_path):
    cache_dir = tmp_path / "cache"
    open_dataset(data_dir, cache_dir)
    cached = open_dataset(data_dir, cache_dir)
    fresh = prepare(read_dataset(data_dir))
    # Strict: values AND dtypes (incl. category label dtypes) survive the Parquet round-trip.
    pd.testing.assert_frame_equal(cached.products, fresh.products)
    pd.testing.assert_frame_equal(cached.reviews, fresh.reviews)
    pd.testing.assert_frame_equal(cached.review_texts, fresh.review_texts)


def test_manifest_records_sources_counts_and_digest(data_dir, tmp_path):
    cache_dir = tmp_path / "cache"
    open_dataset(data_dir, cache_dir)
    manifest = json.loads((cache_dir / cache.MANIFEST).read_text())
    assert manifest["cache_version"] == cache.CACHE_VERSION
    assert [s["name"] for s in manifest["sources"]] == [
        "product_info.csv",
        "reviews_0-1.csv",
        "reviews_1-2.csv",
    ]
    assert all(len(s["sha256"]) == 64 for s in manifest["sources"])
    assert manifest["counts"] == {
        "products": 8,
        "raw_reviews": 18,
        "duplicate_reviews_removed": 2,
        "reviews": 16,
    }
    assert str(data_dir) not in json.dumps(manifest)  # no absolute paths stored


def test_rebuild_is_reproducible(data_dir, tmp_path):
    a = cache.build_cache(data_dir, tmp_path / "a")[1]
    b = cache.build_cache(data_dir, tmp_path / "b")[1]
    assert a["review_id_digest"] == b["review_id_digest"]
    for name in (cache.PRODUCTS_FILE, cache.REVIEWS_FILE, cache.TEXTS_FILE):
        pd.testing.assert_frame_equal(
            pd.read_parquet(tmp_path / "a" / name), pd.read_parquet(tmp_path / "b" / name)
        )


def test_prepared_tables_do_not_depend_on_review_file_order(data_dir, tmp_path):
    swapped = tmp_path / "swapped"
    swapped.mkdir()
    shutil.copy(data_dir / "product_info.csv", swapped)
    shutil.copy(data_dir / "reviews_0-1.csv", swapped / "reviews_1-2.csv")
    shutil.copy(data_dir / "reviews_1-2.csv", swapped / "reviews_0-1.csv")
    a = prepare(read_dataset(data_dir))
    b = prepare(read_dataset(swapped))
    pd.testing.assert_frame_equal(a.reviews, b.reviews)
    pd.testing.assert_frame_equal(a.review_texts, b.review_texts)


def test_changed_source_file_invalidates_cache(data_dir, tmp_path):
    cache_dir = tmp_path / "cache"
    open_dataset(data_dir, cache_dir)
    with (data_dir / "reviews_1-2.csv").open("a", encoding="utf-8") as f:
        f.write(
            "6,A99,5,1.0,,0,0,0,2023-03-10,New synthetic row,New,light,brown,dry,black,"
            "P1004,Synthetic Day Lotion,Beta Botanics,32.0\n"
        )
    ds = open_dataset(data_dir, cache_dir)
    assert ds.source == "csv"  # rebuilt
    assert len(ds.reviews) == 17


def test_content_change_with_same_size_and_mtime_needs_hash_check(data_dir, tmp_path):
    cache_dir = tmp_path / "cache"
    open_dataset(data_dir, cache_dir)
    path = data_dir / "reviews_0-1.csv"
    st = path.stat()
    # Byte-level edit keeps line endings, so the size is unchanged.
    path.write_bytes(path.read_bytes().replace(b"Holy grail cleanser", b"Holy grail cleanzer"))
    os.utime(path, ns=(st.st_atime_ns, st.st_mtime_ns))
    assert path.stat().st_size == st.st_size

    assert cache.load_valid_manifest(data_dir, cache_dir, verify_hash=False) is not None
    assert cache.load_valid_manifest(data_dir, cache_dir, verify_hash=True) is None


@pytest.mark.parametrize("damage", ["version", "corrupt", "missing_file"])
def test_invalid_cache_is_rebuilt(data_dir, tmp_path, damage):
    cache_dir = tmp_path / "cache"
    open_dataset(data_dir, cache_dir)
    manifest_path = cache_dir / cache.MANIFEST
    if damage == "version":
        m = json.loads(manifest_path.read_text())
        m["cache_version"] = -1
        manifest_path.write_text(json.dumps(m))
    elif damage == "corrupt":
        manifest_path.write_text("{not json")
    else:
        (cache_dir / cache.REVIEWS_FILE).unlink()
    assert open_dataset(data_dir, cache_dir).source == "csv"
    assert open_dataset(data_dir, cache_dir).source == "cache"


def test_no_staging_folders_left_behind(data_dir, tmp_path):
    cache_dir = tmp_path / "cache"
    cache.build_cache(data_dir, cache_dir)
    assert not [p for p in cache_dir.iterdir() if p.name.startswith(".staging")]


def test_store_keeps_one_dataset_per_data_dir(data_dir, tmp_path):
    a = get_dataset(data_dir, tmp_path / "cache")
    assert get_dataset(data_dir, tmp_path / "cache") is a
    clear_cache()
    assert get_dataset(data_dir, tmp_path / "cache") is not a


def test_cli_builds_and_validates(data_dir, tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("SBI_DATA_DIR", str(data_dir))
    monkeypatch.setenv("SBI_CACHE_DIR", str(tmp_path / "cli-cache"))
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        assert build_cache_main([]) == 0
        assert "built" in capsys.readouterr().out
        assert build_cache_main([]) == 0
        assert "valid" in capsys.readouterr().out
    finally:
        get_settings.cache_clear()


def test_cli_reports_missing_dataset(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("SBI_DATA_DIR", str(tmp_path / "nothing"))
    monkeypatch.setenv("SBI_CACHE_DIR", str(tmp_path / "cli-cache"))
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        assert build_cache_main([]) == 1
        out = capsys.readouterr().out
        assert "Dataset not found" in out and str(tmp_path) not in out
    finally:
        get_settings.cache_clear()
