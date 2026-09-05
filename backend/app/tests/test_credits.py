"""Credit quota: grant, monthly reset, capture/ask consume, 402 at zero."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.errors import CreditsExhaustedError, StorageError
from app.schemas.credits import DEFAULT_MONTHLY_ALLOWANCE
from app.services.credits_service import CreditsService
from app.tests.conftest import SEEDED_SPACE_ID, FakeCreditsRepo, FakeStorage

DEV_USER = "00000000-0000-0000-0000-0000000000a1"
SPACE = SEEDED_SPACE_ID


def _article_payload(**overrides: object) -> dict:
    body: dict = {
        "space_id": SPACE,
        "type": "article",
        "url": "https://example.com/post",
        "title": "Post",
        "content": "cleaned article text",
    }
    body.update(overrides)
    return body


def test_get_credits_returns_the_default_monthly_grant(client: TestClient) -> None:
    resp = client.get("/v1/credits")
    assert resp.status_code == 200
    body = resp.json()
    assert body["balance"] == DEFAULT_MONTHLY_ALLOWANCE
    assert body["monthly_allowance"] == DEFAULT_MONTHLY_ALLOWANCE
    assert body["ask_units"] == 0
    assert body["period_end"]


def test_grant_adds_to_balance() -> None:
    repo = FakeCreditsRepo()
    svc = CreditsService(repo)  # type: ignore[arg-type]
    svc.ensure_for_user(DEV_USER)
    result = svc.grant(DEV_USER, 25)
    assert result.balance == DEFAULT_MONTHLY_ALLOWANCE + 25


def test_set_allowance_refills_the_period() -> None:
    repo = FakeCreditsRepo()
    svc = CreditsService(repo)  # type: ignore[arg-type]
    svc.consume_capture(DEV_USER)
    result = svc.set_allowance(DEV_USER, 250)
    assert result.monthly_allowance == 250
    assert result.balance == 250
    assert result.ask_units == 0


def test_monthly_reset_replaces_leftover_balance() -> None:
    repo = FakeCreditsRepo()
    svc = CreditsService(repo)  # type: ignore[arg-type]
    svc.ensure_for_user(DEV_USER)
    repo.rows[DEV_USER]["balance"] = 5
    repo.rows[DEV_USER]["ask_units"] = 2
    repo.rows[DEV_USER]["period_start"] = (
        datetime.now(UTC) - timedelta(days=40)
    ).isoformat()

    balance = svc.get_balance(DEV_USER)
    assert balance.balance == DEFAULT_MONTHLY_ALLOWANCE
    assert balance.ask_units == 0


def test_capture_consumes_one_credit(
    client: TestClient, credits_repo: FakeCreditsRepo
) -> None:
    resp = client.post("/v1/sources", json=_article_payload())
    assert resp.status_code == 202
    assert credits_repo.rows[DEV_USER]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 1


def test_recapture_of_the_same_hash_is_free(
    client: TestClient, credits_repo: FakeCreditsRepo
) -> None:
    payload = _article_payload()
    first = client.post("/v1/sources", json=payload)
    second = client.post("/v1/sources", json={**payload, "title": "Post (v2)"})
    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["source_id"] == second.json()["source_id"]
    assert credits_repo.rows[DEV_USER]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 1


def test_recapture_of_the_same_url_with_new_content_is_free(
    client: TestClient, credits_repo: FakeCreditsRepo
) -> None:
    first = client.post("/v1/sources", json=_article_payload(content="first body"))
    second = client.post(
        "/v1/sources",
        json=_article_payload(title="Post (v2)", content="updated body"),
    )
    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["source_id"] == second.json()["source_id"]
    assert credits_repo.rows[DEV_USER]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 1


def test_pdf_upload_url_consumes_one_credit(
    client: TestClient, credits_repo: FakeCreditsRepo
) -> None:
    resp = client.post(
        "/v1/sources/upload-url",
        json={"space_id": SPACE, "title": "paper.pdf", "url": "https://example.com/p.pdf"},
    )
    assert resp.status_code == 200
    assert credits_repo.rows[DEV_USER]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 1


def test_failed_capture_refunds_the_credit(
    client: TestClient, storage: FakeStorage, credits_repo: FakeCreditsRepo
) -> None:
    async def boom(*_args: object, **_kwargs: object) -> None:
        raise StorageError("Failed to write artifact to storage")

    storage.upload_text = boom  # type: ignore[method-assign]
    resp = client.post("/v1/sources", json=_article_payload())
    assert resp.status_code == 502
    assert credits_repo.rows[DEV_USER]["balance"] == DEFAULT_MONTHLY_ALLOWANCE


def test_capture_returns_402_when_credits_are_exhausted(
    client: TestClient, credits_repo: FakeCreditsRepo, storage: FakeStorage
) -> None:
    credits_repo.ensure(user_id=DEV_USER)
    credits_repo.rows[DEV_USER]["balance"] = 0
    resp = client.post("/v1/sources", json=_article_payload(url="https://example.com/x"))
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "credits_exhausted"
    assert storage.uploads == {}


def test_consume_ask_charges_on_the_third_question() -> None:
    repo = FakeCreditsRepo()
    svc = CreditsService(repo)  # type: ignore[arg-type]
    first = svc.consume_ask(DEV_USER)
    second = svc.consume_ask(DEV_USER)
    third = svc.consume_ask(DEV_USER)
    assert first.consumed_credit is False
    assert second.consumed_credit is False
    assert third.consumed_credit is True
    assert repo.rows[DEV_USER]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 1
    assert repo.rows[DEV_USER]["ask_units"] == 0


def test_consume_ask_debits_and_resets_units_together() -> None:
    """Third ask must mutate balance and ask_units in one repo call (H4)."""
    repo = FakeCreditsRepo()
    svc = CreditsService(repo)  # type: ignore[arg-type]
    svc.ensure_for_user(DEV_USER)
    repo.rows[DEV_USER]["ask_units"] = 2

    def _must_not_split(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("consume_ask must not call consume or set_ask_units")

    repo.consume = _must_not_split  # type: ignore[method-assign]
    repo.set_ask_units = _must_not_split  # type: ignore[method-assign]

    charge = svc.consume_ask(DEV_USER)
    assert charge.consumed_credit is True
    assert charge.previous_ask_units == 2
    assert repo.rows[DEV_USER]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 1
    assert repo.rows[DEV_USER]["ask_units"] == 0


def test_consume_ask_at_zero_balance_raises() -> None:
    repo = FakeCreditsRepo()
    svc = CreditsService(repo)  # type: ignore[arg-type]
    svc.ensure_for_user(DEV_USER)
    repo.rows[DEV_USER]["balance"] = 0
    try:
        svc.consume_ask(DEV_USER)
    except CreditsExhaustedError as exc:
        assert exc.detail == {"balance": 0, "needed": 1}
    else:
        raise AssertionError("expected CreditsExhaustedError")


def test_rollback_ask_restores_tally_and_credit() -> None:
    repo = FakeCreditsRepo()
    svc = CreditsService(repo)  # type: ignore[arg-type]
    svc.consume_ask(DEV_USER)
    svc.consume_ask(DEV_USER)
    charge = svc.consume_ask(DEV_USER)
    assert charge.consumed_credit is True
    svc.rollback_ask(DEV_USER, charge)
    assert repo.rows[DEV_USER]["balance"] == DEFAULT_MONTHLY_ALLOWANCE
    assert repo.rows[DEV_USER]["ask_units"] == 2


def test_consume_logs_reason_and_debits() -> None:
    repo = FakeCreditsRepo()
    svc = CreditsService(repo)  # type: ignore[arg-type]
    svc.consume(DEV_USER, reason="coverage")
    assert repo.rows[DEV_USER]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 1
    svc.consume_capture(DEV_USER)
    assert repo.rows[DEV_USER]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 2
