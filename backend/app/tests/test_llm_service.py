"""LLMService call-site tests: structured summary parse wiring.

Substitutes a recording Anthropic client on a real ``LLMService`` so the
parse kwargs are observable without a network call.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.config import get_settings
from app.schemas.sources import (
    DETAILED_SUMMARY_EXTRACT_CHARS,
    DetailedStructuredSummaryOutput,
    StructuredSummary,
    StructuredSummaryOutput,
    SubtopicDescription,
    TopicDescription,
    TopicDescriptionOutput,
)
from app.services.llm_service import (
    STRUCTURED_SUMMARY_SYSTEM_PROMPT,
    LLMService,
    merge_structured_summaries,
)


def _sample_sections() -> StructuredSummary:
    return StructuredSummary(
        topics=[
            TopicDescription(
                name="Raft leader election",
                description=(
                    "Leaders are chosen by randomized timeouts and a majority vote. "
                    "A candidate increments its term and requests votes from peers."
                ),
            )
        ],
        tldr=[f"point {i}" for i in range(5)],
        key_concepts=["a concept"],
        examples=["an example"],
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


def test_summary_prompt_asks_for_source_topic_names() -> None:
    lowered = STRUCTURED_SUMMARY_SYSTEM_PROMPT.lower()
    assert "150-250" not in STRUCTURED_SUMMARY_SYSTEM_PROMPT
    assert "summarized description" in lowered
    assert "source itself" in lowered
    assert "do not invent" in lowered
    assert "god object" in lowered


def test_structured_summary_as_prose_includes_subtopics() -> None:
    sections = StructuredSummary(
        topics=[
            TopicDescription(
                name="No Low Memory Resolver",
                description="NLMR skips onLowMemory so the process is killed under pressure.",
                subtopics=[
                    SubtopicDescription(
                        name="onLowMemory callback",
                        description="Android calls this when the system is low on memory.",
                    )
                ],
            )
        ],
        tldr=[f"point {i}" for i in range(5)],
        key_concepts=["NLMR"],
        examples=["an example"],
    )
    prose = sections.as_prose()
    assert prose.startswith("No Low Memory Resolver — ")
    assert "No Low Memory Resolver / onLowMemory callback — " in prose


def test_structured_summary_as_prose_joins_topic_descriptions() -> None:
    sections = _sample_sections()
    prose = sections.as_prose()
    assert prose.startswith("Raft leader election — ")
    assert "majority vote" in prose


def test_structured_summary_output_requires_at_least_one_topic() -> None:
    with pytest.raises(ValidationError):
        StructuredSummaryOutput(
            tldr=[f"point {i}" for i in range(5)],
            key_concepts=["a concept"],
            examples=["an example"],
        )


def test_structured_summary_as_prose_falls_back_to_tldr() -> None:
    sections = StructuredSummary(
        tldr=[f"point {i}" for i in range(5)],
        key_concepts=["a concept"],
        examples=["an example"],
    )
    assert sections.topics == []
    assert sections.as_prose() == "\n".join(sections.tldr)


def test_merge_structured_summaries_concatenates_same_topic() -> None:
    first = StructuredSummary(
        topics=[TopicDescription(name="Log replication", description="First window.")],
        tldr=[f"a{i}" for i in range(5)],
        key_concepts=["log replication"],
        examples=["example one"],
    )
    second = StructuredSummary(
        topics=[TopicDescription(name="Log replication", description="Second window.")],
        tldr=[f"b{i}" for i in range(5)],
        key_concepts=["log replication", "terms"],
        examples=["example two"],
    )
    merged = merge_structured_summaries([first, second])
    assert len(merged.topics) == 1
    assert merged.topics[0].description == "First window.\n\nSecond window."
    assert "terms" in merged.key_concepts
    assert "example two" in merged.examples


def test_merge_structured_summaries_merges_subtopics() -> None:
    first = StructuredSummary(
        topics=[
            TopicDescription(
                name="Slow Loop",
                description="First window.",
                subtopics=[
                    SubtopicDescription(
                        name="for-each vs indexed",
                        description="Indexed is faster.",
                    )
                ],
            )
        ],
        tldr=[f"a{i}" for i in range(5)],
        key_concepts=["slow loop"],
        examples=["example one"],
    )
    second = StructuredSummary(
        topics=[
            TopicDescription(
                name="Slow Loop",
                description="Second window.",
                subtopics=[
                    SubtopicDescription(
                        name="for-each vs indexed", description="Iterator allocation cost."
                    ),
                    SubtopicDescription(name="Battery Historian", description="Traces energy."),
                ],
            )
        ],
        tldr=[f"b{i}" for i in range(5)],
        key_concepts=["slow loop"],
        examples=["example two"],
    )
    merged = merge_structured_summaries([first, second])
    names = [sub.name for sub in merged.topics[0].subtopics]
    assert names == ["for-each vs indexed", "Battery Historian"]
    assert "Iterator allocation cost" in merged.topics[0].subtopics[0].description


def test_detailed_summary_output_rejects_fewer_than_four_topics() -> None:
    short = "A detailed finding. " * 20
    with pytest.raises(ValidationError):
        DetailedStructuredSummaryOutput(
            topics=[
                TopicDescriptionOutput(name="Only one", description=short),
            ],
            tldr=[f"point {i}" for i in range(5)],
            key_concepts=["a concept"],
            examples=["an example"],
        )


async def test_summarize_uses_structured_parse() -> None:
    service, recorder = _service_with_recorder()

    text = await service.summarize(title="Raft", extract="consensus notes")

    assert text == _sample_sections().as_prose()
    assert recorder.parse_calls
    assert recorder.parse_calls[0]["output_format"] is StructuredSummaryOutput


async def test_summarize_structured_uses_topic_schema_and_8192_token_budget() -> None:
    service, recorder = _service_with_recorder()

    sections = await service.summarize_structured(title="Raft", extract="consensus notes")

    assert sections == _sample_sections()
    assert len(recorder.parse_calls) == 1
    call = recorder.parse_calls[0]
    assert call["max_tokens"] == 8192
    assert call["system"] == STRUCTURED_SUMMARY_SYSTEM_PROMPT
    assert call["output_format"] is StructuredSummaryOutput


async def test_document_bundle_uses_detailed_schema_for_short_articles() -> None:
    service, recorder = _service_with_recorder()
    extract = "code smell " * 80
    assert DETAILED_SUMMARY_EXTRACT_CHARS <= len(extract) < 2500

    await service.summarize_document_bundle(title="Smells", extract=extract)

    assert recorder.parse_calls[0]["output_format"] is DetailedStructuredSummaryOutput


async def test_summarize_structured_uses_detailed_schema_for_long_extracts() -> None:
    service, recorder = _service_with_recorder()
    extract = "x" * DETAILED_SUMMARY_EXTRACT_CHARS

    await service.summarize_structured(title="Nature paper", extract=extract)

    assert recorder.parse_calls[0]["output_format"] is DetailedStructuredSummaryOutput
    assert "Do not invent a taxonomy" in recorder.parse_calls[0]["messages"][0]["content"]


async def test_document_bundle_prefers_numbered_catalog_names_from_source() -> None:
    service, recorder = _service_with_recorder()
    extract = """
1. God Object / God Class

One class does too much. Split into UserService, AuthService, and EmailService.

2. Long Method

A function becomes very large and handles many different steps in checkout.

3. Feature Envy

A method uses another object's data more than its own, so move the logic closer.

4. Primitive Obsession

Using primitive types where a meaningful domain object would be clearer.
"""
    _prose, sections = await service.summarize_document_bundle(title="Chat", extract=extract)

    assert [topic.name for topic in sections.topics] == [
        "God Object / God Class",
        "Long Method",
        "Feature Envy",
        "Primitive Obsession",
    ]
    assert recorder.parse_calls  # still fills tldr / examples
    assert "Rigid code" not in {topic.name for topic in sections.topics}
