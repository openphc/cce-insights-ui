#!/bin/sh
# Generate /srv/env-config.js at container start from the container's VITE_* env vars
# (docker-compose `environment:` / k8s `env:`), so one image can be configured per deployment
# without a rebuild. Unset vars are written as "" and the app then falls back to the value
# baked in at build time (see src/env.ts) — so never add a non-empty default here, or it
# would silently override the baked value.
cat > /srv/env-config.js << EOF
window._env_ = {
  "VITE_API_BASE_URL": "${VITE_API_BASE_URL:-}",
  "VITE_AUTH_ENABLED": "${VITE_AUTH_ENABLED:-}",
  "VITE_KEYCLOAK_URL": "${VITE_KEYCLOAK_URL:-}",
  "VITE_KEYCLOAK_REALM": "${VITE_KEYCLOAK_REALM:-}",
  "VITE_KEYCLOAK_CLIENT_ID": "${VITE_KEYCLOAK_CLIENT_ID:-}",
  "VITE_POLLING_INTERVAL": "${VITE_POLLING_INTERVAL:-}",
  "VITE_DEFAULT_DATE_RANGE_DAYS": "${VITE_DEFAULT_DATE_RANGE_DAYS:-}",
  "VITE_TIMEZONE": "${VITE_TIMEZONE:-}"
};
EOF
exec caddy run --config /etc/caddy/Caddyfile
