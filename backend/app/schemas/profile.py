"""Public learning profile contracts.

Like the other schema modules, these Pydantic models are the source of truth for
the OpenAPI schema, which generates the extension's TS types
(``extension/src/lib/types.ts`` — never hand-edited).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProfileVisibilityRequest(BaseModel):
    profile_public: bool


class ProfileVisibilityResponse(BaseModel):
    profile_public: bool


class PublicSpaceSummary(BaseModel):
    """A portfolio tile — counts only, never source titles, URLs, or content."""

    name: str
    coverage_pct: int | None
    source_count: int


class PublicProfileResponse(BaseModel):
    """The public-facing subset of a profile.

    Deliberately excludes anything onboarding-survey-shaped (``goal_text``,
    ``primary_role``, etc.) or content-level (concept labels, syllabus
    topics, source titles) — those stay at the sensitivity tier the
    read-only sharing feature already established for invited collaborators,
    not strangers.
    """

    username: str
    full_name: str = Field(min_length=1)
    current_streak: int
    longest_streak: int
    spaces: list[PublicSpaceSummary]
