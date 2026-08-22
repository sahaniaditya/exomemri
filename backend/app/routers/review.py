"""Daily review queue routes (thin: delegate to ReviewService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies import get_authenticated_app_user, get_review_service
from app.schemas.common import User
from app.schemas.review import ReviewItem, ReviewQueueResponse, ReviewRebuildResponse
from app.services.review_service import ReviewService

router = APIRouter(prefix="/spaces", tags=["review"])


@router.get("/{space_id}/review/today", response_model=ReviewQueueResponse)
def get_today_queue(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: ReviewService = Depends(get_review_service),
) -> ReviewQueueResponse:
    """Items due for review today in one space — the "study today" queue."""
    return svc.get_today_queue(user, space_id)


@router.post("/{space_id}/review/{item_id}/reviewed", response_model=ReviewItem)
def mark_item_reviewed(
    space_id: UUID,
    item_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: ReviewService = Depends(get_review_service),
) -> ReviewItem:
    return svc.mark_reviewed(user, space_id, item_id)


@router.post("/{space_id}/review/rebuild", response_model=ReviewRebuildResponse)
async def rebuild_review_items(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: ReviewService = Depends(get_review_service),
) -> ReviewRebuildResponse:
    """Generate review items for one bounded batch of unprocessed sources.

    New captures get items automatically once the pipeline's summary stage
    runs; this exists for sources captured before the queue shipped, and for
    retrying ones whose pipeline run failed. Bounded per call, so the client
    loops until ``pending`` is 0.
    """
    return await svc.backfill(user=user, space_id=space_id)
