import { useState } from "react";
import { Link } from "react-router";
import { Bell } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/notifications";
import { fetchNotifications, notificationsKey } from "~/lib/queries";
import { isSolver, useSession } from "~/lib/session";
import { AsyncBoundary } from "~/components/async-boundary";
import { Gate } from "~/components/primitives";
import { PanelSkeleton } from "~/components/skeleton";
import { NotificationFilters } from "~/features/notifications/notification-filters";
import { NotificationList } from "~/features/notifications/notification-list";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Notifications — Achieve Doubts" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  // The same filter object the list builds on first render.
  preload(notificationsKey({ type: undefined, read: "all" }), () =>
    fetchNotifications({ read: "all" }),
  );
  return null;
}

export default function NotificationsPage() {
  const { user, isPending } = useSession();
  const [type, setType] = useState("");
  const [read, setRead] = useState("all");

  if (isPending) return null;

  if (!user) {
    return (
      <main id="main" className="page">
        <div className="wrap">
          <Gate icon={<Bell size={24} />} title="Notifications" text="Log in to see your notifications.">
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

  const isStudent = !isSolver(user.role);

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

        <NotificationFilters
          isStudent={isStudent}
          type={type}
          read={read}
          onType={setType}
          onRead={setRead}
        />

        <p className="muted" style={{ fontSize: 14, margin: "4px 0 14px" }}>
          Tap a notification to open its question. Opening it marks the
          notification as read.
        </p>

        <AsyncBoundary fallback={<PanelSkeleton lines={5} />} errorText="Couldn't load notifications.">
          <NotificationList type={type} read={read} />
        </AsyncBoundary>
      </div>
    </main>
  );
}
