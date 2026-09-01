from datetime import date

import pytest

from app.seed.data import COUNTRIES, CURRENCIES, DEPARTMENTS, JOB_LEVELS
from app.seed.generator import (
    generate_employees,
    round_to_significant,
    to_minor_units,
)

CURRENCY_BY_CODE = {c.code: c for c in CURRENCIES}
COUNTRY_BY_ISO = {c.iso_code: c for c in COUNTRIES}


class TestRoundToSignificant:
    @pytest.mark.parametrize(
        ("amount", "expected"),
        [
            (78_431.19, 78_400),
            (6_384_215.0, 6_380_000),
            (999.4, 999),
            (55_555, 55_600),
            (0, 0),
        ],
    )
    def test_keeps_three_significant_figures(self, amount, expected):
        assert round_to_significant(amount) == expected

    def test_never_negative(self):
        assert round_to_significant(-100) == 0


class TestToMinorUnits:
    def test_two_decimal_currency_scales_by_hundred(self):
        assert to_minor_units(75_000, "USD") == 7_500_000

    def test_zero_decimal_currency_is_unscaled(self):
        """JPY has no subunit; scaling it by 100 would inflate pay 100x."""
        assert to_minor_units(5_000_000, "JPY") == 5_000_000


class TestGenerateEmployees:
    def test_generates_requested_count(self):
        assert len(list(generate_employees(count=50))) == 50

    def test_same_seed_produces_identical_employees(self):
        assert list(generate_employees(count=100, seed=7)) == list(
            generate_employees(count=100, seed=7)
        )

    def test_different_seed_produces_different_employees(self):
        assert list(generate_employees(count=100, seed=7)) != list(
            generate_employees(count=100, seed=8)
        )

    def test_emails_are_unique(self):
        employees = list(generate_employees(count=2_000))
        assert len({e.email for e in employees}) == len(employees)

    def test_salary_currency_matches_country(self):
        for employee in generate_employees(count=500):
            assert employee.currency_code == COUNTRY_BY_ISO[employee.country_iso].currency_code

    def test_references_only_known_lookup_values(self):
        departments = {d.name for d in DEPARTMENTS}
        levels = {j.title for j in JOB_LEVELS}
        for employee in generate_employees(count=500):
            assert employee.department_name in departments
            assert employee.job_level_title in levels

    def test_salaries_are_positive_integers(self):
        for employee in generate_employees(count=500):
            assert isinstance(employee.base_salary, int)
            assert employee.base_salary > 0

    def test_hire_dates_fall_within_the_configured_window(self):
        from app.seed.generator import EARLIEST_HIRE_DATE, LATEST_HIRE_DATE

        for employee in generate_employees(count=500):
            assert EARLIEST_HIRE_DATE <= employee.hire_date <= LATEST_HIRE_DATE

    def test_some_employees_have_departed(self):
        """Status filtering needs departed rows to actually exist."""
        exit_dates = [e.exit_date for e in generate_employees(count=500)]

        assert any(exit_date is None for exit_date in exit_dates)
        assert any(exit_date is not None for exit_date in exit_dates)

    def test_some_departures_are_scheduled_in_the_future(self):
        """The 'leaving soon' case must be reachable from seeded data, not only
        by setting a future date by hand."""
        as_of = date(2026, 6, 1)
        exit_dates = [
            e.exit_date for e in generate_employees(count=2_000, as_of=as_of)
        ]

        assert any(d is not None and d > as_of for d in exit_dates)
        assert any(d is not None and d <= as_of for d in exit_dates)

    def test_exit_date_is_never_before_hire_date(self):
        for employee in generate_employees(count=2_000):
            if employee.exit_date is not None:
                assert employee.exit_date >= employee.hire_date

    def test_usd_salaries_stay_within_a_plausible_range(self):
        """Guards the band/factor arithmetic: a currency or factor mistake shows up
        as an absurd USD figure rather than as a subtly wrong dashboard."""
        for employee in generate_employees(count=1_000):
            currency = CURRENCY_BY_CODE[employee.currency_code]
            usd = (
                employee.base_salary / 10**currency.minor_unit
            ) * currency.rate_to_usd
            assert 10_000 < usd < 600_000, f"{employee.email}: ${usd:,.0f}"
