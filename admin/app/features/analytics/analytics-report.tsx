import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clock, dur, fmt, share } from "~/lib/format";
import { type Analytics, type RangeFilters, useAnalytics, useSubjects } from "~/lib/queries";

export const CHART = {
  navy: "#14224A",
  blue: "#3563D9",
  gold: "#E9A92B",
  coral: "#D8574A",
  pin: "#9AA6BD",
  grid: "#E1E8F2",
};

const tick = { fontSize: 12, fill: "#4A5878" };
const tipStyle = { borderRadius: 10, border: "1px solid #C6D2E4", fontSize: 13 };

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayStart = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * Every day (or, past 31 days, every week) of the range, with its answered
 * count. The API only returns days that had answers; the gaps are zeros.
 */
function trendSeries(trend: Analytics["trend"], from: string, to: string) {
  const byDay = new Map(trend.map((t) => [t.day, t.total]));
  const span = Math.round((dayStart(to) - dayStart(from)) / DAY_MS) + 1;
  const step = span > 31 ? 7 : 1;
  const series: Array<{ name: string; value: number }> = [];

  for (let i = 0; i < span; i += step) {
    const start = dayStart(from) + i * DAY_MS;
    let value = 0;
    for (let d = 0; d < step && i + d < span; d++) {
      const day = new Date(start + d * DAY_MS);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      value += byDay.get(key) ?? 0;
    }
    series.push({ name: fmtDay(start), value });
  }
  return { series, weekly: step === 7 };
}

export function AnalyticsMetrics({ filters }: { filters: RangeFilters }) {
  const data = useAnalytics(filters);
  const { satisfied, unsatisfied } = data.satisfaction;

  return (
    <div className="metrics" style={{ "--cols": 4 } as React.CSSProperties}>
      <div className="metric">
        <div className="v">{fmt(data.total)}</div>
        <div className="l">Questions answered</div>
      </div>
      <div className="metric">
        <div className="v">{share(satisfied, satisfied + unsatisfied)}</div>
        <div className="l">Satisfaction rate</div>
      </div>
      <div className="metric">
        <div className="v">{data.total ? dur(data.avgResponseMinutes) : "–"}</div>
        <div className="l">Average response time</div>
      </div>
      <div className="metric">
        <div className="v">{data.total ? clock(data.avgMatchSeconds) : "–"}</div>
        <div className="l">Average wait for a solver</div>
      </div>
    </div>
  );
}

export function AnalyticsCharts({ filters }: { filters: RangeFilters }) {
  const data = useAnalytics(filters);
  const subjects = useSubjects();

  if (data.total === 0) {
    return (
      <div className="empty">
        <p style={{ margin: 0 }}>No activity in this range. Pick wider dates or clear a filter.</p>
      </div>
    );
  }

  const totals = new Map(data.perSubject.map((s) => [s.subjectId, s.total]));
  const perSubject = subjects.map((s) => ({ name: s.nameEn, value: totals.get(s.id) ?? 0 }));
  const { series, weekly } = trendSeries(data.trend, filters.from, filters.to);
  const pie = [
    { name: "Satisfied", value: data.satisfaction.satisfied, color: CHART.blue },
    { name: "Not satisfied", value: data.satisfaction.unsatisfied, color: CHART.coral },
    { name: "Unrated", value: data.satisfaction.unrated, color: CHART.pin },
  ];
  const animate = !reduceMotion();

  return (
    <div className="charts">
      <div className="chart">
        <h3>Questions per subject</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perSubject} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} />
              <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                cursor={{ fill: "#EEF3FA" }}
                contentStyle={tipStyle}
                formatter={(v) => [fmt(Number(v)), "Questions answered"]}
              />
              <Bar dataKey="value" fill={CHART.navy} radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={animate} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart">
        <h3>Satisfaction breakdown</h3>
        <div className="legend">
          {pie.map((p) => (
            <span key={p.name}>
              <i style={{ background: p.color }} />
              {p.name}: {fmt(p.value)}
            </span>
          ))}
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pie}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                stroke="none"
                isAnimationActive={animate}
              >
                {pie.map((p) => (
                  <Cell key={p.name} fill={p.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tipStyle} formatter={(v, name) => [fmt(Number(v)), name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart wide">
        <h3>{weekly ? "Answered questions per week" : "Answered questions per day"}</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={18} />
              <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => fmt(v)} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => [fmt(Number(v)), "Questions answered"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={CHART.blue}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: CHART.gold, stroke: CHART.navy }}
                isAnimationActive={animate}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
