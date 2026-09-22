import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

/**
 * The one form behind every add and edit on the taxonomy page. A class,
 * subject, book and chapter all carry the same three fields — two names and
 * a position — so they share a form rather than four near-identical ones.
 *
 * `position` is the sort order everywhere except a chapter, where it is the
 * chapter number and starts at 1.
 */
function nodeSchema(minPosition: number) {
  return z.object({
    nameEn: z.string().trim().min(1, "Give it an English name."),
    nameBn: z.string().trim().min(1, "Give it a Bangla name."),
    position: z.coerce
      .number()
      .int()
      .min(minPosition, `Use ${minPosition} or more.`)
      .max(999, "Use 999 or less."),
  });
}

export type NodeValues = z.output<ReturnType<typeof nodeSchema>>;

export function NodeForm({
  legend,
  positionLabel,
  minPosition = 0,
  defaults,
  busy,
  onSave,
  onCancel,
}: {
  legend: string;
  positionLabel: string;
  minPosition?: number;
  defaults: { nameEn: string; nameBn: string; position: number };
  busy: boolean;
  onSave: (values: NodeValues) => Promise<void>;
  onCancel: () => void;
}) {
  const schema = useMemo(() => nodeSchema(minPosition), [minPosition]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    reValidateMode: "onChange",
    defaultValues: defaults,
  });

  return (
    <form
      className="tax-form"
      aria-label={legend}
      onSubmit={handleSubmit(onSave)}
      noValidate
    >
      <label className="field">
        <span>Name (English)</span>
        <input
          className="input"
          autoComplete="off"
          aria-invalid={errors.nameEn ? "true" : undefined}
          {...register("nameEn")}
        />
        {errors.nameEn && (
          <span className="field-err">
            <AlertTriangle size={13} />
            {errors.nameEn.message}
          </span>
        )}
      </label>

      <label className="field">
        <span>Name (Bangla)</span>
        <input
          className="input"
          autoComplete="off"
          lang="bn"
          aria-invalid={errors.nameBn ? "true" : undefined}
          {...register("nameBn")}
        />
        {errors.nameBn && (
          <span className="field-err">
            <AlertTriangle size={13} />
            {errors.nameBn.message}
          </span>
        )}
      </label>

      <label className="field" style={{ maxWidth: 160 }}>
        <span>{positionLabel}</span>
        <input
          className="input"
          type="number"
          min={minPosition}
          max={999}
          aria-invalid={errors.position ? "true" : undefined}
          {...register("position")}
        />
        {errors.position && (
          <span className="field-err">
            <AlertTriangle size={13} />
            {errors.position.message}
          </span>
        )}
      </label>

      <div className="tax-form-acts">
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={busy || isSubmitting}
        >
          Save
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
