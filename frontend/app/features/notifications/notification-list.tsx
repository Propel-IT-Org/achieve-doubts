import { useNavigate } from "react-router";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  CornerDownRight,
  Lock,
  MessageSquare,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { ago } from "~/lib/format";
import { useMarkNotificationRead } from "~/lib/mutations";
import { type NotificationRow, useNotifications } from "~/lib/queries";

const ICONS: Record<string, typeof Lock> = {
  assigned: Lock,
  released: Unlock,
  solved: CheckCircle2,
  comment: MessageSquare,
  followup: CornerDownRight,
  override: ShieldCheck,
};

export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  assigned: "Solver assigned",
  released: "Unlocked",
  solved: "Answered",
  comment: "Comments",
  followup: "Follow-ups",
  override: "Lock taken over",
};

const TEXT: Record<string, string> = {
  assigned: "A solver locked your question and will answer it.",
  released: "Your question was unlocked. It's open to every solver again.",
  solved: "Your question was answered. Rate the answer once you've read it.",
  comment: "There's a new comment on a question you're following.",
  followup: "A follow-up question is waiting for your reply.",
  override: "An admin solver took over your lock.",
};

export function NotificationList({ type, read }: { type: string; read: string }) {
  const items = useNotifications({ type: type || undefined, read });

  if (!items.length) {
    return (
      <div className="empty">
        <p style={{ margin: 0 }}>No notifications match this filter.</p>
      </div>
    );
  }

  return (
    <ul className="nlist">
      {items.map((n) => (
        <NotificationItem key={n.id} notification={n} />
      ))}
    </ul>
  );
}

function NotificationItem({ notification: n }: { notification: NotificationRow }) {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const Icon = ICONS[n.type] ?? Bell;

  return (
    <li className={n.readAt ? "" : "unread"}>
      <button
        type="button"
        className="n-main"
        onClick={async () => {
          // Opening the question matters more than the read flag.
          if (!n.readAt) void markRead.trigger({ id: n.id }).catch(() => {});
          if (n.questionId) navigate(`/questions/${n.questionId}`);
        }}
      >
        <span className="n-dot" aria-hidden="true" />
        <span className="n-ic" aria-hidden="true">
          <Icon size={18} />
        </span>
        <span className="n-body">
          <span className="n-text">{TEXT[n.type] ?? "Update"}</span>
          <span className="n-sub">
            {NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}, {ago(n.createdAt)}
            <span className="sr">, {n.readAt ? "Read" : "Unread"}</span>
          </span>
        </span>
        <ChevronRight size={18} aria-hidden="true" className="n-chev" />
      </button>
    </li>
  );
}
