# MCP Server Dashboard

Dashboard para gestionar agentes LLM que interactúan con tu backend de aplicación a través del protocolo MCP (Model Context Protocol). Cada agente solo tiene acceso a las herramientas (tools) que sus scopes le permiten.

## Arquitectura

```
Frontend (React + Vite)  →  Backend (FastAPI + FastMCP)  →  App Backend (Django, etc.)
       :5173                       :8001                       tu-backend
```

El backend sigue principios **SOLID** con capas separadas:
- **Repositories** — acceso a datos (CRUD para `Agent` y `ApiKey`)
- **Services** — lógica de negocio (autenticación, permisos, MCP, orquestación LLM)
- **Routers** — endpoints HTTP (API Keys, Agents, Chat, MCP)

📖 Ver [docs/mcp_integration_guide.md](docs/mcp_integration_guide.md) para la documentación completa de la integración MCP.

---

## Requisitos

- Python 3.12+
- Node.js 18+
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

# Modelo de OpenAI (opcional, default: gpt-4o)
# OPENAI_MODEL=gpt-4o

# Timeout del agente en segundos (opcional, default: 60)
# AGENT_TIMEOUT_SECONDS=60

# TTL del cache del agente en segundos (opcional, default: 300)
# AGENT_CACHE_TTL=300

# TTL del cache de JWT en segundos (opcional, default: 570)
# JWT_CACHE_TTL=570
```

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Levantar el servidor (desde la raíz del proyecto)
source backend/venv/bin/activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
```

> **Nota:** El backend debe ejecutarse desde la raíz del proyecto (`prueba_dashboard/`) con `python -m uvicorn backend.main:app` porque los módulos usan importaciones relativas.

El backend estará en `http://localhost:8001`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

El dashboard estará en `http://localhost:5173`

---

## Uso

### Interfaz Web (Dashboard)

El dashboard tiene tres secciones accesibles desde el sidebar:

| Sección | Descripción |
|---|---|
| **API Keys** | Registrar, ver y refrescar scopes de API keys del backend externo |
| **Agents** | Crear y configurar agentes LLM con scopes, modelo, temperatura y system prompt |
| **Chat** | Chatear en tiempo real con los agentes configurados |

### Flujo de trabajo

```
1. Registrar API Key  →  2. Crear Agente  →  3. Chatear
```

#### 1. Registrar una API Key

Desde el dashboard o por API:

```bash
curl -X POST http://localhost:8001/api_keys/ \
  -H "Content-Type: application/json" \
  -d '{"name": "mi_api_key", "key": "tu_api_key_real"}'
```

Esto valida la key contra tu backend, obtiene un JWT y auto-descubre los scopes disponibles. Si el JWT contiene `"*"` (wildcard), se resuelve automáticamente en la lista completa de scopes consultando el endpoint `/my-permissions`.

#### 2. Crear un Agente

```bash
curl -X POST http://localhost:8001/agents/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Agente",
    "system_prompt": "Eres un asistente útil que ayuda a consultar información.",
    "selected_scopes": "categories:read, trips:read",
    "api_key_id": 1,
    "model": "gpt-4o",
    "temperature": 0.0
  }'
```

El agente solo tendrá acceso a las tools correspondientes a los scopes seleccionados.

#### 3. Chatear con el Agente

```bash
curl -X POST http://localhost:8001/chat/1 \
  -H "Content-Type: application/json" \
  -d '{"message": "¿cuáles son las categorías?", "conversation_id": "mi-sesion"}'
```

La respuesta incluye el texto del agente y métricas de ejecución:

```json
{
  "response": "Las categorías disponibles son...",
  "metrics": {
    "prompt_tokens": 1234,
    "completion_tokens": 56,
    "total_tokens": 1290,
    "llm_calls": 2,
    "duration_seconds": 3.41,
    "tools_used": [
      {
        "name": "categories_list_categories",
        "status": "success",
        "payload": {},
        "result_preview": "..."
      }
    ],
    "errors": []
  }
}
```

---

## API Reference

### API Keys

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api_keys/` | Registrar una API key (valida y descubre scopes) |
| `GET` | `/api_keys/` | Listar todas las API keys |
| `POST` | `/api_keys/{id}/refresh-scopes` | Re-descubrir scopes de una key existente |

### Agents

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/agents/` | Crear un agente |
| `GET` | `/agents/` | Listar todos los agentes |
| `PUT` | `/agents/{id}` | Actualizar configuración de un agente |

### Chat

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/chat/{agent_id}` | Enviar mensaje a un agente (con memoria de conversación) |
| `DELETE` | `/chat/conversations/{conversation_id}` | Limpiar historial de una conversación |

### MCP (Streamable HTTP)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET/POST/DELETE` | `/mcp/{agent_id}` | Endpoint MCP Streamable HTTP para clientes MCP externos |

---

## Arquitectura del Backend

### Flujo de una petición de Chat

