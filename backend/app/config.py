from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "sqlite:///./nitaTime.db"
    turso_auth_token: str = ""

    # JWT
    jwt_secret_key: str = "dev-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    # Admin seed
    admin_username: str = "admin"
    admin_password: str = "changeme"

    # CORS – stored as comma-separated string, parsed into a list
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_turso(self) -> bool:
        return self.database_url.startswith("libsql://")


@lru_cache
def get_settings() -> Settings:
    return Settings()
