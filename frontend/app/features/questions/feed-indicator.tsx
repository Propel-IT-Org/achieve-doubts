import { useState } from "react";
import { useFeedEvent, useFeedStatus } from "~/lib/realtime";

/**
 * Says whether the list is live, and announces arrivals to screen readers —
 * the list itself updates silently, so without this a new question would
 * appear with no cue at all.
 */
export function FeedIndicator() {
  const status = useFeedStatus();
  const [announcement, setAnnouncement] = useState("");

  useFeedEvent(({ event }) => {
    if (event === "QUESTION_CREATED") setAnnouncement("A new question just came in.");
  });

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {status !== "off" && (
        <span className="online" style={{ margin: 0 }}>
          <i aria-hidden="true" />
          {status === "live" ? "Live — new questions appear here" : "Reconnecting…"}
        </span>
      )}
      <span className="sr" aria-live="polite">
        {announcement}
      </span>
    </span>
  );
}
