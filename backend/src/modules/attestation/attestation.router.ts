import { Hono } from "hono";
import { sign } from "hono/jwt";
import { env } from "../../env";

export const attestationRouter = new Hono().post("/exchange", async (c) => {
	const token = await sign(
		{
			iss: "doubt-app-attestation",
			exp: Math.floor(Date.now() / 1000) + 60 * 60,
		},
		env.ATTESTATION_SECRET,
	);

	return c.json({ token });
});
