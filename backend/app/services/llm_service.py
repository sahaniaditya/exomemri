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
from app.schemas.sources import (
    DETAILED_SUMMARY_EXTRACT_CHARS,
    MAX_SUBTOPIC_DESCRIPTION_LENGTH,
    MAX_SUBTOPICS_PER_TOPIC,
    MAX_TOPIC_DESCRIPTION_LENGTH,
    MAX_TOPICS_PER_SOURCE,
    DetailedStructuredSummaryOutput,
    StructuredSummary,
    StructuredSummaryOutput,
    SubtopicDescription,
    TopicDescription,
)
from app.services.pipeline.catalog import topics_from_source_catalog
from app.services.pipeline.windows import split_for_llm
from app.services.space_service import slugify

STRUCTURED_SUMMARY_SYSTEM_PROMPT = """You extract a structured learning record from \
captured material for a student's personal knowledge base. Return only the schema \
fields. This is not a short recap and not an abstract restated as one card.

Topics MUST come from the source itself. Copy names the source actually uses \
(headings, numbered items, named techniques). Do not invent a parallel taxonomy \
(e.g. do not replace the source's "God Object" / "Long Method" list with \
"Rigid code" / "Fragile code"). If a name is not in the source, it is not a topic.

If the source is a numbered or bulleted catalog, each named item is its own \
topic, in that order. A follow-up question in a chat is an additional topic \
under the name the source uses for it.

Never collapse a paper, article, or catalog into one topic named after the \
source title. Typical counts: as many catalog items as the source has (up to \
the schema cap); 5-8 for a paper; 2-4 only if the source is a short note.

Then fill every field from those topics:

- `topics`: one object per source topic, in teaching order. `name` is copied \
from the source — never the page title, never a synonym from training data. \
`description` is a summarized description of what THIS source taught about \
that topic (definitions, examples, code, problem/better, caveats) — not a \
one-sentence slogan. Typically 120-400 words when the source is rich on that \
item; include the source's own examples. Never truncate to stay short.
- `topics[].subtopics`: 2-6 named subtopics that THIS source actually covers \
inside that topic. Copy those names from the source too. Empty list if none.
- `key_concepts`: 3-10 short noun phrases copied from the source (the topic \
names plus important sub-concepts it used).
- `tldr`: 5-10 short takeaway bullets in teaching order, one per major topic \
where possible. One or two sentences each — the full writeup lives in \
`topics[].description` and `topics[].subtopics`.
- `examples`: 2-8 concrete examples actually used in the material — not \
invented. Tie each example to the topic it illustrates.

Every bullet is a complete standalone sentence or phrase, no markdown inside \
the strings themselves."""

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


def _unique_extend(dest: list[str], items: list[str], *, limit: int) -> None:
    seen = set(dest)
    for item in items:
        text = item.strip()
        if not text or text in seen:
            continue
        dest.append(text)
        seen.add(text)
        if len(dest) >= limit:
            return


def _merge_subtopics(
    existing: list[SubtopicDescription], incoming: list[SubtopicDescription]
) -> list[SubtopicDescription]:
    by_slug: dict[str, SubtopicDescription] = {}
    for sub in [*existing, *incoming]:
        name = sub.name.strip()
        slug = slugify(name)
        if not slug or slug == "space":
            continue
        prior = by_slug.get(slug)
        if prior is None:
            by_slug[slug] = SubtopicDescription(name=name, description=sub.description)
            continue
        combined = f"{prior.description}\n\n{sub.description}"
        if len(combined) > MAX_SUBTOPIC_DESCRIPTION_LENGTH:
            combined = combined[:MAX_SUBTOPIC_DESCRIPTION_LENGTH]
        by_slug[slug] = SubtopicDescription(name=prior.name, description=combined)
    return list(by_slug.values())[:MAX_SUBTOPICS_PER_TOPIC]


