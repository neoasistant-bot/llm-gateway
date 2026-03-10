# LLM Gateway - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a B2B SaaS LLM Gateway MVP — API + Web UI for managing and executing AI-powered methods with user tracking.

**Architecture:** Monolithic modular NestJS backend with Bull/Redis for async jobs, PostgreSQL via Prisma, Next.js frontend with role-based portals (admin + client).

**Tech Stack:** NestJS, Next.js, TypeScript, Prisma, PostgreSQL, Bull, Redis, JWT, Docker Compose

---

## Dependency Map

```
US-43 (Docker Compose) ──────────────────────────────────────────────────────┐
US-45 (Env Config) ──────────────────────────────────────────────────────────┤
                                                                             ▼
US-44 (DB Migrations / Prisma Schema) ◄──────────────────────── Infrastructure ready
        │
        ├──► US-01/02 (Auth Login) ◄── requires User table
        │         │
        │         ├──► US-03 (Token Refresh)
        │         │
        │         └──► US-04 (RBAC Guards) ◄── requires Auth working
        │                   │
        │                   ├──► US-05 (Create Client)
        │                   │         │
        │                   │         ├──► US-06 (List/View Clients)
        │                   │         ├──► US-07 (Deactivate Client)
        │                   │         └──► US-08 (Edit Client)
        │                   │
        │                   ├──► US-09 (Create Method)
        │                   │         │
        │                   │         ├──► US-10 (Edit Method)
        │                   │         ├──► US-11 (List Methods Admin)
        │                   │         ├──► US-12 (Deactivate Method)
        │                   │         │
        │                   │         └──► US-13 (Assign Method) ◄── requires US-05 + US-09
        │                   │                   │
        │                   │                   ├──► US-14 (Unassign Method)
        │                   │                   └──► US-15 (Public Methods)
        │                   │
        │                   └──► US-32 (Audit Logging) ◄── interceptor, needs Auth
        │
        ├──► US-16 (Configure Output Schema) ◄── requires US-13 (UserMethod exists)
        │         │
        │         └──► US-17 (View My Method Config)
        │
        ├──► US-25 (OpenAI Provider) ─────────┐
        ├──► US-26 (Anthropic Provider) ──────┤── LLM Providers (independent of each other)
        ├──► US-27 (Google Provider) ─────────┤
        │                                      ▼
        │                              US-28 (Provider Error Handling)
        │
        ├──► US-23 (Prompt Assembly) ◄── requires US-09 (Method) + US-16 (Schema)
        │         │
        │         └──► US-24 (Input Validation)
        │
        └──► US-18 (Sync Execution) ◄── requires US-23 + US-25/26/27 + US-04 + US-29
                  │
                  ├──► US-19 (Async Execution) ◄── requires Bull/Redis setup
                  │         │
                  │         └──► US-20 (Poll Async Result)
                  │
                  ├──► US-21 (Execution History Client)
                  ├──► US-22 (Execution History Admin)
                  │
                  └──► US-29 (Execution Tracking) ◄── built into execution flow
                            │
                            ├──► US-30 (Client Usage Dashboard)
                            └──► US-31 (Admin Usage Overview)

US-33 (Audit Log Viewer) ◄── requires US-32

US-46 (Seed Data) ◄── requires US-44 (schema) + US-05 (user logic) + US-09 (method logic)

─── FRONTEND (requires corresponding API endpoints) ───

US-34 (Admin Dashboard) ◄── requires US-31 + US-22
US-35 (Method Mgmt UI) ◄── requires US-09/10/11/12
US-36 (Admin Playground) ◄── requires US-18 + US-35
US-37 (Client Mgmt UI) ◄── requires US-05/06/07/08 + US-13/14

US-38 (Client Dashboard) ◄── requires US-30 + US-21
US-39 (Schema Config UI) ◄── requires US-16/17 + US-15
US-40 (Client Playground) ◄── requires US-18 + US-39
US-41 (Execution History UI) ◄── requires US-21
US-42 (Usage Stats UI) ◄── requires US-30
```

## Implementation Phases

The plan is organized in 8 phases. Each phase builds on the previous one. Within a phase, tasks can be parallelized where noted.

---

## Phase 1: Project Scaffolding & Infrastructure

**Stories:** US-43, US-45, US-44, US-46

### Task 1: Initialize monorepo structure

**Stories:** US-43, US-45
**Depends on:** Nothing (starting point)
**Blocks:** Everything else

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/nest-cli.json`
- Create: `backend/.env.example`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`
- Create: `frontend/package.json`
- Create: `frontend/.env.example`
- Create: `.gitignore`
- Create: `.env.example` (root)

**Step 1: Create project directories**

