from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_error_handlers
from app.api.routes import analytics, employees, lookups
from app.core.config import settings

app = FastAPI(title="Salary Management API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


register_error_handlers(app)
app.include_router(employees.router, prefix="/api")
app.include_router(lookups.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
