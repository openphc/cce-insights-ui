import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // The app is served under a base path (e.g. /insights) by the ingress. Emitting built assets
  // under that same prefix (/insights/assets/...) means the single /insights ingress rule covers
  // them too — no separate /assets rule is needed. Uses the same VITE_ROUTER_BASE as the SPA
  // router and defaults to '/' for local dev.
  const routerBase = env.VITE_ROUTER_BASE || '/';
  const base = routerBase === '/' ? '/' : `/${routerBase.replace(/^\/+|\/+$/g, '')}/`;

  return {
    base,
    plugins: [react(), tailwindcss()],
    server: {
      port: 3001,
      proxy: {
        '/v1/insights': {
          target: 'http://localhost:8084',
          changeOrigin: true,
        },
      },
    },
  };
});
