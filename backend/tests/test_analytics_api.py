from datetime import date, timedelta
from decimal import Decimal
from statistics import median as python_median

import pytest
from sqlalchemy import func, select

from app.models import Country, Currency, Department, Employee, JobLevel
from app.services.currency import salary_in_usd_sql
from app.services.employment import active_predicate

URL = "/api/analytics"


def usd_salaries(db, **filters) -> list[float]:
    """Every active salary in USD, read straight from the database.

    The point of comparison is deliberately independent of the aggregation being
    tested: if the endpoint and this helper agree, the SQL is right.
    """
    stmt = (
        select(salary_in_usd_sql())
        .select_from(Employee)
        .join(Employee.currency)
        .join(Currency.exchange_rate)
        .where(active_predicate())
    )
    for column, value in filters.items():
        stmt = stmt.where(getattr(Employee, column) == value)
    return sorted(float(v) for v in db.scalars(stmt))


def approx_money(value: str) -> float:
    return float(Decimal(value))


class TestTotals:
    def test_headcount_counts_only_active_employees(self, client, seeded_db):
        expected = seeded_db.scalar(
            select(func.count(Employee.id)).where(active_predicate())
        )
        body = client.get(URL).json()

        assert body["totals"]["headcount"] == expected
        assert expected < seeded_db.scalar(select(func.count(Employee.id)))

    def test_total_spend_matches_the_sum_of_usd_salaries(self, client, seeded_db):
        expected = sum(usd_salaries(seeded_db))

        body = client.get(URL).json()
        assert approx_money(body["totals"]["total_spend_usd"]) == pytest.approx(
            expected, abs=0.01
        )

    def test_total_is_not_a_raw_sum_of_local_amounts(self, client, seeded_db):
        """Adding yen to dollars would produce a far larger, meaningless number."""
        raw = seeded_db.scalar(select(func.sum(Employee.base_salary)))
        body = client.get(URL).json()

        assert approx_money(body["totals"]["total_spend_usd"]) < raw / 10

    def test_average_matches_the_mean_of_usd_salaries(self, client, seeded_db):
        salaries = usd_salaries(seeded_db)
        expected = sum(salaries) / len(salaries)

        body = client.get(URL).json()
        assert approx_money(body["totals"]["average_salary_usd"]) == pytest.approx(
            expected, abs=0.01
        )

    def test_median_matches_a_python_median(self, client, seeded_db):
        """The SQL median is the riskiest expression here, so it is checked against
        the standard library rather than against itself."""
        expected = python_median(usd_salaries(seeded_db))

        body = client.get(URL).json()
        assert approx_money(body["totals"]["median_salary_usd"]) == pytest.approx(
            expected, abs=0.01
        )

    def test_median_differs_from_the_average(self, client):
        """If these were equal the two cards would be saying the same thing; pay is
        right-skewed, and showing both is only justified because they differ."""
        totals = client.get(URL).json()["totals"]

        assert approx_money(totals["average_salary_usd"]) != approx_money(
            totals["median_salary_usd"]
        )


class TestMedianEdgeCases:
    """The even/odd split is the part most likely to be quietly wrong."""

    def _median_of(self, client, seeded_db, salaries: list[int]) -> float:
        """Replace the population with a known set of USD salaries."""
        seeded_db.query(Employee).delete()

        usa = seeded_db.scalar(select(Country).where(Country.iso_code == "US"))
        dept = seeded_db.scalar(select(Department))
        level = seeded_db.scalar(select(JobLevel))

        for index, amount in enumerate(salaries):
            seeded_db.add(
                Employee(
                    first_name="Test",
                    last_name=f"Person{index}",
                    email=f"person{index}@acme.example",
                    country_id=usa.id,
                    department_id=dept.id,
                    job_level_id=level.id,
                    base_salary=amount * 100,  # USD minor units
                    currency_code="USD",
                    hire_date=date(2020, 1, 1),
                    exit_date=None,
                )
            )
        seeded_db.commit()

        return approx_money(client.get(URL).json()["totals"]["median_salary_usd"])

    def test_odd_count_takes_the_middle_value(self, client, seeded_db):
        assert self._median_of(client, seeded_db, [10, 20, 30, 40, 50]) == 30

    def test_even_count_averages_the_two_middle_values(self, client, seeded_db):
        assert self._median_of(client, seeded_db, [10, 20, 30, 40]) == 25

    def test_single_employee_is_their_own_median(self, client, seeded_db):
        assert self._median_of(client, seeded_db, [77_000]) == 77_000

    def test_two_employees_average(self, client, seeded_db):
        assert self._median_of(client, seeded_db, [10, 90]) == 50

    def test_median_ignores_insertion_order(self, client, seeded_db):
        assert self._median_of(client, seeded_db, [50, 10, 40, 20, 30]) == 30

    def test_outlier_moves_the_average_but_not_the_median(self, client, seeded_db):
        """The reason median is on the dashboard at all."""
        assert self._median_of(client, seeded_db, [10, 20, 30, 40, 10_000_000]) == 30


