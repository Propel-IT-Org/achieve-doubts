import { env } from "../env";

/**
 * Client IP for rate limiting and the Achieve SSO allowlist.
 *
 * Where the real address lives depends on what sits in front of the app,
 * selected by CLIENT_IP_SOURCE:
 *
 * "proxy" (default) — DNS points straight at the VPS and Traefik is the only
 *   hop. Traefik DELETES any X-Forwarded-For arriving from an untrusted peer
 *   and replaces it with the peer's own address, so the header reaching us is
 *   the address Traefik actually saw. We still read the rightmost entry as
 *   defence in depth: a proxy only ever appends.
 *
 * "cloudflare" — traffic arrives through Cloudflare (a Tunnel, or proxied
 *   DNS). Here Traefik's peer is `cloudflared` or a Cloudflare edge node, so
 *   X-Forwarded-For would put every user in one bucket — and the Achieve
 *   allowlist would reject Achieve itself. Cloudflare's edge overwrites
 *   CF-Connecting-IP with the true client address, so that is the source.
 *
 *   ONLY SAFE when the origin is reachable exclusively through Cloudflare: a
 *   Tunnel with no published ports, or a firewall that admits only
 *   Cloudflare's IP ranges. Otherwise anyone can reach the VPS directly and
 *   forge CF-Connecting-IP — including an allowlisted Achieve address.
 */
export function clientIpFromHeaders(headers: Headers): string {
  if (env.CLIENT_IP_SOURCE === "cloudflare") {
    const viaCloudflare = headers.get("cf-connecting-ip")?.trim();
    if (viaCloudflare) return viaCloudflare;
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const nearest = hops[hops.length - 1];
    if (nearest) return nearest;
  }

  // Deliberately NOT falling back to CF-Connecting-IP in proxy mode: without
  // Cloudflare in front, that header is just caller-supplied text.
  return headers.get("x-real-ip") ?? "unknown";
}
