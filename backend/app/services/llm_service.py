from __future__ import annotations

from anthropic import AsyncAnthropic

from app.config import Settings
from app.schemas.concepts import (
    MAX_CONCEPTS_PER_SOURCE,
    ExtractedConcept,
    ExtractedConcepts,
)
from app.schemas.coverage import (
    MAX_SYLLABUS_TOPICS,
    MIN_SYLLABUS_TOPICS,
    SyllabusTopic,
    SyllabusTopics,
)
from app.schemas.sources import StructuredSummary
from app.services.pipeline.windows import join_for_reduce, split_for_llm
from app.services.space_service import slugify

SUMMARY_SYSTEM_PROMPT = (
    "You summarize captured learning material for a student's personal knowledge "
    "base. Write a concise summary (150-250 words) covering the main ideas, key "
    "facts, and anything worth remembering. Plain prose, no headers or bullet lists."
)

REDUCE_SUMMARY_SYSTEM_PROMPT = (
    "You merge partial summaries of one long learning source into a single concise "
    "summary (150-250 words). Cover the main ideas across all parts, key facts, and "
    "anything worth remembering. Plain prose, no headers or bullet lists. Do not "
    "mention that the material was split into parts."
)

STRUCTURED_SUMMARY_SYSTEM_PROMPT = """You summarize captured learning material for a \
student's personal knowledge base, broken into four sections:

- `tldr`: exactly 5 bullets, each one sentence, covering the main ideas in order of
  importance.
- `key_concepts`: 3-8 short noun phrases naming the subjects this material teaches
  (e.g. "consistent hashing", not "technology" or "this video"). This is a summary
  aid for the reader, not a request to canonicalize against any existing taxonomy.
- `examples`: 2-6 concrete examples, cases, or illustrations actually used in the
  material — not invented ones.
- `interview_points`: 3-6 questions or angles a reader could be quizzed on to check
  they understood this material.

Every bullet is a complete standalone sentence or phrase, no trailing punctuation
inconsistency, no markdown formatting inside the bullets themselves."""

CHAT_SYSTEM_PROMPT = """You are a study assistant helping the user understand a source \
they captured.
Source title: {title}
Source type: {type}

Summary of the source:
{summary}

Full extracted content (may be truncated):
{extract}

Answer using only this material. If the answer isn't in the source, say so
plainly rather than guessing."""


CONCEPT_SYSTEM_PROMPT = """You identify the concepts a piece of learning material \
actually teaches, for a knowledge map of a student's personal learning space.

Return between 1 and {max_concepts} concepts. Rules:

- A concept is a subject someone could study on its own — "consistent hashing",
  "TCP congestion control", "React server components". Not a vague theme
  ("technology", "best practices"), not the source's format ("tutorial",
  "podcast"), and not the author or brand unless the material is genuinely about
  them.
- Prefer the specific over the general. "HNSW indexes" beats "databases".
- `weight` is how central the concept is to THIS material: 1.0 for the main
  subject, ~0.3 for something mentioned in passing.
- Use the noun form, sentence case ("Load balancing", not "load balancers" or
  "LOAD BALANCING").

{vocabulary_block}"""

# Injected only when the space already has concepts. Reusing an existing label
# verbatim is what makes a second source on the same subject land on the SAME
# map node instead of creating a near-duplicate beside it.
VOCABULARY_BLOCK = """This learning space already contains the concepts listed \
below. If this material covers one of them, reuse that label EXACTLY as written \
rather than inventing a variant spelling, pluralization or synonym. Only coin a \
new label for a genuinely new subject.

Existing concepts:
{labels}"""

NO_VOCABULARY_BLOCK = "This is the first material mapped in this learning space."

