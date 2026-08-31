"""Static reference data.

These values are facts about the world rather than generated filler, so they are
written out explicitly and reviewed instead of being randomised. Exchange rates are
indicative mid-market rates and are deliberately fixed: the MVP has no rate refresh,
so reports are reproducible rather than current.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class CurrencySeed:
    code: str
    name: str
    symbol: str
    minor_unit: int
    rate_to_usd: float


@dataclass(frozen=True)
class CountrySeed:
    name: str
    iso_code: str
    currency_code: str
    # Salary level relative to the United States baseline of 1.0.
    cost_factor: float
    # Relative share of total headcount; normalised at generation time.
    headcount_weight: int


@dataclass(frozen=True)
class DepartmentSeed:
    name: str
    # Pay premium relative to the organisation-wide band for a given level.
    pay_factor: float
    headcount_weight: int


@dataclass(frozen=True)
class JobLevelSeed:
    title: str
    rank: int
    # Annual salary band in USD at cost_factor 1.0 and pay_factor 1.0.
    min_usd: int
    max_usd: int
    headcount_weight: int


CURRENCIES: tuple[CurrencySeed, ...] = (
    CurrencySeed("USD", "US Dollar", "$", 2, 1.0),
    CurrencySeed("EUR", "Euro", "€", 2, 1.09),
    CurrencySeed("GBP", "Pound Sterling", "£", 2, 1.27),
    CurrencySeed("CAD", "Canadian Dollar", "CA$", 2, 0.74),
    CurrencySeed("AUD", "Australian Dollar", "A$", 2, 0.66),
    CurrencySeed("SGD", "Singapore Dollar", "S$", 2, 0.74),
    CurrencySeed("PLN", "Polish Zloty", "zł", 2, 0.25),
    CurrencySeed("BRL", "Brazilian Real", "R$", 2, 0.20),
    CurrencySeed("INR", "Indian Rupee", "₹", 2, 0.012),
    # Zero minor units: 5,000,000 JPY is stored as 5000000, not 500000000.
    CurrencySeed("JPY", "Japanese Yen", "¥", 0, 0.0067),
)

COUNTRIES: tuple[CountrySeed, ...] = (
    CountrySeed("United States", "US", "USD", 1.00, 30),
    CountrySeed("India", "IN", "INR", 0.30, 22),
    CountrySeed("United Kingdom", "GB", "GBP", 0.90, 10),
    CountrySeed("Germany", "DE", "EUR", 0.85, 8),
    CountrySeed("Poland", "PL", "PLN", 0.50, 7),
    CountrySeed("Canada", "CA", "CAD", 0.85, 5),
    CountrySeed("Spain", "ES", "EUR", 0.65, 4),
    CountrySeed("France", "FR", "EUR", 0.80, 4),
    CountrySeed("Brazil", "BR", "BRL", 0.35, 4),
    CountrySeed("Singapore", "SG", "SGD", 0.85, 3),
    CountrySeed("Australia", "AU", "AUD", 0.85, 2),
    CountrySeed("Japan", "JP", "JPY", 0.70, 1),
)

DEPARTMENTS: tuple[DepartmentSeed, ...] = (
    DepartmentSeed("Engineering", 1.10, 35),
    DepartmentSeed("Sales", 1.00, 15),
    DepartmentSeed("Customer Support", 0.75, 14),
    DepartmentSeed("Product", 1.05, 8),
    DepartmentSeed("Marketing", 0.95, 8),
    DepartmentSeed("Design", 1.00, 6),
    DepartmentSeed("Finance", 1.00, 7),
    DepartmentSeed("People Operations", 0.90, 7),
)

# Headcount weights form a pyramid: many juniors, few executives.
JOB_LEVELS: tuple[JobLevelSeed, ...] = (
    JobLevelSeed("Associate", 1, 55_000, 75_000, 26),
    JobLevelSeed("Professional", 2, 80_000, 110_000, 32),
    JobLevelSeed("Senior", 3, 115_000, 155_000, 24),
    JobLevelSeed("Lead", 4, 150_000, 200_000, 12),
    JobLevelSeed("Director", 5, 200_000, 280_000, 5),
    JobLevelSeed("Executive", 6, 300_000, 450_000, 1),
)
