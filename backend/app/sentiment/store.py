"""Persistent sentiment store (SQLite, inside the gitignored cache folder).

One row per classified review, keyed by ``review_id`` (a deterministic content hash),
so a review is never classified - or paid for - twice. Every label records its source:

* ``claude``: produced by the Claude API through the CLI.
* ``synthetic``: deterministic demo labels for the synthetic test fixtures only. They are
  never AI results and the API and UI always say so.
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from app.sentiment import LABELS

SOURCES = ("claude", "synthetic")

SCHEMA = f"""
CREATE TABLE IF NOT EXISTS labels (
    review_id      TEXT PRIMARY KEY,
    label          TEXT NOT NULL CHECK (label IN {LABELS!r}),
    source         TEXT NOT NULL CHECK (source IN {SOURCES!r}),
    model          TEXT,
    prompt_version TEXT,
    classified_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      TEXT NOT NULL,
    finished_at     TEXT,
    kind            TEXT NOT NULL,
    model           TEXT,
    prompt_version  TEXT,
    requested       INTEGER NOT NULL,
    classified      INTEGER NOT NULL DEFAULT 0,
    failed          INTEGER NOT NULL DEFAULT 0,
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    estimated_cost  REAL,
    actual_cost     REAL,
    status          TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS insights (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL,
    model       TEXT NOT NULL,
    payload     TEXT NOT NULL
);
"""


def _case(column: str, values: tuple[str, ...]) -> str:
    """SQL mapping a constrained text column to its single-digit index (constants only)."""
    whens = " ".join(f"WHEN '{v}' THEN '{i}'" for i, v in enumerate(values))
    return f"(CASE {column} {whens} END)"


def _digits(text: str | None) -> np.ndarray:
    if not text:
        return np.array([], dtype=np.int8)
    return (np.frombuffer(text.encode("ascii"), dtype=np.uint8) - ord("0")).astype(np.int8)


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


@dataclass(frozen=True)
class LabelRecord:
    review_id: str
    label: str
    source: str
    model: str | None = None
    prompt_version: str | None = None


class SentimentStore:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def connect(self, write: bool = False):
        if write:
            self.path.parent.mkdir(parents=True, exist_ok=True)
        elif not self.path.exists():
            raise FileNotFoundError(self.path)
        conn = sqlite3.connect(self.path)
        try:
            if write:
                conn.executescript(SCHEMA)
            yield conn
            conn.commit()
        finally:
            conn.close()

    @property
    def exists(self) -> bool:
        return self.path.exists()

    def version(self) -> tuple[int, int] | None:
        """Changes whenever the file changes (used to invalidate cached results)."""
        if not self.path.exists():
            return None
        st = self.path.stat()
        return (st.st_mtime_ns, st.st_size)

    # ----------------------------------------------------------------- labels
    def save_labels(self, records: Iterable[LabelRecord]) -> int:
        rows = [
            (r.review_id, r.label, r.source, r.model, r.prompt_version, now_iso())
            for r in records
            if r.label in LABELS and r.source in SOURCES
        ]
        with self.connect(write=True) as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO labels VALUES (?, ?, ?, ?, ?, ?)",
                rows,
            )
        return len(rows)

    def classified_ids(self) -> set[str]:
        if not self.exists:
            return set()
        with self.connect() as conn:
            conn.executescript(SCHEMA)
            return {row[0] for row in conn.execute("SELECT review_id FROM labels")}

    def labels_frame(self) -> pd.DataFrame:
        if not self.exists:
            return pd.DataFrame(columns=["review_id", "label", "source", "model", "prompt_version"])
        with self.connect() as conn:
            conn.executescript(SCHEMA)
            return pd.read_sql_query(
                "SELECT review_id, label, source, model, prompt_version FROM labels", conn
            )

    def label_rows(self, fast: bool | None = None):
        """(review_ids, label_codes, source_codes, models, prompt_versions).

        Codes index LABELS / SOURCES (int8). Reading a million rows as Python tuples is slow,
        so on SQLite >= 3.44 the codes come back as one ordered digit string per column
        (``group_concat(... ORDER BY rowid)``); older SQLite uses one ordered tuple query.
        Both paths return identical results in rowid order."""
        if not self.exists:
            empty = np.array([], dtype=np.int8)
            return [], empty, empty, [], []
        if fast is None:
            fast = sqlite3.sqlite_version_info >= (3, 44, 0)
        label_case = _case("label", LABELS)
        source_case = _case("source", SOURCES)
        with self.connect() as conn:
            conn.executescript(SCHEMA)
            if fast:
                ids = [r[0] for r in conn.execute("SELECT review_id FROM labels ORDER BY rowid")]
                lab, src = conn.execute(
                    f"SELECT group_concat({label_case}, '' ORDER BY rowid), "  # noqa: S608
                    f"group_concat({source_case}, '' ORDER BY rowid) FROM labels"
                ).fetchone()
                labels = _digits(lab)
                sources = _digits(src)
            else:
                rows = conn.execute(
                    f"SELECT review_id, {label_case}, {source_case} FROM labels ORDER BY rowid"  # noqa: S608
                ).fetchall()
                ids = [r[0] for r in rows]
                labels = np.fromiter((int(r[1]) for r in rows), np.int8, len(rows))
                sources = np.fromiter((int(r[2]) for r in rows), np.int8, len(rows))
            meta = conn.execute("SELECT DISTINCT model, prompt_version FROM labels").fetchall()
        models = sorted({m for m, _ in meta if m})
        versions = sorted({v for _, v in meta if v})
        return ids, labels, sources, models, versions

    # ----------------------------------------------------------------- runs
    def start_run(
        self,
        kind: str,
        model: str | None,
        prompt_version: str | None,
        requested: int,
        estimated_cost: float | None,
    ) -> int:
        with self.connect(write=True) as conn:
            cur = conn.execute(
                "INSERT INTO runs (started_at, kind, model, prompt_version, requested, "
                "estimated_cost, status) VALUES (?, ?, ?, ?, ?, ?, 'running')",
                (now_iso(), kind, model, prompt_version, requested, estimated_cost),
            )
            return int(cur.lastrowid)

    def finish_run(
        self,
        run_id: int,
        *,
        classified: int,
        failed: int,
        input_tokens: int,
        output_tokens: int,
        actual_cost: float | None,
        status: str,
    ) -> None:
        with self.connect(write=True) as conn:
            conn.execute(
                "UPDATE runs SET finished_at=?, classified=?, failed=?, input_tokens=?, "
                "output_tokens=?, actual_cost=?, status=? WHERE id=?",
                (
                    now_iso(),
                    classified,
                    failed,
                    input_tokens,
                    output_tokens,
                    actual_cost,
                    status,
                    run_id,
                ),
            )

    def runs(self, limit: int = 10) -> list[dict]:
        if not self.exists:
            return []
        with self.connect() as conn:
            conn.executescript(SCHEMA)
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT * FROM runs ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(r) for r in rows]

    # ----------------------------------------------------------------- insights
    def save_insights(self, model: str, payload: list[dict]) -> None:
        with self.connect(write=True) as conn:
            conn.execute(
                "INSERT INTO insights (created_at, model, payload) VALUES (?, ?, ?)",
                (now_iso(), model, json.dumps(payload)),
            )

    def latest_insights(self) -> dict | None:
        if not self.exists:
            return None
        with self.connect() as conn:
            conn.executescript(SCHEMA)
            row = conn.execute(
                "SELECT created_at, model, payload FROM insights ORDER BY id DESC LIMIT 1"
            ).fetchone()
        if row is None:
            return None
        return {"created_at": row[0], "model": row[1], "items": json.loads(row[2])}
