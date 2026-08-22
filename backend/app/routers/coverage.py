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

    Generated on first read and cached; regenerated automatically once the
    space's mapped concepts change since the last generation.
    """
    return await svc.get_coverage(user, space_id)
