"""Sentiment command line. Run from backend/ with the virtual environment active.

  python -m app.sentiment.cli status
  python -m app.sentiment.cli estimate --sample 2000          # free: token counting only
  python -m app.sentiment.cli run --sample 2000 --max-cost 3 --yes
  python -m app.sentiment.cli run --max-cost 900 --yes        # everything not yet classified
  python -m app.sentiment.cli insights --max-cost 0.50 --yes  # AI-written insights
  python -m app.sentiment.cli seed-synthetic                  # demo labels, fixtures only

Paid commands need both --yes and a --max-cost at or above the upper estimate.
"""

from __future__ import annotations

import argparse
import sys

from app.core.config import get_settings
from app.data.store import get_dataset
from app.sentiment import runner
from app.sentiment.pricing import cost
from app.sentiment.store import SentimentStore


def _context(args):
    settings = get_settings()
    ds = get_dataset(settings.data_dir, settings.effective_cache_dir)
    store = SentimentStore(settings.sentiment_db_path)
    model = args.model or settings.sentiment_model
    key = settings.anthropic_api_key.get_secret_value() if settings.anthropic_api_key else None
    override = (args.input_price, args.output_price) if args.input_price is not None else None
    return settings, ds, store, model, key, override


def _backend(key: str | None):
    from app.sentiment.backend import AnthropicBatchBackend

    return AnthropicBatchBackend(api_key=key)


def cmd_status(args) -> int:
    settings, ds, store, *_ = _context(args)
    done = len(store.classified_ids() & set(ds.reviews["review_id"].astype(str)))
    print(f"Classified: {done:,} of {len(ds.reviews):,} review records")
    for run in store.runs(limit=5):
        print(
            f"  run {run['id']}: {run['status']}, {run['classified']:,}/{run['requested']:,} "
            f"classified, model {run['model']}, cost ${run['actual_cost'] or 0:,.2f}"
        )
    return 0


def _plan(args):
    settings, ds, store, model, key, override = _context(args)
    prices = runner.prices_for(model, override)
    positions = runner.select_reviews(ds, store, args.sample, args.seed)
    inputs = runner.review_inputs(ds, positions)
    counter = None if args.offline else _backend(key).count_tokens
    est = runner.estimate(
        inputs,
        model=model,
        effort=settings.sentiment_effort,
        group_size=settings.sentiment_group_size,
        prices=prices,
        count_tokens=counter,
        measured_output_per_review=runner.measured_output_per_review(store, model),
    )
    return settings, store, model, key, prices, inputs, est


def cmd_estimate(args) -> int:
    *_, model, _, prices, _, est = _plan(args)
    print(f"Model {model} at ${prices[0]}/${prices[1]} per million input/output tokens")
    print("\n".join(est.lines()))
    print("No reviews were sent for classification.")
    return 0


def cmd_run(args) -> int:
    settings, store, model, key, prices, inputs, est = _plan(args)
    print("\n".join(est.lines()))
    try:
        report = runner.classify(
            inputs,
            store=store,
            backend=_backend(key),
            model=model,
            effort=settings.sentiment_effort,
            group_size=settings.sentiment_group_size,
            prices=prices,
            est=est,
            max_cost=args.max_cost,
            approve=args.yes,
        )
    except runner.CostLimitError as exc:
        print(f"Not run: {exc}", file=sys.stderr)
        return 2
    print(
        f"Classified {report.classified:,} of {report.requested:,}; "
        f"{report.failed:,} still unclassified; spent ${report.spent:,.2f} "
        f"({report.input_tokens:,} in / {report.output_tokens:,} out tokens)."
    )
    if report.clipped:
        print(f"{report.clipped:,} reviews longer than the limit were shortened before sending.")
    for reason, n in report.failures.items():
        print(f"  failures: {n:,} x {reason}")
    return 0


def cmd_insights(args) -> int:
    from app.sentiment.insights_ai import build_request, claude_only_figures, validate

    settings, ds, store, model, key, override = _context(args)
    prices = runner.prices_for(model, override)
    figures = claude_only_figures(ds, store)
    if not figures:
        print("No Claude labels yet: classify reviews first.", file=sys.stderr)
        return 2
    backend = _backend(key)
    request = build_request(model, figures)
    tokens_in = backend.count_tokens(request)
    upper = cost(tokens_in, request["max_tokens"], prices)
    print(f"Upper cost estimate: ${upper:,.4f}")
    if not args.yes or upper > args.max_cost:
        print("Not run: needs --yes and --max-cost at or above the estimate.", file=sys.stderr)
        return 2
    results = list(backend.run_batch([{"custom_id": "insights", "params": request}]))
    items = validate(results[0].text or "", figures) if results and results[0].ok else []
    if not items:
        print("No valid insights returned; nothing stored.", file=sys.stderr)
        return 1
    store.save_insights(model, items)
    print(f"Stored {len(items)} insights.")
    return 0


def cmd_seed(args) -> int:
    _, ds, store, *_ = _context(args)
    n = runner.seed_synthetic(ds, store)
    print(f"Wrote {n} synthetic demo labels (source 'synthetic'; not AI results).")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.sentiment.cli",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("status", "estimate", "run", "insights", "seed-synthetic"):
        p = sub.add_parser(name)
        p.add_argument("--model", help="Claude model ID (default: SBI_SENTIMENT_MODEL)")
        p.add_argument("--input-price", type=float, help="USD per million input tokens")
        p.add_argument("--output-price", type=float, help="USD per million output tokens")
        if name in ("estimate", "run"):
            p.add_argument("--sample", type=int, help="Random sample of unclassified reviews")
            p.add_argument("--seed", type=int, default=7, help="Sample seed (default 7)")
            p.add_argument("--offline", action="store_true", help="Approximate tokens offline")
        if name in ("run", "insights"):
            p.add_argument("--max-cost", type=float, required=True, help="Spending ceiling in USD")
            p.add_argument("--yes", action="store_true", help="Confirm sending data to the API")
    args = parser.parse_args(argv)
    handler = {
        "status": cmd_status,
        "estimate": cmd_estimate,
        "run": cmd_run,
        "insights": cmd_insights,
        "seed-synthetic": cmd_seed,
    }[args.command]
    return handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
