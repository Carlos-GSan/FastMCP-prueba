from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session
from typing import List

from ..database import get_session
from ..models import ApiKeyCreate, ApiKeyRead
from ..repositories.api_key_repository import ApiKeyRepository
from ..services.auth_service import auth_service
from ..services.permissions_service import permissions_service

router = APIRouter(prefix="/api_keys", tags=["API Keys"])


@router.post("/", response_model=ApiKeyRead)
async def create_api_key(
    *, session: Session = Depends(get_session), api_key: ApiKeyCreate
):
    """Register an API key — validates it against the auth server to discover scopes."""
    try:
        token = await auth_service.get_jwt(api_key.key)
        scopes = auth_service.decode_scopes(token)
        # Resolve wildcard '*' into actual scope names
        if "*" in scopes:
            scopes = await permissions_service.fetch_all_scopes(api_key.key)
        scopes_str = ", ".join(scopes) if scopes else "default_scope"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to authenticate API Key: {str(e)}",
        )

    return ApiKeyRepository.create(
        session, name=api_key.name, key=api_key.key, valid_scopes=scopes_str
    )


@router.get("/", response_model=List[ApiKeyRead])
def list_api_keys(
    session: Session = Depends(get_session),
    offset: int = 0,
    limit: int = Query(default=100, le=100),
):
    return ApiKeyRepository.list(session, offset=offset, limit=limit)


@router.post("/{api_key_id}/refresh-scopes", response_model=ApiKeyRead)
async def refresh_api_key_scopes(
    api_key_id: int,
    session: Session = Depends(get_session),
):
    """Re-discover scopes for an existing API key by re-authenticating with the server."""
    api_key = ApiKeyRepository.get_by_id(session, api_key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API Key not found")

    try:
        # Force fresh token by clearing cache
        auth_service._cache.pop(api_key.key, None)
        token = await auth_service.get_jwt(api_key.key)
        scopes = auth_service.decode_scopes(token)
        # Resolve wildcard '*' into actual scope names
        if "*" in scopes:
            scopes = await permissions_service.fetch_all_scopes(api_key.key)
        scopes_str = ", ".join(scopes) if scopes else "default_scope"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to refresh scopes: {str(e)}",
        )

    return ApiKeyRepository.update_scopes(session, api_key_id, scopes_str)
