"""Paragraph-aware chunking for the RAG pipeline.

Not tiktoken: it encodes for OpenAI's BPE vocabularies, which don't match
the embedding model's tokenizer, so a tiktoken count would just be a
wrong-but-precise-looking number. ``token_count`` here is a rough
``len // 4`` estimate for observability only — never a scheduling constraint.
"""

from __future__ import annotations

from dataclasses import dataclass

CHUNK_CHARS = 1_800
CHUNK_OVERLAP_CHARS = 200


@dataclass(frozen=True)
class Chunk:
    index: int
    content: str
    token_count: int


def _approx_token_count(text: str) -> int:
    return max(1, len(text) // 4)


def chunk_text(text: str) -> list[Chunk]:
    """Split on paragraph boundaries, packing up to ``CHUNK_CHARS`` per chunk.

    Consecutive chunks overlap by the trailing ``CHUNK_OVERLAP_CHARS`` of the
    previous chunk so an answer whose evidence straddles a boundary isn't
    split across two chunks with no shared context. A single paragraph that
    alone exceeds the budget is hard-cut rather than left as one giant chunk.
    """
    text = text.strip()
    if not text:
        return []

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buffer = ""

    for paragraph in paragraphs:
        candidate = f"{buffer}\n\n{paragraph}" if buffer else paragraph
        if len(candidate) <= CHUNK_CHARS:
            buffer = candidate
            continue

        if buffer:
            chunks.append(buffer)
            overlap = buffer[-CHUNK_OVERLAP_CHARS:]
            buffer = f"{overlap}\n\n{paragraph}"
        else:
            buffer = paragraph

        # A single paragraph (plus overlap) can still exceed the budget —
        # hard-cut it into CHUNK_CHARS-sized pieces, carrying the overlap
        # forward into the next piece.
        while len(buffer) > CHUNK_CHARS:
            chunks.append(buffer[:CHUNK_CHARS])
            buffer = buffer[CHUNK_CHARS - CHUNK_OVERLAP_CHARS :]

    if buffer:
        chunks.append(buffer)

    return [
        Chunk(index=i, content=content, token_count=_approx_token_count(content))
        for i, content in enumerate(chunks)
    ]
