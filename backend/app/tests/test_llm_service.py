"""LLMService call-site tests: summary token budgets and prompt wiring.

Substitutes a recording Anthropic client on a real ``LLMService`` so the
create/parse kwargs are observable without a network call.
"""

from __future__ import annotations

from types import SimpleNamespace

from app.config import get_settings
from app.schemas.sources import StructuredSummary
from app.services.llm_service import (
    REDUCE_SUMMARY_SYSTEM_PROMPT,
    STRUCTURED_SUMMARY_SYSTEM_PROMPT,
    SUMMARY_SYSTEM_PROMPT,
    LLMService,
)


def _sample_sections() -> StructuredSummary:
    return StructuredSummary(
        tldr=[f"point {i}" for i in range(5)],
        key_concepts=["a concept"],
        examples=["an example"],
        interview_points=["a question"],
    )


class _RecordingMessages:
    def __init__(self) -> None:
        self.create_calls: list[dict] = []
        self.parse_calls: list[dict] = []

    async def create(self, **kwargs):
        self.create_calls.append(kwargs)
        return SimpleNamespace(content=[SimpleNamespace(text="  detailed summary  ")])

    async def parse(self, **kwargs):
        self.parse_calls.append(kwargs)
        return SimpleNamespace(parsed_output=_sample_sections())


class _RecordingClient:
    def __init__(self) -> None:
        self.messages = _RecordingMessages()


def _service_with_recorder() -> tuple[LLMService, _RecordingMessages]:
    service = LLMService(get_settings())
    recorder = _RecordingMessages()
    service._client = _RecordingClient()
    service._client.messages = recorder
    return service, recorder


def test_summary_prompts_ask_for_detail_not_brevity() -> None:
    """The three summary prompts should request thorough writeups, not a short cap."""
    for prompt in (
        SUMMARY_SYSTEM_PROMPT,
        REDUCE_SUMMARY_SYSTEM_PROMPT,
        STRUCTURED_SUMMARY_SYSTEM_PROMPT,
    ):
        lowered = prompt.lower()
        assert "150-250" not in prompt
        assert "one-sentence" not in lowered
        assert "detailed" in lowered or "thorough" in lowered


async def test_summarize_uses_detailed_prompt_and_2000_token_budget() -> None:
    service, recorder = _service_with_recorder()

    text = await service.summarize(title="Raft", extract="consensus notes")

    assert text == "detailed summary"
    assert len(recorder.create_calls) == 1
    call = recorder.create_calls[0]
    assert call["max_tokens"] == 2000
    assert call["system"] == SUMMARY_SYSTEM_PROMPT


async def test_reduce_summary_uses_detailed_prompt_and_2500_token_budget() -> None:
    service, recorder = _service_with_recorder()

    text = await service._reduce_summary(
        title="Raft", part_summaries=["part one notes", "part two notes"]
    )

    assert text == "detailed summary"
    assert len(recorder.create_calls) == 1
    call = recorder.create_calls[0]
    assert call["max_tokens"] == 2500
    assert call["system"] == REDUCE_SUMMARY_SYSTEM_PROMPT


async def test_summarize_structured_uses_detailed_prompt_and_4096_token_budget() -> None:
    service, recorder = _service_with_recorder()

    sections = await service.summarize_structured(title="Raft", extract="consensus notes")

    assert sections == _sample_sections()
    assert len(recorder.parse_calls) == 1
    call = recorder.parse_calls[0]
    assert call["max_tokens"] == 4096
    assert call["system"] == STRUCTURED_SUMMARY_SYSTEM_PROMPT
    assert call["output_format"] is StructuredSummary
