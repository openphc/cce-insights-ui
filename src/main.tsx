import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilterProvider } from './context/FilterContext';
import { App } from './App';
import { initAuth } from './auth/keycloak';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <FilterProvider>
            <App />
          </FilterProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

// Complete the Keycloak login (when enabled) before rendering so the first API calls carry a
// valid token. With onLoad:'login-required', unauthenticated users are redirected to Keycloak
// and only return here once authenticated.
initAuth()
  .then(render)
  .catch((err) => {
    console.error('Auth initialisation failed', err);
    render();
  });
