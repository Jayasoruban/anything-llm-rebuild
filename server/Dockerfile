# node:20-slim is Debian-based (glibc) — NOT Alpine (musl).
# LanceDB's musl binary requires AVX-512 CPU instructions which most cloud VMs
# (including Railway) don't support. The glibc Debian binary has no such requirement.
FROM node:20-slim

# Build tools for native modules (bcrypt, LanceDB)
# python3 + make + g++ → compile native addons if no pre-built binary exists
# openssl → required by Prisma on Debian slim
RUN apt-get update && apt-get install -y python3 make g++ openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests first so Docker can cache this layer.
# Only re-runs yarn install when package.json / yarn.lock changes.
COPY package.json yarn.lock ./
COPY server/package.json ./server/

# Install only server dependencies (monorepo workspace install)
RUN yarn workspace anything-llm-server install --frozen-lockfile

# Copy all server source files
COPY server/ ./server/

WORKDIR /app/server

# Generate Prisma client at BUILD time — baked into the image.
# Running this at startup would add ~10s cold start delay on every restart.
RUN npx prisma generate

EXPOSE 3001

# Startup sequence (runs every container start):
#   1. mkdir -p storage/uploads  — ensures the uploads dir exists on the mounted volume
#   2. prisma migrate deploy     — applies any pending migrations (idempotent, safe to repeat)
#   3. node index.js             — start the Express server
CMD ["sh", "-c", "mkdir -p storage/uploads && npx prisma migrate deploy && node index.js"]
