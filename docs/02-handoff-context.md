# anything-llm-rebuild — Full Project Handoff Context

> Give this entire file to an AI assistant to fully brief it on the project, what has been built, and what is left to do.

---

## 1. What This Project Is

We are rebuilding [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) from scratch to understand how a production-grade AI document chat platform is architectured and implemented.

**AnythingLLM** is a full-stack platform where you:
- Upload documents (PDF, TXT, DOCX)
- The documents are chunked, embedded into vectors, stored in a vector DB
- Users chat with those documents — the AI answers with grounded context from the docs
- Admin can switch LLM providers (OpenAI, Anthropic, Ollama, etc.) from a UI
- Supports multi-user, multi-workspace, agent mode, MCP integration

**Our rebuild** keeps the exact same architectural patterns and design decisions, but limits fan-out (2 providers instead of 37, 2 vector DBs instead of 10). The goal is to deeply understand the production patterns by building them yourself.

**GitHub repo:** `github.com/Jayasoruban/anything-llm-rebuild`

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | v20 LTS |
| Package manager | Yarn | v1.22 (workspaces) |
| Database | SQLite (dev) / PostgreSQL (prod) | via Prisma 6.x |
| ORM | Prisma | 6.16.x |
| Backend framework | Express | 4.x |
| Frontend framework | React | 18.2 |
| Frontend build | Vite | 5.x |
| CSS | Tailwind CSS | 3.x |
| Auth | bcrypt + JWT (jsonwebtoken) | — |
| LLM providers | OpenAI SDK, `@google/genai` | — |
| Embedding | Google Gemini `text-embedding-004` | — |
| Vector DB | LanceDB (Phase 4, not yet wired) | — |
| Encryption | Node.js built-in `crypto` (AES-256-GCM) | — |

---

## 3. Monorepo Structure

```
anything-llm-rebuild/
├── package.json              ← root Yarn workspaces config
├── .nvmrc                    ← Node 20
├── .gitignore
├── README.md
├── LICENSE
├── docs/
│   ├── 00-build-plan.md      ← 9-phase build plan
│   ├── 01-architecture.md    ← HLD + LLD
│   └── 02-handoff-context.md ← this file
├── server/                   ← Express API (port 3001)
├── collector/                ← Document parsing microservice (port 8888)
└── frontend/                 ← React SPA (port 3000, Vite dev server)
```

### Three separate Node services

- **server** — Main API. Auth, chat, workspace management, LLM provider, vector DB retrieval.
- **collector** — Stateless file parsing microservice. Accepts file uploads, extracts text, splits into chunks, returns JSON. Server forwards uploads here.
- **frontend** — React SPA. Vite dev server proxies `/api/*` → `localhost:3001`.

---

## 4. Environment Variables

### `server/.env`
```env
SERVER_PORT=3001
NODE_ENV=development
JWT_SECRET=<64-char hex — generated>
ENCRYPTION_KEY=<64-char hex — generated>

LLM_PROVIDER=gemini          # fallback when DB has no setting
OPENAI_API_KEY=<key>
OPENAI_MODEL=gpt-4o-mini

GEMINI_API_KEY=<key>
GEMINI_MODEL=gemini-2.5-flash-lite
```

### `collector/.env`
```env
COLLECTOR_PORT=8888
NODE_ENV=development
```

### `frontend/.env`
```env
VITE_SERVER_URL=http://localhost:3001
```

---

## 5. Database Schema (Prisma + SQLite)

```prisma
model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String            // bcrypt hash
  role      String   @default("default")  // "admin" | "default"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  chats     WorkspaceChat[]
}

model SystemSettings {
  id        Int      @id @default(autoincrement())
  label     String   @unique  // e.g. "llm_provider", "llm_gemini_api_key"
  value     String?           // encrypted if secret, plain string otherwise
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Workspace {
  id        Int      @id @default(autoincrement())
  name      String
  slug      String   @unique  // URL-safe identifier e.g. "default"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  chats     WorkspaceChat[]
}

model WorkspaceChat {
  id          Int      @id @default(autoincrement())
  workspaceId Int
  userId      Int?
  prompt      String   // user message
  response    String   // full assistant response (stored after stream completes)
  createdAt   DateTime @default(now())
  workspace   Workspace @relation(...)
  user        User?     @relation(...)
  @@index([workspaceId])
}
```

**NOT YET added (Phase 4 will add):**
```prisma
model WorkspaceDocument {
  id          Int      @id @default(autoincrement())
  workspaceId Int
  title       String
  docId       String   @unique    // uuid assigned at upload
  mimeType    String
  wordCount   Int
  chunkCount  Int
  createdAt   DateTime @default(now())
  workspace   Workspace @relation(...)
}
```

---

## 6. Full File Tree (all files that exist today)

### Server (`server/`)

