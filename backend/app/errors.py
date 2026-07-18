"""Custom exception hierarchy and FastAPI handlers.

Every ``AppError`` maps to the uniform envelope::

    {"error": {"code": "...", "message": "...", "detail": {...}?}}
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base application error. Subclasses set ``http_status`` and ``code``."""

    http_status: int = 500
    code: str = "internal_error"

    def __init__(self, message: str, *, detail: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail


class ValidationError(AppError):
    http_status = 422
    code = "validation"


class AuthError(AppError):
    http_status = 401
    code = "unauthorized"


class ForbiddenError(AppError):
    http_status = 403
    code = "forbidden"


class NotFoundError(AppError):
    http_status = 404
    code = "not_found"


class ConflictError(AppError):
    http_status = 409
    code = "conflict"


class RateLimitError(AppError):
    http_status = 429
    code = "rate_limited"


class StorageError(AppError):
    http_status = 502
    code = "storage_error"


def _envelope(code: str, message: str, detail: dict | None = None) -> dict:
    body: dict = {"error": {"code": code, "message": message}}
    if detail is not None:
        body["error"]["detail"] = detail
    return body


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.http_status,
            content=_envelope(exc.code, exc.message, exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_envelope(
                "validation",
                "Request validation failed",
                {"errors": jsonable_encoder(exc.errors())},
            ),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=_envelope("internal_error", "An unexpected error occurred"),
        )
