"""Rate limiting: token bucket, request costs, middleware behaviour and configuration."""

from app.core.ratelimit import EXPENSIVE_COST, RateLimiter, request_cost
from tests.conftest import FIXTURES, api, make_client


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_bucket_allows_burst_then_refills():
    clock = Clock()
    rl = RateLimiter(per_minute=60, burst=3, clock=clock)  # 1 token per second
    assert [rl.take("a")[0] for _ in range(4)] == [True, True, True, False]
    allowed, retry, _ = rl.take("a")
    assert not allowed and retry == 1
    clock.now = 2.0
    assert rl.take("a")[0] and rl.take("a")[0] and not rl.take("a")[0]
    assert rl.take("b")[0]  # clients are independent


def test_expensive_requests_cost_more():
    rl = RateLimiter(per_minute=60, burst=EXPENSIVE_COST, clock=Clock())
    assert rl.take("a", EXPENSIVE_COST)[0]
    assert not rl.take("a", 1)[0]
    assert request_cost("/api/v1/reviews", "q=serum&page=2") == EXPENSIVE_COST
    assert request_cost("/api/v1/products", "q=glow") == EXPENSIVE_COST
    assert request_cost("/api/v1/dataset/profile", "") == EXPENSIVE_COST
    assert request_cost("/api/v1/reviews", "rating=5") == 1
    assert request_cost("/api/v1/reviews/rating-distribution", "q=x") == 1


def test_memory_is_bounded():
    rl = RateLimiter(per_minute=60, burst=5, max_clients=3, clock=Clock())
    for key in "abcde":
        rl.take(key)
    assert list(rl._buckets) == ["c", "d", "e"]


def test_api_returns_429_with_retry_after(tmp_path):
    c = make_client(FIXTURES, tmp_path / "c", rate_limit_per_minute=60, rate_limit_burst=3)
    for _ in range(3):
        res = c.get("/api/v1/health")
        assert res.status_code == 200
    assert res.headers["X-RateLimit-Remaining"] == "0"
    blocked = c.get("/api/v1/health")
    assert blocked.status_code == 429
    assert blocked.json() == {"detail": "Too many requests. Please slow down."}
    assert int(blocked.headers["Retry-After"]) >= 1
    assert blocked.headers["X-Content-Type-Options"] == "nosniff"


def test_429_keeps_cors_headers_for_allowed_origins(tmp_path):
    c = make_client(FIXTURES, tmp_path / "c", rate_limit_per_minute=60, rate_limit_burst=1)
    origin = {"Origin": "http://localhost:3001"}
    c.get("/api/v1/health", headers=origin)
    blocked = c.get("/api/v1/health", headers=origin)
    assert blocked.status_code == 429
    assert blocked.headers["access-control-allow-origin"] == "http://localhost:3001"


def test_text_search_uses_more_of_the_budget(tmp_path):
    c = make_client(FIXTURES, tmp_path / "c", rate_limit_per_minute=60, rate_limit_burst=6)
    assert c.get("/api/v1/reviews", params={"q": "serum"}).status_code == 200
    assert c.get("/api/v1/health").headers["X-RateLimit-Remaining"] == "0"
    assert c.get("/api/v1/health").status_code == 429


def test_exempt_clients_and_disabled_limit(tmp_path):
    exempt = make_client(
        FIXTURES,
        tmp_path / "a",
        rate_limit_per_minute=60,
        rate_limit_burst=1,
        rate_limit_exempt=["testclient"],
    )
    assert all(exempt.get("/api/v1/health").status_code == 200 for _ in range(5))
    off = make_client(FIXTURES, tmp_path / "b", rate_limit_per_minute=0)
    assert all(off.get("/api/v1/health").status_code == 200 for _ in range(5))


def test_forwarded_for_only_when_trusted(tmp_path):
    spoof = {"X-Forwarded-For": "203.0.113.9"}
    untrusted = make_client(FIXTURES, tmp_path / "a", rate_limit_per_minute=60, rate_limit_burst=1)
    untrusted.get("/api/v1/health", headers=spoof)
    # A spoofed header does not give an untrusted client a fresh bucket.
    assert (
        untrusted.get("/api/v1/health", headers={"X-Forwarded-For": "198.51.100.7"}).status_code
        == 429
    )
    trusted = make_client(
        FIXTURES,
        tmp_path / "b",
        rate_limit_per_minute=60,
        rate_limit_burst=1,
        trust_proxy_headers=True,
    )
    trusted.get("/api/v1/health", headers=spoof)
    assert trusted.get("/api/v1/health", headers=spoof).status_code == 429
    assert (
        trusted.get("/api/v1/health", headers={"X-Forwarded-For": "198.51.100.7"}).status_code
        == 200
    )


def test_docs_and_preflight_are_not_limited(tmp_path):
    c = make_client(FIXTURES, tmp_path / "c", rate_limit_per_minute=60, rate_limit_burst=1)
    c.get("/api/v1/health")
    preflight = c.options(
        "/api/v1/kpis",
        headers={"Origin": "http://localhost:3001", "Access-Control-Request-Method": "GET"},
    )
    assert preflight.status_code == 200
    assert c.get("/openapi.json").status_code == 200


def test_api_responses_carry_a_strict_csp(client):
    res = client.get("/api/v1/health")
    assert res.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"
    api(client, "/kpis")
