import type { CSSProperties } from "react";

/** A shimmering placeholder block; `.skel` lives in app.css. */
export function Skeleton({
  height = 16,
  width = "100%",
  radius = 8,
  style,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      className="skel"
      aria-hidden="true"
      style={{ height, width, borderRadius: radius, ...style }}
    />
  );
}

/** Stand-in for a grid of cards (charts, tables) while they load. */
export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="cards" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <Skeleton key={i} height={250} radius={18} />
      ))}
    </div>
  );
}

/** A panel-shaped placeholder for a page section. */
export function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="panel" aria-busy="true" style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: lines }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <Skeleton key={i} width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}