```bash
mkdir -p backend frontend
```

**Step 2: Scaffold NestJS backend**

```bash
cd backend
npx @nestjs/cli new . --package-manager npm --skip-git
npm install @nestjs/config
```

**Step 3: Scaffold Next.js frontend**

```bash
cd frontend
npx create-next-app . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 4: Create docker-compose.yml**

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: llm_gateway
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/llm_gateway
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: npm run start:dev

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3001:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    depends_on:
      - api
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

volumes:
  pgdata:
  redisdata:
```

**Step 5: Create backend Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
```

**Step 6: Create frontend Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

**Step 7: Create .env.example (root)**

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/llm_gateway

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# LLM Providers
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_API_KEY=your-google-key

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Step 8: Create .gitignore**

```
node_modules/
dist/
.env
*.log
.next/
```

**Step 9: Verify docker-compose starts**

```bash
docker-compose up -d db redis
docker-compose ps
```

Expected: db and redis containers running.

**Step 10: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold monorepo with NestJS, Next.js, Docker Compose"
```

---

### Task 2: Prisma schema and initial migration

**Stories:** US-44
**Depends on:** Task 1
**Blocks:** Tasks 3-16

**Files:**
- Create: `backend/prisma/schema.prisma`
- Modify: `backend/package.json` (add prisma deps)

**Step 1: Install Prisma**

```bash
cd backend
npm install prisma @prisma/client
npx prisma init
```

**Step 2: Write the Prisma schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  CLIENT
}

enum InputType {
  TEXT
  JSON_SCHEMA
}

enum Provider {
  OPENAI
  ANTHROPIC
  GOOGLE
}

enum ExecutionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum AuditAction {
  LOGIN
  LOGOUT
  CREATE_USER
  UPDATE_USER
  DEACTIVATE_USER
  CREATE_METHOD
  UPDATE_METHOD
  DEACTIVATE_METHOD
  ASSIGN_METHOD
  UNASSIGN_METHOD
  UPDATE_SCHEMA
  EXECUTE_METHOD
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(CLIENT)
  isActive     Boolean  @default(true)
  outputSchema Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  methods    UserMethod[]
  executions MethodExecution[]
  auditLogs  AuditLog[]
}

model Method {
  id             String    @id @default(uuid())
  name           String
  description    String?
  inputType      InputType @default(TEXT)
  promptTemplate String
  provider       Provider
  model          String
  isPublic       Boolean   @default(false)
  isActive       Boolean   @default(true)
  config         Json?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  users      UserMethod[]
  executions MethodExecution[]
}

model UserMethod {
  userId              String
  methodId            String
  outputSchemaOverride Json?
  isActive            Boolean @default(true)

  user   User   @relation(fields: [userId], references: [id])
  method Method @relation(fields: [methodId], references: [id])

  @@id([userId, methodId])
}

model MethodExecution {
  id           String          @id @default(uuid())
  userId       String
  methodId     String
  status       ExecutionStatus @default(PENDING)
  input        Json
  output       Json?
  promptSent   String?
  provider     String?
  model        String?
  tokensInput  Int?
  tokensOutput Int?
  latencyMs    Int?
  error        Json?
  createdAt    DateTime        @default(now())
  completedAt  DateTime?

  user   User   @relation(fields: [userId], references: [id])
  method Method @relation(fields: [methodId], references: [id])
}

model AuditLog {
  id         String      @id @default(uuid())
  userId     String?
  action     AuditAction
  resource   String
  resourceId String?
  details    Json?
  ip         String?
  createdAt  DateTime    @default(now())

  user User? @relation(fields: [userId], references: [id])
}
```

**Step 3: Create PrismaService**

Create `backend/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

Create `backend/src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Step 4: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration created, tables exist in PostgreSQL.

**Step 5: Verify**

```bash
npx prisma studio
```

Expected: Browser opens showing all tables with correct columns.

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add Prisma schema with all MVP entities and initial migration"
```

---

## Phase 2: Authentication & Authorization

**Stories:** US-01, US-02, US-03, US-04

### Task 3: Auth module — JWT login and refresh

**Stories:** US-01, US-02, US-03
**Depends on:** Task 2 (Prisma schema)
**Blocks:** Tasks 4, 5, 6, 7, 8

**Files:**
- Create: `backend/src/auth/auth.module.ts`
- Create: `backend/src/auth/auth.controller.ts`
- Create: `backend/src/auth/auth.service.ts`
- Create: `backend/src/auth/jwt.strategy.ts`
- Create: `backend/src/auth/dto/login.dto.ts`
- Create: `backend/src/auth/dto/auth-response.dto.ts`
- Create: `backend/src/auth/dto/refresh.dto.ts`
- Test: `backend/src/auth/auth.service.spec.ts`
- Test: `backend/src/auth/auth.controller.spec.ts`

