from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.common import Page
from app.schemas.employee import EmployeeListParams, EmployeeOut
from app.services import employee_service

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=Page[EmployeeOut], summary="List employees")
def list_employees(
    params: Annotated[EmployeeListParams, Query()],
    db: Annotated[Session, Depends(get_db)],
) -> Page[EmployeeOut]:
    employees, total = employee_service.list_employees(db, params)
    return Page.create(
        items=[EmployeeOut.from_model(e) for e in employees],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.get("/{employee_id}", response_model=EmployeeOut, summary="Get one employee")
def get_employee(
    employee_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> EmployeeOut:
    employee = employee_service.get_employee(db, employee_id)
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return EmployeeOut.from_model(employee)
