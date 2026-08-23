"""Central Supabase client construction for auth + profile access.

Storage keeps its own client in ``storage_repo`` (bucket-scoped); everything
that touches the ``profiles`` table, RPCs, or the Auth admin API goes through
here so the service key is created in exactly one place.

- ``get_service_client()``: long-lived, service-role. Privileged table/RPC access.
- ``get_auth_client()``: a fresh client per call, used ONLY to verify a user's
  JWT (``auth.get_user``) or sign in. Never shared, so it can't leak session
  state into the global client.

PostgREST's default httpx client sets ``http2=True``. Under concurrent
threadpool requests (dashboard fan-out) that shared HTTP/2 connection is
often terminated by the edge (``RemoteProtocolError: ConnectionTerminated``).
We force HTTP/1.1 so each request gets its own pooled connection.
"""

from __future__ import annotations

from functools import lru_cache

import httpx
from supabase import Client, ClientOptions, create_client

from app.config import get_settings


def _client_options() -> ClientOptions:
    # http2=False is the whole point — do not share this Client across
    # create_client calls that need independent lifecycles; each Supabase
    # client owns the session we pass in.
    return ClientOptions(
        flow_type="pkce",
        httpx_client=httpx.Client(http2=False, follow_redirects=True),
    )


def _create() -> Client:
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key,
        options=_client_options(),
    )


@lru_cache
def get_service_client() -> Client:
    return _create()


def get_auth_client() -> Client:
    return _create()
