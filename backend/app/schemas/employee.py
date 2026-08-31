from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.models import Employee


class LookupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class JobLevelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    rank: int


class SalaryOut(BaseModel):
    """A salary in the employee's own currency, plus its base-currency equivalent.

    Amounts are Decimal so they serialise as exact JSON strings; the UI displays
    `amount` and the dashboard compares on `amount_usd`.
    """

    amount: Decimal
    currency: str
    amount_usd: Decimal


class EmployeeOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    country: LookupOut
    department: LookupOut
    job_level: JobLevelOut
    salary: SalaryOut
    hire_date: date
    is_active: bool

    @classmethod
    def from_model(cls, employee: Employee) -> "EmployeeOut":
        from app.services.currency import to_base_currency, to_major_units

        amount = to_major_units(employee.base_salary, employee.currency.minor_unit)
        return cls(
            id=employee.id,
            first_name=employee.first_name,
            last_name=employee.last_name,
            email=employee.email,
            country=LookupOut.model_validate(employee.country),
            department=LookupOut.model_validate(employee.department),
            job_level=JobLevelOut.model_validate(employee.job_level),
            salary=SalaryOut(
                amount=amount,
                currency=employee.currency_code,
                amount_usd=to_base_currency(amount, employee.currency.exchange_rate.rate_to_usd),
            ),
            hire_date=employee.hire_date,
            is_active=employee.is_active,
        )


class EmployeeSortField(str, Enum):
    LAST_NAME = "last_name"
    FIRST_NAME = "first_name"
    HIRE_DATE = "hire_date"
    SALARY_USD = "salary_usd"


class SortDirection(str, Enum):
    ASC = "asc"
    DESC = "desc"


class EmployeeListParams(BaseModel):
    """Query parameters for the directory.

    List-valued filters are OR-matched within a field and AND-matched across fields:
    two country ids plus one department means "in either country, and in that
    department".
    """

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=100)

    q: str | None = Field(default=None, description="Matches name or email")
    country_id: list[int] = Field(default_factory=list)
    department_id: list[int] = Field(default_factory=list)
    job_level_id: list[int] = Field(default_factory=list)
    # Unset means every employee; the UI chooses its own default.
    is_active: bool | None = None

    sort_by: EmployeeSortField = EmployeeSortField.HIRE_DATE
    sort_dir: SortDirection = SortDirection.DESC
