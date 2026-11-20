"""Claude Message Batches backend, behind a small interface so tests use a fake.

The API key is read only on the backend (ANTHROPIC_API_KEY in backend/.env or the
environment) and is never logged or returned.
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class BatchResult:
    custom_id: str
    ok: bool
    text: str | None = None
    stop_reason: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    error: str | None = None


class BatchBackend(Protocol):
    def count_tokens(self, params: dict) -> int: ...
    def run_batch(self, requests: list[dict]) -> Iterator[BatchResult]: ...


class AnthropicBatchBackend:
    """Submits one Message Batch, waits for it to end and yields per-request results."""

    def __init__(self, api_key: str | None = None, poll_seconds: int = 30, log=print):
        import anthropic

        # max_retries: the SDK retries 408/409/429/5xx and connection errors with backoff.
        self.client = anthropic.Anthropic(api_key=api_key, max_retries=5)
        self.poll_seconds = poll_seconds
        self.log = log

    def count_tokens(self, params: dict) -> int:
        allowed = {"model", "system", "messages", "output_config"}
        return self.client.messages.count_tokens(
            **{k: v for k, v in params.items() if k in allowed}
        ).input_tokens

    def run_batch(self, requests: list[dict]) -> Iterator[BatchResult]:
        batch = self.client.messages.batches.create(requests=requests)
        self.log(f"  submitted batch {batch.id} ({len(requests)} requests)")
        while batch.processing_status != "ended":
            time.sleep(self.poll_seconds)
            batch = self.client.messages.batches.retrieve(batch.id)
            c = batch.request_counts
            self.log(f"  {batch.processing_status}: {c.succeeded} done, {c.processing} processing")
        for r in self.client.messages.batches.results(batch.id):
            if r.result.type == "succeeded":
                msg = r.result.message
                text = next((b.text for b in msg.content if b.type == "text"), None)
                yield BatchResult(
                    custom_id=r.custom_id,
                    ok=msg.stop_reason == "end_turn",
                    text=text,
                    stop_reason=msg.stop_reason,
                    input_tokens=msg.usage.input_tokens,
                    output_tokens=msg.usage.output_tokens,
                    error=None
                    if msg.stop_reason == "end_turn"
                    else f"stop_reason={msg.stop_reason}",
                )
            else:
                detail = getattr(getattr(r.result, "error", None), "type", None) or r.result.type
                yield BatchResult(custom_id=r.custom_id, ok=False, error=str(detail))
