from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class AnalyticsParams(BaseModel):
    """Filters for the dashboard.

    Deliberately a subset of the directory's: there is no free-text search,
    because a dashboard answers "how do we pay this group" rather than "find this
    person", and no status filter, because the totals are always about people
    currently being paid.
    """

    country_id: list[int] = Field(default_factory=list)
    department_id: list[int] = Field(default_factory=list)
    job_level_id: list[int] = Field(default_factory=list)


class TotalsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    headcount: int
    total_spend_usd: Decimal
    # Null rather than zero when no one matches: an average of nothing is not 0.
    average_salary_usd: Decimal | None
    median_salary_usd: Decimal | None
    leaving_soon: int


class BreakdownOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    headcount: int
    total_spend_usd: Decimal
    average_salary_usd: Decimal


class AnalyticsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    totals: TotalsOut
    by_country: list[BreakdownOut]
    by_department: list[BreakdownOut]
