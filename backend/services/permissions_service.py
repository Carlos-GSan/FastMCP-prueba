import httpx
import logging
from typing import Dict, Any, List, Optional
from collections import Counter

from ..config import settings
from .auth_service import auth_service

logger = logging.getLogger(__name__)


class PermissionsService:
    """Fetches capability metadata from the application backend and executes API calls.
    
    Single Responsibility: HTTP communication with the external backend.
    Open/Closed: new backends can be supported by subclassing or swapping config.
    """

    def __init__(self, auth=auth_service):
        self._auth = auth

    async def fetch_capabilities(
        self, api_key: str, selected_scopes: List[str]
    ) -> List[Dict[str, Any]]:
        """Fetch capabilities from /my-permissions and filter by selected scopes.
        
        Returns a flat list of capability dicts, each with:
        id, scope, kind, name, method, path, summary, description, parameters[]
        """
        jwt_token = await self._auth.get_jwt(api_key)
        url = f"{settings.API_BASE_URL}{settings.PERMISSIONS_PATH}"
        headers = {"Authorization": f"Bearer {jwt_token}"}

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                raise PermissionsError(
                    f"Failed to fetch permissions: {response.status_code} {response.text}"
                )
            data = response.json()

        all_capabilities = data.get("capabilities", [])
        # Wildcard '*' means all capabilities are allowed
        if "*" in selected_scopes:
            allowed = all_capabilities
        else:
            allowed = [
                cap for cap in all_capabilities 
                if cap.get("scope") in selected_scopes
            ]

        # Log summary
        scope_counts = Counter(cap["scope"] for cap in allowed)
        logger.info(
            f"[Permissions] {len(selected_scopes)} scopes → "
            f"{len(allowed)} capabilities (from {len(all_capabilities)} total)"
        )
        for scope, count in sorted(scope_counts.items()):
            logger.info(f"[Permissions]   {scope}: {count}")

        return allowed

    async def fetch_all_scopes(self, api_key: str) -> List[str]:
        """Fetch all available scope names for an API key from /my-permissions.
        
        Used to resolve wildcard '*' into actual scope names.
        """
        jwt_token = await self._auth.get_jwt(api_key)
        url = f"{settings.API_BASE_URL}{settings.PERMISSIONS_PATH}"
        headers = {"Authorization": f"Bearer {jwt_token}"}

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.warning(f"[Permissions] Could not resolve scopes: {response.status_code}")
                return ["*"]
            data = response.json()

        capabilities = data.get("capabilities", [])
        scopes = sorted(set(cap["scope"] for cap in capabilities if cap.get("scope")))
        logger.info(f"[Permissions] Resolved '*' → {len(scopes)} scopes: {', '.join(scopes)}")
        return scopes

    async def call_api(
        self,
        method: str,
        url: str,
        api_key: str,
        path_params: Optional[Dict[str, str]] = None,
        query_params: Optional[Dict[str, Any]] = None,
        body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Execute an authenticated HTTP request against the application backend."""
        jwt_token = await self._auth.get_jwt(api_key)

        # Substitute path parameters
        if path_params:
            for key, value in path_params.items():
                url = url.replace(f"{{{key}}}", str(value))

        logger.info(f"[API] {method} {url}")
        headers = {"Authorization": f"Bearer {jwt_token}", "Content-Type": "application/json"}

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method, url=url, headers=headers,
                params=query_params, json=body,
            )
            try:
                data = response.json()
            except Exception:
                data = {"raw_response": response.text}
            return {"status_code": response.status_code, "data": data}


class PermissionsError(Exception):
    """Raised when the permissions endpoint returns an error."""
    pass


# Singleton instance
permissions_service = PermissionsService()
