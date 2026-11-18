"""Generate the SYNTHETIC test fixtures (no real Sephora data).

Run from backend/:  python -m tests.fixtures.make_fixtures

Design (mirrors the real schema and its quirks):
* 8 products, 4 brands, 4 primary categories; only Skincare products have reviews.
* One Skincare product (P1005) and all non-Skincare products have no review records.
* P1005 has empty catalogue rating/reviews; P1008 has an empty tertiary category and
  a price above the default 300 price-histogram cap.
* reviews_1-2.csv repeats two rows of reviews_0-1.csv exactly (exact duplicates, removed)
  and one row with a different rating (near-duplicate, preserved).
* Some reviews have empty is_recommended / helpfulness / skin attributes.
"""

from __future__ import annotations

import csv
from pathlib import Path

HERE = Path(__file__).parent

PRODUCT_COLUMNS = [
    "product_id", "product_name", "brand_id", "brand_name", "loves_count", "rating", "reviews",
    "size", "variation_type", "variation_value", "variation_desc", "ingredients", "price_usd",
    "value_price_usd", "sale_price_usd", "limited_edition", "new", "online_only", "out_of_stock",
    "sephora_exclusive", "highlights", "primary_category", "secondary_category",
    "tertiary_category", "child_count", "child_max_price", "child_min_price",
]  # fmt: skip

# id, name, brand_id, brand, loves, rating, reviews, price, flags(le,new,oo,oos,se), cats
PRODUCTS = [
    ("P1001", "Synthetic Gel Cleanser", 1, "Alpha Labs", 1200, "4.5", "40", 20.0,
     (0, 0, 0, 0, 0), ("Skincare", "Cleansers", "Face Wash & Cleansers")),
    ("P1002", "Synthetic Night Cream", 1, "Alpha Labs", 3400, "4.2", "85", 45.0,
     (0, 0, 0, 0, 1), ("Skincare", "Moisturizers", "Night Creams")),
    ("P1003", "Synthetic Vitamin Serum", 2, "Beta Botanics", 5600, "4.0", "120", 68.0,
     (0, 1, 0, 0, 0), ("Skincare", "Treatments", "Face Serums")),
    ("P1004", "Synthetic Day Lotion", 2, "Beta Botanics", 800, "3.8", "15", 32.0,
     (0, 0, 0, 0, 0), ("Skincare", "Moisturizers", "Moisturizers")),
    ("P1005", "Synthetic Clay Mask", 3, "Gamma Glow", 300, "", "", 28.0,
     (0, 0, 0, 1, 0), ("Skincare", "Masks", "Face Masks")),
    ("P1006", "Synthetic Lipstick", 3, "Gamma Glow", 2500, "4.4", "60", 24.0,
     (0, 0, 0, 0, 0), ("Makeup", "Lip", "Lipstick")),
    ("P1007", "Synthetic Eau de Parfum", 4, "Delta Scents", 900, "4.7", "30", 150.0,
     (1, 0, 0, 0, 0), ("Fragrance", "Women", "Perfume")),
    ("P1008", "Synthetic Brush Set", 4, "Delta Scents", 150, "3.9", "5", 310.0,
     (0, 0, 1, 0, 0), ("Tools & Brushes", "Brushes & Applicators", "")),
]  # fmt: skip

REVIEW_COLUMNS = [
    "", "author_id", "rating", "is_recommended", "helpfulness", "total_feedback_count",
    "total_neg_feedback_count", "total_pos_feedback_count", "submission_time", "review_text",
    "review_title", "skin_tone", "eye_color", "skin_type", "hair_color", "product_id",
    "product_name", "brand_name", "price_usd",
]  # fmt: skip