```
POST /chat/{agent_id}
    │
    ▼
chat_router.py
    │  Busca el Agent en BD
    ▼
agent_service.py  (run_chat)
    │  Verifica cache del executor
    │  Si expiró o no existe:
    │      │
    │      ▼
    │  mcp_service.py  (create_server)
    │      │  Pide capabilities filtradas por scopes
    │      ▼
    │  permissions_service.py  (fetch_capabilities)
    │      │  Obtiene JWT via auth_service
    │      │  Llama a GET /my-permissions
    │      │  Filtra por selected_scopes (o incluye todo si '*')
    │      │
    │      ▼
    │  Registra tools en FastMCP → convierte a LangChain StructuredTools
    │
    ▼
LangGraph ReAct Agent  (LLM + Tools)
    │  El LLM decide qué tools llamar
    │  Cada tool ejecuta un HTTP request autenticado al backend externo
    │
    ▼
Respuesta + Métricas (tokens, tools usados, duración, errores)
```

### Services

| Servicio | Responsabilidad |
|---|---|
| `auth_service.py` | Obtener y cachear JWTs a partir de API keys |
| `permissions_service.py` | Consultar `/my-permissions`, filtrar capabilities por scopes, ejecutar API calls autenticados, y resolver scopes wildcard |
| `mcp_service.py` | Construir instancias FastMCP con tools dinámicas basadas en capabilities |
| `agent_service.py` | Orquestar la ejecución del LLM con LangGraph, gestionar cache de executors y memoria de conversaciones |

### Manejo de Scopes

Los scopes controlan qué endpoints del backend externo puede usar cada agente:

- **Scopes específicos** (ej: `trips:read, categories:update`): El agente solo ve las tools de esos scopes.
- **Wildcard `*`**: El agente tiene acceso a **todas** las capabilities. Cuando una API key tiene `*` en su JWT, el dashboard resuelve automáticamente el wildcard consultando `/my-permissions` y extrayendo todos los scopes únicos disponibles.
- **Cache**: Los executors de agentes se cachean por `AGENT_CACHE_TTL` segundos (default: 300). Cuando el cache expira, se re-consultan los permisos para capturar cambios.

### Chat con Memoria

Cada conversación tiene un `conversation_id` que actúa como `thread_id` para el checkpointer de LangGraph (`MemorySaver`). Esto permite:
- El agente recuerda mensajes previos dentro de la misma conversación
- Cada nuevo mensaje solo envía el texto del usuario; el historial se gestiona internamente
- `DELETE /chat/conversations/{id}` limpia el historial

### Métricas de Ejecución

Cada respuesta del chat incluye métricas detalladas:

| Métrica | Descripción |
|---|---|
| `prompt_tokens` | Tokens de entrada consumidos |
| `completion_tokens` | Tokens de salida generados |
| `total_tokens` | Total de tokens consumidos |
| `llm_calls` | Número de llamadas al LLM (puede ser >1 si usa tools) |
| `duration_seconds` | Tiempo total de ejecución |
| `tools_used[]` | Lista de tools invocadas con nombre, payload, status y preview del resultado |
| `errors[]` | Errores durante la ejecución |

---

## Frontend

El frontend es una SPA (Single Page Application) construida con **React + Vite**:

### Componentes

| Componente | Descripción |
|---|---|
| `App.jsx` | Layout principal con sidebar de navegación |
| `ApiKeysManager.jsx` | CRUD de API keys con botón de refresh scopes |
| `AgentsManager.jsx` | CRUD de agentes con selector de scopes, modelo y temperatura |
| `Chat.jsx` | Chat interactivo con renderizado Markdown, imágenes y panel de métricas |

### Dependencias principales

| Paquete | Uso |
|---|---|
| `react-markdown` + `remark-gfm` | Renderizar respuestas del agente con formato Markdown (negritas, tablas, listas, código, imágenes) |
| `lucide-react` | Iconos (Bot, User, Send, Loader, etc.) |
| `axios` | HTTP client para comunicarse con el backend |

---

## Estructura del Proyecto

```
prueba_dashboard/
├── backend/
│   ├── main.py                      # FastAPI app + lifespan
│   ├── config.py                    # Settings centralizados (.env)
│   ├── database.py                  # SQLite + SQLModel engine
│   ├── models.py                    # Entidades: Agent, ApiKey + schemas
│   ├── repositories/
│   │   ├── api_key_repository.py    # CRUD ApiKey
│   │   └── agent_repository.py      # CRUD Agent
│   ├── services/
│   │   ├── auth_service.py          # JWT fetch + cache
│   │   ├── permissions_service.py   # /my-permissions, scope resolution, API calls
│   │   ├── mcp_service.py           # FastMCP tool builder
│   │   └── agent_service.py         # LangGraph ReAct agent orchestration
│   └── routers/
│       ├── api_key_router.py        # POST/GET /api_keys/, refresh-scopes
│       ├── agent_router.py          # POST/GET/PUT /agents/
│       ├── chat_router.py           # POST /chat/{id}, DELETE conversations
│       └── mcp_router.py            # Streamable HTTP MCP endpoint
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Layout + routing
│   │   ├── index.css                # Estilos globales (dark theme)
│   │   └── components/
│   │       ├── ApiKeysManager.jsx   # Gestión de API keys
│   │       ├── AgentsManager.jsx    # Gestión de agentes
│   │       └── Chat.jsx             # Chat con Markdown + métricas
│   └── package.json
├── docs/
│   └── mcp_integration_guide.md     # Guía de integración MCP completa
├── .env                             # Variables de entorno (no comitear)
├── .env.example                     # Template de variables de entorno
└── .gitignore
```

## Licencia

MIT
