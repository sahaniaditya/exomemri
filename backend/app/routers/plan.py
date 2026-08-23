"""Study-plan routes (thin: delegate to PlanService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies import get_authenticated_app_user, get_plan_service
from app.schemas.common import User
from app.schemas.plan import StudyPlanResponse
from app.services.plan_service import PlanService

router = APIRouter(prefix="/spaces", tags=["plan"])


@router.get("/{space_id}/plan", response_model=StudyPlanResponse)
async def get_study_plan(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: PlanService = Depends(get_plan_service),
) -> StudyPlanResponse:
    """Uncovered coverage topics, sequenced as the next-to-study list.

    No new gap detection and nothing cached — composed fresh from coverage
    on every call.
    """
    return await svc.get_plan(user, space_id)
