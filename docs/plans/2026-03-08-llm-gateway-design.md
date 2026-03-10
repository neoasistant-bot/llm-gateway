# LLM Gateway - Design Document

## Overview

LLM Gateway is a B2B SaaS platform that exposes configurable AI-powered methods to clients via REST API and Web UI. The platform owner (admin) creates methods backed by prompt templates and LLM providers. Clients consume these methods, customize their output schemas, and receive structured responses.

## Core Concepts

- **Method**: A reusable AI operation defined by a prompt template, an LLM provider/model, and an input type (TEXT or JSON_SCHEMA). Methods can be public (available to all clients) or assigned to specific clients.
- **Prompt Template**: Hidden from clients. Combined with client input and output schema to form the final prompt sent to the LLM.
- **Output Schema**: A JSON structure defined by the client that dictates the shape of the LLM response. Injected into the prompt so the LLM completes the schema with real data.
- **Execution**: A single invocation of a method. Can be synchronous or asynchronous. Every execution is tracked with tokens, latency, and full audit data.

## Architecture

Monolithic modular NestJS backend with Bull/Redis for async job processing.

```
┌─────────────────────────────────────────┐
│            NestJS Backend               │
│  ┌─────┐ ┌────────┐ ┌───────────────┐  │
│  │Auth │ │Methods │ │LLM Provider   │  │
│  ├─────┤ ├────────┤ │  ┌──────────┐ │  │
│  │Users│ │Tracking│ │  │OpenAI    │ │  │
│  ├─────┤ ├────────┤ │  │Anthropic │ │  │
│  │Audit│ │Schemas │ │  │Google    │ │  │
│  └─────┘ └────────┘ │  └──────────┘ │  │
│                      └───────────────┘  │
│  ┌──────────────────────────────────┐   │
│  │  Bull Queue (Redis) - async jobs │   │
│  └──────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──┐  ┌───────┐  ┌─────────┐
│   PostgreSQL    │  │ Redis │  │ Next.js │
│                 │  │       │  │Frontend │
└─────────────────┘  └───────┘  └─────────┘
```

### Tech Stack

| Layer        | Technology              |
|--------------|-------------------------|
| Backend      | NestJS + TypeScript     |
| Frontend     | Next.js + React + TS    |
| Database     | PostgreSQL + Prisma     |
| Async Queue  | Bull + Redis            |
| Auth         | JWT (access + refresh)  |
| LLM Providers| OpenAI, Anthropic, Google (extensible) |
| Local Infra  | Docker Compose          |

## Data Model

### User
| Field        | Type     | Notes                          |
|--------------|----------|--------------------------------|
| id           | UUID PK  |                                |
| email        | string   | Unique                         |
| passwordHash | string   |                                |
| role         | enum     | ADMIN, CLIENT                  |
| isActive     | boolean  |                                |
| outputSchema | json?    | Default output schema for client |
| createdAt    | datetime |                                |
| updatedAt    | datetime |                                |

### Method
| Field          | Type     | Notes                              |
|----------------|----------|------------------------------------|
| id             | UUID PK  |                                    |
| name           | string   |                                    |
| description    | string   |                                    |
| inputType      | enum     | TEXT, JSON_SCHEMA                  |
| promptTemplate | text     | Hidden from clients                |
| provider       | enum     | OPENAI, ANTHROPIC, GOOGLE          |
| model          | string   | e.g. gpt-4o, claude-sonnet-4-6     |
| isPublic       | boolean  | If true, all clients can access    |
| config         | json     | temperature, maxTokens, etc.       |
| createdAt      | datetime |                                    |
| updatedAt      | datetime |                                    |

### UserMethod (pivot)
| Field               | Type     | Notes                           |
|---------------------|----------|---------------------------------|
| userId              | UUID FK  |                                 |
| methodId            | UUID FK  |                                 |
| outputSchemaOverride| json?    | Overrides user default schema   |
| isActive            | boolean  |                                 |