SYLLABUS_SYSTEM_PROMPT = """You infer the implied syllabus for a personal learning \
space, and judge how much of it is already covered.

Given the space's stated goal (if any) and the concepts already captured in it,
infer between {min_topics} and {max_topics} topics a person would need to learn to
be considered proficient in this space's subject. Then, for each topic, set
`covered` to true only if the captured concepts already demonstrate it, false
otherwise.

Rules:
- Topics should be at the same level of specificity as the captured concepts
  (e.g. "Load balancing", not "Computer science" and not "Round-robin DNS
  weighting details").
- If a captured concept clearly satisfies an inferred topic, mark it covered —
  don't require an exact label match, just genuine topical overlap.
- With no goal stated, infer the syllabus from the subject the captured concepts
  already imply.
- Use the noun form, sentence case, matching the concept-labeling convention."""

SYLLABUS_GOAL_BLOCK = "The user's stated goal for this space: {goal_text}"
NO_SYLLABUS_GOAL_BLOCK = "No goal was stated for this space."


def merge_extracted_concepts(
    concepts: list[ExtractedConcept],
    *,
    limit: int = MAX_CONCEPTS_PER_SOURCE,
) -> list[ExtractedConcept]:
    """Collapse map-stage concept lists: one row per slug, highest weight wins."""
    by_slug: dict[str, ExtractedConcept] = {}
    for item in concepts:
        label = item.label.strip()
        slug = slugify(label)
        if not slug or slug == "space":
            continue
        existing = by_slug.get(slug)
        if existing is None or item.weight > existing.weight:
            by_slug[slug] = ExtractedConcept(label=label, weight=item.weight)
    ranked = sorted(by_slug.values(), key=lambda c: c.weight, reverse=True)
    return ranked[:limit]


