import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models import *  # noqa: F401,F403 -- registers every table on Base.metadata


@pytest.fixture
def db() -> Session:
    """A fresh in-memory database per test.

    StaticPool keeps every connection pointed at the same in-memory database;
    without it each connection would get its own empty one.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
