import { useState } from "react";
import { Link, useNavigate } from "react-router";
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
import useSWR, { preload } from "swr";

import type { Route } from "./+types/notifications";
import { fetchNotifications, notificationsKey } from "~/lib/queries";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "~/lib/mutations";
import { ago } from "~/lib/format";
import { isSolver, useSession } from "~/lib/session";
import { Gate } from "~/components/primitives";

const ICONS: Record<string, typeof Lock> = {
  assigned: Lock,
  released: Unlock,
  solved: CheckCircle2,
  comment: MessageSquare,
  followup: CornerDownRight,
  override: ShieldCheck,
};

const TYPE_LABEL: Record<string, string> = {
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

export function meta(_: Route.MetaArgs) {
  return [{ title: "Notifications — Achieve Doubts" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  preload(notificationsKey({ read: "all" }), () =>
    fetchNotifications({ read: "all" }),
  );
  return null;
}

export default function NotificationsPage() {
  const { user, isPending } = useSession();

  if (isPending) return null;

  if (!user) {
    return (
      <main id="main" className="page">
        <div className="wrap">
          <Gate
            icon={<Bell size={24} />}
            title="Notifications"
            text="Log in to see your notifications."
          >
            <Link className="btn btn-primary" to="/login">
              Student login
            </Link>
            <Link className="btn btn-ghost" to="/login/solver">
              Solver login
            </Link>
          </Gate>
        </div>
      </main>
    );
  }

  return <NotificationList isStudent={!isSolver(user.role)} />;
}

function NotificationList({ isStudent }: { isStudent: boolean }) {
  const [type, setType] = useState("");
  const [read, setRead] = useState("all");
  const navigate = useNavigate();

  const filters = { type: type || undefined, read };
  const { data } = useSWR(notificationsKey(filters), () =>
    fetchNotifications(filters),
  );

  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const types = isStudent
    ? ["assigned", "released", "solved", "comment"]
    : ["comment", "followup", "override"];

  const items = data?.items ?? [];

  return (
    <main id="main" className="page">
      <div className="wrap" style={{ maxWidth: 900 }}>
        <div className="ph">
          <h1>Notifications</h1>
          <p>
            {isStudent
              ? "Updates on your questions: when a solver locks or unlocks one, when it's answered, and new comments."
              : "Comments and follow-ups on questions you've answered."}
          </p>
        </div>

        <div className="nbar">
          <div className="grp">
            <div className="chips" role="group" aria-label="Type">
              <button
                type="button"
                className="chip"
                aria-pressed={!type}
                onClick={() => setType("")}
              >
                All types
              </button>
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="grp">
            <div className="seg" role="group" aria-label="Read state">
              {[
                ["all", "All"],
                ["unread", "Unread"],
                ["read", "Read"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={read === value}
                  onClick={() => setRead(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => markAll.trigger()}
              disabled={markAll.isMutating}
            >
              Mark all read
            </button>
          </div>
        </div>

        <p className="muted" style={{ fontSize: 14, margin: "4px 0 14px" }}>
          Tap a notification to open its question. Opening it marks the
          notification as read.
        </p>

        {items.length ? (
          <ul className="nlist">
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id} className={n.readAt ? "" : "unread"}>
                  <button
                    type="button"
                    className="n-main"
                    onClick={async () => {
                      if (!n.readAt) await markRead.trigger({ id: n.id });
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
                        {TYPE_LABEL[n.type] ?? n.type}, {ago(n.createdAt)}
                        <span className="sr">
                          , {n.readAt ? "Read" : "Unread"}
                        </span>
                      </span>
                    </span>
                    <ChevronRight
                      size={18}
                      aria-hidden="true"
                      className="n-chev"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">
            <p style={{ margin: 0 }}>No notifications match this filter.</p>
          </div>
        )}
      </div>
    </main>
  );
}
