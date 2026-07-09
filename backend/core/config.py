# app/core/config.py
from typing import List
from pydantic import AnyHttpUrl, BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated

def parse_cors_origins(v: str | List[str]) -> List[str]:
    """Helper to convert comma-separated string origins into a Python list."""
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, (list, str)):
        return v
    return ["http://localhost:3000"]

class Settings(BaseSettings):
    # Tell Pydantic to read from a local .env file
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore" # Ignore extra env variables not defined here
    )

    # Database Keys (Strictly required strings)
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str

    # CORS Configurations
    # Parses strings like "https://app.com,https://test.com" into a clean list
    ALLOWED_ORIGINS: Annotated[List[str], BeforeValidator(parse_cors_origins)] = ["http://localhost:3000"]

# Instantiate a single global instance of our settings
settings = Settings()