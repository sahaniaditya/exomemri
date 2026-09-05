"""Hard cap on inbound HTTP body size (DoS control).

Pydantic ``max_length`` on capture fields runs *after* Starlette has buffered
the JSON. This middleware rejects oversized bodies before parse — via
``Content-Length`` when present, and by counting chunks when it is not.
"""

from __future__ import annotations

from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.errors import PayloadTooLargeError

MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024


class MaxBodySizeMiddleware:
    """Pure ASGI middleware: never buffer the request the way BaseHTTPMiddleware does."""

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_REQUEST_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        content_length = _content_length(scope)
        if content_length is not None and content_length > self.max_bytes:
            await _reject(scope, receive, send)
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise PayloadTooLargeError()
            return message

        response_started = False

        async def tracked_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except PayloadTooLargeError:
            if not response_started:
                await _reject(scope, receive, send)


def _content_length(scope: Scope) -> int | None:
    for key, value in scope.get("headers") or []:
        if key == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


async def _reject(scope: Scope, receive: Receive, send: Send) -> None:
    exc = PayloadTooLargeError()
    response = JSONResponse(
        status_code=exc.http_status,
        content={"error": {"code": exc.code, "message": exc.message}},
    )
    await response(scope, receive, send)
