"""Generate a LARGE SYNTHETIC dataset with the real CSV schema, for benchmarking only.

No Sephora data is used: products, brands, ratings, dates and review text are random
(text is assembled from neutral template phrases). It lets the API be timed at the real
dataset's scale without access to the private CSV files.

Usage (from backend/; write OUTSIDE the repository):

    python -m scripts.make_synthetic_dataset /tmp/sbi-synthetic --reviews 1100000
    SBI_DATA_DIR=/tmp/sbi-synthetic SBI_CACHE_DIR=/tmp/sbi-synthetic-cache \
        python -m scripts.benchmark --rebuild
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from tests.fixtures.make_fixtures import PRODUCT_COLUMNS

CATEGORIES = {
    "Skincare": ["Moisturizers", "Treatments", "Cleansers", "Eye Care", "Masks", "Sunscreen",
                 "Lip Balms & Treatments", "Self Tanners", "Wellness", "High Tech Tools"],
    "Makeup": ["Face", "Eye", "Lip", "Cheek", "Nail"],
    "Hair": ["Shampoo & Conditioner", "Treatments", "Styling"],
    "Fragrance": ["Women", "Men", "Value & Gift Sets"],
    "Bath & Body": ["Body Moisturizers", "Bath & Shower"],
    "Tools & Brushes": ["Brushes & Applicators", "Accessories"],
    "Mini Size": ["Skincare", "Makeup"],
    "Men": ["Skincare", "Shaving"],
    "Gifts": ["Value & Gift Sets"],
}  # fmt: skip
PHRASES = np.array([
    "Arrived quickly and the packaging was nice.", "I have used it every day for a month.",
    "The texture is light and absorbs well.", "It did not work for my skin.",
    "The scent is subtle.", "A little goes a long way.", "I would buy this again.",
    "It felt sticky after a few minutes.", "My skin feels softer.", "It is a bit expensive.",
    "Not much difference so far.", "It broke me out after a week.", "Holy grail product for me.",
    "Good for the price.", "The pump stopped working.", "Works well under makeup.",
])  # fmt: skip
SKIN_TYPES = np.array(["dry", "oily", "combination", "normal", None], dtype=object)
TONES = np.array(["fair", "light", "medium", "tan", "deep", None], dtype=object)
EYES = np.array(["brown", "blue", "green", None], dtype=object)
HAIR = np.array(["black", "brown", "blonde", None], dtype=object)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("out", type=Path)
    parser.add_argument("--products", type=int, default=8500)
    parser.add_argument("--brands", type=int, default=300)
    parser.add_argument("--reviews", type=int, default=1_100_000)
    parser.add_argument("--files", type=int, default=5)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args(argv)
    rng = np.random.default_rng(args.seed)
    args.out.mkdir(parents=True, exist_ok=True)

    n = args.products
    primary = rng.choice(list(CATEGORIES), size=n, p=_weights(len(CATEGORIES), rng))
    secondary = np.array([rng.choice(CATEGORIES[c]) for c in primary], dtype=object)
    brand_id = rng.integers(1, args.brands + 1, size=n)
    products = pd.DataFrame(
        {
            "product_id": [f"P{100000 + i}" for i in range(n)],
            "product_name": [f"Synthetic Product {i}" for i in range(n)],
            "brand_id": brand_id,
            "brand_name": [f"Synthetic Brand {b:03d}" for b in brand_id],
            "loves_count": rng.integers(0, 500_000, size=n),
            "rating": np.round(rng.uniform(2.5, 5.0, size=n), 4),
            "reviews": rng.integers(0, 20_000, size=n),
            "size": "1.7 oz / 50 mL",
            "variation_type": "Size",
            "variation_value": "1.7 oz / 50 mL",
            "variation_desc": None,
            "ingredients": "['Water', 'Glycerin']",
            "price_usd": np.round(rng.gamma(2.0, 25.0, size=n) + 5, 2),
            "value_price_usd": None,
            "sale_price_usd": None,
            "limited_edition": rng.integers(0, 2, size=n),
            "new": rng.integers(0, 2, size=n),
            "online_only": rng.integers(0, 2, size=n),
            "out_of_stock": rng.integers(0, 2, size=n),
            "sephora_exclusive": rng.integers(0, 2, size=n),
            "highlights": "['Vegan']",
            "primary_category": primary,
            "secondary_category": secondary,
            "tertiary_category": secondary,
            "child_count": 0,
            "child_max_price": None,
            "child_min_price": None,
        }
    )[PRODUCT_COLUMNS]
    products.to_csv(args.out / "product_info.csv", index=False)

    skincare = products[products["primary_category"] == "Skincare"]
    # Reviews concentrate on popular products, like real review data.
    weights = rng.pareto(1.2, size=len(skincare)) + 0.01
    pick = rng.choice(len(skincare), size=args.reviews, p=weights / weights.sum())
    m = args.reviews
    phrases = [rng.choice(PHRASES, size=m) for _ in range(3)]
    text = pd.Series(phrases[0]).str.cat([pd.Series(phrases[1]), pd.Series(phrases[2])], sep=" ")
    feedback = rng.poisson(1.5, size=m)
    positive = rng.binomial(feedback, 0.7)
    rated = rng.choice([1, 2, 3, 4, 5], size=m, p=[0.06, 0.06, 0.09, 0.19, 0.60])
    recommended = np.where(rng.random(m) < 0.15, np.nan, (rated >= 4).astype(float))
    reviews = pd.DataFrame(
        {
            "author_id": rng.integers(1, m // 2, size=m).astype(str),
            "rating": rated,
            "is_recommended": recommended,
            "helpfulness": np.where(feedback > 0, positive / np.maximum(feedback, 1), np.nan),
            "total_feedback_count": feedback,
            "total_neg_feedback_count": feedback - positive,
            "total_pos_feedback_count": positive,
            "submission_time": (
                pd.Timestamp("2008-08-01") + pd.to_timedelta(rng.integers(0, 5300, size=m), "D")
            ).strftime("%Y-%m-%d"),
            "review_text": text,
            "review_title": rng.choice(PHRASES, size=m),
            "skin_tone": rng.choice(TONES, size=m),
            "eye_color": rng.choice(EYES, size=m),
            "skin_type": rng.choice(SKIN_TYPES, size=m),
            "hair_color": rng.choice(HAIR, size=m),
            "product_id": skincare["product_id"].to_numpy()[pick],
            "product_name": skincare["product_name"].to_numpy()[pick],
            "brand_name": skincare["brand_name"].to_numpy()[pick],
            "price_usd": skincare["price_usd"].to_numpy()[pick],
        }
    )
    for i, part in enumerate(np.array_split(np.arange(m), args.files)):
        reviews.iloc[part].to_csv(args.out / f"reviews_{i}-{i + 1}.csv", index=True)
    print(f"Wrote {n:,} products and {m:,} synthetic reviews to {args.out}")
    return 0


def _weights(k: int, rng: np.random.Generator) -> np.ndarray:
    w = rng.uniform(0.5, 1.5, size=k)
    w[0] *= 2.5  # Skincare is the largest category, as in the catalogue
    return w / w.sum()


if __name__ == "__main__":
    raise SystemExit(main())
