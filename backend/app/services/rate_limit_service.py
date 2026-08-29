"""In-process sliding-window rate limiter (single-instance friendly)."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from app.errors import RateLimitError


class RateLimitService:
    """Thread-safe sliding-window counter keyed by opaque strings.

    Suitable for a single uvicorn worker (Render free). Swap the store later
    if the deploy grows to multiple instances.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, *, limit: int, window_seconds: int) -> None:
        """Record a hit for ``key`` or raise ``RateLimitError`` if over limit."""
        if limit < 1:
            raise RateLimitError(
                "Rate limit exceeded. Try again later.",
                detail={"retry_after_seconds": window_seconds, "key": key},
            )

        now = time.monotonic()
        window_start = now - window_seconds

        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= window_start:
                hits.popleft()

            if len(hits) >= limit:
                retry_after = max(1, int(hits[0] + window_seconds - now) + 1)
                raise RateLimitError(
                    "Rate limit exceeded. Try again later.",
                    detail={"retry_after_seconds": retry_after},
                )

            hits.append(now)


class NoopRateLimiter:
    """Test double that never throttles."""

    def check(self, key: str, *, limit: int, window_seconds: int) -> None:
        _ = (key, limit, window_seconds)
