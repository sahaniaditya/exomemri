"""In-note AI assist tests (fake LLM, fake credits)."""

from __future__ import annotations

import logging
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.dependencies import get_credits_service, get_note_ai_service, get_space_service
from app.rate_limit import get_rate_limiter
from app.schemas.credits import ASKS_PER_CREDIT
from app.services.llm_service import LLMService
from app.services.note_ai_service import NoteAiService
from app.services.note_assist_prompts import (
    NOTE_ASSIST_ACTIONS,
    build_note_assist_system,
    build_note_assist_user,
)
from app.services.rate_limit_service import RateLimitService
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeCreditsRepo,
    FakeSpaceNoteRepo,
)

SPACE = SEEDED_SPACE_ID
DEV_USER = "00000000-0000-0000-0000-0000000000a1"
SECRET = "zebra-quartz-confidential-sentence"


class FakeAssistLLM:
    """Records note_assist calls; can be told to fail."""

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.fail: Exception | None = None
        self.reply = "assisted output"

    async def note_assist(
        self, *, action: str, text: str, instruction: str | None = None
    ) -> str:
        self.calls.append({"action": action, "text": text, "instruction": instruction})
        if self.fail:
            raise self.fail
        return self.reply


@pytest.fixture
def assist_llm() -> FakeAssistLLM:
    return FakeAssistLLM()


@pytest.fixture
def aclient(
    client: TestClient,
    assist_llm: FakeAssistLLM,
    space_note_repo: FakeSpaceNoteRepo,
) -> TestClient:
    svc = NoteAiService(
        client.app.dependency_overrides[get_space_service](),
        space_note_repo,  # type: ignore[arg-type]
        assist_llm,  # type: ignore[arg-type]
        client.app.dependency_overrides[get_credits_service](),
    )
    client.app.dependency_overrides[get_note_ai_service] = lambda: svc
    return client


def post(client: TestClient, body: dict, space: str = SPACE):  # noqa: ANN201
    return client.post(f"/v1/spaces/{space}/notes/ai", json=body)


@pytest.mark.parametrize("action", ["summarize", "rewrite", "expand", "continue"])
def test_each_action_reaches_llm_and_returns_text(
    aclient: TestClient, assist_llm: FakeAssistLLM, action: str
) -> None:
    resp = post(aclient, {"action": action, "text": "Some note text", "instruction": "shorter"})
    assert resp.status_code == 200
    assert resp.json() == {"text": "assisted output"}
    assert assist_llm.calls == [
        {"action": action, "text": "Some note text", "instruction": "shorter"}
    ]


def test_ask_requires_instruction(aclient: TestClient, assist_llm: FakeAssistLLM) -> None:
    assert post(aclient, {"action": "ask", "text": "ctx"}).status_code == 422
    assert post(aclient, {"action": "ask", "text": "ctx", "instruction": "  "}).status_code == 422
    assert assist_llm.calls == []
    ok = post(aclient, {"action": "ask", "text": "ctx", "instruction": "What is it?"})
    assert ok.status_code == 200
    assert assist_llm.calls[0]["instruction"] == "What is it?"


def test_input_limits(aclient: TestClient, assist_llm: FakeAssistLLM) -> None:
    assert post(aclient, {"action": "summarize", "text": "x" * 8000}).status_code == 200
    assert post(aclient, {"action": "summarize", "text": "x" * 8001}).status_code == 422
    assert post(aclient, {"action": "summarize", "text": ""}).status_code == 422
    assert post(aclient, {"action": "summarize", "text": "   "}).status_code == 422
    too_long = {"action": "rewrite", "text": "a", "instruction": "i" * 501}
    assert post(aclient, too_long).status_code == 422
    ok_long = {"action": "rewrite", "text": "a", "instruction": "i" * 500}
    assert post(aclient, ok_long).status_code == 200
    assert post(aclient, {"action": "translate", "text": "a"}).status_code == 422
    assert len(assist_llm.calls) == 2


def test_prompt_shape_per_action() -> None:
    actions = {"summarize", "rewrite", "expand", "continue", "ask"}
    assert set(NOTE_ASSIST_ACTIONS) == actions
    systems = {a: build_note_assist_system(a, None) for a in actions}
    assert len(set(systems.values())) == len(actions)
    assert "summarize" in systems["summarize"]
    assert "continuation" in systems["continue"]
    assert "make it formal" in build_note_assist_system("rewrite", "make it formal")
    assert "make it formal" not in build_note_assist_system("ask", "make it formal")
    assert build_note_assist_user("rewrite", "TEXT", "x") == "TEXT"
    ask_user = build_note_assist_user("ask", "TEXT", "Why?")
    assert "Why?" in ask_user
    assert "TEXT" in ask_user


@pytest.mark.anyio
async def test_llm_note_assist_sends_prompts_to_anthropic() -> None:
    llm = LLMService(get_settings())
    sent: dict = {}

    async def fake_create(**kwargs: object) -> SimpleNamespace:
        sent.update(kwargs)
        return SimpleNamespace(content=[SimpleNamespace(text="  out  ")])

    llm._client = SimpleNamespace(messages=SimpleNamespace(create=fake_create))  # type: ignore[assignment]
    out = await llm.note_assist(action="ask", text="CTX", instruction="Why?")
    assert out == "out"
    assert "answer the user's question" in sent["system"]
    assert sent["messages"] == [{"role": "user", "content": "Question: Why?\n\nText:\nCTX"}]
    assert sent["model"] == llm.model_name


