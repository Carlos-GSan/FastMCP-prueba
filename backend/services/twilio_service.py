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

    async def process_and_send_async(
        self,
        channel_id: int,
        agent_id: int,
        from_number: str,
        to_number: str,
        body: str,
        config: dict
    ) -> None:
        """Process an incoming message and send the response asynchronously using Twilio REST API."""
        logger.info(f"[Twilio Async] Channel {channel_id} received from {from_number}: '{body[:50]}...'")

        from sqlmodel import Session
        with Session(engine) as session:
            agent = session.get(Agent, agent_id)
            if not agent:
                logger.error(f"[Twilio Async] Agent {agent_id} not configured.")
                return
            _ = agent.api_key

        try:
            conversation_id = f"twilio_{channel_id}_{from_number}"
            result = await agent_service.run_chat(agent, body, conversation_id)
            response_text = result.get("response", "No response from agent.")

            # Send response proactively using REST API
            account_sid = config.get("account_sid")
            auth_token = config.get("auth_token")
            
            if account_sid and auth_token:
                client = Client(account_sid, auth_token)
                
                # Twilio has limits on message bodies (often 1600 chars)
                # We will chunk the message into blocks of 1500 characters
                chunk_size = 1500
                chunks = [response_text[i:i + chunk_size] for i in range(0, len(response_text), chunk_size)]
                
                logger.info(f"[Twilio Async] Sending response to {from_number} in {len(chunks)} chunks... (From: {to_number})")
                
                for i, chunk in enumerate(chunks):
                    msg_obj = client.messages.create(
                        body=chunk,
                        from_=to_number,
                        to=from_number
                    )
                    logger.info(f"[Twilio Async] Sent chunk {i+1}/{len(chunks)} - SID: {msg_obj.sid}")
                    
            else:
                logger.error(f"[Twilio Async] Missing credentials for channel {channel_id}")

        except Exception as e:
            logger.exception(f"[Twilio Async] Error processing or sending message for channel {channel_id}")
            # Try to send fallback error natively avoiding huge payloads if it was a Twilio exception
            try:
                if 'client' in locals():
                    client.messages.create(
                        body="⚠️ El agente encontró un error o la respuesta fue demasiado larga para enviar.",
                        from_=to_number,
                        to=from_number
                    )
            except Exception:
                pass

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
