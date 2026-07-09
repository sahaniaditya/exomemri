# app/schemas/auth.py
from pydantic import BaseModel, EmailStr, Field

class UserSignup(BaseModel):
    """Validates incoming payload when a user registers with email/password."""
    email: EmailStr = Field(
        ..., 
        description="A valid, lowercase electronic mail address string.",
        examples=["user@atlas-app.com"]
    )
    password: str = Field(
        ..., 
        min_length=6, 
        max_length=100,
        description="Password string must be a minimum of 6 characters long for security compliance."
    )

class UserLogin(BaseModel):
    """Validates incoming payload when a user signs in."""
    email: EmailStr = Field(
        ...,
        examples=["user@atlas-app.com"]
    )
    password: str = Field(
        ...,
        min_length=1 # Ensures they don't submit empty strings to the database

    )

class ProfileUpsertSchema(BaseModel):
    full_name: str = Field(..., min_length=1)
    username: str = Field(..., min_length=3, pattern="^[a-z0-9_]+$")
    primary_role: str
    domain_of_focus: str
    referral_source: str