from datetime import date, timedelta

import pytest
from sqlalchemy import func, select

from app.models import Country, Department, Employee, JobLevel
from app.seed.run import seed_reference_data
from app.services.employment import (
    active_predicate,
    is_active,
    is_leaving,
    leaving_predicate,
)

TODAY = date(2026, 6, 15)
YESTERDAY = TODAY - timedelta(days=1)
TOMORROW = TODAY + timedelta(days=1)


class TestIsActive:
    def test_no_exit_date_means_employed(self):
        assert is_active(None, as_of=TODAY) is True

    def test_future_exit_date_is_still_employed(self):
        """Someone serving notice is still on the payroll."""
        assert is_active(TOMORROW, as_of=TODAY) is True

    def test_past_exit_date_has_departed(self):
        assert is_active(YESTERDAY, as_of=TODAY) is False

    def test_exit_date_today_has_departed(self):
        """The boundary: the exit date is the last day, so they are out on it.

        Arbitrary but it must be decided once, since the same rule drives the
        directory filter, the badge, and payroll totals.
        """
        assert is_active(TODAY, as_of=TODAY) is False

    def test_status_changes_by_itself_as_the_date_passes(self):
        """The whole point of deriving status: no job has to flip a flag."""
        exit_date = date(2026, 6, 20)

        assert is_active(exit_date, as_of=date(2026, 6, 19)) is True
        assert is_active(exit_date, as_of=date(2026, 6, 20)) is False
        assert is_active(exit_date, as_of=date(2026, 6, 21)) is False


class TestIsLeaving:
    def test_no_exit_date_is_not_leaving(self):
        assert is_leaving(None, as_of=TODAY) is False

    def test_future_exit_date_is_leaving(self):
        assert is_leaving(TOMORROW, as_of=TODAY) is True

    def test_already_departed_is_not_leaving(self):
        """Leaving means a departure still to come, not one that has happened."""
        assert is_leaving(YESTERDAY, as_of=TODAY) is False

    def test_leaving_implies_active(self):
        assert is_active(TOMORROW, as_of=TODAY) and is_leaving(TOMORROW, as_of=TODAY)


EXIT = date(2026, 6, 20)


class TestTheSqlFormAgrees:
    """The same rule twice: once in Python for serialization, once in SQL for
    filtering and aggregation. They are only useful if they cannot drift, and
    nothing but a test holds them together.

    These run against the database rather than the function, so the transition
    is observed the way the directory and the dashboard observe it.
    """

    @pytest.fixture
    def db_with_leaver(self, db):
        """One employee, leaving on a fixed date. Time is moved around them via
        `as_of` rather than by waiting."""
        seed_reference_data(db)

        db.add(
            Employee(
                first_name="Ada",
                last_name="Lovelace",
                email="ada@acme.example",
                country_id=db.scalar(select(Country.id).limit(1)),
                department_id=db.scalar(select(Department.id).limit(1)),
                job_level_id=db.scalar(select(JobLevel.id).limit(1)),
                base_salary=10_000_000,
                currency_code="USD",
                hire_date=date(2020, 1, 1),
                exit_date=EXIT,
            )
        )
        db.commit()
        return db

    def active_count(self, db, as_of):
        return db.scalar(select(func.count(Employee.id)).where(active_predicate(as_of)))

    def leaving_count(self, db, as_of):
        return db.scalar(
            select(func.count(Employee.id)).where(leaving_predicate(as_of))
        )

    def test_the_query_drops_them_once_the_exit_date_arrives(self, db_with_leaver):
        """The scenario the derived status exists for: nothing writes to the row,
        and no job runs. The same query returns them one day and not the next."""
        assert self.active_count(db_with_leaver, EXIT - timedelta(days=1)) == 1
        assert self.active_count(db_with_leaver, EXIT) == 0
        assert self.active_count(db_with_leaver, EXIT + timedelta(days=1)) == 0

    def test_they_stop_counting_as_leaving_at_the_same_moment(self, db_with_leaver):
        """Not one day apart: a departure cannot be both pending and past."""
        assert self.leaving_count(db_with_leaver, EXIT - timedelta(days=1)) == 1
        assert self.leaving_count(db_with_leaver, EXIT) == 0

    @pytest.mark.parametrize("offset", [-2, -1, 0, 1, 2])
    def test_sql_and_python_never_disagree_across_the_boundary(
        self, db_with_leaver, offset
    ):
        """Checked either side of the transition, since a mismatch would most
        likely be an off-by-one that only shows on the day itself."""
        as_of = EXIT + timedelta(days=offset)

        from_sql = self.active_count(db_with_leaver, as_of) == 1
        from_python = is_active(EXIT, as_of=as_of)

        assert from_sql is from_python

    def test_someone_with_no_exit_date_is_unaffected_by_time(self, db_with_leaver):
        """The rule must not quietly retire people who were never leaving."""
        db_with_leaver.scalars(select(Employee)).one().exit_date = None
        db_with_leaver.commit()

        assert self.active_count(db_with_leaver, EXIT + timedelta(days=3650)) == 1
        assert self.leaving_count(db_with_leaver, EXIT) == 0
