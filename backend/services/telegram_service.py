import asyncio
import json
import logging
from typing import Optional

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from ..services.agent_service import agent_service
from ..models import Agent
from ..database import engine

logger = logging.getLogger(__name__)


class TelegramService:
    """Manages Telegram bot instances using python-telegram-bot (polling mode).

    Each enabled Telegram channel gets its own bot Application running
    in the background. Messages are forwarded to the linked agent via
    agent_service.run_chat().
    """

    def __init__(self):
        self._bots: dict[int, Application] = {}  # channel_id -> Application

    async def start_bot(self, channel_id: int, bot_token: str, agent_id: int) -> None:
        """Start a Telegram bot in polling mode for the given channel."""
        if channel_id in self._bots:
            logger.info(f"[Telegram] Bot for channel {channel_id} already running, restarting...")
            await self.stop_bot(channel_id)

        async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
            """Forward every text message to the linked agent."""
            if not update.message or not update.message.text:
                return

            chat_id = str(update.message.chat_id)
            user_text = update.message.text

            logger.info(f"[Telegram] Channel {channel_id} received: '{user_text[:50]}...' from chat {chat_id}")

            # Load the agent from DB
            from sqlmodel import Session
            with Session(engine) as session:
                agent = session.get(Agent, agent_id)
                if not agent:
                    await update.message.reply_text("⚠️ Agent not configured. Please check the dashboard.")
                    return
                # Eagerly load the api_key relationship
                _ = agent.api_key

            try:
                conversation_id = f"telegram_{channel_id}_{chat_id}"
                result = await agent_service.run_chat(agent, user_text, conversation_id)
                response_text = result.get("response", "No response from agent.")

                # Telegram messages have a 4096 char limit; split if needed
                for i in range(0, len(response_text), 4096):
                    await update.message.reply_text(response_text[i:i+4096])

            except Exception as e:
                logger.exception(f"[Telegram] Error processing message for channel {channel_id}")
                await update.message.reply_text(f"⚠️ Error: {str(e)[:200]}")

        async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
            """Handle /start command."""
            await update.message.reply_text(
                "👋 ¡Hola! Soy un agente AI. Envíame un mensaje y te responderé."
            )

        try:
            app = Application.builder().token(bot_token).build()
            app.add_handler(CommandHandler("start", handle_start))
            app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

            # Initialize and start polling in the background
            await app.initialize()
            await app.start()
            await app.updater.start_polling(drop_pending_updates=True)

            self._bots[channel_id] = app
            logger.info(f"[Telegram] Bot started for channel {channel_id} (agent_id={agent_id})")

        except Exception as e:
            logger.exception(f"[Telegram] Failed to start bot for channel {channel_id}")
            raise

    async def stop_bot(self, channel_id: int) -> None:
        """Stop a running Telegram bot."""
        app = self._bots.pop(channel_id, None)
        if app:
            try:
                await app.updater.stop()
                await app.stop()
                await app.shutdown()
                logger.info(f"[Telegram] Bot stopped for channel {channel_id}")
            except Exception as e:
                logger.warning(f"[Telegram] Error stopping bot for channel {channel_id}: {e}")

    async def restart_bot(self, channel_id: int, bot_token: str, agent_id: int) -> None:
        """Restart a bot (e.g. after config change)."""
        await self.stop_bot(channel_id)
        await self.start_bot(channel_id, bot_token, agent_id)

    def is_running(self, channel_id: int) -> bool:
        """Check if a bot is currently running for the given channel."""
        return channel_id in self._bots

    async def stop_all(self) -> None:
        """Stop all running bots (called during app shutdown)."""
        channel_ids = list(self._bots.keys())
        for cid in channel_ids:
            await self.stop_bot(cid)
        logger.info(f"[Telegram] All bots stopped ({len(channel_ids)} total)")


# Singleton
telegram_service = TelegramService()
