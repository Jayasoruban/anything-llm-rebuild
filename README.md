# AnythingLLM — Rebuilt from Scratch

> A production-grade AI workspace rebuilt from zero — RAG, agents, MCP, multi-user, Docker-deployed.

This is a **faithful rebuild** of [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm), hand-written from scratch by [@jayasoruban](https://github.com/jayasoruban) to deeply understand production LLM systems. Every line of code was written without copying the original — the original serves only as an architectural reference.

**Reading code teaches you 10%. Rebuilding it teaches you 100%.**

---

## What it does

- 📁 **Workspaces** — create isolated chat environments, each with their own documents and history
- 📄 **Document ingestion** — upload PDF, TXT, MD files; they're chunked, embedded, and stored in a vector DB
- 🤖 **RAG chat** — your questions are answered using context retrieved from your documents
- ⚡ **Streaming** — responses stream token-by-token via SSE (Server-Sent Events)
- 🛠️ **Agent mode** — the LLM autonomously calls tools: web search, document search, GitHub via MCP
- 🧵 **Threads** — organize conversations into named threads per workspace (like ChatGPT's sidebar)
- 👥 **Multi-user** — admin + default roles, invite-based registration, per-workspace access control
- ⚙️ **Settings** — switch between OpenAI and Gemini at runtime without restarting

---

## Architecture

Three Node.js services + a React SPA:

```
User Browser
     │
     ▼
┌─────────────────┐
│    frontend     │  React 18 + Vite + Tailwind CSS
│   Nginx :80     │  Served as static files
└────────┬────────┘
         │  /api/* (reverse proxy)
         ▼
┌─────────────────┐        ┌─────────────────┐
│     server      │──────▶│    collector    │
│  Express :3001  │  HTTP  │  Express :8888  │
│  Prisma + JWT   │        │  PDF/TXT parser │
│  Agent engine   │        └─────────────────┘
│  MCP client     │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌─────────┐
│ SQLite │ │ LanceDB │
│Prisma  │ │ vectors │
└────────┘ └─────────┘
```

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Package manager | Yarn v1 workspaces (monorepo) |
| Backend API | Express.js |
| Database | SQLite via Prisma ORM |
| Vector DB | LanceDB (local, file-based) |
| Embeddings | Google Gemini `gemini-embedding-001` |
| LLM | OpenAI `gpt-4o-mini` or Gemini (runtime-switchable) |
| Agent tools | DuckDuckGo web search, RAG document search, GitHub via MCP |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |
| Auth | JWT (HS256) + bcrypt |
| File processing | Multer + pdf-parse + LangChain text splitter |
| Production serving | Nginx (reverse proxy + static files) |
| Containerisation | Docker + Docker Compose |

---

## Project structure

```
anything-llm-rebuild/
├── package.json               ← Yarn workspace root
├── docker-compose.yml         ← Local Docker orchestration
├── .env.docker.example        ← Environment variable template
│
├── server/                    ← Express API (port 3001)
│   ├── Dockerfile
│   ├── index.js
│   ├── prisma/schema.prisma   ← SQLite schema (8 models)
│   ├── endpoints/             ← auth, chat, agent, documents, threads, admin
│   ├── models/                ← Prisma query helpers
│   └── utils/
│       ├── AiProviders/       ← OpenAI + Gemini provider abstraction
│       ├── EmbeddingEngines/  ← Gemini embedder
│       ├── vectorDbProviders/ ← LanceDB adapter
│       ├── AgentEngine/       ← tool-calling loop + tools
│       └── McpClient/         ← MCP server manager
│
├── collector/                 ← Document parser microservice (port 8888)
│   ├── Dockerfile
│   └── utils/extract.js + chunk.js
│
└── frontend/                  ← React + Vite SPA
    ├── Dockerfile             ← 2-stage: Node build → Nginx serve
    ├── nginx.conf             ← reverse proxy + SPA routing
    ├── docker-entrypoint.sh   ← injects BACKEND_URL at runtime
    └── src/
        ├── api/client.js      ← all API calls
        ├── contexts/AuthContext.jsx
        └── components/
            └── WorkspaceChat/ ← chat UI, document panel, thread sidebar
```

---

## Build phases completed

- [x] **Phase 0** — Monorepo scaffold, 3 services boot
- [x] **Phase 1** — Minimal single-workspace chat (OpenAI)
- [x] **Phase 2** — SSE streaming responses
- [x] **Phase 3** — Provider abstraction (OpenAI ↔ Gemini, runtime-switchable)
- [x] **Phase 4** — Document ingestion pipeline (upload → chunk → embed → store)
- [x] **Phase 5** — RAG — retrieve relevant chunks, inject as context
- [x] **Phase 6** — Multi-user mode, roles, invite-based registration
- [x] **Phase 7** — Chat threads (per-workspace conversation history)
- [x] **Phase 8** — Agent mode (tool-calling loop, web search, document search)
- [x] **Phase 9** — MCP integration (GitHub tools via Model Context Protocol)
- [x] **Phase 10** — Docker + production deployment (Nginx, multi-stage builds, Railway)

---

## Running locally (dev mode)

### Prerequisites

- Node.js 20+
- Yarn 1.x
- A Gemini API key (free at [aistudio.google.com](https://aistudio.google.com)) — always required for embeddings
- An OpenAI API key if using `LLM_PROVIDER=openai`

### Setup

```bash
git clone https://github.com/jayasoruban/anything-llm-rebuild.git
cd anything-llm-rebuild

# Install all workspace dependencies
yarn install

# Configure environment
cp server/.env.example server/.env
# Edit server/.env and fill in your API keys
```

### Run

Open three terminals:

```bash
yarn dev:server      # Express API  → http://localhost:3001
yarn dev:collector   # Doc parser   → http://localhost:8888
yarn dev:frontend    # React + Vite → http://localhost:3000
```

Browse to `http://localhost:3000`. First visit redirects to `/setup` to create your admin account.

---

## Running with Docker (local)

```bash
# Copy and fill in your env file
cp .env.docker.example server/.env
# Edit server/.env — add your real API keys + generate JWT_SECRET and ENCRYPTION_KEY

# Build all 3 images
docker compose build

# Start everything
docker compose up -d

# Watch logs
docker compose logs -f

# Stop
docker compose down
```

Open `http://localhost` — same setup flow as dev mode.

> **Generate secrets:**
> ```bash
> openssl rand -hex 32   # use once for JWT_SECRET
> openssl rand -hex 32   # use again for ENCRYPTION_KEY
> ```

---

## Deploying to Railway

Railway gives you free HTTPS hosting with persistent volumes and no hibernation.

### 1. Push to GitHub (already done if you're reading this)

### 2. Create a Railway project

Go to [railway.app](https://railway.app) → New Project → Empty Project.

### 3. Add 3 services from the same GitHub repo

For each service, choose **GitHub Repo** → select this repo → cancel auto-deploy → configure:

| Service | Dockerfile Path | Build Context | Public Domain | Port |
|---|---|---|---|---|
| `collector` | `collector/Dockerfile` | `/` | ❌ internal only | 8888 |
| `server` | `server/Dockerfile` | `/` | ❌ internal only | 3001 |
| `frontend` | `frontend/Dockerfile` | `/` | ✅ yes | 80 |

### 4. Add a volume to the server service

In the server service → **Volumes** tab → Add Volume → mount path: `/app/server/storage`

This persists your SQLite database and LanceDB vector files across deployments.

### 5. Set environment variables

**collector:**
```
COLLECTOR_PORT=8888
NODE_ENV=production
```

**server** (copy from your `server/.env`):
```
NODE_ENV=production
SERVER_PORT=3001
JWT_SECRET=...
ENCRYPTION_KEY=...
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
COLLECTOR_URL=http://collector.railway.internal:8888
```

**frontend:**
```
BACKEND_URL=http://server.railway.internal:3001
```

### 6. Deploy and verify

Once all 3 services are green, open your Railway frontend URL.

```
GET https://your-app.railway.app/api/health
→ {"status":"ok","service":"anything-llm-server"}
```

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | ✅ | 64-char hex string for signing JWTs |
| `ENCRYPTION_KEY` | ✅ | 64-char hex string for AES-256-GCM secret encryption |
| `GEMINI_API_KEY` | ✅ | Always required — used for embeddings even when LLM is OpenAI |
| `LLM_PROVIDER` | ✅ | `openai` or `gemini` |
| `OPENAI_API_KEY` | if OpenAI | Required when `LLM_PROVIDER=openai` |
| `COLLECTOR_URL` | ✅ in Docker | URL the server uses to reach the collector |
| `GITHUB_TOKEN` | optional | Enables GitHub MCP tools in agent mode |
| `MCP_SERVERS` | optional | JSON config for MCP server connections |

---

## API overview

| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/setup/status` |
| Workspaces | `GET/POST /api/workspaces`, `GET /api/workspace/:slug/chats` |
| Chat | `POST /api/workspace/:slug/stream-chat` (SSE), `POST /api/workspace/:slug/agent-chat` (SSE) |
| Documents | `POST /api/workspace/:slug/upload`, `GET/DELETE /api/workspace/:slug/documents` |
| Threads | `GET/POST /api/workspace/:slug/threads`, `PATCH/DELETE /api/workspace/:slug/threads/:slug` |
| Admin | `GET/POST/DELETE /api/admin/users`, `POST /api/admin/invites` |
| Settings | `GET/POST /api/system/settings` |

Full endpoint list in [`docs/03-deployment-handoff.md`](./docs/03-deployment-handoff.md).

---

## License

MIT — see [LICENSE](./LICENSE).

Inspired by and modelled after [AnythingLLM by Mintplex Labs](https://github.com/Mintplex-Labs/anything-llm).