**Step 1: Install dependencies**

```bash
cd backend
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer
npm install -D @types/passport-jwt @types/bcrypt
```

**Step 2: Write failing test for auth service**

Create `backend/src/auth/auth.service.spec.ts` testing:
- `login()` with valid credentials returns access + refresh tokens
- `login()` with invalid email throws UnauthorizedException
- `login()` with wrong password throws UnauthorizedException
- `login()` with inactive user throws UnauthorizedException
- `refreshToken()` with valid refresh token returns new access token
- `refreshToken()` with expired token throws UnauthorizedException

**Step 3: Run test to verify it fails**

```bash
npm run test -- --testPathPattern=auth.service.spec
```

Expected: FAIL — auth module does not exist.

**Step 4: Implement DTOs**

`login.dto.ts`:
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
```

`auth-response.dto.ts`:
```typescript
export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}
```

`refresh.dto.ts`:
```typescript
import { IsString } from 'class-validator';

export class RefreshDto {
  @IsString()
  refreshToken: string;
}
```

**Step 5: Implement AuthService**

`auth.service.ts` — login with bcrypt compare, generate JWT access (15m) + refresh (7d) tokens. Refresh validates and issues new access token.

**Step 6: Implement JwtStrategy**

`jwt.strategy.ts` — Passport JWT strategy extracting token from Authorization Bearer header. Validates user exists and is active.

**Step 7: Implement AuthController**

`auth.controller.ts`:
- `POST /auth/login` — accepts LoginDto, returns AuthResponseDto
- `POST /auth/refresh` — accepts RefreshDto, returns new access token

**Step 8: Wire up AuthModule**

Register JwtModule, PassportModule, AuthService, JwtStrategy in `auth.module.ts`. Import in AppModule.

**Step 9: Run tests to verify they pass**

```bash
npm run test -- --testPathPattern=auth.service.spec
```

Expected: All tests PASS.

**Step 10: Test manually with curl**

```bash
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"admin@llmgateway.com","password":"admin123"}'
```

**Step 11: Commit**

```bash
git add .
git commit -m "feat: add auth module with JWT login and refresh"
```

---

### Task 4: RBAC guards and decorators

**Stories:** US-04
**Depends on:** Task 3
**Blocks:** Tasks 5, 6, 7, 8

**Files:**
- Create: `backend/src/auth/guards/jwt-auth.guard.ts`
- Create: `backend/src/auth/guards/roles.guard.ts`
- Create: `backend/src/auth/decorators/current-user.decorator.ts`
- Create: `backend/src/auth/decorators/roles.decorator.ts`
- Test: `backend/src/auth/guards/roles.guard.spec.ts`

**Step 1: Write failing test for RolesGuard**

Test that:
- Request with ADMIN role accessing ADMIN route → allowed
- Request with CLIENT role accessing ADMIN route → ForbiddenException
- Request with CLIENT role accessing CLIENT route → allowed
- Route with no role decorator → allowed for any authenticated user

**Step 2: Run test to verify it fails**

```bash
npm run test -- --testPathPattern=roles.guard.spec
```

**Step 3: Implement guards and decorators**

`roles.decorator.ts`:
```typescript
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

`current-user.decorator.ts`:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

`jwt-auth.guard.ts` — extends AuthGuard('jwt').

`roles.guard.ts` — reads ROLES_KEY metadata, compares with request.user.role.

**Step 4: Run tests**

```bash
npm run test -- --testPathPattern=roles.guard.spec
```

Expected: PASS.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add RBAC guards and user decorators"
```

---

## Phase 3: Core CRUD Modules

**Stories:** US-05 to US-17

### Task 5: Users module (CRUD)

**Stories:** US-05, US-06, US-07, US-08
**Depends on:** Task 4 (guards)
**Blocks:** Task 7 (assign methods), Task 10 (seed)

**Files:**
- Create: `backend/src/users/users.module.ts`
- Create: `backend/src/users/users.controller.ts`
- Create: `backend/src/users/users.service.ts`
- Create: `backend/src/users/dto/create-user.dto.ts`
- Create: `backend/src/users/dto/update-user.dto.ts`
- Test: `backend/src/users/users.service.spec.ts`

**Step 1: Write failing tests**

Test UsersService:
- `create()` hashes password and creates user with CLIENT role
- `create()` rejects duplicate email
- `findAll()` returns paginated list (exclude passwordHash)
- `findOne()` returns user with methods and usage summary
- `update()` updates allowed fields
- `deactivate()` sets isActive=false

**Step 2: Run tests — expect FAIL**

**Step 3: Implement DTOs, Service, Controller**

Controller routes all protected with `@Roles(Role.ADMIN)`:
- `POST /users` — create client (hashes password with bcrypt)
- `GET /users` — paginated list
- `GET /users/:id` — detail with includes
- `PATCH /users/:id` — update
- `DELETE /users/:id` — soft deactivate

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add users CRUD module (admin only)"
```