# author, rating, rec, helpful, total, neg, pos, date, text, title, tone, eye, type, hair, pid
FILE_A = [
    ("A01", 5, "1.0", "1.0", 2, 0, 2, "2019-03-10", "Gentle cleanser, my skin feels soft",
     "Soft skin", "light", "brown", "dry", "black", "P1001"),
    ("A02", 4, "1.0", "", 0, 0, 0, "2019-07-22", "Nice foam and clean feel", "Good",
     "fair", "blue", "oily", "blonde", "P1001"),
    ("A03", 1, "0.0", "0.25", 4, 3, 1, "2020-01-05", "Broke me out badly", "Not for me",
     "medium", "green", "combination", "brown", "P1002"),
    ("A04", 5, "1.0", "0.8", 5, 1, 4, "2020-01-18", "Best night cream for dry skin", "Love it",
     "tan", "brown", "dry", "black", "P1002"),
    ("A05", 3, "", "", 0, 0, 0, "2020-06-30", "It is okay, nothing special", "Okay",
     "", "", "", "", "P1002"),
    ("A06", 5, "1.0", "1.0", 1, 0, 1, "2021-02-14", "Glowing skin after a week of this serum",
     "Glow", "deep", "brown", "normal", "black", "P1003"),
    ("A07", 2, "0.0", "0.0", 3, 3, 0, "2021-02-20", "Serum made my skin sting", "Stings",
     "light", "hazel", "combination", "red", "P1003"),
    ("A08", 4, "1.0", "", 0, 0, 0, "2021-11-03", "Light lotion, absorbs fast", "Nice lotion",
     "fair", "blue", "normal", "blonde", "P1004"),
    ("A09", 5, "1.0", "1.0", 6, 0, 6, "2022-05-09", "Holy grail cleanser", "Holy grail",
     "medium", "brown", "oily", "brown", "P1001"),
    ("A10", 5, "1.0", "0.5", 2, 1, 1, "2022-08-15", "Great serum, visible results", "Results",
     "tan", "green", "combination", "black", "P1003"),
    ("A01", 4, "1.0", "", 0, 0, 0, "2023-01-02", "Still a good cleanser", "Repurchase",
     "light", "brown", "dry", "black", "P1001"),
    ("A11", 1, "0.0", "0.0", 2, 2, 0, "2023-02-28", "Too greasy for oily skin", "Greasy",
     "fair", "gray", "oily", "blonde", "P1002"),
]  # fmt: skip

FILE_B = [
    FILE_A[0],  # exact duplicate (removed)
    ("A03", 2, "0.0", "0.25", 4, 3, 1, "2020-01-05", "Broke me out badly", "Not for me",
     "medium", "green", "combination", "brown", "P1002"),  # near-duplicate: rating differs
    ("A12", 5, "1.0", "1.0", 3, 0, 3, "2022-05-09", "Holy grail serum for glow", "Amazing",
     "deep", "brown", "normal", "black", "P1003"),
    ("A13", 3, "1.0", "", 0, 0, 0, "2022-12-24", "Decent lotion but pricey", "Decent",
     "light", "blue", "dry", "blonde", "P1004"),
    ("A14", 4, "", "", 0, 0, 0, "2023-03-01", "Good serum", "Good", "", "", "", "", "P1003"),
    FILE_A[5],  # exact duplicate (removed)
]  # fmt: skip


def write_products() -> None:
    with (HERE / "product_info.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(PRODUCT_COLUMNS)
        for pid, name, bid, brand, loves, rating, reviews, price, flags, cats in PRODUCTS:
            le, new, oo, oos, se = flags
            w.writerow([
                pid, name, bid, brand, loves, rating, reviews, "50 mL", "Size", "50 mL", "",
                "['Water, Glycerin.', 'Synthetic test ingredient list.']", price, "", "",
                le, new, oo, oos, se, "['Vegan', 'Synthetic highlight']", *cats, 0, "", "",
            ])  # fmt: skip


def write_reviews(name: str, rows: list[tuple]) -> None:
    by_id = {p[0]: p for p in PRODUCTS}
    with (HERE / name).open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(REVIEW_COLUMNS)
        for i, row in enumerate(rows):
            product = by_id[row[-1]]
            w.writerow([i, *row, product[1], product[3], product[7]])


if __name__ == "__main__":
    write_products()
    write_reviews("reviews_0-1.csv", FILE_A)
    write_reviews("reviews_1-2.csv", FILE_B)
    print("Synthetic fixtures written to", HERE)
