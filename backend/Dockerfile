FROM node:20-alpine AS base
WORKDIR /app

# ── Instalar dependencias ──────────────────────────────────────
# Se copia solo package*.json primero para aprovechar el cache de
# Docker: si no cambiaron las deps, esta capa no se re-ejecuta.
FROM base AS deps
COPY package*.json ./
# --legacy-peer-deps: tolera conflictos menores de peer deps sin
# romper el build. NestJS v11 tiene algunas libs que todavía no
# actualizaron sus peer deps declarations.
# npm install en lugar de npm ci porque el package-lock puede estar
# desincronizado tras cambiar versiones de deps manualmente.
# En CI/CD con lockfile actualizado podés volver a npm ci.
RUN npm install --legacy-peer-deps

# ── Build ──────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
# Genera el cliente Prisma ANTES del build de TypeScript,
# porque el código importa desde src/generated/prisma
RUN npx prisma generate
RUN npm run build

# ── Imagen final (producción) ──────────────────────────────────
# Solo contiene lo necesario para correr, sin devDependencies
FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY package*.json ./
COPY prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main"]
