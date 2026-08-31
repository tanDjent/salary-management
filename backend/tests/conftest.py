from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import *  # noqa: F401,F403 -- registers every table on Base.metadata
from app.seed.run import seed_employees, seed_reference_data


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


@pytest.fixture
def seeded_db(db: Session) -> Session:
    """A small but structurally complete dataset.

    200 employees rather than 10 000: the queries under test behave identically, and
    the suite stays fast.
    """
    seed_reference_data(db)
    seed_employees(db, count=200, seed=99)
    return db


@pytest.fixture
def client(seeded_db: Session) -> Iterator[TestClient]:
    """TestClient wired to the in-memory database instead of the real one."""
    app.dependency_overrides[get_db] = lambda: seeded_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def query_counter(seeded_db: Session):
    """Counts SQL statements issued, so N+1 regressions fail a test."""
    statements: list[str] = []
    engine = seeded_db.get_bind()

    @event.listens_for(engine, "before_cursor_execute")
    def _record(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    yield statements
    event.remove(engine, "before_cursor_execute", _record)
