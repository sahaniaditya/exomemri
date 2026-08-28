"""Unit tests for LLM map-reduce windowing."""

from __future__ import annotations

from app.services.pipeline.windows import (
    LLM_WINDOW_CHARS,
    LLM_WINDOW_OVERLAP_CHARS,
    MAX_LLM_WINDOWS,
    join_for_reduce,
    split_for_llm,
)


def test_short_text_is_a_single_window() -> None:
    assert split_for_llm("hello world") == ["hello world"]


def test_empty_text_yields_no_windows() -> None:
    assert split_for_llm("") == []
    assert split_for_llm("   \n") == []


def test_long_text_splits_with_overlap() -> None:
    text = "a" * (LLM_WINDOW_CHARS * 2 + 500)
    windows = split_for_llm(text)

    assert len(windows) >= 2
    assert all(len(w) <= LLM_WINDOW_CHARS for w in windows)
    # Overlap: end of first window should appear at the start of the second.
    overlap = windows[0][-LLM_WINDOW_OVERLAP_CHARS:]
    assert windows[1].startswith(overlap)


def test_max_windows_samples_evenly_including_ends() -> None:
    # Force more windows than the fan-out cap.
    text = "x" * (LLM_WINDOW_CHARS * (MAX_LLM_WINDOWS + 10))
    windows = split_for_llm(text, max_windows=MAX_LLM_WINDOWS)

    assert len(windows) == MAX_LLM_WINDOWS
    assert windows[0].startswith("x")
    assert windows[-1].endswith("x")


def test_join_for_reduce_numbers_parts_and_truncates() -> None:
    joined = join_for_reduce(["alpha", "beta"])
    assert "Part 1:\nalpha" in joined
    assert "Part 2:\nbeta" in joined

    huge_parts = ["y" * 30_000 for _ in range(3)]
    truncated = join_for_reduce(huge_parts, max_chars=10_000)
    assert len(truncated) == 10_000
