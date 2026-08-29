from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Currency(Base):
    """Immutable metadata about a currency. Rates live in ExchangeRate."""

    __tablename__ = "currency"

    code: Mapped[str] = mapped_column(String(3), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    symbol: Mapped[str] = mapped_column(String(8), nullable=False)
    minor_unit: Mapped[int] = mapped_column(Integer, nullable=False)

    exchange_rate: Mapped["ExchangeRate"] = relationship(back_populates="currency")

    __table_args__ = (
        CheckConstraint("minor_unit >= 0 AND minor_unit <= 4", name="ck_currency_minor_unit"),
    )


class ExchangeRate(Base):
    """Rate used to convert a local amount into the base reporting currency."""

    __tablename__ = "exchange_rate"

    currency_code: Mapped[str] = mapped_column(
        String(3), ForeignKey("currency.code"), primary_key=True
    )
    rate_to_usd: Mapped[float] = mapped_column(Float, nullable=False)

    currency: Mapped[Currency] = relationship(back_populates="exchange_rate")

    __table_args__ = (
        CheckConstraint("rate_to_usd > 0", name="ck_exchange_rate_positive"),
    )


class Country(Base):
    __tablename__ = "country"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    iso_code: Mapped[str] = mapped_column(String(2), nullable=False, unique=True)
    default_currency_code: Mapped[str] = mapped_column(
        String(3), ForeignKey("currency.code"), nullable=False
    )

    default_currency: Mapped[Currency] = relationship()


class Department(Base):
    __tablename__ = "department"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)


class JobLevel(Base):
    """Seniority ladder. `rank` orders levels from most junior upwards."""

    __tablename__ = "job_level"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
