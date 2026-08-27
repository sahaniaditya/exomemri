"""Product review routes (own review + public top-N for landing)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_authenticated_app_user, get_review_service
from app.schemas.common import User
from app.schemas.reviews import (
    ReviewResponse,
    TopReviewsResponse,
    UpsertReviewRequest,
)
from app.services.review_service import ReviewService

router = APIRouter(prefix="/reviews", tags=["reviews"])
# Deliberately with no auth dependency — the public top-N read for the
# marketing landing page. Own-review routes stay on ``router``.
public_router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/me", response_model=ReviewResponse)
def get_my_review(
    user: User = Depends(get_authenticated_app_user),
    svc: ReviewService = Depends(get_review_service),
) -> ReviewResponse:
    return svc.get_mine(user)


@router.put("/me", response_model=ReviewResponse)
def upsert_my_review(
    body: UpsertReviewRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: ReviewService = Depends(get_review_service),
) -> ReviewResponse:
    return svc.upsert_mine(user, body)


@public_router.get("/top", response_model=TopReviewsResponse)
def list_top_reviews(
    svc: ReviewService = Depends(get_review_service),
) -> TopReviewsResponse:
    """Highest-rated product reviews. No authentication required."""
    return svc.list_top()
