from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Default to local SQLite file in backend/data/app.db
    DATABASE_URL: str = "sqlite:///./backend/data/app.db"
    ALLOW_ORIGINS: list[str] = ["*"]

settings = Settings()
