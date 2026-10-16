// Placeholder for `npm run dev` / local builds — overwritten at container start by
// docker/entrypoint.sh. Empty values fall through to the build-time VITE_* env (.env /
// .env.local), see src/env.ts.
window._env_ = {
  VITE_API_BASE_URL: '',
  VITE_AUTH_ENABLED: '',
  VITE_KEYCLOAK_URL: '',
  VITE_KEYCLOAK_REALM: '',
  VITE_KEYCLOAK_CLIENT_ID: '',
  VITE_POLLING_INTERVAL: '',
  VITE_DEFAULT_DATE_RANGE_DAYS: '',
  VITE_TIMEZONE: '',
};