### MethodExecution
| Field        | Type     | Notes                                |
|--------------|----------|--------------------------------------|
| id           | UUID PK  |                                      |
| userId       | UUID FK  |                                      |
| methodId     | UUID FK  |                                      |
| status       | enum     | PENDING, PROCESSING, COMPLETED, FAILED |
| input        | json     | What the client sent                 |
| output       | json     | LLM response                        |
| promptSent   | text     | Full assembled prompt                |
| provider     | string   |                                      |
| model        | string   |                                      |
| tokensInput  | int      |                                      |
| tokensOutput | int      |                                      |
| latencyMs    | int      |                                      |
| error        | json?    | Error details if failed              |
| createdAt    | datetime |                                      |
| completedAt  | datetime?|                                      |

### AuditLog
| Field      | Type     | Notes                             |
|------------|----------|-----------------------------------|
| id         | UUID PK  |                                   |
| userId     | UUID FK? | Nullable for system actions       |
| action     | enum     | LOGIN, CREATE_METHOD, EXECUTE, etc.|
| resource   | string   | Entity type (user, method, etc.)  |
| resourceId | string?  |                                   |
| details    | json     |                                   |
| ip         | string   |                                   |
| createdAt  | datetime |                                   |

## Backend Modules

```
src/
├── auth/           # JWT login, refresh, guards, decorators
├── users/          # User CRUD (admin)
├── methods/        # Method CRUD + user-method assignment
├── execution/      # Execute methods (sync/async), prompt builder, Bull processor
├── llm/            # Provider abstraction (OpenAI, Anthropic, Google)
├── tracking/       # Usage tracking (tokens, requests, latency)
├── audit/          # Audit logging (interceptor + service)
├── common/         # Shared filters, pipes, interceptors, types
└── prisma/         # Prisma service + schema
```

## LLM Provider System

All providers implement a common interface:

```typescript
interface LLMResponse {
  content: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
  provider: string;
  rawResponse?: any;
}

interface LLMConfig {
  temperature?: number;
  maxTokens?: number;
}
```

Adding a new provider: create a provider class implementing BaseProvider, register in LLMModule.

## Prompt Assembly

The PromptBuilder combines three pieces into the final prompt:

1. **Prompt Template** (from Method) - The system instructions, hidden from client
2. **Client Input** (from request) - Text or JSON depending on method inputType
3. **Output Schema** (from client config) - JSON structure the LLM must fill

## Execution Flows

### Synchronous
```
POST /execute/:methodId { input, async: false }
→ Validate JWT + access
→ PromptBuilder assembles prompt
→ LLMService calls provider
→ Track usage + audit log
→ Return response
```

### Asynchronous
```
POST /execute/:methodId { input, async: true }
→ Create MethodExecution (status: PENDING)
→ Enqueue Bull job
→ Return { executionId, status: "PENDING" }

Bull Worker:
→ Same logic as sync
→ Update MethodExecution with result

GET /executions/:id → Poll for result
```

## API Endpoints

### Auth
- `POST /auth/login` — Login, returns access + refresh tokens
- `POST /auth/refresh` — Renew access token

### Users (ADMIN)
- `GET /users` — List clients
- `GET /users/:id` — Client detail
- `POST /users` — Create client
- `PATCH /users/:id` — Update client
- `DELETE /users/:id` — Deactivate client

### Methods
- `GET /methods` — List methods (admin: all, client: assigned)
- `GET /methods/:id` — Method detail (client: no promptTemplate)
- `POST /methods` — Create method (ADMIN)
- `PATCH /methods/:id` — Update method (ADMIN)
- `DELETE /methods/:id` — Deactivate method (ADMIN)

### User-Methods
- `POST /users/:id/methods` — Assign method to client (ADMIN)
- `DELETE /users/:id/methods/:methodId` — Unassign method (ADMIN)
- `PATCH /me/methods/:methodId/schema` — Set my outputSchema for a method (CLIENT)
- `GET /me/methods` — My methods with my schemas (CLIENT)

### Execution
- `POST /execute/:methodId` — Execute method (CLIENT)
- `GET /executions/:id` — Get execution result (CLIENT)
- `GET /executions` — Execution history (CLIENT: mine, ADMIN: all)

### Tracking
- `GET /tracking/usage` — Usage stats (CLIENT: mine, ADMIN: all/filtered)

### Audit
- `GET /audit/logs` — Audit logs with filters (ADMIN)

## Web UI Routes

