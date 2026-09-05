"""Canonical capture identity: same page/thread in a space is one source.

``content_hash`` still describes the bytes we stored. Identity URL is what
stops an updated article or a longer ChatGPT thread from minting a new row.
"""

from __future__ import annotations

import re
from urllib.parse import ParseResult, parse_qsl, urlencode, urlparse, urlunparse

from app.schemas.common import SourceType

_TRACKING_PARAMS = frozenset(
    {
        "fbclid",
        "gclid",
        "gclsrc",
        "dclid",
        "msclkid",
        "mc_cid",
        "mc_eid",
        "igshid",
        "twclid",
    }
)

# Mirrors extension/src/lib/youtube-url.ts — watch/shorts/live/embed ids.
_VIDEO_ID = re.compile(r"^[\w-]{6,32}$")
_YOUTUBE_PATH_PREFIXES = frozenset({"shorts", "live", "embed", "v"})
_CHATGPT_HOSTS = frozenset({"chatgpt.com", "chat.openai.com"})
_CHATGPT_CONV = re.compile(r"/c/([a-zA-Z0-9-]+)")


def canonical_capture_url(source_type: SourceType, url: str | None) -> str | None:
    """Stable URL used to recognize a recapture of the same page or thread.

    Returns None when the type has no URL identity (notes, ChatGPT before a
    conversation id exists) so callers fall back to content-hash matching.
    """
    if not url or source_type is SourceType.note:
        return None
    if source_type is SourceType.youtube:
        video_id = youtube_video_id(url)
        if video_id is not None:
            return f"https://www.youtube.com/watch?v={video_id}"
        return _canonical_page_url(url)
    if source_type is SourceType.ai_chat:
        conv_id = chatgpt_conversation_id(url)
        return f"https://chatgpt.com/c/{conv_id}" if conv_id else None
    return _canonical_page_url(url)


def identity_lookup_urls(source_type: SourceType, url: str | None) -> tuple[str, ...]:
    """URL values that may already be stored for this capture.

    Includes the canonical identity plus a few historical variants so a
    recapture still finds a row written before canonicalization landed.
    """
    identity = canonical_capture_url(source_type, url)
    if identity is None:
        return ()
    found: list[str] = [identity]
    if url and url not in found:
        found.append(url)
    if source_type is SourceType.ai_chat:
        conv_id = chatgpt_conversation_id(url)
        if conv_id is not None:
            alt = f"https://chat.openai.com/c/{conv_id}"
            if alt not in found:
                found.append(alt)
    return tuple(found)


def youtube_video_id(url: str) -> str | None:
    """Watch/shorts/live/embed video id, else None (feeds, channels, search)."""
    parsed = _parse(url)
    if parsed is None:
        return None
    host = _hostname(parsed)
    video_id: str | None = None
    if host == "youtu.be" or host.endswith(".youtu.be"):
        parts = [p for p in parsed.path.split("/") if p]
        video_id = parts[0] if parts else None
    elif host == "youtube.com" or host.endswith(".youtube.com"):
        qs = dict(parse_qsl(parsed.query, keep_blank_values=True))
        video_id = qs.get("v") or _youtube_id_from_path(parsed.path)
    if video_id and _VIDEO_ID.match(video_id):
        return video_id
    return None


def chatgpt_conversation_id(url: str | None) -> str | None:
    """ChatGPT thread id from ``/c/{id}``, including GPT-share URLs."""
    if not url:
        return None
    parsed = _parse(url)
    if parsed is None or _hostname(parsed) not in _CHATGPT_HOSTS:
        return None
    match = _CHATGPT_CONV.search(parsed.path)
    return match.group(1) if match else None


def _canonical_page_url(url: str) -> str | None:
    parsed = _parse(url)
    if parsed is None:
        return None
    host = (parsed.hostname or "").lower()
    if parsed.port and parsed.port not in (80, 443):
        netloc = f"{host}:{parsed.port}"
    else:
        netloc = host
    query = urlencode(
        [
            (key, value)
            for key, value in parse_qsl(parsed.query, keep_blank_values=True)
            if not _is_tracking_param(key)
        ],
        doseq=True,
    )
    path = parsed.path.rstrip("/") or "/"
    scheme = "https" if parsed.scheme in {"http", "https"} else parsed.scheme
    return urlunparse((scheme, netloc, path, "", query, ""))


def _is_tracking_param(name: str) -> bool:
    lower = name.lower()
    return lower in _TRACKING_PARAMS or lower.startswith("utm_")


def _youtube_id_from_path(pathname: str) -> str | None:
    parts = [p for p in pathname.split("/") if p]
    if len(parts) < 2:
        return None
    head, nxt = parts[0], parts[1]
    return nxt if head in _YOUTUBE_PATH_PREFIXES else None


def _hostname(parsed: ParseResult) -> str:
    host = (parsed.hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _parse(url: str) -> ParseResult | None:
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return None
    if not parsed.scheme or not parsed.netloc:
        return None
    return parsed
