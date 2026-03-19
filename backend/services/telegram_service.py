import asyncio
import json
import logging
import re
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


def markdown_to_telegram_html(text: str) -> str:
    """Convert common Markdown from LLM output to Telegram-compatible HTML.

    Telegram supports a limited subset of HTML:
    <b>, <i>, <u>, <s>, <code>, <pre>, <a href="">

    This handles: **bold**, *italic*, `inline code`, ```code blocks```,
    [links](url), and ### headers (converted to bold).
    """
    # 1. Escape HTML special chars FIRST (before adding our own tags)
    #    But protect code blocks/inline code from escaping
    code_blocks = []

    def _save_code_block(m):
        code_blocks.append(m.group(1))
        return f"\x00CODEBLOCK{len(code_blocks) - 1}\x00"

    inline_codes = []

    def _save_inline_code(m):
        inline_codes.append(m.group(1))
        return f"\x00INLINECODE{len(inline_codes) - 1}\x00"

    # Extract code blocks and inline code before escaping
    text = re.sub(r'```(?:\w*\n)?(.*?)```', _save_code_block, text, flags=re.DOTALL)
    text = re.sub(r'`([^`]+)`', _save_inline_code, text)

    # Escape HTML entities in remaining text
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

    # 2. Convert Markdown to HTML
    # Headers → bold
    text = re.sub(r'^#{1,6}\s+(.+)$', r'<b>\1</b>', text, flags=re.MULTILINE)

    # Bold: **text** or __text__
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'__(.+?)__', r'<b>\1</b>', text)

    # Italic: *text* or _text_ (but not inside words like some_var_name)
    text = re.sub(r'(?<!\w)\*([^*]+?)\*(?!\w)', r'<i>\1</i>', text)
    text = re.sub(r'(?<!\w)_([^_]+?)_(?!\w)', r'<i>\1</i>', text)

    # Links: [text](url)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)

    # Strikethrough: ~~text~~
    text = re.sub(r'~~(.+?)~~', r'<s>\1</s>', text)

    # 3. Restore code blocks and inline code
    for i, code in enumerate(inline_codes):
        escaped_code = code.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        text = text.replace(f'\x00INLINECODE{i}\x00', f'<code>{escaped_code}</code>')

    for i, code in enumerate(code_blocks):
        escaped_code = code.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        text = text.replace(f'\x00CODEBLOCK{i}\x00', f'<pre>{escaped_code}</pre>')

    return text


def extract_images(text: str) -> tuple[str, list[dict]]:
    """Extract markdown images from text, returning cleaned text and image list.

    Finds all ![alt](url) patterns, removes them from the text, and returns
    a list of dicts with 'alt', 'url', and 'caption' keys.

    The caption is derived from the nearest preceding section title
    (e.g. "1. **Trip Name**" or "### Trip Name"), so each image can be
    associated with its context when sent as a separate photo.

    Returns:
        (cleaned_text, [{'alt': str, 'url': str, 'caption': str}, ...])
    """
    images = []
    img_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
    # Matches numbered items, bold text, or markdown headers
    title_pattern = re.compile(
        r'^\s*(?:\d+[\.\)]\s*)?'           # optional "1. " or "1) "
        r'(?:\*\*(.+?)\*\*|#{1,6}\s+(.+))',  # **bold title** or ### header
        re.MULTILINE,
    )

    # Pre-collect all title positions for fast lookup
    titles = [(m.start(), m.group(1) or m.group(2)) for m in title_pattern.finditer(text)]

    for match in re.finditer(img_pattern, text):
        img_pos = match.start()

        # Find closest preceding title
        caption = ""
        for title_pos, title_text in reversed(titles):
            if title_pos < img_pos:
                caption = title_text.strip()
                break

        images.append({
            'alt': match.group(1),
            'url': match.group(2),
            'caption': caption,
        })

    # Remove image markdown from text (and any surrounding blank lines)
    cleaned = re.sub(r'\n*' + img_pattern + r'\n*', '\n', text).strip()
    return cleaned, images


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

                # Extract images before converting to HTML
                cleaned_text, images = extract_images(response_text)
                html_text = markdown_to_telegram_html(cleaned_text)

                # Send text message(s) first
                if html_text.strip():
                    for i in range(0, len(html_text), 4096):
                        await update.message.reply_text(
                            html_text[i:i+4096],
                            parse_mode="HTML",
                            disable_web_page_preview=True,
                        )

                # Send each image as a separate photo message
                for img in images:
                    try:
                        caption = f"📸 {img['caption']}" if img['caption'] else None
                        await update.message.reply_photo(
                            photo=img['url'],
                            caption=caption,
                        )
                    except Exception as img_err:
                        logger.warning(f"[Telegram] Failed to send image {img['url']}: {img_err}")
                        # Fallback: send as clickable link
                        await update.message.reply_text(
                            f'🖼️ <a href="{img["url"]}">Ver imagen</a>',
                            parse_mode="HTML",
                        )

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
