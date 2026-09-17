import { useState } from "react";
import { AlertTriangle, Flag } from "lucide-react";
import { toast } from "sonner";
import { useCreateReport } from "~/lib/mutations";

const REPORT_REASONS = [
  ["wrong", "Wrong solution"],
  ["incomplete", "Incomplete or unclear answer"],
  ["behaviour", "Rude or inappropriate reply"],
  ["other", "Something else"],
] as const;

export function ReportBox({ id }: { id: number }) {
  const create = useCreateReport(id);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const send = async () => {
    if (!reason) {
      setErr("Choose what the problem is.");
      return;
    }
    if (text.trim().length < 10) {
      setErr("Write at least 10 characters so the admins understand the problem.");
      return;
    }
    try {
      await create.trigger({ reason, text: text.trim() });
      setOpen(false);
      setReason("");
      setText("");
      setErr("");
      toast("Report sent to the admins.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send the report");
    }
  };

  return (
    <section className="section panel report-box" aria-labelledby="report-h">
      <div>
        <h2 className="h3" id="report-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Flag size={18} aria-hidden="true" />
          Report a problem to the admins
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: 15 }}>
          If the solution is wrong or something else went wrong, tell the
          Achieve Doubts admins. Only admins see reports.
        </p>
      </div>

      {open ? (
        <div style={{ display: "grid", gap: 14 }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              What's the problem?
            </legend>
            <div className="reason-list">
              {REPORT_REASONS.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={`reason-${id}`}
                    value={value}
                    checked={reason === value}
                    onChange={() => {
                      setReason(value);
                      setErr("");
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>Details</span>
            <textarea
              className="textarea"
              style={{ minHeight: 90 }}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setErr("");
              }}
            />
            <small>Explain what's wrong so an admin can check it.</small>
          </label>

          {err && (
            <div className="err" role="alert">
              <AlertTriangle size={16} />
              {err}
            </div>
          )}

          <div className="composer-row">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setOpen(false);
                setErr("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginLeft: "auto" }}
              disabled={create.isMutating}
              onClick={send}
            >
              <Flag size={14} />
              Send report
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ justifySelf: "start" }}
          onClick={() => setOpen(true)}
        >
          <Flag size={14} />
          Report a problem
        </button>
      )}
    </section>
  );
}
