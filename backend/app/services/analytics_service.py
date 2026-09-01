"""Pay analytics, aggregated in SQL.

Every figure here is computed by the database and returned already reduced. The
alternative — reading 10,000 rows and summing them in Python, or worse in the
browser — makes the cost of the dashboard grow with headcount for no benefit,
since the client only ever displays the totals.

All money is normalised to USD before aggregation. Summing raw `base_salary`
across currencies would add yen to dollars and produce a number that means
nothing.
"""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import Select, case, func, select
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.models import Country, Currency, Department, Employee
from app.schemas.analytics import AnalyticsParams
from app.services.currency import CENTS, salary_in_usd_sql
from app.services.employee_filters import apply_employee_filters


@dataclass(frozen=True)
class Totals:
    headcount: int
    total_spend_usd: Decimal
    # Null when nothing matches the filters: there is no average of no salaries,
    # and reporting 0 would read as "these people are paid nothing".
    average_salary_usd: Decimal | None
    median_salary_usd: Decimal | None
    leaving_soon: int


@dataclass(frozen=True)
class Breakdown:
    id: int
    name: str
    headcount: int
    total_spend_usd: Decimal
    average_salary_usd: Decimal


@dataclass(frozen=True)
class Analytics:
    totals: Totals
    by_country: list[Breakdown]
    by_department: list[Breakdown]


def _to_money(value: float | None) -> Decimal | None:
    """Aggregates come back as floats because the summing happens in SQL.

    Rounding to cents at this boundary stops the float arithmetic leaking into
    the response as 84730.999999999985.
    """
    if value is None:
        return None
    return Decimal(str(value)).quantize(CENTS)


def _query(params: AnalyticsParams, *columns) -> Select:
    """Aggregate over active employees matching the filters.

    Active-only is not something the caller can switch off: "total payroll" means
    what the organisation currently pays, and people who have left are not paid.
    """
    stmt = (
        select(*columns)
        .select_from(Employee)
        .join(Employee.currency)
        .join(Currency.exchange_rate)
    )
    return apply_employee_filters(
        stmt,
        country_id=params.country_id,
        department_id=params.department_id,
        job_level_id=params.job_level_id,
        is_active=True,
    )


def _totals(db: Session, params: AnalyticsParams) -> Totals:
    usd = salary_in_usd_sql()

    # Within the active population, having an exit date at all means the departure
    # is still ahead — a past one would have excluded the row already.
    scheduled_to_leave = case((Employee.exit_date.is_not(None), 1), else_=0)

    headcount, total, average, leaving = db.execute(
        _query(
            params,
            func.count(Employee.id),
            func.sum(usd),
            func.avg(usd),
            func.sum(scheduled_to_leave),
        )
    ).one()

    return Totals(
        headcount=headcount or 0,
        total_spend_usd=_to_money(total) or Decimal("0.00"),
        average_salary_usd=_to_money(average),
        median_salary_usd=_median(db, params),
        leaving_soon=int(leaving or 0),
    )


def _median(db: Session, params: AnalyticsParams) -> Decimal | None:
    """Median salary, computed in SQL.

    SQLite has no percentile function, so the middle row is located with a window
    function: number every row by salary, count the rows, then average whichever
    one or two sit in the middle. Taking both `(n+1)/2` and `(n+2)/2` covers the
    odd and even cases in one expression — for an odd count they are the same
    row, so averaging returns that row unchanged.

    Median matters more than the mean for pay. A handful of executive salaries
    drags the average above what a typical person earns, and "what does a typical
    person earn" is the question being asked.
    """
    usd = salary_in_usd_sql()

    numbered = _query(
        params,
        usd.label("salary"),
        func.row_number().over(order_by=usd).label("position"),
        func.count().over().label("total"),
    ).subquery()

    # Floor division, not `/`: SQLAlchemy 2.0 renders `/` as float division even
    # on integer columns, which would make the middle positions 1.5 and 2.0 for a
    # two-row set and match only the upper one.
    middle = select(func.avg(numbered.c.salary)).where(
        numbered.c.position.in_(
            [(numbered.c.total + 1) // 2, (numbered.c.total + 2) // 2]
        )
    )
    return _to_money(db.scalar(middle))


def _breakdown(
    db: Session,
    params: AnalyticsParams,
    relationship: InstrumentedAttribute,
    model: type[Country] | type[Department],
) -> list[Breakdown]:
    """Spend, headcount and average per group.

    The join goes through the relationship rather than the entity: Country is
    reachable both from Employee and from Currency, so naming the entity alone
    would leave the path ambiguous.
    """
    usd = salary_in_usd_sql()

    rows = db.execute(
        _query(
            params,
            model.id,
            model.name,
            func.count(Employee.id),
            func.sum(usd),
            func.avg(usd),
        )
        .join(relationship)
        .group_by(model.id, model.name)
        # Ranked by cost, because "where does the money go" is the question a
        # breakdown gets opened to answer.
        .order_by(func.sum(usd).desc())
    ).all()

    return [
        Breakdown(
            id=row[0],
            name=row[1],
            headcount=row[2],
            total_spend_usd=_to_money(row[3]) or Decimal("0.00"),
            average_salary_usd=_to_money(row[4]) or Decimal("0.00"),
        )
        for row in rows
    ]


def get_analytics(db: Session, params: AnalyticsParams) -> Analytics:
    return Analytics(
        totals=_totals(db, params),
        by_country=_breakdown(db, params, Employee.country, Country),
        by_department=_breakdown(db, params, Employee.department, Department),
    )
