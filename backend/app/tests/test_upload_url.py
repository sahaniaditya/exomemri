"""Pre-signed upload URL tests (POST /v1/sources/upload-url)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.tests.conftest import FakeCreditsRepo, FakeStorage

DEV_USER = "00000000-0000-0000-0000-0000000000a1"
SPACE = "00000000-0000-0000-0000-0000000000b1"


def test_upload_url_mints_source_writes_meta_and_returns_absolute_url(
    client: TestClient, storage: FakeStorage
) -> None:
    resp = client.post(
        "/v1/sources/upload-url",
        json={
            "space_id": SPACE,
            "title": "paper.pdf",
            "url": "https://example.com/paper.pdf",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    source_id = body["source_id"]
    expected_path = f"users/{DEV_USER}/spaces/{SPACE}/sources/{source_id}/original.pdf"

    assert body["path"] == expected_path
    assert body["token"] == "faketoken"
    # Absolute URL built from SUPABASE_URL + the tokenized signed path.
    assert body["upload_url"].startswith("https://test.supabase.co/storage/v1")
    assert "token=faketoken" in body["upload_url"]

    # meta.json written; signed URL requested for the pdf object path.
    meta_key = f"users/{DEV_USER}/spaces/{SPACE}/sources/{source_id}/raw/meta.json"
    assert meta_key in storage.uploads
    assert expected_path in storage.signed_urls


def test_upload_url_returns_402_when_out_of_credits(
    client: TestClient, credits_repo: FakeCreditsRepo, storage: FakeStorage
) -> None:
    credits_repo.ensure(user_id=DEV_USER)
    credits_repo.rows[DEV_USER]["balance"] = 0
    resp = client.post(
        "/v1/sources/upload-url",
        json={
            "space_id": SPACE,
            "title": "paper.pdf",
            "url": "https://example.com/paper.pdf",
        },
    )
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "credits_exhausted"
    assert storage.uploads == {}
