import time
import httpx
import jwt as pyjwt
from typing import Dict, Any, List

from ..config import settings


class AuthService:
    """Handles JWT acquisition and caching for API key authentication.
    
    Single Responsibility: only concerns itself with token lifecycle.
    """

    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}

    async def get_jwt(self, api_key: str) -> str:
        """Get a valid JWT for the given API key, using cache when possible."""
        now = time.time()

        if api_key in self._cache:
            cached = self._cache[api_key]
            if now - cached["timestamp"] < settings.JWT_CACHE_TTL:
                return cached["token"]

        async with httpx.AsyncClient() as client:
            response = await client.post(settings.AUTH_TOKEN_URL, json={"key": api_key})

            # Fallback to form data if JSON body isn't accepted
            if response.status_code in (400, 404, 422):
                response = await client.post(settings.AUTH_TOKEN_URL, data={"key": api_key})

            if response.status_code != 200:
                raise AuthenticationError(f"Failed to authenticate: {response.text}")

            data = response.json()
            token = data.get("jwt") or data.get("access_token") or data.get("token")

            if not token:
                raise AuthenticationError("JWT not found in auth response.")

            self._cache[api_key] = {"token": token, "timestamp": now}
            return token

    def decode_scopes(self, jwt_token: str) -> List[str]:
        """Decode JWT without verification and extract scopes."""
        decoded = pyjwt.decode(jwt_token, options={"verify_signature": False})
        scopes = decoded.get("scope") or decoded.get("scopes") or []
        if isinstance(scopes, str):
            scopes = [s.strip() for s in scopes.split(",") if s.strip()]
        return scopes


class AuthenticationError(Exception):
    """Raised when authentication against the upstream server fails."""
    pass


# Singleton instance shared across the application
auth_service = AuthService()
