"""Credit-quota contracts.

Pydantic models here are the OpenAPI source of truth (``extension/src/lib/types.ts``
is generated from them — never hand-edited).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# Free-plan monthly grant. Payment later calls ``CreditsService.set_allowance``
# / ``grant`` rather than changing this constant.
DEFAULT_MONTHLY_ALLOWANCE = 100
ASKS_PER_CREDIT = 3


class CreditsBalance(BaseModel):
    """Remaining quota for the authenticated user."""

    balance: int = Field(ge=0)
    monthly_allowance: int = Field(gt=0)
    ask_units: int = Field(ge=0, le=ASKS_PER_CREDIT - 1)
    period_end: datetime
