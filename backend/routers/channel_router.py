import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from ..database import get_session
from ..models import Channel, ChannelCreate, ChannelRead, ChannelUpdate
from ..repositories.channel_repository import ChannelRepository
from ..services.telegram_service import telegram_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/channels", tags=["Channels"])


@router.get("/", response_model=list[ChannelRead])
def list_channels(session: Session = Depends(get_session)):
    return ChannelRepository.list(session)


@router.post("/", response_model=ChannelRead)
async def create_channel(data: ChannelCreate, session: Session = Depends(get_session)):
    if data.type not in ("telegram", "twilio"):
        raise HTTPException(status_code=400, detail="Type must be 'telegram' or 'twilio'")

    # Validate config JSON
    try:
        config = json.loads(data.config)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Config must be valid JSON")

    # Validate required fields per type
    if data.type == "telegram":
        if not config.get("bot_token"):
            raise HTTPException(status_code=400, detail="Telegram config requires 'bot_token'")
    elif data.type == "twilio":
        for field in ("account_sid", "auth_token", "phone_number"):
            if not config.get(field):
                raise HTTPException(status_code=400, detail=f"Twilio config requires '{field}'")

    channel = ChannelRepository.create(session, data.model_dump())

    # Auto-start Telegram bot if created as enabled
    if channel.type == "telegram" and channel.enabled:
        try:
            await telegram_service.start_bot(channel.id, config["bot_token"], channel.agent_id)
        except Exception as e:
            logger.error(f"[Channels] Failed to start Telegram bot: {e}")

    return channel


@router.put("/{channel_id}", response_model=ChannelRead)
async def update_channel(channel_id: int, data: ChannelUpdate, session: Session = Depends(get_session)):
    # Validate config JSON if provided
    if data.config is not None:
        try:
            json.loads(data.config)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Config must be valid JSON")

    channel = ChannelRepository.update(session, channel_id, data.model_dump(exclude_unset=True))
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Handle Telegram bot lifecycle on update
    if channel.type == "telegram":
        config = json.loads(channel.config)
        bot_token = config.get("bot_token", "")
        if channel.enabled and bot_token:
            try:
                await telegram_service.restart_bot(channel.id, bot_token, channel.agent_id)
            except Exception as e:
                logger.error(f"[Channels] Failed to restart Telegram bot: {e}")
        else:
            await telegram_service.stop_bot(channel.id)

    return channel


@router.delete("/{channel_id}")
async def delete_channel(channel_id: int, session: Session = Depends(get_session)):
    channel = ChannelRepository.get_by_id(session, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Stop Telegram bot if running
    if channel.type == "telegram":
        await telegram_service.stop_bot(channel_id)

    ChannelRepository.delete(session, channel_id)
    return {"status": "ok", "message": f"Channel {channel_id} deleted"}


@router.post("/{channel_id}/toggle", response_model=ChannelRead)
async def toggle_channel(channel_id: int, session: Session = Depends(get_session)):
    channel = ChannelRepository.get_by_id(session, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    new_enabled = not channel.enabled
    channel = ChannelRepository.update(session, channel_id, {"enabled": new_enabled})

    # Handle Telegram bot lifecycle
    if channel.type == "telegram":
        config = json.loads(channel.config)
        bot_token = config.get("bot_token", "")
        if new_enabled and bot_token:
            try:
                await telegram_service.start_bot(channel.id, bot_token, channel.agent_id)
            except Exception as e:
                logger.error(f"[Channels] Failed to start Telegram bot: {e}")
        else:
            await telegram_service.stop_bot(channel_id)

    return channel
