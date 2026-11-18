"""Process-wide, lazily loaded dataset cache."""

from __future__ import annotations

import threading
from pathlib import Path

from app.data.loader import Dataset, load_dataset

_lock = threading.Lock()
_cache: dict[Path, Dataset] = {}


def get_dataset(data_dir: Path) -> Dataset:
    key = data_dir.resolve()
    with _lock:
        if key not in _cache:
            _cache[key] = load_dataset(key)
        return _cache[key]


def is_loaded(data_dir: Path) -> bool:
    return data_dir.resolve() in _cache


def clear_cache() -> None:
    with _lock:
        _cache.clear()
