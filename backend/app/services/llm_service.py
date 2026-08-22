from __future__ import annotations

from anthropic import AsyncAnthropic

from app.config import Settings
from app.schemas.concepts import (
    MAX_CONCEPTS_PER_SOURCE,
    ExtractedConcept,
    ExtractedConcepts,
)

SUMMARY_SYSTEM_PROMPT = (
    "You summarize captured learning material for a student's personal knowledge "
    "base. Write a concise summary (150-250 words) covering the main ideas, key "
    "facts, and anything worth remembering. Plain prose, no headers or bullet lists."
)

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
