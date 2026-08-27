"""Product reviews: one per user, public top-N by rating for marketing."""

from __future__ import annotations

import logging
from uuid import UUID

from app.errors import NotFoundError, ValidationError
from app.repositories.review_repo import ReviewRepo
from app.schemas.common import User
from app.schemas.reviews import (
    MAX_REVIEW_BODY,
    MIN_REVIEW_BODY,
    TOP_REVIEWS_LIMIT,
    PublicReview,
    ReviewResponse,
    TopReviewsResponse,
    UpsertReviewRequest,
)

logger = logging.getLogger(__name__)


class ReviewService:
    def __init__(self, reviews: ReviewRepo) -> None:
        self._reviews = reviews

    def get_mine(self, user: User) -> ReviewResponse:
        row = self._reviews.get_by_user(user_id=str(user.id))
        if not row:
            raise NotFoundError("Review not found.")
        return self._to_response(row)

    def upsert_mine(self, user: User, payload: UpsertReviewRequest) -> ReviewResponse:
        body = payload.body.strip()
        if len(body) < MIN_REVIEW_BODY or len(body) > MAX_REVIEW_BODY:
            raise ValidationError(
                f"Review must be between {MIN_REVIEW_BODY} and {MAX_REVIEW_BODY} characters."
            )
        row = self._reviews.upsert(
            user_id=str(user.id),
            rating=payload.rating,
            body=body,
        )
        logger.info(
            "product_review_upserted",
            extra={"user_id": str(user.id), "rating": payload.rating},
        )
        return self._to_response(row)

    def list_top(self, *, limit: int = TOP_REVIEWS_LIMIT) -> TopReviewsResponse:
        rows = self._reviews.list_top_by_rating(limit=limit)
        items: list[PublicReview] = []
        for row in rows:
            profile = row.get("profiles") or {}
            full_name = (profile.get("full_name") or "").strip()
            primary_role = (profile.get("primary_role") or "").strip()
            if not full_name or not primary_role:
                continue
            items.append(
                PublicReview(
                    rating=int(row["rating"]),
                    body=row["body"],
                    full_name=full_name,
                    primary_role=primary_role,
                )
            )
        return TopReviewsResponse(items=items)

    @staticmethod
    def _to_response(row: dict) -> ReviewResponse:
        return ReviewResponse(
            id=UUID(str(row["id"])),
            rating=int(row["rating"]),
            body=row["body"],
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
