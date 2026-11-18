"""Every API figure vs. the independent csv-module oracle, on the synthetic fixtures."""

import pytest

from tests.checks import run_all


@pytest.mark.parametrize("client_name", ["client", "csv_client"])
def test_api_matches_oracle(request, oracle, client_name):
    client = request.getfixturevalue(client_name)
    report = run_all(client, oracle)
    assert report.failures == []
    assert report.passed > 150


def test_oracle_sanity(oracle):
    """The oracle itself agrees with the hand-checked fixture design."""
    assert oracle.raw_count == 18
    assert len(oracle.reviews) == 16
    assert oracle.rating_counts(oracle.reviews) == [2, 2, 2, 4, 6]
