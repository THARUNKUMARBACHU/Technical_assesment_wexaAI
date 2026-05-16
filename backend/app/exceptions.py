class AppException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: list | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []
        super().__init__(message)


class NotFound(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__("NOT_FOUND", message, 404)


class Forbidden(AppException):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__("FORBIDDEN", message, 403)


class Unauthorized(AppException):
    def __init__(self, message: str = "Authentication required"):
        super().__init__("UNAUTHORIZED", message, 401)


class Conflict(AppException):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__("CONFLICT", message, 409)


class ValidationError(AppException):
    def __init__(self, message: str = "Validation failed", details: list | None = None):
        super().__init__("VALIDATION_ERROR", message, 400, details)


class RateLimited(AppException):
    def __init__(self, message: str = "Too many requests"):
        super().__init__("RATE_LIMITED", message, 429)
