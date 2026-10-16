declare global {
  interface Window {
    _env_?: Record<string, string>;
  }
}

// Build once, configure at deploy time. Priority:
//   1. Runtime: window._env_, written at container start by docker/entrypoint.sh from the
//      container's VITE_* env vars (docker-compose `environment:` / k8s `env:`).
//   2. Build time: VITE_* baked in by Vite (.env locally, --build-arg in CI).
//   3. The caller's fallback.
// Empty strings count as unset at both levels, so an unset runtime var never overrides a
// baked value.
export function getEnv(key: string, fallback = ''): string {
  const runtime = window._env_?.[key];
  if (runtime !== undefined && runtime !== '') return runtime;
  const buildTime = import.meta.env[key] as string | undefined;
  if (buildTime !== undefined && buildTime !== '') return buildTime;
  return fallback;
}
