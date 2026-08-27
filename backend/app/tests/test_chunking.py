"""Unit tests for the paragraph-aware chunker."""

from __future__ import annotations

from app.services.pipeline.chunking import CHUNK_CHARS, CHUNK_OVERLAP_CHARS, chunk_text


def test_empty_text_produces_no_chunks() -> None:
    assert chunk_text("") == []
    assert chunk_text("   \n\n  ") == []


def test_short_text_is_a_single_chunk() -> None:
    chunks = chunk_text("One short paragraph.")
    assert len(chunks) == 1
    assert chunks[0].index == 0
    assert chunks[0].content == "One short paragraph."


def test_paragraphs_pack_until_the_budget_then_split() -> None:
    # Each paragraph is well under CHUNK_CHARS; many of them together aren't.
    paragraph = "word " * 100  # ~500 chars
    text = "\n\n".join(paragraph for _ in range(10))

    chunks = chunk_text(text)

    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk.content) <= CHUNK_CHARS + CHUNK_OVERLAP_CHARS


def test_consecutive_chunks_overlap() -> None:
    paragraph = "word " * 100
    text = "\n\n".join(paragraph for _ in range(10))

    chunks = chunk_text(text)

    tail_of_first = chunks[0].content[-CHUNK_OVERLAP_CHARS:]
    assert tail_of_first in chunks[1].content


def test_oversized_single_paragraph_is_hard_cut() -> None:
    huge_paragraph = "x" * (CHUNK_CHARS * 3)

    chunks = chunk_text(huge_paragraph)

    assert len(chunks) > 1
    assert all(len(c.content) <= CHUNK_CHARS for c in chunks)
    # Reassembling without the carried-forward overlap recovers the source.
    assert chunks[0].content + "".join(
        c.content[CHUNK_OVERLAP_CHARS:] for c in chunks[1:]
    ) == huge_paragraph


def test_chunk_indices_are_sequential() -> None:
    text = "\n\n".join(f"Paragraph {i}." * 50 for i in range(8))
    chunks = chunk_text(text)
    assert [c.index for c in chunks] == list(range(len(chunks)))


def test_token_count_is_positive_and_roughly_length_over_four() -> None:
    chunks = chunk_text("a" * 400)
    assert chunks[0].token_count == 100
