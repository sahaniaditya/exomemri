"""Isolated tests for MaxBodySizeMiddleware (tiny max_bytes, never 10 MiB)."""

from __future__ import annotations

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.request_limits import MaxBodySizeMiddleware

TINY_MAX_BYTES = 64


async def _echo_app(scope: Scope, receive: Receive, send: Send) -> None:
    more = True
    while more:
        message = await receive()
        if message["type"] != "http.request":
            break
        more = bool(message.get("more_body", False))
    await send(
        {
            "type": "http.response.start",
            "status": 200,
            "headers": [(b"content-type", b"text/plain")],
        }
    )
    await send({"type": "http.response.body", "body": b"ok"})


def _limited_app() -> ASGIApp:
    return MaxBodySizeMiddleware(_echo_app, max_bytes=TINY_MAX_BYTES)


async def _invoke(
    app: ASGIApp,
    *,
    headers: list[tuple[bytes, bytes]] | None = None,
    body: bytes = b"",
) -> tuple[int, bytes]:
    sent_body = False

    async def receive() -> Message:
        nonlocal sent_body
        if not sent_body:
            sent_body = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    status = 0
    chunks: list[bytes] = []

    async def send(message: Message) -> None:
        nonlocal status
        if message["type"] == "http.response.start":
            status = int(message["status"])
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body") or b"")

    scope: Scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": list(headers or []),
        "client": ("127.0.0.1", 123),
        "server": ("test", 80),
    }
    await app(scope, receive, send)
    return status, b"".join(chunks)


async def test_rejects_oversize_content_length() -> None:
    status, body = await _invoke(
        _limited_app(),
        headers=[(b"content-length", b"100")],
        body=b"x" * 100,
    )
    assert status == 413
    payload = json.loads(body)
    assert payload["error"]["code"] == "payload_too_large"
    assert payload["error"]["message"] == "Request body is too large."


async def test_rejects_oversize_body_without_content_length() -> None:
    status, body = await _invoke(
        _limited_app(),
        headers=[],
        body=b"x" * 100,
    )
    assert status == 413
    payload = json.loads(body)
    assert payload["error"]["code"] == "payload_too_large"


async def test_allows_body_under_limit() -> None:
    blob = b"x" * 50
    status, body = await _invoke(
        _limited_app(),
        headers=[(b"content-length", str(len(blob)).encode())],
        body=blob,
    )
    assert status == 200
    assert body == b"ok"
