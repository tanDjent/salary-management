from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.analytics import AnalyticsOut, AnalyticsParams
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsOut, summary="Pay analytics for the dashboard")
def get_analytics(
    db: Annotated[Session, Depends(get_db)],
    params: Annotated[AnalyticsParams, Query()],
) -> AnalyticsOut:
    """Headline figures and per-group breakdowns, over active employees only.

    One response rather than an endpoint per card: the dashboard renders them
    together and they must all describe the same filtered population, which is
    only guaranteed if they are computed from one request.
    """
    return AnalyticsOut.model_validate(analytics_service.get_analytics(db, params))
