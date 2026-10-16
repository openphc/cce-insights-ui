# ── Stage 1: Build ──────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app

# Install dependencies (layer cache)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM caddy:2-alpine

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Entrypoint: generates /srv/env-config.js from runtime Docker env vars before
# starting Caddy, so the React app picks up Keycloak config without a rebuild.
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Copy built assets from Stage 1
COPY --from=build /app/dist /srv

EXPOSE 3001

CMD ["/entrypoint.sh"]
