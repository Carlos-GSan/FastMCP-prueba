from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from contextlib import asynccontextmanager
import json
import logging

from .database import create_db_and_tables, get_session
from .routers.api_key_router import router as api_key_router
from .routers.agent_router import router as agent_router
from .routers.chat_router import router as chat_router
from .routers.mcp_router import router as mcp_router
from .routers.channel_router import router as channel_router
from .routers.webhook_router import router as webhook_router
from .services.telegram_service import telegram_service

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()

    # Start all enabled Telegram bots
    from .repositories.channel_repository import ChannelRepository
    from .database import engine
    with Session(engine) as session:
        telegram_channels = ChannelRepository.get_enabled_by_type(session, "telegram")
        for ch in telegram_channels:
            try:
                config = json.loads(ch.config)
                bot_token = config.get("bot_token", "")
                if bot_token:
                    await telegram_service.start_bot(ch.id, bot_token, ch.agent_id)
            except Exception as e:
                logger.error(f"[Startup] Failed to start Telegram bot for channel {ch.id}: {e}")

    yield

    # Shutdown: stop all bots
    await telegram_service.stop_all()


app = FastAPI(title="MCP Server Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(api_key_router)
app.include_router(agent_router)
app.include_router(chat_router)
app.include_router(mcp_router)
app.include_router(channel_router)
app.include_router(webhook_router)


@app.get("/")
def read_root():
    return {"message": "Welcome to the MCP Dashboard API"}


# Debug endpoint (can be removed in production)
@app.get("/debug/permissions/{agent_id}")
async def debug_permissions(agent_id: int, session: Session = Depends(get_session)):
    """Shows raw my-permissions response for an agent's API key."""
    from .repositories.agent_repository import AgentRepository
    from .services.auth_service import auth_service
    from .config import settings
    import httpx

    agent = AgentRepository.get_by_id(session, agent_id)
    if not agent or not agent.api_key:
        raise HTTPException(status_code=404, detail="Agent or API key not found")

    jwt_token = await auth_service.get_jwt(agent.api_key.key)
    url = f"{settings.API_BASE_URL}{settings.PERMISSIONS_PATH}"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers={"Authorization": f"Bearer {jwt_token}"})
        return r.json()

