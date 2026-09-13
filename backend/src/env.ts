import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	PORT: z.coerce.number().default(3000),
	DATABASE_URL: z
		.string()
		.default("postgres://postgres:postgres@localhost:5432/achieve_doubts"),
	BETTER_AUTH_SECRET: z.string().default("development_secret_must_be_32_characters_long_min"),
	BETTER_AUTH_URL: z.string().default("http://localhost:3000"),
	CORS_ORIGIN: z.string().default("http://localhost:5173"),
	ATTESTATION_SECRET: z.string().default("dev_attestation_secret_placeholder"),
	S3_ENDPOINT: z.string().optional(),
	S3_ACCESS_KEY_ID: z.string().optional(),
	S3_SECRET_ACCESS_KEY: z.string().optional(),
	S3_BUCKET_NAME: z.string().default("doubts-media"),
	S3_PUBLIC_URL: z.string().default("http://localhost:3000/uploads"),
});

export const env = envSchema.parse(process.env);
