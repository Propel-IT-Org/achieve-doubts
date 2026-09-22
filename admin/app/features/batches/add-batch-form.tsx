import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useCreateBatch } from "~/lib/mutations";
import { LevelOptions } from "./level-options";

/**
 * The id is compared with the `Batch` value Achieve sends, character for
 * character, so it's only trimmed — never lower-cased. Spaces are refused
 * because they're almost always a typo.
 */
const batchSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Enter the batch id Achieve sends.")
    .max(64, "Use 64 characters or fewer.")
    .regex(/^\S+$/, "The id can't contain spaces."),
  label: z.string().trim().min(1, "Give the batch a name admins will recognise."),
  // Empty means no class: those students see every level's taxonomy.
  levelId: z.string().trim(),
});

type BatchForm = z.input<typeof batchSchema>;
type BatchValues = z.output<typeof batchSchema>;

export function AddBatchForm({ onDone }: { onDone: () => void }) {
  const create = useCreateBatch();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BatchForm, unknown, BatchValues>({
    resolver: zodResolver(batchSchema),
    reValidateMode: "onChange",
    defaultValues: { id: "", label: "", levelId: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.trigger({ ...values, levelId: values.levelId || null });
      toast(`Batch ${values.id} added. Its students can sign in now.`);
      onDone();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't add the batch";
      // The only conflict this endpoint reports is a duplicate id.
      if (/exists/i.test(message)) setError("id", { message }, { shouldFocus: true });
      else toast.error(message);
    }
  });

  return (
    <form className="panel" style={{ display: "grid", gap: 20 }} onSubmit={onSubmit} noValidate>
      <div className="form-grid">
        <label className="field">
          <span>Batch id</span>
          <input
            className="input"
            autoComplete="off"
            aria-invalid={errors.id ? "true" : undefined}
            {...register("id")}
          />
          <span>
            {errors.id ? (
              <span className="field-err">
                <AlertTriangle size={13} />
                {errors.id.message}
              </span>
            ) : (
              <small>Exactly as Achieve sends it, for example hscfrb26.</small>
            )}
          </span>
        </label>

        <label className="field">
          <span>Class</span>
          <select className="select" {...register("levelId")}>
            <option value="">No class yet</option>
            <LevelOptions />
          </select>
          <span>
            <small>Its students can only ask about this class's syllabus.</small>
          </span>
        </label>

        <label className="field">
          <span>Name</span>
          <input
            className="input"
            autoComplete="off"
            aria-invalid={errors.label ? "true" : undefined}
            {...register("label")}
          />
          <span>
            {errors.label ? (
              <span className="field-err">
                <AlertTriangle size={13} />
                {errors.label.message}
              </span>
            ) : (
              <small>Shown here only, for example HSC First Batch 2026.</small>
            )}
          </span>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          <Plus size={16} />
          Add batch
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
