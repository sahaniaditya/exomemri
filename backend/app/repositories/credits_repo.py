"""Data access for the ``user_credits`` table and credit RPCs.

Uses the service-role client, so every call carries an explicit ``user_id``
as its authorization boundary. Consume/grant/ask go through Postgres functions
so two concurrent captures or chat turns cannot both pass a read-then-write
check.
"""

from __future__ import annotations

from supabase import Client


class CreditsRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def ensure(self, *, user_id: str) -> dict:
        """Insert defaults if missing and apply a due monthly reset."""
        return self._rpc_row("ensure_user_credits", {"p_user": user_id})

    def consume(self, *, user_id: str, amount: int) -> dict:
        """Atomic decrement. Returned dict includes ``ok`` (false if too low)."""
        return self._rpc_row(
            "consume_credits", {"p_user": user_id, "p_amount": amount}
        )

    def consume_ask(self, *, user_id: str) -> dict:
        """Atomic ask tally. Returned dict includes ``ok`` and ``consumed_credit``."""
        return self._rpc_row("consume_ask", {"p_user": user_id})

    def grant(self, *, user_id: str, amount: int) -> dict:
        """Add ``amount`` to balance (refunds and the payment hook)."""
        return self._rpc_row(
            "grant_credits", {"p_user": user_id, "p_amount": amount}
        )

    def set_ask_units(self, *, user_id: str, ask_units: int) -> None:
        self._client.table("user_credits").update({"ask_units": ask_units}).eq(
            "user_id", user_id
        ).execute()

    def set_allowance(
        self, *, user_id: str, monthly_allowance: int, refill: bool
    ) -> dict:
        """Change the monthly grant; optionally refill balance to match it."""
        self.ensure(user_id=user_id)
        patch: dict = {"monthly_allowance": monthly_allowance}
        if refill:
            patch["balance"] = monthly_allowance
            patch["ask_units"] = 0
        self._client.table("user_credits").update(patch).eq("user_id", user_id).execute()
        return self.ensure(user_id=user_id)

    def _rpc_row(self, fn: str, params: dict) -> dict:
        res = self._client.rpc(fn, params).execute()
        rows = res.data or []
        if not rows:
            raise RuntimeError(f"{fn} returned no row")
        return rows[0]
