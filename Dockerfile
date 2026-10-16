# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies (layer cache)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .

# Build-time config (Vite inlines VITE_* into the bundle). Pass per-environment via
# --build-arg. Example for RW UAT:
#   --build-arg VITE_AUTH_ENABLED=true \
#   --build-arg VITE_KEYCLOAK_URL=https://cceuat.moh.gov.rw/auth \
#   --build-arg VITE_KEYCLOAK_REALM=cce \
#   --build-arg VITE_KEYCLOAK_CLIENT_ID=cce-insights-ui
ARG VITE_API_BASE_URL=""
ARG VITE_AUTH_ENABLED="false"
ARG VITE_KEYCLOAK_URL=""
ARG VITE_KEYCLOAK_REALM="cce"
ARG VITE_KEYCLOAK_CLIENT_ID="cce-insights-ui"
# The image is served under /insights by the ingress, so the SPA router base path is /insights.
ARG VITE_ROUTER_BASE="/insights"
ARG VITE_TIMEZONE="UTC"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_AUTH_ENABLED=$VITE_AUTH_ENABLED \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID \
    VITE_ROUTER_BASE=$VITE_ROUTER_BASE \
    VITE_TIMEZONE=$VITE_TIMEZONE

RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM caddy:2-alpine

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Entrypoint: generates /srv/env-config.js from runtime container env vars before starting
# Caddy, so a deployment can override the baked VITE_* values without a rebuild.
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Copy built assets from Stage 1
COPY --from=build /app/dist /srv

EXPOSE 3001

CMD ["/entrypoint.sh"]
