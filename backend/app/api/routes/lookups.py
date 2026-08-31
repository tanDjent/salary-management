from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Country, Department, JobLevel
from app.schemas.lookups import LookupsOut

router = APIRouter(prefix="/lookups", tags=["lookups"])


@router.get("", response_model=LookupsOut, summary="Reference data for filter controls")
def get_lookups(db: Annotated[Session, Depends(get_db)]) -> LookupsOut:
    """Every lookup list in one response.

    Three tiny, rarely-changing lists: one round trip is cheaper for the client than
    three, and it lets the UI populate all its filters before first paint.
    """
    return LookupsOut(
        countries=list(db.scalars(select(Country).order_by(Country.name))),
        departments=list(db.scalars(select(Department).order_by(Department.name))),
        job_levels=list(db.scalars(select(JobLevel).order_by(JobLevel.rank))),
    )