### Client Portal
```
/login
/dashboard              — Summary: methods, recent usage
/methods                — My assigned methods
/methods/:id            — Method detail + configure outputSchema
/methods/:id/playground — Test method with live input
/executions             — Execution history
/executions/:id         — Execution detail (input, output, metrics)
/usage                  — My consumption stats
/settings               — Change password
```

### Admin Panel
```
/admin/dashboard          — Overview: active clients, executions today, total usage
/admin/methods            — CRUD methods
/admin/methods/:id        — Edit method: template, provider, model, config
/admin/methods/:id/test   — Admin playground
/admin/clients            — Client list + usage
/admin/clients/:id        — Client detail: assigned methods, usage, schemas
/admin/clients/:id/assign — Assign/unassign methods
/admin/executions         — Global execution history
/admin/audit              — Audit logs
```

Single Next.js app — middleware checks JWT role and gates `/admin/*` routes.

## Docker Compose (local dev)

```yaml
services:
  api:        # NestJS backend (port 3000, hot reload)
  frontend:   # Next.js (port 3001, hot reload)
  db:         # PostgreSQL (port 5432)
  redis:      # Redis for Bull queues (port 6379)
```

## Key Design Decisions

1. **Monolith modular over microservices** — Simpler for MVP, NestJS modules can be extracted later
2. **Bull + Redis for async** — Robust job processing with retries, priority, concurrency
3. **Prompt template hidden from clients** — IP protection, clients only control output schema
4. **Provider abstraction** — Adding a new LLM provider is one file + registration
5. **Single Next.js app for both portals** — Role-based routing, shared components
6. **Platform-managed API keys** — Admin controls all LLM keys, cost included in pricing
7. **Comprehensive tracking from day 1** — Enables future billing model decisions

---

## User Stories (MVP)

### Epic 1: Authentication & Authorization

**US-01: Admin Login**
- As an admin, I want to log in with email and password so that I can access the admin panel.
- Acceptance: POST /auth/login returns JWT access + refresh tokens. Admin is redirected to /admin/dashboard.

**US-02: Client Login**
- As a client, I want to log in with email and password so that I can access my portal.
- Acceptance: POST /auth/login returns JWT tokens. Client is redirected to /dashboard.

**US-03: Token Refresh**
- As an authenticated user, I want my session to refresh automatically so that I don't get logged out unexpectedly.
- Acceptance: POST /auth/refresh accepts a valid refresh token and returns a new access token. Expired refresh tokens are rejected.

