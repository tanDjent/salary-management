"""Employment status, derived from exit_date.

There is no stored is_active column. Status is a function of the exit date and
the current date, which is what makes departures take effect on their own rather
than needing a scheduled job to flip a flag.

Both the SQL predicate and the Python check live here so that a filtered list and
the badge shown on each row can never disagree.
"""

from datetime import date

from sqlalchemy import ColumnElement, or_

from app.models import Employee


def today() -> date:
    """Indirection so tests can reason about "now" in one place."""
    return date.today()


def is_active(exit_date: date | None, as_of: date | None = None) -> bool:
    """Employed as of a given date.

    An exit date in the future means the person is leaving but is still on the
    payroll today, so they remain active until the date arrives.
    """
    if exit_date is None:
        return True
    return exit_date > (as_of or today())


def is_leaving(exit_date: date | None, as_of: date | None = None) -> bool:
    """Still active, but with a departure already scheduled."""
    return exit_date is not None and is_active(exit_date, as_of)


def active_predicate(as_of: date | None = None) -> ColumnElement[bool]:
    """SQL form of `is_active`, for filtering and aggregation."""
    return or_(Employee.exit_date.is_(None), Employee.exit_date > (as_of or today()))
