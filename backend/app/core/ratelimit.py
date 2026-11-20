"""In-memory token-bucket rate limiting per client (no extra dependency).

Each client gets a bucket of ``burst`` tokens refilled at ``per_minute`` per minute. Requests
cost one token; expensive ones (literal text search, the dataset profile) cost more. When the
bucket is empty the API answers 429 with Retry-After.

Note for deployment: pages are rendered by the Next.js server, so in production most API
calls come from that server's address. List it in SBI_RATE_LIMIT_EXEMPT so the limit applies
to direct API clients only, and set SBI_TRUST_PROXY_HEADERS only behind a trusted proxy.
"""

from __future__ import annotations

import math
import threading
import time
from collections import OrderedDict
from collections.abc import Callable

EXPENSIVE_COST = 5


class RateLimiter:
    def __init__(
        self,
        per_minute: int,
        burst: int,
        max_clients: int = 10_000,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.rate = per_minute / 60.0
        self.capacity = float(burst)
        self.max_clients = max_clients
        self.clock = clock
        self._buckets: OrderedDict[str, tuple[float, float]] = OrderedDict()
        self._lock = threading.Lock()

    def take(self, key: str, cost: int = 1) -> tuple[bool, int, int]:
        """Spend ``cost`` tokens: (allowed, retry_after_seconds, tokens_remaining)."""
        now = self.clock()
        with self._lock:
            tokens, last = self._buckets.pop(key, (self.capacity, now))
            tokens = min(self.capacity, tokens + (now - last) * self.rate)
            allowed = tokens >= cost
            if allowed:
                tokens -= cost
            self._buckets[key] = (tokens, now)  # most recently used last
            while len(self._buckets) > self.max_clients:
                self._buckets.popitem(last=False)  # bounded memory: drop the oldest client
        retry = 0 if allowed else math.ceil((cost - tokens) / self.rate) if self.rate else 60
        return allowed, retry, int(tokens)


def request_cost(path: str, query: str) -> int:
    """Literal text search scans review text; the dataset profile scans every column."""
    if path.endswith("/dataset/profile"):
        return EXPENSIVE_COST
    if ("q=" in query) and path.rstrip("/").endswith(("/reviews", "/products", "/brands")):
        return EXPENSIVE_COST
    return 1
