# AnythingLLM — Complete Tech Stack, HLD & LLD

> Architectural reference for the rebuild. Lists every dependency, diagrams the system, and breaks down each subsystem at the method/class/table level.

## Table of contents

1. [Tech stack (100% accurate, from actual package.json files)](#1-tech-stack)
2. [High-Level Design](#2-high-level-design-hld)
3. [Low-Level Design](#3-low-level-design-lld)
4. [Summary cheat sheet](#4-summary-cheat-sheet)

---

## 1. Tech stack

### 1.1 Backend (`server/` service)

| Category | Library / Tool | Version | Purpose |
|---|---|---|---|
| **Runtime** | Node.js | ≥18.12.1 | JavaScript runtime |
| **HTTP framework** | `express` | 4.21 | REST API + static serving |
| **WebSockets** | `@mintplex-labs/express-ws` | 5.0 | Agent mode real-time comms |
| **ORM** | `@prisma/client` + `prisma` | 5.3 | Database toolkit |
| **Database (dev)** | SQLite (via Prisma) | — | Single-file DB, zero config |
| **Database (prod)** | PostgreSQL (opt) | — | Swappable via `DATABASE_URL` |
| **Auth** | `jsonwebtoken` + `bcryptjs` | 9.0 / 3.0 | JWT tokens, password hashing |
| **Input validation** | `joi` + `joi-password-complexity` | 17.11 / 5.2 | Schema-based validation |
| **Uploads** | `multer` | 2.0 | multipart/form-data parsing |
| **CORS** | `cors` | 2.8 | Cross-origin policy |
| **Request parsing** | `body-parser` | 1.20 | JSON/urlencoded |
| **Logging** | `winston` | 3.13 | Structured logs |
| **Env** | `dotenv` | 16.0 | `.env` loading |
| **Scheduler** | `@mintplex-labs/bree` | 9.2 | Background jobs |
| **Graceful shutdown** | `@ladjs/graceful` | 3.2 | Clean SIGTERM handling |
| **Analytics** | `posthog-node` | 3.1 | Anonymous telemetry |
| **API docs** | `swagger-autogen` + `swagger-ui-express` | 2.23 / 5.0 | OpenAPI / Swagger UI |

### 1.2 AI / LLM dependencies

| Category | Library | Purpose |
|---|---|---|
| **LangChain core** | `langchain`, `@langchain/core`, `@langchain/community`, `@langchain/textsplitters` | RAG utilities, text splitting |
| **LangChain providers** | `@langchain/openai`, `@langchain/anthropic`, `@langchain/aws`, `@langchain/cohere` | Pre-built LLM adapters |
| **Native SDKs (direct)** | `openai` 4.95, `@anthropic-ai/sdk` 0.39, `ollama` 0.6, `cohere-ai` 7.19 | Used directly for streaming control |
| **MCP** | `@modelcontextprotocol/sdk` 1.24 | Anthropic's Model Context Protocol |
| **Tokenization** | `js-tiktoken` 1.0 | Token counting for context-window management |
| **Local embeddings** | `@xenova/transformers` 2.14 | Transformers.js — runs models in Node without GPU |

### 1.3 Vector databases

| Library | Purpose |
|---|---|
| `chromadb` 2.0 | Chroma client |
| `@pinecone-database/pinecone` 2.0 | Pinecone v2 |
| `@qdrant/js-client-rest` 1.9 | Qdrant |
| `weaviate-ts-client` 1.4 | Weaviate |
| `@lancedb/lancedb` 0.15 | LanceDB (embedded, on-disk) |
| `@zilliz/milvus2-sdk-node` 2.3 | Milvus |
| `@datastax/astra-db-ts` 0.1 | Astra DB |
| `pg` 8.11 | pgvector (Postgres with vector extension) |
| `apache-arrow` 19.0 | LanceDB columnar format support |

### 1.4 Document processing (`collector/`)

| Library | Purpose |
|---|---|
| `pdf-parse` 1.1 | PDF text extraction |
| `mammoth` 1.6 | DOCX → HTML/text |
| `officeparser` 4.0 | PPTX, XLSX fallback parser |
| `node-xlsx` 0.24 | Excel → JSON |
| `mbox-parser` 1.0 | Email mbox files |
| `epub2` (git) | EPUB reader |
| `html-to-text` 9.0 | HTML → plain text |
| `sharp` 0.33 | Image processing |
| `tesseract.js` 6.0 | OCR for scanned docs/images |
| `puppeteer` 21.5 | Headless Chrome — web scraping |
| `youtube-transcript-plus` + `youtubei.js` | YouTube video transcripts |

### 1.5 Frontend (`frontend/`)

| Category | Library | Version | Purpose |
|---|---|---|---|
| **Framework** | React | 18.2 | UI library |
| **Router** | `react-router-dom` | 6.3 | SPA routing |
| **Build tool** | Vite | 4.3 | Dev server + bundler |
| **Styling** | Tailwind CSS | 3.3 | Utility CSS |
| **Icons** | `@phosphor-icons/react`, `@lobehub/icons` | 2.1 / 4.0 | Icon sets |
| **Charts** | `@tremor/react` + `recharts` | 3.15 / 2.12 | Analytics charts |
| **i18n** | `i18next` + `react-i18next` | 23.11 / 14.1 | 24-language support |
| **Streaming (SSE)** | `@microsoft/fetch-event-source` | 2.0 | Server-Sent Events client |
| **Markdown** | `markdown-it`, `highlight.js`, `katex` | 13.0 / 11.9 / 0.6 | Render LLM markdown |
| **Sanitization** | `dompurify`, `he` | 3.0 / 1.2 | XSS protection |

### 1.6 Embed widget (`embed/`)

Ultra-lean. Separate Vite build that produces a single-file minified JS + CSS.

| Library | Purpose |
|---|---|
| `react` + `react-dom` 18.2 | UI |
| `@microsoft/fetch-event-source` 2.0 | SSE client |
| `markdown-it` + `dompurify` | Message rendering |
| `vite-plugin-singlefile` | Bundles entire widget into ONE file |
| `terser` + `clean-css` | Minification |

### 1.7 DevOps

| Tool | Purpose |
|---|---|
| **Docker** | Multi-stage container builds |
| **docker-compose** | Local orchestration of server + collector + Chroma |
| **yarn** | Package manager (monorepo workspaces) |
| **ESLint 9 + Prettier 3** | Code quality + formatting |
| **nodemon** | Dev-time server restart |

### 1.8 Storage layout

| Type | Where | What |
|---|---|---|
| SQLite / Postgres | `server/storage/anythingllm.db` | All structured data |
| File system | `server/storage/documents/` | Raw uploaded files |
| File system | `server/storage/vector-cache/` | Pre-computed embeddings |
| File system | `server/storage/models/` | Downloaded local models |
| External | ChromaDB / Pinecone / etc. | Vectors |
| File system | `collector/hotdir/` | Watched folder for auto-ingestion |

---

## 2. High-Level Design (HLD)

### 2.1 System architecture diagram

```
                       ┌─────────────────────────────────────────────┐
                       │                 USER'S BROWSER              │
                       │                                             │
                       │  ┌──────────────────┐   ┌─────────────────┐ │
                       │  │  Main React SPA  │   │  Embed Widget   │ │
                       │  │  (full app UI)   │   │  (3rd-party     │ │
                       │  │  React + Vite    │   │   websites)     │ │
                       │  └────────┬─────────┘   └────────┬────────┘ │
                       └───────────┼──────────────────────┼──────────┘
                                   │ HTTPS / SSE          │ HTTPS / SSE
                                   │                      │
                       ┌───────────▼──────────────────────▼──────────┐
                       │              SERVER (Node/Express)          │
                       │              :3001                          │
                       │                                             │
                       │  ┌────────────────────────────────────────┐ │
                       │  │  HTTP layer                            │ │
                       │  │  - /api/system/*    (auth, settings)   │ │
                       │  │  - /api/workspace/* (CRUD + chat SSE)  │ │
                       │  │  - /api/document/*                     │ │
                       │  │  - /api/admin/*                        │ │
                       │  │  - /api/embed/*                        │ │
                       │  │  - /api/mcp-servers/*                  │ │
                       │  │  - Swagger UI at /api/docs             │ │
                       │  │  - WebSocket /agent-invocation/*       │ │
                       │  └─────────────┬──────────────────────────┘ │
                       │                │                            │
                       │  ┌─────────────▼──────────────────────────┐ │
                       │  │  Core services (utils/)                │ │
                       │  │  AiProviders  VectorDbProviders        │ │
                       │  │  EmbeddingEngines  TextSplitter        │ │
                       │  │  DocumentManager  chats/stream         │ │
                       │  │  agents(aibitat)  MCP  EncryptionMgr   │ │
                       │  │  BackgroundWorkers (bree)              │ │
                       │  └─────────────┬──────────────────────────┘ │
                       │                │                            │
                       │  ┌─────────────▼──────────────────────────┐ │
                       │  │  Data access (models/)                 │ │
                       │  │  Prisma wrappers: User, Workspace,     │ │
                       │  │  WorkspaceChats, Documents, Vectors,   │ │
                       │  │  ApiKeys, EmbedConfig, etc.            │ │
                       │  └─────────────┬──────────────────────────┘ │
                       └────────────────┼────────────────────────────┘
                                        │
      ┌─────────────────────────────────┼──────────────────────────────────┐
      │                                 │                                  │
      ▼                                 ▼                                  ▼
┌───────────┐                 ┌──────────────────┐                 ┌─────────────┐
│ SQLite /  │                 │     COLLECTOR    │                 │ Vector DB   │
│ Postgres  │                 │    :8888         │                 │ (Chroma,    │
│ (Prisma)  │                 │                  │                 │  Pinecone,  │
│           │                 │ - PDF parser     │                 │  Qdrant,    │
│ 28 tables │                 │ - DOCX parser    │                 │  LanceDB,   │
│           │                 │ - Puppeteer web  │                 │  pgvector,  │
│           │                 │ - YouTube xscr.  │                 │  …)         │
│           │                 │ - Tesseract OCR  │                 │             │
│           │                 │ - Hotdir watcher │                 │             │
└───────────┘                 └──────────┬───────┘                 └─────────────┘
                                         │
                              File system │ (uploads, chunks)
                                         ▼
                               ┌──────────────────┐
                               │  /storage/       │
                               │    documents/    │
                               │    vector-cache/ │
                               │    models/       │
                               └──────────────────┘
```

### 2.2 Service responsibilities

| Service | Port | Responsibility | Talks to |
|---|---|---|---|
| **`server`** | 3001 | HTTP API, auth, business logic, RAG orchestration, agents, LLM calls | DB, Vector DB, Collector, External LLM APIs |
| **`frontend`** | 3000 (dev) | SPA for end users + admins | `server` only (HTTPS + SSE) |
| **`collector`** | 8888 | Stateless document parsing + web scraping microservice | File system (temp); returns JSON to server |
| **`embed`** | — (static) | Third-party embeddable chat widget | `server` only (via CORS) |

**Why the collector is a separate service:**

1. Isolates heavy/unsafe parsers (puppeteer, tesseract) from the main API
2. Can be scaled horizontally independently (doc-heavy clients)
3. A crashing worker won't kill user chats
4. Keeps server Docker image smaller (no Chrome, no Tesseract binaries)

### 2.3 Main data flows

#### Flow A: User asks a question → cited streamed answer

```
Browser                     Server                      VectorDB        OpenAI
   │                          │                           │               │
   │─ POST /workspace/x/      │                           │               │
   │   stream-chat ──────────▶│                           │               │
   │                          │                           │               │
   │                          │  embedQuery(question)     │               │
   │                          │──────────────────────────▶│               │
   │                          │◀── vector (1536 floats)   │               │
   │                          │                           │               │
   │                          │  similaritySearch(vec,k=4)│               │
   │                          │──────────────────────────▶│               │
   │                          │◀── top-K chunks+metadata  │               │
   │                          │                           │               │
   │                          │  buildPrompt(sys+ctx+q)   │               │
   │                          │  streamChat(prompt) ──────────────────────▶
   │                          │◀── SSE token stream ──────────────────────│
   │◀── SSE "type":"chunk"    │                           │               │
   │   (for each token)       │                           │               │
   │                          │                           │               │
   │                          │  persist WorkspaceChat    │               │
   │                          │  (question, answer,       │               │
   │                          │   sources, userId)        │               │
   │                          │                           │               │
   │◀── SSE "type":"finalize" │                           │               │
```

#### Flow B: User uploads PDF → chunks embedded → searchable

```
Browser                Server                    Collector          VectorDB
   │                     │                          │                  │
   │─ POST /document/    │                          │                  │
   │   upload (file) ───▶│                          │                  │
   │                     │                          │                  │
   │                     │  forward to collector ──▶│                  │
   │                     │                          │ pdf-parse        │
   │                     │                          │ → chunks (text)  │
   │                     │◀── JSON { chunks,        │                  │
   │                     │          metadata }      │                  │
   │                     │                          │                  │
   │                     │  embedTextInput(chunks) ──▶  OpenAI embed   │
   │                     │  ◀─── 1536-dim vectors                      │
   │                     │                                              │
   │                     │  addDocumentToNamespace(wsId, vectors) ─────▶│
   │                     │◀── ack                                       │
   │                     │                                              │
   │                     │  create workspace_documents row              │
   │                     │                                              │
   │◀── 200 OK           │                                              │
```

#### Flow C: Agent mode — `@agent search for X and summarize`

```
Browser                Server                   Aibitat        OpenAI     Tools
   │                     │                        │              │         │
   │─ WS /agent-invoc ──▶│                        │              │         │
   │  { @agent + msg }   │                        │              │         │
   │                     │                        │              │         │
   │                     │ new Aibitat({          │              │         │
   │                     │   provider, plugins,   │              │         │
   │                     │   mcp_servers }) ─────▶│              │         │
   │                     │                        │              │         │
   │                     │                        │ start loop   │         │
   │                     │                        │ plan step ───▶         │
   │                     │                        │◀── tool_call │         │
   │                     │                        │ web-browsing ──────────▶
   │                     │                        │◀── results             │
   │                     │                        │ next step ───▶         │
   │                     │                        │◀── final text          │
   │◀── WS stream of     │                        │              │         │
   │    tool calls +     │                        │              │         │
   │    final answer     │                        │              │         │
```

---

## 3. Low-Level Design (LLD)

### 3.1 Data model (Prisma)

28 tables, grouped by concern:

```
┌─────────────── IDENTITY & ACCESS ───────────────┐
│ users                    — username, password, role, pfpFilename, bio │
│ invites                  — code, status, claimedBy, workspaceIds      │
│ password_reset_tokens                                                 │
│ recovery_codes                                                        │
│ api_keys                 — programmatic access                        │
│ browser_extension_api_keys                                            │
│ desktop_mobile_devices                                                │
│ temporary_auth_tokens                                                 │
└────────────────────────────────────────────────┘

┌────────────────── WORKSPACES ───────────────────┐
│ workspaces               — slug, name, chatModel, vectorTag, prompts, │
│                            similarityThreshold, topN, chatMode,       │
│                            agentProvider, agentModel, pfpFilename     │
│ workspace_users          — userId × workspaceId + role                │
│ workspace_threads        — named chat sessions within a workspace     │
│ workspace_chats          — messages (prompt, response, citations,     │
│                            include/exclude, userId, threadId)         │
│ workspace_agent_invocations                                           │
│ workspace_suggested_messages                                          │
│ slash_command_presets                                                 │
│ system_prompt_variables  — {{var}} substitution                       │
└────────────────────────────────────────────────┘

┌────────────────── DOCUMENTS ────────────────────┐
│ workspace_documents      — uploaded file refs per workspace           │
│ workspace_parsed_files                                                │
│ document_vectors         — vectorId ↔ docId mapping                   │
│ document_sync_queues     — pending syncs (URL watches, hotdir)        │
│ document_sync_executions — sync run history                           │
└────────────────────────────────────────────────┘

┌────────────────── EMBED & EXT ──────────────────┐
│ embed_configs            — 3rd-party widget configs                   │
│ embed_chats              — messages from embedded widgets             │
│ external_communication_connectors                                     │
└────────────────────────────────────────────────┘

┌────────────── SYSTEM & OBSERV ──────────────────┐
│ system_settings          — key/value global config                    │
│ event_logs               — audit trail                                │
│ cache_data               — shared cache (model lists, etc.)           │
│ prompt_history           — history of system prompt edits             │
└────────────────────────────────────────────────┘
```

**Key relationship:** `workspace_documents` is **not the vector store**. Vectors live in Chroma/Pinecone. `document_vectors` is just the cross-reference table — the server knows "chunks from `doc_42` have vectorIds `uuid-1, uuid-2, …` in the vector DB" — allowing clean deletes.

### 3.2 Auth & session flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    FIRST-RUN SETUP WIZARD                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. GET /api/setup-complete → { requiresSetup: true }             │
│ 2. POST /api/system/setup { username, password }                 │
│    ├─ bcrypt(password, 10)                                       │
│    ├─ create user (role: admin)                                  │
│    ├─ set system_settings.auth_token_secret = randomBytes(32)    │
│    └─ set system_settings.multi_user_mode = true                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                         LOGIN                                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ POST /api/request-token { username, password }                   │
│   ├─ User.get({ username })                                      │
│   ├─ bcrypt.compare(password, user.password)                     │
│   └─ jwt.sign({ id, username, role }, AUTH_SECRET, {             │
│        expiresIn: JWT_EXPIRY || "30d"                            │
│      })                                                          │
│                                                                  │
│ → Client stores token in localStorage                            │
│ → Every request: Authorization: Bearer <token>                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│       MIDDLEWARE CHAIN (runs before every protected route)       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ app.get("/api/workspace/:slug", [                                │
│   validatedRequest,       ← JWT verify + attach req.user         │
│   flexUserRoleValid(["admin","manager","default"]),              │
│   validWorkspaceSlug,     ← loads workspace, attaches req.ws     │
│ ], handler)                                                      │
│                                                                  │
│ Inside validatedRequest:                                         │
│   1. Extract Bearer token                                        │
│   2. jwt.verify(token, AUTH_SECRET)                              │
│   3. User.get({ id: decoded.id })                                │
│   4. Check user.suspended                                        │
│   5. Attach req.user                                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key design choice:** `auth_token_secret` lives in `system_settings` (database), not `.env`. Admin can rotate it from UI without restarting.

### 3.3 Provider abstraction

Every LLM provider implements the same contract.

```js
class LLMProvider {
  constructor(embedder = null, modelPreference = null) {
    this.model = modelPreference ?? process.env.OPEN_MODEL_PREF;
    this.embedder = embedder ?? new OpenAiEmbedder();
    this.openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });
  }

  get promptWindowLimit()      // max context tokens
  get defaultTemp()            // recommended temp

  streamingEnabled(): boolean
  static promptWindowLimit(modelName): number
  static async isValidChatCompletionModel(model): boolean

  constructPrompt({
    systemPrompt,
    contextTexts,
    chatHistory,
    userPrompt,
    attachments,
  }): ChatMessage[]

  async getChatCompletion(messages, { temperature }): string
  async streamGetChatCompletion(messages, { temperature }): AsyncIterable<Chunk>
  handleStream(response, stream, responseProps): Promise<void>

  async compressMessages(promptArgs, rawHistory): messages
  embedTextInput(text): vector
  embedChunks(chunks): vector[]
}
```

**The factory** (`server/utils/helpers/index.js`):

```js
function getLLMProvider({ provider, model } = {}) {
  const provider = provider ?? process.env.LLM_PROVIDER ?? "openai";
  switch (provider) {
    case "openai":     return new OpenAiLLM(embedder, model);
    case "anthropic":  return new AnthropicLLM(embedder, model);
    case "ollama":     return new OllamaAiLLM(embedder, model);
    // ... more cases
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}
```

**Per-workspace overrides:** each workspace can override the global provider/model. The factory reads `workspace.chatProvider ?? systemSetting ?? env`.

**The same pattern applies identically to:** `EmbeddingEngine`, `VectorDbProvider` (see `base.js`), `aibitat/providers/*`, `TextToSpeech`.

### 3.4 Chat streaming pipeline

Critical file: `server/utils/chats/stream.js`. Simplified:

```js
async function streamChatWithWorkspace(response, workspace, message, chatMode, user, thread) {
  const uuid = uuidv4();
  const updatedMessage = await grepCommand(message, user);

  // 1. Choose providers based on workspace config
  const LLMConnector = getLLMProvider({
    provider: workspace.chatProvider,
    model:    workspace.chatModel,
  });
  const VectorDb = getVectorDbClass();

  // 2. Retrieval
  const hasVectorizedSpace = await VectorDb.hasNamespace(workspace.slug);
  const chatHistory = await recentChatHistory({ user, workspace, thread, messageLimit: 20 });

  let contextTexts = [];
  let sources = [];
  if (hasVectorizedSpace) {
    const vectorSearchResults = await VectorDb.performSimilaritySearch({
      namespace: workspace.slug,
      input: updatedMessage,
      LLMConnector,
      similarityThreshold: workspace.similarityThreshold,
      topN: workspace.topN,
    });
    contextTexts = vectorSearchResults.contextTexts;
    sources = vectorSearchResults.sources;
  }

  // 3. "query" mode: refuse if no context
  if (chatMode === "query" && contextTexts.length === 0) {
    writeResponseChunk(response, {
      id: uuid, type: "textResponseChunk",
      textResponse: workspace.queryRefusalResponse
        ?? "No relevant documents found.",
      close: true,
    });
    return;
  }

  // 4. Build messages + stream
  const messages = await LLMConnector.compressMessages({
    systemPrompt: chatPrompt(workspace),
    userPrompt: updatedMessage,
    contextTexts,
    chatHistory,
    attachments,
  });

  const stream = await LLMConnector.streamGetChatCompletion(messages, {
    temperature: workspace.openAiTemp ?? LLMConnector.defaultTemp,
  });

  const completeText = await LLMConnector.handleStream(response, stream, {
    uuid, sources, citations: [], chat: { id: null }
  });

  // 5. Persist
  await WorkspaceChats.new({
    workspaceId: workspace.id,
    prompt: updatedMessage,
    response: { text: completeText, sources, type: chatMode },
    threadId: thread?.id,
    user,
  });

  // 6. Close stream
  writeResponseChunk(response, { id: uuid, type: "finalizeResponseStream", close: true });
}
```

**SSE wire format:**

```
data: {"id":"uuid","type":"textResponseChunk","textResponse":"Based"}\n\n
data: {"id":"uuid","type":"textResponseChunk","textResponse":" on"}\n\n
data: {"id":"uuid","type":"textResponseChunk","textResponse":" the"}\n\n
...
data: {"id":"uuid","type":"finalizeResponseStream","sources":[...],"close":true}\n\n
```

### 3.5 RAG pipeline

```
┌── INGEST (one-time per doc) ─────────────────────────────────────┐
│                                                                  │
│ POST /api/document/upload  (multipart)                           │
│   ↓                                                              │
│ server/endpoints/document.js                                     │
│   ↓  forward via HTTP                                            │
│ collector/processSingleFile/index.js                             │
│   ├─ switch(extension) → asPDF / asDocx / asTxt / asXlsx / …     │
│   ├─ extract raw text                                            │
│   ├─ RecursiveCharacterTextSplitter.split()                      │
│   │    chunkSize=1000 chars, overlap=20, tiktoken-based length   │
│   └─ return { pageContent, wordCount, token_count_estimate,      │
│               docId, title, author, published, ... }             │
│   ↓                                                              │
│ server receives JSON                                             │
│   ↓                                                              │
│ DocumentManager.embed(document, workspace)                       │
│   ├─ for (chunk of chunks):                                      │
│   │    vec = EmbeddingEngine.embedTextInput(chunk)               │
│   ├─ VectorDb.addDocumentToNamespace({                           │
│   │    namespace: workspace.slug,                                │
│   │    documentData: { docId, text, metadata },                  │
│   │    embeddings: vectors,                                      │
│   │    fullFilePath,                                             │
│   │  })                                                          │
│   ├─ Document.addDocuments({ workspace, docs: [document] })      │
│   └─ Vector.createMany({ docId, vectorId: [uuid list] })         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌── QUERY (every question) ────────────────────────────────────────┐
│                                                                  │
│ VectorDb.performSimilaritySearch({ namespace, input, topN })     │
│   ↓                                                              │
│ 1. queryVec = EmbeddingEngine.embedTextInput(input)              │
│ 2. collection.query({ queryEmbeddings: [queryVec], nResults })   │
│ 3. Filter by similarityThreshold (0..1)                          │
│ 4. Return {                                                      │
│      contextTexts: [...chunk strings],                           │
│      sources: [{ id, metadata, text, similarity, fullFilePath }] │
│    }                                                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Citations:** AnythingLLM does NOT use inline `[filename, page N]` markers. Instead it returns a parallel `sources: []` array to the client, rendered in a collapsible panel below the answer. Simpler for the LLM, cleaner UX.

### 3.6 Agent orchestration (aibitat)

Aibitat is AnythingLLM's homegrown multi-agent framework.

```
class AIbitat {
  agents:    Map<name, AgentConfig>    // e.g. "user", "default" (the worker)
  plugins:   Map<name, PluginFactory>  // tools = functions the worker can call
  providers: AIProviderClass           // picked by workspace.agentProvider
  chats:     Message[]                 // conversation log
  channel:   AgentWebSocket | null     // real-time back to browser

  use(plugin)                          // register a plugin (tool)
  function({ super, name, description, parameters, handler })

  async chat(message) {
    loop:
      response = await provider.complete(messages)
      if (response.functionCall) {
        result = await plugins[response.name].handler(response.args)
        messages.push({ role: "tool", content: result })
        continue
      }
      stream(response.text) → channel
      break
  }

  introspect(agentName, task)          // delegate to another agent
}
```

**Tools that ship out of the box (18 plugins):** `web-browsing`, `web-scraping`, `sql-agent`, `create-files`, `rechart`, `summarize`, `memory`, `filesystem`, `chat-history`, `file-history`, `gmail`, `outlook`, `google-calendar`, `websocket`, `http-socket`, `cli`, and more.

### 3.7 MCP integration

MCP is Anthropic's protocol — external programs expose tools/resources that any MCP-aware client can consume. AnythingLLM makes registered MCP servers available as agent tools.

```
Admin adds an MCP server config
   ↓
{
  name: "filesystem",
  command: "npx",
  args: ["@modelcontextprotocol/server-filesystem", "/home/user/docs"],
  env: { ... }
}
   ↓
MCP Hypervisor (server/utils/MCP/hypervisor.js)
   ├─ spawns the server as a child process
   ├─ connects via StdioClientTransport
   ├─ calls server.listTools() → returns tool schemas
   └─ registers each tool as an aibitat plugin:
        aibitat.function({
          name: "mcp__filesystem__read_file",
          description: <from MCP server>,
          parameters: <MCP schema>,
          handler: async (args) => mcpClient.callTool(name, args)
        })
   ↓
Agent uses tools transparently — LLM doesn't know it's MCP vs a native plugin
```

**Why this is powerful:** any MCP server from the ecosystem (Slack, GitHub, Sentry, Linear, Google Drive, Postgres, etc.) automatically becomes an agent tool with zero extra code.

### 3.8 Deployment topology

**Single-container (simplest, `docker/Dockerfile`):**

```
┌────────────────────────────────────────────┐
│  Container: anythingllm                    │
│  ├─ PM2 or similar supervisor              │
│  ├─ server (Node, :3001)                   │
│  ├─ collector (Node, :8888, localhost only)│
│  ├─ frontend (static, served by server)    │
│  ├─ SQLite on mounted volume               │
│  └─ (optional) Chroma on mounted volume    │
└────────────────────────────────────────────┘
       ▲
       │ HTTPS
     Render / Railway / Fly / VPS
```

**Multi-service (scale, `docker/docker-compose.yml`):**

```
┌─────────┐   ┌───────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐
│ nginx   │──▶│ server    │──▶│ collector│   │ chroma  │   │postgres │
│ :443    │   │ :3001 ×N  │   │ :8888 ×M │   │ :8000   │   │ :5432   │
│ (SSL)   │   │ stateless │   │ stateless│   │         │   │         │
└─────────┘   └───────────┘   └──────────┘   └─────────┘   └─────────┘
                  │                                │             │
                  └──── persistent volume ─────────┴─────────────┘
```

**Separating concerns enables:**

- Horizontal scaling of server for chat load
- Horizontal scaling of collector for doc-processing load
- Centralized vector DB used by all server replicas
- Postgres swap for HA

---

## 4. Summary cheat sheet

| Layer | Tech | Pattern |
|---|---|---|
| UI | React 18 + Vite + Tailwind | SPA with SSE streaming consumer |
| API | Express + JWT | REST + one WebSocket for agents |
| Auth | bcrypt + jsonwebtoken + role middleware | Session-less JWT |
| DB | Prisma + SQLite (dev) / Postgres (prod) | 28 tables, thin model wrappers |
| LLM | 37 providers | Common interface, swap at runtime per workspace |
| Vector | 10 providers | `base.js` abstract, swap per workspace |
| Embedding | 14 engines | Same abstraction |
| Chunking | `langchain/text-splitters` + `js-tiktoken` | RecursiveCharacter by token count |
| RAG | Retrieve → compress → stream → persist | Query mode vs chat mode |
| Ingestion | Collector microservice | Isolated parsing, returns JSON |
| Agents | aibitat (homegrown) + 18 plugins + MCP | Tool-calling loop |
| MCP | `@modelcontextprotocol/sdk` | Hypervisor spawns, bridges to aibitat |
| Realtime | SSE for chat, WS for agents | Two transports, same interface upstream |
| Embed widget | Vite single-file bundle | IIFE injected into any page |
| Observability | winston + posthog-node | Structured logs + anonymous telemetry |
| Background | `@mintplex-labs/bree` | Cron-like jobs for sync/cleanup |
| Deployment | Docker + docker-compose | Single- or multi-container |
