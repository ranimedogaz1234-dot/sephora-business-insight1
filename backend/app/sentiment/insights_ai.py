"""AI-written insights over computed figures (never over raw review text).

Claude receives only the named evidence figures from ``services.sentiment.evidence`` and must
cite them by key. Each insight is validated: unknown keys are rejected, and the stored
insight carries the actual computed values for every key it cites, so the UI always shows
the evidence next to the statement.
"""

from __future__ import annotations

import json

from app.schemas.queries import ReviewFilters
from app.sentiment.store import SentimentStore
from app.services.sentiment import evidence

INSIGHTS_PROMPT = """You are a retail analyst. Below are computed sentiment figures for Skincare
product reviews (shares are fractions of classified reviews). Write 3 to 5 concise business
insights. Use only these figures: do not invent numbers, products, causes or customer quotes.
Every insight must list the keys of the figures it relies on in evidence_keys."""

SCHEMA = {
    "type": "object",
    "properties": {
        "insights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "statement": {"type": "string"},
                    "evidence_keys": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["title", "statement", "evidence_keys"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["insights"],
    "additionalProperties": False,
}


def build_request(model: str, figures: dict[str, dict]) -> dict:
    return {
        "model": model,
        "max_tokens": 4096,
        "system": INSIGHTS_PROMPT,
        "messages": [{"role": "user", "content": json.dumps(figures, ensure_ascii=False)}],
        "output_config": {"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
    }


def validate(text: str, figures: dict[str, dict]) -> list[dict]:
    """Keep insights whose evidence keys all exist; attach the cited figures as evidence."""
    try:
        items = json.loads(text).get("insights", [])
    except (json.JSONDecodeError, AttributeError):
        return []
    out = []
    for i, item in enumerate(items if isinstance(items, list) else []):
        keys = item.get("evidence_keys") if isinstance(item, dict) else None
        if not keys or not all(isinstance(k, str) and k in figures for k in keys):
            continue
        out.append(
            {
                "id": f"ai_{i + 1}",
                "title": str(item["title"])[:120],
                "statement": str(item["statement"])[:600],
                "evidence": [
                    {"label": f"{k}.{field}", "value": str(value)}
                    for k in keys
                    for field, value in figures[k].items()
                ],
            }
        )
    return out


def claude_only_figures(ds, store: SentimentStore) -> dict[str, dict]:
    """Evidence computed from Claude labels only; refuses if synthetic labels are present."""
    frame = store.labels_frame()
    if (frame["source"] == "synthetic").any():
        raise RuntimeError(
            "Synthetic demo labels are present; AI insights need real Claude labels."
        )
    return evidence(ds, store, ReviewFilters())
