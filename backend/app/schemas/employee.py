from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

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


class EmployeeCreate(BaseModel):
    """Note there is no currency field: it is derived from the country, so the two
    can never contradict each other."""

    model_config = ConfigDict(str_strip_whitespace=True)

    first_name: str = Field(min_length=1, max_length=64)
    last_name: str = Field(min_length=1, max_length=64)
    email: EmailStr
    country_id: int
    department_id: int
    job_level_id: int
    salary: Decimal = Field(ge=0, description="Amount in the country's currency")
    hire_date: date

    @field_validator("salary")
    @classmethod
    def reject_excessive_precision(cls, value: Decimal) -> Decimal:
        """Guards against a client sending more decimals than the currency has.

        The currency is not known at this point, so this only catches the absurd;
        the exact check happens in the service, where the country is resolved.
        """
        if value.as_tuple().exponent < -4:
            raise ValueError("salary has too many decimal places")
        return value


class EmployeeUpdate(BaseModel):
    """Every field optional: absent means "leave unchanged", which is what makes
    this a PATCH rather than a PUT."""

    model_config = ConfigDict(str_strip_whitespace=True)

    first_name: str | None = Field(default=None, min_length=1, max_length=64)
    last_name: str | None = Field(default=None, min_length=1, max_length=64)
    email: EmailStr | None = None
    country_id: int | None = None
    department_id: int | None = None
    job_level_id: int | None = None
    salary: Decimal | None = Field(default=None, ge=0)
    hire_date: date | None = None

    @model_validator(mode="after")
    def require_salary_when_country_changes(self) -> "EmployeeUpdate":
        """A country change also changes the currency, so the existing figure would
        silently come to mean a different amount. Demand an explicit new salary."""
        if self.country_id is not None and self.salary is None:
            raise ValueError(
                "changing country changes the pay currency; provide a salary as well"
            )
        return self


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