**US-04: Role-Based Access Control**
- As the system, I must restrict routes based on user role so that clients cannot access admin functionality.
- Acceptance: CLIENT role cannot access /admin/* routes or admin-only API endpoints. Unauthorized access returns 403.

### Epic 2: User Management

**US-05: Create Client**
- As an admin, I want to create new client accounts so that companies can use the platform.
- Acceptance: POST /users with email, password, and role=CLIENT creates an active user. Duplicate emails are rejected.

**US-06: List and View Clients**
- As an admin, I want to see all clients and their details so that I can manage the platform.
- Acceptance: GET /users returns paginated list. GET /users/:id returns client detail including assigned methods and usage summary.

**US-07: Deactivate Client**
- As an admin, I want to deactivate a client so that they can no longer access the platform.
- Acceptance: DELETE /users/:id sets isActive=false. Deactivated users cannot log in. Their data is preserved.

**US-08: Edit Client**
- As an admin, I want to edit client information so that I can update their details.
- Acceptance: PATCH /users/:id updates allowed fields (email, isActive). Password can be reset.

### Epic 3: Method Management

**US-09: Create Method**
- As an admin, I want to create a new method with a prompt template, provider, model, and input type so that clients can use it.
- Acceptance: POST /methods creates a method. Required fields: name, promptTemplate, provider, model, inputType. Optional: description, config (temperature, maxTokens), isPublic.

**US-10: Edit Method**
- As an admin, I want to edit a method's prompt template, provider, model, and configuration so that I can iterate on its behavior.
- Acceptance: PATCH /methods/:id updates allowed fields. Changes take effect on the next execution.

**US-11: List Methods (Admin)**
- As an admin, I want to see all methods with their configuration so that I can manage the method library.
- Acceptance: GET /methods returns all methods with full detail including promptTemplate.

**US-12: Deactivate Method**
- As an admin, I want to deactivate a method so that it can no longer be executed.
- Acceptance: DELETE /methods/:id sets method as inactive. Active assignments are preserved but executions are blocked.

**US-13: Assign Method to Client**
- As an admin, I want to assign specific methods to a client so that they can access them.
- Acceptance: POST /users/:id/methods assigns the method. Client immediately sees it in their method list.

**US-14: Unassign Method from Client**
- As an admin, I want to remove a method from a client so that they can no longer use it.
- Acceptance: DELETE /users/:id/methods/:methodId removes the assignment. Execution history is preserved.

**US-15: Public Methods**
- As a client, I want to see and use all public methods without needing explicit assignment.
- Acceptance: GET /methods (client) returns all public methods + my assigned private methods.

### Epic 4: Output Schema Configuration

**US-16: Configure Output Schema**
- As a client, I want to define my output schema (a JSON structure) for a method so that the AI responds in my desired format.
- Acceptance: PATCH /me/methods/:methodId/schema saves a JSON schema. The schema is validated as valid JSON. The schema is used in the next execution.

**US-17: View My Method Configuration**
- As a client, I want to see my methods with my configured output schemas so that I know how each method will respond.
- Acceptance: GET /me/methods returns methods with my outputSchemaOverride (or default if not set).

### Epic 5: Method Execution

**US-18: Synchronous Execution**
- As a client, I want to execute a method synchronously so that I get an immediate response.
- Acceptance: POST /execute/:methodId with { input, async: false } returns the LLM response directly. Input is validated against the method's inputType (text or JSON). Response time depends on the LLM.

**US-19: Asynchronous Execution**
- As a client, I want to execute a method asynchronously so that I can handle long-running AI operations.
- Acceptance: POST /execute/:methodId with { input, async: true } returns { executionId, status: "PENDING" }. The job is processed in background via Bull queue.

**US-20: Poll Async Result**
- As a client, I want to check the status and result of an async execution so that I can retrieve the response when ready.
- Acceptance: GET /executions/:id returns current status (PENDING, PROCESSING, COMPLETED, FAILED) and the result if completed.

**US-21: Execution History**
- As a client, I want to see my execution history so that I can review past results.
- Acceptance: GET /executions returns paginated list of my executions with status, method name, date, and token usage.

**US-22: Admin Execution History**
- As an admin, I want to see all executions across clients so that I can monitor platform usage.
- Acceptance: GET /executions (admin) returns global history filterable by client, method, status, and date range.

### Epic 6: Prompt Builder

**US-23: Prompt Assembly**
- As the system, I must assemble the final prompt from template + input + output schema so that the LLM receives a complete, well-structured prompt.
- Acceptance: PromptBuilder combines the three pieces. If no output schema is configured, the method executes without schema constraints. Template variables (if any) are interpolated with input data.

**US-24: Input Validation**
- As the system, I must validate the client's input against the method's inputType so that invalid data is rejected before calling the LLM.
- Acceptance: TEXT methods accept any string. JSON_SCHEMA methods validate that the input is valid JSON. Invalid input returns 400 with a descriptive error.

### Epic 7: LLM Provider Integration

**US-25: OpenAI Provider**
- As the system, I must call OpenAI's API when a method is configured with provider=OPENAI.
- Acceptance: Calls OpenAI chat completions API. Maps config (temperature, maxTokens). Returns standardized LLMResponse with token counts.

**US-26: Anthropic Provider**
- As the system, I must call Anthropic's API when a method is configured with provider=ANTHROPIC.
- Acceptance: Calls Anthropic messages API. Maps config. Returns standardized LLMResponse.

**US-27: Google Provider**
- As the system, I must call Google's Generative AI API when a method is configured with provider=GOOGLE.
- Acceptance: Calls Google Gemini API. Maps config. Returns standardized LLMResponse.

**US-28: Provider Error Handling**
- As the system, I must handle LLM provider errors gracefully so that the client receives meaningful error information.
- Acceptance: API errors, timeouts, and rate limits are caught. MethodExecution is updated with error details. Client receives appropriate HTTP status and error message.

### Epic 8: Tracking & Usage

**US-29: Execution Tracking**
- As the system, I must record usage metrics for every execution so that consumption data is available for future billing.
- Acceptance: Every execution records: tokensInput, tokensOutput, provider, model, latencyMs, timestamp, userId, methodId.

**US-30: Client Usage Dashboard**
- As a client, I want to see my usage statistics so that I understand my consumption.
- Acceptance: GET /tracking/usage returns aggregated stats: total requests, total tokens, breakdown by method and time period.

**US-31: Admin Usage Overview**
- As an admin, I want to see usage across all clients so that I can monitor platform consumption.
- Acceptance: GET /tracking/usage (admin) returns global stats filterable by client, method, provider, and date range.

### Epic 9: Audit Logging

**US-32: Automatic Audit Logging**
- As the system, I must log all significant actions so that there is a complete audit trail.
- Acceptance: The audit interceptor automatically logs: logins, CRUD operations on users/methods, executions, schema changes. Each log entry includes userId, action, resource, IP, and timestamp.

**US-33: Audit Log Viewer**
- As an admin, I want to browse audit logs with filters so that I can investigate activity.
- Acceptance: GET /audit/logs returns paginated logs filterable by user, action, resource, and date range.

### Epic 10: Admin Panel UI

**US-34: Admin Dashboard**
- As an admin, I want a dashboard showing platform overview so that I can monitor health at a glance.
- Acceptance: /admin/dashboard shows: active clients count, executions today, total token usage, recent activity.

**US-35: Method Management UI**
- As an admin, I want a UI to create and edit methods so that I don't need to use the API directly.
- Acceptance: /admin/methods lists all methods. Create/edit forms include all fields: name, description, promptTemplate, provider, model, inputType, config, isPublic.

**US-36: Admin Playground**
- As an admin, I want to test methods from the UI so that I can validate prompt templates before exposing them to clients.
- Acceptance: /admin/methods/:id/test provides an input field, executes the method, and shows the full result including the assembled prompt.

**US-37: Client Management UI**
- As an admin, I want a UI to manage clients and their method assignments so that I can onboard and configure clients.
- Acceptance: /admin/clients lists clients with usage summary. Detail view shows assigned methods. UI allows assigning/unassigning methods.

### Epic 11: Client Portal UI

**US-38: Client Dashboard**
- As a client, I want a dashboard showing my methods and recent usage so that I have a quick overview.
- Acceptance: /dashboard shows: available methods count, recent executions, token usage summary.

**US-39: Method List and Schema Config**
- As a client, I want to see my methods and configure my output schema from the UI.
- Acceptance: /methods lists available methods (public + assigned). /methods/:id shows method detail (no template) and allows editing my outputSchema via a JSON editor.

**US-40: Client Playground**
- As a client, I want to test methods from the UI so that I can experiment with inputs and see results.
- Acceptance: /methods/:id/playground provides an input field (text or JSON depending on inputType), executes the method, and shows the response formatted according to my output schema.

**US-41: Execution History UI**
- As a client, I want to browse my execution history from the UI so that I can review past results.
- Acceptance: /executions shows paginated list with status, method, date, tokens. /executions/:id shows full detail.

**US-42: Usage Stats UI**
- As a client, I want to see my usage statistics in the UI so that I can track my consumption visually.
- Acceptance: /usage shows requests and tokens over time, breakdown by method.

### Epic 12: Infrastructure & DevOps

**US-43: Docker Compose Setup**
- As a developer, I want a docker-compose.yml that runs the full stack locally so that I can develop without external dependencies.
- Acceptance: `docker-compose up` starts api (NestJS:3000), frontend (Next.js:3001), db (PostgreSQL:5432), redis (Redis:6379). Hot reload works for api and frontend.

**US-44: Database Migrations**
- As a developer, I want Prisma migrations so that database schema changes are versioned and reproducible.
- Acceptance: `npx prisma migrate dev` applies migrations. Schema matches the data model defined in this document.

**US-45: Environment Configuration**
- As a developer, I want environment variables for all secrets and configuration so that nothing is hardcoded.
- Acceptance: .env.example documents all required variables: DATABASE_URL, REDIS_URL, JWT_SECRET, OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY. .env is gitignored.

**US-46: Seed Data**
- As a developer, I want a seed script that creates an admin user and sample methods so that I can start testing immediately.
- Acceptance: `npx prisma db seed` creates an admin user (admin@llmgateway.com) and 2-3 sample methods with prompt templates.
