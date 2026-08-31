"""Deterministic synthetic employee generation.

Produces plain dataclasses rather than ORM objects so that generation can be tested
without a database, and so the same rows can be bulk-inserted cheaply.
"""

import math
import random
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, timedelta

from faker import Faker

from app.seed.data import COUNTRIES, CURRENCIES, DEPARTMENTS, JOB_LEVELS, CountrySeed

DEFAULT_SEED = 20240101
DEFAULT_EMPLOYEE_COUNT = 10_000
EMAIL_DOMAIN = "acme.example"

# Share of the workforce seeded as deactivated, so soft-delete filtering has
# something to exclude.
INACTIVE_RATE = 0.04

EARLIEST_HIRE_DATE = date(2015, 1, 1)
LATEST_HIRE_DATE = date(2025, 12, 31)

# Spread within a band, applied on top of the level/country/department factors.
JITTER_MIN = 0.92
JITTER_MAX = 1.08

_MINOR_UNIT_BY_CURRENCY = {c.code: c.minor_unit for c in CURRENCIES}
_RATE_BY_CURRENCY = {c.code: c.rate_to_usd for c in CURRENCIES}


@dataclass(frozen=True)
class GeneratedEmployee:
    first_name: str
    last_name: str
    email: str
    country_iso: str
    department_name: str
    job_level_title: str
    base_salary: int
    currency_code: str
    hire_date: date
    is_active: bool


def round_to_significant(amount: float, digits: int = 3) -> int:
    """Round to `digits` significant figures.

    Real salaries are negotiated round numbers, not arbitrary decimals. This keeps
    figures plausible across currencies with wildly different magnitudes: 78,431 USD
    becomes 78,000 and 6,384,215 JPY becomes 6,380,000, without hardcoding a
    granularity that only suits one currency.
    """
    if amount <= 0:
        return 0
    magnitude = math.floor(math.log10(amount))
    step = 10 ** max(0, magnitude - digits + 1)
    return int(round(amount / step) * step)


def to_minor_units(major_amount: int, currency_code: str) -> int:
    """Scale a whole-currency amount into the integer minor units we store."""
    return major_amount * 10 ** _MINOR_UNIT_BY_CURRENCY[currency_code]


def _weighted_picker(rng: random.Random, items, weights):
    """Pre-bind a weighted choice over a fixed population."""

    def pick():
        return rng.choices(items, weights=weights, k=1)[0]

    return pick


def _salary_in_minor_units(
    rng: random.Random,
    country: CountrySeed,
    department_factor: float,
    level_min_usd: int,
    level_max_usd: int,
) -> tuple[int, str]:
    usd = rng.uniform(level_min_usd, level_max_usd)
    usd *= country.cost_factor * department_factor * rng.uniform(JITTER_MIN, JITTER_MAX)

    currency_code = country.currency_code
    local_amount = usd / _RATE_BY_CURRENCY[currency_code]
    return to_minor_units(round_to_significant(local_amount), currency_code), currency_code


def generate_employees(
    count: int = DEFAULT_EMPLOYEE_COUNT, seed: int = DEFAULT_SEED
) -> Iterator[GeneratedEmployee]:
    """Yield `count` employees. The same seed always yields the same people."""
    rng = random.Random(seed)
    faker = Faker("en_US")
    faker.seed_instance(seed)

    pick_country = _weighted_picker(rng, COUNTRIES, [c.headcount_weight for c in COUNTRIES])
    pick_department = _weighted_picker(
        rng, DEPARTMENTS, [d.headcount_weight for d in DEPARTMENTS]
    )
    pick_level = _weighted_picker(rng, JOB_LEVELS, [j.headcount_weight for j in JOB_LEVELS])

    hire_window_days = (LATEST_HIRE_DATE - EARLIEST_HIRE_DATE).days
    seen_emails: set[str] = set()

    for _ in range(count):
        country = pick_country()
        department = pick_department()
        level = pick_level()

        first_name = faker.first_name()
        last_name = faker.last_name()
        email = _unique_email(first_name, last_name, seen_emails)

        base_salary, currency_code = _salary_in_minor_units(
            rng, country, department.pay_factor, level.min_usd, level.max_usd
        )

        yield GeneratedEmployee(
            first_name=first_name,
            last_name=last_name,
            email=email,
            country_iso=country.iso_code,
            department_name=department.name,
            job_level_title=level.title,
            base_salary=base_salary,
            currency_code=currency_code,
            hire_date=EARLIEST_HIRE_DATE + timedelta(days=rng.randint(0, hire_window_days)),
            is_active=rng.random() >= INACTIVE_RATE,
        )


def _unique_email(first_name: str, last_name: str, seen: set[str]) -> str:
    """Names repeat across 10 000 rows, but the email column is unique."""
    stem = f"{first_name}.{last_name}".lower().replace(" ", "").replace("'", "")
    candidate = f"{stem}@{EMAIL_DOMAIN}"
    suffix = 1
    while candidate in seen:
        suffix += 1
        candidate = f"{stem}{suffix}@{EMAIL_DOMAIN}"
    seen.add(candidate)
    return candidate
