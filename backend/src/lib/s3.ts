import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";

const hasS3Config = Boolean(
	env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
);

export const s3Client = hasS3Config
	? new S3Client({
			region: "auto",
			endpoint: env.S3_ENDPOINT,
			credentials: {
				accessKeyId: env.S3_ACCESS_KEY_ID!,
				secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
			},
		})
	: null;

export async function createPresignedUploadUrl(
	key: string,
	contentType: string,
	expiresInSeconds = 300,
) {
	if (!s3Client) {
		const publicUrl = `${env.S3_PUBLIC_URL}/${key}`;
		return {
			uploadUrl: `${env.BETTER_AUTH_URL}/api/upload/mock?key=${encodeURIComponent(key)}`,
			publicUrl,
			key,
		};
	}

	const command = new PutObjectCommand({
		Bucket: env.S3_BUCKET_NAME,
		Key: key,
		ContentType: contentType,
	});

	const uploadUrl = await getSignedUrl(s3Client, command, {
		expiresIn: expiresInSeconds,
	});
	const publicUrl = `${env.S3_PUBLIC_URL}/${key}`;

	return {
		uploadUrl,
		publicUrl,
		key,
	};
}
