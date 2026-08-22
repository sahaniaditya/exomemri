"""Daily review queue contracts.

Like the other schema modules, these Pydantic models are the source of truth for
the OpenAPI schema, which generates the extension's TS types
(``extension/src/lib/types.ts`` — never hand-edited).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

# How many due items one "today" queue call returns. V2 scope is a plain
# staleness filter, not a spaced-repetition scheduler — see review_service.py.
DAILY_QUEUE_LIMIT = 20

# An item counts as due again once it's been this many days since its last
# review (or was never reviewed).
STALENESS_DAYS = 3


class ReviewItem(BaseModel):
    """One reviewable interview point, materialized from a source's summary."""

    id: UUID
    source_id: UUID
    source_title: str
    space_id: UUID
    prompt_text: str
    last_reviewed_at: datetime | None


class ReviewQueueResponse(BaseModel):
    items: list[ReviewItem]
    # How many more due items exist beyond what fit in this queue.
    total_pending: int


class ReviewRebuildResponse(BaseModel):
    """Outcome of one bounded backfill batch."""

    processed: int
    failed: int
    pending: int
