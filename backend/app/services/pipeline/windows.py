"""Split long extracts into LLM-sized windows for map-reduce processing.

Chunking (``chunking.py``) splits for embeddings/RAG. This module splits for
Anthropic calls so a multi-hour transcript or long article stays inside the
prompt budget while still covering the whole document.
"""

from __future__ import annotations

from app.services.extract_service import MAX_EXTRACT_CHARS

# Same budget as chat's extract fallback — one safe inline LLM call.
LLM_WINDOW_CHARS = MAX_EXTRACT_CHARS
# Carry a little context across boundaries so ideas aren't cut mid-thought.
LLM_WINDOW_OVERLAP_CHARS = 2_000
# Hard ceiling on map fan-out (~1M chars of content). Beyond this we sample
# evenly across the document (always keeping head + tail) so cost stays bounded.
MAX_LLM_WINDOWS = 25


def split_for_llm(
    text: str,
    *,
    window_chars: int = LLM_WINDOW_CHARS,
    overlap_chars: int = LLM_WINDOW_OVERLAP_CHARS,
    max_windows: int = MAX_LLM_WINDOWS,
) -> list[str]:
    """Return overlapping windows of ``window_chars``, or ``[text]`` if short.

    Empty/whitespace input yields ``[]``. Oversized documents are first split
    exhaustively, then thinned to ``max_windows`` by even sampling when needed.
    """
    text = text.strip()
    if not text:
        return []
    if len(text) <= window_chars:
        return [text]

    step = max(1, window_chars - overlap_chars)
    windows: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + window_chars, len(text))
        windows.append(text[start:end])
        if end >= len(text):
            break
        start += step

    if len(windows) <= max_windows:
        return windows
    return _sample_evenly(windows, max_windows)


def join_for_reduce(parts: list[str], *, max_chars: int = LLM_WINDOW_CHARS) -> str:
    """Join map outputs into a single reduce prompt, truncated if needed."""
    numbered = [f"Part {i + 1}:\n{part.strip()}" for i, part in enumerate(parts) if part.strip()]
    joined = "\n\n".join(numbered)
    if len(joined) <= max_chars:
        return joined
    return joined[:max_chars]


def _sample_evenly(windows: list[str], limit: int) -> list[str]:
    """Keep first + last and evenly spaced middles when over the fan-out cap."""
    if limit <= 1:
        return windows[:1]
    if len(windows) <= limit:
        return windows
    # Always include endpoints; fill the middle with evenly spaced indices.
    indices = {0, len(windows) - 1}
    inner_slots = limit - 2
    if inner_slots > 0:
        for i in range(1, inner_slots + 1):
            idx = round(i * (len(windows) - 1) / (inner_slots + 1))
            indices.add(idx)
    # If rounding collided, grow the set from unused indices until full.
    for idx in range(len(windows)):
        if len(indices) >= limit:
            break
        indices.add(idx)
    return [windows[i] for i in sorted(indices)[:limit]]
