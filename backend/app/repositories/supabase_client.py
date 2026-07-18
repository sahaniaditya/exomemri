"""Central Supabase client construction for auth + profile access.

Storage keeps its own client in ``storage_repo`` (bucket-scoped); everything
that touches the ``profiles`` table, RPCs, or the Auth admin API goes through
here so the service key is created in exactly one place.

- ``get_service_client()``: long-lived, service-role. Privileged table/RPC access.
- ``get_auth_client()``: a fresh client per call, used ONLY to verify a user's
  JWT (``auth.get_user``) or sign in. Never shared, so it can't leak session
  state into the global client.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, ClientOptions, create_client

from app.config import get_settings


def _create() -> Client:
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key,
        options=ClientOptions(flow_type="pkce"),
    )


@lru_cache
def get_service_client() -> Client:
    return _create()


def get_auth_client() -> Client:
    return _create()
