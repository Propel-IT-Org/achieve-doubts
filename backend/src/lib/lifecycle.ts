/**
 * Process lifecycle state shared between the HTTP layer and the entrypoint.
 *
 * While draining, /api/healthz answers 503. Traefik's health check and the
 * container health check then take this replica out of rotation, and only
 * after that does src/main.ts stop accepting connections — which is what
 * keeps a rolling update from dropping requests.
 */

let draining = false;

export function isDraining(): boolean {
  return draining;
}

export function markDraining(): void {
  draining = true;
}
