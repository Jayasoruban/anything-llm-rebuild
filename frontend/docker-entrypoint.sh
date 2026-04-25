#!/bin/sh
# ============================================================================
#  docker-entrypoint.sh — Frontend container startup script
# ============================================================================
#  Substitutes ${BACKEND_URL} in the nginx config template, then starts nginx.
#
#  Why envsubst instead of a static config?
#  -----------------------------------------
#  The nginx proxy_pass target differs per environment:
#    Local Docker Compose:  http://server:3001       (service name = "server")
#    Railway:               http://server.railway.internal:3001
#
#  Using envsubst '${BACKEND_URL}' (note: single quotes pass this literally
#  to envsubst) means ONLY ${BACKEND_URL} is substituted. Nginx variables
#  like $host, $remote_addr, $uri are left intact.
# ============================================================================

set -e

BACKEND_URL=${BACKEND_URL:-http://server:3001}

echo "[entrypoint] BACKEND_URL = ${BACKEND_URL}"

# Substitute BACKEND_URL into the template → write the real nginx config
envsubst '${BACKEND_URL}' \
  < /etc/nginx/conf.d/app.conf.template \
  > /etc/nginx/conf.d/app.conf

echo "[entrypoint] nginx config written, starting nginx..."

exec nginx -g "daemon off;"
