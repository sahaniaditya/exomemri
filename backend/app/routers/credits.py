"""Credit-quota routes (thin: delegate to CreditsService)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_authenticated_app_user, get_credits_service
from app.schemas.common import User
from app.schemas.credits import CreditsBalance
from app.services.credits_service import CreditsService

router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("", response_model=CreditsBalance)
def get_credits(
    user: User = Depends(get_authenticated_app_user),
    svc: CreditsService = Depends(get_credits_service),
) -> CreditsBalance:
    return svc.get_balance(str(user.id))
