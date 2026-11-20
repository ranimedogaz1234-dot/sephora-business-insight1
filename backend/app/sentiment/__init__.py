"""AI sentiment analysis of review records.

Paid classification runs only from the command line (``python -m app.sentiment.cli``)
with an explicit cost ceiling and confirmation; the web API only reads stored results.
"""

LABELS = ("positive", "neutral", "negative")
