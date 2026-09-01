"""Seed the database.

Usage:
    python -m app.seed.run [--count N] [--seed N] [--reset]
"""

import argparse
from datetime import datetime, timezone

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import (
    Country,
    Currency,
    Department,
    Employee,
    ExchangeRate,
    JobLevel,
)
from app.seed.data import COUNTRIES, CURRENCIES, DEPARTMENTS, JOB_LEVELS
from app.seed.generator import (
    DEFAULT_EMPLOYEE_COUNT,
    DEFAULT_SEED,
    generate_employees,
)

INSERT_BATCH_SIZE = 1_000


def seed_reference_data(db: Session) -> None:
    """Insert the lookup tables. Idempotent: skips anything already present."""
    existing_currencies = set(db.scalars(select(Currency.code)))
    for currency in CURRENCIES:
        if currency.code in existing_currencies:
            continue
        db.add(
            Currency(
                code=currency.code,
                name=currency.name,
                symbol=currency.symbol,
                minor_unit=currency.minor_unit,
            )
        )
        db.add(ExchangeRate(currency_code=currency.code, rate_to_usd=currency.rate_to_usd))

    existing_countries = set(db.scalars(select(Country.iso_code)))
    for country in COUNTRIES:
        if country.iso_code in existing_countries:
            continue
        db.add(
            Country(
                name=country.name,
                iso_code=country.iso_code,
                default_currency_code=country.currency_code,
            )
        )

    existing_departments = set(db.scalars(select(Department.name)))
    for department in DEPARTMENTS:
        if department.name in existing_departments:
            continue
        db.add(Department(name=department.name))

    existing_levels = set(db.scalars(select(JobLevel.title)))
    for level in JOB_LEVELS:
        if level.title in existing_levels:
            continue
        db.add(JobLevel(title=level.title, rank=level.rank))

    db.commit()


def seed_employees(db: Session, count: int, seed: int) -> int:
    """Bulk-insert generated employees. Returns the number inserted."""
    country_ids = dict(db.execute(select(Country.iso_code, Country.id)).all())
    department_ids = dict(db.execute(select(Department.name, Department.id)).all())
    job_level_ids = dict(db.execute(select(JobLevel.title, JobLevel.id)).all())

    now = datetime.now(timezone.utc)
    batch: list[dict] = []
    inserted = 0

    for employee in generate_employees(count=count, seed=seed):
        batch.append(
            {
                "first_name": employee.first_name,
                "last_name": employee.last_name,
                "email": employee.email,
                "country_id": country_ids[employee.country_iso],
                "department_id": department_ids[employee.department_name],
                "job_level_id": job_level_ids[employee.job_level_title],
                "base_salary": employee.base_salary,
                "currency_code": employee.currency_code,
                "hire_date": employee.hire_date,
                "exit_date": employee.exit_date,
                "created_at": now,
                "updated_at": now,
            }
        )
        if len(batch) >= INSERT_BATCH_SIZE:
            inserted += _flush(db, batch)
            batch.clear()

    if batch:
        inserted += _flush(db, batch)

    db.commit()
    return inserted


def _flush(db: Session, batch: list[dict]) -> int:
    """One multi-row INSERT, bypassing per-object ORM overhead."""
    db.execute(insert(Employee), batch)
    return len(batch)


def reset(db: Session) -> None:
    """Clear all data. Reference tables are deleted last to respect foreign keys."""
    db.execute(delete(Employee))
    db.execute(delete(ExchangeRate))
    db.execute(delete(Country))
    db.execute(delete(Department))
    db.execute(delete(JobLevel))
    db.execute(delete(Currency))
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the salary management database.")
    parser.add_argument("--count", type=int, default=DEFAULT_EMPLOYEE_COUNT)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--reset", action="store_true", help="delete existing rows first")
    args = parser.parse_args()

    with SessionLocal() as db:
        if args.reset:
            reset(db)
            print("Cleared existing data.")

        if db.scalar(select(Employee.id).limit(1)) is not None:
            print("Employees already present; pass --reset to reseed. Nothing to do.")
            return

        seed_reference_data(db)
        print(
            f"Reference data ready: {len(CURRENCIES)} currencies, {len(COUNTRIES)} countries, "
            f"{len(DEPARTMENTS)} departments, {len(JOB_LEVELS)} job levels."
        )

        inserted = seed_employees(db, count=args.count, seed=args.seed)
        print(f"Inserted {inserted:,} employees (seed={args.seed}).")


if __name__ == "__main__":
    main()
