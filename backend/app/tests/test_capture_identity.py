"""Unit tests for canonical capture identity URLs."""

from __future__ import annotations

from app.schemas.common import SourceType
from app.services.capture_identity import (
    canonical_capture_url,
    chatgpt_conversation_id,
    identity_lookup_urls,
    youtube_video_id,
)


def test_article_strips_tracking_fragment_and_slash() -> None:
    raw = "http://Example.com/post/?utm_source=x&fbclid=1&keep=yes#section"
    assert (
        canonical_capture_url(SourceType.article, raw)
        == "https://example.com/post?keep=yes"
    )


def test_article_without_url_has_no_identity() -> None:
    assert canonical_capture_url(SourceType.article, None) is None


def test_note_never_has_url_identity() -> None:
    assert canonical_capture_url(SourceType.note, "https://example.com/x") is None


def test_youtube_collapses_variants_to_watch_url() -> None:
    expected = "https://www.youtube.com/watch?v=dQw4w9wgCcc"
    variants = [
        "https://youtu.be/dQw4w9wgCcc?t=42",
        "https://www.youtube.com/watch?v=dQw4w9wgCcc&t=12s",
        "https://m.youtube.com/shorts/dQw4w9wgCcc",
        "https://www.youtube.com/embed/dQw4w9wgCcc",
    ]
    for url in variants:
        assert canonical_capture_url(SourceType.youtube, url) == expected
        assert youtube_video_id(url) == "dQw4w9wgCcc"


def test_youtube_feed_has_no_video_id() -> None:
    assert youtube_video_id("https://www.youtube.com/feed/subscriptions") is None


def test_ai_chat_uses_chatgpt_conversation_id() -> None:
    conv = "67abc-def"
    assert (
        canonical_capture_url(SourceType.ai_chat, f"https://chat.openai.com/c/{conv}")
        == f"https://chatgpt.com/c/{conv}"
    )
    assert (
        canonical_capture_url(
            SourceType.ai_chat, f"https://chatgpt.com/g/g-xyz/c/{conv}?model=gpt"
        )
        == f"https://chatgpt.com/c/{conv}"
    )
    assert chatgpt_conversation_id(f"https://chatgpt.com/c/{conv}") == conv


def test_ai_chat_homepage_has_no_identity() -> None:
    assert canonical_capture_url(SourceType.ai_chat, "https://chatgpt.com/") is None
    assert chatgpt_conversation_id("https://chatgpt.com/") is None


def test_lookup_urls_include_openai_host_variant() -> None:
    conv = "thread-1"
    urls = identity_lookup_urls(SourceType.ai_chat, f"https://chatgpt.com/c/{conv}")
    assert f"https://chatgpt.com/c/{conv}" in urls
    assert f"https://chat.openai.com/c/{conv}" in urls
