"""App-level rate-limit helpers (IP extraction + login checks).

Route ``Depends`` factories that need auth live in ``dependencies.py`` to
avoid circular imports with ``get_authenticated_app_user``.
"""

from __future__ import annotations

from fastapi import Request

from app.config import Settings
from app.services.rate_limit_service import RateLimitService

# Process-wide limiter so counters survive across requests in one worker.
_rate_limiter = RateLimitService()


def get_rate_limiter() -> RateLimitService:
    return _rate_limiter


def client_ip(request: Request) -> str:
    """Best-effort client IP (trust first X-Forwarded-For hop from our BFF)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",", 1)[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()
    if request.client is not None and request.client.host:
        return request.client.host
    return "unknown"


def check_login_rate_limits(
    *,
    request: Request,
    email: str,
    limiter: RateLimitService,
    settings: Settings,
) -> None:
    """Throttle login by client IP and by normalized email (both must pass)."""
    ip = client_ip(request)
    limiter.check(
        f"login:ip:{ip}",
        limit=settings.rate_limit_login_max,
        window_seconds=settings.rate_limit_login_window_seconds,
    )
    normalized = email.strip().lower()
    limiter.check(
        f"login:email:{normalized}",
        limit=settings.rate_limit_login_max,
        window_seconds=settings.rate_limit_login_window_seconds,
    )
