import { useState } from "react";
import { useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { AsyncBoundary } from "~/components/async-boundary";
import { useCreateQuestion } from "~/lib/mutations";
import { type AskForm as AskValues, askSchema } from "./ask-schema";
import { PhotoField } from "./photo-field";
import { TaxonomyFields, TaxonomyFieldsPlaceholder } from "./taxonomy-fields";

/**
 * The ask form. The question text is usable at once; only the taxonomy
 * selects wait for their data.
 */
export function AskForm() {
  const navigate = useNavigate();
  const create = useCreateQuestion();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");

  const form = useForm<AskValues>({
    resolver: zodResolver(askSchema),
    defaultValues: { subjectId: "", bookId: "", chapterId: 0, textbookId: "", text: "" },
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError("");
    try {
      const created = await create.trigger({
        subjectId: values.subjectId,
        bookId: values.bookId,
        chapterId: Number(values.chapterId),
        textbookId: values.textbookId || null,
        text: values.text,
        photoUrl,
      });
      toast("Question posted. It's now in the queue.");
      navigate(`/questions/${created.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Couldn't post the question");
    }
  });

  const firstError =
    errors.subjectId?.message ??
    errors.bookId?.message ??
    errors.chapterId?.message ??
    errors.text?.message ??
    submitError;

  return (
    <FormProvider {...form}>
      <form className="panel" style={{ display: "grid", gap: 18 }} onSubmit={onSubmit}>
        <AsyncBoundary
          fallback={<TaxonomyFieldsPlaceholder />}
          errorText="Couldn't load subjects."
        >
          <TaxonomyFields />
        </AsyncBoundary>

        <label className="field">
          <span>Your question</span>
          <textarea
            className="textarea"
            style={{ minHeight: 150 }}
            aria-invalid={errors.text ? "true" : undefined}
            {...register("text")}
          />
          <small>Write the full problem and what you've already tried.</small>
        </label>

        <PhotoField value={photoUrl} onChange={setPhotoUrl} onError={setSubmitError} />

        {firstError && (
          <div className="err" role="alert">
            <AlertTriangle size={16} />
            {firstError}
          </div>
        )}

        <div>
          <button
            type="submit"
            className="btn btn-primary btn-lg ask-submit"
            disabled={isSubmitting || create.isMutating}
          >
            <Send size={16} />
            Post question
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
