# AnythingLLM Rebuild — Deployment Handoff

> **Purpose of this document**: You are an AI assistant taking over the deployment phase of a project called `anything-llm-rebuild`. This document tells you exactly what has been built, what state the codebase is in, what still needs to be done, and how to deploy it. Read this fully before writing any code.

---

## 1. What This Project Is

A **from-scratch rebuild of [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm)** — a production-grade AI chat application that lets users:

- Create workspaces and upload documents (PDF, TXT, MD)
- Chat with an LLM using RAG (document context injected into prompts)
- Use agent mode — LLM autonomously calls tools (web search, document search, GitHub via MCP)
- Manage multiple users with admin controls and invite system
- Organize conversations into threads (like ChatGPT's conversation history)

**The rebuild is complete for development.** The only remaining task is **Dockerizing all 3 services and deploying** to a free cloud platform.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v20 LTS |
| Package manager | Yarn v1 (workspaces monorepo) |
| Backend API | Express.js |
| Database | SQLite (via Prisma ORM) |
| Vector DB | LanceDB (local, file-based) |
| Embeddings | Google Gemini (`gemini-embedding-001`) |
| LLM (chat) | OpenAI `gpt-4o-mini` OR Gemini (runtime-switchable) |
| LLM (agent) | OpenAI `gpt-4o-mini` (Gemini also supported) |
| Agent tools | DuckDuckGo web search, RAG document search, GitHub MCP |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |
| Auth | JWT (HS256) + bcrypt |
| File processing | Multer + pdf-parse + LangChain text splitter |

---

## 3. Monorepo Structure

```
anything-llm-rebuild/          ← Yarn workspace root
├── package.json               ← workspace definition
├── server/                    ← Express API (port 3001)
│   ├── index.js               ← entry point
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma      ← SQLite DB schema
│   │   └── migrations/        ← 4 migration files
│   ├── endpoints/             ← Express route handlers
│   │   ├── auth.js            ← login, register
│   │   ├── setup.js           ← first-run admin setup
│   │   ├── chat.js            ← RAG chat + streaming
│   │   ├── agent.js           ← agent mode SSE stream
│   │   ├── document.js        ← upload, list, delete docs
│   │   ├── thread.js          ← thread CRUD
│   │   ├── admin.js           ← user/invite/workspace mgmt
│   │   └── systemSettings.js  ← LLM config, MCP status
│   ├── models/                ← Prisma query helpers
│   │   ├── user.js
│   │   ├── workspace.js
│   │   ├── workspaceChats.js
│   │   ├── workspaceDocument.js
│   │   ├── workspaceUser.js
│   │   ├── invite.js
│   │   ├── thread.js
│   │   ├── systemSettings.js  ← DB settings + encrypted secrets
│   │   └── prisma.js          ← Prisma client singleton
│   ├── utils/
│   │   ├── auth.js            ← JWT middleware
│   │   ├── crypto.js          ← AES-256-GCM encrypt/decrypt
│   │   ├── logger.js          ← Winston logger
│   │   ├── AiProviders/       ← OpenAI + Gemini providers
│   │   │   ├── index.js       ← getProvider() factory
│   │   │   ├── openAi/index.js
│   │   │   └── gemini/index.js
│   │   ├── EmbeddingEngines/  ← Gemini embedder
│   │   │   ├── index.js       ← getEmbedder() factory
│   │   │   └── gemini/index.js
│   │   ├── vectorDbProviders/ ← LanceDB adapter
│   │   │   ├── index.js       ← getVectorDb() factory
│   │   │   └── lance/index.js
│   │   ├── AgentEngine/       ← tool-calling loop
│   │   │   ├── index.js       ← OpenAI + Gemini loops
│   │   │   └── tools/
│   │   │       ├── searchDocuments.js
│   │   │       └── webSearch.js
│   │   └── McpClient/         ← MCP server manager
│   │       └── index.js
│   └── storage/               ← GITIGNORED — runtime data
│       ├── anythingllm.db     ← SQLite file
│       └── lancedb/           ← vector store files
├── collector/                 ← Document parser microservice (port 8888)
│   ├── index.js               ← Express app with /process endpoint
│   ├── package.json
│   └── utils/
│       ├── extract.js         ← PDF/TXT/MD text extraction
│       └── chunk.js           ← LangChain recursive text splitter
└── frontend/                  ← React + Vite SPA (port 3000 in dev)
    ├── index.html
    ├── vite.config.js         ← proxies /api/* to localhost:3001 in dev
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx            ← React Router routes
    │   ├── api/client.js      ← all fetch calls to backend
    │   ├── contexts/AuthContext.jsx
    │   ├── components/
    │   │   ├── ProtectedRoute.jsx
    │   │   └── WorkspaceChat/
    │   │       ├── index.jsx            ← workspace layout + header
    │   │       ├── ChatContainer/       ← message state + send logic
    │   │       │   ├── index.jsx
    │   │       │   ├── ChatHistory/
    │   │       │   ├── PromptInput/
    │   │       │   └── AgentThinking/   ← shows tool call steps
    │   │       ├── DocumentPanel/       ← upload + list docs
    │   │       └── ThreadSidebar/       ← thread management
    │   └── pages/
    │       ├── Login.jsx
    │       ├── Register.jsx             ← invite-based registration
    │       ├── Setup.jsx                ← first-run admin setup
    │       ├── Workspace.jsx
    │       └── Settings/
    │           ├── LLMPreference.jsx    ← switch OpenAI ↔ Gemini
    │           ├── UserManagement.jsx   ← admin: users + invites
    │           └── MCPServers.jsx       ← admin: MCP status
    └── tailwind.config.js
```

---

## 4. Database Schema (Prisma + SQLite)

```
User              — id, username, password(bcrypt), role(admin|default), suspended
SystemSettings    — id, label, value  (key-value config + AES-256 encrypted secrets)
Workspace         — id, name, slug
WorkspaceUser     — userId ↔ workspaceId join table
WorkspaceDocument — id, workspaceId, docId, title, mimeType, wordCount, chunkCount
WorkspaceChat     — id, workspaceId, userId, threadId?, prompt, response
Thread            — id, workspaceId, userId, name, slug
Invite            — id, token(uuid), used, createdById, claimedById
```

All migrations are in `server/prisma/migrations/`. On first run, `prisma migrate deploy` applies them.

---

## 5. All API Endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/ping` | none | health check |
| GET | `/api/health` | none | service info |
| POST | `/api/setup/create` | none | first-run admin creation |
| GET | `/api/setup/status` | none | has setup been done? |
| POST | `/api/auth/login` | none | returns JWT |
| POST | `/api/auth/register` | none | invite-based registration |

### Chat & Workspace
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/workspaces` | JWT | list all workspaces |
| POST | `/api/workspaces` | JWT | create workspace |
| POST | `/api/workspace/:slug/chat` | JWT | non-streaming chat |
| POST | `/api/workspace/:slug/stream-chat` | JWT | SSE streaming chat |
| POST | `/api/workspace/:slug/agent-chat` | JWT | SSE agent mode |
| GET | `/api/workspace/:slug/chats` | JWT | chat history |
| DELETE | `/api/workspace/:slug/chats` | JWT | clear history |

### Documents
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/workspace/:slug/documents` | JWT | upload file |
| GET | `/api/workspace/:slug/documents` | JWT | list docs |
| DELETE | `/api/workspace/:slug/documents/:docId` | JWT | delete doc |

### Threads
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/workspace/:slug/threads` | JWT | list threads |
| POST | `/api/workspace/:slug/threads` | JWT | create thread |
| PATCH | `/api/workspace/:slug/threads/:threadSlug` | JWT | rename thread |
| DELETE | `/api/workspace/:slug/threads/:threadSlug` | JWT | delete thread |
| GET | `/api/workspace/:slug/threads/:threadSlug/chats` | JWT | thread history |
| DELETE | `/api/workspace/:slug/threads/:threadSlug/chats` | JWT | clear thread |

### Admin (admin role only)
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | list users |
| POST | `/api/admin/users/:id/suspend` | suspend user |
| POST | `/api/admin/users/:id/unsuspend` | unsuspend user |
| POST | `/api/admin/users/:id/role` | change role |
| DELETE | `/api/admin/users/:id` | delete user |
| POST | `/api/admin/invites` | create invite token |
| GET | `/api/admin/invites` | list invites |
| DELETE | `/api/admin/invites/:id` | delete invite |
| POST | `/api/admin/workspaces/:slug/users` | grant workspace access |
| DELETE | `/api/admin/workspaces/:slug/users/:userId` | revoke access |
| GET | `/api/admin/mcp/servers` | MCP server status |

### Settings
| Method | Path | Description |
|---|---|---|
| GET | `/api/system/settings` | get all settings |
| POST | `/api/system/settings` | update LLM config |

---

## 6. Environment Variables (server/.env)

```env
SERVER_PORT=3001
NODE_ENV=production

# Generate with: openssl rand -hex 32
JWT_SECRET=<long-random-string>
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=<64-char-hex-string>

# LLM provider: "openai" or "gemini"
LLM_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Google Gemini (used for embeddings even if LLM_PROVIDER=openai)
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# MCP (optional) — external tool servers for agent mode
GITHUB_TOKEN=ghp_...
MCP_SERVERS={"github":{"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_TOKEN":"ghp_your_token"}}}
```

**Important notes for production:**
- `GEMINI_API_KEY` is always required for embeddings (even when `LLM_PROVIDER=openai`)
- `OPENAI_API_KEY` needed when `LLM_PROVIDER=openai`
- `MCP_SERVERS` is optional — remove it if not using GitHub tools
- `JWT_SECRET` and `ENCRYPTION_KEY` must be stable across restarts (stored secrets are encrypted with `ENCRYPTION_KEY`)
- The SQLite DB and LanceDB files must be on a **persistent volume** — they are NOT stored in the image

---

## 7. How Services Communicate

```
User Browser
    │
    ▼
