from pydantic import BaseModel, ConfigDict

from app.schemas.employee import JobLevelOut, LookupOut


class CountryOut(LookupOut):
    model_config = ConfigDict(from_attributes=True)

    iso_code: str
    default_currency_code: str


class LookupsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    countries: list[CountryOut]
    departments: list[LookupOut]
    job_levels: list[JobLevelOut]
