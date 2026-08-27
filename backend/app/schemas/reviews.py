"""Product-review contracts (profile submit + landing top-N).

Pydantic models here are the OpenAPI source of truth
(``extension/src/lib/types.ts`` is generated from them — never hand-edited).
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

TOP_REVIEWS_LIMIT = 5
MIN_REVIEW_BODY = 10
MAX_REVIEW_BODY = 1000


class UpsertReviewRequest(BaseModel):
    """Create or replace the caller's single product review."""

    rating: int = Field(ge=1, le=5)
    body: str = Field(min_length=MIN_REVIEW_BODY, max_length=MAX_REVIEW_BODY)


class ReviewResponse(BaseModel):
    """The authenticated user's own review row."""

    id: UUID
    rating: int = Field(ge=1, le=5)
    body: str
    created_at: str | None = None
    updated_at: str | None = None


class PublicReview(BaseModel):
    """A review shown on the marketing landing page."""

    rating: int = Field(ge=1, le=5)
    body: str
    full_name: str
    primary_role: str


class TopReviewsResponse(BaseModel):
    """Top reviews by rating for the public landing page."""

    items: list[PublicReview] = Field(default_factory=list)
