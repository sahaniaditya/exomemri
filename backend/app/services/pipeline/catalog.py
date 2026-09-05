"""Pull topic names from the source text itself (numbered catalogs, not LLM labels)."""

from __future__ import annotations

import re

from app.schemas.sources import (
    MAX_TOPIC_DESCRIPTION_LENGTH,
    MAX_TOPIC_NAME_LENGTH,
    MAX_TOPICS_PER_SOURCE,
    TopicDescription,
)

_NUMBERED_HEADING = re.compile(
    rf"^(?:#{{1,6}}\s*)?(\d{{1,2}})\.\s+(.{{2,{MAX_TOPIC_NAME_LENGTH}}})\s*$"
)
_MIN_CATALOG_ITEMS = 3
_MIN_ITEM_BODY_CHARS = 40


def topics_from_source_catalog(extract: str) -> list[TopicDescription]:
    """Return topics copied from numbered items in the source, or ``[]``.

    A ChatGPT catalog like ``1. God Object`` … ``20. Speculative Generality``
    should become those names — not a parallel taxonomy the model invented.
    """
    sequences = _numbered_sequences(extract)
    if not sequences:
        return []
    primary = max(sequences, key=len)
    if len(primary) < _MIN_CATALOG_ITEMS:
        return []
    grounded = [item for item in primary if len(item.description) >= _MIN_ITEM_BODY_CHARS]
    if len(grounded) < _MIN_CATALOG_ITEMS:
        return []
    return grounded[:MAX_TOPICS_PER_SOURCE]


def _numbered_sequences(extract: str) -> list[list[TopicDescription]]:
    sequences: list[list[TopicDescription]] = []
    current: list[TopicDescription] = []
    expected = 1
    body_lines: list[str] = []

    def flush_body() -> None:
        if not current:
            return
        text = "\n".join(body_lines).strip()
        if text:
            last = current[-1]
            current[-1] = TopicDescription(
                name=last.name,
                description=text[:MAX_TOPIC_DESCRIPTION_LENGTH],
            )
        body_lines.clear()

    def start_sequence() -> None:
        nonlocal current, expected
        flush_body()
        if current:
            sequences.append(current)
        current = []
        expected = 1

    for raw_line in extract.splitlines():
        line = raw_line.strip()
        match = _NUMBERED_HEADING.match(line)
        if match:
            number = int(match.group(1))
            name = _clean_name(match.group(2))
            if not name:
                continue
            if number != expected:
                start_sequence()
                if number != 1:
                    expected = 1
                    continue
            flush_body()
            current.append(TopicDescription(name=name, description="."))
            expected = number + 1
            continue
        if current:
            body_lines.append(raw_line)

    flush_body()
    if current:
        sequences.append(current)
    return sequences


def _clean_name(name: str) -> str:
    cleaned = name.strip().strip("*").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:MAX_TOPIC_NAME_LENGTH]
