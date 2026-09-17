import { Download } from "lucide-react";
import { toast } from "sonner";
import { ActiveTag } from "~/components/primitives";
import { dur, fmt, formatDate, share } from "~/lib/format";
import { type SolverRow, solverCredentials, usePayouts, useSolvers } from "~/lib/queries";

export type InvoiceLine = {
  solver: SolverRow;
  answered: number;
  satisfied: number;
  unsatisfied: number;
  unrated: number;
  avgRespMin: number | null;
};

/** Every solver, with their figures for the range (zeros if none). */
function useInvoice(from: string, to: string) {
  const solvers = useSolvers();
  const payouts = usePayouts(from, to);
  const bySolver = new Map(payouts.map((p) => [p.solverId, p]));

  const lines: InvoiceLine[] = solvers.map((solver) => {
    const p = bySolver.get(solver.id);
    return {
      solver,
      answered: p?.answered ?? 0,
      satisfied: p?.satisfied ?? 0,
      unsatisfied: p?.unsatisfied ?? 0,
      unrated: p?.unrated ?? 0,
      avgRespMin: p?.avgRespMin ?? null,
    };
  });

  const total = lines.reduce(
    (t, l) => ({
      answered: t.answered + l.answered,
      satisfied: t.satisfied + l.satisfied,
      unsatisfied: t.unsatisfied + l.unsatisfied,
      unrated: t.unrated + l.unrated,
    }),
    { answered: 0, satisfied: 0, unsatisfied: 0, unrated: 0 },
  );

  return { lines, total };
}

export function InvoiceTable({ from, to }: { from: string; to: string }) {
  const { lines, total } = useInvoice(from, to);

  if (total.answered === 0) {
    return (
      <div className="empty">
        <p style={{ margin: 0 }}>No answered questions in this range.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap stack-wrap">
      <table className="tbl stack wide" style={{ minWidth: 900 }}>
        <caption className="sr">
          Invoice: {formatDate(`${from}T00:00:00`)} – {formatDate(`${to}T00:00:00`)}
        </caption>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th className="num">Answered</th>
            <th className="num">Satisfied</th>
            <th className="num">Not satisfied</th>
            <th className="num">Unrated</th>
            <th className="num">Satisfaction</th>
            <th className="num">Avg response</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.solver.id}>
              <td className="lead">
                <b>{l.solver.name}</b> <ActiveTag active={!l.solver.banned} />
                <div className="muted" style={{ fontSize: 12 }}>
                  {solverCredentials(l.solver)}
                </div>
              </td>
              <td data-label="Email" className="email-cell">
                {l.solver.email}
              </td>
              <td className="tnum" data-label="Phone" style={{ whiteSpace: "nowrap" }}>
                {l.solver.phone || "–"}
              </td>
              <td className="num" data-label="Answered">
                {fmt(l.answered)}
              </td>
              <td className="num" data-label="Satisfied">
                {fmt(l.satisfied)}
              </td>
              <td className="num" data-label="Not satisfied">
                {fmt(l.unsatisfied)}
              </td>
              <td className="num" data-label="Unrated">
                {fmt(l.unrated)}
              </td>
              <td className="num" data-label="Satisfaction">
                {share(l.satisfied, l.satisfied + l.unsatisfied)}
              </td>
              <td className="num" data-label="Avg response">
                {l.answered ? dur(l.avgRespMin) : "–"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="lead">
              <b>Total</b>
            </td>
            <td />
            <td />
            <td className="num" data-label="Answered">
              {fmt(total.answered)}
            </td>
            <td className="num" data-label="Satisfied">
              {fmt(total.satisfied)}
            </td>
            <td className="num" data-label="Not satisfied">
              {fmt(total.unsatisfied)}
            </td>
            <td className="num" data-label="Unrated">
              {fmt(total.unrated)}
            </td>
            <td className="num" data-label="Satisfaction">
              {share(total.satisfied, total.satisfied + total.unsatisfied)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Satisfaction as a percentage with one decimal, blank when unrated. */
const ratio = (s: number, u: number) => (s + u ? Math.round((s / (s + u)) * 1000) / 10 : null);

/**
 * Builds the .xlsx in the browser from the same figures as the table: an
 * "Invoice" sheet and a "Details" sheet with the range.
 */
export function ExportButton({ from, to }: { from: string; to: string }) {
  const { lines, total } = useInvoice(from, to);

  const exportXlsx = async () => {
    const file = `achieve-doubts-invoice_${from}_to_${to}.xlsx`;
    try {
      // Only staff who export pay for the spreadsheet writer.
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const bold = { fontWeight: "bold" as const };
      const head = [
        "Name",
        "Email",
        "Phone",
        "Institution",
        "Status",
        "Answered",
        "Satisfied",
        "Not satisfied",
        "Unrated",
        "Satisfaction (%)",
        "Avg response (min)",
      ].map((value) => ({ value, ...bold }));

      const body = lines.map((l) => [
        l.solver.name,
        l.solver.email,
        l.solver.phone ?? "",
        solverCredentials(l.solver),
        l.solver.banned ? "Deactivated" : "Active",
        l.answered,
        l.satisfied,
        l.unsatisfied,
        l.unrated,
        ratio(l.satisfied, l.unsatisfied),
        l.avgRespMin == null ? null : Math.round(l.avgRespMin * 10) / 10,
      ]);

      const totals = [
        { value: "Total", ...bold },
        null,
        null,
        null,
        null,
        total.answered,
        total.satisfied,
        total.unsatisfied,
        total.unrated,
        ratio(total.satisfied, total.unsatisfied),
        null,
      ];

      await writeXlsxFile([
        {
          sheet: "Invoice",
          data: [head, ...body, totals],
          columns: [22, 26, 15, 30, 12, 11, 11, 13, 11, 14, 16].map((width) => ({ width })),
          stickyRowsCount: 1,
        },
        {
          sheet: "Details",
          data: [
            [{ value: "Achieve Doubts solver invoice", ...bold }],
            ["From", from],
            ["To", to],
            ["Generated", new Date().toISOString()],
          ],
          columns: [{ width: 20 }, { width: 26 }],
        },
      ]).toFile(file);

      toast(`Exported ${file}`);
    } catch (err) {
      console.error(err);
      toast.error("The export didn't complete. Try again.");
    }
  };

  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={total.answered === 0}
      onClick={exportXlsx}
    >
      <Download size={16} />
      Export to Excel
    </button>
  );
}

export function ExportButtonPlaceholder() {
  return (
    <button type="button" className="btn btn-primary" disabled>
      <Download size={16} />
      Export to Excel
    </button>
  );
}
