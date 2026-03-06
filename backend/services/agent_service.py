import asyncio
import hashlib
import logging
import time
from typing import Optional

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.tools import StructuredTool
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from pydantic import BaseModel, Field

from ..config import settings
from ..models import Agent
from .mcp_service import mcp_service

logger = logging.getLogger(__name__)


class ApiToolInput(BaseModel):
    """Standard input schema for all API tools exposed to the LLM."""
    path_params: Optional[dict] = Field(
        default_factory=dict,
        description="Path parameters for the API endpoint, e.g. {'cat_id': 1}",
    )
    query_params: Optional[dict] = Field(
        default_factory=dict,
        description="Query parameters for the API endpoint",
    )
    body: Optional[dict] = Field(
        default=None,
        description="JSON body for POST/PUT/PATCH requests",
    )


class AgentService:
    """Orchestrates LLM agent execution with MCP-backed tools.
    
    Single Responsibility: LLM orchestration only.
    Dependency Inversion: depends on McpService abstraction for tool creation.
    """

    TOOL_USAGE_INSTRUCTIONS = (
        "\n\nIMPORTANT: When calling tools, pass arguments correctly:\n"
        '- path_params: dict with URL path parameters (e.g. {"cat_id": 3}). '
        "These replace {placeholders} in the URL. ALWAYS pass required path params here.\n"
        "- query_params: dict with URL query parameters (optional).\n"
        "- body: dict with JSON body for POST/PUT/PATCH requests. "
        "Only include fields to set/update, NOT the id.\n\n"
        'Example: to update category id=3, call update_category with:\n'
        '  path_params={"cat_id": 3}, body={"slug": "new_slug"}'
    )

    def __init__(self, mcp=mcp_service):
        self._mcp = mcp
        self._checkpointer = MemorySaver()
        self._agent_cache: dict[str, tuple] = {}  # cache_key -> (agent_executor, created_at)

    async def run_chat(self, agent: Agent, user_message: str, conversation_id: str) -> dict:
        """Execute a chat turn with conversation memory.
        
        Returns dict with 'response' (str) and 'metrics' (dict).
        The conversation_id acts as a thread_id for LangGraph's checkpointer,
        allowing the agent to remember previous messages in the same conversation.
        """
        api_key_str = agent.api_key.key if agent.api_key else "default_key"
        selected_scopes = [s.strip() for s in agent.selected_scopes.split(",") if s.strip()]

        # Build system prompt
        system_content = agent.system_prompt + self.TOOL_USAGE_INSTRUCTIONS

        # Get or create cached agent executor
        agent_executor = await self._get_or_create_agent(
            agent, api_key_str, selected_scopes, system_content,
        )

        # Only send the new user message — history is managed by the checkpointer
        messages = [("user", user_message)]

        start_time = time.time()
        error_msg = None

        try:
            result = await asyncio.wait_for(
                agent_executor.ainvoke(
                    {"messages": messages},
                    config={"configurable": {"thread_id": conversation_id}},
                ),
                timeout=settings.AGENT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            error_msg = "Request timed out while waiting for agent response."
            return {"response": error_msg, "metrics": {"errors": [error_msg], "duration_seconds": round(time.time() - start_time, 2)}}
        except Exception as e:
            logger.exception("Agent execution failed")
            error_msg = f"An error occurred during agent execution: {str(e)}"
            return {"response": error_msg, "metrics": {"errors": [error_msg], "duration_seconds": round(time.time() - start_time, 2)}}

        duration = round(time.time() - start_time, 2)
        metrics = self._extract_metrics(result["messages"], duration)

        return {
            "response": result["messages"][-1].content,
            "metrics": metrics,
        }

    def clear_conversation(self, conversation_id: str) -> None:
        """Remove all checkpointed state for a given conversation."""
        if hasattr(self._checkpointer, 'storage'):
            # MemorySaver stores data keyed by thread_id; clear it
            keys_to_remove = [
                k for k in self._checkpointer.storage
                if k[0] == conversation_id
            ]
            for key in keys_to_remove:
                del self._checkpointer.storage[key]

    def invalidate_agent_cache(self, agent_id: int) -> None:
        """Remove all cached executors for a given agent (e.g. after config update)."""
        keys_to_remove = [k for k in self._agent_cache if k.startswith(f"{agent_id}:")]
        for key in keys_to_remove:
            del self._agent_cache[key]
        if keys_to_remove:
            logger.info(f"[Agent] Cache invalidated for agent {agent_id} ({len(keys_to_remove)} entries)")

    async def _get_or_create_agent(
        self,
        agent: Agent,
        api_key_str: str,
        selected_scopes: list[str],
        system_content: str,
    ):
        """Return a cached agent executor, or create and cache a new one.
        
        The cache key includes agent.id, scopes, model, and temperature.
        Cached executors expire after AGENT_CACHE_TTL seconds, triggering
        a fresh /my-permissions fetch to pick up permission changes.
        """
        config_str = f"{','.join(sorted(selected_scopes))}:{agent.model}:{agent.temperature}"
        config_hash = hashlib.md5(config_str.encode()).hexdigest()
        cache_key = f"{agent.id}:{config_hash}"

        cached = self._agent_cache.get(cache_key)
        if cached is not None:
            executor, created_at = cached
            age = time.time() - created_at
            if age < settings.AGENT_CACHE_TTL:
                return executor
            else:
                logger.info(f"[Agent] Cache expired for '{agent.name}' (age={age:.0f}s > TTL={settings.AGENT_CACHE_TTL}s). Rebuilding with fresh permissions...")
                del self._agent_cache[cache_key]

        # Build MCP server with scoped tools (fetches /my-permissions)
        fastmcp = await self._mcp.create_server(
            agent_name=agent.name,
            api_key=api_key_str,
            selected_scopes=selected_scopes,
        )

        # Convert MCP tools to LangChain StructuredTools
        langchain_tools = await self._build_langchain_tools(fastmcp)
        logger.info(f"[Agent] {len(langchain_tools)} tools for '{agent.name}' (model={agent.model}, temp={agent.temperature})")

        # Create LLM and agent with per-agent model and temperature
        llm = ChatOpenAI(model=agent.model, temperature=agent.temperature)
        agent_executor = create_react_agent(
            llm,
            langchain_tools,
            checkpointer=self._checkpointer,
            prompt=system_content,
        )

        self._agent_cache[cache_key] = (agent_executor, time.time())
        return agent_executor

    @staticmethod
    def _extract_metrics(messages: list, duration: float) -> dict:
        """Extract token usage, tool calls with payloads, and errors from LangGraph result messages."""
        total_prompt = 0
        total_completion = 0
        total_tokens = 0
        llm_calls = 0
        tools_used = []
        errors = []

        # First pass: collect tool call payloads from AIMessages (keyed by tool_call_id)
        tool_payloads = {}
        for msg in messages:
            if isinstance(msg, AIMessage) and hasattr(msg, 'tool_calls') and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_payloads[tc.get('id', '')] = {
                        'name': tc.get('name', 'unknown'),
                        'args': tc.get('args', {}),
                    }

        for msg in messages:
            # Count tokens from AI messages
            if isinstance(msg, AIMessage):
                usage = getattr(msg, "usage_metadata", None)
                if usage:
                    total_prompt += usage.get("input_tokens", 0)
                    total_completion += usage.get("output_tokens", 0)
                    total_tokens += usage.get("total_tokens", 0)
                    llm_calls += 1

            # Track tool usage from ToolMessages, matching with payloads
            elif isinstance(msg, ToolMessage):
                status = msg.status if hasattr(msg, "status") and msg.status else "success"
                result_preview = str(msg.content)[:300] if msg.content else ""

                # Get the payload that was sent to this tool
                call_id = getattr(msg, 'tool_call_id', '')
                payload_info = tool_payloads.get(call_id, {})

                tool_info = {
                    "name": msg.name or payload_info.get('name', 'unknown'),
                    "status": status,
                    "payload": payload_info.get('args', {}),
                    "result_preview": result_preview,
                }
                if status == "error":
                    errors.append(f"Tool '{msg.name}' failed: {result_preview}")
                tools_used.append(tool_info)

        return {
            "prompt_tokens": total_prompt,
            "completion_tokens": total_completion,
            "total_tokens": total_tokens,
            "llm_calls": llm_calls,
            "duration_seconds": duration,
            "tools_used": tools_used,
            "errors": errors,
        }

    @staticmethod
    async def _build_langchain_tools(fastmcp) -> list:
        """Convert FastMCP tools into LangChain StructuredTools."""
        mcp_tools = await fastmcp.list_tools()
        tools = []

        for mcp_tool in mcp_tools:
            tool_name = mcp_tool.name
            tool_desc = mcp_tool.description or "No description"

            async def executor(
                path_params: Optional[dict] = None,
                query_params: Optional[dict] = None,
                body: Optional[dict] = None,
                _name=tool_name,
                _mcp=fastmcp,
            ):
                result = await _mcp.call_tool(
                    _name,
                    arguments={"payload": {
                        "path_params": path_params or {},
                        "query_params": query_params or {},
                        "body": body,
                    }},
                )
                return str(result)

            executor.__name__ = tool_name

            tools.append(
                StructuredTool.from_function(
                    coroutine=executor,
                    name=tool_name,
                    description=tool_desc,
                    args_schema=ApiToolInput,
                )
            )

        return tools


# Singleton instance
agent_service = AgentService()
