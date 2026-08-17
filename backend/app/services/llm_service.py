from __future__ import annotations

from anthropic import AsyncAnthropic

from app.config import Settings

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
