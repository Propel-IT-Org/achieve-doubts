import { useState } from "react";
import { useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldPath, useForm } from "react-hook-form";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useCreateSolver } from "~/lib/mutations";

/** Bangladeshi mobile numbers, with or without +880, spaces or dashes. */
const localDigits = (v: string) => v.replace(/\D/g, "").replace(/^880/, "0");

const solverSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the solver's name."),
    email: z.string().trim().pipe(z.email("Enter a valid email address.")),
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_.]{3,30}$/, "Use 3 to 30 letters, numbers, dots or underscores."),
    phone: z
      .string()
      .transform(localDigits)
      .pipe(z.string().regex(/^01[3-9]\d{8}$/, "Enter an 11-digit mobile number starting with 01.")),
    institution: z.string().trim().min(1, "Enter the solver's institution."),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((f) => f.confirm && f.confirm === f.password, {
    path: ["confirm"],
    message: "The passwords don't match.",
  });

type SolverForm = z.input<typeof solverSchema>;
type SolverValues = z.output<typeof solverSchema>;
type Field = FieldPath<SolverForm>;

/** The API's uniqueness refusals, mapped onto the field they concern. */
function fieldForConflict(message: string): Field | null {
  if (/email/i.test(message)) return "email";
  if (/phone/i.test(message)) return "phone";
  if (/username/i.test(message)) return "username";
  return null;
}

export function AddSolverForm() {
  const navigate = useNavigate();
  const create = useCreateSolver();
  const [show, setShow] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitted, isSubmitting },
  } = useForm<SolverForm, unknown, SolverValues>({
    resolver: zodResolver(solverSchema),
    // Re-check as the user fixes things, once they've tried to submit.
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: {
      name: "",
      email: "",
      username: "",
      phone: "",
      institution: "",
      password: "",
      confirm: "",
    },
  });

  // `values` is the schema's output: trimmed, phone reduced to 11 digits.
  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.trigger({
        name: values.name,
        email: values.email,
        username: values.username,
        phone: `${values.phone.slice(0, 5)}-${values.phone.slice(5)}`,
        institution: values.institution,
        password: values.password,
      });
      toast(`${values.name} can now log in on the main site.`);
      navigate("/solvers");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't create the solver";
      const field = fieldForConflict(message);
      if (field) setError(field, { message }, { shouldFocus: true });
      else toast.error(message);
    }
  });

  const field = (
    name: Field,
    label: string,
    opts: { type?: string; hint?: string; full?: boolean; autoComplete?: string; inputMode?: "tel" } = {},
  ) => {
    const error = errors[name]?.message;
    return (
      <label className={`field${opts.full ? " full" : ""}`}>
        <span>{label}</span>
        <input
          id={`ns-${name}`}
          className="input"
          type={opts.type ?? "text"}
          autoComplete={opts.autoComplete ?? "off"}
          inputMode={opts.inputMode}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={`ns-${name}-msg`}
          {...register(name)}
        />
        <span id={`ns-${name}-msg`}>
          {error ? (
            <span className="field-err">
              <AlertTriangle size={13} />
              {error}
            </span>
          ) : opts.hint ? (
            <small>{opts.hint}</small>
          ) : null}
        </span>
      </label>
    );
  };

  const hasErrors = Object.keys(errors).length > 0;
  const passwordType = show ? "text" : "password";

  return (
    <div style={{ maxWidth: 780 }}>
      <form className="panel" style={{ display: "grid", gap: 20 }} onSubmit={onSubmit} noValidate>
        <div className="form-grid">
          {field("name", "Name", { full: true })}
          {field("email", "Email", { type: "email" })}
          {field("username", "Username", { hint: "Used to log in on the main site." })}
          {field("phone", "Phone", {
            type: "tel",
            inputMode: "tel",
            hint: "Bangladeshi mobile number, for example 01712-345678",
          })}
          {field("institution", "Institution", {
            full: true,
            hint: "For example: BUET, Mechanical Engineering, 2024",
          })}
          {field("password", "Password", {
            type: passwordType,
            autoComplete: "new-password",
            hint: "At least 8 characters.",
          })}
          {field("confirm", "Confirm password", { type: passwordType, autoComplete: "new-password" })}
        </div>
        <label className="check">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Show passwords
        </label>
        {isSubmitted && hasErrors && (
          <div className="err" role="alert">
            <AlertTriangle size={16} />
            Fix the highlighted fields to continue.
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            <Plus size={16} />
            Create solver account
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/solvers")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