```
server/
├── index.js                          ← Express entrypoint
├── package.json
├── .env                              ← real secrets (gitignored)
├── .env.example
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── models/
│   ├── prisma.js                     ← singleton PrismaClient
│   ├── user.js                       ← CRUD: create, findByUsername, findById, count
│   ├── workspace.js                  ← CRUD: findBySlug, findById, list, ensureDefault
│   ├── workspaceChats.js             ← getHistory, addChat, deleteAllForWorkspace
│   └── systemSettings.js            ← get/set/getSecret/setSecret/getMany + SETTINGS labels
├── endpoints/
│   ├── setup.js                      ← GET /api/setup/needs-setup, POST /api/setup/create-first-user
│   ├── auth.js                       ← POST /api/auth/login, GET /api/auth/me
│   ├── chat.js                       ← POST /chat, GET+DELETE /chats, POST /stream-chat
│   └── systemSettings.js            ← GET/POST /api/system-settings/llm-provider, POST /test
├── utils/
│   ├── logger.js                     ← winston
│   ├── auth.js                       ← hashPassword, signToken, validatedRequest, requireAdmin
│   ├── crypto.js                     ← encrypt/decrypt (AES-256-GCM), mask
│   ├── AiProviders/
│   │   ├── index.js                  ← async getProvider() factory (DB > env > default)
│   │   ├── openAi/index.js           ← OpenAiProvider { sendChat, streamChat }
│   │   └── gemini/index.js           ← GeminiProvider { sendChat, streamChat }
│   └── EmbeddingEngines/
│       ├── index.js                  ← async getEmbedder() factory
│       └── gemini/index.js           ← GeminiEmbedder { embedSingle, embedMany, dimensions }
└── scripts/
    ├── test-provider.js              ← CLI: node scripts/test-provider.js gemini "hello"
    └── test-embedder.js             ← CLI: node scripts/test-embedder.js (cosine similarity test)
```

### Collector (`collector/`)

```
collector/
├── index.js                          ← POST /process (multer + extract + chunk → JSON)
├── package.json
├── .env.example
├── hotdir/                           ← temp upload dir (gitignored, auto-created)
└── utils/
    ├── extract.js                    ← file → string (.txt, .md, .pdf via pdf-parse)
    └── chunk.js                      ← string → chunks[] (RecursiveCharacterTextSplitter)
```

### Frontend (`frontend/`)

```
frontend/
├── index.html
├── vite.config.js                    ← proxy /api → localhost:3001
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx                      ← ReactDOM.createRoot, BrowserRouter, AuthProvider
    ├── App.jsx                       ← Routes: /setup, /login, /workspace/:slug, /settings/llm
    ├── index.css                     ← Tailwind base/components/utilities
    ├── contexts/
    │   └── AuthContext.jsx           ← global auth state: user, needsSetup, login, logout
    ├── components/
    │   ├── ProtectedRoute.jsx        ← redirect unauthenticated users
    │   └── WorkspaceChat/
    │       ├── index.jsx             ← shell: header (Settings link for admin) + ChatContainer
    │       └── ChatContainer/
    │           ├── index.jsx         ← state: messages, loading; calls chatApi.stream
    │           ├── ChatHistory/
    │           │   ├── index.jsx     ← scrollable message list
    │           │   └── HistoricalMessage/index.jsx ← single message bubble + streaming cursor
    │           └── PromptInput/
    │               └── index.jsx    ← textarea + send button (Enter to send, Shift+Enter newline)
    ├── pages/
    │   ├── Setup.jsx                 ← first-user creation form
    │   ├── Login.jsx                 ← login form
    │   ├── Workspace.jsx             ← reads :slug from URL, renders WorkspaceChat
    │   └── Settings/
    │       └── LLMPreference.jsx    ← admin settings: provider dropdown, API key, model, Test+Save
    └── api/
        └── client.js                ← Token, api, authApi, chatApi (incl. SSE stream), settingsApi
```

---

## 7. Key Architectural Patterns

### 7.1 Provider Abstraction (LLM)

Every LLM provider has the same shape:
```js
class XProvider {
  constructor({ apiKey, model } = {}) { ... }
  async sendChat(messages, opts)   // → string
  async *streamChat(messages, opts) // → AsyncGenerator<string chunk>
}
```

The factory reads from DB first (encrypted API keys), falls back to `.env`:
```js
// server/utils/AiProviders/index.js
const getProvider = async () => {
  // reads llm_provider, llm_gemini_api_key, etc. from SystemSettings
  // DB > env > hardcoded default
  switch (name) {
    case "openai": return new OpenAiProvider({ apiKey, model });
    case "gemini": return new GeminiProvider({ apiKey, model });
  }
};
```

**Effect:** Change `LLM_PROVIDER=gemini` in `.env` (or save from the settings UI) → next chat uses Gemini. No restart, no code change.