def test_credit_charged_once_per_call(
    aclient: TestClient, credits_repo: FakeCreditsRepo
) -> None:
    credits_repo.ensure(user_id=DEV_USER)
    start = credits_repo.rows[DEV_USER]["balance"]
    for _ in range(ASKS_PER_CREDIT):
        assert post(aclient, {"action": "summarize", "text": "t"}).status_code == 200
    row = credits_repo.rows[DEV_USER]
    # Same metering as Ask: one credit per ASKS_PER_CREDIT calls, never more.
    assert row["balance"] == start - 1
    assert row["ask_units"] == 0
    assert post(aclient, {"action": "summarize", "text": "t"}).status_code == 200
    assert credits_repo.rows[DEV_USER]["ask_units"] == 1


def test_refunded_on_llm_failure(
    aclient: TestClient, assist_llm: FakeAssistLLM, credits_repo: FakeCreditsRepo
) -> None:
    credits_repo.ensure(user_id=DEV_USER)
    credits_repo.rows[DEV_USER]["ask_units"] = ASKS_PER_CREDIT - 1  # next call costs a credit
    before = dict(credits_repo.rows[DEV_USER])
    assist_llm.fail = RuntimeError("anthropic down")
    safe = TestClient(aclient.app, raise_server_exceptions=False)
    resp = post(safe, {"action": "summarize", "text": "t"})
    assert resp.status_code == 500
    after = credits_repo.rows[DEV_USER]
    assert after["balance"] == before["balance"]
    assert after["ask_units"] == before["ask_units"]


def test_insufficient_credits_matches_chat_status(
    aclient: TestClient, assist_llm: FakeAssistLLM, credits_repo: FakeCreditsRepo
) -> None:
    credits_repo.ensure(user_id=DEV_USER)
    credits_repo.rows[DEV_USER]["balance"] = 0
    resp = post(aclient, {"action": "summarize", "text": "t"})
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "credits_exhausted"
    assert assist_llm.calls == []
    assert credits_repo.rows[DEV_USER]["balance"] == 0


def test_rate_limited_like_chat(aclient: TestClient, assist_llm: FakeAssistLLM) -> None:
    limit = get_settings().rate_limit_chat_max
    limiter = RateLimitService()
    aclient.app.dependency_overrides[get_rate_limiter] = lambda: limiter
    # Leave plenty of credits so only the limiter can stop the loop.
    for _ in range(limit):
        assert post(aclient, {"action": "summarize", "text": "t"}).status_code == 200
    resp = post(aclient, {"action": "summarize", "text": "t"})
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "rate_limited"
    assert len(assist_llm.calls) == limit


def test_unknown_and_foreign_space_denied_without_charge(
    aclient: TestClient, assist_llm: FakeAssistLLM, credits_repo: FakeCreditsRepo
) -> None:
    credits_repo.ensure(user_id=DEV_USER)
    before = dict(credits_repo.rows[DEV_USER])
    body = {"action": "summarize", "text": "t"}
    assert post(aclient, body, space=str(uuid4())).status_code == 404
    assert post(aclient, body, space=OTHER_USER_SPACE_ID).status_code == 404
    assert assist_llm.calls == []
    assert credits_repo.rows[DEV_USER] == before


def test_note_id_must_belong_to_space(
    aclient: TestClient, assist_llm: FakeAssistLLM, space_note_repo: FakeSpaceNoteRepo
) -> None:
    mine = aclient.post(f"/v1/spaces/{SPACE}/notes", json={}).json()["id"]
    assert post(aclient, {"action": "summarize", "text": "t", "note_id": mine}).status_code == 200
    ghost = str(uuid4())
    assert post(aclient, {"action": "summarize", "text": "t", "note_id": ghost}).status_code == 404
    foreign = str(uuid4())
    space_note_repo.insert(
        note_id=foreign,
        space_id=OTHER_USER_SPACE_ID,
        user_id="00000000-0000-0000-0000-0000000000ff",
        title="theirs",
        content={"type": "doc"},
        sort_order=0,
    )
    resp = post(aclient, {"action": "summarize", "text": "t", "note_id": foreign})
    assert resp.status_code == 404
    assert len(assist_llm.calls) == 1


def test_note_text_is_never_logged(
    aclient: TestClient, assist_llm: FakeAssistLLM, caplog: pytest.LogCaptureFixture
) -> None:
    assist_llm.reply = "reply-" + SECRET[::-1]
    with caplog.at_level(logging.DEBUG):
        resp = post(aclient, {"action": "ask", "text": SECRET, "instruction": "q-" + SECRET})
    assert resp.status_code == 200
    blob = " ".join(f"{r.getMessage()} {r.__dict__}" for r in caplog.records)
    assert SECRET not in blob
    assert SECRET[::-1] not in blob
    assert any(r.getMessage() == "note_ai_assist" for r in caplog.records)
