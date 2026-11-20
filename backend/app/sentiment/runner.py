"""Selecting, estimating and classifying reviews.

Safety rules enforced here (not only in the CLI):
* Nothing is sent to the API unless ``approve=True`` and the upper cost estimate is at or
  below ``max_cost``. Spending is re-checked after every batch chunk; the run stops before a
  chunk that could cross the ceiling.
* Already-classified reviews are skipped (persistent cache), so a review is paid for once.
* A group that fails (API error, refusal, truncated or unparseable output, missing ids) is
  split in half and retried, up to ``max_rounds``. Reviews that still fail stay unclassified.
"""

from __future__ import annotations

import hashlib
import math
from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np

from app.data.dataset import Dataset
from app.sentiment import LABELS
from app.sentiment.backend import BatchBackend
from app.sentiment.pricing import (
    BATCH_PRICES,
    OUTPUT_TOKENS_PER_REVIEW,
    REASONING_TOKENS_PER_REQUEST,
    cost,
)
from app.sentiment.prompt import PROMPT_VERSION, ReviewInput, build_params, parse_labels
from app.sentiment.store import LabelRecord, SentimentStore

# Synthetic demo labels may only be written for a dataset this small (the test fixtures),
# so they can never be mixed into the real 1M-review dataset.
SYNTHETIC_MAX_REVIEWS = 1000


class CostLimitError(RuntimeError):
    pass


@dataclass
class Estimate:
    reviews: int
    requests: int
    input_tokens: int
    output_tokens_low: int
    output_tokens_high: int
    cost_low: float
    cost_high: float
    method: str  # how input/output tokens were obtained

    def lines(self) -> list[str]:
        return [
            f"Reviews to classify : {self.reviews:,} in {self.requests:,} requests",
            f"Input tokens        : {self.input_tokens:,} ({self.method})",
            f"Output tokens       : {self.output_tokens_low:,} - {self.output_tokens_high:,}",
            f"Estimated cost (USD): ${self.cost_low:,.2f} - ${self.cost_high:,.2f} (batch prices)",
        ]


@dataclass
class RunReport:
    requested: int
    classified: int = 0
    failed: int = 0
    clipped: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    spent: float = 0.0
    stopped_for_cost: bool = False
    failures: dict[str, int] = field(default_factory=dict)


def select_reviews(
    ds: Dataset, store: SentimentStore, sample: int | None = None, seed: int = 7
) -> np.ndarray:
    """Row positions of reviews that are not classified yet; optionally a seeded random sample."""
    done = store.classified_ids()
    ids = ds.reviews["review_id"].astype(str).to_numpy()
    positions = np.flatnonzero(~np.isin(ids, list(done))) if done else np.arange(len(ids))
    if sample is not None and sample < len(positions):
        rng = np.random.default_rng(seed)
        positions = np.sort(rng.choice(positions, size=sample, replace=False))
    return positions


def review_inputs(ds: Dataset, positions: np.ndarray) -> list[ReviewInput]:
    ids = ds.reviews["review_id"].astype(str).to_numpy()
    texts = ds.review_texts
    titles = texts["review_title"].to_numpy(dtype=object)
    bodies = texts["review_text"].to_numpy(dtype=object)

    def clean(v):
        return None if v is None or (isinstance(v, float) and math.isnan(v)) else str(v)

    return [ReviewInput(ids[p], clean(titles[p]), clean(bodies[p])) for p in positions]


def groups_of(items: list, size: int) -> list[list]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def prices_for(model: str, override: tuple[float, float] | None = None) -> tuple[float, float]:
    if override:
        return override
    if model not in BATCH_PRICES:
        raise ValueError(f"No price known for {model}; pass --input-price and --output-price")
    return BATCH_PRICES[model]