class TestEmploymentStatus:
    def test_departed_employees_are_excluded(self, client, seeded_db):
        before = client.get(URL).json()["totals"]

        employee = seeded_db.scalars(
            select(Employee).where(active_predicate())
        ).first()
        client.post(f"/api/employees/{employee.id}/deactivate")

        after = client.get(URL).json()["totals"]
        assert after["headcount"] == before["headcount"] - 1

    def test_scheduled_leavers_still_count(self, client, seeded_db):
        """They are still employed and still paid, so payroll must include them."""
        before = client.get(URL).json()["totals"]

        employee = seeded_db.scalars(
            select(Employee).where(active_predicate())
        ).first()
        future = (date.today() + timedelta(days=30)).isoformat()
        client.post(
            f"/api/employees/{employee.id}/deactivate", json={"exit_date": future}
        )

        after = client.get(URL).json()["totals"]
        assert after["headcount"] == before["headcount"]
        assert after["leaving_soon"] == before["leaving_soon"] + 1

    def test_leaving_soon_excludes_the_already_departed(self, client, seeded_db):
        employee = seeded_db.scalars(
            select(Employee).where(active_predicate())
        ).first()
        before = client.get(URL).json()["totals"]["leaving_soon"]

        past = (date.today() - timedelta(days=1)).isoformat()
        client.post(f"/api/employees/{employee.id}/deactivate", json={"exit_date": past})

        assert client.get(URL).json()["totals"]["leaving_soon"] == before


class TestFiltering:
    def test_country_filter_narrows_the_totals(self, client, seeded_db):
        country_id = seeded_db.scalar(select(Country.id))
        expected = usd_salaries(seeded_db, country_id=country_id)

        body = client.get(URL, params={"country_id": country_id}).json()

        assert body["totals"]["headcount"] == len(expected)
        assert approx_money(body["totals"]["total_spend_usd"]) == pytest.approx(
            sum(expected), abs=0.01
        )

    def test_filtered_breakdown_contains_only_that_group(self, client, seeded_db):
        country_id = seeded_db.scalar(select(Country.id))

        body = client.get(URL, params={"country_id": country_id}).json()

        assert [row["id"] for row in body["by_country"]] == [country_id]

    def test_multiple_values_in_one_filter_are_or_matched(self, client, seeded_db):
        ids = list(seeded_db.scalars(select(Country.id).limit(2)))
        singles = [
            client.get(URL, params={"country_id": i}).json()["totals"]["headcount"]
            for i in ids
        ]

        both = client.get(URL, params={"country_id": ids}).json()["totals"]["headcount"]
        assert both == sum(singles)

    def test_different_filters_are_and_matched(self, client, seeded_db):
        country_id = seeded_db.scalar(select(Country.id))
        department_id = seeded_db.scalar(select(Department.id))

        combined = client.get(
            URL, params={"country_id": country_id, "department_id": department_id}
        ).json()["totals"]["headcount"]
        country_only = client.get(URL, params={"country_id": country_id}).json()[
            "totals"
        ]["headcount"]

        assert combined <= country_only

    def test_filters_matching_nobody_report_null_not_zero(self, client, seeded_db):
        """An average of no salaries is undefined; reporting 0 would read as
        'these people are paid nothing'."""
        country_id = seeded_db.scalar(select(Country.id))
        department_id = seeded_db.scalar(select(Department.id))

        # Nobody is in this country and this department at this level, because the
        # level id does not exist.
        body = client.get(
            URL,
            params={
                "country_id": country_id,
                "department_id": department_id,
                "job_level_id": 9_999,
            },
        ).json()

        assert body["totals"]["headcount"] == 0
        assert body["totals"]["total_spend_usd"] == "0.00"
        assert body["totals"]["average_salary_usd"] is None
        assert body["totals"]["median_salary_usd"] is None
        assert body["by_country"] == []


class TestBreakdowns:
    def test_country_headcounts_sum_to_the_total(self, client):
        body = client.get(URL).json()

        assert sum(row["headcount"] for row in body["by_country"]) == (
            body["totals"]["headcount"]
        )

    def test_department_spend_sums_to_the_total(self, client):
        body = client.get(URL).json()

        total = sum(approx_money(r["total_spend_usd"]) for r in body["by_department"])
        assert total == pytest.approx(
            approx_money(body["totals"]["total_spend_usd"]), abs=1.0
        )

    def test_breakdowns_are_ranked_by_spend(self, client):
        """'Where does the money go' is the question, so the biggest cost is first."""
        for key in ("by_country", "by_department"):
            spends = [
                approx_money(row["total_spend_usd"])
                for row in client.get(URL).json()[key]
            ]
            assert spends == sorted(spends, reverse=True)

    def test_each_group_average_is_its_own_spend_over_its_own_headcount(self, client):
        for row in client.get(URL).json()["by_country"]:
            expected = approx_money(row["total_spend_usd"]) / row["headcount"]
            assert approx_money(row["average_salary_usd"]) == pytest.approx(
                expected, abs=0.01
            )


class TestQueryCost:
    def test_the_dashboard_is_a_constant_number_of_queries(
        self, client, query_counter
    ):
        """Aggregation happens in SQL, so cost must not grow with headcount: four
        queries — totals, median, and one per breakdown."""
        client.get(URL)

        assert len(query_counter) == 4
