from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from typing import List

from ..database import get_session
from ..models import AgentCreate, AgentRead, AgentUpdate
from ..repositories.agent_repository import AgentRepository
from ..services.agent_service import agent_service

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


@router.put("/{agent_id}", response_model=AgentRead)
def update_agent(
    agent_id: int,
    agent_update: AgentUpdate,
    session: Session = Depends(get_session),
):
    updated = AgentRepository.update(session, agent_id, agent_update.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Agent not found")
    # Invalidate cached executor so new config takes effect
    agent_service.invalidate_agent_cache(agent_id)
    return updated
