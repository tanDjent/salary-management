from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.common import Page
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeListParams,
    EmployeeOut,
    EmployeeUpdate,
)
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


@router.post(
    "",
    response_model=EmployeeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an employee",
)
def create_employee(
    payload: EmployeeCreate,
    db: Annotated[Session, Depends(get_db)],
) -> EmployeeOut:
    return EmployeeOut.from_model(employee_service.create_employee(db, payload))


@router.get("/{employee_id}", response_model=EmployeeOut, summary="Get one employee")
def get_employee(
    employee_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> EmployeeOut:
    employee = employee_service.get_employee(db, employee_id)
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return EmployeeOut.from_model(employee)


@router.patch("/{employee_id}", response_model=EmployeeOut, summary="Edit an employee")
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> EmployeeOut:
    return EmployeeOut.from_model(employee_service.update_employee(db, employee_id, payload))


@router.post(
    "/{employee_id}/deactivate",
    response_model=EmployeeOut,
    summary="Deactivate an employee",
)
def deactivate_employee(
    employee_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> EmployeeOut:
    """Soft delete: the row is retained, since salary data is financial history."""
    return EmployeeOut.from_model(employee_service.set_active(db, employee_id, False))


@router.post(
    "/{employee_id}/reactivate",
    response_model=EmployeeOut,
    summary="Reactivate an employee",
)
def reactivate_employee(
    employee_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> EmployeeOut:
    return EmployeeOut.from_model(employee_service.set_active(db, employee_id, True))