---

### Task 6: Methods module (CRUD)

**Stories:** US-09, US-10, US-11, US-12, US-15
**Depends on:** Task 4 (guards)
**Blocks:** Task 7, Task 8, Task 9

**Files:**
- Create: `backend/src/methods/methods.module.ts`
- Create: `backend/src/methods/methods.controller.ts`
- Create: `backend/src/methods/methods.service.ts`
- Create: `backend/src/methods/dto/create-method.dto.ts`
- Create: `backend/src/methods/dto/update-method.dto.ts`
- Test: `backend/src/methods/methods.service.spec.ts`

**Step 1: Write failing tests**

Test MethodsService:
- `create()` creates method with all fields
- `findAll()` (admin) returns all methods including promptTemplate
- `findAllForClient(userId)` returns public methods + assigned private methods WITHOUT promptTemplate
- `findOne()` returns method (admin: full, client: no template)
- `update()` updates fields
- `deactivate()` sets isActive=false

**Step 2: Run tests — expect FAIL**

**Step 3: Implement DTOs, Service, Controller**

Controller:
- `POST /methods` — `@Roles(Role.ADMIN)` create method
- `GET /methods` — admin sees all (with template), client sees own (no template)
- `GET /methods/:id` — same role-based filtering
- `PATCH /methods/:id` — `@Roles(Role.ADMIN)`
- `DELETE /methods/:id` — `@Roles(Role.ADMIN)`

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add methods CRUD module with role-based visibility"
```

---

### Task 7: User-Methods assignment and schema config

**Stories:** US-13, US-14, US-16, US-17
**Depends on:** Task 5 (users) + Task 6 (methods)
**Blocks:** Task 9 (execution)

**Files:**
- Create: `backend/src/methods/user-methods/user-methods.controller.ts`
- Create: `backend/src/methods/user-methods/user-methods.service.ts`
- Create: `backend/src/methods/user-methods/dto/assign-method.dto.ts`
- Create: `backend/src/methods/user-methods/dto/update-schema.dto.ts`
- Test: `backend/src/methods/user-methods/user-methods.service.spec.ts`

**Step 1: Write failing tests**

Test UserMethodsService:
- `assign(userId, methodId)` creates UserMethod record
- `assign()` rejects duplicate assignment
- `unassign(userId, methodId)` deletes UserMethod
- `updateSchema(userId, methodId, schema)` saves outputSchemaOverride as valid JSON
- `updateSchema()` rejects invalid JSON
- `findMyMethods(userId)` returns assigned + public methods with schema info

**Step 2: Run tests — expect FAIL**

**Step 3: Implement Service, Controller**

Controller:
- `POST /users/:id/methods` — `@Roles(Role.ADMIN)` assign
- `DELETE /users/:id/methods/:methodId` — `@Roles(Role.ADMIN)` unassign
- `PATCH /me/methods/:methodId/schema` — `@Roles(Role.CLIENT)` update own schema
- `GET /me/methods` — `@Roles(Role.CLIENT)` list own methods with schemas

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add method assignment and output schema config"
```

---

## Phase 4: LLM Providers & Prompt Builder

**Stories:** US-23, US-24, US-25, US-26, US-27, US-28

### Task 8: LLM provider abstraction and implementations

**Stories:** US-25, US-26, US-27, US-28
**Depends on:** Task 1 (env config for API keys)
**Blocks:** Task 9 (execution)

**Files:**
- Create: `backend/src/llm/llm.module.ts`
- Create: `backend/src/llm/llm.service.ts`
- Create: `backend/src/llm/interfaces/llm-provider.interface.ts`
- Create: `backend/src/llm/interfaces/llm-response.interface.ts`
- Create: `backend/src/llm/providers/openai.provider.ts`
- Create: `backend/src/llm/providers/anthropic.provider.ts`
- Create: `backend/src/llm/providers/google.provider.ts`
- Test: `backend/src/llm/llm.service.spec.ts`
- Test: `backend/src/llm/providers/openai.provider.spec.ts`

**Step 1: Install LLM SDKs**

```bash
cd backend
npm install openai @anthropic-ai/sdk @google/generative-ai
```

**Step 2: Write failing tests**

