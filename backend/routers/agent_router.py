from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from typing import List

from ..database import get_session
from ..models import AgentCreate, AgentRead
from ..repositories.agent_repository import AgentRepository

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.post("/", response_model=AgentRead)
def create_agent(*, session: Session = Depends(get_session), agent: AgentCreate):
    return AgentRepository.create(session, agent.model_dump())


@router.get("/", response_model=List[AgentRead])
def list_agents(
    session: Session = Depends(get_session),
    offset: int = 0,
    limit: int = Query(default=100, le=100),
):
    return AgentRepository.list(session, offset=offset, limit=limit)
