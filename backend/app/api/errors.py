"""Translates domain errors into HTTP responses.

Keeping this in one place means services never import FastAPI, and every error
response has the same shape regardless of which endpoint raised it.
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.services.errors import ConflictError, NotFoundError, ValidationError

_STATUS_BY_ERROR = {
    NotFoundError: status.HTTP_404_NOT_FOUND,
    ConflictError: status.HTTP_409_CONFLICT,
    ValidationError: status.HTTP_422_UNPROCESSABLE_ENTITY,
}


def register_error_handlers(app: FastAPI) -> None:
    for error_type, status_code in _STATUS_BY_ERROR.items():
        app.add_exception_handler(error_type, _handler_for(status_code))


def _handler_for(status_code: int):
    async def handler(_request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=status_code, content={"detail": str(exc)})

    return handler