[frontend: Nginx, port 80]
    │
    ├── /api/*  ──proxy──▶  [server: Express, port 3001]
    │                            │
    │                            ├── POST /process ──▶ [collector: Express, port 8888]
    │                            │   (file upload pipeline)
    │                            │
    │                            ├── SQLite ──▶ /data/db/anythingllm.db (volume)
    │                            └── LanceDB ──▶ /data/vectordb/ (volume)
    │
    └── /*      ──▶ index.html (React SPA handles routing in browser)
```

The collector is an **internal service** — it is not exposed to the browser. Only the server calls it.

---

## 8. What Needs to Be Built (Your Task)

You need to create the following files **exactly as described**. Do not modify any existing source files unless explicitly noted.

---

### 8.1 `server/Dockerfile`

Multi-stage is not needed — server is always running. Use Node 20 Alpine.

```dockerfile
FROM node:20-alpine

# Install build tools needed for native modules (lancedb uses Rust-compiled binaries)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first (Docker layer caching — only reinstalls if deps change)
COPY package.json yarn.lock ./
COPY server/package.json ./server/

# Install only server dependencies (not the whole monorepo)
RUN yarn workspace anything-llm-server install --frozen-lockfile --production

# Copy server source
COPY server/ ./server/

# Run Prisma migrations on startup, then start the server
# Use sh -c so we can chain commands
WORKDIR /app/server

EXPOSE 3001

# prisma migrate deploy applies pending migrations against the DB in the volume
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
```

**Key points:**
- `apk add python3 make g++` is required — LanceDB has native bindings compiled from C++
- `npx prisma migrate deploy` runs on every container start — it's idempotent (skips already-applied migrations)
- The SQLite file is at `server/storage/anythingllm.db` — this path must be mounted as a volume

---

### 8.2 `server/.dockerignore`

```
node_modules
storage
.env
*.log
scripts/
```

---

### 8.3 `collector/Dockerfile`

```dockerfile
FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json yarn.lock ./
COPY collector/package.json ./collector/

RUN yarn workspace anything-llm-collector install --frozen-lockfile --production

COPY collector/ ./collector/

WORKDIR /app/collector

EXPOSE 8888

CMD ["node", "index.js"]
```

---

### 8.4 `collector/.dockerignore`

```
node_modules
hotdir
.env
*.log
```

---

### 8.5 `frontend/Dockerfile`

Two-stage build:
- **Stage 1**: Node 20 — runs `vite build` to produce static files in `dist/`
- **Stage 2**: Nginx Alpine — serves the static files and proxies `/api/*` to the server

```dockerfile
# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
COPY frontend/package.json ./frontend/

RUN yarn workspace anything-llm-frontend install --frozen-lockfile

COPY frontend/ ./frontend/

# VITE_API_URL tells the frontend where /api requests go in production.
# In Docker, the Nginx reverse proxy handles this internally, so we leave it empty.
# The build bakes this value in at compile time.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/frontend
RUN yarn build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx site config
RUN rm /etc/nginx/conf.d/default.conf

# Our custom config (see 8.6 below)
COPY frontend/nginx.conf /etc/nginx/conf.d/app.conf

# Copy the built React app from stage 1
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

### 8.6 `frontend/nginx.conf`

This config does three things:
1. Serves the React SPA (all unknown routes → `index.html` for client-side routing)
2. Proxies `/api/*` to the backend `server` container
3. Proxies `/collector/*` to the collector (if needed from browser — currently server-only)

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Proxy all /api/* requests to the Express server
    location /api/ {
        proxy_pass http://server:3001;
        proxy_http_version 1.1;

        # Required for SSE (Server-Sent Events) — agent mode and streaming chat
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    # React SPA — serve index.html for any unknown path
    # This allows React Router to handle /workspace/default, /settings/llm, etc.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

### 8.7 `frontend/.dockerignore`

```
node_modules
dist
.env
*.log
```

---

### 8.8 `docker-compose.yml` (root of project)

This is the most important file. It wires all 3 services together.

```yaml
version: "3.9"

services:

  # ── Document parser ──────────────────────────────────────────────────────────
  collector:
    build:
      context: .
      dockerfile: collector/Dockerfile
    restart: unless-stopped
    environment:
      COLLECTOR_PORT: 8888
      NODE_ENV: production
    # Not exposed to host — only server talks to it
    networks:
      - internal

  # ── Express API + Agent ──────────────────────────────────────────────────────
  server:
    build:
      context: .
      dockerfile: server/Dockerfile
    restart: unless-stopped
    env_file:
      - ./server/.env          # All secrets loaded from here
    environment:
      NODE_ENV: production
      # Override collector URL so server can reach the collector container
      COLLECTOR_URL: http://collector:8888
    volumes:
      # Persistent storage — SQLite DB + LanceDB vector files
      - app_data:/app/server/storage
    depends_on:
      - collector
    networks:
      - internal

  # ── React frontend served by Nginx ──────────────────────────────────────────
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    restart: unless-stopped
    ports:
      - "80:80"               # ← This is the only port exposed to the internet
    depends_on:
      - server
    networks:
      - internal

# ── Volumes ───────────────────────────────────────────────────────────────────
volumes:
  app_data:                   # SQLite + LanceDB persist here across restarts

# ── Internal network (containers talk to each other by service name) ──────────
networks:
  internal:
    driver: bridge
```

**Key design decisions:**
- Only port 80 (frontend/Nginx) is exposed — server and collector are internal-only
- `app_data` volume persists across container restarts so chat history and documents are not lost
- `env_file: ./server/.env` — secrets stay out of the image
- `COLLECTOR_URL: http://collector:8888` overrides any localhost URL in code

---

### 8.9 Code change needed: make collector URL configurable

Currently in `server/endpoints/document.js`, the collector is called with a hardcoded `localhost` URL. Before building Docker images, update it to read from an env var:

Find the line in `server/endpoints/document.js` where it calls the collector (something like `http://localhost:8888`). Change it to:

```javascript
const COLLECTOR_URL = process.env.COLLECTOR_URL ?? "http://localhost:8888";
```

Then use `COLLECTOR_URL` instead of the hardcoded string everywhere in that file.

---

### 8.10 `.env.docker.example` (root of project)

Create this file as a template for anyone deploying with Docker:

```env
# Copy to server/.env and fill in your values before running docker compose up

SERVER_PORT=3001
NODE_ENV=production

# Generate secrets:  openssl rand -hex 32
JWT_SECRET=REPLACE_ME_with_64_random_chars
ENCRYPTION_KEY=REPLACE_ME_with_64_random_chars

# ── LLM ────────────────────────────────────────────────────────────────────
# "openai" or "gemini"
LLM_PROVIDER=openai

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Gemini is required for embeddings even if LLM_PROVIDER=openai
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# ── MCP (optional) ─────────────────────────────────────────────────────────
# Remove these two lines if you don't need GitHub tools
GITHUB_TOKEN=ghp_...
MCP_SERVERS={"github":{"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_TOKEN":"ghp_your_token_here"}}}
```

---

## 9. Build & Run Commands

Once all Docker files are created:

```bash
# From the project root (anything-llm-rebuild/)

# Build all 3 images
docker compose build

# Start everything (first run creates the volume and DB)
docker compose up -d

# Watch logs
docker compose logs -f

# Stop everything
docker compose down

# Stop AND delete the volume (WARNING: deletes all data)
docker compose down -v
```

Open http://localhost in your browser. First time: you'll be redirected to `/setup` to create the admin account.

---

## 10. Known Issues & Optimizations Needed

### Critical (must fix before production)

| # | Issue | Where | Fix |
|---|---|---|---|
| 1 | Collector URL hardcoded as `localhost` | `server/endpoints/document.js` | Use `process.env.COLLECTOR_URL ?? "http://localhost:8888"` |
| 2 | `storage/` folder (SQLite + LanceDB) is inside the server build context | `server/.dockerignore` | Add `storage/` to `.dockerignore` so it's excluded from image |
| 3 | No `prisma generate` step before running server | `server/Dockerfile` | Add `npx prisma generate` before `migrate deploy` in CMD |

### Recommended before launch

| # | Issue | Recommendation |
|---|---|---|
| 4 | MCP uses `npx -y @modelcontextprotocol/server-github` inside Docker | The container needs `npx` + internet access to pull the MCP package. Either pre-install it (`npm install -g @modelcontextprotocol/server-github`) in the Dockerfile or mount it as a volume |
| 5 | No rate limiting on API | Add `express-rate-limit` to protect `/api/auth/login` from brute force |
| 6 | `CORS` currently allows all origins (`origin: true`) | In production, set `CORS_ORIGIN=https://yourdomain.com` and restrict in `server/index.js` |
| 7 | No HTTPS termination | Use a reverse proxy like Caddy or Nginx on the host, OR use Railway/Render which handle TLS automatically |
| 8 | Large file uploads may time out | Increase `proxy_read_timeout` in nginx.conf (already set to 300s — should be fine) |
| 9 | LanceDB native binaries | The `apk add python3 make g++` in Dockerfile handles compilation on Alpine. Test the build — if it fails, switch to `node:20-slim` (Debian) which has compilers more readily available |

---

## 11. Free Deployment Options

### Option A — Railway (Recommended, easiest)

Railway can deploy directly from GitHub — no pushing Docker images manually.

1. Push the repo to GitHub (`git push origin main`)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the repo
4. Railway auto-detects the `docker-compose.yml` — it deploys all 3 services
5. Set env vars in the Railway dashboard (copy from `server/.env`)
6. Railway gives you a free `.railway.app` domain with HTTPS

**Free tier:** 500 hours/month, 1GB RAM, 1GB disk per service. Sufficient for personal/demo use.

### Option B — Render

1. Go to [render.com](https://render.com) → New → Docker
2. Connect GitHub repo
3. Point to each Dockerfile separately (3 services = 3 Render services)
4. Set env vars in the Render dashboard
5. For the volume: create a Render Disk and mount it to `/app/server/storage`

**Free tier:** Services spin down after 15 min of inactivity (cold start ~30s). Works for demos.

### Option C — Push to Docker Hub then deploy anywhere

```bash
# Tag and push
docker tag anything-llm-rebuild-server yourdockerhubuser/allm-server:latest
docker tag anything-llm-rebuild-frontend yourdockerhubuser/allm-frontend:latest
docker tag anything-llm-rebuild-collector yourdockerhubuser/allm-collector:latest

docker push yourdockerhubuser/allm-server:latest
docker push yourdockerhubuser/allm-frontend:latest
docker push yourdockerhubuser/allm-collector:latest

# Then deploy on any VPS (DigitalOcean $4/mo, Hetzner €3/mo, etc.)
# with docker compose pull && docker compose up -d
```

---

## 12. Verification Checklist After Deployment

Run these checks to confirm everything works:

- [ ] `GET https://yourdomain.com/api/health` → `{"status":"ok"}`
- [ ] Open `https://yourdomain.com` → redirects to `/setup` (first run) or `/login`
- [ ] Complete admin setup → login → see workspace
- [ ] Upload a PDF → document appears in document panel
- [ ] Ask a question → RAG response cites the uploaded document
- [ ] Enable agent mode → ask "search the web for AI news" → see tool call indicator
- [ ] Go to `/settings/mcp` → GitHub server shows as connected with 26 tools
- [ ] Create a second user via invite → invite link works → login as second user

---

## 13. Repository

GitHub: [https://github.com/Jayasoruban/anything-llm-rebuild](https://github.com/Jayasoruban/anything-llm-rebuild)

The `server/.env` is gitignored. You will need to supply environment variables separately when deploying.

---

*This document was generated to hand off Phase 9B (Docker + Deploy) of the anything-llm-rebuild project. All source code through Phase 9A (MCP integration) is complete and working locally.*
