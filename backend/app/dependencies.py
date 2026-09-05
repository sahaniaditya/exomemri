"""FastAPI dependency providers (DI seams for testing and Phase 2 auth swap)."""

from __future__ import annotations

from uuid import UUID

from fastapi import Depends, Header

from app.config import Settings, get_settings
from app.errors import AuthError
from app.rate_limit import get_rate_limiter
from app.repositories.chunk_repo import ChunkRepo
from app.repositories.collaborator_repo import CollaboratorRepo
from app.repositories.concept_repo import ConceptRepo
from app.repositories.coverage_repo import CoverageRepo
from app.repositories.credits_repo import CreditsRepo
from app.repositories.note_repo import NoteRepo
from app.repositories.profile_repo import ProfileRepo
from app.repositories.profile_settings_repo import ProfileSettingsRepo
from app.repositories.review_repo import ReviewRepo
from app.repositories.share_link_repo import ShareLinkRepo
from app.repositories.space_note_repo import SpaceNoteRepo
from app.repositories.space_repo import SpaceRepo
from app.repositories.storage_repo import StorageRepo, get_storage_repo
from app.repositories.supabase_client import get_auth_client, get_service_client
from app.schemas.auth import AuthUser
from app.schemas.common import User
from app.services.auth_service import AuthService
from app.services.capture_service import CaptureService
from app.services.concept_service import ConceptService
from app.services.coverage_service import CoverageService
from app.services.credits_service import CreditsService
from app.services.embedding_service import EmbeddingService
from app.services.extract_service import ExtractService
from app.services.llm_service import LLMService
from app.services.note_service import NoteService
from app.services.pipeline_service import PipelineService
from app.services.plan_service import PlanService
from app.services.profile_service import ProfileService
from app.services.rate_limit_service import RateLimitService
from app.services.review_service import ReviewService
from app.services.session_service import SessionService
from app.services.sharing_service import SharingService
from app.services.source_chat_service import SourceChatService
from app.services.space_service import SpaceService
from app.services.streak_service import StreakService


def get_space_repo() -> SpaceRepo:
    return SpaceRepo(get_service_client())


def get_collaborator_repo() -> CollaboratorRepo:
    return CollaboratorRepo(get_service_client())


def get_share_link_repo() -> ShareLinkRepo:
    return ShareLinkRepo(get_service_client())


def get_space_service(
    spaces: SpaceRepo = Depends(get_space_repo),
    collaborators: CollaboratorRepo = Depends(get_collaborator_repo),
    storage: StorageRepo = Depends(get_storage_repo),
) -> SpaceService:
    return SpaceService(spaces, collaborators, storage)


def get_session_service(
    spaces: SpaceRepo = Depends(get_space_repo),
    space_service: SpaceService = Depends(get_space_service),
) -> SessionService:
    return SessionService(spaces, space_service)


def get_profile_repo() -> ProfileRepo:
    return ProfileRepo(get_service_client())


def get_profile_settings_repo() -> ProfileSettingsRepo:
    return ProfileSettingsRepo(get_service_client())


def get_profile_service(
    profiles: ProfileRepo = Depends(get_profile_repo),
    settings: ProfileSettingsRepo = Depends(get_profile_settings_repo),
    spaces: SpaceRepo = Depends(get_space_repo),
) -> ProfileService:
    return ProfileService(profiles, settings, spaces)


def get_streak_service(
    profiles: ProfileRepo = Depends(get_profile_repo),
) -> StreakService:
    return StreakService(profiles)


def get_sharing_service(
    collaborators: CollaboratorRepo = Depends(get_collaborator_repo),
    space_service: SpaceService = Depends(get_space_service),
    profiles: ProfileRepo = Depends(get_profile_repo),
    share_links: ShareLinkRepo = Depends(get_share_link_repo),
) -> SharingService:
    return SharingService(collaborators, space_service, profiles, share_links)


def get_note_repo() -> NoteRepo:
    return NoteRepo(get_service_client())


def get_space_note_repo() -> SpaceNoteRepo:
    return SpaceNoteRepo(get_service_client())


def get_note_service(
    notes: NoteRepo = Depends(get_note_repo),
    space_notes: SpaceNoteRepo = Depends(get_space_note_repo),
    space_service: SpaceService = Depends(get_space_service),
    storage: StorageRepo = Depends(get_storage_repo),
    settings: Settings = Depends(get_settings),
) -> NoteService:
    return NoteService(notes, space_notes, space_service, storage, settings)


