from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, contains_eager, selectinload

from app.models import Currency, Employee
from app.schemas.employee import (
    EmployeeListParams,
    EmployeeSortField,
    SortDirection,
)
from app.services.currency import salary_in_usd_sql

_SORT_COLUMNS = {
    EmployeeSortField.LAST_NAME: Employee.last_name,
    EmployeeSortField.FIRST_NAME: Employee.first_name,
    EmployeeSortField.HIRE_DATE: Employee.hire_date,
}


def _apply_filters(stmt: Select, params: EmployeeListParams) -> Select:
    if params.q:
        # SQLite's LIKE is case-insensitive for ASCII by default; lower() makes that
        # explicit rather than relying on the dialect.
        pattern = f"%{params.q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Employee.first_name).like(pattern),
                func.lower(Employee.last_name).like(pattern),
                func.lower(Employee.email).like(pattern),
            )
        )

    if params.country_id:
        stmt = stmt.where(Employee.country_id.in_(params.country_id))
    if params.department_id:
        stmt = stmt.where(Employee.department_id.in_(params.department_id))
    if params.job_level_id:
        stmt = stmt.where(Employee.job_level_id.in_(params.job_level_id))
    if params.is_active is not None:
        stmt = stmt.where(Employee.is_active.is_(params.is_active))

    return stmt


def _apply_sort(stmt: Select, params: EmployeeListParams) -> Select:
    if params.sort_by is EmployeeSortField.SALARY_USD:
        column = salary_in_usd_sql()
    else:
        column = _SORT_COLUMNS[params.sort_by]

    ordering = column.desc() if params.sort_dir is SortDirection.DESC else column.asc()
    # Ties broken by id, so paging through equal values cannot repeat or skip rows.
    return stmt.order_by(ordering, Employee.id)


def list_employees(db: Session, params: EmployeeListParams) -> tuple[list[Employee], int]:
    """Return one page of employees and the total number matching the filters."""
    # Currency and its rate are joined rather than lazily loaded because sorting by
    # USD needs them in SQL anyway; contains_eager reuses that join to populate the
    # relationships, so serialising a page costs no extra queries.
    base = (
        select(Employee)
        .join(Employee.currency)
        .join(Currency.exchange_rate)
        .options(
            contains_eager(Employee.currency).contains_eager(Currency.exchange_rate),
            selectinload(Employee.country),
            selectinload(Employee.department),
            selectinload(Employee.job_level),
        )
    )
    filtered = _apply_filters(base, params)

    total = db.scalar(
        _apply_filters(select(func.count()).select_from(Employee), params)
    )

    page = (
        _apply_sort(filtered, params)
        .offset((params.page - 1) * params.page_size)
        .limit(params.page_size)
    )
    return list(db.scalars(page).unique()), total or 0


def get_employee(db: Session, employee_id: int) -> Employee | None:
    stmt = (
        select(Employee)
        .where(Employee.id == employee_id)
        .options(
            selectinload(Employee.currency).selectinload(Currency.exchange_rate),
            selectinload(Employee.country),
            selectinload(Employee.department),
            selectinload(Employee.job_level),
        )
    )
    return db.scalars(stmt).unique().one_or_none()
