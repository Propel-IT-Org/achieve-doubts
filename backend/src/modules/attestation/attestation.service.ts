import { sign, verify } from "hono/jwt";
import { env } from "../../env";

export class AttestationService {
	async generateToken(expiresInSeconds = 3600) {
		return sign(
			{
				iss: "doubt-app-attestation",
				exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
			},
			env.ATTESTATION_SECRET,
		);
	}

	async verifyToken(token: string) {
		try {
			const payload = await verify(token, env.ATTESTATION_SECRET, "HS256");
			return Boolean(payload && payload.iss === "doubt-app-attestation");
		} catch {
			return false;
		}
	}
}