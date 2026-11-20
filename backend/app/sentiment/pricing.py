"""Message Batches prices (USD per million tokens, 50% of standard rates).

Taken from Anthropic's published model prices in November 2026. Check the current price
list before a large run; a model missing here needs explicit --input-price/--output-price.
"""

BATCH_PRICES: dict[str, tuple[float, float]] = {
    "claude-opus-5-5": (2.00, 10.00),
    "claude-sonnet-5-5": (1.00, 5.00),
    "claude-haiku-5-5": (0.05, 0.25),
}

# Output tokens are only known after a run. Until a run of the same model exists, the
# estimate uses this range per request: label JSON (~8 tokens per review) plus the model's
# reasoning at low effort, which varies.
OUTPUT_TOKENS_PER_REVIEW = 8
REASONING_TOKENS_PER_REQUEST = (100, 800)


def cost(input_tokens: float, output_tokens: float, prices: tuple[float, float]) -> float:
    return (input_tokens * prices[0] + output_tokens * prices[1]) / 1_000_000
