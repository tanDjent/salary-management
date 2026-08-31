from sqlalchemy import func, select

from app.models import Country, Currency, Department, Employee, ExchangeRate, JobLevel
from app.seed.data import COUNTRIES, CURRENCIES, DEPARTMENTS, JOB_LEVELS
from app.seed.run import seed_employees, seed_reference_data


class TestSeedReferenceData:
    def test_inserts_every_lookup_row(self, db):
        seed_reference_data(db)

        assert db.scalar(select(func.count(Currency.code))) == len(CURRENCIES)
        assert db.scalar(select(func.count(ExchangeRate.currency_code))) == len(CURRENCIES)
        assert db.scalar(select(func.count(Country.id))) == len(COUNTRIES)
        assert db.scalar(select(func.count(Department.id))) == len(DEPARTMENTS)
        assert db.scalar(select(func.count(JobLevel.id))) == len(JOB_LEVELS)

    def test_is_idempotent(self, db):
        seed_reference_data(db)
        seed_reference_data(db)

        assert db.scalar(select(func.count(Currency.code))) == len(CURRENCIES)
        assert db.scalar(select(func.count(Country.id))) == len(COUNTRIES)

    def test_every_country_points_at_a_seeded_currency(self, db):
        seed_reference_data(db)

        codes = set(db.scalars(select(Currency.code)))
        for country_currency in db.scalars(select(Country.default_currency_code)):
            assert country_currency in codes


class TestSeedEmployees:
    def test_inserts_the_requested_number(self, db):
        seed_reference_data(db)

        assert seed_employees(db, count=250, seed=1) == 250
        assert db.scalar(select(func.count(Employee.id))) == 250

    def test_resolves_foreign_keys_to_real_rows(self, db):
        seed_reference_data(db)
        seed_employees(db, count=100, seed=1)

        orphans = db.scalar(
            select(func.count(Employee.id))
            .outerjoin(Country, Employee.country_id == Country.id)
            .outerjoin(Department, Employee.department_id == Department.id)
            .outerjoin(JobLevel, Employee.job_level_id == JobLevel.id)
            .where(
                (Country.id.is_(None))
                | (Department.id.is_(None))
                | (JobLevel.id.is_(None))
            )
        )
        assert orphans == 0

    def test_timestamps_are_populated(self, db):
        seed_reference_data(db)
        seed_employees(db, count=10, seed=1)

        for employee in db.scalars(select(Employee)):
            assert employee.created_at is not None
            assert employee.updated_at is not None

    def test_reseeding_with_the_same_seed_reproduces_the_same_people(self, db):
        seed_reference_data(db)
        seed_employees(db, count=100, seed=42)
        first = [e.email for e in db.scalars(select(Employee).order_by(Employee.id))]

        db.query(Employee).delete()
        db.commit()
        seed_employees(db, count=100, seed=42)
        second = [e.email for e in db.scalars(select(Employee).order_by(Employee.id))]

        assert first == second
