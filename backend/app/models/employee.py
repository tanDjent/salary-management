from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.reference import Country, Currency, Department, JobLevel


class Employee(Base):
    __tablename__ = "employee"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(64), nullable=False)
    last_name: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    country_id: Mapped[int] = mapped_column(ForeignKey("country.id"), nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("department.id"), nullable=False)
    job_level_id: Mapped[int] = mapped_column(ForeignKey("job_level.id"), nullable=False)

    # Stored in the currency's minor units to keep aggregation exact; see docs/requirements.md.
    base_salary: Mapped[int] = mapped_column(Integer, nullable=False)
    currency_code: Mapped[str] = mapped_column(
        String(3), ForeignKey("currency.code"), nullable=False
    )

    hire_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    country: Mapped[Country] = relationship()
    department: Mapped[Department] = relationship()
    job_level: Mapped[JobLevel] = relationship()
    currency: Mapped[Currency] = relationship()

    __table_args__ = (
        CheckConstraint("base_salary >= 0", name="ck_employee_salary_non_negative"),
        Index("ix_employee_last_name", "last_name"),
        Index("ix_employee_country_id", "country_id"),
        Index("ix_employee_department_id", "department_id"),
        Index("ix_employee_job_level_id", "job_level_id"),
        Index("ix_employee_is_active", "is_active"),
    )
