"""Monthly credit quota.

Capture, coverage regen, and graph-rebuild batches consume one credit each;
Ask-this-capture consumes one credit every three user questions. The monthly
allowance resets leftovers to zero. Payment later calls :meth:`grant` /
:meth:`set_allowance`.
"""

from __future__ import annotations

import calendar
import logging
from datetime import UTC, datetime
from typing import Literal, NamedTuple

from app.errors import CreditsExhaustedError
from app.repositories.credits_repo import CreditsRepo
from app.schemas.credits import (
    DEFAULT_MONTHLY_ALLOWANCE,
    CreditsBalance,
)

logger = logging.getLogger(__name__)

CreditReason = Literal["capture", "coverage", "rebuild"]

_EXHAUSTED_MESSAGE = (
    "You're out of credits. Captures, coverage, mapping, and Ask questions "
    "unlock when your monthly allowance resets."
)


class AskCharge(NamedTuple):
    """Result of metering one Ask question, so a failed LLM call can roll back."""

    consumed_credit: bool
    previous_ask_units: int


def add_calendar_month(dt: datetime) -> datetime:
    """Advance ``dt`` by one calendar month, clamping the day if needed."""
    month = dt.month + 1
    year = dt.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _parse_dt(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


class CreditsService:
    def __init__(self, credits: CreditsRepo) -> None:
        self._credits = credits

    def get_balance(self, user_id: str) -> CreditsBalance:
        return self._to_balance(self._credits.ensure(user_id=user_id))

    def ensure_for_user(self, user_id: str) -> CreditsBalance:
        """Idempotent insert of the default monthly grant (onboarding + backfill)."""
        return self._to_balance(self._credits.ensure(user_id=user_id))

    def consume(self, user_id: str, *, reason: CreditReason, amount: int = 1) -> None:
        """Atomic debit. Raises if the user has fewer than ``amount`` credits."""
        row = self._credits.consume(user_id=user_id, amount=amount)
        if not row["ok"]:
            raise CreditsExhaustedError(
                _EXHAUSTED_MESSAGE,
                detail={"balance": row["balance"], "needed": amount},
            )
        logger.info(
            "credits_consumed",
            extra={"user_id": user_id, "reason": reason, "balance": row["balance"]},
        )

    def consume_capture(self, user_id: str) -> None:
        self.consume(user_id, reason="capture")

    def consume_ask(self, user_id: str) -> AskCharge:
        """Meter one user question. Raises if the user has no credits left."""
        row = self._credits.consume_ask(user_id=user_id)
        if not row["ok"]:
            raise CreditsExhaustedError(
                _EXHAUSTED_MESSAGE,
                detail={"balance": row["balance"], "needed": 1},
            )
        consumed = bool(row["consumed_credit"])
        if consumed:
            logger.info(
                "credits_consumed",
                extra={
                    "user_id": user_id,
                    "reason": "ask",
                    "balance": row["balance"],
                },
            )
        return AskCharge(
            consumed_credit=consumed,
            previous_ask_units=int(row["previous_ask_units"]),
        )

    def rollback_ask(self, user_id: str, charge: AskCharge) -> None:
        """Undo a :meth:`consume_ask` after the LLM/persist step fails."""
        if charge.consumed_credit:
            self._credits.grant(user_id=user_id, amount=1)
        self._credits.set_ask_units(user_id=user_id, ask_units=charge.previous_ask_units)

    def refund(self, user_id: str, amount: int = 1) -> None:
        self._credits.grant(user_id=user_id, amount=amount)

    def grant(self, user_id: str, amount: int) -> CreditsBalance:
        """Add credits (payment hook). Does not change the monthly allowance."""
        row = self._credits.grant(user_id=user_id, amount=amount)
        logger.info(
            "credits_granted",
            extra={"user_id": user_id, "amount": amount, "balance": row["balance"]},
        )
        return self._to_balance(row)

    def set_allowance(
        self, user_id: str, monthly_allowance: int, *, refill: bool = True
    ) -> CreditsBalance:
        """Payment hook: change the monthly grant, optionally refill this period."""
        row = self._credits.set_allowance(
            user_id=user_id, monthly_allowance=monthly_allowance, refill=refill
        )
        return self._to_balance(row)

    def _to_balance(self, row: dict) -> CreditsBalance:
        start = _parse_dt(row["period_start"])
        return CreditsBalance(
            balance=int(row["balance"]),
            monthly_allowance=int(row.get("monthly_allowance", DEFAULT_MONTHLY_ALLOWANCE)),
            ask_units=int(row["ask_units"]),
            period_end=add_calendar_month(start),
        )