Test LLMService:
- `call('OPENAI', model, prompt, config)` routes to OpenAI provider
- `call('ANTHROPIC', ...)` routes to Anthropic provider
- `call('GOOGLE', ...)` routes to Google provider
- `call('UNKNOWN', ...)` throws BadRequestException
- Each provider returns standardized LLMResponse

Test OpenAI provider (mocked):
- Maps config (temperature, maxTokens) to OpenAI format
- Returns LLMResponse with token counts from API response
- Handles API error → throws with details
- Handles timeout → throws with timeout error

**Step 3: Run tests — expect FAIL**

**Step 4: Implement interfaces**

```typescript
// llm-response.interface.ts
export interface LLMResponse {
  content: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
  provider: string;
  rawResponse?: any;
}

// llm-provider.interface.ts
export interface LLMConfig {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  call(model: string, prompt: string, config?: LLMConfig): Promise<LLMResponse>;
}
```

**Step 5: Implement providers**

Each provider:
1. Initializes SDK client with API key from config
2. Maps generic config to provider-specific format
3. Makes API call
4. Maps response to standardized LLMResponse
5. Catches errors and wraps them with provider context

**Step 6: Implement LLMService**

Router/facade that holds a map of `Provider → LLMProvider` and delegates calls.

**Step 7: Run tests — expect PASS**

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add LLM provider abstraction with OpenAI, Anthropic, Google"
```

---

### Task 9: Prompt builder and input validation

**Stories:** US-23, US-24
**Depends on:** Task 6 (methods) + Task 7 (schemas)
**Blocks:** Task 11 (execution)

**Files:**
- Create: `backend/src/execution/prompt-builder.service.ts`
- Test: `backend/src/execution/prompt-builder.service.spec.ts`

**Step 1: Write failing tests**

Test PromptBuilderService:
- `build(template, textInput, outputSchema)` — combines all three parts
- `build(template, textInput, null)` — works without output schema
- `build(template, jsonInput, outputSchema)` — embeds JSON input correctly
- `validateInput('TEXT', anyString)` — passes
- `validateInput('JSON_SCHEMA', validJson)` — passes
- `validateInput('JSON_SCHEMA', invalidJson)` — throws BadRequestException

**Step 2: Run tests — expect FAIL**

**Step 3: Implement PromptBuilderService**

```typescript
build(template: string, input: string | object, outputSchema?: object): string {
  let prompt = template;

  // Add input section
  const inputStr = typeof input === 'object' ? JSON.stringify(input, null, 2) : input;
  prompt += `\n\n## Input\n${inputStr}`;

  // Add output schema if provided
  if (outputSchema) {
    prompt += `\n\n## Required Output Format\nRespond ONLY with a valid JSON object following this exact schema:\n${JSON.stringify(outputSchema, null, 2)}`;
  }

  return prompt;
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add prompt builder with input validation"
```

---

## Phase 5: Execution Engine

**Stories:** US-18, US-19, US-20, US-21, US-22, US-29, US-32, US-33

### Task 10: Seed data

**Stories:** US-46
**Depends on:** Task 5 (users) + Task 6 (methods)
**Blocks:** Manual testing of Tasks 11+

**Files:**
- Create: `backend/prisma/seed.ts`
- Modify: `backend/package.json` (add prisma seed config)

**Step 1: Write seed script**

```typescript
// Creates:
// - Admin user: admin@llmgateway.com / admin123
// - Sample client: client@example.com / client123
// - Sample method: "Data Enrichment" (TEXT, OPENAI, gpt-4o, public)
// - Sample method: "Contact Parser" (JSON_SCHEMA, ANTHROPIC, claude-sonnet-4-6, private)
// - Assignment: client → Contact Parser with sample outputSchema
```

**Step 2: Configure prisma seed in package.json**

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

**Step 3: Run seed**

```bash
npx prisma db seed
```

Expected: Admin + client + 2 methods created.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add seed script with admin, sample client, and methods"
```

---

### Task 11: Sync execution flow

**Stories:** US-18, US-29
**Depends on:** Task 7 (user-methods) + Task 8 (LLM providers) + Task 9 (prompt builder) + Task 4 (guards)
**Blocks:** Task 12 (async), Task 13 (history)

**Files:**
- Create: `backend/src/execution/execution.module.ts`
- Create: `backend/src/execution/execution.controller.ts`
- Create: `backend/src/execution/execution.service.ts`
- Create: `backend/src/execution/dto/execute.dto.ts`
- Test: `backend/src/execution/execution.service.spec.ts`

**Step 1: Write failing tests**

Test ExecutionService:
- `execute(userId, methodId, input, async=false)`:
  - Validates user has access to method (assigned or public)
  - Calls PromptBuilder with template + input + user's outputSchema
  - Calls LLMService with provider/model from method
  - Creates MethodExecution record with all metrics
  - Returns execution result
- Rejects if user has no access to method → ForbiddenException
- Rejects if method is inactive → BadRequestException
- Records latencyMs correctly
- On LLM error: creates execution with FAILED status and error details

**Step 2: Run tests — expect FAIL**

**Step 3: Implement ExecutionService**

Orchestration flow:
1. Load method + check access
2. Resolve outputSchema (UserMethod override → User default → null)
3. Validate input (PromptBuilder)
4. Build prompt (PromptBuilder)
5. Record start time
6. Call LLM (LLMService)
7. Record end time, calculate latency
8. Create MethodExecution with all data
9. Return result

**Step 4: Implement ExecutionController**

`POST /execute/:methodId` — `@Roles(Role.CLIENT)`, accepts ExecuteDto `{ input, async?: boolean }`

**Step 5: Run tests — expect PASS**

**Step 6: Test manually with seed data**

```bash
curl -X POST http://localhost:3000/execute/{methodId} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"input": "Juan Pérez, CEO Acme Corp"}'
```

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add sync execution flow with tracking"
```

---

### Task 12: Async execution with Bull queue

**Stories:** US-19, US-20
**Depends on:** Task 11 (sync execution)
**Blocks:** Nothing (but enhances execution)

**Files:**
- Modify: `backend/src/execution/execution.service.ts` (add async path)
- Create: `backend/src/execution/execution.processor.ts`
- Modify: `backend/src/execution/execution.module.ts` (register Bull)
- Test: `backend/src/execution/execution.processor.spec.ts`

**Step 1: Install Bull**

```bash
cd backend
npm install @nestjs/bull bull
npm install -D @types/bull
```

**Step 2: Write failing tests**

Test async flow:
- `execute(userId, methodId, input, async=true)` creates PENDING execution and returns executionId
- Bull processor picks up job and executes (same logic as sync)
- Processor updates execution to COMPLETED with result
- On error, processor updates execution to FAILED
- `GET /executions/:id` returns current status and result

**Step 3: Run tests — expect FAIL**

**Step 4: Implement Bull processor**

```typescript
@Processor('executions')
export class ExecutionProcessor {
  @Process()
  async handleExecution(job: Job<{ executionId: string }>) {
    // 1. Load execution record
    // 2. Update status to PROCESSING
    // 3. Run same logic as sync (prompt build → LLM call → track)
    // 4. Update execution with result (COMPLETED or FAILED)
  }
}
```

**Step 5: Update ExecutionService**

When `async=true`:
1. Create MethodExecution with status PENDING
2. Add job to Bull queue with executionId
3. Return `{ executionId, status: 'PENDING' }`

**Step 6: Add GET /executions/:id endpoint**

Returns execution status + result (if completed).

**Step 7: Run tests — expect PASS**

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add async execution with Bull queue"
```

---

### Task 13: Execution history and tracking endpoints

**Stories:** US-21, US-22, US-30, US-31
**Depends on:** Task 11 (execution creates records)
**Blocks:** Frontend tasks

**Files:**
- Create: `backend/src/tracking/tracking.module.ts`
- Create: `backend/src/tracking/tracking.controller.ts`
- Create: `backend/src/tracking/tracking.service.ts`
- Modify: `backend/src/execution/execution.controller.ts` (add GET /executions)
- Test: `backend/src/tracking/tracking.service.spec.ts`

**Step 1: Write failing tests**

Test TrackingService:
- `getUsage(userId)` returns aggregated stats for client
- `getUsage(null)` returns global stats (admin)
- `getUsage(null, { clientId, methodId, from, to })` filters correctly
- Stats include: totalRequests, totalTokensInput, totalTokensOutput, breakdown by method

Test execution history:
- `GET /executions` (client) returns own executions paginated
- `GET /executions` (admin) returns all executions with client filter

**Step 2: Run tests — expect FAIL**

**Step 3: Implement TrackingService**

Aggregates from MethodExecution table using Prisma groupBy and aggregate.

**Step 4: Implement controllers**

- `GET /executions` — paginated, role-filtered
- `GET /tracking/usage` — aggregated stats, role-filtered

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add execution history and usage tracking endpoints"
```

---

### Task 14: Audit logging

**Stories:** US-32, US-33
**Depends on:** Task 4 (auth context for userId)
**Blocks:** Frontend audit view

**Files:**
- Create: `backend/src/audit/audit.module.ts`
- Create: `backend/src/audit/audit.service.ts`
- Create: `backend/src/audit/audit.controller.ts`
- Create: `backend/src/audit/audit.interceptor.ts`
- Test: `backend/src/audit/audit.service.spec.ts`

**Step 1: Write failing tests**

Test AuditService:
- `log(userId, action, resource, resourceId, details, ip)` creates AuditLog record
- `findAll(filters)` returns paginated logs with filters (user, action, date range)

**Step 2: Run tests — expect FAIL**

**Step 3: Implement AuditService**

Simple CRUD over AuditLog table.

**Step 4: Implement AuditInterceptor**

NestJS interceptor that:
1. Runs after the handler
2. Determines action from HTTP method + route
3. Calls AuditService.log() with request context
4. Does NOT block the response (fire-and-forget)

**Step 5: Implement AuditController**

`GET /audit/logs` — `@Roles(Role.ADMIN)`, paginated with filters.

**Step 6: Register interceptor globally or per-module**

**Step 7: Run tests — expect PASS**

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add audit logging with automatic interceptor"
```

---

## Phase 6: Frontend — Shared Infrastructure

### Task 15: Frontend auth and layout

**Stories:** US-01, US-02, US-04 (frontend side)
**Depends on:** Task 3 (auth API)
**Blocks:** Tasks 16, 17

**Files:**
- Create: `frontend/src/lib/api.ts` (API client with auth headers)
- Create: `frontend/src/lib/auth.ts` (login, refresh, logout, token storage)
- Create: `frontend/src/middleware.ts` (route protection by role)
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/(client)/layout.tsx`
- Create: `frontend/src/app/(admin)/layout.tsx`
- Create: `frontend/src/components/ui/sidebar.tsx`
- Create: `frontend/src/components/ui/header.tsx`

**Step 1: Install frontend dependencies**

```bash
cd frontend
npm install axios js-cookie
```

**Step 2: Implement API client**

`lib/api.ts` — Axios instance with:
- Base URL from env
- Request interceptor: attach JWT from cookie
- Response interceptor: on 401, attempt refresh, retry original request

**Step 3: Implement auth utilities**

`lib/auth.ts` — `login(email, password)`, `refresh()`, `logout()`, `getUser()`.

**Step 4: Implement middleware**

`middleware.ts`:
- `/admin/*` → requires JWT with role=ADMIN, else redirect to /login
- `/(client)/*` → requires JWT with role=CLIENT, else redirect to /login
- `/login` → if already authenticated, redirect to dashboard

**Step 5: Implement login page**

Simple form: email + password → calls auth.login() → redirects based on role.

**Step 6: Implement layouts**

Admin layout: sidebar with admin nav (Dashboard, Methods, Clients, Executions, Audit).
Client layout: sidebar with client nav (Dashboard, Methods, Executions, Usage, Settings).

**Step 7: Verify login flow works end-to-end**

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add frontend auth, layouts, and route protection"
```

---

## Phase 7: Frontend — Admin Panel

**Stories:** US-34, US-35, US-36, US-37

### Task 16: Admin panel pages

**Stories:** US-34, US-35, US-36, US-37
**Depends on:** Task 15 (frontend auth) + Tasks 5, 6, 7, 13, 14 (API endpoints)
**Blocks:** Nothing

**Files:**
- Create: `frontend/src/app/(admin)/admin/dashboard/page.tsx`
- Create: `frontend/src/app/(admin)/admin/methods/page.tsx`
- Create: `frontend/src/app/(admin)/admin/methods/[id]/page.tsx`
- Create: `frontend/src/app/(admin)/admin/methods/[id]/test/page.tsx`
- Create: `frontend/src/app/(admin)/admin/clients/page.tsx`
- Create: `frontend/src/app/(admin)/admin/clients/[id]/page.tsx`
- Create: `frontend/src/app/(admin)/admin/executions/page.tsx`
- Create: `frontend/src/app/(admin)/admin/audit/page.tsx`

**Step 1: Admin Dashboard (US-34)**

`/admin/dashboard`:
- Cards: active clients count, executions today, total tokens today
- Recent activity list (last 10 audit logs)
- Fetches from: `GET /tracking/usage` + `GET /audit/logs?limit=10`

**Step 2: Method Management (US-35)**

`/admin/methods`:
- Table: name, provider, model, inputType, isPublic, isActive
- Create button → modal/form with all fields including textarea for promptTemplate
- Row click → edit page

`/admin/methods/[id]`:
- Edit form: all method fields
- JSON editor for config
- Save button

**Step 3: Admin Playground (US-36)**

`/admin/methods/[id]/test`:
- Input area (text or JSON depending on inputType)
- Optional: override output schema for testing
- Execute button → calls `POST /execute/:methodId`
- Shows: assembled prompt (visible to admin), raw response, formatted output, token usage, latency

**Step 4: Client Management (US-37)**

`/admin/clients`:
- Table: email, isActive, methods count, total executions, total tokens
- Create button → form (email, password)
- Row click → detail

`/admin/clients/[id]`:
- Client info (editable)
- Assigned methods list with assign/unassign buttons
- Usage summary
- Recent executions

**Step 5: Admin Executions**

`/admin/executions`:
- Table: date, client, method, status, tokens, latency
- Filters: client, method, status, date range

**Step 6: Audit Logs**

`/admin/audit`:
- Table: date, user, action, resource, IP
- Filters: user, action, date range

**Step 7: Verify all pages work with seed data**

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add admin panel UI (dashboard, methods, clients, audit)"
```

---

## Phase 8: Frontend — Client Portal

**Stories:** US-38, US-39, US-40, US-41, US-42

### Task 17: Client portal pages

**Stories:** US-38, US-39, US-40, US-41, US-42
**Depends on:** Task 15 (frontend auth) + Tasks 7, 11, 13 (API endpoints)
**Blocks:** Nothing

**Files:**
- Create: `frontend/src/app/(client)/dashboard/page.tsx`
- Create: `frontend/src/app/(client)/methods/page.tsx`
- Create: `frontend/src/app/(client)/methods/[id]/page.tsx`
- Create: `frontend/src/app/(client)/methods/[id]/playground/page.tsx`
- Create: `frontend/src/app/(client)/executions/page.tsx`
- Create: `frontend/src/app/(client)/executions/[id]/page.tsx`
- Create: `frontend/src/app/(client)/usage/page.tsx`
- Create: `frontend/src/app/(client)/settings/page.tsx`

**Step 1: Client Dashboard (US-38)**

`/dashboard`:
- Cards: available methods, executions this month, tokens this month
- Recent executions list (last 5)
- Fetches from: `GET /me/methods` + `GET /tracking/usage` + `GET /executions?limit=5`

**Step 2: Methods List and Schema Config (US-39)**

`/methods`:
- Cards/table: method name, description, inputType, my schema status
- Click → detail page

`/methods/[id]`:
- Method info (name, description, inputType — NO template)
- JSON editor for outputSchema
- Save schema button → `PATCH /me/methods/:methodId/schema`
- Link to playground

**Step 3: Client Playground (US-40)**

`/methods/[id]/playground`:
- Input area (text or JSON editor depending on inputType)
- Async toggle
- Execute button
- Result display: formatted output, tokens used, latency
- If async: shows status with polling until complete

**Step 4: Execution History (US-41)**

`/executions`:
- Table: date, method, status, tokens, latency
- Click → detail

`/executions/[id]`:
- Input sent, output received, status, metrics
- If PENDING/PROCESSING: auto-refresh

**Step 5: Usage Stats (US-42)**

`/usage`:
- Total requests and tokens for current period
- Breakdown by method (table)
- Simple chart (tokens over time) — can use a lightweight chart lib

**Step 6: Settings**

`/settings`:
- Change password form

**Step 7: Verify all pages work with seed data and client login**

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add client portal UI (dashboard, methods, playground, usage)"
```

---

## Task Dependency Summary

```
Task 1  (Scaffolding)
  └► Task 2  (Prisma Schema)
       ├► Task 3  (Auth JWT) ─────────────► Task 4  (RBAC Guards)
       │                                       ├► Task 5  (Users CRUD)
       │                                       ├► Task 6  (Methods CRUD)
       │                                       │    ├► Task 7  (User-Methods) ◄── Task 5
       │                                       │    │    └► Task 9  (Prompt Builder)
       │                                       │    └► Task 8  (LLM Providers)
       │                                       │
       │                                       └► Task 14 (Audit Logging)
       │
       └► Task 10 (Seed Data) ◄── Task 5 + Task 6

Task 11 (Sync Execution) ◄── Task 4 + Task 7 + Task 8 + Task 9
  ├► Task 12 (Async Execution)
  └► Task 13 (History & Tracking)

Task 15 (Frontend Auth) ◄── Task 3
  ├► Task 16 (Admin Panel) ◄── Tasks 5,6,7,13,14
  └► Task 17 (Client Portal) ◄── Tasks 7,11,13
```

## Parallelization Opportunities

These task groups can be developed in parallel by separate agents:

- **Group A:** Tasks 5 + 6 (Users + Methods CRUD) — after Task 4
- **Group B:** Task 8 (LLM Providers) — after Task 1 (only needs env config)
- **Group C:** Task 14 (Audit) — after Task 4
- **Group D:** Tasks 16 + 17 (Frontend) — can be parallelized after Task 15
