from sqlmodel import Session, select
from typing import List, Optional
from ..models import ApiKey


class ApiKeyRepository:
    """Data access layer for ApiKey entities."""

    @staticmethod
    def list(session: Session, offset: int = 0, limit: int = 100) -> List[ApiKey]:
        return session.exec(select(ApiKey).offset(offset).limit(limit)).all()

    @staticmethod
    def get_by_id(session: Session, api_key_id: int) -> Optional[ApiKey]:
        return session.get(ApiKey, api_key_id)

    @staticmethod
    def create(session: Session, *, name: str, key: str, valid_scopes: str) -> ApiKey:
        db_api_key = ApiKey(name=name, key=key, valid_scopes=valid_scopes)
        session.add(db_api_key)
        session.commit()
        session.refresh(db_api_key)
        return db_api_key
