"""In-memory dataset handed to the services."""

from __future__ import annotations

import threading
from collections import OrderedDict
from collections.abc import Callable, Hashable
from typing import Any, TypeVar

import pandas as pd

T = TypeVar("T")


class Dataset:
    """Prepared products + reviews, with lazily loaded review text and a result memo.

    ``review_texts`` is row-aligned with ``reviews`` (same order and length).
    """

    def __init__(
        self,
        *,
        products: pd.DataFrame,
        reviews: pd.DataFrame,
        raw_review_count: int,
        duplicate_reviews_removed: int,
        review_files: tuple[str, ...],
        source: str,
        texts_loader: Callable[[], pd.DataFrame],
        memo_size: int = 512,
    ) -> None:
        self.products = products
        self.reviews = reviews
        self.raw_review_count = raw_review_count
        self.duplicate_reviews_removed = duplicate_reviews_removed
        self.review_files = review_files
        self.source = source  # "cache" | "csv"
        self._texts_loader = texts_loader
        self._texts: pd.DataFrame | None = None
        self._texts_lock = threading.Lock()
        self._memo_lock = threading.Lock()
        # Separate bounded buckets: small aggregate results vs. (larger) search-hit arrays.
        self._memos: dict[str, OrderedDict[Hashable, Any]] = {
            "results": OrderedDict(),
            "search": OrderedDict(),
        }
        self._memo_sizes = {"results": memo_size, "search": 32}
        self.products_by_id = products.set_index("product_id", drop=False)

    @property
    def review_texts(self) -> pd.DataFrame:
        if self._texts is None:
            with self._texts_lock:
                if self._texts is None:
                    texts = self._texts_loader()
                    if len(texts) != len(self.reviews):
                        raise RuntimeError("review_texts is not aligned with reviews")
                    self._texts = texts
        return self._texts

    @property
    def texts_loaded(self) -> bool:
        return self._texts is not None

    def memo(self, key: Hashable, compute: Callable[[], T], bucket: str = "results") -> T:
        """Cache an immutable computed result (bounded LRU per bucket, thread-safe)."""
        store = self._memos[bucket]
        with self._memo_lock:
            if key in store:
                store.move_to_end(key)
                return store[key]
        value = compute()
        with self._memo_lock:
            store[key] = value
            store.move_to_end(key)
            while len(store) > self._memo_sizes[bucket]:
                store.popitem(last=False)
        return value
