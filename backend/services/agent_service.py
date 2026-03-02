import asyncio
import logging
from typing import Optional

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import StructuredTool
from langchain_core.messages import SystemMessage
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

    async def run_chat(self, agent: Agent, user_message: str) -> str:
        """Execute a single chat turn: build tools → invoke LLM → return response."""
        api_key_str = agent.api_key.key if agent.api_key else "default_key"
        selected_scopes = [s.strip() for s in agent.selected_scopes.split(",") if s.strip()]

        # Build MCP server with scoped tools
        fastmcp = await self._mcp.create_server(
            agent_name=agent.name,
            api_key=api_key_str,
            selected_scopes=selected_scopes,
        )

        # Convert MCP tools to LangChain StructuredTools
        langchain_tools = await self._build_langchain_tools(fastmcp)
        logger.info(f"[Agent] {len(langchain_tools)} tools for '{agent.name}'")

        # Create LLM and agent
        llm = ChatOpenAI(model=settings.OPENAI_MODEL, temperature=0)
        agent_executor = create_react_agent(llm, langchain_tools)

        # Build messages with system prompt + tool instructions
        system_content = agent.system_prompt + self.TOOL_USAGE_INSTRUCTIONS
        messages = [
            SystemMessage(content=system_content),
            ("user", user_message),
        ]

        try:
            result = await asyncio.wait_for(
                agent_executor.ainvoke({"messages": messages}),
                timeout=settings.AGENT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            return "Request timed out while waiting for agent response."
        except Exception as e:
            logger.exception("Agent execution failed")
            return f"An error occurred during agent execution: {str(e)}"

        return result["messages"][-1].content

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
