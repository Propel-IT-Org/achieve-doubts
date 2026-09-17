import { useMarkAllNotificationsRead } from "~/lib/mutations";
import { NOTIFICATION_TYPE_LABEL } from "./notification-list";

const STUDENT_TYPES = ["assigned", "released", "solved", "comment"];
const SOLVER_TYPES = ["comment", "followup", "override"];

const READ_STATES = [
  ["all", "All"],
  ["unread", "Unread"],
  ["read", "Read"],
] as const;

export function NotificationFilters({
  isStudent,
  type,
  read,
  onType,
  onRead,
}: {
  isStudent: boolean;
  type: string;
  read: string;
  onType: (type: string) => void;
  onRead: (read: string) => void;
}) {
  const markAll = useMarkAllNotificationsRead();
  const types = isStudent ? STUDENT_TYPES : SOLVER_TYPES;

  return (
    <div className="nbar">
      <div className="grp">
        <div className="chips" role="group" aria-label="Type">
          <button type="button" className="chip" aria-pressed={!type} onClick={() => onType("")}>
            All types
          </button>
          {types.map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={type === t}
              onClick={() => onType(t)}
            >
              {NOTIFICATION_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="grp">
        <div className="seg" role="group" aria-label="Read state">
          {READ_STATES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={read === value}
              onClick={() => onRead(value)}
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
  );
}
