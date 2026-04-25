FROM node:20-alpine

# Build tools required for native modules:
#   LanceDB  — compiled from Rust/C++ bindings
#   bcrypt   — compiled from C++
#   openssl  — needed by Prisma on Alpine
RUN apk add --no-cache python3 make g++ openssl

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
