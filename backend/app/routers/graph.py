"""Knowledge-map routes (thin: delegate to ConceptService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies import (
    enforce_rebuild_rate_limit,
    get_authenticated_app_user,
    get_concept_service,
)
from app.schemas.common import User
from app.schemas.concepts import RebuildResponse, SpaceGraphResponse
from app.services.concept_service import ConceptService

router = APIRouter(prefix="/spaces", tags=["graph"])


@router.get("/{space_id}/graph", response_model=SpaceGraphResponse)
def get_space_graph(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: ConceptService = Depends(get_concept_service),
) -> SpaceGraphResponse:
    """Every concept, source and edge in one space — the map's whole payload."""
    return svc.get_graph(user, space_id)


@router.post("/{space_id}/graph/rebuild", response_model=RebuildResponse)
async def rebuild_space_graph(
    space_id: UUID,
    user: User = Depends(enforce_rebuild_rate_limit),
    svc: ConceptService = Depends(get_concept_service),
) -> RebuildResponse:
    """Extract concepts for one bounded batch of not-yet-mapped sources.

    New captures are mapped automatically by the capture pipeline; this exists
    for sources captured before the map shipped, and for retrying ones whose
    pipeline run failed. Bounded per call, so the client loops until
    ``pending`` is 0.
    """
    return await svc.backfill(user=user, space_id=space_id)
