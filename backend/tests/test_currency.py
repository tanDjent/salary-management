from decimal import Decimal

import pytest

from app.services.currency import to_base_currency, to_major_units, to_minor_units


class TestToMajorUnits:
    def test_two_decimal_currency(self):
        assert to_major_units(7_500_000, 2) == Decimal("75000.00")

    def test_zero_decimal_currency_is_unchanged(self):
        assert to_major_units(5_000_000, 0) == Decimal("5000000")

    def test_returns_decimal_not_float(self):
        """Float would reintroduce the rounding error the integer storage avoids."""
        assert isinstance(to_major_units(7_500_000, 2), Decimal)


class TestToMinorUnits:
    @pytest.mark.parametrize(
        ("amount", "minor_unit", "expected"),
        [
            (Decimal("75000.00"), 2, 7_500_000),
            (Decimal("75000.55"), 2, 7_500_055),
            (Decimal("5000000"), 0, 5_000_000),
        ],
    )
    def test_scales_by_minor_unit(self, amount, minor_unit, expected):
        assert to_minor_units(amount, minor_unit) == expected

    def test_round_trips_with_to_major_units(self):
        for minor, unit in [(7_500_055, 2), (5_000_000, 0), (1, 2)]:
            assert to_minor_units(to_major_units(minor, unit), unit) == minor

    def test_rounds_half_up(self):
        assert to_minor_units(Decimal("100.005"), 2) == 10_001


class TestToBaseCurrency:
    def test_identity_for_usd(self):
        assert to_base_currency(Decimal("75000"), 1.0) == Decimal("75000.00")

    def test_converts_and_quantises_to_cents(self):
        assert to_base_currency(Decimal("100000"), 0.012) == Decimal("1200.00")

    def test_float_rate_does_not_leak_binary_error(self):
        """Decimal(0.74) is 0.74000000000000000355...; going via str avoids that."""
        assert to_base_currency(Decimal("100"), 0.74) == Decimal("74.00")

    def test_zero_decimal_currency_converts_correctly(self):
        """5,000,000 JPY is about $33,500, not $335 or $3.35M."""
        assert to_base_currency(Decimal("5000000"), 0.0067) == Decimal("33500.00")
