import logging
from typing import List, Dict, Any

from fastmcp import FastMCP

from ..config import settings
from .permissions_service import permissions_service

logger = logging.getLogger(__name__)


class McpService:
    """Builds FastMCP server instances with scoped tool registration.
    
    Single Responsibility: translating capability metadata into MCP tools.
    Dependency Inversion: depends on PermissionsService abstraction, not HTTP details.
    """

    def __init__(self, permissions=permissions_service):
        self._permissions = permissions

    @staticmethod
    def build_tool_description(cap: Dict[str, Any]) -> str:
        """Build a rich description from capability metadata for LLM consumption.
        
        Includes the backend's description in Spanish, plus structured parameter
        info (name, type, location, required) so the LLM knows exactly how
        to call each tool.
        """
        desc = cap.get("description") or cap.get("summary") or f"{cap['method']} {cap['path']}"
        params = cap.get("parameters", [])

        if not params:
            return desc

        path_params = [p for p in params if p.get("in") == "path"]
        query_params = [p for p in params if p.get("in") == "query"]
        body_params = [p for p in params if p.get("in") == "body"]

        parts = [desc]

        if path_params:
            items = [f'{p["name"]} ({p.get("type", "any")})' for p in path_params]
            parts.append(f'Path params (REQUIRED in path_params dict): {", ".join(items)}')

        if query_params:
            items = []
            for p in query_params:
                req = "required" if p.get("required") else "optional"
                items.append(f'{p["name"]} ({p.get("type", "any")}, {req})')
            parts.append(f'Query params (in query_params dict): {", ".join(items)}')

        if body_params:
            items = []
            for p in body_params:
                req = "required" if p.get("required") else "optional"
                items.append(f'{p["name"]} ({p.get("type", "any")}, {req})')
            parts.append(f'Body fields (in body dict): {", ".join(items)}')

        return " | ".join(parts)

    async def create_server(
        self,
        agent_name: str,
        api_key: str,
        selected_scopes: List[str],
        base_url: str | None = None,
    ) -> FastMCP:
        """Create a FastMCP server with only the tools allowed by the agent's scopes."""
        base_url = base_url or settings.API_BASE_URL
        mcp = FastMCP(agent_name)

        capabilities = await self._permissions.fetch_capabilities(api_key, selected_scopes)
        logger.info(f"[MCP] Registering {len(capabilities)} capabilities for '{agent_name}'")

        for cap in capabilities:
            name = cap["name"]
            method = cap["method"].upper()
            path = cap["path"]
            full_url = f"{base_url.rstrip('/')}{path}"
            scope = cap.get("scope", "unknown")
            kind = cap.get("kind", "tool")

            description = self.build_tool_description(cap)

            # Factory function to correctly capture loop variables
            def make_tool_func(_method, _url, _key):
                async def dynamic_tool(payload: dict) -> dict:
                    """Execute API call. payload: {path_params, query_params, body}"""
                    return await self._permissions.call_api(
                        method=_method,
                        url=_url,
                        api_key=_key,
                        path_params=payload.get("path_params", {}),
                        query_params=payload.get("query_params", {}),
                        body=payload.get("body"),
                    )
                return dynamic_tool

            tool_func = make_tool_func(method, full_url, api_key)
            tool_func.__doc__ = description
            tool_func.__name__ = name

            mcp.add_tool(tool_func)
            logger.info(f"[MCP]   [{kind}] {scope} → {name}")

        return mcp


# Singleton instance
mcp_service = McpService()
