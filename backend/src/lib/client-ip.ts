/**
 * Client IP extraction for requests arriving through a reverse proxy.
 *
 * `X-Forwarded-For` is a client-*appendable* list. A proxy appends the peer
 * address it actually observed, so behind one proxy the header reads
 * `<whatever the caller sent>, <real client>`. Reading the FIRST entry
 * therefore reads attacker-controlled input: a caller can send their own
 * `X-Forwarded-For` and choose what the server believes their address is.
 *
 * That matters here twice over — the value keys the rate limiter, and it
 * gates the Achieve SSO IP allowlist. Taking the last entry instead yields
 * the address our own proxy saw, which a client cannot forge.
 *
 * ASSUMPTION: exactly one trusted proxy (Traefik) in front of the app. Put
 * another hop in front — Cloudflare, a load balancer — and the trustworthy
 * entry moves left by one per hop, so this needs revisiting alongside that
 * change. `TRUSTED_PROXY_HOPS` exists to make that adjustment explicit.
 */

const TRUSTED_PROXY_HOPS = 1;

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");

  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    // Count back from the right: the rightmost entry was written by the proxy
    // closest to us, and is the only one we can vouch for.
    const trusted = hops[hops.length - TRUSTED_PROXY_HOPS];
    if (trusted) return trusted;
  }

  // Set by the edge itself rather than forwarded through, so these are only
  // as trustworthy as the proxy that set them.
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? "unknown";
}