def merge_structured_summaries(parts: list[StructuredSummary]) -> StructuredSummary:
    """Collapse windowed structured summaries: one topic per slug, extras appended."""
    by_slug: dict[str, TopicDescription] = {}
    tldr: list[str] = []
    key_concepts: list[str] = []
    examples: list[str] = []
    for part in parts:
        for topic in part.topics:
            name = topic.name.strip()
            slug = slugify(name)
            if not slug or slug == "space":
                continue
            existing = by_slug.get(slug)
            if existing is None:
                by_slug[slug] = TopicDescription(
                    name=name,
                    description=topic.description,
                    subtopics=list(topic.subtopics),
                )
                continue
            combined = f"{existing.description}\n\n{topic.description}"
            if len(combined) > MAX_TOPIC_DESCRIPTION_LENGTH:
                combined = combined[:MAX_TOPIC_DESCRIPTION_LENGTH]
            by_slug[slug] = TopicDescription(
                name=existing.name,
                description=combined,
                subtopics=_merge_subtopics(existing.subtopics, topic.subtopics),
            )
        _unique_extend(tldr, part.tldr, limit=10)
        _unique_extend(key_concepts, part.key_concepts, limit=10)
        _unique_extend(examples, part.examples, limit=8)
    if not tldr:
        tldr = ["No takeaways were extracted."] * 5
    if not key_concepts:
        key_concepts = ["Untitled topic"]
    if not examples:
        examples = ["No examples were extracted."]
    return StructuredSummary(
        topics=list(by_slug.values())[:MAX_TOPICS_PER_SOURCE],
        tldr=tldr[:10],
        key_concepts=key_concepts[:10],
        examples=examples[:8],
    )


class LLMService:
    def __init__(self, settings: Settings) -> None:
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model_name

    @property
    def model_name(self) -> str:
        return self._model

    async def summarize(self, *, title: str, extract: str) -> str:
        sections = await self.summarize_structured(title=title, extract=extract)
        return sections.as_prose()

    async def summarize_document(self, *, title: str, extract: str) -> str:
        """Topic descriptions of the whole extract, flattened to prose."""
        summary, _sections = await self.summarize_document_bundle(title=title, extract=extract)
        return summary

    async def summarize_structured_document(
        self, *, title: str, extract: str
    ) -> StructuredSummary:
        """Structured topic descriptions over the whole document."""
        _summary, sections = await self.summarize_document_bundle(title=title, extract=extract)
        return sections

    async def summarize_document_bundle(
        self, *, title: str, extract: str
    ) -> tuple[str, StructuredSummary]:
        """Structured LLM output, then flattened prose for ``summary_text``.

        Long extracts are windowed so each parse stays inside the prompt budget.
        Windowed results are merged by topic name; descriptions are concatenated,
        not compressed.
        """
        windows = split_for_llm(extract)
        # Use the full document length, not the window, so a short blog still
        # has to return several topics instead of one title card.
        detailed = len(extract) >= DETAILED_SUMMARY_EXTRACT_CHARS
        if not windows:
            sections = await self.summarize_structured(
                title=title, extract="", detailed=False
            )
            return sections.as_prose(), sections

        total = len(windows)
        parts: list[StructuredSummary] = []
        for i, window in enumerate(windows):
            part_title = title if total == 1 else f"{title} (part {i + 1}/{total})"
            parts.append(
                await self.summarize_structured(
                    title=part_title, extract=window, detailed=detailed
                )
            )
        sections = parts[0] if len(parts) == 1 else merge_structured_summaries(parts)
        catalog = topics_from_source_catalog(extract)
        if catalog:
            sections = StructuredSummary(
                topics=catalog,
                tldr=sections.tldr,
                key_concepts=sections.key_concepts,
                examples=sections.examples,
            )
        return sections.as_prose(), sections

    async def summarize_structured(
        self, *, title: str, extract: str, detailed: bool | None = None
    ) -> StructuredSummary:
        """Topics with summarized descriptions, plus TL;DR / concepts / examples.

        Uses structured outputs, like ``extract_concepts``, so the shape is
        validated rather than parsed out of free-form prose. Long extracts
        must return several topics so a paper cannot collapse into one title card.
        """
        use_detailed = (
            detailed
            if detailed is not None
            else len(extract) >= DETAILED_SUMMARY_EXTRACT_CHARS
        )
        output_format: type[StructuredSummary] = (
            DetailedStructuredSummaryOutput if use_detailed else StructuredSummaryOutput
        )
        resp = await self._client.messages.parse(
            model=self._model,
            max_tokens=8192,
            system=STRUCTURED_SUMMARY_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Title: {title}\n\n"
                        "Use only topic names that appear in the source. "
                        "Do not invent a taxonomy.\n\n"
                        f"{extract}"
                    ),
                }
            ],
            output_format=output_format,
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
