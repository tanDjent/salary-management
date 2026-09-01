from decimal import Decimal

from datetime import date

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, contains_eager, selectinload

from app.models import Country, Currency, Department, Employee, JobLevel
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeListParams,
    EmployeeSortField,
    EmployeeUpdate,
    SortDirection,
)
from app.services.currency import salary_in_usd_sql, to_minor_units
from app.services.employee_filters import apply_employee_filters
from app.services.errors import ConflictError, NotFoundError, ValidationError

_SORT_COLUMNS = {
    EmployeeSortField.LAST_NAME: Employee.last_name,
    EmployeeSortField.FIRST_NAME: Employee.first_name,
    EmployeeSortField.HIRE_DATE: Employee.hire_date,
}


def _apply_filters(stmt: Select, params: EmployeeListParams) -> Select:
    return apply_employee_filters(
        stmt,
        q=params.q,
        country_id=params.country_id,
        department_id=params.department_id,
        job_level_id=params.job_level_id,
        is_active=params.is_active,
    )


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


def _require_employee(db: Session, employee_id: int) -> Employee:
    employee = get_employee(db, employee_id)
    if employee is None:
        raise NotFoundError(f"Employee {employee_id} not found")
    return employee


def _reload(db: Session, employee: Employee) -> Employee:
    """Re-read an employee after a write, with relationships refreshed.

    The session is configured with expire_on_commit=False, so a committed object
    keeps whatever it had already loaded. Changing country_id would otherwise leave
    the stale Country and Currency attached, and the response would report the old
    country and convert at the old rate.
    """
    db.expire(employee)
    return _require_employee(db, employee.id)


def _resolve_country(db: Session, country_id: int) -> Country:
    country = db.get(Country, country_id, options=[selectinload(Country.default_currency)])
    if country is None:
        raise ValidationError(f"Country {country_id} does not exist")
    return country


def _check_lookups_exist(db: Session, department_id: int, job_level_id: int) -> None:
    if db.get(Department, department_id) is None:
        raise ValidationError(f"Department {department_id} does not exist")
    if db.get(JobLevel, job_level_id) is None:
        raise ValidationError(f"Job level {job_level_id} does not exist")


def _check_email_available(db: Session, email: str, exclude_id: int | None = None) -> None:
    stmt = select(Employee.id).where(func.lower(Employee.email) == email.lower())
    if exclude_id is not None:
        stmt = stmt.where(Employee.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise ConflictError(f"An employee with email {email} already exists")


def _salary_to_minor_units(amount: Decimal, currency: Currency) -> int:
    """Reject precision the currency cannot represent rather than rounding it away.

    Silently turning ¥5000.5 into ¥5001 would misstate someone's pay without telling
    anyone; refusing it surfaces the mistake at the point it was made.
    """
    exponent = amount.as_tuple().exponent
    if isinstance(exponent, int) and -exponent > currency.minor_unit:
        raise ValidationError(
            f"{currency.code} supports {currency.minor_unit} decimal places; "
            f"{amount} has more"
        )
    return to_minor_units(amount, currency.minor_unit)


def create_employee(db: Session, payload: EmployeeCreate) -> Employee:
    country = _resolve_country(db, payload.country_id)
    _check_lookups_exist(db, payload.department_id, payload.job_level_id)
    _check_email_available(db, payload.email)

    currency = country.default_currency
    employee = Employee(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        country_id=payload.country_id,
        department_id=payload.department_id,
        job_level_id=payload.job_level_id,
        base_salary=_salary_to_minor_units(payload.salary, currency),
        currency_code=currency.code,
        hire_date=payload.hire_date,
        exit_date=None,
    )
    db.add(employee)
    db.commit()
    return _reload(db, employee)


def update_employee(db: Session, employee_id: int, payload: EmployeeUpdate) -> Employee:
    employee = _require_employee(db, employee_id)
    changes = payload.model_dump(exclude_unset=True)

    if "email" in changes:
        _check_email_available(db, changes["email"], exclude_id=employee_id)

    if "department_id" in changes and db.get(Department, changes["department_id"]) is None:
        raise ValidationError(f"Department {changes['department_id']} does not exist")
    if "job_level_id" in changes and db.get(JobLevel, changes["job_level_id"]) is None:
        raise ValidationError(f"Job level {changes['job_level_id']} does not exist")

    # Currency follows country, so both are resolved before the salary is scaled.
    if "country_id" in changes:
        country = _resolve_country(db, changes["country_id"])
        employee.country_id = country.id
        employee.currency_code = country.default_currency.code
        currency = country.default_currency
    else:
        currency = employee.currency

    if "salary" in changes:
        employee.base_salary = _salary_to_minor_units(changes["salary"], currency)

    for field in (
        "first_name",
        "last_name",
        "email",
        "department_id",
        "job_level_id",
        "hire_date",
        "exit_date",
    ):
        if field in changes:
            setattr(employee, field, changes[field])

    _check_exit_after_hire(employee.hire_date, employee.exit_date)

    db.commit()
    return _reload(db, employee)


def _check_exit_after_hire(hire_date: date, exit_date: date | None) -> None:
    if exit_date is not None and exit_date < hire_date:
        raise ValidationError(
            f"Exit date {exit_date} is before the hire date {hire_date}"
        )


def set_exit_date(db: Session, employee_id: int, exit_date: date) -> Employee:
    """Record a departure. Soft delete: salary data is financial history, so the
    row is kept and the date alone determines status."""
    employee = _require_employee(db, employee_id)
    _check_exit_after_hire(employee.hire_date, exit_date)
    employee.exit_date = exit_date
    db.commit()
    return _reload(db, employee)


def clear_exit_date(db: Session, employee_id: int) -> Employee:
    """Reverse a departure, whether it has already taken effect or is scheduled."""
    employee = _require_employee(db, employee_id)
    employee.exit_date = None
    db.commit()
    return _reload(db, employee)
