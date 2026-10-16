import Keycloak from 'keycloak-js';
import { getEnv } from '../env';

/**
 * Keycloak OIDC integration for the Insights UI.
 *
 * The dashboard's API calls go through the API gateway (`/v1/insights/**`), which requires a
 * valid Bearer token (issuer = the public Keycloak, audience = gateway-service, role
 * INSIGHTS_READ / COMPLIANCE_READ). This module performs the Authorization-Code + PKCE login
 * and exposes the live access token to the API client.
 *
 * Config is read via getEnv (Docker runtime window._env_ → Vite env). When VITE_AUTH_ENABLED
 * !== 'true' the app runs unauthenticated (local dev with the Vite proxy / direct insights-service).
 */
export const authEnabled = getEnv('VITE_AUTH_ENABLED') === 'true';

let keycloak: Keycloak | undefined;

export async function initAuth(): Promise<void> {
  if (!authEnabled) return;

  // When VITE_KEYCLOAK_URL is unset, assume Keycloak is served on the same domain as the UI
  // (e.g. https://cce.example.org/auth).
  const keycloakUrl = getEnv('VITE_KEYCLOAK_URL') || `${window.location.origin}/auth`;

  keycloak = new Keycloak({
    url: keycloakUrl,
    realm: getEnv('VITE_KEYCLOAK_REALM', 'cce'),
    clientId: getEnv('VITE_KEYCLOAK_CLIENT_ID', 'cce-insights-ui'),
  });

  await keycloak.init({
    onLoad: 'login-required', // redirect unauthenticated users to the Keycloak login
    pkceMethod: 'S256',
    checkLoginIframe: false,
    // Return to wherever the user was after login.
    redirectUri: window.location.href,
  });

  // Proactively refresh the access token before it expires; fall back to a fresh login.
  setInterval(() => {
    keycloak?.updateToken(70).catch(() => keycloak?.login());
  }, 60_000);
}

/** Current access token (undefined when auth is disabled or not yet initialised). */
export function getToken(): string | undefined {
  return keycloak?.token;
}

export function getUsername(): string | undefined {
  return keycloak?.tokenParsed?.preferred_username as string | undefined;
}

export function logout(): void {
  // Back to the app root, under the router base when served behind an ingress (e.g. /insights).
  keycloak?.logout({ redirectUri: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') });
}
