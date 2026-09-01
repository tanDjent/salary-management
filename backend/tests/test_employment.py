from datetime import date, timedelta

from app.services.employment import is_active, is_leaving

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
