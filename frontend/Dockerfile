# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests for layer caching
COPY package.json yarn.lock ./
COPY frontend/package.json ./frontend/

RUN yarn workspace anything-llm-frontend install --frozen-lockfile

COPY frontend/ ./frontend/

WORKDIR /app/frontend

# Build the React app into /app/frontend/dist
RUN yarn build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

# envsubst is already included in nginx:alpine (via gettext package)
# We use it to inject BACKEND_URL into the nginx config at startup.

# Remove the default nginx site config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config TEMPLATE (contains ${BACKEND_URL} placeholder)
COPY frontend/nginx.conf /etc/nginx/conf.d/app.conf.template

# Copy the entrypoint script that substitutes ${BACKEND_URL} and starts nginx
COPY frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy the built React app from stage 1
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
