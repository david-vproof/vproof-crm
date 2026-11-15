# syntax=docker/dockerfile:1

# --- Dependències -----------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
# better-sqlite3 és un mòdul natiu: si npm el compila, cal Python i un compilador.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# --- Compilació -------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Execució ---------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    SQLITE_RUTA=/app/dades/vproof-crm.sqlite

# Usuari sense privilegis. La base de dades i els fitxers pujats viuen a
# /app/dades, que ha de ser un volum: si no, es perden en refer el contenidor.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app/dades && chown nextjs:nodejs /app/dades

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
VOLUME ["/app/dades"]
EXPOSE 3000
CMD ["node", "server.js"]
