import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import Session

from ..database import get_session
from ..repositories.channel_repository import ChannelRepository
from ..services.twilio_service import twilio_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/twilio/{channel_id}")
async def twilio_webhook(channel_id: int, request: Request, session: Session = Depends(get_session)):
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

    # Parse Twilio form data
    form_data = await request.form()
    body = form_data.get("Body", "")
    from_number = form_data.get("From", "unknown")

    if not body:
        return Response(
            content=twilio_service.build_twiml_response("Empty message received."),
            media_type="text/xml",
        )

    # Process through agent
    response_text = await twilio_service.process_incoming(
        channel_id=channel.id,
        agent_id=channel.agent_id,
        from_number=from_number,
        body=body,
    )

    return Response(
        content=twilio_service.build_twiml_response(response_text),
        media_type="text/xml",
    )
