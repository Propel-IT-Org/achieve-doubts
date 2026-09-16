import { env } from "../env";

interface MailMessage {
	to: string;
	subject: string;
	text: string;
}

/**
 * No email provider is configured anywhere in this project (no SMTP/Resend
 * credentials, no package). Rather than silently no-op — which is exactly
 * how the previous auth config left verification/reset email non-functional
 * — this logs the message (and crucially the link inside it) to the server
 * console, so the flow is actually usable in development: a developer can
 * copy the link straight out of the logs.
 *
 * Swap this implementation for a real provider (Resend, SES, SMTP, ...)
 * before relying on it in production; every call site goes through this one
 * function, so that's a one-file change.
 */
export async function sendMail({ to, subject, text }: MailMessage): Promise<void> {
	if (env.NODE_ENV === "production") {
		console.error(
			`[mailer] No email provider configured — dropping "${subject}" to ${to}. ` +
				"Wire a real provider in src/lib/mailer.ts before shipping this to real users.",
		);
		return;
	}
	console.log(`[mailer:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
}
