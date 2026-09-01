"""Filter predicates shared by the directory and the dashboard.

Both features filter the same population, and a dashboard that counted a
different set of people than the directory listed would be worse than useless —
the numbers would quietly disagree with the rows. Writing the predicates once is
what keeps them honest.

Semantics: values within one field are OR-matched, and different fields are
AND-matched. Two country ids plus one department means "in either country, and
in that department".
"""

from sqlalchemy import Select, func, not_, or_

from app.models import Employee
from app.services.employment import active_predicate


def apply_employee_filters(
    stmt: Select,
    *,
    q: str | None = None,
    country_id: list[int] | None = None,
    department_id: list[int] | None = None,
    job_level_id: list[int] | None = None,
    is_active: bool | None = None,
) -> Select:
    if q:
        # SQLite's LIKE is case-insensitive for ASCII by default; lower() makes that
        # explicit rather than relying on the dialect.
        pattern = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Employee.first_name).like(pattern),
                func.lower(Employee.last_name).like(pattern),
                func.lower(Employee.email).like(pattern),
            )
        )

    if country_id:
        stmt = stmt.where(Employee.country_id.in_(country_id))
    if department_id:
        stmt = stmt.where(Employee.department_id.in_(department_id))
    if job_level_id:
        stmt = stmt.where(Employee.job_level_id.in_(job_level_id))
    if is_active is not None:
        active = active_predicate()
        stmt = stmt.where(active if is_active else not_(active))

    return stmt
