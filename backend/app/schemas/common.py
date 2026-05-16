from pydantic import BaseModel


class PaginatedResponse(BaseModel):
    """Generic paginated response wrapper."""
    items: list
    total: int
    limit: int
    offset: int


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    error: "ErrorBody"


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = []


class HealthResponse(BaseModel):
    status: str = "healthy"


class ReadyResponse(BaseModel):
    status: str
    database: str
    redis: str
