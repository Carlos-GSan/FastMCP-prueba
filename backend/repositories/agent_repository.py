from sqlmodel import Session, select
from typing import List, Optional
from ..models import Agent


class AgentRepository:
    """Data access layer for Agent entities."""

    @staticmethod
    def list(session: Session, offset: int = 0, limit: int = 100) -> List[Agent]:
        return session.exec(select(Agent).offset(offset).limit(limit)).all()

    @staticmethod
    def get_by_id(session: Session, agent_id: int) -> Optional[Agent]:
        return session.get(Agent, agent_id)

    @staticmethod
    def create(session: Session, agent_data: dict) -> Agent:
        db_agent = Agent.model_validate(agent_data)
        session.add(db_agent)
        session.commit()
        session.refresh(db_agent)
        return db_agent
