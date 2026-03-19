import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, BackgroundTasks
from sqlmodel import Session

from ..database import get_session
from ..repositories.channel_repository import ChannelRepository
from ..services.twilio_service import twilio_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/twilio/{channel_id}")
async def twilio_webhook(
    channel_id: int, 
    request: Request, 
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    """Receive incoming SMS/WhatsApp messages from Twilio.

    Twilio sends form-encoded data with fields like:
    - Body: message text
    - From: sender phone number
    - To: your Twilio number
    - MessageSid: unique message ID
    """
    channel = ChannelRepository.get_by_id(session, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if not channel.enabled:
        raise HTTPException(status_code=403, detail="Channel is disabled")

    if channel.type != "twilio":
        raise HTTPException(status_code=400, detail="Channel is not a Twilio channel")

    config = json.loads(channel.config) if channel.config else {}

    # Parse Twilio form data
    form_data = await request.form()
    body = form_data.get("Body", "")
    from_number = form_data.get("From", "unknown")
    to_number = form_data.get("To", config.get("phone_number", ""))

    if body:
        # Process through agent asynchronously in background
        background_tasks.add_task(
            twilio_service.process_and_send_async,
            channel_id=channel.id,
            agent_id=channel.agent_id,
            from_number=from_number,
            to_number=to_number,
            body=body,
            config=config
        )

    # Return empty response immediately (200 OK) to avoid Twilio 15-second timeout
    return Response(content="<Response></Response>", media_type="text/xml")