### 7.2 Encryption for secrets

API keys in the DB are encrypted with AES-256-GCM before write, decrypted on read:
```
DB stores: v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
App reads: plaintext string in memory only
Wire:       masked string (AIza...xyz) — never full key
```
The `ENCRYPTION_KEY` in `.env` is the only master key. Losing it = losing all stored API keys.

### 7.3 SSE Streaming

Chat responses stream token-by-token via Server-Sent Events:
```
Server writes: data: {"type":"chunk","text":"hello "}\n\n
               data: {"type":"chunk","text":"world"}\n\n
               data: {"type":"done","id":7,"response":"hello world"}\n\n
```
Frontend reads with `res.body.getReader()`, decodes, splits on `\n\n`, parses each `data:` line. The full response is saved to DB only after streaming completes.

### 7.4 Auth flow

1. First boot: `GET /api/setup/needs-setup` → `{ needsSetup: true }`
2. Admin creation: `POST /api/setup/create-first-user` → `{ user, token }`
3. Login: `POST /api/auth/login` → `{ user, token }` (JWT, 7-day TTL)
4. All protected routes: `Authorization: Bearer <token>` header
5. Admin-only routes: `validatedRequest` + `requireAdmin` middleware chain

### 7.5 Embedding engine

```js
class GeminiEmbedder {
  get dimensions() { return 768; }
  async embedSingle(text)        // → number[]
  async embedMany(texts)         // → number[][] (batches of 100)
}
```

Factory at `server/utils/EmbeddingEngines/index.js` mirrors the LLM factory pattern.

---

## 8. API Endpoints (complete list)

### Auth + Setup
| Method | Path | Auth | What |
|---|---|---|---|
| GET | `/api/ping` | none | health check |
| GET | `/api/health` | none | service info |
| GET | `/api/setup/needs-setup` | none | has admin been created? |
| POST | `/api/setup/create-first-user` | none | create first admin (one-time) |
| POST | `/api/auth/login` | none | returns JWT |
| GET | `/api/auth/me` | JWT | returns current user |

### Chat
| Method | Path | Auth | What |
|---|---|---|---|
| POST | `/api/workspace/:slug/chat` | JWT | non-streaming chat |
| GET | `/api/workspace/:slug/chats` | JWT | full chat history |
| DELETE | `/api/workspace/:slug/chats` | JWT | clear history |
| POST | `/api/workspace/:slug/stream-chat` | JWT | SSE streaming chat |

### System Settings (admin only)
| Method | Path | Auth | What |
|---|---|---|---|
| GET | `/api/system-settings/llm-provider` | JWT + admin | get current LLM config (keys masked) |
| POST | `/api/system-settings/llm-provider` | JWT + admin | save LLM provider/key/model to DB |
| POST | `/api/system-settings/llm-provider/test` | JWT + admin | ping LLM with current or provided creds |

### Collector (port 8888, internal — not exposed to browser)
| Method | Path | Auth | What |
|---|---|---|---|
| GET | `/` | none | health check |
| GET | `/health` | none | service info |
| POST | `/process` | none | upload file → extract → chunk → JSON |

---

## 9. Phase Progress

### ✅ Completed

**Phase 0 — Walking Skeleton**
- Monorepo: `server/`, `frontend/`, `collector/`, `docs/`
- All 3 services boot and respond to health endpoints
- Commit: `chore: initial monorepo scaffold`

**Phase 1 — Auth + Persistent Chat + Streaming**
- Prisma + SQLite: User, SystemSettings, Workspace, WorkspaceChat tables
- First-user setup flow + JWT login
- Non-streaming and SSE streaming chat endpoints
- React UI: Setup, Login, WorkspaceChat pages with live streaming
- Commit: `feat(phase-1): auth + persistent chat + SSE streaming`

**Phase 2 (we renamed Phase 3 from the plan) — Provider Abstraction + Settings UI**
- `GeminiProvider` + `OpenAiProvider` with identical interface
- `getProvider()` async factory: DB > env > default
- AES-256-GCM encryption for secrets in DB
- `SystemSettings` encrypted get/set helpers
- Admin-only endpoints: GET/POST/test `/api/system-settings/llm-provider`
- `requireAdmin` middleware
- React Settings page at `/settings/llm`: dropdown + key + model + Test + Save
- ⚙ Settings link in workspace header (admin only)
- Commit: `feat(phase-2): add runtime LLM provider settings with encrypted keys`

### 🔄 In Progress

**Phase 4 — RAG (Documents + Embeddings + Retrieval)**

