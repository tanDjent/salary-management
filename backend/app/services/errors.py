"""Domain errors.

The service raises these instead of HTTPException so that query logic stays
independent of the web layer; the router maps them to status codes.
"""


class DomainError(Exception):
    """Base for errors the API can translate into a meaningful response."""


class NotFoundError(DomainError):
    """A requested row does not exist. Maps to 404."""


class ConflictError(DomainError):
    """The request is well-formed but clashes with existing data. Maps to 409."""


class ValidationError(DomainError):
    """The request is structurally valid but violates a business rule. Maps to 422."""
