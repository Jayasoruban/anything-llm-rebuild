# The Rebuild Plan — Simulating How AnythingLLM Was Actually Built

> This document is the chronological blueprint for rebuilding [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) from scratch. Read this before touching any code. Re-read it between phases.

## Table of contents

1. [The guiding principle — vertical slices](#1-the-guiding-principle--vertical-slices-not-horizontal-layers)
2. [Backend-first, by 30 minutes](#2-backend-first-by-30-minutes)
3. [The 9 build phases](#3-the-9-build-phases)
4. [What your GitHub will look like at the end](#4-what-your-github-will-look-like-at-the-end)
5. [What we cut (and why)](#5-what-we-cut-and-why)

---

## 1. The guiding principle — vertical slices, not horizontal layers

**Wrong approach (what most tutorials teach):**

```
Week 1: All tables + all models       ← nothing visible, nothing works
Week 2: All REST endpoints            ← still nothing visible
Week 3: All React components          ← massive integration bug hell
Week 4: Connect it all                ← surprise: nothing fits together
```

**Right approach (how real products are built):**

```
Week 1: ONE table + ONE endpoint + ONE UI screen, end-to-end, working
Week 2: Add streaming + provider abstraction to that same slice
Week 3: Add documents + RAG to that same slice
…
```

Each "phase" = **a working product you could ship**. The original Mintplex team almost certainly built it this way — you can tell from git history that features landed as cohesive slices, not layer-by-layer.

---

## 2. Backend-first, by 30 minutes

Inside each phase:

```
1. Design the API contract on paper     (10 min)
2. Build the backend endpoint            (1–3 hrs)
3. Test with curl / Postman              (10 min)
4. Build the frontend that consumes it   (1–3 hrs)
5. Integrate, commit, ship               (30 min)
```

### Why backend first

- The contract (request/response shape) unblocks the frontend
- You can always test without a UI — curl is the ultimate debugger
- If frontend lags, backend is still deployable (clients could use Postman)
- **Never** the other way around — mocking a backend wastes half the work

### Why *not* "entire backend first, then entire frontend"

- 3–4 weeks with no visible progress destroys motivation
- API design mistakes surface only when building the UI — by then too late
- Recruiters/clients want to see something running

---

## 3. The 9 build phases

Each phase = a git branch → PR → merge. Your commit history will tell the story.

### Phase 0 — Walking Skeleton (Day 1)

**Goal:** Three empty services boot and respond to `/health`.

**What you build:**

- Monorepo: `server/`, `frontend/`, `collector/`, `docs/`
- `package.json` workspaces, `.gitignore`, `README.md`, `LICENSE`
- `server/index.js` → Express on :3001 with `GET /api/ping`
- `frontend/` → Vite + React + Tailwind, one blank page
- `collector/index.js` → Express on :8888 with `GET /`
- `docker-compose.yml` stub (commented out, for later)
- HLD/LLD saved to `docs/`

**Demo state:** Open 3 terminals → `yarn dev` each → all 3 respond. First commit: `"chore: initial monorepo scaffold"`.

---

### Phase 1 — The Smallest Possible Chat (Day 2–3)

**Goal:** A logged-in admin types "hi" → sees a GPT-4o-mini response, persisted to DB.

| Layer | What |
|---|---|
| DB | Prisma + SQLite + tables: `users`, `system_settings`, `workspaces`, `workspace_chats` |
| Backend | `POST /api/setup` (bootstrap admin), `POST /api/request-token` (JWT login), `POST /api/workspace/:slug/chat` (hardcoded OpenAI, non-streaming) |
| Auth | `validatedRequest` middleware, bcrypt, JWT |
| Frontend | Login page, workspace page, chat input + message list, localStorage JWT |

**Deliberately missing:** streaming, providers other than OpenAI, RAG, multi-user, threads.

**Demo:** Full-stack working chat. A "ChatGPT clone in 200 lines." Commit: `"feat: single-workspace chat with OpenAI"`.

---

### Phase 2 — Streaming + System Prompts (Day 4)

**Goal:** Tokens stream character-by-character. Admin can customize workspace behavior.

- Backend: convert `/chat` → `/stream-chat`, use SSE (`res.write('data: {...}\n\n')`)
- Add `workspace.openAiPrompt`, `workspace.openAiTemp` columns
- Frontend: swap `fetch()` → `@microsoft/fetch-event-source`
- Settings modal for system prompt + temperature

**Demo:** Feels like real ChatGPT. Commit: `"feat: SSE streaming + system prompt"`.

---

### Phase 3 — Provider Abstraction (Day 5–6)

**Goal:** Admin toggles OpenAI ↔ Anthropic from the UI without restarting.

- Extract `server/utils/AiProviders/openai/index.js` with full interface (LLD §3.3)
- Add `server/utils/AiProviders/anthropic/index.js` — same interface
- `getLLMProvider({ provider, model })` factory
- Per-workspace override: `workspace.chatProvider`, `workspace.chatModel`
- Admin "LLM Preference" page — dropdown, API key input, "Save"

**Demo:** Same chat, two brains. Commit: `"feat: swappable LLM providers (OpenAI, Anthropic)"`.

> **This is the single most portfolio-worthy commit of the whole project — document the pattern in `docs/02-provider-abstraction.md`.**

---

### Phase 4 — Documents + RAG (Day 7–10)

**Goal:** Upload a PDF, ask about it, get an answer with sources.

- Collector service: `pdf-parse` + `RecursiveCharacterTextSplitter` → returns chunks
- DB: `workspace_documents`, `document_vectors`
- Start Chroma via docker-compose
- `server/utils/vectorDbProviders/chroma/` with `base.js` interface
- `server/utils/EmbeddingEngines/openai/`
- `POST /api/document/upload` — accept file → forward to collector → embed chunks → store vectors
- Wire retrieval into `/stream-chat`: embed question → top-K → inject into prompt
- Frontend: upload dropzone, documents list (workspace settings), sources panel below assistant messages

**Demo:** Complete RAG product. The bigger brother of DocuMind. Commit: `"feat: document ingestion + RAG with Chroma"`.

---

### Phase 5 — Vector DB + Embedder Abstractions (Day 11–12)

**Goal:** Add LanceDB as second vector backend; add transformers.js as local embedder.

- `server/utils/vectorDbProviders/lance/index.js` — same interface as Chroma
- `server/utils/EmbeddingEngines/native/` (transformers.js, local, no API key)
- Admin "Vector Database" + "Embedding Preference" pages
- Re-ingestion flow: warn + re-embed existing docs when switching

**Demo:** Fully provider-agnostic. Works offline with Ollama + LanceDB + native embedder. Commit: `"feat: swappable vector DBs + embedding engines"`.

---

### Phase 6 — Multi-User (Day 13–14)

**Goal:** Admin invites team members, each has their own workspaces and chat history.

- `system_settings.multi_user_mode = true`
- First-run setup wizard
- Tables: `invites`, `workspace_users`, `password_reset_tokens`
- Role middleware: `flexUserRoleValid(['admin', 'manager', 'default'])`
- Admin panel: user list, invite generator, suspend user
- Per-user chat filter: `WorkspaceChats.forWorkspace(wsId, userId)`

**Demo:** Team-ready SaaS. Commit: `"feat: multi-user mode with invites and roles"`.

---

### Phase 7 — Threads + History Polish (Day 15–16)

**Goal:** Users can have multiple named conversations inside a workspace.

- `workspace_threads` table
- `POST /api/workspace/:slug/thread/new`, `GET …/threads`, `DELETE …/thread/:id`
- Frontend: thread sidebar, new-thread button, rename, delete
- Chat context scoped per thread
- Export chat as JSON / Markdown

**Demo:** Feels like a real product. Commit: `"feat: chat threads"`.

---

### Phase 8 — Agent Mode (aibitat) (Day 17–20)

**Goal:** Type `@agent scrape https://x.com and summarize it` → agent does it.

- WebSocket route `/agent-invocation/:uuid`
- `server/utils/agents/aibitat/` — minimal tool-calling loop (~300 lines)
- 3 plugins: `web-scraping` (Puppeteer via collector), `create-files` (docx), `rechart`
- `@agent` detection in chat input
- Frontend: streaming tool-call display

**Demo:** Your agent scrapes, writes a report, draws a chart. The "wow" moment in demos. Commit: `"feat: agent mode with web scraping, file creation, and charts"`.

---

### Phase 9 — MCP + Polish + Deploy (Day 21–25)

**Goal:** Add MCP support; wrap the whole thing in a deployable Docker image.

- `server/utils/MCP/hypervisor.js` — spawns MCP servers, registers tools
- Admin UI for adding MCP servers
- Swagger auto-gen at `/api/docs`
- Multi-stage Dockerfile (build frontend → copy into server's public/)
- `docker-compose.prod.yml`
- Deploy to Render or Fly (whichever free tier works)
- Final README with architecture diagrams + demo GIF

**Demo:** One `docker run` → full product. Commit: `"feat: MCP + production deployment"`.

---

## 4. What your GitHub will look like at the end

```
anything-llm-rebuild/
├── docs/
│   ├── 00-build-plan.md
│   ├── 01-architecture.md   (HLD + LLD)
│   ├── 02-provider-abstraction.md
│   ├── 03-rag-design.md
│   ├── 04-agent-framework.md
│   └── 05-mcp-integration.md
├── server/            (~8K lines your code)
├── frontend/          (~6K lines)
├── collector/         (~2K lines)
├── docker-compose.yml
├── Dockerfile
└── README.md          (with architecture diagram + demo GIF)
```

**Commit history reads like a story:**

```
feat: MCP + production deployment
feat: agent mode with web scraping and file creation
feat: chat threads
feat: multi-user mode with invites and roles
feat: swappable vector DBs + embedding engines
feat: document ingestion + RAG with Chroma
feat: swappable LLM providers (OpenAI, Anthropic)
feat: SSE streaming + system prompt
feat: single-workspace chat with OpenAI
chore: initial monorepo scaffold
```

10× more impressive to a hiring manager than one "final" 40K-line commit.

---

## 5. What we cut (and why)

AnythingLLM is ~200K lines. We are rebuilding ~16K lines. The architecture stays **100% faithful**; only redundant implementations are trimmed.

| Feature | Original | Our rebuild | Reason |
|---|---|---|---|
| LLM providers | 37 | 4 (OpenAI, Anthropic, Ollama, Bedrock) | After the first 3, the pattern is identical. Copies teach nothing new. |
| Vector DBs | 10 | 2 (Chroma, LanceDB) | Chroma = remote; Lance = embedded. Covers both paradigms. |
| Embedding engines | 14 | 2 (OpenAI, native/transformers.js) | Covers API and local paradigms. |
| Agent plugins | 18 | 3 (web-scraping, create-files, rechart) | Pattern is identical; more is busywork. |
| Collector converters | 9 | 3 (PDF, DOCX, TXT) | Others follow same pattern. |
| TTS providers | 3 | 0 | Not core to learning. |
| i18n | 24 languages | 1 (English) | Architecture, not translation, is what we're learning. |
| Telegram bot | yes | no | Out of scope. |
| Desktop app (Electron) | yes | no | Out of scope. |

**Bottom line:** anyone reading the final repo would say "this is AnythingLLM." The patterns are identical; only the fan-out of implementations is smaller.
