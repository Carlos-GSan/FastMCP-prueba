import json
import logging
from typing import Optional

from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse

from ..services.agent_service import agent_service
from ..models import Agent
from ..database import engine

logger = logging.getLogger(__name__)


class TwilioService:
    """Handles Twilio SMS/WhatsApp message processing.

    Unlike Telegram (polling), Twilio uses webhooks — the webhook_router
    receives incoming messages and calls this service to process them.
    """

    async def process_incoming(
        self,
        channel_id: int,
        agent_id: int,
        from_number: str,
        body: str,
    ) -> str:
        """Process an incoming Twilio message and return the agent's response text.

        Args:
            channel_id: The Channel ID for tracking.
            agent_id: The Agent to forward the message to.
            from_number: Sender's phone number (used as conversation_id).
            body: The message text.

        Returns:
            The agent's response text.
        """
        logger.info(f"[Twilio] Channel {channel_id} received from {from_number}: '{body[:50]}...'")

        # Load agent from DB
        from sqlmodel import Session
        with Session(engine) as session:
            agent = session.get(Agent, agent_id)
            if not agent:
                return "⚠️ Agent not configured. Please check the dashboard."
            # Eagerly load relationship
            _ = agent.api_key

        try:
            conversation_id = f"twilio_{channel_id}_{from_number}"
            result = await agent_service.run_chat(agent, body, conversation_id)
            return result.get("response", "No response from agent.")
        except Exception as e:
            logger.exception(f"[Twilio] Error processing message for channel {channel_id}")
            return f"⚠️ Error: {str(e)[:200]}"

    @staticmethod
    def build_twiml_response(message: str) -> str:
        """Build a TwiML XML response string."""
        resp = MessagingResponse()
        # Twilio SMS limit is 1600 chars; truncate if needed
        if len(message) > 1600:
            message = message[:1597] + "..."
        resp.message(message)
        return str(resp)

    @staticmethod
    def validate_credentials(account_sid: str, auth_token: str) -> bool:
        """Validate Twilio credentials by attempting to fetch account info."""
        try:
            client = Client(account_sid, auth_token)
            account = client.api.accounts(account_sid).fetch()
            return account is not None
        except Exception as e:
            logger.warning(f"[Twilio] Credential validation failed: {e}")
            return False


# Singleton
twilio_service = TwilioService()
