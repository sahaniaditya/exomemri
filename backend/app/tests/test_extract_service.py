"""ExtractService parsing of stored artifacts."""

from __future__ import annotations

import json

import pytest

from app.services.extract_service import ExtractService
from app.tests.conftest import FakeStorage

PREFIX = "users/u/spaces/s/sources/src"


@pytest.fixture
def storage() -> FakeStorage:
    return FakeStorage()


async def test_ai_chat_extract_prefers_text_when_content_missing(
    storage: FakeStorage,
) -> None:
    artifact = json.dumps(
        {
            "title": "Chat",
            "url": "https://chatgpt.com/c/xyz",
            "messages": [{"role": "user", "text": "hello from the extension"}],
        }
    )
    await storage.upload_text(f"{PREFIX}/raw/chat.json", artifact, "application/json")
    text = await ExtractService(storage).read_full_extract(  # type: ignore[arg-type]
        {"type": "ai_chat", "storage_prefix": PREFIX}
    )
    assert text == "user: hello from the extension"


async def test_ai_chat_extract_falls_back_to_content_field(
    storage: FakeStorage,
) -> None:
    artifact = json.dumps([{"role": "assistant", "content": "server-shaped turn"}])
    await storage.upload_text(f"{PREFIX}/raw/chat.json", artifact, "application/json")
    text = await ExtractService(storage).read_full_extract(  # type: ignore[arg-type]
        {"type": "ai_chat", "storage_prefix": PREFIX}
    )
    assert text == "assistant: server-shaped turn"
