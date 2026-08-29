"""Coverage-per-space routes (thin: delegate to CoverageService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies import get_authenticated_app_user, get_coverage_service
from app.schemas.common import User
from app.schemas.coverage import CoverageResponse
from app.services.coverage_service import CoverageService

router = APIRouter(prefix="/spaces", tags=["coverage"])


@router.get("/{space_id}/coverage", response_model=CoverageResponse)
async def get_space_coverage(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: CoverageService = Depends(get_coverage_service),
) -> CoverageResponse:
    """The space's inferred syllabus and how much of it is covered.

    Cache-only: returns the last generated syllabus, or ``coverage_pct=None``
    if none exists yet. Generation is ``POST`` on this path (1 credit) or the
    capture pipeline's rate-limited refresh.
    """
    return await svc.get_coverage(user, space_id)


@router.post("/{space_id}/coverage", response_model=CoverageResponse)
async def regenerate_space_coverage(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: CoverageService = Depends(get_coverage_service),
) -> CoverageResponse:
    """Infer (or refresh) the space syllabus. Consumes one credit."""
    return await svc.regenerate(user, space_id)
