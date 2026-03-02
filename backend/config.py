import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Centralized application settings loaded from environment variables."""
    
    # External backend (Django) URLs
    AUTH_TOKEN_URL: str = os.getenv("MCP_OPEN_AUTH_URL", "http://192.168.100.20:8000/api/v1/auth/token")
    API_BASE_URL: str = os.getenv("MCP_API_BASE_URL", "http://192.168.100.20:8000")
    PERMISSIONS_PATH: str = "/api/v1/admin/my-permissions"
    
    # OpenAI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    
    # Agent execution
    AGENT_TIMEOUT_SECONDS: float = float(os.getenv("AGENT_TIMEOUT_SECONDS", "60"))
    
    # JWT cache TTL (seconds) — slightly less than actual expiry to avoid edge cases
    JWT_CACHE_TTL: int = int(os.getenv("JWT_CACHE_TTL", "570"))


settings = Settings()
