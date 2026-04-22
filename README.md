# AnythingLLM — Rebuilt from Scratch

> A production-grade, open-source, all-in-one AI workspace — rebuilt from scratch as a learning exercise in LLM systems architecture.

This is a **faithful rebuild** of [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm), re-implemented by [@jayasoruban](https://github.com/jayasoruban) to deeply understand production LLM systems. Every line of code is hand-written; the original repo serves only as an architectural reference.

## Why this exists

Reading code teaches you 10%. Rebuilding it teaches you 100%.

- To internalize the **provider-abstraction pattern** used across 37 LLM providers
- To understand **streaming architectures** for LLM chat UIs
- To wire up **RAG from scratch** — ingest → chunk → embed → retrieve → cite
- To implement **multi-agent orchestration** and **MCP** from first principles

## Architecture

Three Node.js services and a React SPA:

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   frontend   │─────▶│    server    │─────▶│  collector   │
│  React+Vite  │ SSE  │ Express+JWT  │ HTTP │ PDF/OCR/Web  │
│    :3000     │      │    :3001     │      │    :8888     │
└──────────────┘      └──────┬───────┘      └──────────────┘
                             │
                   ┌─────────┴─────────┐
                   ▼                   ▼
             ┌──────────┐       ┌──────────┐
             │ SQLite   │       │ ChromaDB │
             │ (Prisma) │       │ (vectors)│
             └──────────┘       └──────────┘
```

- **High-level & low-level design:** [`docs/01-architecture.md`](./docs/01-architecture.md)
- **Phase-by-phase build plan:** [`docs/00-build-plan.md`](./docs/00-build-plan.md)

## Status

Currently in **Phase 0 — Walking Skeleton**.

- [x] **Phase 0** — Monorepo scaffold, 3 services boot
- [ ] **Phase 1** — Minimal single-workspace chat (OpenAI, no RAG)
- [ ] **Phase 2** — SSE streaming + system prompts
- [ ] **Phase 3** — Provider abstraction (Anthropic, Ollama)
- [ ] **Phase 4** — Document ingestion + RAG with Chroma
- [ ] **Phase 5** — Swappable vector DBs + embedding engines
- [ ] **Phase 6** — Multi-user mode + role-based access
- [ ] **Phase 7** — Chat threads
- [ ] **Phase 8** — Agent mode (aibitat + tools)
- [ ] **Phase 9** — MCP integration + production deploy

## Tech stack

**Backend** — Node.js 20, Express, Prisma, SQLite (dev) / Postgres (prod), JWT, bcrypt
**Frontend** — React 18, Vite, Tailwind CSS, react-router-dom
**AI/LLM** — OpenAI, Anthropic, Ollama, LangChain, MCP SDK
**Vector** — ChromaDB, LanceDB
**Infra** — Docker, yarn workspaces

## Running locally

### Prerequisites

- Node.js 20+
- Yarn 1.x
- (optional) Docker for Chroma in Phase 4+

### Setup

```bash
# Clone
git clone https://github.com/jayasoruban/anything-llm-rebuild.git
cd anything-llm-rebuild

# Install all workspace dependencies
yarn install
```

### Run

```bash
# Open three terminals, one for each service:
yarn dev:server      # http://localhost:3001
yarn dev:collector   # http://localhost:8888
yarn dev:frontend    # http://localhost:3000
```

Browse to `http://localhost:3000`.

## License

MIT — see [LICENSE](./LICENSE).

Inspired by and modeled after [AnythingLLM by Mintplex Labs](https://github.com/Mintplex-Labs/anything-llm).
