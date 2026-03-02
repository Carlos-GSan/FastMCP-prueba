from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from ..database import get_session
from ..repositories.agent_repository import AgentRepository
from ..services.agent_service import agent_service

router = APIRouter(tags=["Chat"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str


@router.post("/chat/{agent_id}", response_model=ChatResponse)
async def chat_with_agent(
    agent_id: int,
    request: ChatRequest,
    session: Session = Depends(get_session),
):
    agent = AgentRepository.get_by_id(session, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    try:
        response_text = await agent_service.run_chat(agent, request.message)
        return ChatResponse(response=response_text)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
