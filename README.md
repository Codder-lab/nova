# Nova AI: General-Purpose Agentic AI Assistant

Nova is an extensible, production-quality general-purpose Agentic AI Assistant built with Node.js, Express, TypeScript, Mongoose, Zod, and Ollama (local Qwen 2.5 7B).

Unlike simple prompt-and-response chatbots, Nova employs an autonomous **Plan-and-Execute / ReAct agent loop**:
1. **Understands** the user's high-level goal
2. **Plans** execution steps without exposing private chain-of-thought
3. **Discovers** available tools dynamically from a centralized Tool Registry
4. **Executes** tools based on strict Zod schema validation
5. **Observes** tool results and injects them back into context
6. **Synthesizes** concise, grounded final answers or continues execution

---

## Architecture Overview

```text
USER GOAL
   │
   ▼
[AgentEngine] ──► [LLMProvider] (Ollama / Qwen2.5)
   │                    │
   │ (Tool Calls)       │
   ▼                    ▼
[ToolRegistry] ──► [AgentTool Execution]
   │                    │
   └─◄── Observation ───┘
   │
   ▼
[Final Response]
```

---

## Monorepo Layout

```text
nova/
├── shared/             # Shared types, Zod schemas, LLM & agent contracts
│   ├── src/
│   │   ├── types/
│   │   │   ├── agent.types.ts
│   │   │   └── llm.types.ts
│   │   └── index.ts
│   └── package.json
│
├── server/             # Express.js + TypeScript backend
│   ├── src/
│   │   ├── agents/     # AgentEngine runtime & context
│   │   ├── tools/      # ToolRegistry, Zod-to-JSON converter, datetime & calculate tools
│   │   ├── llm/        # LLMProvider abstraction & Ollama implementation
│   │   ├── config/     # Zod-validated environment config
│   │   ├── db/         # Mongoose with memory-server fallback
│   │   ├── models/     # User schema with bcrypt password hashing
│   │   ├── middleware/ # JWT Auth middleware
│   │   ├── controllers/# Auth and Agent controllers
│   │   ├── routes/     # Express route definitions
│   │   └── utils/      # Pino logger
│   └── package.json
│
├── client/             # Frontend React app (coming in Phase 6)
├── docker-compose.yml  # Local infrastructure (MongoDB, Redis)
├── .env.example        # Environment variable definitions
└── package.json        # Monorepo root scripts
```

---

## Getting Started

### 1. Prerequisites
- Node.js (v20+ recommended)
- [Ollama](https://ollama.com/) with `qwen2.5:7b` installed:
  ```bash
  ollama run qwen2.5:7b
  ```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build Shared Types
```bash
npm --workspace=shared run build
```

### 4. Run Unit and Integration Tests
```bash
npm --workspace=server run test
```

### 5. Run Live Agent Verification with Ollama
```bash
npx --prefix server tsx src/scripts/test-live-agent.ts
```

### 6. Start the Server
```bash
npm --workspace=server run dev
```

---

## API Endpoints (Phase 1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status and LLM configuration |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and obtain JWT token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `GET` | `/api/agent/tools` | List registered tools and risk levels |
| `POST` | `/api/agent/run` | Execute an autonomous agent goal |

---

## Phase Roadmap

- [x] **Phase 1: Backend Architecture & Minimal AgentEngine** (Foundation, Tool Registry, Calculator, DateTime, Ollama tool calling loop, JWT Auth, Vitest tests)
- [ ] **Phase 2: Productivity Tools & Web Integration** (Tasks, Reminders, Web Search, Web Fetch)
- [ ] **Phase 3: Multi-Tier Memory & Real-Time Runs** (Working, Episodic, Semantic Vector Search, Socket.IO streaming)
- [ ] **Phase 4: Redis Queues & Scheduled Automations** (BullMQ workers, cron schedules)
- [ ] **Phase 5: Permission Engine & Browser Automation** (Risk approvals, Playwright)
- [ ] **Phase 6: Modern Dashboard & External Integrations** (React, Tailwind, shadcn/ui, OAuth)
