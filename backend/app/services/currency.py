"""Conversion between stored minor units, display amounts, and the base currency.

Storage is integer minor units; display and reporting need decimals. All arithmetic
here uses Decimal rather than float, so a salary never gains a trailing 0.00000001
on its way to the UI.
"""

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func

from app.models import Currency, Employee, ExchangeRate

CENTS = Decimal("0.01")


def to_major_units(minor_amount: int, minor_unit: int) -> Decimal:
    """Convert stored minor units into a displayable amount.

    JPY has minor_unit 0, so 5_000_000 stays 5000000 rather than becoming 50000.00.
    """
    return Decimal(minor_amount).scaleb(-minor_unit)


def to_minor_units(major_amount: Decimal, minor_unit: int) -> int:
    """Convert a submitted amount into the integer we store."""
    scaled = Decimal(major_amount).scaleb(minor_unit)
    return int(scaled.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def to_base_currency(major_amount: Decimal, rate_to_usd: float) -> Decimal:
    """Convert a local amount into the base reporting currency.

    Rates are stored as floats, so they are routed through `str` before becoming a
    Decimal: Decimal(0.74) is 0.740000000000000035527..., while Decimal("0.74") is
    exactly 0.74.
    """
    return (major_amount * Decimal(str(rate_to_usd))).quantize(CENTS, rounding=ROUND_HALF_UP)


def salary_in_usd_sql():
    """SQL expression for a salary in USD, for sorting and aggregation.

    Comparing raw `base_salary` across currencies is meaningless — it would rank
    5,000,000 JPY above 200,000 USD — so any cross-currency ordering has to run on
    the normalised value.

    This is float arithmetic, unlike the Decimal path used for display. That is a
    deliberate split: the database is far better at sorting and summing 10,000 rows
    than Python is, and float error at this magnitude cannot change an ordering.
    Displayed figures still come from the Decimal path.
    """
    return (
        Employee.base_salary
        / func.power(10, Currency.minor_unit)
        * ExchangeRate.rate_to_usd
    )
