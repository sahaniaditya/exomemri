"""FastAPI dependency providers (DI seams for testing and Phase 2 auth swap)."""

from __future__ import annotations

from uuid import UUID

from fastapi import Depends, Header

from app.config import Settings, get_settings
from app.errors import AuthError
from app.repositories.chunk_repo import ChunkRepo
from app.repositories.profile_repo import ProfileRepo
from app.repositories.space_repo import SpaceRepo
from app.repositories.storage_repo import StorageRepo, get_storage_repo
from app.repositories.supabase_client import get_auth_client, get_service_client
from app.schemas.auth import AuthUser
from app.schemas.common import User
from app.services.auth_service import AuthService
from app.services.capture_service import CaptureService
from app.services.embedding_service import EmbeddingService
from app.services.extract_service import ExtractService
from app.services.llm_service import LLMService
from app.services.pipeline_service import PipelineService
from app.services.session_service import SessionService
from app.services.source_chat_service import SourceChatService
from app.services.space_service import SpaceService


def get_space_repo() -> SpaceRepo:
    return SpaceRepo(get_service_client())


def get_space_service(
    spaces: SpaceRepo = Depends(get_space_repo),
) -> SpaceService:
    return SpaceService(spaces)


def get_session_service(
    spaces: SpaceRepo = Depends(get_space_repo),
    space_service: SpaceService = Depends(get_space_service),
) -> SessionService:
    return SessionService(spaces, space_service)


def get_capture_service(
    settings: Settings = Depends(get_settings),
    storage: StorageRepo = Depends(get_storage_repo),
    space_service: SpaceService = Depends(get_space_service),
) -> CaptureService:
    return CaptureService(settings, storage, space_service)


# --- Auth (real Supabase JWT) ---


def get_profile_repo() -> ProfileRepo:
    return ProfileRepo(get_service_client())


def get_auth_service(
    profiles: ProfileRepo = Depends(get_profile_repo),
) -> AuthService:
    return AuthService(profiles, get_service_client())


def get_bearer_token(authorization: str = Header(None)) -> str:
    """Extract the raw bearer token from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthError(
            "Missing or malformed Authorization header. Expected 'Bearer <JWT>'."
        )
    return authorization.split(" ", 1)[1]


def get_authenticated_user(token: str = Depends(get_bearer_token)) -> AuthUser:
    """Verify the caller's Supabase JWT and return the authenticated user.

    A fresh auth client is used per request so no session state is shared.
    """
    try:
        user = get_auth_client().auth.get_user(token).user
    except Exception as exc:  # noqa: BLE001 - normalize SDK/auth errors
        raise AuthError("Invalid or expired authentication session token.") from exc
    if user is None:
        raise AuthError("Invalid or expired authentication session token.")
    return AuthUser(id=user.id, email=user.email)


def get_authenticated_app_user(
    auth_user: AuthUser = Depends(get_authenticated_user),
) -> User:
    """Adapt the verified Supabase identity to the app's ``User`` model.

    The session and capture routes (and their services) are typed against
    ``User`` (UUID id); this maps the auth-layer ``AuthUser`` (string id) onto
    it so a real, verified user flows through unchanged.
    """
    return User(id=UUID(auth_user.id), email=auth_user.email)

def get_extract_service(storage: StorageRepo = Depends(get_storage_repo)) -> ExtractService:
    return ExtractService(storage)

def get_llm_service(settings: Settings = Depends(get_settings)) -> LLMService:
    return LLMService(settings)

def get_embedding_service(settings: Settings = Depends(get_settings)) -> EmbeddingService:
    return EmbeddingService(settings)

def get_chunk_repo() -> ChunkRepo:
    return ChunkRepo(get_service_client())

def get_source_chat_service(
    spaces: SpaceService = Depends(get_space_service),
    extracts: ExtractService = Depends(get_extract_service),
    llm: LLMService = Depends(get_llm_service),
    embeddings: EmbeddingService = Depends(get_embedding_service),
    chunks: ChunkRepo = Depends(get_chunk_repo),
) -> SourceChatService:
    return SourceChatService(spaces, extracts, llm, embeddings, chunks)

def get_pipeline_service(
    extracts: ExtractService = Depends(get_extract_service),
    embeddings: EmbeddingService = Depends(get_embedding_service),
    llm: LLMService = Depends(get_llm_service),
    chunks: ChunkRepo = Depends(get_chunk_repo),
    space_service: SpaceService = Depends(get_space_service),
) -> PipelineService:
    return PipelineService(extracts, embeddings, llm, chunks, space_service)