def get_credits_repo() -> CreditsRepo:
    return CreditsRepo(get_service_client())


def get_credits_service(
    credits: CreditsRepo = Depends(get_credits_repo),
) -> CreditsService:
    return CreditsService(credits)


def get_review_repo() -> ReviewRepo:
    return ReviewRepo(get_service_client())


def get_review_service(
    reviews: ReviewRepo = Depends(get_review_repo),
) -> ReviewService:
    return ReviewService(reviews)


# --- Auth (real Supabase JWT) ---


def get_auth_service(
    profiles: ProfileRepo = Depends(get_profile_repo),
    credits: CreditsService = Depends(get_credits_service),
) -> AuthService:
    return AuthService(profiles, get_service_client(), credits)


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


def enforce_capture_rate_limit(
    user: User = Depends(get_authenticated_app_user),
    limiter: RateLimitService = Depends(get_rate_limiter),
    settings: Settings = Depends(get_settings),
) -> User:
    limiter.check(
        f"capture:user:{user.id}",
        limit=settings.rate_limit_capture_max,
        window_seconds=settings.rate_limit_capture_window_seconds,
    )
    return user


def enforce_chat_rate_limit(
    user: User = Depends(get_authenticated_app_user),
    limiter: RateLimitService = Depends(get_rate_limiter),
    settings: Settings = Depends(get_settings),
) -> User:
    limiter.check(
        f"chat:user:{user.id}",
        limit=settings.rate_limit_chat_max,
        window_seconds=settings.rate_limit_chat_window_seconds,
    )
    return user


def enforce_rebuild_rate_limit(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    limiter: RateLimitService = Depends(get_rate_limiter),
    settings: Settings = Depends(get_settings),
) -> User:
    limiter.check(
        f"rebuild:space:{space_id}",
        limit=settings.rate_limit_rebuild_max,
        window_seconds=settings.rate_limit_rebuild_window_seconds,
    )
    return user


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
    credits: CreditsService = Depends(get_credits_service),
) -> SourceChatService:
    return SourceChatService(spaces, extracts, llm, embeddings, chunks, credits)

def get_concept_repo() -> ConceptRepo:
    return ConceptRepo(get_service_client())


def get_coverage_repo() -> CoverageRepo:
    return CoverageRepo(get_service_client())


def get_coverage_service(
    coverage: CoverageRepo = Depends(get_coverage_repo),
    concepts: ConceptRepo = Depends(get_concept_repo),
    spaces: SpaceService = Depends(get_space_service),
    llm: LLMService = Depends(get_llm_service),
    limiter: RateLimitService = Depends(get_rate_limiter),
    settings: Settings = Depends(get_settings),
    credits: CreditsService = Depends(get_credits_service),
) -> CoverageService:
    return CoverageService(coverage, concepts, spaces, llm, limiter, settings, credits)


def get_concept_service(
    concepts: ConceptRepo = Depends(get_concept_repo),
    spaces: SpaceService = Depends(get_space_service),
    extracts: ExtractService = Depends(get_extract_service),
    llm: LLMService = Depends(get_llm_service),
    credits: CreditsService = Depends(get_credits_service),
    coverage: CoverageService = Depends(get_coverage_service),
) -> ConceptService:
    return ConceptService(concepts, spaces, extracts, llm, credits, coverage)


def get_capture_service(
    settings: Settings = Depends(get_settings),
    storage: StorageRepo = Depends(get_storage_repo),
    space_service: SpaceService = Depends(get_space_service),
    streaks: StreakService = Depends(get_streak_service),
    concepts: ConceptService = Depends(get_concept_service),
    credits: CreditsService = Depends(get_credits_service),
) -> CaptureService:
    return CaptureService(settings, storage, space_service, streaks, concepts, credits)


def get_plan_service(
    coverage: CoverageService = Depends(get_coverage_service),
    spaces: SpaceService = Depends(get_space_service),
) -> PlanService:
    return PlanService(coverage, spaces)

def get_pipeline_service(
    concepts: ConceptService = Depends(get_concept_service),
    extracts: ExtractService = Depends(get_extract_service),
    embeddings: EmbeddingService = Depends(get_embedding_service),
    llm: LLMService = Depends(get_llm_service),
    chunks: ChunkRepo = Depends(get_chunk_repo),
    space_service: SpaceService = Depends(get_space_service),
    coverage: CoverageService = Depends(get_coverage_service),
) -> PipelineService:
    return PipelineService(
        concepts, extracts, embeddings, llm, chunks, space_service, coverage
    )