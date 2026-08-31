from math import ceil
from typing import Generic, TypeVar

from pydantic import BaseModel, computed_field

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Offset-paginated envelope.

    `total` is what lets the UI render page numbers and a result count; it costs an
    extra COUNT query per request, which is the accepted trade-off of offset paging.
    """

    items: list[T]
    total: int
    page: int
    page_size: int

    @computed_field
    @property
    def total_pages(self) -> int:
        return ceil(self.total / self.page_size) if self.page_size else 0

    @classmethod
    def create(cls, items: list[T], total: int, page: int, page_size: int) -> "Page[T]":
        return cls(items=items, total=total, page=page, page_size=page_size)