class LLMService:
    def __init__(self, settings: Settings) -> None:
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model_name

    @property
    def model_name(self) -> str:
        return self._model

    async def summarize(self, *, title: str, extract: str) -> str:
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=500,
            system=SUMMARY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Title: {title}\n\n{extract}"}],
        )
        return resp.content[0].text.strip()

    async def summarize_document(self, *, title: str, extract: str) -> str:
        """Map-reduce prose summary so long extracts stay inside the prompt budget."""
        summary, _sections = await self.summarize_document_bundle(title=title, extract=extract)
        return summary

    async def summarize_structured_document(
        self, *, title: str, extract: str
    ) -> StructuredSummary:
        """Structured summary over the whole document via map-reduce."""
        _summary, sections = await self.summarize_document_bundle(title=title, extract=extract)
        return sections

    async def summarize_document_bundle(
        self, *, title: str, extract: str
    ) -> tuple[str, StructuredSummary]:
        """Prose + structured summary in one map-reduce pass.

        Long extracts are windowed once; part summaries feed both the reduce
        prose call and the structured call so we do not map the document twice.
        """
        windows = split_for_llm(extract)
        if not windows:
            summary = await self.summarize(title=title, extract="")
            sections = await self.summarize_structured(title=title, extract="")
            return summary, sections
        if len(windows) == 1:
            summary = await self.summarize(title=title, extract=windows[0])
            sections = await self.summarize_structured(title=title, extract=windows[0])
            return summary, sections

        part_summaries: list[str] = []
        total = len(windows)
        for i, window in enumerate(windows):
            part_summaries.append(
                await self.summarize(
                    title=f"{title} (part {i + 1}/{total})",
                    extract=window,
                )
            )
        combined = join_for_reduce(part_summaries)
        summary = await self._reduce_summary(title=title, part_summaries=part_summaries)
        sections = await self.summarize_structured(title=title, extract=combined)
        return summary, sections

    async def _reduce_summary(self, *, title: str, part_summaries: list[str]) -> str:
        combined = join_for_reduce(part_summaries)
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=500,
            system=REDUCE_SUMMARY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Title: {title}\n\n{combined}"}],
        )
        return resp.content[0].text.strip()

    async def summarize_structured(self, *, title: str, extract: str) -> StructuredSummary:
        """The 4-part TL;DR/key-concepts/examples/interview-points summary.

        Uses structured outputs, like ``extract_concepts``, so the bullet counts
        and shape are validated rather than parsed out of free-form prose.
        """
        resp = await self._client.messages.parse(
            model=self._model,
            max_tokens=1200,
            system=STRUCTURED_SUMMARY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Title: {title}\n\n{extract}"}],
            output_format=StructuredSummary,
        )
        return resp.parsed_output

    async def infer_syllabus_coverage(
        self, *, space_name: str, goal_text: str | None, concept_labels: list[str]
    ) -> list[SyllabusTopic]:
        """The implied syllabus for a space, with each topic's covered state.

        Uses structured outputs, like ``extract_concepts``, so the topic count
        and shape are validated rather than parsed out of free-form prose.
        """
        system = SYLLABUS_SYSTEM_PROMPT.format(
            min_topics=MIN_SYLLABUS_TOPICS, max_topics=MAX_SYLLABUS_TOPICS
        )
        goal_block = (
            SYLLABUS_GOAL_BLOCK.format(goal_text=goal_text) if goal_text else NO_SYLLABUS_GOAL_BLOCK
        )
        concepts_block = (
            "\n".join(f"- {label}" for label in sorted(concept_labels))
            if concept_labels
            else "No concepts have been captured in this space yet."
        )
        user_content = (
            f"Space: {space_name}\n{goal_block}\n\nCaptured concepts:\n{concepts_block}"
        )

        resp = await self._client.messages.parse(
            model=self._model,
            max_tokens=1200,
            system=system,
            messages=[{"role": "user", "content": user_content}],
            output_format=SyllabusTopics,
        )
        return resp.parsed_output.topics

    async def chat_reply(
        self, *, title: str, source_type: str, summary: str, extract: str, history: list[dict]
    ) -> str:
        system = CHAT_SYSTEM_PROMPT.format(
            title=title, type=source_type, summary=summary, extract=extract
        )

        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=800,
            system=system,
            messages=history,
        )
        return resp.content[0].text.strip()

    async def extract_concepts(
        self, *, title: str, extract: str, vocabulary: list[str]
    ) -> list[ExtractedConcept]:
        """The concepts this source teaches, canonicalized against ``vocabulary``.

        Uses structured outputs so the response is a validated object rather than
        prose that has to be parsed — a malformed extraction would otherwise be
        indistinguishable from a source that genuinely has no concepts.
        """
        vocabulary_block = (
            VOCABULARY_BLOCK.format(labels="\n".join(f"- {label}" for label in sorted(vocabulary)))
            if vocabulary
            else NO_VOCABULARY_BLOCK
        )
        system = CONCEPT_SYSTEM_PROMPT.format(
            max_concepts=MAX_CONCEPTS_PER_SOURCE, vocabulary_block=vocabulary_block
        )

        resp = await self._client.messages.parse(
            model=self._model,
            max_tokens=1000,
            system=system,
            messages=[{"role": "user", "content": f"Title: {title}\n\n{extract}"}],
            output_format=ExtractedConcepts,
        )
        return resp.parsed_output.concepts

    async def extract_concepts_document(
        self, *, title: str, extract: str, vocabulary: list[str]
    ) -> list[ExtractedConcept]:
        """Map-reduce concept extraction across LLM windows, then merge by slug."""
        windows = split_for_llm(extract)
        if not windows:
            return []
        if len(windows) == 1:
            return await self.extract_concepts(
                title=title, extract=windows[0], vocabulary=vocabulary
            )

        mapped: list[ExtractedConcept] = []
        total = len(windows)
        for i, window in enumerate(windows):
            mapped.extend(
                await self.extract_concepts(
                    title=f"{title} (part {i + 1}/{total})",
                    extract=window,
                    vocabulary=vocabulary,
                )
            )
        return merge_extracted_concepts(mapped)