def estimate(
    inputs: list[ReviewInput],
    *,
    model: str,
    effort: str,
    group_size: int,
    prices: tuple[float, float],
    count_tokens: Callable[[dict], int] | None,
    measured_output_per_review: float | None = None,
    sample_groups: int = 20,
) -> Estimate:
    """Input tokens from the free token-counting endpoint on a sample of groups (or a
    character-based approximation offline), extrapolated to all groups. Output tokens from a
    previous run of the same model when available, otherwise the documented range."""
    groups = groups_of(inputs, group_size)
    n_req = len(groups)
    if not inputs:
        return Estimate(0, 0, 0, 0, 0, 0.0, 0.0, "nothing to classify")

    step = max(1, n_req // sample_groups)
    probe = groups[::step][:sample_groups]
    params = [build_params(model, effort, g)[0] for g in probe]
    if count_tokens is not None:
        counted = [count_tokens(p) for p in params]
        method = f"counted with the token-counting API on {len(probe)} sample requests"
    else:
        counted = [
            math.ceil((len(p["system"]) + len(p["messages"][0]["content"])) / 3.5) for p in params
        ]
        method = "approximated offline from character counts (rough)"
    per_review = sum(counted) / sum(len(g) for g in probe)
    input_tokens = round(per_review * len(inputs))

    if measured_output_per_review is not None:
        low = high = round(measured_output_per_review * len(inputs))
    else:
        base = OUTPUT_TOKENS_PER_REVIEW * len(inputs)
        low = base + REASONING_TOKENS_PER_REQUEST[0] * n_req
        high = base + REASONING_TOKENS_PER_REQUEST[1] * n_req
    return Estimate(
        reviews=len(inputs),
        requests=n_req,
        input_tokens=input_tokens,
        output_tokens_low=low,
        output_tokens_high=high,
        cost_low=cost(input_tokens, low, prices),
        cost_high=cost(input_tokens, high, prices),
        method=method,
    )


def _custom_id(group: list[ReviewInput]) -> str:
    """Stable id per group (Message Batches custom_id: <= 64 chars, [a-zA-Z0-9_-])."""
    digest = hashlib.sha256("|".join(r.review_id for r in group).encode()).hexdigest()
    return f"g_{digest[:40]}"


def classify(
    inputs: list[ReviewInput],
    *,
    store: SentimentStore,
    backend: BatchBackend,
    model: str,
    effort: str,
    group_size: int,
    prices: tuple[float, float],
    est: Estimate,
    max_cost: float,
    approve: bool,
    chunk_requests: int = 2000,
    max_rounds: int = 3,
    log: Callable[[str], None] = print,
) -> RunReport:
    if not approve:
        raise CostLimitError("Not approved: re-run with --yes to send reviews to the API.")
    if est.cost_high > max_cost:
        raise CostLimitError(
            f"Estimated cost up to ${est.cost_high:,.2f} exceeds --max-cost ${max_cost:,.2f}."
        )

    report = RunReport(requested=len(inputs))
    run_id = store.start_run("claude", model, PROMPT_VERSION, len(inputs), est.cost_high)
    pending = groups_of(inputs, group_size)
    status = "completed"
    try:
        for round_no in range(1, max_rounds + 1):
            if not pending:
                break
            log(
                f"Round {round_no}: {sum(map(len, pending)):,} reviews in {len(pending):,} requests"
            )
            retry: list[list[ReviewInput]] = []
            for chunk in groups_of(pending, chunk_requests):
                # Worst case for this chunk, from the estimate's per-request upper bound.
                per_req_high = est.cost_high / max(est.requests, 1)
                if report.spent + per_req_high * len(chunk) > max_cost:
                    report.stopped_for_cost = True
                    status = "stopped_at_cost_limit"
                    log("Stopping: the next chunk could exceed --max-cost.")
                    break
                requests, by_id = [], {}
                for g in chunk:
                    params, ids, clipped = build_params(model, effort, g)
                    cid = _custom_id(g)
                    by_id[cid] = (g, ids)
                    report.clipped += clipped
                    requests.append({"custom_id": cid, "params": params})
                for res in backend.run_batch(requests):
                    if res.custom_id not in by_id:
                        continue
                    group, ids = by_id.pop(res.custom_id)
                    report.input_tokens += res.input_tokens
                    report.output_tokens += res.output_tokens
                    report.spent += cost(res.input_tokens, res.output_tokens, prices)
                    labels = parse_labels(res.text, ids) if res.ok and res.text else {}
                    if labels:
                        report.classified += store.save_labels(
                            LabelRecord(rid, lab, "claude", model, PROMPT_VERSION)
                            for rid, lab in labels.items()
                        )
                    missing = [r for r in group if r.review_id not in labels]
                    if missing:
                        reason = res.error or "incomplete output"
                        report.failures[reason] = report.failures.get(reason, 0) + len(missing)
                        retry.extend(_split(missing))
                # Requests the batch never returned are retried like failures.
                for group, _ in by_id.values():
                    retry.extend(_split(group))
            if report.stopped_for_cost:
                break
            pending = retry
        report.failed = report.requested - report.classified
        return report
    except BaseException:
        status = "error"
        raise
    finally:
        store.finish_run(
            run_id,
            classified=report.classified,
            failed=report.requested - report.classified,
            input_tokens=report.input_tokens,
            output_tokens=report.output_tokens,
            actual_cost=round(report.spent, 4),
            status=status,
        )


def _split(group: list[ReviewInput]) -> list[list[ReviewInput]]:
    """Halve a failed group so one problematic review cannot keep failing the others."""
    if len(group) <= 1:
        return [group]
    mid = len(group) // 2
    return [group[:mid], group[mid:]]


def measured_output_per_review(store: SentimentStore, model: str) -> float | None:
    """Output tokens per classified review from the latest finished run of this model."""
    for run in store.runs(limit=50):
        if run["model"] == model and run["classified"] and run["output_tokens"]:
            return run["output_tokens"] / run["classified"]
    return None


def seed_synthetic(ds: Dataset, store: SentimentStore) -> int:
    """Deterministic demo labels for the synthetic fixtures, derived from the star rating
    (4-5 positive, 3 neutral, 1-2 negative) and stored with source 'synthetic'. Refuses on
    any dataset larger than the fixtures, so real reviews can never get synthetic labels."""
    n = len(ds.reviews)
    if n > SYNTHETIC_MAX_REVIEWS:
        raise RuntimeError(
            f"Refusing to write synthetic labels for {n:,} reviews: only allowed for the "
            f"synthetic test fixtures (at most {SYNTHETIC_MAX_REVIEWS} reviews)."
        )
    mapping = {1: "negative", 2: "negative", 3: "neutral", 4: "positive", 5: "positive"}
    ids = ds.reviews["review_id"].astype(str)
    ratings = ds.reviews["rating"].astype(int)
    return store.save_labels(
        LabelRecord(rid, mapping[r], "synthetic", None, "synthetic-rating-rule")
        for rid, r in zip(ids, ratings, strict=True)
        if mapping[r] in LABELS
    )