| Step | Status | What |
|---|---|---|
| Step 1: Collector parses files | ✅ Done + verified | `POST /process` → TXT + PDF → chunks JSON |
| Step 2: Gemini Embedding Engine | ✅ Files written | `GeminiEmbedder` class + factory. **NOT YET VERIFIED** — test script exists but wasn't run |
| Step 3: LanceDB vector store | ⏳ Not started | Abstract interface + LanceDB implementation + DB migration for `WorkspaceDocument` |
| Step 4: Upload endpoint + UI | ⏳ Not started | `POST /api/document/upload` → collector → embedder → vector DB → metadata |
| Step 5: RAG retrieval in chat | ⏳ Not started | Embed question → vector search → inject top-K chunks → answer with citations |

### ⏳ Not Started

**Phase 5 — Vector DB + Embedder Abstractions**
- Add LanceDB as second vector backend (Chroma as first)
- Add local embedder (`transformers.js`)
- Admin UI for switching vector DB + embedder

**Phase 6 — Multi-User**
- Invite system, roles, per-user chat history

**Phase 7 — Threads**
- Multiple named conversations per workspace

**Phase 8 — Agent Mode**
- WebSocket-based agent, tool-calling loop (aibitat pattern), web scraping + file creation

**Phase 9 — MCP + Docker Deploy**
- MCP server integration, production Dockerfile, deploy to Render/Fly

---

## 10. Immediate Next Task (for the new AI to continue)

### Verify Step 2 (Embedding Engine)

The `GeminiEmbedder` was written but the test was interrupted. Run:

```bash
cd ~/Documents/GitHub/anything-llm-rebuild/server
node scripts/test-embedder.js
```

Expected output:
```
[>] model: text-embedding-004
[>] expected dims: 768
[<] vec1 len=768  first8=0.0xxx, ...
[<] vec2 len=768  first8=0.0xxx, ...
[<] cos(A,B) similar meaning  = 0.9xx   ← must be HIGH (>0.8)
[<] cos(A,C) unrelated topics = 0.x     ← must be LOW  (<0.5)
```

If `embedContent` API shape is wrong, the fix is in `server/utils/EmbeddingEngines/gemini/index.js`. The `@google/genai` SDK's embed call signature may need adjustment — check against: `this.client.models.embedContent({ model, contents })`.

### Then Step 3 — LanceDB Vector Store

Install:
```bash
yarn workspace anything-llm-server add @lancedb/lancedb
```

Files to create:
1. `server/utils/vectorDbProviders/lance/index.js` — `LanceDb` class with `addDocumentChunks(workspaceId, chunks, embeddings)` and `similaritySearch(workspaceId, queryVector, topK)` methods
2. `server/utils/vectorDbProviders/index.js` — `getVectorDb()` factory (same pattern as LLM + embedder)
3. Prisma migration to add `WorkspaceDocument` table to `schema.prisma`

---

## 11. Design Rules to Follow

1. **Ask before coding.** Show plan + file list → get approval → build.
2. **One step at a time.** Don't start Step N+1 until Step N is verified working.
3. **DB > env > default** priority for all config.
4. **Every new provider/engine = one file in its own folder.** Never mix providers.
5. **Never log API keys.** Use `mask()` for display, never full key in logs or wire.
6. **Factory functions are always async.** They read from DB.
7. **Lint after every change.** No errors committed.
8. **Commit only at phase boundaries** (after the whole phase is verified working), not after every file.
9. **Keep explanations brief.** The developer (Jayasoruban) knows software engineering but is learning AI/LLM concepts. Analogies over jargon.
10. **Verification scripts first, UI last.** Curl/script proves the plumbing works before building React.

---

## 12. Running the Project Locally

```bash
# Terminal 1 — backend
cd ~/Documents/GitHub/anything-llm-rebuild/server
node index.js
# → http://localhost:3001

# Terminal 2 — collector
cd ~/Documents/GitHub/anything-llm-rebuild/collector
node index.js
# → http://localhost:8888

# Terminal 3 — frontend
cd ~/Documents/GitHub/anything-llm-rebuild/frontend
yarn dev
# → http://localhost:3000

# Admin credentials (already created)
# username: jayasoruban
# password: Jacksparrow62773@
```

---

## 13. Key Decisions Made (don't revisit these)

| Decision | Choice | Why |
|---|---|---|
| LLM for chat | Gemini (gemini-2.5-flash-lite) | Free quota, user has key |
| LLM alternative | OpenAI (gpt-4o-mini) | Also configured, paid |
| Embedding model | Gemini text-embedding-004 | Free, same key |
| Vector DB | LanceDB | Embedded, zero infra for dev |
| Second vector DB (Phase 5) | Chroma | Docker-based, covers remote paradigm |
| DB for metadata | SQLite → PostgreSQL | Prisma abstracts the switch |
| Streaming | SSE (Server-Sent Events) | Simpler than WebSocket for unidirectional |
| Secret storage | AES-256-GCM encrypted in DB | Production-grade, not plain .env |
| Monorepo tool | Yarn v1 workspaces | Same as original AnythingLLM |
