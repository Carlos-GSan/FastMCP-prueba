# MCP Server Dashboard

Dashboard para gestionar agentes LLM que interactúan con tu backend de aplicación a través del protocolo MCP (Model Context Protocol). Cada agente solo tiene acceso a las herramientas (tools) que sus scopes le permiten.

## Arquitectura

```
Frontend (React + Vite)  →  Backend (FastAPI + FastMCP)  →  App Backend (Django, etc.)
       :5173                       :8001                       :8000
```

El backend sigue principios **SOLID** con capas separadas:
- **Repositories** — acceso a datos (CRUD)
- **Services** — lógica de negocio (auth, permisos, MCP, LLM)
- **Routers** — endpoints HTTP

📖 Ver [docs/mcp_integration_guide.md](docs/mcp_integration_guide.md) para la documentación completa de la arquitectura.

---

## Requisitos

- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (package manager para Python)
- Una API Key válida de tu backend de aplicación
- Una API Key de OpenAI

## Setup

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd prueba_dashboard
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```env
# URL del endpoint de autenticación de tu backend
MCP_OPEN_AUTH_URL=http://tu-backend:8000/api/v1/auth/token

# URL base de tu backend de aplicación
MCP_API_BASE_URL=http://tu-backend:8000

# API Key de OpenAI
OPENAI_API_KEY=sk-...
```

### 3. Backend

```bash
# Crear virtualenv e instalar dependencias
cd backend
uv venv venv
uv pip install -r requirements.txt
cd ..

# Levantar el servidor
uv run --python backend/venv uvicorn backend.main:app --host 0.0.0.0 --port 8001
```

El backend estará en `http://localhost:8001`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev -- --host
```

El dashboard estará en `http://localhost:5173`

---

## Uso rápido

### 1. Registrar una API Key

```bash
curl -X POST http://localhost:8001/api_keys/ \
  -H "Content-Type: application/json" \
  -d '{"name": "mi_api_key", "key": "tu_api_key_real"}'
```

Esto valida la key contra tu backend y auto-descubre los scopes disponibles.

### 2. Crear un Agente

```bash
curl -X POST http://localhost:8001/agents/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Agente",
    "system_prompt": "Eres un asistente útil.",
    "selected_scopes": "categories:read, categories:update",
    "api_key_id": 1
  }'
```

Solo tendrá acceso a las tools dentro de esos scopes.

### 3. Chatear

```bash
curl -X POST http://localhost:8001/chat/1 \
  -H "Content-Type: application/json" \
  -d '{"message": "cuáles son las categorías?"}'
```

---

## Estructura del proyecto

```
prueba_dashboard/
├── backend/
│   ├── config.py                    # Settings centralizados
│   ├── database.py                  # SQLite + SQLModel
│   ├── models.py                    # Entidades (Agent, ApiKey)
│   ├── main.py                      # FastAPI app entry point
│   ├── repositories/
│   │   ├── api_key_repository.py    # CRUD ApiKey
│   │   └── agent_repository.py      # CRUD Agent
│   ├── services/
│   │   ├── auth_service.py          # JWT fetch + cache
│   │   ├── permissions_service.py   # /my-permissions + API calls
│   │   ├── mcp_service.py           # FastMCP tool builder
│   │   └── agent_service.py         # LLM orchestration
│   └── routers/
│       ├── api_key_router.py        # POST/GET /api_keys/
│       ├── agent_router.py          # POST/GET /agents/
│       ├── chat_router.py           # POST /chat/{id}
│       └── mcp_router.py            # Streamable HTTP MCP
├── frontend/                        # React + Vite
├── docs/
│   └── mcp_integration_guide.md     # Guía de integración completa
├── .env                             # Variables de entorno (no comitear)
└── .gitignore
```

## Licencia

MIT
