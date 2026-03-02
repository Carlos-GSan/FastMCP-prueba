import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from ..database import get_session
from ..repositories.agent_repository import AgentRepository
from ..services.mcp_service import mcp_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp", tags=["MCP"])


@router.api_route("/{agent_id}", methods=["GET", "POST", "DELETE"])
async def mcp_streamable_http(request: Request, agent_id: int, session: Session = Depends(get_session)):
    """Streamable HTTP endpoint for MCP protocol.
    
    Handles both GET (server-to-client stream) and POST (client-to-server messages)
    using FastMCP's built-in streamable HTTP transport.
    """
    agent = AgentRepository.get_by_id(session, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    api_key_str = agent.api_key.key if agent.api_key else "default_key"
    selected_scopes = [s.strip() for s in agent.selected_scopes.split(",") if s.strip()]

    fastmcp_instance = await mcp_service.create_server(
        agent_name=agent.name,
        api_key=api_key_str,
        selected_scopes=selected_scopes,
    )

    # Get the underlying low-level MCP server
    mcp_server = fastmcp_instance._mcp_server

    # Use streamable HTTP transport
    from mcp.server.streamable_http import StreamableHTTPServerTransport

    transport = StreamableHTTPServerTransport(
        mcp_session_id=f"agent-{agent_id}",
    )

    async def handle_stream():
        async with transport.connect() as (read_stream, write_stream):
            await mcp_server.run(
                read_stream,
                write_stream,
                mcp_server.create_initialization_options(),
            )

    # Process the incoming request through the transport
    scope = request.scope
    receive = request.receive
    send = request._send

    response = await transport.handle_request(scope, receive, send)
    return response
