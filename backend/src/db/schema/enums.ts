import { pgEnum } from "drizzle-orm/pg-core";

export const questionStatusEnum = pgEnum("question_status", [
	"waiting",
	"assigned",
	"answered",
	"satisfied",
	"unsatisfied",
]);

export const reportReasonEnum = pgEnum("report_reason", [
	"wrong",
	"incomplete",
	"behaviour",
	"other",
]);

export const reportStatusEnum = pgEnum("report_status", ["open", "resolved"]);

export const notifTypeEnum = pgEnum("notif_type", [
	"assigned",
	"released",
	"solved",
	"comment",
	"followup",
	"override",
]);

export const threadAuthorEnum = pgEnum("thread_author", ["asker", "solver"]);

export const lockActionEnum = pgEnum("lock_action", [
	"lock",
	"unlock",
	"override",
	"expire",
]);

export const payoutStatusEnum = pgEnum("payout_status", ["draft", "paid"]);
