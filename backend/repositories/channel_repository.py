from sqlmodel import Session, select
from typing import List, Optional
from ..models import Channel


class ChannelRepository:
    """Data access layer for Channel entities."""

    @staticmethod
    def list(session: Session, offset: int = 0, limit: int = 100) -> List[Channel]:
        return session.exec(select(Channel).offset(offset).limit(limit)).all()

    @staticmethod
    def get_by_id(session: Session, channel_id: int) -> Optional[Channel]:
        return session.get(Channel, channel_id)

    @staticmethod
    def list_by_type(session: Session, channel_type: str) -> List[Channel]:
        return session.exec(select(Channel).where(Channel.type == channel_type)).all()

    @staticmethod
    def get_enabled_by_type(session: Session, channel_type: str) -> List[Channel]:
        return session.exec(
            select(Channel).where(Channel.type == channel_type, Channel.enabled == True)
        ).all()

    @staticmethod
    def create(session: Session, channel_data: dict) -> Channel:
        db_channel = Channel.model_validate(channel_data)
        session.add(db_channel)
        session.commit()
        session.refresh(db_channel)
        return db_channel

    @staticmethod
    def update(session: Session, channel_id: int, update_data: dict) -> Optional[Channel]:
        channel = session.get(Channel, channel_id)
        if not channel:
            return None
        for key, value in update_data.items():
            if value is not None:
                setattr(channel, key, value)
        session.add(channel)
        session.commit()
        session.refresh(channel)
        return channel

    @staticmethod
    def delete(session: Session, channel_id: int) -> bool:
        channel = session.get(Channel, channel_id)
        if not channel:
            return False
        session.delete(channel)
        session.commit()
        return True
